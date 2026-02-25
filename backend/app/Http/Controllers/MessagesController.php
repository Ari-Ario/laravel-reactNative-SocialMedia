<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Message;
use App\Models\Conversation;
use App\Models\CollaborationSpace;
use Illuminate\Support\Facades\DB;

class MessagesController extends Controller
{
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
            if (!$conversation->users()->where('user_id', $user->id)->exists()) {
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
            'type' => 'required|in:text,image,video,document,voice,poll',
            'file_path' => 'sometimes|string',
            'voice_path' => 'sometimes|string',
            'reply_to_id' => 'sometimes|exists:messages,id',
            'metadata' => 'sometimes|array',
        ]);

        $user = auth()->user();

        if ($request->has('conversation_id')) {
            $conversation = Conversation::findOrFail($request->conversation_id);

            // Check if user is in conversation
            if (!$conversation->users()->where('user_id', $user->id)->exists()) {
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
                'mood_detected' => $this->detectMood($request->content),
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
        if (!$conversation->users()->where('user_id', $user->id)->exists()) {
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
            'content' => $request->content,
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

        // Soft delete
        $message->delete();

        // Broadcast deletion
        broadcast(new \App\Events\MessageDeleted($message))->toOthers();

        return response()->json([
            'message' => 'Message deleted',
        ]);
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