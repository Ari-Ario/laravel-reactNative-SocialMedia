// stores/notificationStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PusherService from '@/services/PusherService';
import axios from 'axios';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  createdAt: Date;
  userId?: number;
  postId?: number;
  commentId?: number;
  spaceId?: string;
  callId?: string;
  activityId?: number;
  avatar?: string;
}

// Notification type constants
export const NOTIFICATION_TYPES = {
  // Existing types
  COMMENT: 'comment',
  REACTION: 'reaction',
  COMMENT_REACTION: 'comment_reaction',
  NEW_POST: 'new_post',
  POST_UPDATED: 'post_updated',
  POST_DELETED: 'post_deleted',
  NEW_FOLLOWER: 'new_follower',
  CHATBOT_TRAINING: 'chatbot_training',

  // NEW CHAT TYPES
  SPACE_INVITATION: 'space_invitation',
  CALL_STARTED: 'call_started',
  NEW_MESSAGE: 'new_message',
  PARTICIPANT_JOINED: 'participant_joined',
  MAGIC_EVENT: 'magic_event',
  SCREEN_SHARE: 'screen_share',
  ACTIVITY_CREATED: 'activity_created',
  CALL_ENDED: 'call_ended',
  SPACE_UPDATED: 'space_updated',
};

// Icon mapping for different notification types
export const getNotificationIcon = (type: string): string => {
  switch (type) {
    // Chat & Space notifications
    case NOTIFICATION_TYPES.SPACE_INVITATION: return 'people-outline';
    case NOTIFICATION_TYPES.CALL_STARTED: return 'call-outline';
    case NOTIFICATION_TYPES.NEW_MESSAGE: return 'chatbubble-outline';
    case NOTIFICATION_TYPES.PARTICIPANT_JOINED: return 'person-add-outline';
    case NOTIFICATION_TYPES.MAGIC_EVENT: return 'sparkles-outline';
    case NOTIFICATION_TYPES.SCREEN_SHARE: return 'desktop-outline';
    case NOTIFICATION_TYPES.ACTIVITY_CREATED: return 'calendar-outline';
    case NOTIFICATION_TYPES.CALL_ENDED: return 'call-outline';
    case NOTIFICATION_TYPES.SPACE_UPDATED: return 'cube-outline';

    // Existing types
    case NOTIFICATION_TYPES.COMMENT: return 'chatbubble-outline';
    case NOTIFICATION_TYPES.REACTION: return 'heart-outline';
    case NOTIFICATION_TYPES.COMMENT_REACTION: return 'heart-outline';
    case NOTIFICATION_TYPES.NEW_POST: return 'image-outline';
    case NOTIFICATION_TYPES.POST_UPDATED: return 'pencil-outline';
    case NOTIFICATION_TYPES.POST_DELETED: return 'trash-outline';
    case NOTIFICATION_TYPES.NEW_FOLLOWER: return 'person-add-outline';
    case NOTIFICATION_TYPES.CHATBOT_TRAINING: return 'school-outline';

    default: return 'notifications-outline';
  }
};

// Color mapping for different notification types
export const getNotificationColor = (type: string): string => {
  switch (type) {
    // Chat & Space notifications
    case NOTIFICATION_TYPES.SPACE_INVITATION: return '#5856D6'; // Purple
    case NOTIFICATION_TYPES.CALL_STARTED: return '#4CD964'; // Green
    case NOTIFICATION_TYPES.NEW_MESSAGE: return '#007AFF'; // Blue
    case NOTIFICATION_TYPES.PARTICIPANT_JOINED: return '#FF9500'; // Orange
    case NOTIFICATION_TYPES.MAGIC_EVENT: return '#FF2D55'; // Pink
    case NOTIFICATION_TYPES.SCREEN_SHARE: return '#5856D6'; // Purple
    case NOTIFICATION_TYPES.ACTIVITY_CREATED: return '#FF9500'; // Orange
    case NOTIFICATION_TYPES.CALL_ENDED: return '#8E8E93'; // Gray
    case NOTIFICATION_TYPES.SPACE_UPDATED: return '#007AFF'; // Blue

    // Existing types
    case NOTIFICATION_TYPES.COMMENT: return '#007AFF';
    case NOTIFICATION_TYPES.REACTION: return '#FF3B30';
    case NOTIFICATION_TYPES.COMMENT_REACTION: return '#FF3B30';
    case NOTIFICATION_TYPES.NEW_POST: return '#4CD964';
    case NOTIFICATION_TYPES.POST_UPDATED: return '#FF9500';
    case NOTIFICATION_TYPES.POST_DELETED: return '#FF3B30';
    case NOTIFICATION_TYPES.NEW_FOLLOWER: return '#5856D6';
    case NOTIFICATION_TYPES.CHATBOT_TRAINING: return '#FF2D55';

    default: return '#8E8E93';
  }
};



