import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
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

  subscribedSpaceIds: string[];

  // Custom Tabs (Folders)
  customTabs: CustomTab[];

  // Actions
  setSpaces: (spaces: CollaborationSpace[]) => void;
  setActiveSpace: (space: CollaborationSpace | null) => void;
  addSpace: (space: CollaborationSpace) => void;
  updateSpace: (spaceId: string, updates: Partial<CollaborationSpace>) => void;
  updateSpacePermissions: (spaceId: string, permissions: Partial<any>) => void;
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
  decrementUnreadCount: (spaceId: string) => void;
  resetUnreadCount: (spaceId: string) => void;
  setUnreadCounts: (counts: Record<string, number>) => void;
  markSpaceAsRead: (spaceId: string, lastReadAt?: string) => Promise<void>;

  setSpaceActivities: (spaceId: string, activities: CollaborativeActivity[], total: number) => void;
  getSpaceActivities: (spaceId: string) => CollaborativeActivity[];
  hasSpaceActivities: (spaceId: string) => boolean;
  clearActivitiesCache: () => void;

  subscribeToAllSpaces: (spaceIds: string[]) => void;
  unsubscribeFromAllSpaces: () => void;
  handleSpaceEvent: (event: any) => void;

  // Custom Tab Actions
  createCustomTab: (name: string, spaceIds?: string[]) => void;
  deleteCustomTab: (id: string) => void;
  addSpaceToTab: (tabId: string, spaceId: string) => void;
  removeSpaceFromTab: (tabId: string, spaceId: string) => void;
  setSpacesInTab: (tabId: string, spaceIds: string[]) => void;
  renameCustomTab: (tabId: string, newName: string) => void;
  fetchUserSpaces: (userId: number) => Promise<CollaborationSpace[]>;
  reset: () => void;
}

export interface CustomTab {
  id: string;
  name: string;
  spaceIds: string[];
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
      customTabs: [],


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
            onScreenShareToggled: (data: any) => {
              console.log('🖥️ Screen share toggled:', data);
              get().handleSpaceEvent({ type: 'screen.share.toggled', data });
            },
            // ✅ NEW: forward message.deleted/reacted/replied as notifications
            onMessageDeleted: (data: any) => {
              console.log('🗑️ Message deleted in space:', data);
              get().handleSpaceEvent({ type: 'message-deleted', data });
            },
            onMessageReacted: (data: any) => {
              console.log('❤️ Message reacted in space:', data);
              get().handleSpaceEvent({ type: 'message-reacted', data });
            },
            onMessageReplied: (data: any) => {
              console.log('↩️ Message replied in space:', data);
              get().handleSpaceEvent({ type: 'message-replied', data });
            },
            onSpaceRead: (data: any) => {
              console.log('📖 Space read on another device:', data);
              get().handleSpaceEvent({ type: 'space-read', data });
            },
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
          case 'message.sent':
          case 'message.message':
          case 'space.message':
          case 'new_message':
            // Normalize space_id (handle both snake_case and camelCase)
            const sid = (data.space_id || data.spaceId)?.toString();
            console.log(`💬 [CollaborationStore] ${type} in space:`, sid);
            
            if (sid) {
              get().incrementUnreadCount(sid);
              
              // Also update the updated_at timestamp so the space moves to the top
              set((state) => ({
                spaces: state.spaces.map(s => 
                  s.id.toString() === sid 
                    ? { ...s, updated_at: new Date().toISOString() } 
                    : s
                )
              }));
              
              // We NO LONGER call addNotification here because NotificationStore 
              // already adds it before bridging to this handler.
              // This prevents double notifications in the Home header.
            }
            break;


          case 'space-updated':
          case 'space.updated':
          case 'space.update':
            if (data.space_id && data.space) {
              get().updateSpace(data.space_id, data.space);
            }
            break;

          case 'participant-joined':
          case 'participant.joined':
            if (data.space_id) {
              // Refresh or add participant
              if (data.user) {
                get().addParticipant({
                  ...data.user,
                  space_id: data.space_id,
                  role: data.role || 'participant'
                } as any);
              }
            }
            break;

          case 'magic.triggered':
          case 'magic_event':
            if (data.space_id && data.event) {
              get().addMagicEvent(data.event);
            }
            break;

