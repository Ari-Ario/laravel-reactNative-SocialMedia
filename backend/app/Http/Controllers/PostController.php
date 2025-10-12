<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\Reaction;
use App\Models\Comment;
use App\Models\ReactionComment;
use App\Models\Repost;
use App\Models\Bookmark;
use App\Models\Media;
use App\Models\Follower;

use Pusher\Pusher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;
use App\Events\NewComment;
use App\Events\NewReaction;
use App\Events\NewCommentReaction;
use App\Events\CommentDeleted;
use App\Events\DeleteReactionComment;
use App\Events\DeleteReaction;
use App\Events\PostDeleted;
use App\Events\NewPost;
use App\Events\PostUpdated;
use App\Events\CommentReaction;
// use App\Events\RepostEvent;
// use App\Events\BookmarkEvent;
// use App\Events\ShareEvent;
// use App\Events\UpdatePost;
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
                    'reposts.user',
                ])
                ->withCount([
                    'reactions',
                    'comments',
                    'reposts'
                ])
    ->withExists([
        'reposts as is_reposted' => function ($q) use ($userId) {
            $q->where('user_id', $userId);
        },
        // ✅ Correct way to add is_following
        'user as is_following' => function ($q) use ($userId) {
            // check if the post author has the current user among their followers
            $q->whereHas('followers', function ($qq) use ($userId) {
                // check follower user id — don't reference pivot here
                $qq->whereKey($userId);
            });
        },
    ])
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

    // store method
    public function store(Request $request)
    {
        $request->validate([
            'caption' => 'nullable|string|max:500',
            'media' => 'sometimes|array|max:10',
            'media.*' => 'file|mimes:jpg,jpeg,png,mp4,mov,webm,avi,mp3,wav,pdf,doc,docx|max:20480'
        ]);

        $post = Post::create([
            'user_id' => Auth::id(),
            'caption' => $request->caption
        ]);
        
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
        
        // Load the post with relationships before broadcasting
        $post->load('user', 'media');
        
        // ✅ FIX: Get follower IDs and pass to event
        $followerIds = Auth::user()->followers()->pluck('users.id')->toArray();
        
        broadcast(new NewPost($post, $followerIds));

        return response()->json($post);
    }


    public function destroy(Post $post)
    {
        // Manual authorization check
        if (auth()->id() !== $post->user_id) {
            return response()->json([
                'message' => 'Unauthorized: You can only delete your own posts'
            ], 403);
        }

        // Use transaction to ensure data integrity
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

            // Store post ID before deletion
            $postId = $post->id;
            $postCaption = $post->caption;
            $mediaCount = $post->media()->count();

            // Delete the post
            $post->delete();

            DB::commit();
            
            // Broadcast the deletion of post
            $followerIds = Auth::user()->followers()->pluck('users.id')->toArray();
        
            broadcast(new PostDeleted(
                $postId, // Pass postId as first parameter
                $postCaption,
                $followerIds,
                Auth::id(),
                Auth::user()->name
                // Removed $postToDelete since it's not needed
            ));

            return response()->json([
                'message' => 'Post deleted successfully',
                'deleted_media_count' => $mediaCount
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

    public function update(Request $request, Post $post)
    {
        // Verify ownership
        if ($post->user_id !== Auth::id()) {
            abort(403, 'Unauthorized action.');
        }

        $request->validate([
            'caption' => 'nullable|string|max:500',
            'media' => 'sometimes|array|max:10',
            'media.*' => 'file|mimes:jpg,jpeg,png,mp4,mov,webm,avi,mp3,wav,pdf,doc,docx|max:20480',
            'delete_media' => 'sometimes|array',
            'delete_media.*' => 'exists:media,id'
        ]);

        $changes = [];
        $updatedFields = [];

        // Track caption changes
        if ($request->has('caption') && $request->caption !== $post->caption) {
            $changes['caption'] = [
                'old' => $post->caption,
                'new' => $request->caption
            ];
            $updatedFields[] = 'caption';
            
            $post->caption = $request->caption;
            $post->save();
        }

        // Track media deletions
        $deletedMedia = [];
        if ($request->has('delete_media')) {
            foreach ($request->delete_media as $mediaId) {
                $media = Media::find($mediaId);
                if ($media) {
                    $deletedMedia[] = [
                        'id' => $media->id,
                        'file_path' => $media->file_path,
                        'type' => $media->type
                    ];
                    Storage::disk('public')->delete($media->file_path);
                    $media->delete();
                }
            }
            if (!empty($deletedMedia)) {
                $changes['deleted_media'] = $deletedMedia;
                $updatedFields[] = 'media';
            }
        }

        // Track new media uploads
        $newMedia = [];
        if ($request->hasFile('media')) {
            foreach ($request->file('media') as $file) {
                $type = $this->getMediaType($file->getMimeType());
                $folder = $this->getMediaFolder($type);
                $path = $file->store("media/{$folder}/" . Auth::id(), 'public');
                
                $media = $post->media()->create([
                    'file_path' => $path,
                    'type' => $type,
                    'mime_type' => $file->getMimeType(),
                    'size' => $file->getSize(),
                    'original_name' => $file->getClientOriginalName()
                ]);
                
                $newMedia[] = [
                    'id' => $media->id,
                    'file_path' => $media->file_path,
                    'type' => $media->type,
                    'mime_type' => $media->mime_type
                ];
            }
            if (!empty($newMedia)) {
                $changes['new_media'] = $newMedia;
                $updatedFields[] = 'media';
            }
        }

        // Reload the post with fresh relationships
        $updatedPost = $post->fresh()->load('user', 'media');

        // Broadcast update event only if there were actual changes
        if (!empty($updatedFields)) {
            // ✅ GET FOLLOWER IDs
            $followerIds = Auth::user()->followers()->pluck('users.id')->toArray();
            
            // ✅ USE SINGLE EVENT FOR BOTH REAL-TIME UPDATES AND NOTIFICATIONS
            broadcast(new PostUpdated(
                $post->id, 
                Auth::id(), 
                Auth::user()->name, 
                $changes, 
                $updatedFields,
                $followerIds // ✅ PASS FOLLOWER IDs
            ));

            Log::info('✅ Post updated and broadcasted', [
                'post_id' => $post->id,
                'user_id' => Auth::id(),
                'user_name' => Auth::user()->name,
                'updated_fields' => $updatedFields,
                'changes' => $changes,
                'follower_count' => count($followerIds)
            ]);
        }

        return response()->json($updatedPost);
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

        broadcast(new NewReaction($reaction, $post->id));

        return response()->json([
            'reaction' => $reaction,
            'reaction_counts' => $post->reactionCounts
        ]);
    }


    public function comment(Request $request, Post $post)
    {
        // \Log::info('💬 REAL COMMENT API CALLED', [
        //     'post_id' => $post->id,
        //     'user_id' => Auth::id(),
        //     'payload' => $request->all(),
        // ]);

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

        // Load relationships
        $comment->load('user', 'replies');

        \Log::info('✅ REAL COMMENT CREATED - Testing broadcast methods', [
            'comment_id' => $comment->id,
            'post_id' => $post->id
        ]);

        // METHOD 1: Test direct Pusher first
        // try {
        //     $config = config('broadcasting.connections.pusher');
            
        //     \Log::info('🔍 Pusher config', ['config' => $config]);
            
        //     $pusher = new Pusher(  // ← Now this will work with the correct import
        //         $config['key'],
        //         $config['secret'],
        //         $config['app_id'],
        //         $config['options']
        //     );
            
        //     $directData = [
        //         'comment' => [
        //             'id' => $comment->id,
        //             'content' => $comment->content,
        //             'user_id' => $comment->user_id,
        //             'user' => $comment->user,
        //             'created_at' => $comment->created_at->toISOString(),
        //             'updated_at' => $comment->updated_at->toISOString()
        //         ],
        //         'postId' => $post->id
        //     ];
            
        //     \Log::info('🔍 Attempting direct Pusher trigger', [
        //         'channel' => 'post.' . $post->id,
        //         'event' => 'new-comment',
        //         'data' => $directData
        //     ]);
            
        //     $directResponse = $pusher->trigger('post.' . $post->id, 'new-comment', $directData);
        //     \Log::info('✅ Direct Pusher trigger result', ['response' => $directResponse]);
            
        // } catch (\Exception $e) {
        //     \Log::error('❌ Direct Pusher trigger failed', [
        //         'error' => $e->getMessage(),
        //         'trace' => $e->getTraceAsString()
        //     ]);
        // }

        // METHOD 2: Test Laravel broadcast (should work now with the provider)
        try {
            \Log::info('🔍 Attempting Laravel broadcast');
            // broadcast(new \App\Events\NewComment($comment, $post->id));
            broadcast(new \App\Events\NewComment($comment, $post->id, $post->user_id));

            \Log::info('✅ Laravel broadcast called successfully');
        } catch (\Exception $e) {
            \Log::error('❌ Laravel broadcast failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }

        return response()->json($comment);
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
        
        broadcast(new CommentReaction($reaction, $commentId, $comment->post_id));
        
        //  \Log::info('✅ CommentReaction Event Broadcasted', [
        //     'comment_id' => $commentId,
        //     'post_id' => $comment->post_id,
        //     'reaction_id' => $reaction->id,
        //     'user_id' => $reaction->user_id
        // ]);

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

    public function deleteComment($postId, $commentId)
    {
        try {
            $comment = Comment::where('post_id', $postId)
                ->where('id', $commentId)
                ->where('user_id', auth()->id())
                ->firstOrFail();

            $comment->delete();

            // Broadcast the deletion
            broadcast(new CommentDeleted($postId, $commentId));

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
    
}