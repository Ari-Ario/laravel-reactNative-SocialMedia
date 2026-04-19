<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Message;
use App\Models\Conversation;
use App\Models\CollaborationSpace;
use App\Models\SpaceParticipation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class MessagesController extends Controller
{
    /**
     * Broadcast a message to multiple recipients
     */
    public function broadcast(Request $request)
    {
        $request->validate([
            'recipient_ids' => 'required|array',
            'recipient_ids.*' => 'exists:users,id',
            'content' => 'required|string',
            'type' => 'sometimes|string|in:text,image,video,document,voice,poll,post_share',
            'metadata' => 'sometimes|array',
        ]);

        $user = auth()->user();
        $recipientIds = $request->recipient_ids;
        $content = $request->input('content');
        $type = $request->input('type', 'text');
        $sentCount = 0;
        $targetUsers = User::whereIn('id', $recipientIds)->get()->keyBy('id');

        foreach ($recipientIds as $targetUserId) {
            // Skip self if mistakenly included
            if ($targetUserId == $user->id) continue;

            try {
                // Find or create space
                $space = $this->getDirectSpace($user->id, $targetUserId);
                
                // Construct message
                $newMsg = [
                    'id' => (string)\Illuminate\Support\Str::uuid(),
                    'user_id' => $user->id,
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'profile_photo' => $user->profile_photo,
                    ],
                    'content' => $content,
                    'type' => $type,
                    'created_at' => now()->toISOString(),
                    'metadata' => array_merge($request->metadata ?? [], ['is_broadcast' => true]),
                    'reactions' => [],
                    'is_pinned' => false
                ];

                $contentState = $space->content_state ?? ['messages' => []];
                $spaceMessages = $contentState['messages'] ?? [];
                
                // Prepend the new message
                array_unshift($spaceMessages, $newMsg);
                $contentState['messages'] = $spaceMessages;

                $space->update(['content_state' => $contentState]);

                // Broadcast events just like in SpaceController
                
                // 1. Presence channel for those inside the space
                broadcast(new \App\Events\MessageSent($newMsg, $space->id, $user))->toOthers();

                // 2. Individual user channels for chat list snippet updates
                broadcast(new \App\Events\SpaceMessageSent($space->id, [$targetUserId], $newMsg))->toOthers();

                // 3. Persistent Database Notification for offline/header fetch
                $targetUser = $targetUsers->get($targetUserId);
                if ($targetUser) {
                    \Illuminate\Support\Facades\Notification::send($targetUser, new \App\Events\MessageSent($newMsg, $space->id, $user));
                }

                $sentCount++;
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error("Broadcast failed for user $targetUserId: " . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'sent_count' => $sentCount,
            'total_requested' => count($recipientIds)
        ]);
    }

    /**
     * Helper to find or create a 1-on-1 direct chat space
     */
    private function getDirectSpace($userId, $targetUserId)
    {
        $spaces = CollaborationSpace::where('space_type', 'chat')
            ->whereHas('participations', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            })
            ->whereHas('participations', function ($q) use ($targetUserId) {
                $q->where('user_id', $targetUserId);
            })
            ->withCount('participations')
            ->get();

        $space = $spaces->firstWhere('participations_count', 2);

        if (!$space) {
            $targetUser = User::find($targetUserId);
            $spaceName = $targetUser ? "Chat with " . $targetUser->name : 'Direct Chat';

            // Create new space
            $space = CollaborationSpace::create([
                'id' => (string)\Illuminate\Support\Str::uuid(),
                'title' => $spaceName,
                'space_type' => 'chat',
                'creator_id' => $userId,
                'settings' => [
                    'theme' => 'light',
                    'privacy' => 'private',
                    'allow_guests' => false,
                    'is_direct' => true
                ],
                'content_state' => ['messages' => []],
                'is_live' => false,
                'has_ai_assistant' => false,
                'participants_count' => 2
            ]);

            // Add both users
            SpaceParticipation::create([
                'space_id' => $space->id,
                'user_id' => $userId,
                'role' => 'owner',
            ]);

            SpaceParticipation::create([
                'space_id' => $space->id,
                'user_id' => $targetUserId,
                'role' => 'participant',
            ]);
        }

        return $space;
    }

    /**
     * Get messages for a conversation or space
     */
    public function index(Request $request)
    {
        $request->validate([
            'conversation_id' => 'required_without:space_id|exists:conversations,id',
            'space_id' => 'required_without:conversation_id|exists:collaboration_spaces,id',
            'limit' => 'sometimes|integer|min:1|max:100',
            'before' => 'sometimes|date',
        ]);

        $user = auth()->user();
        $limit = $request->input('limit', 50);
        $query = Message::query();

        if ($request->has('conversation_id')) {
            $conversation = Conversation::findOrFail($request->conversation_id);

            // Check if user is in conversation
            if (!$conversation->participants()->where('user_id', $user->id)->exists()) {
                return response()->json([
                    'message' => 'Not authorized'
                ], 403);
            }

            $query->where('conversation_id', $conversation->id);
        }

        if ($request->has('space_id')) {
            $space = CollaborationSpace::findOrFail($request->space_id);

            // Check if user is in space
            if (!$space->participations()->where('user_id', $user->id)->exists()) {
                return response()->json([
                    'message' => 'Not authorized'
                ], 403);
            }

            // Get messages from space content_state
            $contentState = $space->content_state ?? [];
            $messages = $contentState['messages'] ?? [];

            return response()->json([
                'messages' => $messages,
                'total' => count($messages),
                'space_id' => $space->id,
            ]);
        }

        if ($request->has('before')) {
            $query->where('created_at', '<', $request->input('before'));
        }

        $messages = $query->with('user')
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($message) {
            return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'user_id' => $message->user_id,
            'content' => $message->content,
            'type' => $message->type,
            'metadata' => $message->metadata,
            'file_path' => $message->file_path,
            'mime_type' => $message->mime_type,
            'reactions' => $message->reactions,
            'reply_to_id' => $message->reply_to_id,
            'mood_detected' => $message->mood_detected,
            'is_edited' => $message->is_edited,
            'edited_at' => $message->edited_at,
            'created_at' => $message->created_at->toISOString(),
            'updated_at' => $message->updated_at->toISOString(),
            'user' => $message->user ? [
            'id' => $message->user->id,
            'name' => $message->user->name,
            'profile_photo' => $message->user->profile_photo,
            ] : null,
            ];
        });

        return response()->json([
            'messages' => $messages,
            'total' => $messages->count(),
            'has_more' => $messages->count() === $limit,
        ]);
    }

    /**
     * Send a message
     */
    public function store(Request $request)
    {
        $request->validate([
            'conversation_id' => 'required_without:space_id|exists:conversations,id',
            'space_id' => 'required_without:conversation_id|exists:collaboration_spaces,id',
            'content' => 'required_without_all:file_path,voice_path|string',
            'type' => 'required|in:text,image,video,document,voice,poll,post_share',
            'file_path' => 'sometimes|string',
            'voice_path' => 'sometimes|string',
            'reply_to_id' => 'sometimes|exists:messages,id',
            'metadata' => 'sometimes|array',
        ]);

        $user = auth()->user();

        if ($request->has('conversation_id')) {
            $conversation = Conversation::findOrFail($request->conversation_id);

            // Check if user is in conversation
            if (!$conversation->participants()->where('user_id', $user->id)->exists()) {
                return response()->json([
                    'message' => 'Not authorized'
                ], 403);
            }

            // Create message
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'content' => $request->input('content', ''),
                'type' => $request->type,
                'metadata' => $request->metadata ?? [],
                'file_path' => $request->file_path ?? $request->voice_path,
                'mime_type' => $request->mime_type,
                'reply_to_id' => $request->reply_to_id,
                'mood_detected' => $this->detectMood($request->input('content')),
            ]);

            // Update conversation last message
            $conversation->update([
                'last_message_id' => $message->id,
                'last_message_at' => now(),
            ]);

            // Broadcast message
            broadcast(new \App\Events\MessageSent($conversation, $message, $user))->toOthers();

            return response()->json([
                'message' => $message->load('user'),
                'conversation' => $conversation->fresh(),
            ]);
        }

        if ($request->has('space_id')) {
            // Handle space message through SpaceController
            return app(SpaceController::class)->sendMessage($request, $request->space_id);
        }

        return response()->json([
            'message' => 'Either conversation_id or space_id is required'
        ], 400);
    }

    /**
     * React to a message
     */
    public function react(Request $request, $id)
    {
        $request->validate([
            'reaction' => 'required|string|max:10',
        ]);

        $message = Message::findOrFail($id);
        $user = auth()->user();

        // Check if user can access this message
        $conversation = $message->conversation;
        if (!$conversation->participants()->where('user_id', $user->id)->exists()) {
            return response()->json([
                'message' => 'Not authorized'
            ], 403);
        }

        // Add reaction
        $reactions = $message->reactions ?? [];
        $reactions[] = [
            'user_id' => $user->id,
            'reaction' => $request->reaction,
            'created_at' => now()->toISOString(),
        ];

        $message->update(['reactions' => $reactions]);

        // Broadcast reaction
        broadcast(new \App\Events\MessageReacted($message, $user, $request->reaction))->toOthers();

        return response()->json([
            'message' => 'Reaction added',
            'reactions' => $reactions,
        ]);
    }

    /**
     * Delete a reaction
     */
    public function deleteReaction(Request $request, $id)
    {
        $message = Message::findOrFail($id);
        $user = auth()->user();

        // Remove user's reactions
        $reactions = $message->reactions ?? [];
        $filteredReactions = array_filter($reactions, function ($reaction) use ($user) {
            return $reaction['user_id'] !== $user->id;
        });

        $message->update(['reactions' => array_values($filteredReactions)]);

        return response()->json([
            'message' => 'Reaction removed',
            'reactions' => $filteredReactions,
        ]);
    }

    /**
     * Edit a message
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'content' => 'required|string',
        ]);

        $message = Message::findOrFail($id);

        // Check if user owns the message
        if ($message->user_id !== auth()->id()) {
            return response()->json([
                'message' => 'Not authorized'
            ], 403);
        }

        // Update message
        $message->update([
            'content' => $request->input('content'),
            'is_edited' => true,
            'edited_at' => now(),
        ]);

        // Broadcast edit
        broadcast(new \App\Events\MessageEdited($message))->toOthers();

        return response()->json([
            'message' => $message->fresh(),
        ]);
    }

    /**
     * Delete a message
     */
    public function destroy($id)
    {
        $message = Message::findOrFail($id);

        // Check if user owns the message or is admin
        if ($message->user_id !== auth()->id() && !auth()->user()->is_admin) {
            return response()->json([
                'message' => 'Not authorized'
            ], 403);
        }

        // Delete file if it's a media message
        if (!empty($message->file_path)) {
            if (Storage::disk('public')->exists($message->file_path)) {
                Storage::disk('public')->delete($message->file_path);
            }
        }

        // Soft delete
        $message->delete();

        // Broadcast deletion
        broadcast(new \App\Events\MessageDeleted($message))->toOthers();

        return response()->json([
            'message' => 'Message deleted',
        ]);
    }

    /**
     * Forward to a specific user
     */
    public function forwardToUser(Request $request)
    {
        $request->validate([
            'target_user_id' => 'required|exists:users,id',
            'content' => 'required|string',
            'type' => 'required|string',
            'metadata' => 'nullable|array',
            'file_path' => 'nullable|string',
            'mime_type' => 'nullable|string',
        ]);

        $user = auth()->user();
        $targetUserId = $request->target_user_id;

        // Find existing 1-on-1 space
        $spaces = CollaborationSpace::where('space_type', 'chat')
            ->whereHas('participations', function ($q) use ($user) {
            $q->where('user_id', $user->id);
        })
            ->whereHas('participations', function ($q) use ($targetUserId) {
            $q->where('user_id', $targetUserId);
        })
            ->withCount('participations')
            ->get();

        $space = $spaces->firstWhere('participations_count', 2);

        if (!$space) {
            $targetUser = User::find($targetUserId);
            $spaceName = $targetUser ? "Chat with " . $targetUser->name : 'Direct Chat';

            // Create new space
            $space = CollaborationSpace::create([
                'id' => (string)\Illuminate\Support\Str::uuid(),
                'title' => $spaceName,
                'space_type' => 'chat',
                'creator_id' => $user->id,
                'settings' => [
                    'theme' => 'light',
                    'privacy' => 'private',
                    'allow_guests' => false,
                    'is_direct' => true
                ],
                'content_state' => ['messages' => []],
                'is_live' => false,
                'has_ai_assistant' => false,
                'participants_count' => 2
            ]);

            // Add both users
            SpaceParticipation::create([
                'space_id' => $space->id,
                'user_id' => $user->id,
                'role' => 'owner',
            ]);

            SpaceParticipation::create([
                'space_id' => $space->id,
                'user_id' => $targetUserId,
                'role' => 'participant',
            ]);
        }

        // Clone/create message in the space
        $destState = $space->content_state ?? ['messages' => []];
        $destMessages = $destState['messages'] ?? [];

        $newMsg = [
            'id' => (string)\Illuminate\Support\Str::uuid(),
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'profile_photo' => $user->profile_photo,
            ],
            'content' => $request->input('content'),
            'type' => $request->type,
            'created_at' => now()->toISOString(),
            'metadata' => array_merge($request->metadata ?? [], ['is_forwarded' => true]),
            'file_path' => $request->file_path,
            'mime_type' => $request->mime_type,
            'reactions' => [],
            'is_pinned' => false
        ];

        $destMessages[] = $newMsg;
        $destState['messages'] = $destMessages;

        $space->update(['content_state' => $destState]);

        // Broadcast message
        try {
            broadcast(new \App\Events\MessageSent($newMsg, $space->id, $user))->toOthers();
        }
        catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Failed to broadcast forwarded message: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => $newMsg,
            'space' => $space,
        ]);
    }

    /**
     * Get chat highlights (most engaging messages)
     */
    public function highlights(Request $request)
    {
        $user = auth()->user();
        $limit = $request->input('limit', 10);
        $page = $request->input('page', 1);

        // Get conversation IDs the user is part of
        $conversationIds = $user->conversations()->pluck('conversations.id');
        
        $userSpaces = DB::table('collaboration_spaces')
            ->join('space_participations', 'collaboration_spaces.id', '=', 'space_participations.space_id')
            ->where('space_participations.user_id', $user->id)
            ->select('collaboration_spaces.*')
            ->get();
            
        $userSpaces = $userSpaces->map(function($space) {
            $space->content_state = json_decode($space->content_state, true);
            return $space;
        });

        $spaceConversationIds = $userSpaces->whereNotNull('linked_conversation_id')->pluck('linked_conversation_id');
        $allConvIds = $conversationIds->merge($spaceConversationIds)->unique();

        // 1. Get highlights from the 'messages' table
        $tableMessages = $this->getTableHighlights($allConvIds);

        // 2. Get highlights from space JSON content_state
        $jsonMessages = $this->getJsonHighlights($userSpaces);

        // 3. Merge and Sort
        $allMessages = $tableMessages->toBase()->merge($jsonMessages)
            ->unique('id')
            ->sortByDesc(function ($m) {
                $moodScore = ($m['mood_detected'] == 'positive') ? 2 : (($m['mood_detected'] == 'deep') ? 3 : 0);
                return $m['replies_count'] + $m['reactions_count'] + $moodScore;
            });

        // 4. Manual Pagination
        $total = $allMessages->count();
        $items = $allMessages->slice(($page - 1) * $limit, $limit)->values();
        $hasMore = $total > ($page * $limit);

        return response()->json([
            'messages' => $items,
            'current_page' => (int) $page,
            'has_more' => $hasMore,
            'total' => $total,
        ]);
    }

    private function getTableHighlights($allConvIds)
    {
        return Message::whereIn('conversation_id', $allConvIds)
            ->whereNotNull('content')
            ->where('type', '!=', 'system')
            ->with(['user', 'conversation'])
            ->withCount('replies')
            ->select('*')
            ->selectRaw('COALESCE(JSON_LENGTH(reactions), 0) as reactions_count')
            ->addSelect([
                'space_id' => \App\Models\CollaborationSpace::select('id')
                    ->whereColumn('linked_conversation_id', 'messages.conversation_id')
                    ->limit(1)
            ])
            ->get()
            ->map(function ($m) {
                return [
                    'id' => $m->id,
                    'conversation_id' => $m->conversation_id,
                    'space_id' => $m->space_id,
                    'user_id' => $m->user_id,
                    'content' => $m->content,
                    'type' => $m->type,
                    'metadata' => $m->metadata,
                    'file_path' => $m->file_path,
                    'mime_type' => $m->mime_type,
                    'reactions' => $m->reactions,
                    'reactions_count' => (int) $m->reactions_count,
                    'replies_count' => (int) $m->replies_count,
                    'reply_to_id' => $m->reply_to_id,
                    'mood_detected' => $m->mood_detected,
                    'created_at' => $m->created_at->toISOString(),
                    'user' => $m->user ? [
                        'id' => $m->user->id,
                        'name' => $m->user->name,
                        'profile_photo' => $m->user->profile_photo,
                    ] : null,
                ];
            });
    }

    private function getJsonHighlights($userSpaces)
    {
        $jsonMessages = collect();
        foreach ($userSpaces as $space) {
            try {
                $contentState = $space->content_state;
                if (!is_array($contentState) || !isset($contentState['messages'])) {
                    continue;
                }
                
                $msgs = $contentState['messages'];
                foreach ($msgs as $m) {
                    if (!is_array($m)) continue;
                    
                    $id = $m['id'] ?? null;
                    if (!$id || (!isset($m['reactions']) || count($m['reactions']) === 0)) continue;

                    $userData = $m['user'] ?? null;
                    $userName = $m['user_name'] ?? (is_array($userData) ? ($userData['name'] ?? 'User') : (is_string($userData) ? $userData : 'User'));
                    $userPhoto = is_array($userData) ? ($userData['profile_photo'] ?? null) : null;

                    $jsonMessages->push([
                        'id' => $id,
                        'conversation_id' => $space->linked_conversation_id,
                        'space_id' => $space->id,
                        'user_id' => $m['user_id'] ?? (is_array($userData) ? ($userData['id'] ?? 0) : 0),
                        'content' => $m['content'] ?? '',
                        'type' => $m['type'] ?? 'text',
                        'metadata' => $m['metadata'] ?? [],
                        'file_path' => $m['file_path'] ?? null,
                        'mime_type' => $m['metadata']['mime_type'] ?? null,
                        'reactions' => $m['reactions'] ?? [],
                        'reactions_count' => count($m['reactions']),
                        'replies_count' => 0,
                        'reply_to_id' => $m['reply_to_id'] ?? null,
                        'mood_detected' => $m['mood_detected'] ?? null,
                        'created_at' => $m['created_at'] ?? now()->toISOString(),
                        'user' => [
                            'id' => $m['user_id'] ?? (is_array($userData) ? ($userData['id'] ?? 0) : 0),
                            'name' => $userName,
                            'profile_photo' => $userPhoto,
                        ],
                    ]);
                }
            } catch (\Exception $e) {
                \Log::warning("Error processing highlights for space {$space->id}: " . $e->getMessage());
            }
        }
        return $jsonMessages;
    }

    /**
     * Simple mood detection
     */
    private function detectMood($text)
    {
        $text = strtolower($text);

        $positiveWords = ['great', 'awesome', 'amazing', 'happy', 'love', 'thanks', 'thank', 'good', 'nice'];
        $negativeWords = ['bad', 'sad', 'angry', 'hate', 'worst', 'terrible', 'awful'];

        $positiveCount = 0;
        $negativeCount = 0;

        foreach ($positiveWords as $word) {
            if (strpos($text, $word) !== false) {
                $positiveCount++;
            }
        }

        foreach ($negativeWords as $word) {
            if (strpos($text, $word) !== false) {
                $negativeCount++;
            }
        }

        if ($positiveCount > $negativeCount)
            return 'positive';
        if ($negativeCount > $positiveCount)
            return 'negative';
        return 'neutral';
    }
}