          case 'call-started':
            if (data.space_id) {
              get().updateSpace(data.space_id, {
                is_live: true,
                current_focus: 'call'
              });

              const space = get().spaces.find(s => s.id === data.space_id);
              const callerId = data.caller_id || data.user_id || data.user?.id;
              const currentUserId = useNotificationStore.getState().currentUserId;

              if (callerId && currentUserId && callerId == currentUserId) break;
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

          case 'space-read':
            if (data.space_id) {
              // Internal reset/update without API call to avoid loops
              set((state) => {
                const currentCount = state.spaceUnreadCounts[data.space_id] || 0;
                
                // If it's a full read (Telegram style) or we should reset, set to 0.
                // For now, simpler multi-device read sync:
                const newCounts: Record<string, number> = { ...state.spaceUnreadCounts, [data.space_id]: 0 };
                const totalUnread = Object.values(newCounts).reduce((sum, count) => sum + count, 0);
                
                // Clear notifications for this space
                useNotificationStore.getState().markSpaceNotificationsAsRead(data.space_id);

                return {
                  spaceUnreadCounts: newCounts,
                  totalUnreadSpaces: totalUnread
                };
              });
            }
            break;
        }

        // ✅ Map internal event types → NOTIFICATION_TYPES
        const typeMap: Record<string, string> = {
          'message-sent': 'new_message',
          'message.sent': 'new_message',
          'message-deleted': 'message_deleted',   // ✅ NEW
          'message.deleted': 'message_deleted',   // ✅ NEW
          'message-reacted': 'message_reaction',  // ✅ NEW
          'message.reacted': 'message_reaction',  // ✅ NEW
          'message-replied': 'message_reply',     // ✅ NEW
          'message.replied': 'message_reply',     // ✅ NEW
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
          'screen-share-ended': 'screen_share',
          'screen_share.ended': 'screen_share',
        };

        const notificationType = typeMap[type] || type.replace(/-/g, '_');

        // ✅ Titles per type
        const titles: Record<string, string> = {
          'new_message': 'New message',
          'message_deleted': 'Message deleted',
          'message_reaction': 'New reaction',
          'message_reply': 'New reply',
          'call_started': 'Call started',
          'call_ended': 'Call ended',
          'participant_joined': 'Participant joined',
          'magic_event': 'Magic event',
          'screen_share': 'Screen share started',
        };

        const msgObj = data?.message || data;
        const senderId = data?.user?.id || msgObj?.user_id || msgObj?.sender_id || data?.user_id || data?.sender_id;
        const senderName = data?.user?.name || msgObj?.user_name || 'Someone';
        const spaceTitle = data?.space?.title || 'Collaboration space';

