<?php

namespace App\Http\Controllers;

use App\Models\MarketItem;
use App\Models\Media;
use App\Models\CollaborationSpace;
use App\Models\Comment;
use App\Models\Reaction;
use App\Models\User;
use App\Models\Bookmark;
use App\Models\Repost;
use App\Events\MarketItemCommented;
use App\Events\MarketItemReacted;
use App\Events\MarketItemUpdated;
use App\Events\MarketItemDeleted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class MarketController extends Controller
{
    public function index(Request $request)
    {
        $query = MarketItem::with([
            'user',
            'media',
            'comments.user',
            'reactions',
            'reactionCounts',
            'bookmarks',
            'reposts'
        ])
            ->withCount(['comments', 'reactions', 'bookmarks', 'reposts'])
            ->where('status', 'active');

        if ($request->has('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('location->name', 'like', "%{$search}%");
            });
        }

        // Future AI smart sorting could go here
        $items = $query->latest()->paginate(20);

        return response()->json($items);
    }

    public function myItems(Request $request)
    {
        $query = MarketItem::with([
            'user',
            'media',
            'comments.user',
            'reactions',
            'reactionCounts',
            'bookmarks',
            'reposts'
        ])
            ->withCount(['comments', 'reactions', 'bookmarks', 'reposts'])
            ->where('user_id', Auth::id());

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('location->name', 'like', "%{$search}%");
            });
        }

        $items = $query->latest()->paginate(20);

        return response()->json($items);
    }

    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'price' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'condition' => 'string',
            'category' => 'nullable|string',
            'delivery_available' => 'boolean',
            'location' => 'nullable|string',
            'media' => 'sometimes|array|max:10',
            'media.*' => 'file|mimes:jpg,jpeg,png,mp4,mov,webm,avi,mp3,wav,pdf,doc,docx,ogg,oga,opus,flac,aac,m4a,m4b,m4p,m4r,m4v,mp2,mp3,mp4,mpeg,mpeg4,mpegps,mpg,mpegts,mpegv,mts,oga,ogg,opus,wav,webm,mpga|max:61440',
            'trim_start' => 'sometimes|array',
            'trim_end' => 'sometimes|array',
        ]);

        $item = MarketItem::create([
            'user_id' => Auth::id(),
            'title' => $request->title,
            'description' => $request->description,
            'price' => $request->price,
            'currency' => $request->currency ?? 'USD',
            'condition' => $request->condition ?? 'new',
            'category' => $request->category,
            'delivery_available' => $request->boolean('delivery_available', false),
            'location' => $request->has('location') ? json_decode($request->location, true) : null,
            'status' => 'active',
        ]);

        if ($request->hasFile('media')) {
            $files = $request->file('media');
            $trimStarts = $request->input('trim_start', []);
            $trimEnds = $request->input('trim_end', []);

            foreach ($files as $index => $file) {
                $type = $this->getMediaType($file->getMimeType());
                $folder = $this->getMediaFolder($type);
                $path = $file->store("media/{$folder}/" . Auth::id(), 'public');

                $storedMimeType = $file->getMimeType();
                if ($type === 'video' && isset($trimStarts[$index]) && isset($trimEnds[$index])) {
                    $start = (float) $trimStarts[$index];
                    $end   = (float) $trimEnds[$index];
                    if ($start > 0 || $end > 0) {
                        $newPath = $this->trimVideo($path, $start, $end);
                        if ($newPath !== $path && str_ends_with($newPath, '.mp4')) {
                            $storedMimeType = 'video/mp4';
                        }
                        $path = $newPath;
                    }
                }

                $item->media()->create([
                    'user_id' => Auth::id(),
                    'file_path' => $path,
                    'type' => $type,
                    'mime_type' => $storedMimeType,
                    'size' => $file->getSize(),
                    'original_name' => $file->getClientOriginalName(),
                ]);
            }
        }

        return response()->json($item->load(['user', 'media']), 201);
    }

    public function show($id)
    {
        $item = MarketItem::with([
            'user',
            'media',
            'comments.user',
            'reactions',
            'reactionCounts',
            'bookmarks',
            'reposts'
        ])
            ->withCount(['comments', 'reactions', 'bookmarks', 'reposts'])
            ->findOrFail($id);

        // Increment views
        $item->increment('views');

        return response()->json($item);
    }

    public function update(Request $request, $id)
    {
        \Log::info('Market Item Update Request:', [
            'id' => $id,
            'data' => $request->all(),
            'has_files' => $request->hasFile('media'),
            'delete_media' => $request->delete_media
        ]);

        $item = MarketItem::findOrFail($id);

        if ($item->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:2000',
            'price' => 'sometimes|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'status' => 'sometimes|in:active,sold,inactive',
            'category' => 'nullable|string',
            'condition' => 'sometimes|string',
            'delivery_available' => 'sometimes|boolean',
            'location' => 'nullable|string',
            'media' => 'sometimes|array|max:10',
            'media.*' => 'file|mimes:jpg,jpeg,png,mp4,mov,webm,avi,mp3,wav,pdf,doc,docx,ogg,oga,opus,flac,aac,m4a,m4b,m4p,m4r,m4v,mp2,mp3,mp4,mpeg,mpeg4,mpegps,mpg,mpegts,mpegv,mts,oga,ogg,opus,wav,webm,mpga|max:61440',
            'delete_media' => 'sometimes|array',
            'delete_media.*' => 'exists:media,id',
            'trim_start' => 'sometimes|array',
            'trim_end' => 'sometimes|array',
        ]);

        $updateData = $request->only(['title', 'description', 'price', 'currency', 'status', 'category', 'condition']);

        if ($request->has('delivery_available')) {
            $updateData['delivery_available'] = $request->boolean('delivery_available');
        }

        if ($request->has('location')) {
            $updateData['location'] = json_decode($request->location, true);
        }

        $item->update($updateData);

        // Handle media deletions
        if ($request->has('delete_media')) {
            foreach ($request->delete_media as $mediaId) {
                $media = $item->media()->find($mediaId);
                if ($media) {
                    Storage::disk('public')->delete($media->file_path);
                    $media->delete();
                }
            }
        }

        // Handle new media uploads
        if ($request->hasFile('media')) {
            $files = $request->file('media');
            $trimStarts = $request->input('trim_start', []);
            $trimEnds = $request->input('trim_end', []);

            foreach ($files as $index => $file) {
                $type = $this->getMediaType($file->getMimeType());
                $folder = $this->getMediaFolder($type);
                $path = $file->store("media/{$folder}/" . Auth::id(), 'public');

                $storedMimeType = $file->getMimeType();
                if ($type === 'video' && isset($trimStarts[$index]) && isset($trimEnds[$index])) {
                    $start = (float) $trimStarts[$index];
                    $end   = (float) $trimEnds[$index];
                    if ($start > 0 || $end > 0) {
                        $newPath = $this->trimVideo($path, $start, $end);
                        if ($newPath !== $path && str_ends_with($newPath, '.mp4')) {
                            $storedMimeType = 'video/mp4';
                        }
                        $path = $newPath;
                    }
                }

                $item->media()->create([
                    'user_id' => Auth::id(),
                    'file_path' => $path,
                    'type' => $type,
                    'mime_type' => $storedMimeType,
                    'size' => $file->getSize(),
                    'original_name' => $file->getClientOriginalName(),
                ]);
            }
        }

        $item->load(['user', 'media']);
        broadcast(new MarketItemUpdated($item))->toOthers();

        return response()->json($item);
    }

    public function destroy($id)
    {
        \Log::info('Market Item Delete Request:', ['id' => $id]);

        $item = MarketItem::findOrFail($id);

        if ($item->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $itemId = $item->id;

        \DB::beginTransaction();
        try {
            // Physically delete media files
            foreach ($item->media as $media) {
                if (Storage::disk('public')->exists($media->file_path)) {
                    Storage::disk('public')->delete($media->file_path);
                }
                $media->delete();
            }

            // Delete related records
            $item->comments()->delete();
            $item->reactions()->delete();
            $item->bookmarks()->delete();
            $item->reposts()->delete(); // Fixed: Added reposts deletion

            $item->delete();

            \DB::commit();

            broadcast(new MarketItemDeleted($itemId))->toOthers();

            return response()->json(['message' => 'Deleted successfully']);
        } catch (\Exception $e) {
            \DB::rollBack();
            \Log::error('Market Item Delete Error:', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to delete item'], 500);
        }
    }

    public function startChat($id)
    {
        $item = MarketItem::findOrFail($id);

        if ($item->user_id === Auth::id()) {
            return response()->json(['error' => 'Cannot chat with yourself'], 400);
        }

        // Fixed: Check for ANY existing 1-on-1 space between these two users (Reuse logic)
        $existingSpace = CollaborationSpace::where('space_type', 'chat')
            ->whereHas('participations', function ($q) {
                $q->where('user_id', Auth::id());
            })
            ->whereHas('participations', function ($q) use ($item) {
                $q->where('user_id', $item->user_id);
            })
            ->withCount('participations')
            ->get()
            ->firstWhere('participations_count', 2);

        if ($existingSpace) {
            return response()->json(['space' => $existingSpace]);
        }

        // Create new space
        $space = CollaborationSpace::create([
            'id' => (string) Str::uuid(),
            'creator_id' => Auth::id(),
            'space_type' => 'chat',
            'title' => 'Inquiry: ' . $item->title,
            'description' => 'Marketplace chat for ' . $item->title,
            'settings' => [
                'market_item_id' => $item->id,
                'price' => $item->price,
                'is_direct' => true // Added for consistency
            ]
        ]);

        // Add both participants
        $space->participations()->create([
            'user_id' => Auth::id(),
            'role' => 'admin',
        ]);

        $space->participations()->create([
            'user_id' => $item->user_id,
            'role' => 'member',
        ]);

        return response()->json(['space' => $space], 201);
    }

    public function react(Request $request, $id)
    {
        $request->validate(['emoji' => 'required|string|max:10']);
        $item = MarketItem::findOrFail($id);

        $reaction = Reaction::updateOrCreate(
            ['user_id' => Auth::id(), 'market_item_id' => $item->id],
            ['emoji' => $request->emoji]
        );

        $event = new MarketItemReacted($reaction, $item->id, $item->user_id);

        if ($item->user_id != Auth::id()) {
            $owner = User::find($item->user_id);
            if ($owner) {
                $owner->notify($event);
            }
        } else {
            broadcast($event)->toOthers();
        }

        return response()->json([
            'reaction' => $reaction,
            'reaction_counts' => $item->reactionCounts
        ]);
    }

    public function deleteReaction($id)
    {
        $item = MarketItem::findOrFail($id);
        $deleted = Reaction::where('user_id', Auth::id())
            ->where('market_item_id', $item->id)
            ->delete();

        return response()->json([
            'message' => 'Reaction removed',
            'reaction_counts' => $item->reactionCounts
        ]);
    }

    public function comment(Request $request, $id)
    {
        $request->validate([
            'content' => 'required|string|max:500',
            'parent_id' => 'nullable|exists:comments,id'
        ]);

        $item = MarketItem::findOrFail($id);

        $comment = Comment::create([
            'user_id' => Auth::id(),
            'market_item_id' => $item->id,
            'parent_id' => $request->parent_id,
            'content' => $request->input('content')
        ]);

        $comment->load('user', 'replies');

        $event = new MarketItemCommented($comment, $item->id, $item->user_id);

        if ($item->user_id != Auth::id()) {
            $owner = User::find($item->user_id);
            if ($owner) {
                $owner->notify($event);
            }
        } else {
            broadcast($event)->toOthers();
        }

        return response()->json($comment, 201);
    }

    public function deleteComment($itemId, $commentId)
    {
        $comment = Comment::where('id', $commentId)
            ->where('market_item_id', $itemId)
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $comment->delete();
        return response()->json(['message' => 'Comment deleted']);
    }

    public function bookmark(Request $request, $id)
    {
        $item = MarketItem::findOrFail($id);

        $existingBookmark = Bookmark::where('user_id', Auth::id())
            ->where('market_item_id', $item->id)
            ->first();

        if ($existingBookmark) {
            $existingBookmark->delete();
            return response()->json(['message' => 'Bookmark removed', 'bookmarked' => false]);
        }

        $bookmark = Bookmark::create([
            'user_id' => Auth::id(),
            'market_item_id' => $item->id,
            'collection' => $request->collection ?? 'all',
            'note' => $request->note
        ]);

        return response()->json([
            'message' => 'Market item bookmarked',
            'bookmarked' => true,
            'bookmark' => $bookmark
        ]);
    }

    public function repost(Request $request, $id)
    {
        $item = MarketItem::findOrFail($id);

        $existingRepost = Repost::where('user_id', Auth::id())
            ->where('market_item_id', $item->id)
            ->first();

        if ($existingRepost) {
            $existingRepost->delete();
            return response()->json([
                'message' => 'Repost removed',
                'reposted' => false,
                'reposts_count' => $item->reposts()->count()
            ]);
        }

        $repost = Repost::create([
            'user_id' => Auth::id(),
            'market_item_id' => $item->id,
            'context_tag' => $request->context_tag,
            'personal_note' => $request->personal_note
        ]);

        $repost->load('user');

        return response()->json([
            'message' => 'Market item reposted',
            'reposted' => true,
            'repost' => $repost,
            'reposts_count' => $item->reposts()->count()
        ]);
    }

    private function getMediaType($mimeType)
    {
        if (\Illuminate\Support\Str::startsWith($mimeType, 'image/'))
            return 'image';
        if (\Illuminate\Support\Str::startsWith($mimeType, 'video/'))
            return 'video';
        if (\Illuminate\Support\Str::startsWith($mimeType, 'audio/'))
            return 'audio';
        return 'document';
    }

    private function trimVideo($path, $start, $end)
    {
        $fullPath = storage_path('app/public/' . $path);
        if (!file_exists($fullPath)) return $path;

        $extension       = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
        $basePath        = substr($path, 0, strrpos($path, '.'));

        $outputExtension = in_array($extension, ['webm', 'mkv']) ? 'mp4' : $extension;
        $trimmedPath     = $basePath . '_trimmed.' . $outputExtension;
        $fullTrimmedPath = storage_path('app/public/' . $trimmedPath);

        $ffmpeg = trim((string) shell_exec('which ffmpeg'));
        if (!$ffmpeg) {
            \Log::warning('FFmpeg not found. Video trimming skipped.', ['path' => $path]);
            return $path;
        }

        $duration = $end - $start;

        if ($outputExtension !== $extension) {
            $command = sprintf(
                'ffmpeg -y -ss %s -i %s -t %s -c:v libx264 -preset fast -crf 23 -c:a aac -movflags +faststart %s 2>&1',
                escapeshellarg((string) $start),
                escapeshellarg($fullPath),
                escapeshellarg((string) $duration),
                escapeshellarg($fullTrimmedPath)
            );
        } else {
            $command = sprintf(
                'ffmpeg -y -ss %s -i %s -t %s -c copy -map 0 %s 2>&1',
                escapeshellarg((string) $start),
                escapeshellarg($fullPath),
                escapeshellarg((string) $duration),
                escapeshellarg($fullTrimmedPath)
            );
        }

        $output = [];
        $resultCode = 0;
        exec($command, $output, $resultCode);

        if ($resultCode === 0 && file_exists($fullTrimmedPath) && filesize($fullTrimmedPath) > 0) {
            unlink($fullPath);
            return $trimmedPath;
        }

        return $path;
    }

    private function getMediaFolder($type)
    {
        switch ($type) {
            case 'video': return 'videos';
            case 'audio': return 'audio';
            case 'document': return 'documents';
            default: return 'images';
        }
    }
}
