<?php

namespace App\Http\Controllers;

use App\Models\CollaborationSpace;
use App\Models\Conversation;
use App\Models\Post;
use App\Models\Story;
use App\Models\SpaceParticipation;
use App\Models\MagicEvent;
use App\Models\AiInteraction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class SpaceController extends Controller
{
    /**
     * Get all spaces for current user
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        
        // Get spaces where user is participant
        $participations = SpaceParticipation::where('user_id', $user->id)
            ->with(['space' => function($query) {
                $query->withCount('participants');
                $query->with(['creator', 'linkedConversation', 'linkedPost', 'linkedStory']);
            }])
            ->orderBy('last_active_at', 'desc')
            ->paginate(20);
        
        $spaces = $participations->map(function($participation) {
            $space = $participation->space;
            $space->my_role = $participation->role;
            $space->is_online_in_space = $participation->presence_data['is_online'] ?? false;
            return $space;
        });
        
        return response()->json([
            'spaces' => $spaces,
            'pagination' => [
                'current_page' => $participations->currentPage(),
                'total' => $participations->total(),
                'per_page' => $participations->perPage(),
                'last_page' => $participations->lastPage(),
            ]
        ]);
    }

    /**
     * Create a new collaboration space
     */
    public function store(Request $request)
    {
        $request->validate([
            'space_type' => 'required|in:chat,whiteboard,meeting,document,brainstorm,story,voice_channel',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'linked_conversation_id' => 'nullable|exists:conversations,id',
            'linked_post_id' => 'nullable|exists:posts,id',
            'linked_story_id' => 'nullable|exists:stories,id',
            'settings' => 'nullable|array',
            'ai_personality' => 'nullable|in:helpful,creative,analytical,playful',
            'ai_capabilities' => 'nullable|array',
        ]);

        $user = Auth::user();

        // Create the space
        $space = CollaborationSpace::create([
            'id' => Str::uuid(),
            'creator_id' => $user->id,
            'space_type' => $request->space_type,
            'title' => $request->title,
            'description' => $request->description,
            'linked_conversation_id' => $request->linked_conversation_id,
            'linked_post_id' => $request->linked_post_id,
            'linked_story_id' => $request->linked_story_id,
            'settings' => $request->settings ?? $this->getDefaultSettings($request->space_type),
            'has_ai_assistant' => $request->has('ai_personality'),
            'ai_personality' => $request->ai_personality,
            'ai_capabilities' => $request->ai_capabilities ?? ['summarize', 'suggest'],
            'content_state' => $this->getInitialContentState($request->space_type),
        ]);

        // Add creator as owner participant
        SpaceParticipation::create([
            'space_id' => $space->id,
            'user_id' => $user->id,
            'role' => 'owner',
            'permissions' => $this->getOwnerPermissions(),
            'presence_data' => [
                'is_online' => true,
                'device' => 'web',
                'last_seen' => now(),
            ],
        ]);

        // If linked to conversation, update conversation
        if ($request->linked_conversation_id) {
            Conversation::where('id', $request->linked_conversation_id)
                ->update(['linked_project_id' => $space->id]);
        }

        // If linked to post, update post
        if ($request->linked_post_id) {
            Post::where('id', $request->linked_post_id)
                ->update([
                    'is_collaborative' => true,
                    'linked_project_id' => $space->id,
                ]);
        }

        // If linked to story, update story
        if ($request->linked_story_id) {
            Story::where('id', $request->linked_story_id)
                ->update([
                    'is_collaborative' => true,
                    'linked_project_id' => $space->id,
                ]);
        }

        // Trigger initial magic event
        $this->createMagicEvent($space->id, 'space_created', [
            'created_by' => $user->id,
            'type' => $space->space_type,
        ]);

        return response()->json([
            'space' => $space->load(['creator', 'linkedConversation', 'linkedPost', 'linkedStory']),
            'message' => 'Space created successfully'
        ], 201);
    }

    /**
     * Get space details
     */
    public function show($id)
    {
        $user = Auth::user();
        
        // Check if user can access this space
        $participation = SpaceParticipation::where('space_id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();
        
        $space = CollaborationSpace::with([
            'creator',
            'linkedConversation',
            'linkedPost',
            'linkedStory',
            'participants.user',
            'magicEvents' => function($query) {
                $query->where('has_been_discovered', false)
                    ->orderBy('created_at', 'desc')
                    ->limit(5);
            }
        ])->findOrFail($id);
        
        // Update last active time for participant
        $participation->update([
            'last_active_at' => now(),
            'presence_data->is_online' => true,
        ]);
        
        // Add user-specific data
        $space->my_role = $participation->role;
        $space->my_permissions = $participation->permissions;
        $space->is_online_in_space = true;
        
        return response()->json([
            'space' => $space,
            'participation' => $participation,
        ]);
    }

    /**
     * Update space
     */
    public function update(Request $request, $id)
    {
        $user = Auth::user();
        
        // Check if user has permission to update
        $participation = SpaceParticipation::where('space_id', $id)
            ->where('user_id', $user->id)
            ->whereIn('role', ['owner', 'moderator'])
            ->firstOrFail();
        
        $space = CollaborationSpace::findOrFail($id);
        
        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'settings' => 'nullable|array',
            'ai_personality' => 'nullable|in:helpful,creative,analytical,playful',
            'ai_capabilities' => 'nullable|array',
            'content_state' => 'nullable|array',
        ]);
        
        $space->update($request->only([
            'title', 'description', 'settings', 
            'ai_personality', 'ai_capabilities', 'content_state'
        ]));
        
        return response()->json([
            'space' => $space,
            'message' => 'Space updated successfully'
        ]);
    }

    /**
     * Join a space
     */
    public function join(Request $request, $id)
    {
        $user = Auth::user();
        $space = CollaborationSpace::findOrFail($id);
        
        // Check if already participant
        $existing = SpaceParticipation::where('space_id', $id)
            ->where('user_id', $user->id)
            ->first();
            
        if ($existing) {
            return response()->json([
                'message' => 'Already a participant',
                'participation' => $existing,
            ]);
        }
        
        // Check if space requires invitation
        if ($space->settings['require_invitation'] ?? false) {
            return response()->json([
                'message' => 'This space requires an invitation',
            ], 403);
        }
        
        // Create participation
        $participation = SpaceParticipation::create([
            'space_id' => $space->id,
            'user_id' => $user->id,
            'role' => 'participant',
            'permissions' => $this->getDefaultParticipantPermissions(),
            'presence_data' => [
                'is_online' => true,
                'device' => $request->header('User-Agent'),
                'last_seen' => now(),
            ],
        ]);
        
        // Update space metrics
        $space->update([
            'activity_metrics->participant_count' => ($space->activity_metrics['participant_count'] ?? 0) + 1,
        ]);
        
        // Create magic event for new participant
        $this->createMagicEvent($space->id, 'participant_joined', [
            'user_id' => $user->id,
            'role' => 'participant',
        ]);
        
        return response()->json([
            'participation' => $participation,
            'space' => $space,
            'message' => 'Joined space successfully'
        ], 201);
    }

    /**
     * Invite users to space
     */
    public function invite(Request $request, $id)
    {
        $user = Auth::user();
        
        // Check if user has permission to invite
        $participation = SpaceParticipation::where('space_id', $id)
            ->where('user_id', $user->id)
            ->where(function($query) {
                $query->where('role', 'owner')
                    ->orWhere('role', 'moderator')
                    ->orWhereJsonContains('permissions->can_invite', true);
            })
            ->firstOrFail();
        
        $request->validate([
            'user_ids' => 'required|array',
            'user_ids.*' => 'exists:users,id',
            'role' => 'nullable|in:participant,moderator,viewer',
            'message' => 'nullable|string',
        ]);
        
        $space = CollaborationSpace::findOrFail($id);
        $invited = [];
        
        foreach ($request->user_ids as $userId) {
            // Skip if already participant
            if (SpaceParticipation::where('space_id', $id)->where('user_id', $userId)->exists()) {
                continue;
            }
            
            $participation = SpaceParticipation::create([
                'space_id' => $space->id,
                'user_id' => $userId,
                'role' => $request->role ?? 'participant',
                'permissions' => $this->getDefaultParticipantPermissions(),
                'presence_data' => [
                    'is_online' => false,
                    'invited_at' => now(),
                    'invited_by' => $user->id,
                ],
            ]);
            
            $invited[] = $userId;
            
            // Create notification for invited user
            // (You'll need to implement your notification system)
        }
        
        return response()->json([
            'invited_users' => $invited,
            'message' => 'Invitations sent successfully'
        ]);
    }

    /**
     * Start a video/audio call in space
     */
    public function startCall(Request $request, $id)
    {
        $user = Auth::user();
        
        // Check if user is participant
        $participation = SpaceParticipation::where('space_id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();
        
        $request->validate([
            'call_type' => 'required|in:audio,video,screen_share',
            'participants' => 'nullable|array',
        ]);
        
        $space = CollaborationSpace::findOrFail($id);
        
        // Update space live status
        $space->update([
            'is_live' => true,
            'current_focus' => 'call',
            'live_participants' => [
                $user->id => [
                    'joined_at' => now(),
                    'call_type' => $request->call_type,
                    'is_active' => true,
                ]
            ],
        ]);
        
        // Update user's participation
        $participation->update([
            'audio_video_state' => [
                'in_call' => true,
                'call_type' => $request->call_type,
                'mic_enabled' => $request->call_type !== 'screen_share',
                'camera_enabled' => $request->call_type === 'video',
                'screen_share' => $request->call_type === 'screen_share',
            ],
        ]);
        
        // Create magic event for call start
        $this->createMagicEvent($space->id, 'call_started', [
            'call_type' => $request->call_type,
            'initiated_by' => $user->id,
        ]);
        
        return response()->json([
            'space' => $space,
            'call_data' => [
                'call_id' => Str::uuid(),
                'type' => $request->call_type,
                'initiator' => $user->id,
                'space_id' => $space->id,
                'participants' => $space->live_participants,
            ],
            'message' => 'Call started'
        ]);
    }

    /**
     * Query AI assistant
     */
    public function aiQuery(Request $request, $id)
    {
        $user = Auth::user();
        
        // Check if user is participant
        $participation = SpaceParticipation::where('space_id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();
        
        $request->validate([
            'query' => 'required|string',
            'context' => 'nullable|array',
            'action' => 'nullable|in:summarize,suggest,brainstorm,moderate,inspire',
        ]);
        
        $space = CollaborationSpace::findOrFail($id);
        
        // Check if AI assistant is enabled
        if (!$space->has_ai_assistant) {
            return response()->json([
                'message' => 'AI assistant is not enabled for this space',
            ], 403);
        }
        
        // Prepare context
        $context = array_merge($request->context ?? [], [
            'space_type' => $space->space_type,
            'space_title' => $space->title,
            'participant_count' => $space->participants()->count(),
            'user_id' => $user->id,
            'user_role' => $participation->role,
        ]);
        
        // Query AI (first check chatbot_training, then fallback)
        $aiResponse = $this->queryAI($request->query, $context, $request->action);
        
        // Log the interaction
        $interaction = AiInteraction::create([
            'id' => Str::uuid(),
            'space_id' => $space->id,
            'user_id' => $user->id,
            'interaction_type' => $request->action ?? 'query',
            'user_input' => $request->query,
            'ai_response' => $aiResponse['response'],
            'context_data' => $context,
            'confidence_score' => $aiResponse['confidence'],
            'response_time_ms' => $aiResponse['response_time'],
        ]);
        
        // Update space AI learning data
        $this->updateAILearningData($space, $interaction);
        
        // Check if this triggers any magic
        $this->checkForMagicFromAI($space, $interaction);
        
        return response()->json([
            'response' => $aiResponse['response'],
            'confidence' => $aiResponse['confidence'],
            'suggested_actions' => $aiResponse['suggested_actions'] ?? [],
            'interaction_id' => $interaction->id,
            'message' => 'AI response generated',
        ]);
    }

    /**
     * Trigger a magic event manually
     */
    public function triggerMagic(Request $request, $id)
    {
        $user = Auth::user();
        
        // Check if user is participant
        $participation = SpaceParticipation::where('space_id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();
        
        $request->validate([
            'event_type' => 'required|in:evolution_unlock,collective_insight,breakthrough,synchronicity',
            'data' => 'nullable|array',
        ]);
        
        $event = $this->createMagicEvent($id, $request->event_type, array_merge(
            $request->data ?? [],
            ['triggered_by' => $user->id]
        ));
        
        return response()->json([
            'event' => $event,
            'message' => 'Magic event triggered'
        ]);
    }

    /**
     * Get AI suggestions for the space
     */
    public function getAISuggestions($id)
    {
        $user = Auth::user();
        
        // Check if user is participant
        $participation = SpaceParticipation::where('space_id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();
        
        $space = CollaborationSpace::findOrFail($id);
        
        // Generate suggestions based on space activity
        $suggestions = $this->generateAISuggestions($space, $participation);
        
        return response()->json([
            'suggestions' => $suggestions,
            'space_energy' => $space->activity_metrics['energy_level'] ?? 50,
            'next_check' => now()->addMinutes(5)->toISOString(),
        ]);
    }

    /**
     * Helper: Query AI system
     */
    private function queryAI($query, $context, $action = null)
    {
        $startTime = microtime(true);
        
        // First, try to match with chatbot_training
        $trainingMatch = $this->findTrainingMatch($query, $context, $action);
        
        if ($trainingMatch && $trainingMatch['confidence'] > 0.7) {
            $responseTime = (microtime(true) - $startTime) * 1000;
            
            return [
                'response' => $trainingMatch['response'],
                'confidence' => $trainingMatch['confidence'],
                'source' => 'trained',
                'response_time' => round($responseTime),
                'training_match_id' => $trainingMatch['id'],
            ];
        }
        
        // Fallback to rule-based responses
        $response = $this->generateRuleBasedResponse($query, $context, $action);
        $responseTime = (microtime(true) - $startTime) * 1000;
        
        return [
            'response' => $response['text'],
            'confidence' => $response['confidence'],
            'source' => 'rule_based',
            'response_time' => round($responseTime),
            'suggested_actions' => $response['suggested_actions'] ?? [],
        ];
    }

    /**
     * Helper: Create magic event
     */
    private function createMagicEvent($spaceId, $eventType, $data)
    {
        $event = MagicEvent::create([
            'id' => Str::uuid(),
            'space_id' => $spaceId,
            'event_type' => $eventType,
            'event_data' => $data,
            'context' => [
                'space_energy' => CollaborationSpace::find($spaceId)->activity_metrics['energy_level'] ?? 50,
                'time' => now()->toISOString(),
            ],
        ]);
        
        return $event;
    }

    /**
     * Helper: Get default settings for space type
     */
    private function getDefaultSettings($spaceType)
    {
        $settings = [
            'chat' => [
                'allow_guests' => false,
                'max_participants' => 100,
                'enable_reactions' => true,
                'enable_threads' => false,
                'require_invitation' => false,
            ],
            'meeting' => [
                'allow_guests' => true,
                'max_participants' => 10,
                'video_on_join' => false,
                'enable_raise_hand' => true,
                'enable_recording' => false,
                'require_invitation' => true,
            ],
            'whiteboard' => [
                'allow_guests' => true,
                'max_participants' => 20,
                'enable_grid' => true,
                'tools' => ['pen', 'shape', 'text', 'sticker'],
                'require_invitation' => false,
            ],
            // ... add more types as needed
        ];
        
        return $settings[$spaceType] ?? $settings['chat'];
    }

    /**
     * Helper: Get initial content state
     */
    private function getInitialContentState($spaceType)
    {
        $states = [
            'chat' => ['messages' => [], 'last_message_id' => null],
            'whiteboard' => ['canvas' => [], 'elements' => [], 'background' => '#ffffff'],
            'meeting' => ['participants' => [], 'agenda' => [], 'notes' => ''],
            'document' => ['content' => '', 'revisions' => []],
            'brainstorm' => ['ideas' => [], 'connections' => [], 'categories' => []],
            'story' => ['segments' => [], 'current_branch' => 'main', 'choices' => []],
            'voice_channel' => ['participants' => [], 'active_speakers' => []],
        ];
        
        return $states[$spaceType] ?? [];
    }
}