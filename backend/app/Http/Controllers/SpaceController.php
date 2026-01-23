<?php

namespace App\Http\Controllers;

use App\Models\CollaborationSpace;
use App\Models\SpaceParticipation;
use App\Models\Conversation;
use App\Models\Post;
use App\Models\Story;
use App\Models\MagicEvent;
use App\Models\AiInteraction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SpaceController extends Controller
{
    /**
     * Get all spaces for current user
     */
    public function index(Request $request)
    {
        try {
            $user = Auth::user();
            
            // Use the scope to get spaces where user is participant
            $spaces = CollaborationSpace::forUser($user->id)
                ->with(['creator', 'linkedConversation', 'linkedPost', 'linkedStory'])
                ->withCount(['participations as participants_count'])
                ->orderBy('updated_at', 'desc')
                ->get();
            
            // Get participation data for each space
            $spacesWithParticipation = $spaces->map(function($space) use ($user) {
                $participation = SpaceParticipation::where('space_id', $space->id)
                    ->where('user_id', $user->id)
                    ->first();
                
                return [
                    'id' => $space->id,
                    'title' => $space->title,
                    'description' => $space->description,
                    'space_type' => $space->space_type,
                    'creator_id' => $space->creator_id,
                    'settings' => $space->settings,
                    'content_state' => $space->content_state,
                    'activity_metrics' => $space->activity_metrics,
                    'evolution_level' => $space->evolution_level,
                    'unlocked_features' => $space->unlocked_features,
                    'is_live' => $space->is_live,
                    'has_ai_assistant' => $space->has_ai_assistant,
                    'ai_personality' => $space->ai_personality,
                    'ai_capabilities' => $space->ai_capabilities,
                    'linked_conversation_id' => $space->linked_conversation_id,
                    'linked_post_id' => $space->linked_post_id,
                    'linked_story_id' => $space->linked_story_id,
                    'participants_count' => $space->participants_count,
                    'creator' => $space->creator,
                    'linked_conversation' => $space->linkedConversation,
                    'linked_post' => $space->linkedPost,
                    'linked_story' => $space->linkedStory,
                    'created_at' => $space->created_at,
                    'updated_at' => $space->updated_at,
                    'my_role' => $participation ? $participation->role : null,
                    'my_permissions' => $participation ? $participation->permissions : null,
                    'is_online_in_space' => $participation ? ($participation->presence_data['is_online'] ?? false) : false,
                ];
            });
            
            return response()->json([
                'spaces' => $spacesWithParticipation,
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Error fetching spaces: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error fetching spaces',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create a new collaboration space
     */
    public function store(Request $request)
    {
        DB::beginTransaction();
        
        try {
            $validator = Validator::make($request->all(), [
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

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

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
                'content_state' => $this->getInitialContentState($request->space_type),
                'has_ai_assistant' => $request->has('ai_personality') || $request->has('ai_capabilities'),
                'ai_personality' => $request->ai_personality,
                'ai_capabilities' => $request->ai_capabilities ?? ['summarize', 'suggest'],
                'activity_metrics' => [
                    'total_interactions' => 0,
                    'energy_level' => 50,
                ],
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
                'contribution_map' => [],
                'focus_areas' => [],
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
            MagicEvent::create([
                'id' => Str::uuid(),
                'space_id' => $space->id,
                'triggered_by' => $user->id,
                'event_type' => 'space_created',
                'event_data' => [
                    'created_by' => $user->id,
                    'type' => $space->space_type,
                    'title' => $space->title,
                ],
                'context' => [
                    'initial_space_type' => $space->space_type,
                    'has_ai_assistant' => $space->has_ai_assistant,
                ],
                'has_been_discovered' => false,
            ]);

            DB::commit();

            return response()->json([
                'space' => $space->load(['creator']),
                'message' => 'Space created successfully'
            ], 201);
            
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error creating space: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error creating space',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get space details
     */
    public function show($id)
    {
        try {
            $user = Auth::user();
            
            // Check if user can access this space
            $participation = SpaceParticipation::where('space_id', $id)
                ->where('user_id', $user->id)
                ->first();
            
            if (!$participation) {
                return response()->json([
                    'message' => 'You do not have access to this space'
                ], 403);
            }
            
            $space = CollaborationSpace::with([
                'creator',
                'linkedConversation',
                'linkedPost',
                'linkedStory',
                'participations.user',
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
            
            return response()->json([
                'space' => $space,
                'participation' => $participation,
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Error fetching space details: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error fetching space details',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Helper: Get default settings for space type
     */
    // private function getDefaultSettings($spaceType)
    // {
    //     $settings = [
    //         'chat' => [
    //             'allow_guests' => false,
    //             'max_participants' => 100,
    //             'enable_reactions' => true,
    //             'enable_threads' => false,
    //             'require_invitation' => false,
    //         ],
    //         'whiteboard' => [
    //             'allow_guests' => true,
    //             'max_participants' => 20,
    //             'enable_grid' => true,
    //             'tools' => ['pen', 'shape', 'text', 'sticker'],
    //             'require_invitation' => false,
    //         ],
    //         'meeting' => [
    //             'allow_guests' => true,
    //             'max_participants' => 10,
    //             'video_on_join' => false,
    //             'enable_raise_hand' => true,
    //             'enable_recording' => false,
    //             'require_invitation' => true,
    //         ],
    //         'document' => [
    //             'allow_guests' => true,
    //             'max_participants' => 10,
    //             'editing_mode' => 'collaborative',
    //             'versioning' => true,
    //             'require_invitation' => false,
    //         ],
    //         'brainstorm' => [
    //             'allow_guests' => true,
    //             'max_participants' => 20,
    //             'anonymous_ideas' => false,
    //             'voting' => true,
    //             'require_invitation' => false,
    //         ],
    //         'story' => [
    //             'allow_guests' => true,
    //             'max_participants' => 10,
    //             'chain_mode' => 'sequential',
    //             'allow_branching' => true,
    //             'require_invitation' => false,
    //         ],
    //         'voice_channel' => [
    //             'allow_guests' => true,
    //             'max_participants' => 20,
    //             'spatial_audio' => true,
    //             'noise_suppression' => true,
    //             'require_invitation' => false,
    //         ],
    //     ];
        
    //     return $settings[$spaceType] ?? $settings['chat'];
    // }

    // /**
    //  * Helper: Get initial content state
    //  */
    // private function getInitialContentState($spaceType)
    // {
    //     $states = [
    //         'chat' => [
    //             'messages' => [],
    //             'last_message_id' => null,
    //         ],
    //         'whiteboard' => [
    //             'canvas' => [],
    //             'elements' => [],
    //             'background' => '#ffffff',
    //         ],
    //         'meeting' => [
    //             'participants' => [],
    //             'agenda' => [],
    //             'notes' => '',
    //         ],
    //         'document' => [
    //             'content' => '',
    //             'revisions' => [],
    //         ],
    //         'brainstorm' => [
    //             'ideas' => [],
    //             'connections' => [],
    //             'categories' => [],
    //         ],
    //         'story' => [
    //             'segments' => [],
    //             'current_branch' => 'main',
    //             'choices' => [],
    //         ],
    //         'voice_channel' => [
    //             'participants' => [],
    //             'active_speakers' => [],
    //         ],
    //     ];
        
    //     return $states[$spaceType] ?? $states['chat'];
    // }

    /**
     * Helper: Get owner permissions
     */
    private function getOwnerPermissions()
    {
        return [
            'can_edit_space' => true,
            'can_invite' => true,
            'can_remove' => true,
            'can_change_roles' => true,
            'can_start_calls' => true,
            'can_share_screen' => true,
            'can_trigger_magic' => true,
            'can_configure_ai' => true,
        ];
    }

    /**
     * Helper: Get default participant permissions
     */
    private function getDefaultParticipantPermissions()
    {
        return [
            'can_edit_space' => false,
            'can_invite' => false,
            'can_remove' => false,
            'can_change_roles' => false,
            'can_start_calls' => true,
            'can_share_screen' => true,
            'can_trigger_magic' => false,
            'can_configure_ai' => false,
        ];
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