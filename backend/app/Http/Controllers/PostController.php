<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\Reaction;
use App\Models\Comment;
use App\Models\ReactionComment;
use App\Models\Repost;
use App\Models\Bookmark;
use App\Models\Media;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;

class PostController extends Controller
{

    public function index()
    {
        try {
            $userId = Auth::id();
            
            $posts = Post::with([
                    'user',
                    'media',
                    'reactions',
                    'reactionCounts',
                    'comments.user',
                    'comments.reaction_comments.user',
                    'comments.replies' => function ($query) {
                        $query->with(['user', 'reaction_comments.user'])
                            ->withCount('reaction_comments');
                    },
                    'comments.replies.replies' => function ($query) {
                        $query->with(['user', 'reaction_comments.user'])
                            ->withCount('reaction_comments');
                    },
                    // Add more levels if needed
                    'reposts.user'
                ])
                ->withCount([
                    'reactions',
                    'comments',
                    'reposts'
                ])
                ->withExists(['reposts as is_reposted' => function($query) use ($userId) {
                    $query->where('user_id', $userId);
                }])
                ->latest()
                ->paginate(10);

            // Recursively transform all comments and replies
            $posts->getCollection()->transform(function ($post) {
                $transformComment = function ($comment) use (&$transformComment) {
                    $comment->reaction_comments_count = $comment->reaction_comments->count();
                    
                    if ($comment->replies) {
                        $comment->replies->each($transformComment);
                    }
                    
                    return $comment;
                };
                
                $post->comments->each($transformComment);
                return $post;
            });

            return response()->json($posts);

        } catch (\Exception $e) {
            \Log::error('PostController error: '.$e->getMessage());
            return response()->json(['error' => 'Server error'], 500);
        }
    }

    public function store(Request $request)
    {
        $request->validate([
            'caption' => 'nullable|string|max:500',
            'media' => 'required|array|max:10',
            'media.*' => 'file|mimes:jpg,jpeg,png,mp4,mov,avi,mp3,wav,pdf,doc,docx|max:20480'
        ]);

        $post = Post::create([
            'user_id' => Auth::id(),
            'caption' => $request->caption
        ]);

        foreach ($request->file('media') as $file) {
            $type = $this->getMediaType($file->getMimeType());
            $folder = $this->getMediaFolder($type);
            $path = $file->store("media/{$folder}/" . Auth::id(), 'public');
            
            $post->media()->create([
                'file_path' => $path,
                'type' => $type,
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'original_name' => $file->getClientOriginalName()
            ]);
        }

        return response()->json($post->load('user', 'media'));
    }


    public function update(Request $request, Post $post)
    {
        // Verify ownership
        if ($post->user_id !== Auth::id()) {
            abort(403, 'Unauthorized action.');
        }

        $request->validate([
            'caption' => 'nullable|string|max:500',
            'media' => 'sometimes|array|max:10',
            'media.*' => 'file|mimes:jpg,jpeg,png,mp4,mov,avi,mp3,wav,pdf,doc,docx|max:20480',
            'delete_media' => 'sometimes|array',
            'delete_media.*' => 'exists:media,id'
        ]);

        // Update caption if changed
        if ($request->has('caption')) {
            $post->caption = $request->caption;
            $post->save();
        }

        // Handle media deletions
        if ($request->has('delete_media')) {
            foreach ($request->delete_media as $mediaId) {
                $media = Media::find($mediaId);
                Storage::disk('public')->delete($media->file_path);
                $media->delete();
            }
        }

        // Handle new media uploads
        if ($request->hasFile('media')) {
            foreach ($request->file('media') as $file) {
                $type = $this->getMediaType($file->getMimeType());
                $folder = $this->getMediaFolder($type);
                $path = $file->store("media/{$folder}/" . Auth::id(), 'public');
                
                $post->media()->create([
                    'file_path' => $path,
                    'type' => $type,
                    'mime_type' => $file->getMimeType(),
                    'size' => $file->getSize(),
                    'original_name' => $file->getClientOriginalName()
                ]);
            }
        }

        return response()->json($post->fresh()->load('user', 'media'));
    }

    public function deleteMedia(Post $post, Media $media)
    {
        // Verify user owns the post
        if ($post->user_id !== Auth::id()) {
            abort(403, 'Unauthorized action.');
        }

        // Verify media belongs to post
        // if ($media->post_id !== $post->id) {
        //     abort(400, 'Media does not belong to this post');
        // }

        // Delete file from storage
        Storage::disk('public')->delete($media->file_path);

        // Delete record from database
        $media->delete();

        return response()->json([
            'message' => 'Media deleted successfully',
            'remaining_media' => $post->media()->count()
        ]);
    }
        

