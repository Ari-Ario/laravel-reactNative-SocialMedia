<?php

namespace App\Http\Controllers;

use App\Models\CollaborationSpace;
use Illuminate\Support\Facades\Log;
use App\Models\SpaceParticipation;
use App\Models\Conversation;
use App\Models\Post;
use App\Models\Story;
use App\Models\MagicEvent;
use App\Models\User;
use App\Models\Message;
use App\Models\Call;
use App\Models\AIInteraction;
use App\Models\Poll;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use App\Notifications\SpaceInvitationNotification;

use App\Events\SpaceCreated;
use App\Events\SpaceUpdated;
use App\Events\MagicEventTriggered;
use App\Events\ParticipantJoined;
use App\Events\ParticipantLeft;
use App\Events\CallStarted;
use App\Events\CallEnded;
use App\Events\ScreenShareToggled;
use App\Events\SpaceInvitationSent;
use App\Events\SpaceMuted;
use App\Events\SpacePinned;
use App\Events\SpaceArchived;
use App\Events\SpaceMarkedUnread;
use App\Events\SpaceFavorited;
use App\Events\SpaceRead;
use App\Events\MessageSent;
use App\Events\SpaceMessageSent;
use App\Events\SpaceDeleted;
use App\Events\MessageDeleted;
use App\Events\MessageReacted;
use App\Events\MessagePinned;
use App\Events\WebRTCSignal;
use App\Events\MuteStateChanged;
use App\Events\VideoStateChanged;
use App\Events\ParticipantUpdated;