// NEW: Helper to check if notification is chat/space type
export const isChatNotification = (type: string): boolean => {
  return [
    NOTIFICATION_TYPES.SPACE_INVITATION,
    NOTIFICATION_TYPES.CALL_STARTED,
    NOTIFICATION_TYPES.NEW_MESSAGE,
    NOTIFICATION_TYPES.PARTICIPANT_JOINED,
    NOTIFICATION_TYPES.MAGIC_EVENT,
    NOTIFICATION_TYPES.SCREEN_SHARE,
    NOTIFICATION_TYPES.ACTIVITY_CREATED,
    NOTIFICATION_TYPES.CALL_ENDED,
    NOTIFICATION_TYPES.SPACE_UPDATED,
  ].includes(type);
};

interface NotificationStore {
  notifications: Notification[];
  followerNotifications: Notification[];
  unreadCount: number;
  unreadFollowerCount: number;
  isNotificationPanelVisible: boolean;
  isFollowersPanelVisible: boolean;
  isConnected: boolean;
  currentUserId: number | null;
  lastActiveTime: string | null;
  initializationTime: Date | null;
  unreadCallCount: number;
  unreadMessageCount: number;
  unreadSpaceCount: number;
  unreadActivityCount: number;

  // Actions
  setNotificationPanelVisible: (visible: boolean) => void;
  setIsFollowersPanelVisible: (visible: boolean) => void;
  setCurrentUserId: (userId: number) => void;
  setInitializationTime: (time: Date) => void;
  setLastActiveTime: (time: string) => void;

  // Notification management
  addNotification: (notification: Omit<Notification, 'id' | 'isRead'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  markAllFollowerNotificationsAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAll: () => void;

  // Real-time
  initializeRealtime: (token: string, userId: number) => void;
  disconnectRealtime: () => void;

  // Missed notifications
  fetchMissedNotifications: (token: string, userId: number) => Promise<void>;

  // Getters for filtered notifications
  getFollowerNotifications: () => Notification[];
  getRegularNotifications: () => Notification[];
  getUnreadFollowerCount: () => number;

  getCalls: () => Notification[];
  getMessages: () => Notification[];
  getSpaces: () => Notification[];
  getActivities: () => Notification[];
  getRegularFiltered: () => Notification[];
}

// Helper to check if notification is follower type (existing)
const isFollowerNotification = (type: string): boolean => {
  return ['new_follower', 'user_unfollowed', 'new-follower', 'user-unfollowed', 'follow'].includes(type);
};



// Add these helper functions
const isCallNotification = (type: string): boolean => {
  return [
    NOTIFICATION_TYPES.CALL_STARTED,
    NOTIFICATION_TYPES.CALL_ENDED,
  ].includes(type);
};

const isMessageNotification = (type: string): boolean => {
  return [
    NOTIFICATION_TYPES.NEW_MESSAGE,
  ].includes(type);
};

const isSpaceNotification = (type: string): boolean => {
  return [
    NOTIFICATION_TYPES.SPACE_INVITATION,
    NOTIFICATION_TYPES.SPACE_UPDATED,
  ].includes(type);
};

const isActivityNotification = (type: string): boolean => {
  return [
    NOTIFICATION_TYPES.PARTICIPANT_JOINED,
    NOTIFICATION_TYPES.MAGIC_EVENT,
    NOTIFICATION_TYPES.SCREEN_SHARE,
    NOTIFICATION_TYPES.ACTIVITY_CREATED,
  ].includes(type);
};

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      followerNotifications: [],
      unreadCount: 0,
      unreadFollowerCount: 0,
      isNotificationPanelVisible: false,
      isFollowersPanelVisible: false,
      isConnected: false,
      currentUserId: null,
      lastActiveTime: null,
      initializationTime: null,
      unreadCallCount: 0,
      unreadMessageCount: 0,
      unreadSpaceCount: 0,
      unreadActivityCount: 0,

