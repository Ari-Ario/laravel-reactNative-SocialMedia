<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\Reaction;
use App\Models\Comment;
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
        $userId = Auth::id();
        
        $posts = Post::with([
                'user',
                'media',
                'reactions' => function($query) use ($userId) {
                    $query->where('user_id', $userId);
                },
                'reactionCounts',
                'comments.user',
                'comments.replies.user',
                'reposts.user' // Include the user who reposted
            ])
            ->withCount(['reactions', 'comments', 'reposts'])
            ->withExists(['reposts as is_reposted' => function($query) use ($userId) {
                $query->where('user_id', $userId);
            }])
            ->latest()
            ->paginate(10);

        return response()->json($posts);
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