class SpaceController extends Controller
{
    /**
     * Get all spaces for current user
     */
    public function index(Request $request)
    {
        try {
            /** @var \App\Models\User $user */
            $user = Auth::user();
            
            // Use eager loading to prevent N+1 queries
            // Select limited fields to avoid sending huge JSON blobs (like content_state) for list views
            $spaces = CollaborationSpace::forUser($user->id)
                ->select([
                    'id', 'title', 'description', 'space_type', 'creator_id',
                    'is_live', 'has_ai_assistant', 'linked_conversation_id',
                    'image_path', 'created_at', 'updated_at', 'content_state'
                ])
                ->with(['creator:id,name,profile_photo,username'])
                ->withCount('participations')
                ->orderBy('updated_at', 'desc')
                ->paginate(20);
            
            // Fetch the user's participation for these spaces in a single query
            $spaceIds = $spaces->pluck('id')->toArray();
            $participations = SpaceParticipation::whereIn('space_id', $spaceIds)
                ->where('user_id', $user->id)
                ->get()
                ->keyBy('space_id');
            
            $spacesWithParticipation = $spaces->map(function($space) use ($participations) {
                $participation = $participations->get($space->id);
                
                return [
                    'id' => $space->id,
                    'title' => $space->title,
                    'description' => $space->description,
                    'space_type' => $space->space_type,
                    'creator_id' => $space->creator_id,
                    // Omitted content_state and settings to keep payload small
                    'is_live' => $space->is_live,
                    'has_ai_assistant' => $space->has_ai_assistant,
                    'linked_conversation_id' => $space->linked_conversation_id,
                    'participants_count' => $space->participations_count, // From withCount
                    'creator' => $space->creator,
                    'created_at' => $space->created_at,
                    'updated_at' => $space->updated_at,
                    'my_role' => $participation ? $participation->role : null,
                    'image_url' => $space->image_url,
                    'is_online_in_space' => $participation ? ($participation->presence_data['is_online'] ?? false) : false,
                    'my_permissions' => $participation ? $participation->permissions : [
                        'is_muted' => false,
                        'is_pinned' => false,
                        'is_archived' => false,
                        'is_unread' => false,
                        'is_favorite' => false,
                    ],
                    'unread_count' => $participation ? $this->calculateUnreadCount($space, $participation) : 0,
                ];
            });
            
            return response()->json([
                'spaces' => $spacesWithParticipation,
                'user_preferences' => [
                    'custom_tabs' => $user->custom_tabs ?? [],
                    'theme_preference' => $user->theme_preference,
                    'locale' => $user->locale
                ],
                'pagination' => [
                    'current_page' => $spaces->currentPage(),
                    'last_page' => $spaces->lastPage(),
                    'total' => $spaces->total()
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error fetching spaces: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error fetching spaces',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Helper to calculate unread counts from JSON content_state
     */
    private function calculateUnreadCount($space, $participation)
    {
        // Get the user's last read timestamp for this space
        $lastReadAt = $participation->last_read_at;
        $messages = $space->content_state['messages'] ?? [];
        $userId = $participation->user_id;

        if (!$lastReadAt) {
            // If never read, everything from OTHERS is unread
            return collect($messages)->where('user_id', '!=', $userId)->count();
        }

        $lastReadTime = $lastReadAt instanceof \Carbon\Carbon ? $lastReadAt->timestamp : strtotime($lastReadAt);
        
        $unreadCount = 0;
        foreach ($messages as $msg) {
            if (isset($msg['created_at']) && isset($msg['user_id'])) {
                // Only count messages from others sent AFTER last read
                if (strtotime($msg['created_at']) > $lastReadTime && $msg['user_id'] != $userId) {
                    $unreadCount++;
                }
            }
        }

        return $unreadCount;
    }

    /**
     * Create a new collaboration space
     */
    public function store(Request $request)
    {
        DB::beginTransaction();
        
        try {
            $validator = Validator::make($request->all(), [
                'space_type' => 'required|in:chat,whiteboard,meeting,document,brainstorm,story,voice_channel,general,protected,channel,direct',
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

            /** @var \App\Models\User $user */
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
            // event(new SpaceCreated($space, auth()->user()));

            return response()->json([
                'space' => $space->load(['creator']),
                'message' => 'Space created successfully'
            ], 201);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error creating space: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error creating space',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create a space automatically from a post
     */
    public function createSpaceFromPost(Post $post, array $data)
    {
        DB::beginTransaction();
        
        try {
            /** @var \App\Models\User $user */
            $user = Auth::user();
            
            $space = CollaborationSpace::create([
                'id' => (string) Str::uuid(),
                'creator_id' => $user->id,
                'space_type' => 'chat',
                'title' => 'Space for: ' . $post->caption,
                'description' => $data['description'] ?? 'Collaboration space for post content',
                'linked_post_id' => $post->id,
                'settings' => $this->getDefaultSettings('chat'),
                'content_state' => $this->getInitialContentState('chat'),
                'has_ai_assistant' => false,
                'activity_metrics' => [
                    'total_interactions' => 0,
                    'energy_level' => 50,
                ],
            ]);

            SpaceParticipation::create([
                'space_id' => $space->id,
                'user_id' => $user->id,
                'role' => 'owner',
                'permissions' => $this->getOwnerPermissions(),
                'presence_data' => [
                    'is_online' => true,
                    'device' => 'app',
                    'last_seen' => now(),
                ],
            ]);

            DB::commit();
            return $space;
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error creating space from post: ' . $e->getMessage());
            throw $e;
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

    public function getUserSpaces($userId)
    {
        $spaces = CollaborationSpace::where('creator_id', $userId)
            ->orWhereHas('participants', function($query) use ($userId) {
                $query->where('user_id', $userId);
            })
            ->select([
                'id', 'title', 'space_type', 'description', 'creator_id', 
                'is_live', 'has_ai_assistant', 'settings', 'image_path',
                'created_at', 'updated_at'
            ])
            ->with(['creator:id,name,profile_photo,username'])
            ->withCount('participations')
            ->orderBy('updated_at', 'desc')
            ->limit(50) // Prevent fetching thousands of records globally
            ->get();

        // Get user participations in a single query
        $spaceIds = $spaces->pluck('id')->toArray();
        $participations = SpaceParticipation::whereIn('space_id', $spaceIds)
            ->where('user_id', $userId)
            ->get()
            ->keyBy('space_id');

        // Get other participant for direct spaces
        $directSpaceIds = $spaces->filter(function($s) {
            $settings = is_string($s->settings) ? json_decode($s->settings, true) : $s->settings;
            return ($settings['is_direct'] ?? false) || $s->space_type === 'direct';
        })->pluck('id')->toArray();

        $otherParticipations = SpaceParticipation::whereIn('space_id', $directSpaceIds)
            ->where('user_id', '!=', $userId)
            ->with('user:id,name,username,profile_photo')
            ->get()
            ->keyBy('space_id');

        // Format for frontend
        $formattedSpaces = $spaces->map(function($space) use ($participations, $otherParticipations) {
            $participation = $participations->get($space->id);
            $settings = is_string($space->settings) ? json_decode($space->settings, true) : $space->settings;
            $permissions = $participation ? (is_string($participation->permissions) ? json_decode($participation->permissions, true) : $participation->permissions) : null;
            
            return [
                'id' => $space->id,
                'title' => $space->title,
                'space_type' => $space->space_type,
                'creator_id' => $space->creator_id,
                'creator' => $space->creator,
                'settings' => $settings,
                'is_live' => $space->is_live,
                'has_ai_assistant' => $space->has_ai_assistant,
                'participants_count' => $space->participations_count,
                'my_role' => $participation ? $participation->role : null,
                'my_permissions' => $permissions,
                'other_participant' => $otherParticipations->get($space->id)?->user,
                'created_at' => $space->created_at,
                'updated_at' => $space->updated_at,
            ];
        });

        return response()->json([
            'spaces' => $formattedSpaces,
            'user_preferences' => [
                'custom_tabs' => Auth::user()->custom_tabs ?? [],
            ]
        ]);
    }

    /**
     * Find or create a direct (1-on-1) space with a user
     */
    public function getOrCreateDirectSpace(Request $request, $targetUserId)
    {
        $user = auth()->user();

        // 1. Find existing 1-on-1 space
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
            if (!$targetUser) {
                return response()->json(['message' => 'Target user not found'], 404);
            }

            $spaceName = "Direct Message";
            
            DB::beginTransaction();
            try {
                // Create new space
                $space = CollaborationSpace::create([
                    'id' => (string) Str::uuid(),
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

                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                return response()->json(['message' => 'Failed to create direct space', 'error' => $e->getMessage()], 500);
            }
        }

        return response()->json([
            'space' => $space->load('participations.user', 'creator')
        ]);
    }

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
    
    $space = CollaborationSpace::with(['creator', 'participations.user'])->findOrFail($id);
    
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

    // Refresh the space to get updated data
    $space->refresh();

    // Broadcast update event - make sure space is not null
    broadcast(new SpaceUpdated($space, $user->id))->toOthers();

    return response()->json([
        'space' => $space,
        'message' => 'Space updated successfully'
    ]);
}
/**
 * Update only content state
 */
public function updateContentState(Request $request, $id)
{
    $user = Auth::user();
    
    // Check if user is a participant
    $participation = SpaceParticipation::where('space_id', $id)
        ->where('user_id', $user->id)
        ->first();
    
    if (!$participation) {
        return response()->json([
            'message' => 'You must be a participant to update content'
        ], 403);
    }
    
    $request->validate([
        'content_state' => 'required|array',
    ]);
    
    $space = CollaborationSpace::findOrFail($id);
    
    // Update only content_state
    $space->update([
        'content_state' => $request->content_state,
        'updated_at' => now(),
    ]);
    
    // Update user's last active time
    $participation->update([
        'last_active_at' => now(),
    ]);
    
    // Refresh the space
    $space->refresh()->load('creator');
    
    // Broadcast update
    broadcast(new SpaceUpdated($space, $user->id, ['content_state' => true]))->toOthers();
    
    return response()->json([
        'space' => $space,
        'message' => 'Content updated successfully'
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
        /** @var \App\Models\User $authUser */
        $authUser = auth()->user();
        broadcast(new ParticipantJoined($space, $authUser))->toOthers();
        
        // Broadcast participation update globally
        broadcast(new SpaceUpdated($space, $authUser->id, ['update_type' => 'participation']))->toOthers();
        
        // WhatsApp-style system message
        $this->sendSystemMessage($space, $authUser->name . " joined the space");
        
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
            // Check if user is the last owner
            if ($participation->role === 'owner') {
                $otherOwnersCount = $space->participations()
                    ->where('role', 'owner')
                    ->where('user_id', '!=', auth()->id())
                    ->count();
                
                if ($otherOwnersCount === 0) {
                    return response()->json([
                        'message' => 'You are the only owner of this space. Please assign another owner before leaving, or delete the space forever.'
                    ], 403);
                }
            }

            // Broadcast before deleting
            $authUser = auth()->user();
            if ($authUser instanceof \App\Models\User) {
                broadcast(new ParticipantLeft($space, $authUser))->toOthers();
            }
            $participation->delete();

            // Broadcast participation update to everyone in the space channel 
            // AND to the public 'spaces' channel so list views can update count
            broadcast(new SpaceUpdated($space, auth()->id(), [
                'update_type' => 'left',
                'user_id' => auth()->id(),
                'space_id' => $id
            ]));

            // WhatsApp-style system message
            $this->sendSystemMessage($space, $authUser->name . " left the space");
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
        /** @var \App\Models\User $inviter */
        $inviter = auth()->user();
        
        // Check if user has permission to invite
        $currentParticipation = $space->participations()
            ->where('user_id', auth()->id())
            ->first();
            
        Log::info("🔍 Invitation attempt", [
            'space_id' => $id,
            'inviter_id' => auth()->id(),
            'participation_found' => !!$currentParticipation,
            'role' => $currentParticipation ? $currentParticipation->role : 'none'
        ]);

        if (!$currentParticipation || !in_array($currentParticipation->role, ['owner', 'moderator'])) {
            return response()->json([
                'message' => 'You do not have permission to invite users to this space'
            ], 403);
        }
        
        $invited = [];
        foreach ($request->user_ids as $userId) {
            $existing = $space->participations()
                ->where('user_id', $userId)
                ->first();
                
            if (!$existing) {
                $invited[] = $userId;
                
                $user = User::find($userId);
                if ($user && $inviter instanceof \App\Models\User) {
                    // Send database notification
                    $user->notify(new \App\Notifications\SpaceInvitationNotification($space, $inviter, $user, $request->message));
                    
                    // Broadcast real-time event
                    broadcast(new SpaceInvitationSent($space, $inviter, $userId, $request->message))->toOthers();
                }
            } else {
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
        $authUser = auth()->user();
        if ($authUser instanceof \App\Models\User) {
            broadcast(new ParticipantJoined($space, $authUser))->toOthers();
        }
        
        // Broadcast invitation accepted to the joining user's private channel (to refresh list)
        broadcast(new SpaceUpdated($space, $userId, ['update_type' => 'invitation']))->toOthers();

        // Broadcast participation update globally
        broadcast(new SpaceUpdated($space, $userId, ['update_type' => 'participation']))->toOthers();

        // WhatsApp-style system message
        $this->sendSystemMessage($space, $authUser->name . " joined via invitation");
        
        return response()->json([
            'participation' => $participation->load('user'),
            'space' => $space->load(['creator', 'participations.user']),
            'message' => 'Successfully joined the space'
        ]);
    }

/**
 * Start a call in space
 */
public function startCall(Request $request, $id)
{
    $request->validate([
        'call_type' => 'required|in:audio,video,screen_share'
    ]);

    $space = CollaborationSpace::with('participations.user')->findOrFail($id);

    // Check participation
    $participation = $space->participations()
        ->where('user_id', auth()->id())
        ->first();

    if (!$participation) {
        return response()->json([
            'message' => 'You must be a participant in the space to start a call'
        ], 403);
    }

    // Ensure conversation exists
    if (!$space->linked_conversation_id) {
        $conversation = \App\Models\Conversation::create([
            'type' => 'meeting',
            'name' => $space->title,
            'has_meeting_mode' => true,
        ]);

        $space->update([
            'linked_conversation_id' => $conversation->id,
        ]);

        $space->refresh();
    }

    // Check for existing active call
    $existingCall = Call::where('conversation_id', $space->linked_conversation_id) // ✅ FIX: Use Call model
        ->where('status', 'active')
        ->first();

    if ($existingCall) {
        return response()->json([
            'call' => $existingCall->load('initiator'),
            'space' => $space->fresh(['participations.user']),
            'message' => 'Joining existing call'
        ]);
    }

    // Create call with UUID
    $callId = Str::uuid()->toString();
    $participantIds = $space->participations()->pluck('user_id')->toArray();
    
    $call = Call::create([ // ✅ FIX: Use Call model
        'id' => $callId,
        'conversation_id' => $space->linked_conversation_id,
        'initiator_id' => auth()->id(),
        'type' => $request->call_type,
        'status' => 'active',
        'participants' => $participantIds,
        'started_at' => now(),
        'is_web_compatible' => true,
    ]);

    $space->update([
        'is_live' => true,
        'current_focus' => 'call',
        'live_participants' => $participantIds
    ]);

    // Notify all participants
    $authUser = auth()->user();
    if ($authUser instanceof \App\Models\User) {
        foreach ($participantIds as $participantId) {
            if ($participantId != $authUser->id) {
                $user = User::find($participantId);
                
                broadcast(new CallStarted($space, $call, $authUser, $user->id))->toOthers();
            }
        }

        broadcast(new CallStarted($space, $call, $authUser))->toOthers();
    }
    
    // Create persistent call log message
    $this->sendSystemMessage($space, $authUser->name . " started a " . $request->call_type . " call", [
        'call_log' => [
            'id' => $call->id,
            'type' => $request->call_type,
            'status' => 'active',
            'initiator_id' => $authUser->id,
            'initiator_name' => $authUser->name
        ]
    ]);

    return response()->json([
        'call' => $call->load('initiator'),
        'space' => $space->fresh(['participations.user']),
        'message' => 'Call started successfully'
    ]);
}

/**
 * Handle WebRTC signaling
 */
public function callSignal(Request $request, $id)
{
    $request->validate([
        'type' => 'required|in:offer,answer,ice-candidate',
        'target_user_id' => 'required|exists:users,id',
        'call_id' => 'required|string',
        'offer' => 'sometimes|array',
        'answer' => 'sometimes|array',
        'candidate' => 'sometimes|array',
    ]);
    
    $space = CollaborationSpace::findOrFail($id);
    /** @var \App\Models\User $user */
    $user = auth()->user();
    if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);
    
    // Broadcast signal to target user
    if ($user instanceof \App\Models\User) {
        broadcast(new WebRTCSignal(
            $space,
            $user,
            $request->target_user_id,
            $request->type,
            $request->only(['offer', 'answer', 'candidate']),
            $request->call_id
        ))->toOthers();
    }
    
    return response()->json(['success' => true]);
}

/**
 * Handle mute state change
 */
public function callMute(Request $request, $id)
{
    $request->validate([
        'is_muted' => 'required|boolean',
        'call_id' => 'required|string',
    ]);
    
    $space = CollaborationSpace::findOrFail($id);
    $user = auth()->user();
    
    // Update user's participation
    $participation = SpaceParticipation::where('space_id', $id)
        ->where('user_id', $user->id)
        ->first();
    
    if ($participation) {
        $audioVideoState = $participation->audio_video_state ?? [];
        $audioVideoState['is_muted'] = $request->is_muted;
        $participation->update(['audio_video_state' => $audioVideoState]);
    }
    
    // Broadcast mute state to space
    if ($user instanceof \App\Models\User) {
        broadcast(new \App\Events\MuteStateChanged($space, $user, $request->is_muted))->toOthers();
    }
    
    return response()->json(['success' => true]);
}

/**
 * Handle video state change
 */
public function callVideo(Request $request, $id)
{
    $request->validate([
        'has_video' => 'required|boolean',
        'call_id' => 'required|string',
    ]);
    
    $space = CollaborationSpace::findOrFail($id);
    $user = auth()->user();
    
    // Update user's participation
    $participation = SpaceParticipation::where('space_id', $id)
        ->where('user_id', $user->id)
        ->first();
    
    if ($participation) {
        $audioVideoState = $participation->audio_video_state ?? [];
        $audioVideoState['has_video'] = $request->has_video;
        $participation->update(['audio_video_state' => $audioVideoState]);
    }
    
    // Broadcast video state to space
    if ($user instanceof \App\Models\User) {
        broadcast(new \App\Events\VideoStateChanged($space, $user, $request->has_video))->toOthers();
    }
    
    return response()->json(['success' => true]);
}

/**
 * Handle screen share state change
 */
public function callScreenShare(Request $request, $id)
{
    $request->validate([
        'is_sharing' => 'required|boolean',
        'call_id' => 'required|string',
    ]);
    
    $space = CollaborationSpace::findOrFail($id);
    $user = auth()->user();
    
    // Update user's participation
    $participation = SpaceParticipation::where('space_id', $id)
        ->where('user_id', $user->id)
        ->first();
    
    if ($participation) {
        $audioVideoState = $participation->audio_video_state ?? [];
        $audioVideoState['is_sharing_screen'] = $request->is_sharing;
        $participation->update(['audio_video_state' => $audioVideoState]);
    }
    
    // Broadcast screen share state to space
    if ($user instanceof \App\Models\User) {
        broadcast(new \App\Events\ScreenShareToggled($space, $user, $request->is_sharing))->toOthers();
    }
    
    return response()->json(['success' => true]);
}

    /**
     * End a call in space
     */
public function endCall(Request $request, $id)
{
    $request->validate([
        'call_id' => 'required|string'
    ]);
    
    try {
        $space = CollaborationSpace::findOrFail($id);
        
        // Find the call - it might be a UUID string, not auto-increment ID
        $call = Call::where('id', $request->call_id)->first();
        
        if (!$call) {
            return response()->json([
                'message' => 'Call not found'
            ], 404);
        }
        
        // Update call status
        $call->update([
            'status' => 'ended',
            'ended_at' => now(),
            'duration_seconds' => $call->started_at ? now()->diffInSeconds($call->started_at) : 0,
        ]);
        
        // Update space
        $space->update([
            'is_live' => false,
            'current_focus' => null,
            'live_participants' => [],
        ]);
        
        // Broadcast call ended
        broadcast(new CallEnded($space, $call))->toOthers();
        
        // Create persistent call log message for end of call
        $duration = $call->duration_seconds;
        $minutes = floor($duration / 60);
        $seconds = $duration % 60;
        $durationStr = $minutes > 0 ? "{$minutes}m {$seconds}s" : "{$seconds}s";
        
        $this->sendSystemMessage($space, "Call ended (" . $durationStr . ")", [
            'call_log' => [
                'id' => $call->id,
                'type' => $call->type,
                'status' => 'ended',
                'initiator_id' => $call->initiator_id,
                'duration' => $duration,
                'duration_formatted' => $durationStr
            ]
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'Call ended successfully',
            'duration' => $call->duration_seconds,
        ]);
        
    } catch (\Exception $e) {
        Log::error('Error ending call:', [
            'space_id' => $id,
            'call_id' => $request->call_id,
            'error' => $e->getMessage()
        ]);
        
        return response()->json([
            'message' => 'Failed to end call',
            'error' => $e->getMessage()
        ], 500);
    }
}
    
    /**
     * Toggle screen sharing
     */
    public function shareScreen(Request $request, $id)
    {
        $request->validate([
            'is_sharing' => 'required|boolean'
        ]);
        
        $space = CollaborationSpace::findOrFail($id);
        $user = auth()->user();
        
        // Update user's participation
        $participation = $space->participations()
            ->where('user_id', $user->id)
            ->first();
            
        if ($participation) {
            $audioVideoState = $participation->audio_video_state ?? [];
            $audioVideoState['is_sharing_screen'] = $request->is_sharing;
            
            $participation->update([
                'audio_video_state' => $audioVideoState,
            ]);
        }
        
        // Broadcast screen share state
        if ($user instanceof \App\Models\User) {
            broadcast(new ScreenShareToggled($space, $user, $request->is_sharing))->toOthers();
        }
        
        return response()->json([
            'is_sharing' => $request->is_sharing,
            'message' => 'Screen share state updated'
        ]);
    }
    
    /**
     * Upload media to space
     */
    public function uploadMedia(Request $request, $id)
    {
        $request->validate([
            'file' => 'required|file|max:102400', // 100MB max
            'type' => 'required|in:image,video,document,audio',
        ]);
        
        $space = CollaborationSpace::findOrFail($id);
        $user = auth()->user();
        
        // Store the file
        $file = $request->file('file');
        $path = $file->store("spaces/{$space->id}/media", 'public');
        
        // Create media record
        $media = \App\Models\Media::create([
            'user_id' => $user->id,
            'model_type' => \App\Models\CollaborationSpace::class,
            'model_id' => $space->id,
            'file_path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'type' => $request->type,
            'metadata' => [
                'space_id' => $space->id,
                'uploaded_at' => now()->toISOString(),
            ],
        ]);
        
        // Handle as space logo if requested
        if ($request->boolean('is_logo')) {
            // Delete old photo if exists
            if ($space->image_path && \Illuminate\Support\Facades\Storage::disk('public')->exists($space->image_path)) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($space->image_path);
            }
            $space->update(['image_path' => $path]);
        }
        
        // Add to space content state if it's a message
        if ($request->has('message_content')) {
            $contentState = $space->content_state ?? [];
            $messages = $contentState['messages'] ?? [];
            
            $messages[] = [
                'id' => Str::uuid(),
                'user_id' => $user->id,
                'content' => $request->message_content,
                'type' => $request->type,
                'file_path' => $path,
                'metadata' => $media->metadata,
                'created_at' => now()->toISOString(),
            ];
            
            $contentState['messages'] = $messages;
            $space->update(['content_state' => $contentState]);
        }
        
        return response()->json([
            'media' => $media,
            'url' => Storage::url($path),
            'message' => 'Media uploaded successfully'
        ]);
    }

    /**
     * List all media uploaded to a space
     */
    public function getMedia(Request $request, $id)
    {
        $space = CollaborationSpace::findOrFail($id);
        $user = auth()->user();

        // Ensure user is a participant
        $isParticipant = $space->participations()->where('user_id', $user->id)->exists();
        if (!$isParticipant) {
            return response()->json(['message' => 'Access denied'], 403);
        }

        $mediaItems = \App\Models\Media::where(function ($q) use ($space) {
                $q->whereJsonContains('metadata->space_id', $space->id)
                  ->orWhereJsonContains('metadata->space_id', (string) $space->id);
            })
            ->with('user:id,name,profile_photo')
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        $items = $mediaItems->map(function ($m) {
            return [
                'id'         => $m->id,
                'file_name'  => $m->file_name,
                'mime_type'  => $m->mime_type,
                'file_size'  => $m->file_size,
                'type'       => $m->metadata['type'] ?? 'document',
                'url'        => Storage::url($m->file_path),
                'uploader'   => $m->user ? ['id' => $m->user->id, 'name' => $m->user->name] : null,
                'created_at' => $m->created_at->toISOString(),
            ];
        });

        return response()->json(['media' => $items]);
    }

    /**
     * Delete a media file from a space (owner/moderator only)
     */
    public function deleteMedia(Request $request, $id, $mediaId)
    {
        $space = CollaborationSpace::findOrFail($id);
        $user  = auth()->user();

        $participation = $space->participations()
            ->where('user_id', $user->id)
            ->whereIn('role', ['owner', 'moderator'])
            ->first();

        if (!$participation) {
            return response()->json(['message' => 'Only owners and moderators can delete media'], 403);
        }

        $media = \App\Models\Media::findOrFail($mediaId);

        // Make sure the media actually belongs to this space
        $spaceId = $media->metadata['space_id'] ?? null;
        if ((string) $spaceId !== (string) $space->id) {
            return response()->json(['message' => 'Media does not belong to this space'], 404);
        }

        Storage::disk('public')->delete($media->file_path);
        $media->delete();

        return response()->json(['message' => 'Media deleted successfully']);
    }
    
    /**
     * Send a message in space
     */
    public function sendMessage(Request $request, $id)
    {
        $request->validate([
            'content' => 'nullable|string',
            'type' => 'sometimes|in:text,image,video,document,voice,poll,album',
            'file_path' => 'sometimes|string',
            'metadata' => 'sometimes|array',
            'reply_to_id' => 'sometimes|nullable|string',
        ]);
        
        $space = CollaborationSpace::findOrFail($id);
        $user = auth()->user();
        
        // Check if user is a participant
        $participation = $space->participations()
            ->where('user_id', $user->id)
            ->first();
            
        if (!$participation) {
            return response()->json([
                'message' => 'You must be a participant to send messages'
            ], 403);
        }
        
        // Update space content state
        $contentState = $space->content_state ?? [];
        $messages = $contentState['messages'] ?? [];
        
        $message = [
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'user_name' => $user->name,
            'content' => $request->content,
            'type' => $request->type ?? 'text',
            'file_path' => $request->file_path,
            'reply_to_id' => $request->reply_to_id,
            'metadata' => $request->metadata ?? [],
            'created_at' => now()->toISOString(),
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'profile_photo' => $user->profile_photo,
            ],
        ];
        
        $messages[] = $message;
        $contentState['messages'] = $messages;
        
        $space->update([
            'content_state' => $contentState,
            'updated_at' => now(),
        ]);
        
        // Update user's last active time
        $participation->update([
            'last_active_at' => now(),
        ]);
        
        // 🔔 Notify original sender if this is a reply
        if ($request->reply_to_id) {
            $origMsg = collect($messages)->firstWhere('id', $request->reply_to_id);
            if ($origMsg && data_get($origMsg, 'user_id') !== $user->id) {
                $recipient = User::find(data_get($origMsg, 'user_id'));
                if ($recipient) {
                    try {
                        \Illuminate\Support\Facades\Notification::send($recipient, 
                            new \App\Notifications\MessageRepliedNotification($user, $origMsg, $message, $space->id)
                        );
                    } catch (\Exception $e) {
                        Log::error('Reply notification failed: ' . $e->getMessage());

                    }
                }
            }
        }

        
        // ✅ FIX: Broadcast to presence channel and all participants' individual user channels
        try {
            // General presence channel for those inside the space
            broadcast(new \App\Events\MessageSent($message, $space->id, $user))->toOthers();
            
            // Individual user channels for those on the chat list page
            $participants = $space->participations->where('user_id', '!=', $user->id);
            $userIds = $participants->pluck('user_id')->toArray();
            
            if (!empty($userIds)) {
                // 1. Real-time broadcast for chat list snippet updates
                broadcast(new \App\Events\SpaceMessageSent($space->id, $userIds, $message))->toOthers();

                // 2. Persistent Database Notification for offline/header fetch
                $targetUsers = User::whereIn('id', $userIds)->get();
                \Illuminate\Support\Facades\Notification::send($targetUsers, new \App\Events\MessageSent($message, $space->id, $user));
            }
        } catch (\Exception $e) {
            Log::error('Failed to broadcast/notify message:', [
                'error' => $e->getMessage(),
                'space_id' => $space->id
            ]);
        }
        
        return response()->json([
            'message' => $message,
            'space' => $space->fresh(),
        ]);
    }

    /**
     * Delete a message for everyone (Space Owner/Moderator or Message Author)
     */
    public function deleteMessage(Request $request, $id, $messageId)
    {
        $space = CollaborationSpace::findOrFail($id);
        $user = auth()->user();

        $participation = $space->participations()->where('user_id', $user->id)->first();
        if (!$participation) {
            return response()->json(['message' => 'Not authorized'], 403);
        }

        $contentState = $space->content_state ?? [];
        $messages = $contentState['messages'] ?? [];
        
        $messageIndex = null;
        foreach ($messages as $index => $msg) {
            if (($msg['id'] ?? '') === $messageId) {
                $messageIndex = $index;
                break;
            }
        }

        if ($messageIndex === null) {
            return response()->json(['message' => 'Message not found'], 404);
        }

        $msg = $messages[$messageIndex];
        $isAuthor = ($msg['user_id'] ?? null) == $user->id;
        $isModerator = in_array($participation->role, ['owner', 'moderator']);

        if (!$isAuthor && !$isModerator) {
            return response()->json(['message' => 'Not authorized to delete this message'], 403);
        }

        // --- MEDIA CLEANUP START ---
        $filesToDelete = [];
        
        // 1. Check for single file path
        if (!empty($msg['file_path'])) {
            $filesToDelete[] = $msg['file_path'];
        }
        
        // 2. Check for album media items
        if (($msg['type'] ?? '') === 'album' && !empty($msg['metadata']['media_items'])) {
            foreach ($msg['metadata']['media_items'] as $item) {
                if (!empty($item['file_path'])) {
                    $filesToDelete[] = $item['file_path'];
                }
            }
        }
        
        // 3. Perform Deletion
        foreach (array_unique($filesToDelete) as $path) {
            // Delete from Storage
            if (Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);
            }
            // Delete Media Record
            \App\Models\Media::where('file_path', $path)->delete();
        }
        // --- MEDIA CLEANUP END ---

        // Remove the message
        array_splice($messages, $messageIndex, 1);
        $contentState['messages'] = $messages;

        $space->update([
            'content_state' => $contentState,
            'updated_at' => now(),
        ]);

        try {
            $userIds = $space->participations->where('user_id', '!==', $user->id)->pluck('user_id')->toArray();
            broadcast(new \App\Events\MessageDeleted($messageId, $space->id, $userIds))->toOthers();
        } catch (\Exception $e) {
            Log::error('Failed to broadcast message deletion: ' . $e->getMessage());
        }

        return response()->json(['success' => true]);
    }

    /**
     * Hide a message for the current user only (Local delete)
     */
    public function hideMessage(Request $request, $id, $messageId)
    {
        $space = CollaborationSpace::findOrFail($id);
        $user = auth()->user();

        $contentState = $space->content_state ?? [];
        $messages = $contentState['messages'] ?? [];
        
        $messageIndex = null;
        foreach ($messages as $index => $msg) {
            if (($msg['id'] ?? '') === $messageId) {
                $messageIndex = $index;
                break;
            }
        }

        if ($messageIndex !== null) {
            $msg = $messages[$messageIndex];
            $hiddenBy = $msg['hidden_by'] ?? [];
            if (!in_array($user->id, $hiddenBy)) {
                $hiddenBy[] = $user->id;
                $msg['hidden_by'] = $hiddenBy;
                $messages[$messageIndex] = $msg;

                $contentState['messages'] = $messages;
                $space->update(['content_state' => $contentState]);
            }
        }

        return response()->json(['success' => true]);
    }

    /**
     * Toggle reaction on a Space message
     */
    public function reactToMessage(Request $request, $id, $messageId)
    {
        $request->validate(['emoji' => 'required|string']);
        $emoji = $request->emoji;
        
        $space = CollaborationSpace::findOrFail($id);
        $user = auth()->user();

        $contentState = $space->content_state ?? [];
        $messages = $contentState['messages'] ?? [];
        
        $messageIndex = null;
        foreach ($messages as $index => $msg) {
            if (($msg['id'] ?? '') === $messageId) {
                $messageIndex = $index;
                break;
            }
        }

        if ($messageIndex === null) {
            return response()->json(['message' => 'Message not found'], 404);
        }

        $msg = $messages[$messageIndex];
        $reactions = $msg['reactions'] ?? [];
        
        // Find existing reaction from this user for this emoji
        $existingIndex = null;
        foreach ($reactions as $rIndex => $r) {
            if (($r['user_id'] ?? null) == $user->id && ($r['reaction'] ?? '') === $emoji) {
                $existingIndex = $rIndex;
                break;
            }
        }

        if ($existingIndex !== null) {
            // Remove reaction
            array_splice($reactions, $existingIndex, 1);
            $isNewReaction = false;
        } else {
            // Add reaction
            $reactions[] = [
                'user_id' => $user->id,
                'reaction' => $emoji,
                'created_at' => now()->toISOString()
            ];
            $isNewReaction = true;
        }

        $msg['reactions'] = $reactions;
        $messages[$messageIndex] = $msg;
        $contentState['messages'] = $messages;

        $space->update(['content_state' => $contentState]);

        // Trigger Notification
        if ($isNewReaction) {
            $messageOwnerId = $msg['user_id'] ?? null;
            if ($messageOwnerId && (int)$messageOwnerId !== (int)$user->id) {
                $owner = \App\Models\User::find($messageOwnerId);
                if ($owner) {
                    \Illuminate\Support\Facades\Notification::send($owner, new \App\Notifications\MessageReactedNotification($user, $msg, $emoji, $space->id));
                }
            }
        }

        try {
            broadcast(new \App\Events\MessageReacted((object)$msg, $user, $emoji, $space->id))->toOthers();
        } catch (\Exception $e) {
            Log::error('Failed to broadcast reaction: ' . $e->getMessage());
        }

        return response()->json(['success' => true, 'reactions' => $reactions]);
    }

    /**
     * Toggle Pin status for a Space message (Owner/Moderator only)
     */
    public function pinMessage(Request $request, $id, $messageId)
    {
        $space = CollaborationSpace::findOrFail($id);
        $user = auth()->user();

        $participation = $space->participations()->where('user_id', $user->id)->first();
        if (!$participation || !in_array($participation->role, ['owner', 'moderator'])) {
            return response()->json(['message' => 'Not authorized to pin messages'], 403);
        }

        $contentState = $space->content_state ?? [];
        $messages = $contentState['messages'] ?? [];
        
        $messageIndex = null;
        foreach ($messages as $index => $msg) {
            if (($msg['id'] ?? '') === $messageId) {
                $messageIndex = $index;
                break;
            }
        }

        if ($messageIndex === null) {
            return response()->json(['message' => 'Message not found'], 404);
        }

        $msg = $messages[$messageIndex];
        $isPinned = !($msg['is_pinned'] ?? false);
        $msg['is_pinned'] = $isPinned;
        
        $messages[$messageIndex] = $msg;
        $contentState['messages'] = $messages;

        $space->update(['content_state' => $contentState]);

        try {
            $userIds = $space->participations->where('user_id', '!==', $user->id)->pluck('user_id')->toArray();
            broadcast(new \App\Events\MessagePinned($messageId, $isPinned, $space->id, $userIds))->toOthers();
        } catch (\Exception $e) {
            Log::error('Failed to broadcast message pin: ' . $e->getMessage());
        }

        return response()->json(['success' => true, 'is_pinned' => $isPinned]);
    }

    /**
     * Forward one or more messages to another Space
     */
    public function forwardMessages(Request $request, $id)
    {
        $request->validate([
            'message_ids' => 'required|array',
            'destination_space_id' => 'required|exists:collaboration_spaces,id',
        ]);

        $sourceSpace = CollaborationSpace::findOrFail($id);
        $destSpace = CollaborationSpace::findOrFail($request->destination_space_id);
        $user = auth()->user();

        // Check auth in both spaces
        $sourceParticipation = $sourceSpace->participations()->where('user_id', $user->id)->first();
        if (!$sourceParticipation) {
            return response()->json(['message' => 'Not a participant in the source space'], 403);
        }

        $destParticipation = $destSpace->participations()->where('user_id', $user->id)->first();
        if (!$destParticipation) {
            return response()->json(['message' => 'Not an active participant in the destination space'], 403);
        }

        $sourceState = $sourceSpace->content_state ?? [];
        $sourceMessages = collect($sourceState['messages'] ?? []);
        
        $destState = $destSpace->content_state ?? ['messages' => []];
        $destMessages = $destState['messages'] ?? [];
        
        $forwardedCount = 0;

        foreach ($request->message_ids as $messageId) {
            $msgToForward = $sourceMessages->firstWhere('id', $messageId);
            if ($msgToForward) {
                // Clone and prep
                $newMsg = (array)$msgToForward;
                $newMsg['id'] = (string)Str::uuid();
                $newMsg['created_at'] = now()->toISOString();
                $newMsg['reactions'] = []; // strip reactions
                $newMsg['is_pinned'] = false; // strip pinned status
                
                // Add forward metadata
                $newMsg['metadata'] = array_merge($newMsg['metadata'] ?? [], [
                    'is_forwarded' => true,
                    'original_space_id' => $sourceSpace->id,
                ]);

                $destMessages[] = $newMsg;
                $forwardedCount++;

                try {
                    broadcast(new \App\Events\MessageSent($newMsg, $destSpace->id, $user))->toOthers();
                } catch (\Exception $e) {
                    Log::error('Failed to broadcast forwarded message: ' . $e->getMessage());
                }
            }
        }

        $destState['messages'] = $destMessages;
        $destSpace->update(['content_state' => $destState]);

        return response()->json([
            'success' => true, 
            'forwarded_count' => $forwardedCount
        ]);
    }

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
    //     $interaction = AIInteraction::create([
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
                'source' => 'training_data',
                'training_id' => $trainingMatch['id'],
                'response_time_ms' => $responseTime
            ];
        }

        // Fallback to rule-based response
        $ruleResponse = $this->generateRuleBasedResponse($query, $context);
        if ($ruleResponse) {
            $responseTime = (microtime(true) - $startTime) * 1000;
            return [
                'response' => $ruleResponse,
                'confidence' => 0.6,
                'source' => 'rule_engine',
                'response_time_ms' => $responseTime
            ];
        }

        // Final fallback
        return [
            'response' => "I'm still learning about this. How else can I help?",
            'confidence' => 0.1,
            'source' => 'fallback',
            'response_time_ms' => (microtime(true) - $startTime) * 1000
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
            // Tiered types
            'general' => [
                'allow_guests' => true,
                'max_participants' => 1000,
                'enable_reactions' => true,
                'enable_threads' => true,
                'require_invitation' => false,
                'privacy_tier' => 'general',
            ],
            'protected' => [
                'allow_guests' => false,
                'max_participants' => 500,
                'enable_reactions' => true,
                'enable_threads' => true,
                'require_invitation' => true,
                'privacy_tier' => 'protected',
            ],
            'channel' => [
                'allow_guests' => true,
                'max_participants' => 10000,
                'enable_reactions' => true,
                'enable_threads' => false,
                'require_invitation' => false,
                'privacy_tier' => 'channel',
                'read_only_members' => true,
            ],
            'direct' => [
                'allow_guests' => false,
                'max_participants' => 2,
                'enable_reactions' => true,
                'enable_threads' => false,
                'require_invitation' => true,
                'privacy_tier' => 'direct',
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
            'general' => ['messages' => [], 'last_message_id' => null],
            'protected' => ['messages' => [], 'last_message_id' => null],
            'channel' => ['messages' => [], 'last_message_id' => null],
            'direct' => ['messages' => [], 'last_message_id' => null],
        ];
        
        return $states[$spaceType] ?? [];
    }



    /**
     * Search across spaces, chats, contacts, messages, and posts
     */
    public function search(Request $request)
    {
        // Log::info('Search request received', $request->all());
        
        try {
            $request->validate([
                'query' => 'required|string|min:2|max:100',
                'types' => 'sometimes|array',
                'types.*' => 'in:spaces,chats,contacts,messages,posts',
                'limit' => 'sometimes|integer|min:1|max:100',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Log::error('Search validation failed', $e->errors());
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        }

        $query = $request->input('query');
        $types = $request->input('types', ['spaces', 'chats', 'contacts', 'messages', 'posts']);
        $limit = $request->input('limit', 20);
        $userId = auth()->id();

        // Log::info('Searching for', [
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
                
                // Log::info('Found spaces', ['count' => $spaces->count()]);
            } catch (\Exception $e) {
                Log::error('Error searching spaces', ['error' => $e->getMessage()]);
            }
        }

        // Search contacts (users)
        if (in_array('contacts', $types)) {
            try {
                $contacts = User::where('id', '!=', $userId)
                    ->where('is_private', '!=', 1)
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
                
                Log::info('Found contacts', ['count' => $contacts->count()]);
            } catch (\Exception $e) {
                Log::error('Error searching contacts', ['error' => $e->getMessage()]);
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
                
                Log::info('Found chats', ['count' => $chats->count()]);
            } catch (\Exception $e) {
                Log::error('Error searching chats', ['error' => $e->getMessage()]);
            }
        }

        // Sort by relevance
        usort($results, function($a, $b) {
            return $b['relevance'] <=> $a['relevance'];
        });

        // Limit results
        $results = array_slice($results, 0, $limit);

        Log::info('Search completed', [
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


    /**
     * Update participant role in a space
     */
    public function updateParticipantRole(Request $request, $id, $userId)
    {
        $request->validate([
            'role' => 'required|in:owner,moderator,participant,viewer',
        ]);

        $space = CollaborationSpace::findOrFail($id);
        $currentUser = auth()->user();

        // Check if current user has permission to change roles
        $currentParticipation = $space->participations()
            ->where('user_id', $currentUser->id)
            ->first();

        if (!$currentParticipation) {
            return response()->json([
                'message' => 'You are not a participant in this space'
            ], 403);
        }

        // Only owners and moderators can change roles
        if (!in_array($currentParticipation->role, ['owner', 'moderator'])) {
            return response()->json([
                'message' => 'You do not have permission to change roles'
            ], 403);
        }

        // Only owners can create other owners
        if ($request->role === 'owner' && $currentParticipation->role !== 'owner') {
            return response()->json([
                'message' => 'Only owners can assign the owner role'
            ], 403);
        }

        // Find the target participant
        $targetParticipation = $space->participations()
            ->where('user_id', $userId)
            ->first();

        if (!$targetParticipation) {
            return response()->json([
                'message' => 'User is not a participant in this space'
            ], 404);
        }

        // Cannot change role of owner unless you are an owner
        if ($targetParticipation->role === 'owner' && $currentParticipation->role !== 'owner') {
            return response()->json([
                'message' => 'Only owners can modify other owners'
            ], 403);
        }

        // Update the role
        $targetParticipation->update([
            'role' => $request->role,
            'permissions' => $this->getPermissionsForRole($request->role),
        ]);

        // Broadcast the change
        broadcast(new \App\Events\ParticipantUpdated($space, $targetParticipation->user, $request->role))->toOthers();

        return response()->json([
            'message' => 'Role updated successfully',
            'participant' => $targetParticipation->load('user'),
        ]);
    }

    /**
     * Get permissions for a specific role
     */
    private function getPermissionsForRole(string $role): array
    {
        $permissions = [
            'owner' => [
                'can_edit_space' => true,
                'can_invite' => true,
                'can_remove' => true,
                'can_change_roles' => true,
                'can_start_calls' => true,
                'can_share_screen' => true,
                'can_trigger_magic' => true,
                'can_configure_ai' => true,
                'can_delete_space' => true,
            ],
            'moderator' => [
                'can_edit_space' => false,
                'can_invite' => true,
                'can_remove' => true,
                'can_change_roles' => false,
                'can_start_calls' => true,
                'can_share_screen' => true,
                'can_trigger_magic' => true,
                'can_configure_ai' => false,
                'can_delete_space' => false,
            ],
            'participant' => [
                'can_edit_space' => false,
                'can_invite' => false,
                'can_remove' => false,
                'can_change_roles' => false,
                'can_start_calls' => true,
                'can_share_screen' => true,
                'can_trigger_magic' => false,
                'can_configure_ai' => false,
                'can_delete_space' => false,
            ],
            'viewer' => [
                'can_edit_space' => false,
                'can_invite' => false,
                'can_remove' => false,
                'can_change_roles' => false,
                'can_start_calls' => false,
                'can_share_screen' => false,
                'can_trigger_magic' => false,
                'can_configure_ai' => false,
                'can_delete_space' => false,
            ],
        ];

        return $permissions[$role] ?? $permissions['participant'];
    }
    /**
     * Remove a participant from a space
     */
    public function removeParticipant($id, $userId)
    {
        $space = CollaborationSpace::findOrFail($id);
        $currentUser = auth()->user();

        // Check if current user has permission to remove participants
        $currentParticipation = $space->participations()
            ->where('user_id', $currentUser->id)
            ->first();

        if (!$currentParticipation || !in_array($currentParticipation->role, ['owner', 'moderator'])) {
            return response()->json([
                'message' => 'You do not have permission to remove participants'
            ], 403);
        }

        // Cannot remove owner unless you are an owner
        $targetParticipation = $space->participations()
            ->where('user_id', $userId)
            ->first();

        if (!$targetParticipation) {
            return response()->json([
                'message' => 'User is not a participant'
            ], 404);
        }

        if ($targetParticipation->role === 'owner' && $currentParticipation->role !== 'owner') {
            return response()->json([
                'message' => 'Only owners can remove other owners'
            ], 403);
        }

        // Cannot remove yourself
        if ($userId == $currentUser->id) {
            return response()->json([
                'message' => 'Use the leave endpoint to leave the space'
            ], 400);
        }

        // Remove the participant
        $targetParticipation->delete();

        // Broadcast the removal
        broadcast(new \App\Events\ParticipantLeft($space, User::find($userId)))->toOthers();
        
        return response()->json([
            'message' => 'Participant removed successfully'
        ]);
    }

    /**
     * Set a custom user-specific property in the SpaceParticipation JSON.
     */
    private function toggleSpaceProperty($spaceId, $userId, $propertyKey)
    {
        $participation = SpaceParticipation::where('space_id', $spaceId)
            ->where('user_id', $userId)
            ->first();

        if (!$participation) {
            return false;
        }

        $permissions = is_string($participation->permissions) 
            ? json_decode($participation->permissions, true) 
            : ($participation->permissions ?? []);
        
        // Toggle the property (defaulting to false if it doesn't exist)
        $currentValue = $permissions[$propertyKey] ?? false;
        $newValue = !$currentValue;
        
        $permissions[$propertyKey] = $newValue;
        
        $participation->permissions = $permissions;
        $participation->save();

        return $newValue;
    }

    /**
     * Toggle Mute status for the current user in a space
     */
    public function muteSpace(Request $request, $id)
    {
        try {
            /** @var \App\Models\User $user */
            $user = Auth::user();
            $isMuted = $this->toggleSpaceProperty($id, $user->id, 'is_muted');
            
            if ($isMuted === false && !is_bool($isMuted)) {
                 return response()->json(['message' => 'Participation not found'], 404);
            }

            broadcast(new SpaceMuted($id, $user->id, $isMuted))->toOthers();

            return response()->json([
                'message' => $isMuted ? 'Space muted' : 'Space unmuted',
                'is_muted' => $isMuted
            ]);
        } catch (\Exception $e) {
            Log::error('Error muting space: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Toggle Archive status for the current user in a space
     */
    public function archiveSpace(Request $request, $id)
    {
        try {
            /** @var \App\Models\User $user */
            $user = Auth::user();
            $isArchived = $this->toggleSpaceProperty($id, $user->id, 'is_archived');
            
            if ($isArchived === false && !is_bool($isArchived)) {
                 return response()->json(['message' => 'Participation not found'], 404);
            }

            broadcast(new SpaceArchived($id, $user->id, $isArchived));

            return response()->json([
                'message' => $isArchived ? 'Space archived' : 'Space unarchived',
                'is_archived' => $isArchived
            ]);
        } catch (\Exception $e) {
            Log::error('Error archiving space: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Toggle Pin status for the current user in a space
     */
    public function pinSpace(Request $request, $id)
    {
        try {
            /** @var \App\Models\User $user */
            $user = Auth::user();
            $isPinned = $this->toggleSpaceProperty($id, $user->id, 'is_pinned');
            
            if ($isPinned === false && !is_bool($isPinned)) {
                 return response()->json(['message' => 'Participation not found'], 404);
            }

            broadcast(new SpacePinned($id, $user->id, $isPinned));

            return response()->json([
                'message' => $isPinned ? 'Space pinned' : 'Space unpinned',
                'is_pinned' => $isPinned
            ]);
        } catch (\Exception $e) {
            Log::error('Error pinning space: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Toggle Unread status for the current user in a space
     */
    public function markAsUnread(Request $request, $id)
    {
        try {
            /** @var \App\Models\User $user */
            $user = Auth::user();
            $isUnread = $this->toggleSpaceProperty($id, $user->id, 'is_unread');
            
            if ($isUnread === false && !is_bool($isUnread)) {
                 return response()->json(['message' => 'Participation not found'], 404);
            }

            broadcast(new SpaceMarkedUnread($id, $user->id, $isUnread));

            return response()->json([
                'message' => $isUnread ? 'Space marked as unread' : 'Space marked as read',
                'is_unread' => $isUnread
            ]);
        } catch (\Exception $e) {
            Log::error('Error marking space unread: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Mark a space as read for the current user (global sync)
     */
    public function markAsRead(Request $request, $id)
    {
        try {
            /** @var \App\Models\User $user */
            $user = Auth::user();
            $participation = SpaceParticipation::where('space_id', $id)
                ->where('user_id', $user->id)
                ->first();

            if (!$participation) {
                return response()->json(['message' => 'Participation not found'], 404);
            }

            $lastReadAt = $request->last_read_at ? new \Illuminate\Support\Carbon($request->last_read_at) : now();
            
            // Only update if the new timestamp is later than the current one
            if ($participation->last_read_at && $lastReadAt <= $participation->last_read_at && $request->last_read_at) {
                 return response()->json(['message' => 'Already read up to this point', 'last_read_at' => $participation->last_read_at]);
            }

            $participation->last_read_at = $lastReadAt;

            // Also clear the manual 'is_unread' flag if it exists
            $permissions = is_string($participation->permissions)
                ? json_decode($participation->permissions, true)
                : ($participation->permissions ?? []);
            
            if (isset($permissions['is_unread']) && $permissions['is_unread']) {
                $permissions['is_unread'] = false;
                $participation->permissions = $permissions;
            }

            $participation->save();

            broadcast(new \App\Events\SpaceRead($id, $user->id, $lastReadAt->toIso8601String()));

            return response()->json([
                'message' => 'Space marked as read',
                'last_read_at' => $lastReadAt->toIso8601String()
            ]);
        } catch (\Exception $e) {
            Log::error('Error marking space read: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }
    /**
     * Toggle Favorite status for the current user in a space
     */
    public function favoriteSpace(Request $request, $id)
    {
        try {
            /** @var \App\Models\User $user */
            $user = Auth::user();
            $isFavorite = $this->toggleSpaceProperty($id, $user->id, 'is_favorite');
            
            if ($isFavorite === false && !is_bool($isFavorite)) {
                 return response()->json(['message' => 'Participation not found'], 404);
            }

            broadcast(new \App\Events\SpaceFavorited($id, $user->id, $isFavorite));

            return response()->json([
                'message' => $isFavorite ? 'Space favorited' : 'Space unfavorited',
                'is_favorite' => $isFavorite
            ]);
        } catch (\Exception $e) {
            Log::error('Error favoriting space: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Delete a space permanently (Owner only)
     */
    public function destroy($id)
    {
        try {
            $space = CollaborationSpace::findOrFail($id);
            $user = auth()->user();

            // Check if user is the creator or has owner role
            $participation = $space->participations()->where('user_id', $user->id)->first();
            
            if ($space->creator_id !== $user->id && (!$participation || $participation->role !== 'owner')) {
                return response()->json(['message' => 'Only the owner can delete this space'], 403);
            }

            DB::beginTransaction();
            
            // 1. Delete all participations
            $space->participations()->delete();
            
            // 2. Delete magic events
            $space->magicEvents()->delete();

            // 3. Delete AI interactions
            $space->aiInteractions()->delete();

            // 4. Delete associated Media and files
            $mediaItems = \App\Models\Media::where('model_type', CollaborationSpace::class)
                ->where('model_id', $id)
                ->get();
            
            foreach ($mediaItems as $item) {
                if (Storage::disk('public')->exists($item->file_path)) {
                    Storage::disk('public')->delete($item->file_path);
                }
                $item->delete();
            }

            // Also delete the space directory entirely for speed/completeness
            Storage::disk('public')->deleteDirectory("spaces/{$id}");

            // 5. Delete linked conversation in main chat system
            if ($space->linked_conversation_id) {
                $conversation = \App\Models\Conversation::find($space->linked_conversation_id);
                if ($conversation) {
                    $conversation->messages()->delete();
                    $conversation->participants()->detach();
                    $conversation->delete();
                }
            }

            // 6. Delete Polls
            $polls = \App\Models\Poll::where('space_id', $id)->get();
            foreach ($polls as $poll) {
                $poll->votes()->delete();
                $poll->options()->delete();
                $poll->delete();
            }
            
            // Broadcast space deleted BEFORE deleting the record
            try {
                broadcast(new SpaceUpdated($space, $user->id, ['update_type' => 'deleted']));
                broadcast(new SpaceDeleted($id, $user->id));
            } catch (\Exception $e) {
                Log::warning('Broadcast failed during space deletion: ' . $e->getMessage());
            }
            
            // 6. Delete the space itself
            $space->delete();

            DB::commit();

            return response()->json(['message' => 'Space deleted forever']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting space: ' . $e->getMessage());
            return response()->json(['message' => 'Error deleting space'], 500);
        }
    }

    /**
     * Clear all messages in a space for the current user
     */
    public function clearMessages(Request $request, $id)
    {
        try {
            $space = CollaborationSpace::findOrFail($id);
            $user = auth()->user();

            $contentState = $space->content_state ?? [];
            $messages = $contentState['messages'] ?? [];
            
            $updated = false;
            foreach ($messages as &$msg) {
                $hiddenBy = $msg['hidden_by'] ?? [];
                if (!in_array($user->id, $hiddenBy)) {
                    $hiddenBy[] = $user->id;
                    $msg['hidden_by'] = $hiddenBy;
                    $updated = true;
                }
            }

            if ($updated) {
                $contentState['messages'] = $messages;
                $space->update(['content_state' => $contentState]);
            }

            return response()->json(['success' => true, 'message' => 'Chat cleared for you']);
        } catch (\Exception $e) {
            Log::error('Error clearing messages: ' . $e->getMessage());
            return response()->json(['message' => 'Error clearing chat'], 500);
        }
    }

    /**
     * Helper: Find match in chatbot_training
     */
    private function findTrainingMatch($query, $context, $action = null)
    {
        $query = strtolower(trim($query));
        $words = explode(' ', preg_replace('/[^\w\s]/', '', $query));
        
        $allTrainings = \App\Models\ChatbotTraining::where('is_active', true)->get();
        
        $bestMatch = null;
        $highestScore = 0;
        
        foreach ($allTrainings as $t) {
            $trigger = strtolower(trim($t->trigger));
            $triggerWords = explode(' ', preg_replace('/[^\w\s]/', '', $trigger));
            
            // Exact match
            if ($query === $trigger) {
                return [
                    'id' => $t->id,
                    'response' => $t->response,
                    'confidence' => 1.0
                ];
            }
            
            // Word overlap score
            $overlap = count(array_intersect($words, $triggerWords));
            $score = count($triggerWords) > 0 ? ($overlap / count($triggerWords)) : 0;
            
            // Check context match
            if ($t->context && $context && str_contains(strtolower($context), strtolower($t->context))) {
                $score += 0.2;
            }
            
            if ($score > $highestScore) {
                $highestScore = $score;
                $bestMatch = $t;
            }
        }
        
        if ($bestMatch && $highestScore > 0.5) {
            return [
                'id' => $bestMatch->id,
                'response' => $bestMatch->response,
                'confidence' => min(0.95, $highestScore)
            ];
        }
        
        return null;
    }

    /**
     * Helper: Generate rule-based response
     */
    private function generateRuleBasedResponse($query, $context)
    {
        $query = strtolower($query);
        
        if (str_contains($query, 'hello') || str_contains($query, 'hi')) {
            return "Hello! I'm your Space AI assistant. How can I help you today?";
        }
        
        if (str_contains($query, 'help')) {
            return "I can help you manage this space, summarize discussions, or answer questions based on the content here.";
        }
        
        if (str_contains($query, 'who are you')) {
            return "I am an AI assistant designed to help you collaborate more effectively in this space.";
        }
        
        return null;
    }

    /**
     * Send a system message to the space (WhatsApp style join/leave)
     */
    private function sendSystemMessage($space, $content, $metadata = [])
    {
        $contentState = $space->content_state ?? [];
        $messages = $contentState['messages'] ?? [];
        
        $message = [
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'user_id' => 0,
            'user_name' => 'System',
            'content' => $content,
            'type' => 'system',
            'created_at' => now()->toISOString(),
            'metadata' => array_merge(['is_system' => true], $metadata),
        ];
        
        $messages[] = $message;
        $contentState['messages'] = $messages;
        
        $space->update([
            'content_state' => $contentState,
            'updated_at' => now(),
        ]);
        
        try {
            // General presence channel for those inside the space
            broadcast(new \App\Events\MessageSent($message, $space->id, null))->toOthers();
            
            // Individual user channels for those on the chat list page
            foreach ($space->participations as $p) {
                broadcast(new \App\Events\SpaceMessageSent($space->id, $p->user_id, $message))->toOthers();
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('System message broadcast failed: ' . $e->getMessage());
        }
    }
}
