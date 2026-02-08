// services/CollaborationService.ts
import axios from "@/services/axios";
import { Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
// import Pusher from '@pusher/pusher-websocket-react-native';
import Pusher from "pusher-js";
import getApiBase from '@/services/getApiBase';
import { getToken } from "@/services/TokenService";

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
}

export interface SpaceParticipation {
  id: number;
  space_id: string;
  user_id: number;
  role: 'owner' | 'moderator' | 'participant' | 'viewer';
  permissions: any;
  presence_data: any;
  contribution_map: any;
  focus_areas: string[];
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
  created_at: string;
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
  private static instance: CollaborationService;
  private pusher: Pusher | null = null;
  private spaceSubscriptions: Map<string, any> = new Map();
  private userToken: string | null = null;
  private baseURL: string;

  private constructor() {
    // this.baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';
    this.baseURL = getApiBase() || 'http://localhost:8000/api';
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

// services/CollaborationService.ts - UPDATED fetchSpaceDetails method
async fetchSpaceDetails(spaceId: string): Promise<CollaborationSpace> {
  if (!this.userToken) {
    return;
    // this.userToken = await getToken();
  }
  try {
    console.log(`Fetching space details for: ${spaceId}`);
    
    const response = await axios.get(`${this.baseURL}/spaces/${spaceId}`, {
      headers: this.getHeaders(),
    });
    
    console.log('Space API response:', response.data);
    
    // Your API returns { space: {...}, participation: {...} }
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
    
    // If 404, create a mock space for testing
    if (error.response?.status === 404) {
      console.log('Space not found, returning mock data for testing');
      return this.getMockSpace(spaceId);
    }
    
    throw error;
  }
}

// Add this helper method for testing
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
          profile_photo: null,
        }
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
      // Web fallback - you could play a sound or just skip
      console.log('Haptic feedback would trigger here on mobile');
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
      console.log('Haptic feedback would trigger here on mobile');
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
      console.log('Haptic feedback would trigger here on mobile');
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
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // If you want to automatically add participants (old behavior), use join instead
      // For now, we're just sending invitations
    } catch (error: any) {
      console.error('Error inviting to space:', error.response?.data || error.message);
      
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to invite users to this space');
      }
      
      throw error;
    }
  }

  // Add a method to accept invitations
  async acceptSpaceInvitation(spaceId: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseURL}/spaces/${spaceId}/accept-invitation`, {}, {
        headers: this.getHeaders(),
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      return response.data;
    } catch (error) {
      console.error('Error accepting space invitation:', error);
      throw error;
    }
  }

  // 🎮 REAL-TIME COLLABORATION

  async subscribeToSpace(spaceId: string, callbacks: {
    onSpaceUpdate?: (space: CollaborationSpace) => void;
    onParticipantUpdate?: (participant: SpaceParticipation) => void;
    onContentUpdate?: (contentState: any) => void;
    onMagicEvent?: (event: MagicEvent) => void;
    onVoiceActivity?: (data: any) => void;
  }) {
    if (!this.pusher) {
      this.initializePusher();
    }

    const channel = this.pusher!.subscribe(`space-${spaceId}`);
    this.spaceSubscriptions.set(spaceId, channel);

    // Bind event handlers
    if (callbacks.onSpaceUpdate) {
      channel.bind('space-updated', callbacks.onSpaceUpdate);
    }
    
    if (callbacks.onParticipantUpdate) {
      channel.bind('participant-updated', callbacks.onParticipantUpdate);
      channel.bind('participant-joined', callbacks.onParticipantUpdate);
      channel.bind('participant-left', callbacks.onParticipantUpdate);
    }
    
    if (callbacks.onContentUpdate) {
      channel.bind('content-updated', callbacks.onContentUpdate);
    }
    
    if (callbacks.onMagicEvent) {
      channel.bind('magic-triggered', callbacks.onMagicEvent);
    }
    
    if (callbacks.onVoiceActivity) {
      channel.bind('voice-activity', callbacks.onVoiceActivity);
    }
  }

  async unsubscribeFromSpace(spaceId: string) {
    const channel = this.spaceSubscriptions.get(spaceId);
    if (channel) {
      channel.unsubscribe();
      this.spaceSubscriptions.delete(spaceId);
    }
  }

  async updateContentState(spaceId: string, contentState: any): Promise<void> {
    try {
      await axios.put(`${this.baseURL}/spaces/${spaceId}`, {
        content_state: contentState,
      }, {
        headers: this.getHeaders(),
      });

      // Optionally broadcast via Pusher
      this.broadcastContentUpdate(spaceId, contentState);
    } catch (error) {
      console.error('Error updating content state:', error);
      throw error;
    }
  }

  async updateCursorPosition(spaceId: string, cursorState: any): Promise<void> {
    try {
      // Update local participation
      await axios.put(`${this.baseURL}/spaces/${spaceId}/cursor`, {
        cursor_state: cursorState,
      }, {
        headers: this.getHeaders(),
      });

      // Broadcast to other participants
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

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      return response.data.call_data;
    } catch (error) {
      console.error('Error starting call:', error);
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

      // Broadcast screen share state
      this.broadcastScreenShareState(spaceId, isSharing);
    } catch (error) {
      console.error('Error toggling screen share:', error);
      throw error;
    }
  }

  // 🤖 AI ASSISTANT

  async queryAI(spaceId: string, query: string, context?: any, action?: string): Promise<AIInteraction> {
      try {
          // Handle "global" space ID - use a mock response
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
          
          // Fallback to mock response
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
          training_match_id: null,
          context_data: context,
          was_helpful: null,
          user_feedback: null,
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

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
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

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
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

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
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

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
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

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      return response.data.new_story;
    } catch (error) {
      console.error('Error adding to story chain:', error);
      throw error;
    }
  }

  // 🛠️ PRIVATE HELPERS

  private initializePusher() {
    this.pusher = new Pusher({
      apiKey: process.env.EXPO_PUBLIC_PUSHER_KEY!,
      cluster: process.env.EXPO_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: `${this.baseURL}/broadcasting/auth`,
      forceTLS: true,
    });
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
    // This should get from your auth context
    return 0; // Replace with actual user ID
  }

  // 🔍 UTILITIES

  async checkForEmergence(spaceId: string): Promise<boolean> {
    try {
      const space = await this.fetchSpaceDetails(spaceId);
      const { activity_metrics, participants_count, evolution_level } = space;

      // Check conditions for magic events
      const conditions = [
        participants_count >= 3 && (activity_metrics?.energy_level || 0) > 70,
        activity_metrics?.total_interactions > 50,
        new Date().getHours() >= 22 || new Date().getHours() <= 6, // Late night
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
}

export default CollaborationService;