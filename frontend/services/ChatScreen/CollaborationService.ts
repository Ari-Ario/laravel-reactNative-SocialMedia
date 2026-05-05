import axios from "@/services/axios";
import { AxiosError } from 'axios';
import { Platform, Alert, Share } from 'react-native';
import * as Haptics from 'expo-haptics';
import getApiBase from '@/services/getApiBase';
import type PusherConstructor from 'pusher-js';
import { getToken } from "@/services/TokenService";
import PusherService, { PusherChannel, PusherEventPayload } from "@/services/PusherService";
import * as Calendar from 'expo-calendar';

export interface WhiteboardElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string | Record<string, unknown>;
  user_id?: number;
}

export interface CollaborationSpace {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  space_type: 'chat' | 'whiteboard' | 'meeting' | 'document' | 'brainstorm' | 'story' | 'voice_channel' | 'direct' | 'general' | 'protected' | 'channel';
  creator_id: number;
  settings: Record<string, unknown>;
  content_state: Record<string, unknown>;
  activity_metrics: Record<string, unknown>;
  evolution_level: number;
  unlocked_features: string[];
  is_live: boolean;
  current_focus?: string | null;
  has_ai_assistant: boolean;
  ai_personality?: string;
  ai_capabilities: string[];
  linked_conversation_id?: number;
  linked_post_id?: number;
  linked_story_id?: number;
  participants_count: number;
  creator?: {
    id: number;
    name: string;
    profile_photo?: string;
  };
  participations?: SpaceParticipation[];
  participants?: SpaceParticipation[]; // Added alias for compatibility
  other_participant?: {
    id: number;
    name: string;
    username?: string;
    profile_photo?: string;
    is_online?: boolean;
  };
  magic_events?: MagicEvent[];
  my_role?: string;
  my_permissions?: Record<string, unknown>;
  /** The current user's participation record — includes last_read_at for unread tracking */
  my_participation?: {
    last_read_at?: string | null;
    last_active_at?: string | null;
    role?: string;
  } | null;
  active_call?: Record<string, unknown>;
  active_call_id?: string; // ✅ Tracks the current broadcast ID for discovery.
  created_at?: string;
  updated_at?: string;
  is_lite?: boolean; // ✅ NEW: Tracks hydration status
  [key: string]: any;
}

export interface SpaceParticipation {
  id: number;
  space_id: string;
  user_id: number;
  role: 'owner' | 'moderator' | 'participant' | 'viewer' | 'pending';
  permissions?: Record<string, unknown>;
  presence_data?: Record<string, unknown>;
  contribution_map?: Record<string, unknown>;
  focus_areas?: string[];
  cursor_state?: Record<string, unknown>;
  audio_video_state?: Record<string, unknown>;
  current_activity?: string;
  user?: {
    id: number;
    name: string;
    profile_photo?: string;
    is_online?: boolean;
  };
}

export interface MagicEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  context: Record<string, unknown>;
  impact: Record<string, unknown>;
  has_been_discovered: boolean;
  created_at: string;
}

export interface AIInteraction {
  id: string;
  interaction_type: string;
  user_input?: string;
  ai_response: string;
  confidence_score: number;
  was_helpful?: boolean;
  space_id?: string;
  user_id?: number;
  response_time_ms?: number;
  user_feedback?: string;
  training_match_id?: number;
  context_data?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface CollaborativeActivity {
  id: number;
  space_id: string;
  created_by: number;
  activity_type: string;
  title: string;
  description?: string;
  match_type?: string;
  match_score?: number;
  scheduled_start?: string;
  scheduled_end?: string;
  is_recurring?: boolean;
  recurrence_pattern?: string;
  recurrence_interval?: number;
  recurrence_end?: string;
  timezone?: string;
  duration_minutes?: number;
  max_participants?: number;
  confirmed_participants?: number;
  status: 'proposed' | 'active' | 'completed' | 'cancelled' | 'archived' | 'scheduled';
  metadata?: Record<string, unknown>;
  outcomes?: Record<string, unknown>;
  notes?: string;
  proposed_at: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  creator?: {
    id: number;
    name: string;
    profile_photo?: string;
  };
  participants?: Record<string, unknown>[];
  participant_ids?: number[];
}

interface PusherPayload extends Record<string, unknown> {
  chat_message?: unknown;
  message?: unknown;
  type?: string;
  data?: unknown;
  space_id?: string;
  user_id?: number | string;
  id?: string;
  user?: { id: number; name?: string; profile_photo?: string };
  content_state?: Record<string, unknown>;
  poll?: unknown;
  poll_id?: string;
  is_sharing?: boolean;
  status?: number;
}

class CollaborationService {
  static setToken() {
    throw new Error('Method not implemented.');
  }
  static setUserId() {
    throw new Error('Method not implemented.');
  }
  private static instance: CollaborationService;
  private pusherService: typeof PusherService;
  private spaceSubscriptions: Map<string, PusherChannel> = new Map();
  private userToken: string | null = null;
  private baseURL: string;

  private constructor() {
    this.baseURL = getApiBase() || 'http://localhost:8000/api';
    // ✅ FIX: Use the existing PusherService singleton - DO NOT create a new one
    this.pusherService = PusherService;
  }

  static getInstance(): CollaborationService {
    if (!CollaborationService.instance) {
      CollaborationService.instance = new CollaborationService();
    }
    return CollaborationService.instance;
  }

  async setToken(token?: string) {
    this.userToken = token || await getToken();
  }