      setNotificationPanelVisible: (visible) => set({ isNotificationPanelVisible: visible }),
      setIsFollowersPanelVisible: (visible) => set({ isFollowersPanelVisible: visible }),
      setCurrentUserId: (userId) => set({ currentUserId: userId }),
      setInitializationTime: (time) => set({ initializationTime: time }),
      setLastActiveTime: (time) => set({ lastActiveTime: time }),

      addNotification: (notificationData) => {
        // ✅ GLOBAL FILTER: Don't add notifications for events created by the current user
        const { currentUserId } = get();

        // Use loose equality (==) to handle string/number mismatch
        if (notificationData.userId && currentUserId && notificationData.userId == currentUserId) {
          console.log('🚫 Skipping notification created by self:', notificationData.type);
          return;
        }

        const newNotification: Notification = {
          ...notificationData,
          id: notificationData.id || Date.now().toString(),
          isRead: false,
          createdAt: notificationData.createdAt || new Date()
        };

        const isFollower = isFollowerNotification(newNotification.type);
        const isCall = isCallNotification(newNotification.type);
        const isMessage = isMessageNotification(newNotification.type);
        const isSpace = isSpaceNotification(newNotification.type);
        const isActivity = isActivityNotification(newNotification.type);
        const isRegular = !isFollower && !isCall && !isMessage && !isSpace && !isActivity;

        // Prevent duplicates
        const { notifications, followerNotifications } = get();
        const targetArray = isFollower ? followerNotifications : notifications;

        const isDuplicate = targetArray.some(notif =>
          notif.id === newNotification.id ||
          (notif.type === newNotification.type &&
            notif.postId === newNotification.postId &&
            Math.abs(new Date(notif.createdAt).getTime() - newNotification.createdAt.getTime()) < 60000)
        );

        if (isDuplicate) {
          console.log('🔄 Skipping duplicate notification:', newNotification.id);
          return;
        }

        console.log('🔔 ADDING NOTIFICATION:', newNotification.type,
          'isFollower:', isFollower,
          'isCall:', isCall,
          'isMessage:', isMessage,
          'isSpace:', isSpace,
          'isActivity:', isActivity,
          'isRegular:', isRegular);

        set((state) => {
          if (isFollower) {
            const newFollowerNotifications = [newNotification, ...state.followerNotifications].slice(0, 50);
            const newUnreadFollowerCount = newFollowerNotifications.filter(n => !n.isRead).length;

            return {
              followerNotifications: newFollowerNotifications,
              unreadFollowerCount: newUnreadFollowerCount,
              // Keep other counts
              notifications: state.notifications,
              unreadCount: state.unreadCount,
              unreadCallCount: state.unreadCallCount,
              unreadMessageCount: state.unreadMessageCount,
              unreadSpaceCount: state.unreadSpaceCount,
              unreadActivityCount: state.unreadActivityCount,
            };
          } else {
            // Add to main notifications
            const newNotifications = [newNotification, ...state.notifications].slice(0, 50);

            // Calculate all counts
            const newUnreadCount = newNotifications.filter(n => !n.isRead && !isCallNotification(n.type) && !isMessageNotification(n.type) && !isSpaceNotification(n.type) && !isActivityNotification(n.type)).length;
            const newUnreadCallCount = newNotifications.filter(n => !n.isRead && isCallNotification(n.type)).length;
            const newUnreadMessageCount = newNotifications.filter(n => !n.isRead && isMessageNotification(n.type)).length;
            const newUnreadSpaceCount = newNotifications.filter(n => !n.isRead && isSpaceNotification(n.type)).length;
            const newUnreadActivityCount = newNotifications.filter(n => !n.isRead && isActivityNotification(n.type)).length;

            return {
              notifications: newNotifications,
              unreadCount: newUnreadCount,
              unreadCallCount: newUnreadCallCount,
              unreadMessageCount: newUnreadMessageCount,
              unreadSpaceCount: newUnreadSpaceCount,
              unreadActivityCount: newUnreadActivityCount,
              followerNotifications: state.followerNotifications,
              unreadFollowerCount: state.unreadFollowerCount,
            };
          }
        });
      },


      // Add getter methods with self-filtering safety net
      getCalls: () => {
        const { notifications, currentUserId } = get();
        return notifications.filter(n =>
          isCallNotification(n.type) &&
          !(n.userId && currentUserId && n.userId == currentUserId)
        );
      },

