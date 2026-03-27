<?php

namespace App\Services;

use App\Models\CollaborationSpace;
use App\Models\Message;
use App\Models\Call;
use App\Models\CollaborativeActivity;
use App\Models\Conversation;
use App\Models\Poll;
use App\Models\Media;
use App\Events\SpaceUpdated;
use App\Events\SpaceDeleted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class SpaceService
{
    /**
     * Perform a complete and robust deletion of a space and its associated data.
     *
     * @param string $id Space UUID
     * @param int $authUserId ID of the user triggering the deletion (for event context)
     * @return bool
     */
    public function deleteSpace($id, $authUserId)
    {
        try {
            $space = CollaborationSpace::find($id);
            if (!$space) {
                return false;
            }

            // 1. Get participant IDs for broadcasting before they are deleted
            $participantIds = $space->participations->pluck('user_id')->toArray();

            DB::beginTransaction();

            // 2. Delete all participations
            $space->participations()->delete();

            // 2. Delete magic events
            $space->magicEvents()->delete();

            // 3. Delete collaborative activities
            CollaborativeActivity::where('space_id', $id)->delete();

            // 4. Delete AI interactions (Cascades to AILearningSource via migration cascade if exists, 
            // but we'll be thorough in the conversation cleanup too)
            $space->aiInteractions()->delete();

            // 5. Delete associated Media and files
            $mediaItems = Media::where('model_type', CollaborationSpace::class)
                ->where('model_id', $id)
                ->get();

            foreach ($mediaItems as $item) {
                if (Storage::disk('public')->exists($item->file_path)) {
                    Storage::disk('public')->delete($item->file_path);
                }
                $item->delete();
            }

            // 6. Delete directory
            Storage::disk('public')->deleteDirectory("spaces/{$id}");

            // 7. Delete Polls
            $polls = Poll::where('space_id', $id)->get();
            foreach ($polls as $poll) {
                $poll->votes()->delete();
                $poll->options()->delete();
                $poll->delete();
            }

            // 8. Handle linked conversation
            $linkedConversationId = $space->linked_conversation_id;

            // Broadcast deletion (Phase 71: Only send SpaceDeleted)
            try {
                broadcast(new SpaceDeleted($id, $authUserId, $participantIds));
            } catch (\Exception $e) {
                Log::warning('Broadcast failed during space service deletion: ' . $e->getMessage());
            }

            // 9. Delete the space itself first to satisfy FK constraints on conversation
            $space->delete();

            // 10. Clean up conversation data
            if ($linkedConversationId) {
                // Delete associated Calls
                Call::where('conversation_id', $linkedConversationId)->delete();

                // Delete associated AILearningSource records linked to conversation
                DB::table('ai_learning_sources')->where('related_conversation_id', $linkedConversationId)->delete();

                $conversation = Conversation::find($linkedConversationId);
                if ($conversation) {
                    Message::where('conversation_id', $conversation->id)->delete();
                    $conversation->participants()->detach();
                    $conversation->delete();
                }
            }

            DB::commit();
            return true;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('SpaceService@deleteSpace error: ' . $e->getMessage(), [
                'space_id' => $id,
                'user_id' => $authUserId,
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    /**
     * Find a direct chat space between two users.
     *
     * @param int $userA
     * @param int $userB
     * @return CollaborationSpace|null
     */
    public function findDirectSpace($userA, $userB)
    {
        $spaces = CollaborationSpace::where('space_type', 'chat')
            ->whereHas('participations', function ($q) use ($userA) {
                $q->where('user_id', $userA);
            })
            ->whereHas('participations', function ($q) use ($userB) {
                $q->where('user_id', $userB);
            })
            ->withCount('participations')
            ->get();

        // Direct spaces should only have 2 participants
        return $spaces->firstWhere('participations_count', 2);
    }
}