  async getHeaders() {
    if (!this.userToken) {
      this.userToken = await getToken();
    }
    return {
      Authorization: `Bearer ${this.userToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * ✅ FIXED: Just check if PusherService is ready - NEVER initialize it again
   * This prevents duplicate connections and auth errors
   */
  private async ensurePusherInitialized(): Promise<boolean> {
    try {
      // Use the imported PusherService singleton directly
      this.pusherService = PusherService;

      // ✅ FIX: Only check if it's ready - DON'T initialize
      // The PusherService is already initialized in app/(tabs)/index.tsx
      if (this.pusherService.isReady()) {
        console.log('✅ Pusher already initialized and ready (CollaborationService)');
        return true;
      }

      // ✅ FIX: If not ready, wait a bit and check again
      // This gives time for the main app to initialize Pusher
      console.log('⏳ Waiting for Pusher to be initialized...');

      // Wait up to 3 seconds for Pusher to be initialized
      for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (this.pusherService.isReady()) {
          console.log('✅ Pusher became ready after wait');
          return true;
        }
      }

      console.warn('⚠️ Pusher not ready after waiting - continuing without real-time');
      return false;
    } catch (error) {
      console.error('❌ Failed to check Pusher initialization:', error);
      return false;
    }
  }

  /**
   * ✅ FIXED: Get the pusher instance from PusherService without creating a new one
   */
  private getPusherInstance(): PusherConstructor | null {
    // Access the pusher instance from the singleton
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.pusherService as any).pusher || null;
  }

  // 🔥 CORE SPACE OPERATIONS

  async fetchUserSpaces(userId: number, lite: boolean = false): Promise<{ spaces: CollaborationSpace[]; user_preferences?: any }> {
    try {
      // ✅ Use global axios instance with relative path and automatic headers
      const response = await axios.get('/spaces', {
        params: { user_id: userId, lite: lite ? 1 : undefined }
      });

      const spaces = response.data.spaces.map((space: Record<string, unknown>) => ({
        ...space,
        participants_count: space.participants_count || 0,
        is_live: space.is_live || false,
        evolution_level: space.evolution_level || 1,
        unlocked_features: space.unlocked_features || [],
        has_ai_assistant: space.has_ai_assistant || false,
        ai_capabilities: space.ai_capabilities || [],
      }));


      return {
        spaces,
        user_preferences: response.data.user_preferences
      };
    } catch (error) {
      console.error('Error fetching spaces:', error);
      throw error;
    }
  }

  async fetchSpaceDetails(spaceId: string): Promise<CollaborationSpace> {
    try {
      console.log(`Fetching space details for: ${spaceId}`);

      const response = await axios.get(`/spaces/${spaceId}`);

      console.log('Space API response:', response.data);

      const apiSpace = response.data.space || response.data;
      const participation = response.data.participation;

      return {
        id: apiSpace.id,
        title: apiSpace.title,
        description: apiSpace.description,
        image_url: apiSpace.image_url,
        space_type: apiSpace.space_type,
        creator_id: apiSpace.creator_id,
        settings: apiSpace.settings || {},
        content_state: apiSpace.content_state || this.getInitialContentState(),
        activity_metrics: apiSpace.activity_metrics || {},
        evolution_level: apiSpace.evolution_level || 1,
        unlocked_features: apiSpace.unlocked_features || [],
        is_live: apiSpace.is_live || false,
        has_ai_assistant: apiSpace.has_ai_assistant || false,
        ai_personality: apiSpace.ai_personality,
        ai_capabilities: apiSpace.ai_capabilities || [],
        linked_conversation_id: apiSpace.linked_conversation_id,
        linked_post_id: apiSpace.linked_post_id,
        linked_story_id: apiSpace.linked_story_id,
        participants_count: response.data.participants?.length || 0,
        participants: response.data.participants || [],
        magic_events: response.data.magic_events || [],
        my_role: participation?.role,
        my_permissions: participation?.permissions,
        my_participation: participation ? {
          last_read_at: participation.last_read_at ?? null,
          last_active_at: participation.last_active_at ?? null,
          role: participation.role,
        } : null,
        creator: apiSpace.creator,
        other_participant: apiSpace.other_participant ? {
          ...apiSpace.other_participant,
          is_online: apiSpace.other_participant.is_online || false
        } : undefined,
        active_call: apiSpace.active_call,
        created_at: apiSpace.created_at,
        updated_at: apiSpace.updated_at,
      };
    } catch (error: any) {
      console.error('Error fetching space details:', (error as AxiosError).response?.data || (error as Error).message);

      if ((error as AxiosError).response?.status === 404) {
        console.log('Space not found, returning mock data for testing');
        return this.getMockSpace(spaceId);
      }

      throw error;
    }
  }

  private getInitialContentState(): Record<string, unknown> {
    return { messages: [] };
  }

  private getMockSpace(spaceId: string): CollaborationSpace {
    return {
      id: spaceId,
      title: 'Test Collaboration Space',
      description: 'A test space for development',
      space_type: 'chat',
      creator_id: 1,
      settings: {
        allow_guests: true,
        max_participants: 10,
      },
      content_state: {
        messages: [
          {
            id: '1',
            user_id: 1,
            content: 'Welcome to the collaboration space!',
            timestamp: new Date().toISOString(),
          }
        ]
      },
      activity_metrics: {},
      evolution_level: 1,
      unlocked_features: [],
      is_live: false,
      has_ai_assistant: true,
      ai_personality: 'helpful',
      ai_capabilities: ['summarize', 'suggest'],
      participants_count: 2,
      participants: [
        {
          id: 1,
          user_id: 1,
          role: 'owner',
          user: {
            id: 1,
            name: 'You',
            profile_photo: undefined,
          },
          space_id: ""
        }
      ],
      magic_events: [],
      my_role: 'owner',
      my_permissions: { can_edit: true, can_invite: true },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async triggerHapticSuccess() {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('Haptics error:', error);
    }
  }

  private async triggerHapticWarning() {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.warn('Haptics error:', error);
    }
  }

  private async triggerHapticLight() {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn('Haptics error:', error);
    }
  }

  async createSpace(spaceData: {
    title: string;
    description?: string;
    space_type: 'chat' | 'whiteboard' | 'meeting' | 'document' | 'brainstorm' | 'story' | 'voice_channel' | 'direct' | 'general' | 'protected' | 'channel';
    linked_conversation_id?: number;
    linked_post_id?: number;
    linked_story_id?: number;
    settings?: Record<string, unknown>;
    ai_personality?: string;
    ai_capabilities?: string[];
  }): Promise<CollaborationSpace> {
    try {
      const response = await axios.post('/spaces', spaceData);

      await this.triggerHapticSuccess();

      return response.data.space;
    } catch (error) {
      console.error('Error creating space:', error);
      throw error;
    }
  }

  async joinSpace(spaceId: string): Promise<{ participation: SpaceParticipation; space: CollaborationSpace }> {
    try {
      const response = await axios.post(`/spaces/${spaceId}/join`, {});

      await this.triggerHapticSuccess();

      return response.data;
    } catch (error) {
      console.error('Error joining space:', error);
      throw error;
    }
  }

  async fetchGuestSpaceInfo(spaceId: string): Promise<CollaborationSpace> {
    try {
      const response = await axios.get(`/spaces/${spaceId}/guest-info`);
      const apiSpace = response.data.space;
      return {
        id: apiSpace.id,
        title: apiSpace.title,
        description: apiSpace.description,
        image_url: apiSpace.image_url,
        space_type: apiSpace.space_type,
        creator_id: apiSpace.creator?.id || 0,
        creator: apiSpace.creator,
        settings: {},
        active_call: apiSpace.active_call,
        content_state: { messages: [] },
        activity_metrics: {},
        evolution_level: 1,
        unlocked_features: [],
        is_live: false,
        has_ai_assistant: false,
        ai_capabilities: [],
        participants_count: 0,
      };
    } catch (error) {
      console.error('Error fetching guest space info:', error);
      throw error;
    }
  }

  async joinSpaceAsGuest(spaceId: string, name: string): Promise<{ user: Record<string, unknown>, token: string, space: CollaborationSpace, participation: SpaceParticipation }> {
    try {
      const response = await axios.post(`/spaces/${spaceId}/guest-join`, { name });
      return response.data;
    } catch (error) {
      console.error('Error joining as guest:', error);
      throw error;
    }
  }

  async joinSpaceAsViewer(spaceId: string): Promise<{ user: Record<string, unknown>, token: string, space: CollaborationSpace, participation: SpaceParticipation }> {
    try {
      const response = await axios.post(`/spaces/${spaceId}/viewer-join`, {});
      return response.data;
    } catch (error) {
      console.error('Error joining as viewer:', error);
      throw error;
    }
  }

  async inviteToSpace(spaceId: string, userIds: number[], role?: string, message?: string): Promise<void> {
    try {
      const response = await axios.post(`/spaces/${spaceId}/invite`, {
        user_ids: userIds,
        role,
        message,
      });

      console.log('Invitation response:', response.data);

      try {
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (hapticsError) {
        console.warn('Haptics feedback failed:', hapticsError);
      }

    } catch (error: any) {
      console.error('Error inviting to space:', (error as AxiosError).response?.data || (error as Error).message);

      if ((error as AxiosError).response?.status === 403) {
        throw new Error('You do not have permission to invite users to this space');
      }

      throw error;
    }
  }

  async acceptSpaceInvitation(spaceId: string): Promise<Record<string, unknown>> {
    try {
      const response = await axios.post(`/spaces/${spaceId}/accept-invitation`, {});

      try {
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (hapticsError) {
        console.warn('Haptics feedback failed:', hapticsError);
      }

      return response.data;
    } catch (error) {
      console.error('Error accepting space invitation:', error);
      throw error;
    }
  }

  async sendAudioMessage(spaceId: string, formData: FormData): Promise<Record<string, unknown>> {
    try {
      // Use axios for multipart upload
      const response = await axios.post(`/spaces/${spaceId}/audio-message`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      await this.triggerHapticSuccess();
      return response.data;
    } catch (error: any) {
      console.error('Error sending audio message:', (error as AxiosError).response?.data || (error as Error).message);
      throw error;
    }
  }

  async clearChat(spaceId: string): Promise<void> {
    try {
      await axios.post(`/spaces/${spaceId}/clear-messages`, {});
      await this.triggerHapticLight();
    } catch (error) {
      console.error('Error clearing chat:', error);
      throw error;
    }
  }

  /**
   * Fetch trending/popular messages across user's conversations
   */
  async fetchChatHighlights(page: number = 1, limit: number = 10): Promise<{
    messages: Record<string, unknown>[],
    current_page: number,
    has_more: boolean,
    total: number
  }> {
    try {
      const response = await axios.get('/messages/highlights', {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching chat highlights:', error);
      throw error;
    }
  }

  // Poll management
  async createPoll(spaceId: string, pollData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/polls`, pollData, {
        headers: await this.getHeaders(),
      });
      await this.triggerHapticSuccess();
      return response.data.poll;
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  }