      getMessages: () => {
        const { notifications, currentUserId } = get();
        return notifications.filter(n =>
          isMessageNotification(n.type) &&
          !(n.userId && currentUserId && n.userId == currentUserId)
        );
      },

      getSpaces: () => {
        const { notifications, currentUserId } = get();
        return notifications.filter(n =>
          isSpaceNotification(n.type) &&
          !(n.userId && currentUserId && n.userId == currentUserId)
        );
      },

      getActivities: () => {
        const { notifications, currentUserId } = get();
        return notifications.filter(n =>
          isActivityNotification(n.type) &&
          !(n.userId && currentUserId && n.userId == currentUserId)
        );
      },

      getRegularFiltered: () => {
        const { notifications, currentUserId } = get();
        return notifications.filter(n =>
          !isFollowerNotification(n.type) &&
          !isCallNotification(n.type) &&
          !isMessageNotification(n.type) &&
          !isSpaceNotification(n.type) &&
          !isActivityNotification(n.type) &&
          !(n.userId && currentUserId && n.userId == currentUserId)
        );
      },

      markAsRead: (notificationId) => {
        set((state) => {
          // Check both arrays to find where the notification is
          const inFollowerNotifications = state.followerNotifications.some(n => n.id === notificationId);

          if (inFollowerNotifications) {
            const updatedFollowerNotifications = state.followerNotifications.map(notif =>
              notif.id === notificationId ? { ...notif, isRead: true } : notif
            );
            const newUnreadFollowerCount = updatedFollowerNotifications.filter(n => !n.isRead).length;

            return {
              followerNotifications: updatedFollowerNotifications,
              unreadFollowerCount: newUnreadFollowerCount,
              notifications: state.notifications,
              unreadCount: state.unreadCount
            };
          } else {
            const updatedNotifications = state.notifications.map(notif =>
              notif.id === notificationId ? { ...notif, isRead: true } : notif
            );
            const newUnreadCount = updatedNotifications.filter(n => !n.isRead).length;

            return {
              notifications: updatedNotifications,
              unreadCount: newUnreadCount,
              followerNotifications: state.followerNotifications,
              unreadFollowerCount: state.unreadFollowerCount
            };
          }
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map(notif => ({ ...notif, isRead: true })),
          unreadCount: 0,
          followerNotifications: state.followerNotifications,
          unreadFollowerCount: state.unreadFollowerCount
        }));

