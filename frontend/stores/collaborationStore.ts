import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CollaborationService, { CollaborationSpace, SpaceParticipation, MagicEvent, CollaborativeActivity } from '@/services/ChatScreen/CollaborationService';
import PusherService from '@/services/PusherService';
import { useNotificationStore } from '@/stores/notificationStore';

interface CollaborationState {
  spaces: CollaborationSpace[];
  activeSpace: CollaborationSpace | null;
  participants: SpaceParticipation[];
  magicEvents: MagicEvent[];

  // Space unread counts for notifications
  spaceUnreadCounts: Record<string, number>;
  totalUnreadSpaces: number;

  spaceActivities: Record<string, CollaborativeActivity[]>; // Add this
  activitiesLastFetched: Record<string, number>; // Add this
  totalActivitiesCount: number; // Add this

  subscribedSpaceIds: string[]; // Add this

  // Actions
  setSpaces: (spaces: CollaborationSpace[]) => void;
  setActiveSpace: (space: CollaborationSpace | null) => void;
  addSpace: (space: CollaborationSpace) => void;
  updateSpace: (spaceId: string, updates: Partial<CollaborationSpace>) => void;
  removeSpace: (spaceId: string) => void;

  // Participant actions
  setParticipants: (participants: SpaceParticipation[]) => void;
  addParticipant: (participant: SpaceParticipation) => void;
  updateParticipant: (userId: number, updates: Partial<SpaceParticipation>) => void;
  removeParticipant: (userId: number) => void;

  // Magic events
  addMagicEvent: (event: MagicEvent) => void;
  discoverMagicEvent: (eventId: string) => void;

  // Unread counts
  incrementUnreadCount: (spaceId: string) => void;
  resetUnreadCount: (spaceId: string) => void;
  markSpaceAsRead: (spaceId: string) => void;

  setSpaceActivities: (spaceId: string, activities: CollaborativeActivity[], total: number) => void;
  getSpaceActivities: (spaceId: string) => CollaborativeActivity[];
  hasSpaceActivities: (spaceId: string) => boolean;
  clearActivitiesCache: () => void;

  subscribeToAllSpaces: (spaceIds: string[]) => void;
  unsubscribeFromAllSpaces: () => void;
  handleSpaceEvent: (event: any) => void;
}

