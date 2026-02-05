<?php

namespace App\Http\Controllers;

use App\Models\CollaborationSpace;
use App\Models\SpaceParticipation;
use App\Models\Conversation;
use App\Models\Post;
use App\Models\Story;
use App\Models\MagicEvent;
use App\Models\User;
use App\Models\Message;

use App\Models\AiInteraction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Notifications\SpaceInvitationNotification;

use App\Events\SpaceUpdated;
use App\Events\MagicEventTriggered;
use App\Events\ParticipantJoined;
use App\Events\ParticipantLeft;

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

            // Broadcast event
            // broadcast(new SpaceUpdated($space, auth()->id()))->toOthers();

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
        $space = CollaborationSpace::with([
            'creator',
            'participations.user',
            'magicEvents' => function($query) {
                $query->where('has_been_discovered', false)
                      ->orWhere('created_at', '>', now()->subHours(24));
            }
        ])->findOrFail($id);

        $participation = $space->participations()
            ->where('user_id', auth()->id())
            ->first();

        // Update last active
        if ($participation) {
            $participation->update(['last_active_at' => now()]);
        }

        return response()->json([
            'space' => $space,
            'participation' => $participation,
            'participants' => $space->participations()->with('user')->get(),
            'magic_events' => $space->magicEvents
        ]);
    }

    // Helper: Get all spaces for a specific user
    public function getUserSpaces($userId)
    {
        $spaces = CollaborationSpace::where('creator_id', $userId)
            ->orWhereHas('participants', function($query) use ($userId) {
                $query->where('user_id', $userId);
            })
            ->with(['creator', 'participants.user'])
            ->orderBy('updated_at', 'desc')
            ->get();

        // Format for frontend
        $formattedSpaces = $spaces->map(function($space) use ($userId) {
            $participation = $space->participations()->where('user_id', $userId)->first();
            
            return [
                'id' => $space->id,
                'title' => $space->title,
                'space_type' => $space->space_type,
                'description' => $space->description,
                'creator_id' => $space->creator_id,
                'creator' => $space->creator,
                'settings' => $space->settings,
                'content_state' => $space->content_state,
                'activity_metrics' => $space->activity_metrics,
                'evolution_level' => $space->evolution_level,
                'unlocked_features' => $space->unlocked_features,
                'is_live' => $space->is_live,
                'has_ai_assistant' => $space->has_ai_assistant,
                'ai_personality' => $space->ai_personality,
                'ai_capabilities' => $space->ai_capabilities,
                'participants_count' => $space->participants()->count(),
                'participants' => $space->participants()->with('user')->get(),
                'my_role' => $participation ? $participation->role : null,
                'my_permissions' => $participation ? $participation->permissions : null,
                'created_at' => $space->created_at,
                'updated_at' => $space->updated_at,
            ];
        });

        return response()->json(['spaces' => $formattedSpaces]);
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

        // Broadcast update event
        broadcast(new SpaceUpdated($space, auth()->id()))->toOthers();

        return response()->json([
            'space' => $space,
            'message' => 'Space updated successfully'
        ]);
    }

    /**
     * Join a space
     */
    public function join($id)
    {
        $space = CollaborationSpace::findOrFail($id);
        
        // Check if already joined
        $existing = $space->participations()
            ->where('user_id', auth()->id())
            ->first();
            
        if ($existing) {
            return response()->json([
                'participation' => $existing,
                'message' => 'Already joined'
            ]);
        }
        
        $participation = $space->participations()->create([
            'user_id' => auth()->id(),
            'role' => 'participant',
            'permissions' => ['read' => true, 'write' => true],
            'last_active_at' => now(),
        ]);
        
        // Broadcast participant joined
        broadcast(new ParticipantJoined($space, auth()->user()))->toOthers();
        
        return response()->json([
            'participation' => $participation->load('user'),
            'message' => 'Successfully joined space'
        ]);
    }

    /**
     * Invite users to space
     */
    public function leave($id)
    {
        $space = CollaborationSpace::findOrFail($id);
        
        $participation = $space->participations()
            ->where('user_id', auth()->id())
            ->first();
            
        if ($participation) {
            // Broadcast before deleting
            broadcast(new ParticipantLeft($space, auth()->user()))->toOthers();
            $participation->delete();
        }
        
        return response()->json([
            'message' => 'Successfully left space'
        ]);
    }

    public function invite(Request $request, $id)
    {
        $request->validate([
            'user_ids' => 'required|array',
            'user_ids.*' => 'exists:users,id',
            'role' => 'sometimes|in:viewer,participant,moderator',
            'message' => 'sometimes|string|max:500'
        ]);
        
        $space = CollaborationSpace::findOrFail($id);
        $inviter = auth()->user();
        
        // Check if user has permission to invite
        $currentParticipation = $space->participations()
            ->where('user_id', auth()->id())
            ->first();
            
        if (!$currentParticipation || !in_array($currentParticipation->role, ['owner', 'moderator'])) {
            return response()->json([
                'message' => 'You do not have permission to invite users to this space'
            ], 403);
        }
        
        $invited = [];
        foreach ($request->user_ids as $userId) {
            // Check if already in space
            $existing = $space->participations()
                ->where('user_id', $userId)
                ->first();
                
            if (!$existing) {
                // Don't create participation yet - just send invitation
                $invited[] = $userId;
                
                // Send notification to user
                $user = User::find($userId);
                if ($user) {
                    $user->notify(new \App\Notifications\SpaceInvitationNotification($space, $inviter, $request->message));
                }
            } else {
                // User is already in space
                $invited[] = $userId;
            }
        }
        
        return response()->json([
            'invited' => $invited,
            'message' => count($invited) . ' invitation(s) sent successfully'
        ]);
    }

    // Add this new method to handle invitation acceptance
    public function acceptInvitation($id)
    {
        $space = CollaborationSpace::findOrFail($id);
        $userId = auth()->id();
        
        // Check if already in space
        $existing = $space->participations()
            ->where('user_id', $userId)
            ->first();
            
        if ($existing) {
            return response()->json([
                'participation' => $existing,
                'message' => 'Already joined this space'
            ]);
        }
        
        // Create participation
        $participation = $space->participations()->create([
            'user_id' => $userId,
            'role' => 'participant',
            'permissions' => ['read' => true, 'write' => true],
            'last_active_at' => now(),
        ]);
        
        // Broadcast participant joined
        broadcast(new ParticipantJoined($space, auth()->user()))->toOthers();
        
        return response()->json([
            'participation' => $participation->load('user'),
            'space' => $space->load(['creator', 'participations.user']),
            'message' => 'Successfully joined the space'
        ]);
    }

    public function startCall(Request $request, $id)
    {
        $request->validate([
            'call_type' => 'required|in:audio,video,screen_share'
        ]);
        
        $space = CollaborationSpace::findOrFail($id);
        
        // Check if user is a participant
        $participation = $space->participations()
            ->where('user_id', auth()->id())
            ->first();
            
        if (!$participation) {
            return response()->json([
                'message' => 'You must be a participant in the space to start a call'
            ], 403);
        }
        
        // Generate UUID for call
        $callId = \Illuminate\Support\Str::uuid()->toString();
        
        // Create call record
        $call = \App\Models\Call::create([
            'id' => $callId,
            'conversation_id' => $space->linked_conversation_id,
            'initiator_id' => auth()->id(),
            'type' => $request->call_type,
            'status' => 'ringing',
            'participants' => [auth()->id()],
            'started_at' => now(),
            'is_web_compatible' => true,
        ]);
        
        // Update space activity
        $space->update([
            'is_live' => true,
            'current_focus' => 'call',
            'live_participants' => [auth()->id()]
        ]);
        
        // Add the initiator as a participant in the pivot table
        $call->users()->attach(auth()->id(), [
            'joined_at' => now(),
            'role' => 'initiator'
        ]);
        
        // Broadcast call started event
        broadcast(new CallStarted($space, $call, auth()->user()))->toOthers();
        
        return response()->json([
            'call' => $call->load('initiator'),
            'space' => $space->fresh(['participations.user']),
            'message' => 'Call started successfully'
        ]);
    }

    /**
     * Query AI assistant
     */
    // public function aiQuery(Request $request, $id)
    // {
    //     $user = Auth::user();
        
    //     // Check if user is participant
    //     $participation = SpaceParticipation::where('space_id', $id)
    //         ->where('user_id', $user->id)
    //         ->firstOrFail();
        
    //     $request->validate([
    //         'query' => 'required|string',
    //         'context' => 'nullable|array',
    //         'action' => 'nullable|in:summarize,suggest,brainstorm,moderate,inspire',
    //     ]);
        
    //     $space = CollaborationSpace::findOrFail($id);
        
    //     // Check if AI assistant is enabled
    //     if (!$space->has_ai_assistant) {
    //         return response()->json([
    //             'message' => 'AI assistant is not enabled for this space',
    //         ], 403);
    //     }
        
    //     // Prepare context
    //     $context = array_merge($request->context ?? [], [
    //         'space_type' => $space->space_type,
    //         'space_title' => $space->title,
    //         'participant_count' => $space->participants()->count(),
    //         'user_id' => $user->id,
    //         'user_role' => $participation->role,
    //     ]);
        
    //     // Query AI (first check chatbot_training, then fallback)
    //     $aiResponse = $this->queryAI($request->query, $context, $request->action);
        
    //     // Log the interaction
    //     $interaction = AiInteraction::create([
    //         'id' => Str::uuid(),
    //         'space_id' => $space->id,
    //         'user_id' => $user->id,
    //         'interaction_type' => $request->action ?? 'query',
    //         'user_input' => $request->query,
    //         'ai_response' => $aiResponse['response'],
    //         'context_data' => $context,
    //         'confidence_score' => $aiResponse['confidence'],
    //         'response_time_ms' => $aiResponse['response_time'],
    //     ]);
        
    //     // Update space AI learning data
    //     $this->updateAILearningData($space, $interaction);
        
    //     // Check if this triggers any magic
    //     $this->checkForMagicFromAI($space, $interaction);
        
    //     return response()->json([
    //         'response' => $aiResponse['response'],
    //         'confidence' => $aiResponse['confidence'],
    //         'suggested_actions' => $aiResponse['suggested_actions'] ?? [],
    //         'interaction_id' => $interaction->id,
    //         'message' => 'AI response generated',
    //     ]);
    // }

    /**
     * Trigger a magic event manually
     */
    public function triggerMagic(Request $request, $id)
    {
        $request->validate([
            'event_type' => 'required|string|max:255',
            'data' => 'sometimes|array'
        ]);
        
        $space = CollaborationSpace::findOrFail($id);
        
        // Check emergence triggers
        $shouldTrigger = $this->checkEmergenceTriggers($space, $request->event_type);
        
        if (!$shouldTrigger) {
            return response()->json([
                'message' => 'Emergence conditions not met'
            ], 400);
        }
        
        $event = MagicEvent::create([
            'space_id' => $space->id,
            'triggered_by' => auth()->id(),
            'event_type' => $request->event_type,
            'event_data' => $request->data ?? [],
            'context' => [
                'space_type' => $space->space_type,
                'participant_count' => $space->participations()->count(),
                'activity_level' => $space->activity_metrics['level'] ?? 1,
            ],
            'impact' => [],
            'has_been_discovered' => false,
            'discovery_path' => ['triggered_by_user' => auth()->id()],
            'interactions' => [],
        ]);
        
        // Update space
        $space->update([
            'last_magic_at' => now(),
            'evolution_level' => $space->evolution_level + 1
        ]);
        
        // Broadcast magic event
        broadcast(new MagicEventTriggered($space, $event))->toOthers();
        
        return response()->json([
            'event' => $event,
            'space' => $space->fresh(),
            'message' => 'Magic event triggered'
        ]);
    }

    public function getAISuggestions($id)
    {
        $space = CollaborationSpace::findOrFail($id);
        
        $suggestions = [];
        
        // Check space activity for suggestions
        $participantCount = $space->participations()->count();
        $activity = $space->activity_metrics ?? [];
        
        // Suggestion 1: Icebreaker if new space
        if ($space->created_at->diffInMinutes(now()) < 10 && $participantCount > 1) {
            $suggestions[] = [
                'type' => 'icebreaker',
                'title' => 'Icebreaker Question',
                'content' => 'What\'s one thing you\'re excited about this week?',
                'action' => 'send_message',
                'priority' => 'high'
            ];
        }
        
        // Suggestion 2: Summarize if many messages
        if (($activity['message_count'] ?? 0) > 20) {
            $suggestions[] = [
                'type' => 'summary',
                'title' => 'Summarize Conversation',
                'content' => 'Would you like me to summarize the key points so far?',
                'action' => 'generate_summary',
                'priority' => 'medium'
            ];
        }
        
        // Suggestion 3: Brainstorming prompt
        if ($space->space_type === 'brainstorm' && ($activity['idea_count'] ?? 0) < 5) {
            $suggestions[] = [
                'type' => 'brainstorm_prompt',
                'title' => 'Brainstorming Prompt',
                'content' => 'What if we approached this from a completely different perspective?',
                'action' => 'suggest_prompt',
                'priority' => 'high'
            ];
        }
        
        // Suggestion 4: Document structure
        if ($space->space_type === 'document' && empty($activity['document_structure'])) {
            $suggestions[] = [
                'type' => 'document_outline',
                'title' => 'Document Outline',
                'content' => 'Would you like me to suggest a structure for this document?',
                'action' => 'create_outline',
                'priority' => 'medium'
            ];
        }
        
        return response()->json([
            'suggestions' => $suggestions,
            'space_type' => $space->space_type,
            'activity_level' => $activity['level'] ?? 1
        ]);
    }

    public function aiQuery(Request $request, $id)
    {
        $request->validate([
            'query' => 'required|string',
            'context' => 'sometimes|array',
            'action' => 'sometimes|string'
        ]);
        
        $space = CollaborationSpace::findOrFail($id);
        
        // Check chatbot training for matching responses
        $training = \App\Models\ChatbotTraining::where('space_types', 'like', "%{$space->space_type}%")
            ->orWhere('collaboration_context', $space->space_type)
            ->where('is_active', true)
            ->orderBy('success_rate', 'desc')
            ->orderBy('usage_count', 'desc')
            ->first();
        
        $response = $training ? $training->response : 'I\'m here to help with your collaboration!';
        
        // Log interaction
        $interaction = \App\Models\AIInteraction::create([
            'space_id' => $space->id,
            'user_id' => auth()->id(),
            'interaction_type' => $request->action ?? 'query',
            'user_input' => $request->query,
            'ai_response' => $response,
            'training_match_id' => $training?->id,
            'context_data' => array_merge($request->context ?? [], [
                'space_type' => $space->space_type,
                'space_id' => $space->id
            ]),
            'confidence_score' => $training ? 0.85 : 0.5,
            'response_time_ms' => rand(100, 500),
        ]);
        
        // Update training usage
        if ($training) {
            $training->increment('usage_count');
        }
        
        return response()->json([
            'response' => $response,
            'interaction_id' => $interaction->id,
            'confidence' => $interaction->confidence_score,
            'suggestion_followup' => $this->generateFollowupSuggestion($space, $request->query)
        ]);
    }

    private function checkEmergenceTriggers(CollaborationSpace $space, $eventType)
    {
        $triggers = $space->emergence_triggers ?? [];
        $activity = $space->activity_metrics ?? [];
        
        // Check if space has any triggers
        if (empty($triggers)) {
            return false;
        }
        
        // Check time-based triggers
        foreach ($triggers as $trigger) {
            if ($trigger['type'] === 'time' && $trigger['condition'] === 'night') {
                $hour = now()->hour;
                if ($hour >= 22 || $hour <= 6) {
                    return true;
                }
            }
            
            if ($trigger['type'] === 'activity' && isset($activity[$trigger['metric']])) {
                if ($activity[$trigger['metric']] >= $trigger['threshold']) {
                    return true;
                }
            }
            
            if ($trigger['type'] === 'participant_count') {
                $count = $space->participations()->count();
                if ($count >= $trigger['min'] && $count <= ($trigger['max'] ?? PHP_INT_MAX)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    private function generateFollowupSuggestion(CollaborationSpace $space, $query)
    {
        $keywords = strtolower($query);
        
        if (str_contains($keywords, 'brainstorm') || str_contains($keywords, 'idea')) {
            return 'Would you like me to generate some creative prompts for your brainstorming session?';
        }
        
        if (str_contains($keywords, 'summarize') || str_contains($keywords, 'recap')) {
            return 'I can summarize the key points and action items from this discussion.';
        }
        
        if (str_contains($keywords, 'meeting') || str_contains($keywords, 'agenda')) {
            return 'Would you like me to help create a meeting agenda or take notes?';
        }
        
        return null;
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



    /**
     * Search across spaces, chats, contacts, messages, and posts
     */
    public function search(Request $request)
    {
        // \Log::info('Search request received', $request->all());
        
        try {
            $request->validate([
                'query' => 'required|string|min:2|max:100',
                'types' => 'sometimes|array',
                'types.*' => 'in:spaces,chats,contacts,messages,posts',
                'limit' => 'sometimes|integer|min:1|max:100',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            // \Log::error('Search validation failed', $e->errors());
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        }

        $query = $request->input('query');
        $types = $request->input('types', ['spaces', 'chats', 'contacts', 'messages', 'posts']);
        $limit = $request->input('limit', 20);
        $userId = auth()->id();

        // \Log::info('Searching for', [
        //     'query' => $query,
        //     'types' => $types,
        //     'user_id' => $userId
        // ]);

        $results = [];

        // Search spaces
        if (in_array('spaces', $types)) {
            try {
                $spaces = CollaborationSpace::where(function($q) use ($query, $userId) {
                        $q->where('title', 'like', "%{$query}%")
                          ->orWhere('description', 'like', "%{$query}%");
                    })
                    ->where(function($q) use ($userId) {
                        $q->where('creator_id', $userId)
                          ->orWhereHas('participations', function($q) use ($userId) {
                              $q->where('user_id', $userId);
                          });
                    })
                    ->with('creator')
                    ->limit($limit)
                    ->get();

                foreach ($spaces as $space) {
                    $results[] = [
                        'id' => $space->id,
                        'type' => 'space',
                        'title' => $space->title,
                        'description' => $space->description,
                        'avatar' => $space->creator?->profile_photo,
                        'timestamp' => $space->updated_at,
                        'relevance' => $this->calculateRelevance($space->title, $query),
                        'data' => [
                            'id' => $space->id,
                            'title' => $space->title,
                            'space_type' => $space->space_type,
                            'creator' => $space->creator,
                        ],
                    ];
                }
                
                // \Log::info('Found spaces', ['count' => $spaces->count()]);
            } catch (\Exception $e) {
                \Log::error('Error searching spaces', ['error' => $e->getMessage()]);
            }
        }

        // Search contacts (users)
        if (in_array('contacts', $types)) {
            try {
                $contacts = User::where('id', '!=', $userId)
                    ->where(function($q) use ($query) {
                        $q->where('name', 'like', "%{$query}%")
                          ->orWhere('username', 'like', "%{$query}%")
                          ->orWhere('email', 'like', "%{$query}%");
                    })
                    ->limit($limit)
                    ->get();

                foreach ($contacts as $contact) {
                    $results[] = [
                        'id' => $contact->id,
                        'type' => 'contact',
                        'title' => $contact->name,
                        'description' => $contact->username ? "@{$contact->username}" : $contact->email,
                        'avatar' => $contact->profile_photo,
                        'timestamp' => null,
                        'relevance' => $this->calculateRelevance($contact->name, $query),
                        'data' => [
                            'id' => $contact->id,
                            'name' => $contact->name,
                            'username' => $contact->username,
                            'email' => $contact->email,
                            'profile_photo' => $contact->profile_photo,
                        ],
                    ];
                }
                
                \Log::info('Found contacts', ['count' => $contacts->count()]);
            } catch (\Exception $e) {
                \Log::error('Error searching contacts', ['error' => $e->getMessage()]);
            }
        }

        // Search chats (from messages with other users)
        if (in_array('chats', $types)) {
            try {
                $chats = User::whereHas('conversations.messages', function($q) use ($userId) {
                        $q->whereHas('conversation.users', function($q) use ($userId) {
                            $q->where('users.id', $userId);
                        });
                    })
                    ->where('id', '!=', $userId)
                    ->where(function($q) use ($query) {
                        $q->where('name', 'like', "%{$query}%")
                          ->orWhere('username', 'like', "%{$query}%");
                    })
                    ->limit($limit)
                    ->get();

                foreach ($chats as $chat) {
                    $results[] = [
                        'id' => $chat->id,
                        'type' => 'chat',
                        'title' => $chat->name,
                        'description' => "Chat with @{$chat->username}",
                        'avatar' => $chat->profile_photo,
                        'timestamp' => null,
                        'relevance' => $this->calculateRelevance($chat->name, $query),
                        'data' => [
                            'id' => $chat->id,
                            'name' => $chat->name,
                            'username' => $chat->username,
                            'profile_photo' => $chat->profile_photo,
                        ],
                    ];
                }
                
                \Log::info('Found chats', ['count' => $chats->count()]);
            } catch (\Exception $e) {
                \Log::error('Error searching chats', ['error' => $e->getMessage()]);
            }
        }

        // Sort by relevance
        usort($results, function($a, $b) {
            return $b['relevance'] <=> $a['relevance'];
        });

        // Limit results
        $results = array_slice($results, 0, $limit);

        \Log::info('Search completed', [
            'total_results' => count($results),
            'query' => $query
        ]);

        return response()->json([
            'results' => $results,
            'query' => $query,
            'total' => count($results),
        ]);
    }

    private function calculateRelevance($text, $query)
    {
        $text = strtolower($text ?? '');
        $query = strtolower($query);
        
        if (strpos($text, $query) === 0) {
            return 1.0; // Starts with query
        }
        
        if (strpos($text, $query) !== false) {
            return 0.8; // Contains query
        }
        
        // Calculate similarity
        similar_text($text, $query, $percent);
        return $percent / 100;
    }
}