        get().setLastActiveTime(new Date().toISOString());
      },

      markAllFollowerNotificationsAsRead: () => {
        set((state) => ({
          followerNotifications: state.followerNotifications.map(notif => ({ ...notif, isRead: true })),
          unreadFollowerCount: 0,
          notifications: state.notifications,
          unreadCount: state.unreadCount
        }));

        get().setLastActiveTime(new Date().toISOString());
      },


      removeNotification: (notificationId) => {
        set((state) => {
          const inFollowerNotifications = state.followerNotifications.some(n => n.id === notificationId);

          if (inFollowerNotifications) {
            const notificationToRemove = state.followerNotifications.find(n => n.id === notificationId);
            const wasUnread = notificationToRemove?.isRead === false;

            const newFollowerNotifications = state.followerNotifications.filter(n => n.id !== notificationId);
            const newUnreadFollowerCount = wasUnread ? Math.max(0, state.unreadFollowerCount - 1) : state.unreadFollowerCount;

            return {
              followerNotifications: newFollowerNotifications,
              unreadFollowerCount: newUnreadFollowerCount,
              notifications: state.notifications,
              unreadCount: state.unreadCount
            };
          } else {
            const notificationToRemove = state.notifications.find(n => n.id === notificationId);
            const wasUnread = notificationToRemove?.isRead === false;

            const newNotifications = state.notifications.filter(n => n.id !== notificationId);
            const newUnreadCount = wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount;

            return {
              notifications: newNotifications,
              unreadCount: newUnreadCount,
              followerNotifications: state.followerNotifications,
              unreadFollowerCount: state.unreadFollowerCount
            };
          }
        });
      },

      clearAll: () => set({
        notifications: [],
        followerNotifications: [],
        unreadCount: 0,
        unreadFollowerCount: 0
      }),

      initializeRealtime: (token: string, userId: number) => {
        console.log('🔔 INITIALIZING NOTIFICATION REAL-TIME FOR USER:', userId);

        const success = PusherService.initialize(token);

        if (success && userId) {
          PusherService.subscribeToUserNotifications(userId, (notificationData) => {
            console.log('🔔 PUSHER EVENT RECEIVED → ADDING TO STORE:', notificationData);
            get().addNotification(notificationData);
          });
          // ✅ NEW: Subscribe to private user channel for your custom events
          PusherService.subscribeToPrivateUser(userId, (notificationData) => {
            console.log('🔔 PRIVATE CHANNEL EVENT → ADDING TO STORE:', notificationData);
            get().addNotification(notificationData);
          });
          get().fetchMissedNotifications(token, userId);

          set({ isConnected: true, currentUserId: userId });
          console.log('✅ NOTIFICATION REAL-TIME INITIALIZED SUCCESSFULLY');
        } else {
          console.error('❌ FAILED TO INITIALIZE NOTIFICATION REAL-TIME');
        }
      },

      disconnectRealtime: () => {
        const { currentUserId } = get();
        if (currentUserId) {
          PusherService.unsubscribeFromUserNotifications(currentUserId);
          PusherService.unsubscribeFromChannel(`private-user.${currentUserId}`); // Add this
        }
        PusherService.disconnect();

        get().setLastActiveTime(new Date().toISOString());
        set({ isConnected: false, currentUserId: null });
      },


      fetchMissedNotifications: async (token: string, userId: number) => {
        try {
          const { lastActiveTime } = get();
          const apiUrl = getApiBase() || 'http://localhost:8000';
          const url = `${apiUrl}/notifications/missed`;

          console.log('📬 Fetching missed notifications from:', url, 'since:', lastActiveTime);

          const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              last_seen_time: lastActiveTime || undefined,
            },
            timeout: 10000,
          });

          const missedNotifications = response.data.notifications || response.data;
          console.log('📬 Found missed notifications:', missedNotifications.length);

          if (missedNotifications.length > 0) {
            missedNotifications.forEach((notification: any) => {
              // Extract type and data
              const type = notification.type;
              const notifData = notification.data || notification;

              // Create properly formatted notification for store
              let formattedNotification: any = {
                id: notification.id,
                type: type,
                title: '',
                message: '',
                data: notifData,
                isRead: !!notification.read_at,
                createdAt: new Date(notification.created_at || notification.createdAt),
              };

              // 1. SPACE INVITATIONS
              if (type === 'space-invitation') {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'space_invitation',
                  title: 'Space Invitation',
                  message: `${notifData.inviter_name || 'Someone'} invited you to join "${notifData.space_title || 'a space'}"`,
                  spaceId: notifData.space_id,
                  userId: notifData.inviter_id,
                  avatar: notifData.inviter_avatar,
                  data: notifData,
                };
              }

              // 2. NEW FOLLOWERS (for FollowersPanel)
              else if (type === 'App\\Events\\NewFollower') {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'new_follower',
                  title: 'New Follower',
                  message: `${notifData.followerName || 'Someone'} started following you`,
                  userId: notifData.followerId,
                  avatar: notifData.profile_photo,
                  data: notifData,
                };
              }

              // 3. COMMENTS
              else if (type === 'App\\Events\\NewComment') {
                const commentData = notifData.comment || notifData;
                const commenter = commentData.user || {};

                formattedNotification = {
                  ...formattedNotification,
                  type: 'comment',
                  title: 'New Comment',
                  message: `${commenter.name || 'Someone'} commented on your post`,
                  postId: notifData.postId || commentData.post_id,
                  commentId: commentData.id,
                  userId: commenter.id || commentData.user_id,
                  avatar: commenter.profile_photo,
                  data: notifData,
                };
              }

              // 4. REACTIONS
              else if (type === 'App\\Events\\NewReaction') {
                const reactionData = notifData.reaction || notifData;
                const reactor = reactionData.user || {};

                formattedNotification = {
                  ...formattedNotification,
                  type: 'reaction',
                  title: 'New Reaction',
                  message: `${reactor.name || 'Someone'} reacted to your post`,
                  postId: notifData.postId || reactionData.post_id,
                  userId: reactor.id || reactionData.user_id,
                  avatar: reactor.profile_photo,
                  data: notifData,
                };
              }

              // 5. POST UPDATES
              else if (type === 'App\\Events\\PostUpdated') {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'post_updated',
                  title: 'Post Updated',
                  message: notifData.message || 'A post was updated',
                  postId: notifData.postId,
                  userId: notifData.userId,
                  avatar: notifData.avatar,
                  data: notifData,
                };
              }

              // 6. POST DELETED
              else if (type === 'App\\Events\\PostDeleted') {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'post_deleted',
                  title: 'Post Deleted',
                  message: notifData.message || 'A post was deleted',
                  postId: notifData.postId,
                  data: notifData,
                };
              }

              // 7. CALL STARTED
              else if (type === 'call_started') {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'call_started',
                  title: 'Call Started',
                  message: notifData.message || 'A call has started',
                  spaceId: notifData.spaceId || notifData.space_id,
                  callId: notifData.callId || notifData.call?.id,
                  userId: notifData.userId || notifData.user?.id,
                  avatar: notifData.avatar || notifData.user?.profile_photo,
                  data: notifData,
                };
              }

              // 8. NEW MESSAGE
              else if (type === 'new_message') {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'new_message',
                  title: 'New Message',
                  message: notifData.message || 'You have a new message',
                  spaceId: notifData.spaceId || notifData.space_id,
                  messageId: notifData.messageId || notifData.message?.id,
                  userId: notifData.userId || notifData.user?.id,
                  avatar: notifData.avatar || notifData.user?.profile_photo,
                  data: notifData,
                };
              }

              // 9. PARTICIPANT JOINED
              else if (type === 'participant_joined') {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'participant_joined',
                  title: 'New Participant',
                  message: notifData.message || 'Someone joined the space',
                  spaceId: notifData.spaceId || notifData.space_id,
                  userId: notifData.userId || notifData.user?.id,
                  avatar: notifData.avatar || notifData.user?.profile_photo,
                  data: notifData,
                };
              }

              // 10. MAGIC EVENT
              else if (type === 'magic_event') {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'magic_event',
                  title: '✨ Magic Event',
                  message: notifData.message || 'A magical event occurred',
                  spaceId: notifData.spaceId || notifData.space_id,
                  eventId: notifData.eventId || notifData.event?.id,
                  userId: notifData.userId || notifData.triggered_by,
                  avatar: notifData.avatar,
                  data: notifData,
                };
              }

              // Add to store
              console.log(`📬 Adding missed notification:`, {
                id: formattedNotification.id,
                type: formattedNotification.type,
                title: formattedNotification.title,
                hasUserId: !!formattedNotification.userId,
                hasPostId: !!formattedNotification.postId,
                hasSpaceId: !!formattedNotification.spaceId,
              });

              get().addNotification(formattedNotification);
            });
          }

          get().setLastActiveTime(new Date().toISOString());
        } catch (error: any) {
          console.error('❌ Error fetching missed notifications:', error);
        }
      },

      // Getters for filtered notifications
      getFollowerNotifications: () => {
        const { followerNotifications } = get();
        console.log('👥 Getting follower notifications:', followerNotifications.length);
        return followerNotifications;
      },

      getRegularNotifications: () => {
        const { notifications } = get();
        console.log('🔔 Getting regular notifications:', notifications.length);
        // Double-check that no follower notifications are in the regular array
        const filteredNotifications = notifications.filter(notif => !isFollowerNotification(notif.type));
        if (filteredNotifications.length !== notifications.length) {
          console.log('⚠️ Filtered out follower notifications from regular array');
        }
        return filteredNotifications;
      },

      getUnreadFollowerCount: () => {
        const { unreadFollowerCount } = get();
        console.log('👥 Unread follower count:', unreadFollowerCount);
        return unreadFollowerCount;
      },
    }),
    {
      name: 'notification-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        notifications: state.notifications.map(notif => ({
          ...notif,
          createdAt: notif.createdAt.toISOString()
        })),
        followerNotifications: state.followerNotifications.map(notif => ({
          ...notif,
          createdAt: notif.createdAt.toISOString()
        })),
        unreadCount: state.unreadCount,
        unreadFollowerCount: state.unreadFollowerCount,
        lastActiveTime: state.lastActiveTime,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.notifications = state.notifications.map(notif => ({
            ...notif,
            createdAt: new Date(notif.createdAt)
          }));
          state.followerNotifications = state.followerNotifications.map(notif => ({
            ...notif,
            createdAt: new Date(notif.createdAt)
          }));
        }
      },
    }
  )
);