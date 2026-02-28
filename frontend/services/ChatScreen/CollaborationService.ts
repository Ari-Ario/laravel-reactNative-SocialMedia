import axios from "@/services/axios";
import { Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import getApiBase from '@/services/getApiBase';
import type PusherConstructor from 'pusher-js';
import { getToken } from "@/services/TokenService";
import PusherService from "@/services/PusherService";

export interface CollaborationSpace {
  id: string;
  title: string;
  description?: string;
  space_type: 'chat' | 'whiteboard' | 'meeting' | 'document' | 'brainstorm' | 'story' | 'voice_channel';
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
  magic_events?: any[];
  my_role?: string;
  my_permissions?: any;
  created_at?: string;
  updated_at?: string;
}

export interface SpaceParticipation {
  id: number;
  space_id: string;
  user_id: number;
  role: 'owner' | 'moderator' | 'participant' | 'viewer';
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
  scheduled_start: any;
  duration_minutes: number;
  id: number;
  space_id: string;
  created_by: number;
  activity_type: string;
  title: string;
  description?: string;
  match_type?: string;
  match_score?: number;
  suggested_duration?: number;
  actual_duration?: number;
  status: 'proposed' | 'active' | 'completed' | 'cancelled' | 'archived';
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

  getHeaders() {
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

  async fetchUserSpaces(userId: number): Promise<CollaborationSpace[]> {
    try {
      const response = await axios.get(`${this.baseURL}/spaces`, {
        headers: this.getHeaders(),
        params: { user_id: userId }
      });

      return response.data.spaces.map((space: any) => ({
        ...space,
        participants_count: space.participants_count || 0,
        is_live: space.is_live || false,
        evolution_level: space.evolution_level || 1,
        unlocked_features: space.unlocked_features || [],
        has_ai_assistant: space.has_ai_assistant || false,
        ai_capabilities: space.ai_capabilities || [],
      }));
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
        headers: this.getHeaders(),
      });

      console.log('Space API response:', response.data);

      const apiSpace = response.data.space || response.data;
      const participation = response.data.participation;

      return {
        id: apiSpace.id,
        title: apiSpace.title,
        description: apiSpace.description,
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
        creator: apiSpace.creator,
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
    space_type: 'chat' | 'whiteboard' | 'meeting' | 'document' | 'brainstorm' | 'story' | 'voice_channel';
    linked_conversation_id?: number;
    linked_post_id?: number;
    linked_story_id?: number;
    settings?: any;
    ai_personality?: string;
    ai_capabilities?: string[];
  }): Promise<CollaborationSpace> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces`, spaceData, {
        headers: this.getHeaders(),
      });

      await this.triggerHapticSuccess();

      return response.data.space;
    } catch (error) {
      console.error('Error creating space:', error);
      throw error;
    }
  }

  async joinSpace(spaceId: string): Promise<SpaceParticipation> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/join`, {}, {
        headers: this.getHeaders(),
      });

      await this.triggerHapticSuccess();

      return response.data.participation;
    } catch (error) {
      console.error('Error joining space:', error);
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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

  // Poll management
  async createPoll(spaceId: string, pollData: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/polls`, pollData, {
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
      });
      return response.data.polls;
    } catch (error) {
      console.error('Error fetching polls:', error);
      throw error;
    }
  }

  async voteOnPoll(spaceId: string, pollId: string, optionIds: string[]): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/polls/${pollId}/vote`, {
        option_ids: optionIds,
      }, {
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
      });
      return response.data.results;
    } catch (error) {
      console.error('Error fetching poll results:', error);
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
        headers: this.getHeaders(),
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
  // 🎮 REAL-TIME COLLABORATION - USING EXISTING PUSHER CONNECTION

  async subscribeToSpace(spaceId: string, callbacks: {
    onSpaceUpdate?: (data: any) => void;
    onParticipantJoined?: (data: any) => void;
    onParticipantLeft?: (data: any) => void;
    onParticipantUpdate?: (data: any) => void;
    onMessage?: (data: any) => void;
    onContentUpdate?: (contentState: any) => void;
    onMagicEvent?: (event: any) => void;
    onVoiceActivity?: (data: any) => void;
    onMessageSent?: (data: any) => void; // Alias for compatibility
    onWebRTCOffer?: (data: any) => void;
    onWebRTCAnswer?: (data: any) => void;
    onWebRTCIceCandidate?: (data: any) => void;
    onCallStarted?: (data: any) => void;
    onCallEnded?: (data: any) => void;
    onScreenShareStarted?: (data: any) => void;
    onScreenShareEnded?: (data: any) => void;
    onMuteStateChanged?: (data: any) => void;
    onVideoStateChanged?: (data: any) => void;
    onPollCreated?: (poll: any) => void;
    onPollUpdated?: (poll: any) => void;
    onPollDeleted?: (poll: any) => void;
  }) {
    try {
      // ✅ FIX: Only check if Pusher is ready - DON'T initialize
      const initialized = await this.ensurePusherInitialized();
      if (!initialized) {
        console.warn('📡 Pusher not ready for space subscription - retrying in 2s');
        setTimeout(() => this.subscribeToSpace(spaceId, callbacks), 2000);
        return;
      }

      const pusher = this.getPusherInstance();
      if (!pusher) {
        console.error('❌ Pusher instance failed in CollaborationService');
        return;
      }

      const channelName = `presence-space.${spaceId}`;
      let channel = this.spaceSubscriptions.get(spaceId);

      if (!channel) {
        console.log(`🔌 Channel: Subscribing to: ${channelName}`);
        channel = pusher.subscribe(channelName);
        this.spaceSubscriptions.set(spaceId, channel);

        channel.bind('pusher:subscription_succeeded', () => {
          console.log(`✅ Channel: Subscribed successfully to: ${spaceId}`);
        });

        channel.bind('pusher:subscription_error', (err: any) => {
          console.error(`❌ Channel: Subscription failed for: ${spaceId}:`, err);
        });
      } else {
        console.log(`🔌 Channel: Reusing existing subscription for: ${spaceId}`);
      }

      // Helper to bind events and log them
      const bind = (id: string, cb?: (d: any) => void, log?: string) => {
        if (cb) {
          channel!.bind(id, (data: any) => {
            if (log) console.log(`📡 [${spaceId}] ${log}`, data);
            cb(data);
          });
        }
      };

      // ✅ DOT-NOTATION (Matches Backend Logs)
      bind('message.sent', callbacks.onMessage || callbacks.onMessageSent, '📨 Message received');
      bind('call.started', callbacks.onCallStarted, '📞 Call started');
      bind('call.ended', callbacks.onCallEnded, '📵 Call ended');
      bind('magic.triggered', callbacks.onMagicEvent, '✨ Magic event');
      bind('space.updated', callbacks.onSpaceUpdate, '🔄 Space updated');
      bind('participant.joined', (data) => {
        console.log(`👤 [${spaceId}] Participant joined`, data);
        callbacks.onParticipantJoined?.(data);
        callbacks.onParticipantUpdate?.(data);
      });
      bind('participant.left', (data) => {
        console.log(`👤 [${spaceId}] Participant left`, data);
        callbacks.onParticipantLeft?.(data);
        callbacks.onParticipantUpdate?.(data);
      });
      bind('participant.updated', (data) => {
        callbacks.onParticipantUpdate?.(data);
      });

      // Collaboration specific events
      bind('content.updated', (data) => callbacks.onContentUpdate?.(data.content_state || data), '📝 Content updated');
      bind('screen_share.started', callbacks.onScreenShareStarted, '🖥️ Screen share started');
      bind('screen_share.ended', callbacks.onScreenShareEnded, '🖥️ Screen share ended');

      // RTC events (usually hyphenated because they are client-side often)
      bind('client-webrtc-offer', callbacks.onWebRTCOffer);
      bind('client-webrtc-answer', callbacks.onWebRTCAnswer);
      bind('client-webrtc-ice-candidate', callbacks.onWebRTCIceCandidate);

      // Media controls
      bind('mute.state.changed', callbacks.onMuteStateChanged);
      bind('video.state.changed', callbacks.onVideoStateChanged);
      bind('voice.activity', callbacks.onVoiceActivity);

      // Poll events
      bind('poll.created', (data) => {
        console.log(`📊 Poll created in space ${spaceId}:`, data.poll?.question);
        callbacks.onPollCreated?.(data.poll || data);
      }, '📊 Poll created');

      bind('poll.updated', (data) => {
        console.log(`📊 Poll updated in space ${spaceId}`);
        callbacks.onPollUpdated?.(data.poll || data);
      }, '📊 Poll updated');

      // ✅ ADD THIS - Poll deleted event
      bind('poll.deleted', (data) => {
        console.log(`🗑️ Poll deleted from space ${spaceId}:`, data.poll_id);
        // The data contains poll_id, not poll object
        callbacks.onPollDeleted?.(data.poll_id);
      }, '🗑️ Poll deleted');
      console.log(`📡 Space ${spaceId} active handlers registered.`);

    } catch (error) {
      console.error('❌ Error in subscribeToSpace:', error);
      throw error;
    }
  }

  async unsubscribeFromSpace(spaceId: string) {
    try {
      const pusher = this.getPusherInstance();
      if (!pusher) return;

      const channel = this.spaceSubscriptions.get(spaceId);

      if (channel) {
        const channelName = `presence-space.${spaceId}`;

        channel.unbind_all();
        pusher.unsubscribe(channelName);
        this.spaceSubscriptions.delete(spaceId);

        console.log(`📡 Unsubscribed from space ${spaceId}`);
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
      });

      this.broadcastCursorUpdate(spaceId, cursorState);
    } catch (error) {
      console.error('Error updating cursor:', error);
      throw error;
    }
  }

  // 📞 VOICE/VIDEO CALLS

  async startCall(spaceId: string, callType: 'audio' | 'video' | 'screen_share'): Promise<any> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/start-call`, {
        call_type: callType,
      }, {
        headers: this.getHeaders(),
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
      console.error('Error starting call:', error);
      throw error;
    }
  }

  async sendWebRTCSignal(spaceId: string, signalData: any): Promise<void> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/call/signal`, signalData, {
        headers: this.getHeaders(),
      });

      if (response.status !== 200) {
        throw new Error('Failed to send WebRTC signal');
      }
    } catch (error) {
      console.error('Error sending WebRTC signal:', error);
      throw error;
    }
  }

  async endCall(spaceId: string, callId: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/spaces/${spaceId}/end-call`, {
        call_id: callId,
      }, {
        headers: this.getHeaders(),
      });
    } catch (error) {
      console.error('Error ending call:', error);
      throw error;
    }
  }

  async toggleScreenShare(spaceId: string, isSharing: boolean): Promise<void> {
    try {
      await axios.put(`${this.baseURL}/spaces/${spaceId}/screen-share`, {
        is_sharing: isSharing,
      }, {
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
          ...this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
      });

      return response.data;
    } catch (error) {
      console.error('Error suggesting story continuation:', error);
      throw error;
    }
  }

  // 🎯 COLLABORATIVE ACTIVITIES
  async createCollaborativeActivity(activityData: {
    space_id: string;
    activity_type: string;
    title: string;
    description?: string;
    match_type?: string;
    match_score?: number;
    suggested_duration?: number;
    participant_ids?: number[];
    metadata?: any;
  }): Promise<CollaborativeActivity> {
    try {
      const response = await axios.post(`${this.baseURL}/collaborative-activities`, activityData, {
        headers: this.getHeaders(),

      });

      await this.triggerHapticSuccess();

      return response.data.activity;
    } catch (error) {
      console.error('Error creating collaborative activity:', error);
      throw error;
    }
  }

  async getSpaceActivities(spaceId: string, page = 1, limit = 20): Promise<{
    activities: CollaborativeActivity[];
    total: number;
    current_page: number;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/collaborative-activities/space/${spaceId}`, {
        headers: this.getHeaders(),
        params: { page, limit }
      });

      return {
        activities: response.data.activities.data || response.data.activities,
        total: response.data.total || response.data.activities.total || 0,
        current_page: response.data.current_page || page,
      };
    } catch (error) {
      console.error('Error fetching space activities:', error);
      throw error;
    }
  }

  async updateActivityStatus(activityId: number, data: {
    status: 'proposed' | 'active' | 'completed' | 'cancelled' | 'archived';
    notes?: string;
    actual_duration?: number;
    outcomes?: any;
  }): Promise<CollaborativeActivity> {
    try {
      const response = await axios.post(`${this.baseURL}/collaborative-activities/${activityId}/status`, data, {
        headers: this.getHeaders(),
      });

      await this.triggerHapticLight();

      return response.data.activity;
    } catch (error) {
      console.error('Error updating activity status:', error);
      throw error;
    }
  }

  async getSpaceActivityStatistics(spaceId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/collaborative-activities/space/${spaceId}/statistics`, {
        headers: this.getHeaders(),
      });

      return response.data.statistics;
    } catch (error) {
      console.error('Error fetching activity statistics:', error);
      throw error;
    }
  }

  // Message handling functions
  async sendMessage(spaceId: string, messageData: {
    content: string;
    type?: 'text' | 'image' | 'video' | 'file' | 'voice' | 'poll';
    file_path?: string;
    metadata?: any;
  }): Promise<any> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/send-message`, messageData, {
        headers: this.getHeaders(),
      });

      await this.triggerHapticSuccess();

      return response.data.message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async reactToMessage(messageId: string, reaction: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/messages/${messageId}/react`, {
        reaction,
      }, {
        headers: this.getHeaders(),
      });
    } catch (error) {
      console.error('Error reacting to message:', error);
      throw error;
    }
  }

  async getMessageReactions(messageId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseURL}/messages/${messageId}/reactions`, {
        headers: this.getHeaders(),
      });

      return response.data.reactions;
    } catch (error) {
      console.error('Error getting message reactions:', error);
      throw error;
    }
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
          ...this.getHeaders(),
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
    const channelName = `presence-space.${spaceId}`;

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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
      });
    } catch (error) {
      // Silent fail for cursor updates - not critical
      console.debug('Cursor update failed:', error);
    }
  }

}

export default CollaborationService;