  async updatePoll(spaceId: string, pollId: string, pollData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const response = await axios.put(`${this.baseURL}/spaces/${spaceId}/polls/${pollId}`, pollData, {
        headers: await this.getHeaders(),
      });
      await this.triggerHapticSuccess();
      return response.data.poll;
    } catch (error) {
      console.error('Error updating poll:', error);
      throw error;
    }
  }

  async getPolls(spaceId: string): Promise<Record<string, unknown>[]> {
    try {
      const response = await axios.get(`${this.baseURL}/spaces/${spaceId}/polls`, {
        headers: await this.getHeaders(),
      });
      return response.data.polls;
    } catch (error: any) {
      if ((error as AxiosError).response?.status === 403) {
        console.warn('📡 Access denied to polls for space:', spaceId);
        return [];
      }
      console.error('Error fetching polls:', error);
      throw error;
    }
  }

  async voteOnPoll(spaceId: string, pollId: string, optionIds: string[]): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/polls/${pollId}/vote`, {
        option_ids: optionIds,
      }, {
        headers: await this.getHeaders(),
      });
      await this.triggerHapticLight();
    } catch (error) {
      console.error('Error voting on poll:', error);
      throw error;
    }
  }

  async closePoll(spaceId: string, pollId: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/polls/${pollId}/close`, {}, {
        headers: await this.getHeaders(),
      });
      await this.triggerHapticWarning();
    } catch (error) {
      console.error('Error closing poll:', error);
      throw error;
    }
  }

  async forwardPoll(pollId: string, targetSpaceIds: string[]): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/polls/${pollId}/forward`, {
        target_space_ids: targetSpaceIds,
      }, {
        headers: await this.getHeaders(),
      });
      await this.triggerHapticSuccess();
    } catch (error) {
      console.error('Error forwarding poll:', error);
      throw error;
    }
  }

  async getPollResults(spaceId: string, pollId: string): Promise<Record<string, unknown>> {
    try {
      const response = await axios.get(`${this.baseURL}/spaces/${spaceId}/polls/${pollId}/results`, {
        headers: await this.getHeaders(),
      });
      return response.data.results;
    } catch (error) {
      console.error('Error fetching poll results:', error);
      throw error;
    }
  }

  async updateUserPreferences(preferences: { custom_tabs?: any[]; theme_preference?: string; locale?: string }): Promise<void> {
    try {
      await axios.post('/update-preferences', preferences);
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  /**
   * Delete a poll permanently
   * @param spaceId - The ID of the space containing the poll
   * @param pollId - The ID of the poll to delete
   */
  async deletePoll(spaceId: string, pollId: string): Promise<void> {
    try {
      // Using DELETE HTTP method for deletion
      const response = await axios.delete(`${this.baseURL}/spaces/${spaceId}/polls/${pollId}`, {
        headers: await this.getHeaders(),
      });

      // Provide haptic feedback for deletion (warning style)
      await this.triggerHapticWarning();

      console.log(`Poll ${pollId} deleted successfully from space ${spaceId}`);

      return response.data;
    } catch (error: any) {
      console.error('Error deleting poll:', (error as AxiosError).response?.data || (error as Error).message);

      // Handle specific error cases
      if ((error as AxiosError).response?.status === 403) {
        throw new Error('You do not have permission to delete this poll');
      } else if ((error as AxiosError).response?.status === 404) {
        throw new Error('Poll not found or already deleted');
      } else if ((error as AxiosError).response?.status === 400) {
        throw new Error(((error as AxiosError).response?.data as Record<string, unknown>)?.message as string || 'Cannot delete this poll');
      }

      throw new Error(((error as AxiosError).response?.data as Record<string, unknown>)?.message as string || 'Failed to delete poll');
    }
  }
  // Map to store callbacks by space ID and then by consumer ID (e.g. 'root' or 'message-list')
  private spaceCallbacks: Map<string, Map<string, { [key: string]: (data: Record<string, unknown>) => void }>> = new Map();

  async subscribeToSpace(spaceId: string, consumerId: string, callbacks: {
    onSpaceUpdate?: (data: Record<string, unknown>) => void;
    onParticipantJoined?: (data: Record<string, unknown>) => void;
    onParticipantLeft?: (data: Record<string, unknown>) => void;
    onParticipantUpdate?: (data: Record<string, unknown>) => void;
    onMessage?: (data: Record<string, unknown>) => void;
    onContentUpdate?: (contentState: Record<string, unknown>) => void;
    onMagicEvent?: (event: Record<string, unknown>) => void;
    onVoiceActivity?: (data: Record<string, unknown>) => void;
    onMessageSent?: (data: Record<string, unknown>) => void;
    onWebRTCOffer?: (data: Record<string, unknown>) => void;
    onWebRTCAnswer?: (data: Record<string, unknown>) => void;
    onWebRTCIceCandidate?: (data: Record<string, unknown>) => void;
    onWebRTCSignal?: (data: Record<string, unknown>) => void;
    onWebRTCJoin?: (data: Record<string, unknown>) => void;
    onCallStarted?: (data: Record<string, unknown>) => void;
    onCallEnded?: (data: Record<string, unknown>) => void;
    onScreenShareStarted?: (data: Record<string, unknown>) => void;
    onScreenShareEnded?: (data: Record<string, unknown>) => void;
    onMuteStateChanged?: (data: Record<string, unknown>) => void;
    onvideoStateChanged?: (data: Record<string, unknown>) => void;
    onScreenShareToggled?: (data: Record<string, unknown>) => void;
    onMagicTriggered?: (data: Record<string, unknown>) => void;
    onPollCreated?: (poll: Record<string, unknown>) => void;
    onPollUpdated?: (poll: Record<string, unknown>) => void;
    onPollDeleted?: (poll: Record<string, unknown>) => void;
    onMessageDeleted?: (data: Record<string, unknown>) => void;
    onMessagePinned?: (data: Record<string, unknown>) => void;
    onMessageReacted?: (data: Record<string, unknown>) => void;
    onMessageReplied?: (data: Record<string, unknown>) => void;
    onSpaceRead?: (data: Record<string, unknown>) => void;
    onSpaceDeleted?: (data: Record<string, unknown>) => void;
    onActivityCreated?: (data: Record<string, unknown>) => void;
    onActivityUpdated?: (data: Record<string, unknown>) => void;
    onActivityDeleted?: (data: Record<string, unknown>) => void;
  }) {
    if (!callbacks) {
      console.warn(`📡 subscribeToSpace called without callbacks in space ${spaceId}`);
      return;
    }
    try {
      const initialized = await this.ensurePusherInitialized();
      if (!initialized) {
        console.warn('📡 Pusher not ready for space subscription - retrying in 2s');
        setTimeout(() => this.subscribeToSpace(spaceId, consumerId, callbacks), 2000);
        return;
      }

      const pusher = this.getPusherInstance();
      if (!pusher) return;

      const channelName = `presence-space-${spaceId}`;
      let channel = this.spaceSubscriptions.get(spaceId);

      if (!channel) {
        console.log(`🔌 Channel: Subscribing to: ${channelName}`);
        channel = pusher.subscribe(channelName);
        this.spaceSubscriptions.set(spaceId, channel);
      } else {
        console.log(`🔌 Channel: Already subscribed to ${spaceId}. Binding callbacks for ${consumerId}`);
      }

      // Initialize callbacks map for this space
      if (!this.spaceCallbacks.has(spaceId)) {
        this.spaceCallbacks.set(spaceId, new Map());
      }

      // If consumer already has callbacks, unbind them to prevent duplicates
      const existingCallbacks = this.spaceCallbacks.get(spaceId)!.get(consumerId);
      if (existingCallbacks && channel) {
        Object.keys(existingCallbacks).forEach(eventName => {
          channel!.unbind(eventName, existingCallbacks[eventName]);
        });
      }

      // Create handler mappings
      const handlers: { [key: string]: (data: PusherPayload) => void } = {
        'message-sent': (data: PusherPayload) => {
          const normalized = { ...data, message: data.chat_message || data.message };
          callbacks.onMessage?.(normalized as Record<string, unknown>);
        },
        'space-message': (data: PusherPayload) => {
          const normalized = { ...data, message: data.chat_message || data.message };
          callbacks.onMessage?.(normalized as Record<string, unknown>);
        },
        'webrtc-signal': (data: PusherPayload) => callbacks.onWebRTCSignal?.(data as Record<string, unknown>),
        'call-participant-active': (data: PusherPayload) => callbacks.onWebRTCJoin?.(data as Record<string, unknown>),
        'call-started': (data: PusherPayload) => {
          const notification = {
            ...data,
            type: data.type || 'call_started',
            data: data.data || {},
            space_id: data.space_id || spaceId,
            user_id: data.user_id || 0,
            id: data.id || Date.now().toString(),
          };
          callbacks.onCallStarted?.(notification as Record<string, unknown>);
        },
        'call-ended': (data: PusherPayload) => {
          const notification = {
            ...data,
            type: data.type || 'call_ended',
            data: data.data || {},
            space_id: data.space_id || spaceId,
            user_id: data.user_id || 0,
            id: data.id || Date.now().toString(),
          };
          callbacks.onCallEnded?.(notification as Record<string, unknown>);
        },
        'magic-triggered': (data: PusherPayload) => {
          callbacks.onMagicEvent?.(data as Record<string, unknown>);
          callbacks.onMagicTriggered?.(data as Record<string, unknown>);
        },
        'space-updated': (data: PusherPayload) => callbacks.onSpaceUpdate?.(data as Record<string, unknown>),
        'space-read': (data: PusherPayload) => callbacks.onSpaceRead?.(data as Record<string, unknown>),
        'space-deleted': (data: PusherPayload) => callbacks.onSpaceDeleted?.(data as Record<string, unknown>),
        'participant-joined': (data: PusherPayload) => {
          const normalized = { ...data, user_id: data.user?.id || data.user_id };
          callbacks.onParticipantJoined?.(normalized as Record<string, unknown>);
          callbacks.onParticipantUpdate?.(normalized as Record<string, unknown>);
        },
        'participant-left': (data: PusherPayload) => {
          const normalized = { ...data, user_id: data.user?.id || data.user_id };
          callbacks.onParticipantLeft?.(normalized as Record<string, unknown>);
          callbacks.onParticipantUpdate?.(normalized as Record<string, unknown>);
        },
        'message-reacted': (data: PusherPayload) => callbacks.onMessageReacted?.(data as Record<string, unknown>),
        'message-deleted': (data: PusherPayload) => callbacks.onMessageDeleted?.(data as Record<string, unknown>),
        'message-pinned': (data: PusherPayload) => callbacks.onMessagePinned?.(data as Record<string, unknown>),
        'message-replied': (data: PusherPayload) => callbacks.onMessageReplied?.(data as Record<string, unknown>),
        'content-updated': (data: PusherPayload) => callbacks.onContentUpdate?.((data.content_state || data) as Record<string, unknown>),
        'poll-created': (data: PusherPayload) => callbacks.onPollCreated?.((data.poll || data) as Record<string, unknown>),
        'poll-updated': (data: PusherPayload) => callbacks.onPollUpdated?.((data.poll || data) as Record<string, unknown>),
        'poll-deleted': (data: PusherPayload) => callbacks.onPollDeleted?.({ poll_id: data.poll_id } as Record<string, unknown>),
        'mute-state-changed': (data: PusherPayload) => callbacks.onMuteStateChanged?.(data as Record<string, unknown>),
        'video-state-changed': (data: PusherPayload) => callbacks.onvideoStateChanged?.(data as Record<string, unknown>),
        'screen-share-toggled': (data: PusherPayload) => {
          if (data.is_sharing) {
            callbacks.onScreenShareStarted?.({ user_id: data.user_id?.toString() } as Record<string, unknown>);
          } else {
            callbacks.onScreenShareEnded?.({ user_id: data.user_id?.toString() } as Record<string, unknown>);
          }
          callbacks.onScreenShareToggled?.(data as Record<string, unknown>);
        },
        // ✅ ACTIVITY EVENTS
        'activity-created': (data: PusherPayload) => callbacks.onActivityCreated?.(data as Record<string, unknown>),
        'activity-updated': (data: PusherPayload) => callbacks.onActivityUpdated?.(data as Record<string, unknown>),
        'activity-deleted': (data: PusherPayload) => callbacks.onActivityDeleted?.(data as Record<string, unknown>),
        'pusher:subscription_error': (err: PusherPayload) => {
          if (err.status === 403) {
            console.warn(`📡 Channel authorization denied for space: ${spaceId}. User might not be a participant yet. Clearing stale channel object.`);
            this.spaceSubscriptions.delete(spaceId);
          } else {
            console.error(`❌ Channel: Subscription failed for: ${spaceId}:`, err);
          }
        }
      };

      // Bind all handlers to the channel
      Object.keys(handlers).forEach(eventName => {
        channel!.bind(eventName, handlers[eventName]);
      });

      // Save handlers so they can be explicitly unbound later
      this.spaceCallbacks.get(spaceId)!.set(consumerId, handlers);

    } catch (error) {
      console.error('❌ Error in subscribeToSpace:', error);
    }
  }

  async unsubscribeFromSpace(spaceId: string, consumerId?: string) {
    try {
      const pusher = this.getPusherInstance();
      if (!pusher) return;

      const channel = this.spaceSubscriptions.get(spaceId);
      if (!channel) return;

      if (consumerId) {
        // Unbind specific consumer
        const consumerHandlers = this.spaceCallbacks.get(spaceId)?.get(consumerId);
        if (consumerHandlers) {
          Object.keys(consumerHandlers).forEach(eventName => {
            channel.unbind(eventName, consumerHandlers[eventName]);
          });
          this.spaceCallbacks.get(spaceId)!.delete(consumerId);
          console.log(`📡 Unbound callbacks for consumer ${consumerId} in space ${spaceId}`);
        }

        // Fully unsubscribe IF there are no more listeners
        if (this.spaceCallbacks.get(spaceId)?.size === 0) {
          channel.unbind_all();
          pusher.unsubscribe(`presence-space-${spaceId}`);
          this.spaceSubscriptions.delete(spaceId);
          this.spaceCallbacks.delete(spaceId);
          console.log(`📡 Fully unsubscribed from space ${spaceId} (no more listeners)`);
        }
      } else {
        // Force unsubscribe completely (legacy fallback)
        channel.unbind_all();
        pusher.unsubscribe(`presence-space-${spaceId}`);
        this.spaceSubscriptions.delete(spaceId);
        this.spaceCallbacks.delete(spaceId);
        console.log(`📡 Fully unsubscribed from space ${spaceId} (forced)`);
      }
    } catch (error) {
      console.error('Error unsubscribing from space:', error);
    }
  }

  async updateContentState(spaceId: string, contentState: Record<string, unknown>): Promise<void> {
    try {
      await axios.put(`${this.baseURL}/spaces/${spaceId}/content`, {
        content_state: contentState,
      }, {
        headers: await this.getHeaders(),
      });

      this.broadcastContentUpdate(spaceId, contentState);
      await this.triggerHapticSuccess();

    } catch (error) {
      console.error('Error updating content state:', error);
      throw error;
    }
  }

  async updateCursorPosition(spaceId: string, cursorState: unknown): Promise<void> {
    try {
      await axios.put(`${this.baseURL}/spaces/${spaceId}/cursor`, {
        cursor_state: cursorState,
      }, {
        headers: await this.getHeaders(),
      });

      this.broadcastCursorUpdate(spaceId, cursorState);
    } catch (error) {
      console.error('Error updating cursor:', error);
      throw error;
    }
  }

  // 🔥 SPACE MANAGEMENT ACTIONS (Mute, Archive, Pin, Read Status)

  async muteSpace(spaceId: string): Promise<{ is_muted: boolean }> {
    try {
      const response = await axios.post(
        `${this.baseURL}/spaces/${spaceId}/mute`,
        {},
        { headers: await this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error muting space:', error);
      throw error;
    }
  }

  async archiveSpace(spaceId: string): Promise<{ is_archived: boolean }> {
    try {
      const response = await axios.post(
        `${this.baseURL}/spaces/${spaceId}/archive`,
        {},
        { headers: await this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error archiving space:', error);
      throw error;
    }
  }

  async pinSpace(spaceId: string): Promise<{ is_pinned: boolean }> {
    try {
      const response = await axios.post(
        `${this.baseURL}/spaces/${spaceId}/pin`,
        {},
        { headers: await this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error pinning space:', error);
      throw error;
    }
  }

  async markAsUnread(spaceId: string): Promise<{ is_unread: boolean }> {
    try {
      const response = await axios.post(
        `${this.baseURL}/spaces/${spaceId}/unread`,
        {},
        { headers: await this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error marking space as unread:', error);
      throw error;
    }
  }

  async markAsRead(spaceId: string, lastReadAt?: string): Promise<{ message: string; last_read_at: string }> {
    try {
      const response = await axios.post(
        `${this.baseURL}/spaces/${spaceId}/mark-as-read`,
        { last_read_at: lastReadAt },
        { headers: await this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error marking space as read:', error);
      throw error;
    }
  }

  async favoriteSpace(spaceId: string): Promise<{ is_favorite: boolean }> {
    try {
      const response = await axios.post(
        `${this.baseURL}/spaces/${spaceId}/favorite`,
        {},
        { headers: await this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error favoriting space:', error);
      throw error;
    }
  }

  // 📞 VOICE/VIDEO CALLS

  async startCall(spaceId: string, callType: 'audio' | 'video' | 'screen_share'): Promise<unknown> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/start-call`, {
        call_type: callType,
      }, {
        headers: await this.getHeaders(),
      });

      return response.data;
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }

  async joinWebRTCCall(spaceId: string): Promise<unknown> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/call/join`, {}, {
        headers: await this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error joining WebRTC call:', error);
      throw error;
    }
  }

  async sendWebRTCSignal(spaceId: string, signalData: unknown): Promise<void> {
    try {
      // ✅ Payload Size Guard: Log warnings for large payloads to help debug Pusher 10KB limits
      const payloadString = JSON.stringify(signalData);
      const sizeBytes = payloadString.length;
      if (sizeBytes > 8000) {
        console.warn(`⚠️ Large WebRTC Signal detected (${sizeBytes} bytes) for space ${spaceId}. SDP thinning might be required.`);
      }

      await axios.post(`${this.baseURL}/spaces/${spaceId}/call/signal`, signalData, {
        headers: await this.getHeaders(),
      });
    } catch (error) {
      console.error('Error sending WebRTC signal:', error);
      throw error;
    }
  }

  async toggleCallMute(spaceId: string, callId: string, isMuted: boolean): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/call/mute`, {
        call_id: callId,
        is_muted: isMuted,
      }, {
        headers: await this.getHeaders(),
      });
    } catch (error) {
      console.error('Error toggling call mute:', error);
      throw error;
    }
  }

  async toggleCallVideo(spaceId: string, callId: string, hasVideo: boolean): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/call/video`, {
        call_id: callId,
        has_video: hasVideo,
      }, {
        headers: await this.getHeaders(),
      });
    } catch (error) {
      console.error('Error toggling call video:', error);
      throw error;
    }
  }

  async toggleCallScreenShare(spaceId: string, callId: string, isSharing: boolean): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/call/screen-share`, {
        call_id: callId,
        is_sharing: isSharing,
      }, {
        headers: await this.getHeaders(),
      });
    } catch (error) {
      console.error('Error toggling call screen share:', error);
      throw error;
    }
  }

  async endCall(spaceId: string, callId: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/end-call`, {
        call_id: callId,
      }, {
        headers: await this.getHeaders(),
      });
    } catch (error) {
      console.error('Error ending call:', error);
      throw error;
    }
  }

  // ─── Incoming Call: Reject API ──────────────────────────────────────────────
  async rejectCall(spaceId: string, callId: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/call/${callId}/reject`, {}, {
        headers: await this.getHeaders(),
      });
      console.log('📞 Call rejected via API');
    } catch (error) {
      // Rejection is best-effort; swallow errors so UI isn't blocked
      console.warn('📞 Could not notify backend of call rejection (non-fatal):', error);
    }
  }

  // ─── Incoming Call: Client-side observer pattern ────────────────────────────
  private incomingCallListeners: Array<(data: unknown) => void> = [];

  /**
   * Register a callback to be notified when a `call.started` event arrives on
   * the user's private Pusher channel and concerns a direct space call meant
   * for this user.  Called by PusherService after it receives `call.started`.
   */
  onIncomingCall(callback: (data: unknown) => void): void {
    if (!this.incomingCallListeners.includes(callback)) {
      this.incomingCallListeners.push(callback);
    }
  }

  offIncomingCall(callback: (data: unknown) => void): void {
    this.incomingCallListeners = this.incomingCallListeners.filter(cb => cb !== callback);
  }

  /** Called internally (by PusherService notification handler) */
  emitIncomingCall(data: unknown): void {
    console.log('📞 Emitting incoming call to', this.incomingCallListeners.length, 'listener(s)');
    this.incomingCallListeners.forEach(cb => {
      try { cb(data); } catch (e) { console.error('incomingCall listener error:', e); }
    });
  }

  async toggleScreenShare(spaceId: string, isSharing: boolean): Promise<void> {
    try {
      await axios.put(`${this.baseURL}/spaces/${spaceId}/screen-share`, {
        is_sharing: isSharing,
      }, {
        headers: await this.getHeaders(),
      });

      this.broadcastScreenShareState(spaceId, isSharing);
    } catch (error) {
      console.error('Error toggling screen share:', error);
      throw error;
    }
  }

  // 🤖 AI ASSISTANT

  async queryAI(spaceId: string, query: string, context?: Record<string, unknown>, action?: string): Promise<AIInteraction> {
    try {
      if (spaceId === 'global' || !spaceId) {
        console.log('Using mock AI response for global space');
        return this.getMockAIResponse(query, context, action);
      }

      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/ai-query`, {
        query,
        context,
        action,
      }, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticSuccess();

      return {
        ...response.data,
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error querying AI:', error);
      return this.getMockAIResponse(query, context, action);
    }
  }

  private getMockAIResponse(query: string, context?: Record<string, unknown>, action?: string): AIInteraction {
    const mockResponses: Record<string, string> = {
      'brainstorm': "Let's brainstorm! How about we explore: 1) Customer journey mapping, 2) SWOT analysis, 3) Mind mapping our key ideas?",
      'story-continue': "As the team ventured deeper into the digital realm, they discovered that their collective thoughts began to manifest as shimmering structures around them...",
      'problem-solve': "To solve this, consider: 1) Breaking it into smaller parts, 2) Looking at it from different perspectives, 3) Gathering more data before deciding.",
      'design-thinking': "For design thinking: 1) Empathize with users, 2) Define the core problem, 3) Ideate solutions, 4) Prototype, 5) Test and iterate.",
      'alternate_perspectives': "Three perspectives:\n1. The Optimist: Everything works perfectly\n2. The Pragmatist: What's realistically achievable\n3. The Innovator: Radical new approaches",
      'start_story': "In a world where collaboration created reality, a group discovered their shared thoughts could shape their environment...",
    };

    let response = mockResponses[action || ''] ||
      "I'm here to help with your creative collaboration! Based on your context, I suggest focusing on clear communication and regular check-ins.";

    if (query.toLowerCase().includes('perspective') || action === 'generate_perspectives') {
      response = mockResponses['alternate_perspectives'];
    }

    if (query.toLowerCase().includes('story') || action === 'start_story') {
      response = mockResponses['start_story'];
    }

    return {
      id: `mock_${Date.now()}`,
      space_id: 'global',
      user_id: 0,
      interaction_type: action || 'query',
      user_input: query,
      ai_response: response,
      training_match_id: undefined,
      context_data: context,
      was_helpful: undefined,
      user_feedback: undefined,
      confidence_score: 0.85,
      response_time_ms: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async getAISuggestions(spaceId: string): Promise<unknown[]> {
    try {
      const response = await axios.get(`${this.baseURL}/spaces/${spaceId}/ai-suggestions`, {
        headers: await this.getHeaders(),
      });

      return response.data.suggestions;
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      throw error;
    }
  }

  async provideAIFeedback(interactionId: string, wasHelpful: boolean, feedback?: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/ai/interactions/${interactionId}/feedback`, {
        was_helpful: wasHelpful,
        feedback,
      }, {
        headers: await this.getHeaders(),
      });
    } catch (error) {
      console.error('Error providing AI feedback:', error);
      throw error;
    }
  }

  async triggerMagicEvent(spaceId: string, eventType: string, data?: Record<string, unknown>): Promise<MagicEvent> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/magic`, {
        event_type: eventType,
        data,
      }, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticWarning();

      return response.data.event;
    } catch (error) {
      console.error('Error triggering magic event:', error);
      throw error;
    }
  }

  async discoverMagicEvent(eventId: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/magic-events/${eventId}/discover`, {}, {
        headers: await this.getHeaders(),
      });
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error discovering magic event:', error);
      throw error;
    }
  }

  // 🎯 POST/STORY INTEGRATION

  async makePostCollaborative(postId: number, options: {
    contribution_guidelines?: string;
    allowed_collaborators?: number[];
    space_type?: string;
  }): Promise<CollaborationSpace> {
    try {
      const response = await axios.post(`${this.baseURL}/posts/${postId}/make-collaborative`, options, {
        headers: await this.getHeaders(),
      });
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      return response.data.space;
    } catch (error) {
      console.error('Error making post collaborative:', error);
      throw error;
    }
  }

  async addVoiceAnnotation(postId: number, audioUri: string, timestamp?: number, note?: string): Promise<unknown> {
    try {
      const formData = new FormData();
      formData.append('audio_file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: `voice-annotation-${Date.now()}.m4a`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      if (timestamp) formData.append('timestamp', timestamp.toString());
      if (note) formData.append('note', note);

      const response = await axios.post(`${this.baseURL}/posts/${postId}/add-voice-annotation`, formData, {
        headers: {
          ...(await this.getHeaders()),
          'Content-Type': 'multipart/form-data',
        },
      });
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      return response.data.annotation;
    } catch (error) {
      console.error('Error adding voice annotation:', error);
      throw error;
    }
  }

  async createPostBranch(postId: number, changes: Record<string, unknown>, title: string, description?: string): Promise<Record<string, unknown>> {
    try {
      const response = await axios.post(`${this.baseURL}/posts/${postId}/create-branch`, {
        title,
        changes,
        description,
      }, {
        headers: await this.getHeaders(),
      });
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      return response.data.branch;
    } catch (error) {
      console.error('Error creating post branch:', error);
      throw error;
    }
  }

  async makeStoryCollaborative(storyId: number, options: {
    branch_options?: unknown[];
    interactive_elements?: unknown[];
    space_type?: string;
  }): Promise<CollaborationSpace> {
    try {
      const response = await axios.post(`${this.baseURL}/stories/${storyId}/make-collaborative`, options, {
        headers: await this.getHeaders(),
      });
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      return response.data.space;
    } catch (error) {
      console.error('Error making story collaborative:', error);
      throw error;
    }
  }

  async addToStoryChain(storyId: number, mediaPath: string, caption?: string, branchChoice?: string): Promise<unknown> {
    try {
      const response = await axios.post(`${this.baseURL}/stories/${storyId}/add-to-chain`, {
        media_path: mediaPath,
        caption,
        branch_choice: branchChoice,
      }, {
        headers: await this.getHeaders(),
      });
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      return response.data.new_story;
    } catch (error) {
      console.error('Error adding to story chain:', error);
      throw error;
    }
  }

  // 🛠️ PRIVATE HELPERS

  /**
   * ❌ REMOVED: initializePusher method - we use PusherService instead
   * This prevents duplicate connections
   */
  private initializePusher() {
    console.warn('⚠️ initializePusher is deprecated - using PusherService instead');
    // Do nothing - we use PusherService
  }

  private broadcastContentUpdate(spaceId: string, contentState: unknown) {
    const channel = this.spaceSubscriptions.get(spaceId);
    if (channel) {
      channel.trigger?.('client-content-update', {
        content_state: contentState,
        updated_at: new Date().toISOString(),
        user_id: this.getCurrentUserId(),
      });
    }
  }

  private broadcastCursorUpdate(spaceId: string, cursorState: unknown) {
    const channel = this.spaceSubscriptions.get(spaceId);
    if (channel) {
      channel.trigger?.('client-cursor-update', {
        cursor_state: cursorState,
        user_id: this.getCurrentUserId(),
        timestamp: Date.now(),
      });
    }
  }

  private broadcastScreenShareState(spaceId: string, isSharing: boolean) {
    const channel = this.spaceSubscriptions.get(spaceId);
    if (channel) {
      channel.trigger?.('client-screen-share', {
        is_sharing: isSharing,
        user_id: this.getCurrentUserId(),
        timestamp: Date.now(),
      });
    }
  }

  private getCurrentUserId(): number {
    return 0;
  }

  // 🔍 UTILITIES

  async checkForEmergence(spaceId: string): Promise<boolean> {
    try {
      const space = await this.fetchSpaceDetails(spaceId);
      const { activity_metrics, participants_count } = space;

      const ametrics = activity_metrics as any;
      const conditions = [
        participants_count >= 3 && (ametrics?.energy_level || 0) > 70,
        ametrics?.total_interactions > 50,
        new Date().getHours() >= 22 || new Date().getHours() <= 6,
      ];

      if (conditions.some(condition => condition)) {
        await this.triggerMagicEvent(spaceId, 'emergence_check', {
          conditions_met: conditions.filter(c => c),
          energy_level: activity_metrics?.energy_level,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking for emergence:', error);
      return false;
    }
  }

  async enhancePostWithAI(postId: number): Promise<unknown> {
    try {
      const response = await axios.get(`${this.baseURL}/ai/posts/${postId}/enhance`, {
        headers: await this.getHeaders(),
      });

      return response.data;
    } catch (error) {
      console.error('Error enhancing post with AI:', error);
      throw error;
    }
  }

  async suggestStoryContinuation(storyId: number): Promise<unknown> {
    try {
      const response = await axios.get(`${this.baseURL}/ai/stories/${storyId}/continue`, {
        headers: await this.getHeaders(),
      });

      return response.data;
    } catch (error) {
      console.error('Error suggesting story continuation:', error);
      throw error;
    }
  }

  // 🎯 COLLABORATIVE ACTIVITIES
  async getGlobalActivities(params: { status?: string, type?: string, per_page?: number, page?: number } = {}): Promise<{ activities: CollaborativeActivity[], upcoming_count: number, total: number }> {
    try {
      const response = await axios.get(`${this.baseURL}/collaborative-activities`, {
        headers: await this.getHeaders(),
        params
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching global activities:', error);
      throw error;
    }
  }

  async getSpaceActivities(spaceId: string, page = 1, limit = 20): Promise<{
    activities: CollaborativeActivity[];
    upcoming_count: number;
    total: number;
    current_page: number;
    last_page: number;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/collaborative-activities`, {
        headers: await this.getHeaders(),
        params: { space_id: spaceId, page, per_page: limit }
      });

      return {
        activities: response.data.activities,
        upcoming_count: response.data.upcoming_count,
        total: response.data.total,
        current_page: response.data.current_page,
        last_page: response.data.last_page
      };
    } catch (error: any) {
      console.log('Silently handled Space Activities fetch error (likely due to guest privilege restrictions):', error?.message);
      return { activities: [], upcoming_count: 0, total: 0, current_page: 1, last_page: 1 };
    }
  }

  async createCollaborativeActivity(activityData: {
    space_id: string;
    activity_type: string;
    title: string;
    description?: string;
    scheduled_start?: string;
    scheduled_end?: string;
    is_recurring?: boolean;
    recurrence_pattern?: string;
    recurrence_interval?: number;
    timezone?: string;
    duration_minutes?: number;
    max_participants?: number;
    participant_ids?: number[];
    metadata?: unknown;
  }): Promise<CollaborativeActivity> {
    try {
      const response = await axios.post(`${this.baseURL}/collaborative-activities`, activityData, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticSuccess();

      return response.data.activity;
    } catch (error) {
      console.error('Error creating collaborative activity:', error);
      throw error;
    }
  }

  async updateCollaborativeActivity(activityId: number, activityData: unknown): Promise<CollaborativeActivity> {
    try {
      const response = await axios.put(`${this.baseURL}/collaborative-activities/${activityId}`, activityData, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticSuccess();

      return response.data.activity;
    } catch (error) {
      console.error('Error updating collaborative activity:', error);
      throw error;
    }
  }

  /**
   * Delete a collaborative activity permanently
   * @param activityId - The ID of the activity to delete
   */
  async deleteCollaborativeActivity(activityId: number): Promise<void> {
    try {
      const response = await axios.delete(`${this.baseURL}/collaborative-activities/${activityId}`, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticWarning();
      console.log(`✅ Activity ${activityId} deleted successfully`);

      return response.data;
    } catch (error: any) {
      console.error('Error deleting collaborative activity:', error.response?.data || error.message);

      const errorMessage = error.response?.data?.message || 'Failed to delete activity';
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to delete this activity');
      } else if (error.response?.status === 404) {
        throw new Error('Activity not found');
      }

      throw new Error(errorMessage);
    }
  }

  async updateActivityStatus(activityId: number, data: {
    status: 'proposed' | 'active' | 'completed' | 'cancelled' | 'archived' | 'scheduled';
    notes?: string;
    actual_duration?: number;
    outcomes?: unknown;
  }): Promise<CollaborativeActivity> {
    try {
      const response = await axios.post(`${this.baseURL}/collaborative-activities/${activityId}/status`, data, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticLight();

      return response.data.activity;
    } catch (error) {
      console.error('Error updating activity status:', error);
      throw error;
    }
  }

  async updateActivityParticipants(activityId: number, data: {
    participant_ids: number[];
    action: 'add' | 'remove' | 'set';
  }): Promise<CollaborativeActivity> {
    try {
      const response = await axios.post(`${this.baseURL}/collaborative-activities/${activityId}/participants`, data, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticLight();

      return response.data.activity;
    } catch (error) {
      console.error('Error updating activity participants:', error);
      throw error;
    }
  }

  async getSpaceActivityStatistics(spaceId: string): Promise<unknown> {
    try {
      const response = await axios.get(`${this.baseURL}/collaborative-activities/space/${spaceId}/statistics`, {
        headers: await this.getHeaders(),
      });

      return response.data.statistics;
    } catch (error) {
      console.error('Error fetching activity statistics:', error);
      throw error;
    }
  }

  async exportToExternalCalendar(activity: CollaborativeActivity): Promise<boolean> {
    const frontendHost = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    const deepLink = `${frontendHost}/${activity.space_id}?activity=${activity.id}`;

    if (Platform.OS === 'web') {
      const start = activity.scheduled_start ? new Date(activity.scheduled_start) : new Date();
      const end = activity.scheduled_end ? new Date(activity.scheduled_end) : new Date(start.getTime() + 60 * 60 * 1000);

      const title = encodeURIComponent(activity.title);
      const description = encodeURIComponent(`${activity.description || ''}\n\nJoin Session: ${deepLink}`);
      const location = encodeURIComponent(deepLink);

      const googleUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${description}&location=${location}&dates=${start.toISOString().replace(/-|:|\.\d\d\d/g, "")}/${end.toISOString().replace(/-|:|\.\d\d\d/g, "")}`;

      window.open(googleUrl, '_blank');
      return true;
    }

    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please enable calendar access in settings to export activities.');
        return false;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(cal => cal.isPrimary) || calendars[0];

      if (!defaultCalendar) {
        Alert.alert('No calendar found', 'Could not find a default calendar on your device.');
        return false;
      }

      const startDate = activity.scheduled_start ? new Date(activity.scheduled_start) : new Date();
      const endDate = activity.scheduled_end ? new Date(activity.scheduled_end) : new Date(startDate.getTime() + (activity.duration_minutes || 60) * 60 * 1000);

      await Calendar.createEventAsync(defaultCalendar.id, {
        title: activity.title,
        startDate,
        endDate,
        notes: `${activity.description || ''}\n\nJoin Session: ${deepLink}`,
        location: deepLink,
        timeZone: activity.timezone || 'UTC',
      });

      await this.triggerHapticSuccess();
      Alert.alert('Success', 'Activity added to your calendar.');
      return true;
    } catch (error) {
      console.error('Error exporting to calendar:', error);
      Alert.alert('Error', 'Failed to add activity to calendar.');
      return false;
    }
  }

  async exportToICS(activity: CollaborativeActivity, spaceTitle?: string): Promise<boolean> {
    const frontendHost = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    const deepLink = `${frontendHost}/${activity.space_id}?activity=${activity.id}`;

    try {
      const startTime = activity.scheduled_start ? new Date(activity.scheduled_start) : new Date();
      const endTime = activity.scheduled_end ? new Date(activity.scheduled_end) : new Date(startTime.getTime() + (activity.duration_minutes || 60) * 60 * 1000);

      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//YourApp//Space Calendar//EN
BEGIN:VEVENT
UID:${activity.id}@space${activity.space_id}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${endTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:${activity.title}
DESCRIPTION:${activity.description || ''}\\n\\nJoin Session: ${deepLink}
LOCATION:Space: ${spaceTitle || 'Collaboration Space'}\\nDeep Link: ${deepLink}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

      if (Platform.OS === 'web') {
        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activity.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          title: 'Export Session',
          message: icsContent,
        });
      }

      await this.triggerHapticSuccess();
      return true;
    } catch (error) {
      console.error('Error exporting ICS:', error);
      Alert.alert('Export Error', 'Failed to export calendar file');
      return false;
    }
  }

  // Message handling functions
  async sendMessage(spaceId: string, messageData: {
    content: string;
    type?: 'text' | 'image' | 'video' | 'file' | 'voice' | 'poll' | 'album' | 'post_share' | 'story_share' | 'location' | 'live_location';
    file_path?: string;
    metadata?: unknown;
    reply_to_id?: string;
  }): Promise<unknown> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/send-message`, messageData, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticSuccess();

      return response.data.message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // ==== Space Message Context Menu Actions ====

  async deleteSpaceMessage(spaceId: string, messageId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/spaces/${spaceId}/messages/${messageId}`, {
        headers: await this.getHeaders(),
      });
    } catch (error) {
      console.error('Error deleting space message:', error);
      throw error;
    }
  }

  async hideSpaceMessage(spaceId: string, messageId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/spaces/${spaceId}/messages/${messageId}/local`, {
        headers: await this.getHeaders(),
      });
    } catch (error) {
      console.error('Error hiding space message locally:', error);
      throw error;
    }
  }

  async forwardSpaceMessages(sourceSpaceId: string, messageIds: string[], destinationSpaceId: string): Promise<unknown> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${sourceSpaceId}/messages/forward`, {
        message_ids: messageIds,
        destination_space_id: destinationSpaceId
      }, {
        headers: await this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error forwarding space messages:', error);
      throw error;
    }
  }

  async getUserSpaces(userId: number): Promise<unknown> {
    try {
      const response = await axios.get(`${this.baseURL}/users/${userId}/spaces`, {
        headers: await this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user spaces:', error);
      throw error;
    }
  }

  async reactToSpaceMessage(spaceId: string, messageId: string, emoji: string): Promise<unknown> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/messages/${messageId}/react`, {
        emoji,
      }, {
        headers: await this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error reacting to space message:', error);
      throw error;
    }
  }

  async pinSpaceMessage(spaceId: string, messageId: string): Promise<Record<string, unknown>> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/messages/${messageId}/pin`, {}, {
        headers: await this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error pinning space message:', error);
      throw error;
    }
  }

  // ==== Standard Message Actions ====


  async reactToMessage(messageId: string, reaction: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/messages/${messageId}/react`, {
        reaction,
      }, {
        headers: await this.getHeaders(),
      });
    } catch (error) {
      console.error('Error reacting to message:', error);
      throw error;
    }
  }

  async getMessageReactions(messageId: string): Promise<Record<string, unknown>[]> {
    try {
      const response = await axios.get(`${this.baseURL}/messages/${messageId}/reactions`, {
        headers: await this.getHeaders(),
      });

      return response.data.reactions;
    } catch (error) {
      console.error('Error getting message reactions:', error);
      throw error;
    }
  }

  getGroupedReactions(post: Record<string, unknown> | null) {
    if (!post || !post['reactions']) return [];
    const reactions = (post['reactions'] as { reaction: string, user_id?: number }[]) || [];
    if (!reactions || !Array.isArray(reactions)) return [];

    const groups: { [key: string]: { emoji: string, count: number, user_ids: number[] } } = {};

    reactions.forEach((r: { reaction: string, user_id?: number }) => {
      if (!groups[r.reaction]) {
        groups[r.reaction] = { emoji: r.reaction, count: 0, user_ids: [] };
      }
      groups[r.reaction].count++;
      if (r.user_id) groups[r.reaction].user_ids.push(Number(r.user_id));
    });

    return Object.values(groups);
  }

  // handling 3 dot menu on (spaces)/[id].tsx

  async updateSpace(spaceId: string, data: {
    title?: string;
    description?: string;
    space_type?: string;
    settings?: Record<string, unknown>;
    ai_personality?: string;
    ai_capabilities?: string[];
  }): Promise<CollaborationSpace> {
    try {
      const response = await axios.put(`${this.baseURL}/spaces/${spaceId}`, data, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticSuccess();

      return response.data.space;
    } catch (error) {
      console.error('Error updating space:', error);
      throw error;
    }
  }

  async updateParticipantRole(spaceId: string, userId: number, role: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/participants/${userId}/role`, {
        role,
      }, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticSuccess();
    } catch (error) {
      console.error('Error updating participant role:', error);
      throw error;
    }
  }

  async removeParticipant(spaceId: string, userId: number): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/spaces/${spaceId}/participants/${userId}`, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticWarning();
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  async leaveSpace(spaceId: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/leave`, {}, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticWarning();
    } catch (error) {
      console.error('Error leaving space:', error);
      throw error;
    }
  }

  async deleteSpace(spaceId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/spaces/${spaceId}`, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticWarning();
    } catch (error) {
      console.error('Error deleting space:', error);
      throw error;
    }
  }

  async uploadSpacePhoto(spaceId: string, photoUri: string): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('photo', {
        uri: photoUri,
        type: 'image/jpeg',
        name: `space-${spaceId}-${Date.now()}.jpg`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/photo`, formData, {
        headers: {
          ...(await this.getHeaders()),
          'Content-Type': 'multipart/form-data',
        },
      });

      await this.triggerHapticSuccess();

      return response.data.photo_url;
    } catch (error) {
      console.error('Error uploading space photo:', error);
      throw error;
    }
  }


  // Whiteboard real-time methods
  subscribeToWhiteboard(spaceId: string, callbacks: {
    onElementAdded?: (element: WhiteboardElement) => void;
    onElementUpdated?: (element: WhiteboardElement) => void;
    onElementRemoved?: (elementId: string) => void;
    onCursorMoved?: (userId: number, x: number, y: number, userName?: string) => void;
    onClear?: () => void;
    onUserJoined?: (userId: number, userName: string) => void;
    onUserLeft?: (userId: number) => void;
  }) {
    const channelName = `presence-space-${spaceId}`;

    // Ensure Pusher is initialized
    if (!this.pusherService?.isReady()) {
      console.warn('Pusher not ready for whiteboard subscription');
      return () => { };
    }

    const pusher = this.getPusherInstance();
    if (!pusher) return () => { };

    const channel = pusher.subscribe(channelName);

    if (callbacks.onElementAdded) {
      channel.bind('whiteboard-element-added', callbacks.onElementAdded);
    }

    if (callbacks.onElementUpdated) {
      channel.bind('whiteboard-element-updated', callbacks.onElementUpdated);
    }

    if (callbacks.onElementRemoved) {
      channel.bind('whiteboard-element-removed', callbacks.onElementRemoved);
    }

    if (callbacks.onCursorMoved) {
      channel.bind('whiteboard-cursor-moved', callbacks.onCursorMoved);
    }

    if (callbacks.onClear) {
      channel.bind('whiteboard-cleared', callbacks.onClear);
    }

    if (callbacks.onUserJoined) {
      channel.bind('whiteboard-user-joined', callbacks.onUserJoined);
    }

    if (callbacks.onUserLeft) {
      channel.bind('whiteboard-user-left', callbacks.onUserLeft);
    }

    return () => {
      channel.unbind_all();
      this.pusherService?.unsubscribeFromChannel(channelName);
    };
  }

  async addWhiteboardElement(spaceId: string, element: WhiteboardElement) {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/whiteboard/elements`, element, {
        headers: await this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error adding whiteboard element:', error);
      throw error;
    }
  }

  async updateWhiteboardElement(spaceId: string, element: WhiteboardElement) {
    try {
      const response = await axios.put(`${this.baseURL}/spaces/${spaceId}/whiteboard/elements/${element.id}`, element, {
        headers: await this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error updating whiteboard element:', error);
      throw error;
    }
  }

  async removeWhiteboardElement(spaceId: string, elementId: string) {
    try {
      const response = await axios.delete(`${this.baseURL}/spaces/${spaceId}/whiteboard/elements/${elementId}`, {
        headers: await this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error removing whiteboard element:', error);
      throw error;
    }
  }

  async clearWhiteboard(spaceId: string) {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/whiteboard/clear`, {}, {
        headers: await this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error clearing whiteboard:', error);
      throw error;
    }
  }

  async sendCursorPosition(spaceId: string, x: number, y: number) {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/whiteboard/cursor`, {
        x,
        y,
      }, {
        headers: await this.getHeaders(),
      });
    } catch (error) {
      // Silent fail for cursor updates - not critical
      console.debug('Cursor update failed:', error);
    }
  }

  async sendMessageToUser(userId: number, data: {
    content: string,
    type: string,
    metadata?: Record<string, unknown>,
    file_path?: string,
    mime_type?: string
  }): Promise<unknown> {
    try {
      const response = await axios.post(`${this.baseURL}/messages/forward-to-user`, {
        target_user_id: userId,
        ...data
      }, {
        headers: await this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error sending message to user:', error);
      throw error;
    }
  }
  async getOrCreateDirectSpace(userId: number | string): Promise<Record<string, unknown>> {
    try {
      const response = await axios.get(`${this.baseURL}/spaces/direct/${userId}`, {
        headers: await this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error getting or creating direct space:', error);
      throw error;
    }
  }

}

export default CollaborationService;