    public function destroy(Post $post)
    {
        // Manual authorization check
        if (auth()->id() !== $post->user_id) {
            return response()->json([
                'message' => 'Unauthorized: You can only delete your own posts'
            ], 403);
        }

        try {
            DB::beginTransaction();

            // Delete media files
            foreach ($post->media as $media) {
                // Skip if file doesn't exist
                if (!Storage::disk('public')->exists($media->file_path)) {
                    continue;
                }
                
                // Delete file and database record
                Storage::disk('public')->delete($media->file_path);
                $media->delete();
            }

            // Delete the post
            $post->delete();

            DB::commit();

            return response()->json([
                'message' => 'Post deleted successfully',
                'deleted_media_count' => $post->media()->count()
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            \Log::error('Post deletion failed: ' . $e->getMessage());
            
            return response()->json([
                'message' => 'Failed to delete post',
                'error' => $e->getMessage()
            ], 500);
        }
    }


    private function getMediaType($mimeType)
    {
        if (Str::startsWith($mimeType, 'image/')) return 'image';
        if (Str::startsWith($mimeType, 'video/')) return 'video';
        if (Str::startsWith($mimeType, 'audio/')) return 'audio';
        return 'document';
    }


    // Functions handling bottomBar of each post

    public function react(Request $request, Post $post)
    {
        $request->validate([
            'emoji' => 'required|string|max:10'
        ]);

        $reaction = Reaction::updateOrCreate(
            [
                'user_id' => Auth::id(),
                'post_id' => $post->id
            ],
            [
                'emoji' => $request->emoji
            ]
        );

        return response()->json([
            'reaction' => $reaction,
            'reaction_counts' => $post->reactionCounts
        ]);
    }

    public function comment(Request $request, Post $post)
    {
        $request->validate([
            'content' => 'required|string|max:500',
            'parent_id' => 'nullable|exists:comments,id'
        ]);

        $comment = Comment::create([
            'user_id' => Auth::id(),
            'post_id' => $post->id,
            'parent_id' => $request->parent_id,
            'content' => $request->content
        ]);

        return response()->json($comment->load('user', 'replies'));
    }

    public function reactToComment(Request $request, $commentId)
    {
        $request->validate([
            'emoji' => 'required|string|max:1000'
        ]);
        
        $reaction = ReactionComment::updateOrCreate(
            [
                'user_id' => auth()->id(),
                'comment_id' => $commentId
            ],
            [
                'emoji' => $request->emoji
            ]
        );
        
        $comment = Comment::withCount('reaction_comments')
            ->with(['reaction_comments' => function($query) {
                $query->selectRaw('emoji, count(*) as count')
                    ->groupBy('emoji');
            }])
            ->findOrFail($commentId);
        
        return response()->json([
            'reaction' => $reaction,
            'reaction_counts' => $comment->reactions
        ]);
    }

    public function deleteReaction(Request $request, $postId)
    {
        $user = auth()->user();
        
        // Delete all reactions from this user for this post
        $deleted = Reaction::where([
            'user_id' => $user->id,
            'post_id' => $postId
        ])->delete();

        // Get updated reaction counts
        $post = Post::withCount('reactions')
            ->with(['reactions' => function($query) {
                $query->selectRaw('emoji, count(*) as count')
                    ->groupBy('emoji');
            }])
            ->findOrFail($postId);

        return response()->json([
            'success' => $deleted > 0,
            'reaction_counts' => $post->reactions,
            'reaction_comments_count' => $post->reactions_count
        ]);
    }

    public function deleteCommentReaction(Request $request, $commentId)
    {
        $user = auth()->user();
        
        // Delete all reactions from this user for this comment
        $deleted = ReactionComment::where([
            'user_id' => $user->id,
            'comment_id' => $commentId
        ])->delete();

        // Get updated comment with reactions
        $comment = Comment::withCount('reaction_comments')
            ->with(['reaction_comments' => function($query) {
                $query->selectRaw('emoji, count(*) as count')
                    ->groupBy('emoji');
            }])
            ->findOrFail($commentId);

        return response()->json([
            'success' => $deleted > 0,
            'reaction_counts' => $comment->reaction_comments,
            'reaction_comments_count' => $comment->reaction_comments_count
        ]);
    }



    private function getMediaFolder($type)
    {
        return match($type) {
            'image' => 'images',
            'video' => 'videos',
            'audio' => 'audio',
            default => 'documents'
        };
    }

    public function repost(Post $post)
    {
        $user = Auth::user();
        
        // Check if user already reposted
        $existingRepost = Repost::where('user_id', $user->id)
                            ->where('post_id', $post->id)
                            ->first();

        if ($existingRepost) {
            // Delete the repost if it exists
            $existingRepost->delete();
            
            return response()->json([
                'message' => 'Repost removed',
                'reposted' => false,
                'reposts_count' => $post->reposts()->count()
            ]);
        }

        // Create new repost
        $repost = Repost::create([
            'user_id' => $user->id,
            'post_id' => $post->id
        ]);

        return response()->json([
            'message' => 'Post reposted',
            'reposted' => !$existingRepost,
            'reposts_count' => $post->reposts()->count(),
            'repost_user' => [
                'id' => $user->id,
                'name' => $user->name,
                'avatar_url' => $user->avatar_url
            ]
        ]);
    }

    public function share(Post $post)
    {
        // In a real app, you might want to create a notification here
        return response()->json([
            'message' => 'Post shared successfully',
            'post' => $post->load('user', 'media')
        ]);
    }

    public function bookmark(Post $post)
    {
        $existingBookmark = Bookmark::where('user_id', Auth::id())
            ->where('post_id', $post->id)
            ->first();

        if ($existingBookmark) {
            $existingBookmark->delete();
            return response()->json(['message' => 'Bookmark removed', 'bookmarked' => false]);
        }

        Bookmark::create([
            'user_id' => Auth::id(),
            'post_id' => $post->id
        ]);

        return response()->json(['message' => 'Post bookmarked', 'bookmarked' => true]);
    }

    // In your PostController.php
public function deleteComment($postId, $commentId)
{
    try {
        $comment = Comment::where('post_id', $postId)
            ->where('id', $commentId)
            ->where('user_id', auth()->id())
            ->firstOrFail();

        $comment->delete();

        return response()->json([
            'success' => true,
            'message' => 'Comment deleted successfully',
            'deleted_comment_id' => $commentId,
            'post_id' => $postId
        ]);

    } catch (\Exception $e) {
        \Log::error('Delete comment error: '.$e->getMessage());
        return response()->json([
            'success' => false,
            'error' => 'Failed to delete comment',
            'message' => $e->getMessage()
        ], 500);
    }
}
    
}