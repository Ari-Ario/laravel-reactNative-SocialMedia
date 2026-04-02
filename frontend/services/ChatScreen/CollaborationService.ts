import axios from "@/services/axios";
import { Platform, Alert, Share } from 'react-native';
import * as Haptics from 'expo-haptics';
import getApiBase from '@/services/getApiBase';
import type PusherConstructor from 'pusher-js';
import { getToken } from "@/services/TokenService";
import PusherService from "@/services/PusherService";
import * as Calendar from 'expo-calendar';

export interface WhiteboardElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: any;
  user_id?: number;
}

export interface CollaborationSpace {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  space_type: 'chat' | 'whiteboard' | 'meeting' | 'document' | 'brainstorm' | 'story' | 'voice_channel' | 'direct' | 'general' | 'protected' | 'channel';
  creator_id: number;
  settings: any;
  content_state: any;
  activity_metrics: any;
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
  };
  magic_events?: any[];
  my_role?: string;
  my_permissions?: any;
  /** The current user's participation record — includes last_read_at for unread tracking */
  my_participation?: {
    last_read_at?: string | null;
    last_active_at?: string | null;
    role?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface SpaceParticipation {
  id: number;
  space_id: string;
  user_id: number;
  role: 'owner' | 'moderator' | 'participant' | 'viewer' | 'pending';
  permissions?: any;
  presence_data?: any;
  contribution_map?: any;
  focus_areas?: string[];
  cursor_state?: any;
  audio_video_state?: any;
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
  event_data: any;
  context: any;
  impact: any;
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
  context_data?: any;
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
  metadata?: any;
  outcomes?: any;
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
  participants?: any[];
  participant_ids?: number[];
}

class CollaborationService {
  static setToken(token: Promise<any>) {
    throw new Error('Method not implemented.');
  }
  static setUserId(id: Promise<any>) {
    throw new Error('Method not implemented.');
  }
  private static instance: CollaborationService;
  private pusherService: typeof PusherService;
  private spaceSubscriptions: Map<string, any> = new Map();
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

  async setToken(token: string) {
    this.userToken = await getToken();
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
    return (this.pusherService as any).pusher || null;
  }

  // 🔥 CORE SPACE OPERATIONS

  async fetchUserSpaces(userId: number): Promise<{ spaces: CollaborationSpace[]; user_preferences?: any }> {
    try {
      const response = await axios.get(`${this.baseURL}/spaces`, {
        headers: await this.getHeaders(),
        params: { user_id: userId }
      });

      const spaces = response.data.spaces.map((space: any) => ({
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
    if (!this.userToken) {
      const token = await getToken();
      if (token) {
        this.userToken = token;
      } else {
        throw new Error('No authentication token available');
      }
    }

    try {
      console.log(`Fetching space details for: ${spaceId}`);

      const response = await axios.get(`${this.baseURL}/spaces/${spaceId}`, {
        headers: await this.getHeaders(),
      });

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
        content_state: apiSpace.content_state || this.getInitialContentState(apiSpace.space_type),
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
        other_participant: apiSpace.other_participant,
        created_at: apiSpace.created_at,
        updated_at: apiSpace.updated_at,
      };
    } catch (error: any) {
      console.error('Error fetching space details:', error.response?.data || error.message);

      if (error.response?.status === 404) {
        console.log('Space not found, returning mock data for testing');
        return this.getMockSpace(spaceId);
      }

      throw error;
    }
  }

  private getInitialContentState(spaceType: string): any {
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
    settings?: any;
    ai_personality?: string;
    ai_capabilities?: string[];
  }): Promise<CollaborationSpace> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces`, spaceData, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticSuccess();

      return response.data.space;
    } catch (error) {
      console.error('Error creating space:', error);
      throw error;
    }
  }

  async joinSpace(spaceId: string): Promise<{ participation: SpaceParticipation; space: CollaborationSpace }> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/join`, {}, {
        headers: await this.getHeaders(),
      });

      await this.triggerHapticSuccess();

      return response.data;
    } catch (error) {
      console.error('Error joining space:', error);
      throw error;
    }
  }

  async fetchGuestSpaceInfo(spaceId: string): Promise<CollaborationSpace> {
    try {
      const response = await axios.get(`${this.baseURL}/spaces/${spaceId}/guest-info`);
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

  async joinSpaceAsGuest(spaceId: string, name: string): Promise<{ user: any, token: string, space: CollaborationSpace, participation: SpaceParticipation }> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/guest-join`, { name });
      return response.data;
    } catch (error) {
      console.error('Error joining as guest:', error);
      throw error;
    }
  }

  async inviteToSpace(spaceId: string, userIds: number[], role?: string, message?: string): Promise<void> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/invite`, {
        user_ids: userIds,
        role,
        message,
      }, {
        headers: await this.getHeaders(),
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
      console.error('Error inviting to space:', error.response?.data || error.message);

      if (error.response?.status === 403) {
        throw new Error('You do not have permission to invite users to this space');
      }

      throw error;
    }
  }

  async acceptSpaceInvitation(spaceId: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/accept-invitation`, {}, {
        headers: await this.getHeaders(),
      });

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

  async clearChat(spaceId: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/clear-messages`, {}, {
        headers: await this.getHeaders(),
      });
      await this.triggerHapticLight();
    } catch (error) {
      console.error('Error clearing chat:', error);
      throw error;
    }
  }

  // Poll management
  async createPoll(spaceId: string, pollData: any): Promise<any> {
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

  async updatePoll(spaceId: string, pollId: string, pollData: any): Promise<any> {
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

  async getPolls(spaceId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseURL}/spaces/${spaceId}/polls`, {
        headers: await this.getHeaders(),
      });
      return response.data.polls;
    } catch (error: any) {
      if (error.response?.status === 403) {
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

  async getPollResults(spaceId: string, pollId: string): Promise<any> {
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
      await axios.post(`${this.baseURL}/update-preferences`, preferences, {
        headers: await this.getHeaders(),
      });
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
      console.error('Error deleting poll:', error.response?.data || error.message);

      // Handle specific error cases
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to delete this poll');
      } else if (error.response?.status === 404) {
        throw new Error('Poll not found or already deleted');
      } else if (error.response?.status === 400) {
        throw new Error(error.response.data.message || 'Cannot delete this poll');
      }

      throw new Error(error.response?.data?.message || 'Failed to delete poll');
    }
  }
  // Map to store callbacks by space ID and then by consumer ID (e.g. 'root' or 'message-list')
  private spaceCallbacks: Map<string, Map<string, { [key: string]: Function }>> = new Map();

  async subscribeToSpace(spaceId: string, consumerId: string, callbacks: {
    onSpaceUpdate?: (data: any) => void;
    onParticipantJoined?: (data: any) => void;
    onParticipantLeft?: (data: any) => void;
    onParticipantUpdate?: (data: any) => void;
    onMessage?: (data: any) => void;
    onContentUpdate?: (contentState: any) => void;
    onMagicEvent?: (event: any) => void;
    onVoiceActivity?: (data: any) => void;
    onMessageSent?: (data: any) => void;
    onWebRTCOffer?: (data: any) => void;
    onWebRTCAnswer?: (data: any) => void;
    onWebRTCIceCandidate?: (data: any) => void;
    onWebRTCSignal?: (data: any) => void;
    onWebRTCJoin?: (data: any) => void;
    onCallStarted?: (data: any) => void;
    onCallEnded?: (data: any) => void;
    onScreenShareStarted?: (data: any) => void;
    onScreenShareEnded?: (data: any) => void;
    onMuteStateChanged?: (data: any) => void;
    onvideoStateChanged?: (data: any) => void;
    onScreenShareToggled?: (data: any) => void;
    onMagicTriggered?: (data: any) => void;
    onPollCreated?: (poll: any) => void;
    onPollUpdated?: (poll: any) => void;
    onPollDeleted?: (poll: any) => void;
    onMessageDeleted?: (data: any) => void;
    onMessagePinned?: (data: any) => void;
    onMessageReacted?: (data: any) => void;
    onMessageReplied?: (data: any) => void;
    onSpaceRead?: (data: any) => void;
    onSpaceDeleted?: (data: any) => void;
    onActivityCreated?: (data: any) => void;
    onActivityUpdated?: (data: any) => void;
    onActivityDeleted?: (data: any) => void;
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
      const handlers: { [key: string]: Function } = {
        'message-sent': (data: any) => {
          const normalized = { ...data, message: data.chat_message || data.message };
          callbacks.onMessage?.(normalized);
        },
        'space-message': (data: any) => {
          const normalized = { ...data, message: data.chat_message || data.message };
          callbacks.onMessage?.(normalized);
        },
        'webrtc-signal': (data: any) => callbacks.onWebRTCSignal?.(data),
        'call-participant-active': (data: any) => callbacks.onWebRTCJoin?.(data),
        'call-started': (data: any) => {
          const notification = {
            ...data,
            type: data.type || 'call_started',
            title: data.title || 'Incoming Call',
            message: data.message && typeof data.message === 'string' ? data.message : `${data.user?.name || 'Someone'} is calling you...`,
            spaceId: data.space_id,
            callId: data.call?.id,
            userId: data.user?.id,
            avatar: data.profile_photo || data.user?.profile_photo,
          };
          callbacks.onCallStarted?.(notification);
        },
        'call-ended': (data: any) => {
          const notification = {
            ...data,
            type: data.type || 'call_ended',
            title: data.title || 'Call Ended',
            message: data.message || 'The call has ended',
            spaceId: data.space_id,
            callId: data.call?.id,
            avatar: data.profile_photo || data.user?.profile_photo,
          };
          callbacks.onCallEnded?.(notification);
        },
        'magic-triggered': (data: any) => {
          callbacks.onMagicEvent?.(data);
          callbacks.onMagicTriggered?.(data);
        },
        'space-updated': (data: any) => callbacks.onSpaceUpdate?.(data),
        'space-read': (data: any) => callbacks.onSpaceRead?.(data),
        'space-deleted': (data: any) => callbacks.onSpaceDeleted?.(data),
        'participant-joined': (data: any) => {
          const normalized = { ...data, user_id: data.user?.id || data.user_id };
          callbacks.onParticipantJoined?.(normalized);
          callbacks.onParticipantUpdate?.(normalized);
        },
        'participant-left': (data: any) => {
          const normalized = { ...data, user_id: data.user?.id || data.user_id };
          callbacks.onParticipantLeft?.(normalized);
          callbacks.onParticipantUpdate?.(normalized);
        },
        'message-reacted': (data: any) => callbacks.onMessageReacted?.(data),
        'message-deleted': (data: any) => callbacks.onMessageDeleted?.(data),
        'message-pinned': (data: any) => callbacks.onMessagePinned?.(data),
        'message-replied': (data: any) => callbacks.onMessageReplied?.(data),
        'content-updated': (data: any) => callbacks.onContentUpdate?.(data.content_state || data),
        'poll-created': (data: any) => callbacks.onPollCreated?.(data.poll || data),
        'poll-updated': (data: any) => callbacks.onPollUpdated?.(data.poll || data),
        'poll-deleted': (data: any) => callbacks.onPollDeleted?.(data.poll_id),
        'mute-state-changed': (data: any) => callbacks.onMuteStateChanged?.(data),
        'video-state-changed': (data: any) => callbacks.onvideoStateChanged?.(data),
        'screen-share-toggled': (data: any) => {
          callbacks.onScreenShareStarted?.(data.user_id);
          callbacks.onScreenShareToggled?.(data);
        },
        // ✅ ACTIVITY EVENTS
        'activity-created': (data: any) => callbacks.onActivityCreated?.(data),
        'activity-updated': (data: any) => callbacks.onActivityUpdated?.(data),
        'activity-deleted': (data: any) => callbacks.onActivityDeleted?.(data),
        'pusher:subscription_error': (err: any) => {
          if (err?.status === 403) {
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

  async updateContentState(spaceId: string, contentState: any): Promise<void> {
    try {
      const response = await axios.put(`${this.baseURL}/spaces/${spaceId}/content`, {
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

  async updateCursorPosition(spaceId: string, cursorState: any): Promise<void> {
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

  async startCall(spaceId: string, callType: 'audio' | 'video' | 'screen_share'): Promise<any> {
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

  async joinWebRTCCall(spaceId: string): Promise<any> {
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

  async sendWebRTCSignal(spaceId: string, signalData: any): Promise<void> {
    try {
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
  private incomingCallListeners: Array<(data: any) => void> = [];

  /**
   * Register a callback to be notified when a `call.started` event arrives on
   * the user's private Pusher channel and concerns a direct space call meant
   * for this user.  Called by PusherService after it receives `call.started`.
   */
  onIncomingCall(callback: (data: any) => void): void {
    if (!this.incomingCallListeners.includes(callback)) {
      this.incomingCallListeners.push(callback);
    }
  }

  offIncomingCall(callback: (data: any) => void): void {
    this.incomingCallListeners = this.incomingCallListeners.filter(cb => cb !== callback);
  }

  /** Called internally (by PusherService notification handler) */
  emitIncomingCall(data: any): void {
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

  async queryAI(spaceId: string, query: string, context?: any, action?: string): Promise<AIInteraction> {
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

  private getMockAIResponse(query: string, context?: any, action?: string): AIInteraction {
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

  async getAISuggestions(spaceId: string): Promise<any[]> {
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

  // 🔮 MAGIC EVENTS

  async triggerMagicEvent(spaceId: string, eventType: string, data?: any): Promise<MagicEvent> {
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

  async addVoiceAnnotation(postId: number, audioUri: string, timestamp?: number, note?: string): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('audio_file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: `voice-annotation-${Date.now()}.m4a`,
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

  async createPostBranch(postId: number, changes: any, title: string, description?: string): Promise<any> {
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
    branch_options?: any[];
    interactive_elements?: any[];
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

  async addToStoryChain(storyId: number, mediaPath: string, caption?: string, branchChoice?: string): Promise<any> {
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

  private broadcastContentUpdate(spaceId: string, contentState: any) {
    const channel = this.spaceSubscriptions.get(spaceId);
    if (channel) {
      channel.trigger('client-content-update', {
        content_state: contentState,
        updated_at: new Date().toISOString(),
        user_id: this.getCurrentUserId(),
      });
    }
  }

  private broadcastCursorUpdate(spaceId: string, cursorState: any) {
    const channel = this.spaceSubscriptions.get(spaceId);
    if (channel) {
      channel.trigger('client-cursor-update', {
        cursor_state: cursorState,
        user_id: this.getCurrentUserId(),
        timestamp: Date.now(),
      });
    }
  }

  private broadcastScreenShareState(spaceId: string, isSharing: boolean) {
    const channel = this.spaceSubscriptions.get(spaceId);
    if (channel) {
      channel.trigger('client-screen-share', {
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
      const { activity_metrics, participants_count, evolution_level } = space;

      const conditions = [
        participants_count >= 3 && (activity_metrics?.energy_level || 0) > 70,
        activity_metrics?.total_interactions > 50,
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

  async enhancePostWithAI(postId: number): Promise<any> {
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

  async suggestStoryContinuation(storyId: number): Promise<any> {
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
    metadata?: any;
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

  async updateCollaborativeActivity(activityId: number, activityData: any): Promise<CollaborativeActivity> {
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
    outcomes?: any;
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

  async getSpaceActivityStatistics(spaceId: string): Promise<any> {
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
    metadata?: any;
    reply_to_id?: string;
  }): Promise<any> {
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

  async forwardSpaceMessages(sourceSpaceId: string, messageIds: string[], destinationSpaceId: string): Promise<any> {
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

  async getUserSpaces(userId: number): Promise<any> {
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

  async reactToSpaceMessage(spaceId: string, messageId: string, emoji: string): Promise<any> {
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

  async pinSpaceMessage(spaceId: string, messageId: string): Promise<any> {
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

  async getMessageReactions(messageId: string): Promise<any[]> {
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

  getGroupedReactions(post: any, userId?: number) {
    const reactions = post?.reactions || [];
    if (!reactions || !Array.isArray(reactions)) return [];

    const groups: { [key: string]: { emoji: string, count: number, user_ids: number[] } } = {};

    reactions.forEach((r: any) => {
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
    settings?: any;
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
    metadata?: any,
    file_path?: string,
    mime_type?: string
  }): Promise<any> {
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
  async getOrCreateDirectSpace(userId: number | string): Promise<any> {
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