        const notificationMessage: string = (() => {
          switch (type) {
            case 'message-sent':
            case 'message.sent':
              return `${senderName}: ${msgObj?.content?.substring(0, 60) || 'New message'}`;
            case 'message-deleted':
            case 'message.deleted':
              return `${senderName} deleted a message`;
            case 'message-reacted':
            case 'message.reacted':
              return `${senderName} reacted ${data?.reaction || ''} to a message`;
            case 'message-replied':
            case 'message.replied':
              return `${senderName} replied to a message`;
            case 'participant-joined':
            case 'participant.joined':
              return `${data?.user_name || senderName} joined`;
            case 'call-started':
            case 'call.started':
              return `${data?.caller_name || 'A call'} started`;
            default: return 'New activity in space';
          }
        })();
      },



      setSpaces: (spaces) => set((state) => {
        // Initialize unread counts from the fetched spaces if they aren't already tracked
        const newUnreadCounts = { ...state.spaceUnreadCounts };
        let hasChanges = false;

        spaces.forEach(space => {
          const sid = space.id.toString();
          // If the fetched space has an unread_count and we don't have one cached, 
          // or the fetched one is higher, use it.
          const fetchedUnread = (space as any).unread_count || 0;
          if (fetchedUnread > (newUnreadCounts[sid] || 0)) {
            newUnreadCounts[sid] = fetchedUnread;
            hasChanges = true;
          }
        });

        if (hasChanges) {
          const totalUnread = Object.values(newUnreadCounts).reduce((sum, count) => sum + count, 0);
          return { 
            spaces, 
            spaceUnreadCounts: newUnreadCounts,
            totalUnreadSpaces: totalUnread
          };
        }

        return { spaces };
      }),

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
        return !!lastFetched && (Date.now() - lastFetched) < 5 * 60 * 1000;
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

      updateSpacePermissions: (spaceId, permissions) => set((state) => ({
        spaces: state.spaces.map(space =>
          space.id === spaceId
            ? { ...space, my_permissions: { ...space.my_permissions, ...permissions } }
            : space
        ),
        activeSpace: state.activeSpace?.id === spaceId
          ? { ...state.activeSpace, my_permissions: { ...state.activeSpace.my_permissions, ...permissions } }
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
        const id = spaceId.toString();
        const currentCount = state.spaceUnreadCounts[id] || 0;
        const newCounts = {
          ...state.spaceUnreadCounts,
          [id]: currentCount + 1
        };
        const totalUnread = Object.values(newCounts).reduce((sum, count) => sum + count, 0);

        return {
          spaceUnreadCounts: newCounts,
          totalUnreadSpaces: totalUnread
        };
      }),

      decrementUnreadCount: (spaceId) => set((state) => {
        const id = spaceId.toString();
        const currentCount = state.spaceUnreadCounts[id] || 0;
        if (currentCount <= 0) return state;

        const newCounts = {
          ...state.spaceUnreadCounts,
          [id]: currentCount - 1
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

      setUnreadCounts: (counts) => {
        const totalUnread = Object.values(counts).reduce((sum, count) => sum + count, 0);
        set({ spaceUnreadCounts: counts, totalUnreadSpaces: totalUnread });
      },

      markSpaceAsRead: async (spaceId, lastReadAt) => {
        const id = spaceId.toString();
        
        // ✅ Only clear local badge if we are doing a full reset (lastReadAt is null)
        // For partial reads during scroll, we let MessageList handle progressive decrement.
        if (!lastReadAt) {
          set((state) => {
            const newCounts: Record<string, number> = { ...state.spaceUnreadCounts, [id]: 0 };
            const totalUnread = Object.values(newCounts).reduce(
              (sum: number, count: number) => sum + count,
              0
            );
            // Also clear any space-related notification badges
            useNotificationStore.getState().markSpaceNotificationsAsRead(id);
            
            // Clear the is_unread manual flag if it exists
            const newSpaces = state.spaces.map(space => 
              space.id === spaceId && space.my_permissions?.is_unread
                ? { ...space, my_permissions: { ...space.my_permissions, is_unread: false } }
                : space
            );

            return { spaceUnreadCounts: newCounts, totalUnreadSpaces: totalUnread, spaces: newSpaces };
          });
        }

        try {
          // Persist to backend
          await CollaborationService.getInstance().markAsRead(spaceId, lastReadAt ?? undefined);
          console.log(`🔖 [CollaborationStore] Space ${spaceId} marked as read (lastReadAt: ${lastReadAt ?? 'now'})`);
        } catch (error) {
          console.warn(`⚠️ [CollaborationStore] Failed to persist mark-as-read for space ${spaceId}:`, error);
        }
      },

      // Custom Tab Actions
      createCustomTab: (name, spaceIds = []) => set((state) => {
        if (state.customTabs.length >= 10) {
          Alert.alert('Limit reached', 'You can create up to 10 custom tabs.');
          return state;
        }
        const newTab: CustomTab = {
          id: Date.now().toString(),
          name: name.substring(0, 12),
          spaceIds: spaceIds
        };
        return { customTabs: [...state.customTabs, newTab] };
      }),

      deleteCustomTab: (id) => set((state) => ({
        customTabs: state.customTabs.filter(t => t.id !== id)
      })),

      addSpaceToTab: (tabId, spaceId) => set((state) => ({
        customTabs: state.customTabs.map(t => 
          t.id === tabId ? { ...t, spaceIds: [...new Set([...t.spaceIds, spaceId])] } : t
        )
      })),

      removeSpaceFromTab: (tabId, spaceId) => set((state) => ({
        customTabs: state.customTabs.map(t => 
          t.id === tabId ? { ...t, spaceIds: t.spaceIds.filter(id => id !== spaceId) } : t
        )
      })),

      setSpacesInTab: (tabId, spaceIds) => set((state) => ({
        customTabs: state.customTabs.map(t => 
          t.id === tabId ? { ...t, spaceIds } : t
        )
      })),

      renameCustomTab: (tabId, newName) => set((state) => ({
        customTabs: state.customTabs.map(t => 
          t.id === tabId ? { ...t, name: newName.substring(0, 12) } : t
        )
      })),
      
      fetchUserSpaces: async (userId) => {
        try {
          console.log('🌐 Store: Fetching spaces for user:', userId);
          const spaces = await CollaborationService.getInstance().fetchUserSpaces(userId);
          
          set({ spaces });
          
          // Also automatically subscribe to all fetched spaces
          const spaceIds = spaces.map(s => s.id);
          get().subscribeToAllSpaces(spaceIds);
          
          return spaces;
        } catch (error) {
          console.error('❌ Store: Error fetching user spaces:', error);
          throw error;
        }
      },

      reset: () => {
        get().unsubscribeFromAllSpaces();
        set({
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
          customTabs: [],
        });
        console.log('🧹 CollaborationStore reset complete');
      },
    }),
    {
      name: 'collaboration-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        spaces: state.spaces,
        spaceUnreadCounts: state.spaceUnreadCounts,
        totalUnreadSpaces: state.totalUnreadSpaces,
        customTabs: state.customTabs,
      }),
    }
  )
);