export const useCollaborationStore = create<CollaborationState>()(
  persist(
    (set, get) => ({
      spaces: [],
      activeSpace: null,
      participants: [],
      magicEvents: [],
      spaceUnreadCounts: {},
      totalUnreadSpaces: 0,

      spaceActivities: {},
      activitiesLastFetched: {},
      totalActivitiesCount: 0,
      subscribedSpaceIds: [],


      subscribeToAllSpaces: (spaceIds) => {
        if (!PusherService.isReady()) {
          console.warn('⚠️ Pusher not ready, delaying space subscriptions');
          setTimeout(() => {
            get().subscribeToAllSpaces(spaceIds);
          }, 1000);
          return;
        }

        console.log(`🚀 Subscribing to ${spaceIds.length} presence-space channels`);

        // Define event handlers for all space events
        const handleSpaceUpdate = (data: any) => {
          console.log('🔄 Space updated:', data);
          get().handleSpaceEvent({ type: 'space-updated', data });
        };

        const handleParticipantJoined = (data: any) => {
          console.log('👤 Participant joined:', data);
          get().handleSpaceEvent({ type: 'participant-joined', data });
        };

        const handleParticipantLeft = (data: any) => {
          console.log('👤 Participant left:', data);
          get().handleSpaceEvent({ type: 'participant-left', data });
        };

        const handleMessageSent = (data: any) => {
          console.log('💬 Message sent:', data);
          get().handleSpaceEvent({ type: 'message-sent', data });
        };

        const handleCallStarted = (data: any) => {
          console.log('📞 Call started:', data);
          get().handleSpaceEvent({ type: 'call-started', data });
        };

        const handleCallEnded = (data: any) => {
          console.log('📞 Call ended:', data);
          get().handleSpaceEvent({ type: 'call-ended', data });
        };

        const handleMagicTriggered = (data: any) => {
          console.log('✨ Magic triggered:', data);
          get().handleSpaceEvent({ type: 'magic-triggered', data });
        };

        const handleScreenShareStarted = (data: any) => {
          console.log('🖥️ Screen share started:', data);
          get().handleSpaceEvent({ type: 'screen-share-started', data });
        };

        const handleScreenShareEnded = (data: any) => {
          console.log('🖥️ Screen share ended:', data);
          get().handleSpaceEvent({ type: 'screen-share-ended', data });
        };

        // Subscribe to each space channel
        const collaborationService = CollaborationService.getInstance();
        spaceIds.forEach(spaceId => {
          collaborationService.subscribeToSpace(spaceId, {
            onSpaceUpdate: handleSpaceUpdate,
            onParticipantJoined: handleParticipantJoined,
            onParticipantLeft: handleParticipantLeft,
            onMessage: handleMessageSent,
            onCallStarted: handleCallStarted,
            onCallEnded: handleCallEnded,
            onMagicEvent: handleMagicTriggered,
            onScreenShareStarted: handleScreenShareStarted,
            onScreenShareEnded: handleScreenShareEnded,
          });
        });

        set({ subscribedSpaceIds: spaceIds });
      },

      unsubscribeFromAllSpaces: () => {
        const { subscribedSpaceIds } = get();
        console.log(`🔌 Unsubscribing from ${subscribedSpaceIds.length} space channels`);

        subscribedSpaceIds.forEach(spaceId => {
          PusherService.unsubscribeFromChannel(`presence-space.${spaceId}`);
        });

        set({ subscribedSpaceIds: [] });
      },

      handleSpaceEvent: (event) => {
        const { type, data } = event;

        // Update the store based on event type
        switch (type) {
          case 'message-sent':
            if (data.space_id) {
              get().incrementUnreadCount(data.space_id);
            }
            break;

          case 'call-started':
            if (data.space_id) {
              get().updateSpace(data.space_id, {
                is_live: true,
                current_focus: 'call'
              });
            }
            break;

          case 'call-ended':
            if (data.space_id) {
              get().updateSpace(data.space_id, {
                is_live: false,
                current_focus: null
              });
            }
            break;

          case 'participant-joined':
          case 'participant-left':
            if (data.space_id) {
              // Safe check for method existence
              if (typeof (get() as any).refreshSpace === 'function') {
                (get() as any).refreshSpace(data.space_id);
              }
            }
            break;
        }

        // ✅ Map internal event types to NOTIFICATION_TYPES
        const typeMap: Record<string, string> = {
          'message-sent': 'new_message',
          'message.sent': 'new_message',
          'call-started': 'call_started',
          'call.started': 'call_started',
          'call-ended': 'call_ended',
          'call.ended': 'call_ended',
          'participant-joined': 'participant_joined',
          'participant.joined': 'participant_joined',
          'magic-triggered': 'magic_event',
          'magic.triggered': 'magic_event',
          'screen-share-started': 'screen_share',
          'screen_share.started': 'screen_share',
          'screen-share-ended': 'screen_share_ended',
          'screen_share.ended': 'screen_share_ended'
        };

        const notificationType = typeMap[type] || type.replace('-', '_');

        // ✅ Titles & Messages
        const titles: Record<string, string> = {
          'new_message': 'New message',
          'call_started': 'Call started',
          'call_ended': 'Call ended',
          'participant_joined': 'Participant joined',
          'magic_event': 'Magic event',
          'screen_share': 'Screen share started'
        };

        const msgObj = data?.message || data;
        const senderId = msgObj?.user_id || msgObj?.sender_id || data?.user_id || data?.sender_id;
        const spaceTitle = data?.space?.title || 'Collaboration space';

        const notificationMessage =
          type === 'message-sent' ? (msgObj?.content || 'New message received') :
            type === 'participant-joined' ? `${data.user_name || 'Someone'} joined` :
              type === 'call-started' ? `${data.caller_name || 'A call'} started` :
                'New activity in space';

        // Also send to notification store
        useNotificationStore.getState().addNotification({
          type: notificationType,
          title: `${titles[notificationType] || 'Update'} in ${spaceTitle}`,
          message: notificationMessage,
          data: data,
          spaceId: data.space_id,
          userId: senderId,
          avatar: data.user?.profile_photo || msgObj?.user?.profile_photo,
          createdAt: new Date()
        });
      },



      setSpaces: (spaces) => set({ spaces }),

      setActiveSpace: (space) => set({ activeSpace: space }),

      addSpace: (space) => set((state) => ({
        spaces: [space, ...state.spaces]
      })),


      setSpaceActivities: (spaceId, activities, total) => set((state) => {
        // Update the specific space's activities
        const newSpaceActivities = {
          ...state.spaceActivities,
          [spaceId]: activities
        };

        // Calculate total activities across all spaces
        let totalCount = 0;
        Object.values(newSpaceActivities).forEach(acts => {
          totalCount += acts.length;
        });

        // Update last fetched timestamp (5 minute cache)
        const newLastFetched = {
          ...state.activitiesLastFetched,
          [spaceId]: Date.now()
        };

        return {
          spaceActivities: newSpaceActivities,
          activitiesLastFetched: newLastFetched,
          totalActivitiesCount: totalCount
        };
      }),

      getSpaceActivities: (spaceId) => {
        return get().spaceActivities[spaceId] || [];
      },

      hasSpaceActivities: (spaceId) => {
        const lastFetched = get().activitiesLastFetched[spaceId];
        // Consider cached if fetched within last 5 minutes
        return lastFetched && (Date.now() - lastFetched) < 5 * 60 * 1000;
      },

      clearActivitiesCache: () => set({
        spaceActivities: {},
        activitiesLastFetched: {},
        totalActivitiesCount: 0
      }),

      updateSpace: (spaceId, updates) => set((state) => ({
        spaces: state.spaces.map(space =>
          space.id === spaceId ? { ...space, ...updates } : space
        ),
        activeSpace: state.activeSpace?.id === spaceId
          ? { ...state.activeSpace, ...updates }
          : state.activeSpace,
      })),

      removeSpace: (spaceId) => set((state) => ({
        spaces: state.spaces.filter(space => space.id !== spaceId),
        activeSpace: state.activeSpace?.id === spaceId ? null : state.activeSpace,
      })),

      setParticipants: (participants) => set({ participants }),

      addParticipant: (participant) => set((state) => ({
        participants: [...state.participants, participant]
      })),

      updateParticipant: (userId, updates) => set((state) => ({
        participants: state.participants.map(p =>
          p.user_id === userId ? { ...p, ...updates } : p
        )
      })),

      removeParticipant: (userId) => set((state) => ({
        participants: state.participants.filter(p => p.user_id !== userId)
      })),

      addMagicEvent: (event) => set((state) => ({
        magicEvents: [event, ...state.magicEvents]
      })),

      discoverMagicEvent: (eventId) => set((state) => ({
        magicEvents: state.magicEvents.map(event =>
          event.id === eventId ? { ...event, has_been_discovered: true } : event
        ),
      })),

      incrementUnreadCount: (spaceId) => set((state) => {
        const currentCount = state.spaceUnreadCounts[spaceId] || 0;
        const newCounts = {
          ...state.spaceUnreadCounts,
          [spaceId]: currentCount + 1
        };
        const totalUnread = Object.values(newCounts).reduce((sum, count) => sum + count, 0);

        return {
          spaceUnreadCounts: newCounts,
          totalUnreadSpaces: totalUnread
        };
      }),

      resetUnreadCount: (spaceId) => set((state) => {
        const newCounts = { ...state.spaceUnreadCounts };
        delete newCounts[spaceId];
        const totalUnread = Object.values(newCounts).reduce((sum, count) => sum + count, 0);

        return {
          spaceUnreadCounts: newCounts,
          totalUnreadSpaces: totalUnread
        };
      }),

      markSpaceAsRead: (spaceId) => set((state) => {
        const newCounts = { ...state.spaceUnreadCounts, [spaceId]: 0 };
        const totalUnread = Object.values(newCounts).reduce((sum, count) => sum + count, 0);

        return {
          spaceUnreadCounts: newCounts,
          totalUnreadSpaces: totalUnread
        };
      }),
    }),
    {
      name: 'collaboration-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        spaces: state.spaces,
        spaceUnreadCounts: state.spaceUnreadCounts,
        totalUnreadSpaces: state.totalUnreadSpaces,
      }),
    }
  )
);