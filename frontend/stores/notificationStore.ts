// stores/notificationStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PusherService from '@/services/PusherService';
import axios from 'axios';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';

// import { useCollaborationStore } from '@/stores/collaborationStore';

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
  messageId?: string;  // ✅ ADDED: for reaction/reply routing
  callId?: string;
  activityId?: number;
  avatar?: string;
}

// Notification type constants
export const NOTIFICATION_TYPES = {
  // Social
  COMMENT: 'comment',
  REACTION: 'reaction',
  COMMENT_REACTION: 'comment_reaction',
  NEW_POST: 'new_post',
  POST_UPDATED: 'post_updated',
  POST_DELETED: 'post_deleted',
  NEW_FOLLOWER: 'new_follower',
  CHATBOT_TRAINING: 'chatbot_training',

  // Space / Chat
  SPACE_INVITATION: 'space_invitation',
  SPACE_UPDATED: 'space_updated',
  SPACE_CREATED: 'space_created',          // ✅ NEW
  CALL_STARTED: 'call_started',
  CALL_ENDED: 'call_ended',
  NEW_MESSAGE: 'new_message',
  MESSAGE_REACTION: 'message_reaction',
  MESSAGE_REPLY: 'message_reply',
  MESSAGE_DELETED: 'message_deleted',
  SPACE_DELETED: 'space-deleted',          // ✅ NEW
  PARTICIPANT_JOINED: 'participant_joined',
  MAGIC_EVENT: 'magic_event',
  SCREEN_SHARE: 'screen_share',
  ACTIVITY_CREATED: 'activity_created',
  VIOLATION_REPORTED: 'violation_reported',
  MODERATION_ACTION: 'moderation_action', // ✅ NEW
};

// Icon mapping for different notification types
export const getNotificationIcon = (type: string): string => {
  switch (type) {
    case NOTIFICATION_TYPES.SPACE_INVITATION: return 'people-outline';
    case NOTIFICATION_TYPES.SPACE_CREATED: return 'rocket-outline';
    case NOTIFICATION_TYPES.SPACE_UPDATED: return 'cube-outline';
    case NOTIFICATION_TYPES.CALL_STARTED: return 'call-outline';
    case NOTIFICATION_TYPES.CALL_ENDED: return 'call-outline';
    case NOTIFICATION_TYPES.NEW_MESSAGE: return 'chatbubble-outline';
    case NOTIFICATION_TYPES.MESSAGE_REPLY: return 'arrow-undo-outline';
    case NOTIFICATION_TYPES.MESSAGE_REACTION: return 'heart-outline';
    case NOTIFICATION_TYPES.MESSAGE_DELETED: return 'trash-outline';
    case NOTIFICATION_TYPES.SPACE_DELETED: return 'trash-outline';
    case NOTIFICATION_TYPES.PARTICIPANT_JOINED: return 'person-add-outline';
    case NOTIFICATION_TYPES.MAGIC_EVENT: return 'sparkles-outline';
    case NOTIFICATION_TYPES.SCREEN_SHARE: return 'desktop-outline';
    case NOTIFICATION_TYPES.ACTIVITY_CREATED: return 'calendar-outline';
    case NOTIFICATION_TYPES.COMMENT: return 'chatbubble-outline';
    case NOTIFICATION_TYPES.REACTION: return 'heart-outline';
    case NOTIFICATION_TYPES.COMMENT_REACTION: return 'heart-outline';
    case NOTIFICATION_TYPES.NEW_POST: return 'image-outline';
    case NOTIFICATION_TYPES.POST_UPDATED: return 'pencil-outline';
    case NOTIFICATION_TYPES.POST_DELETED: return 'trash-outline';
    case NOTIFICATION_TYPES.NEW_FOLLOWER: return 'person-add-outline';
    case NOTIFICATION_TYPES.CHATBOT_TRAINING: return 'school-outline';
    case NOTIFICATION_TYPES.VIOLATION_REPORTED: return 'shield-alert-outline';
    case NOTIFICATION_TYPES.MODERATION_ACTION: return 'notifications-outline';
    default: return 'notifications-outline';
  }
};

// Color mapping for different notification types
export const getNotificationColor = (type: string): string => {
  switch (type) {
    case NOTIFICATION_TYPES.SPACE_INVITATION: return '#5856D6';
    case NOTIFICATION_TYPES.SPACE_CREATED: return '#5856D6';
    case NOTIFICATION_TYPES.SPACE_UPDATED: return '#007AFF';
    case NOTIFICATION_TYPES.CALL_STARTED: return '#4CD964';
    case NOTIFICATION_TYPES.CALL_ENDED: return '#8E8E93';
    case NOTIFICATION_TYPES.NEW_MESSAGE: return '#007AFF';
    case NOTIFICATION_TYPES.MESSAGE_REPLY: return '#007AFF';
    case NOTIFICATION_TYPES.MESSAGE_REACTION: return '#FF3B30';
    case NOTIFICATION_TYPES.MESSAGE_DELETED: return '#FF3B30';
    case NOTIFICATION_TYPES.SPACE_DELETED: return '#FF3B30';
    case NOTIFICATION_TYPES.PARTICIPANT_JOINED: return '#FF9500';
    case NOTIFICATION_TYPES.MAGIC_EVENT: return '#FF2D55';
    case NOTIFICATION_TYPES.SCREEN_SHARE: return '#5856D6';
    case NOTIFICATION_TYPES.ACTIVITY_CREATED: return '#FF9500';
    case NOTIFICATION_TYPES.COMMENT: return '#007AFF';
    case NOTIFICATION_TYPES.REACTION: return '#FF3B30';
    case NOTIFICATION_TYPES.COMMENT_REACTION: return '#FF3B30';
    case NOTIFICATION_TYPES.NEW_POST: return '#4CD964';
    case NOTIFICATION_TYPES.POST_UPDATED: return '#FF9500';
    case NOTIFICATION_TYPES.POST_DELETED: return '#FF3B30';
    case NOTIFICATION_TYPES.NEW_FOLLOWER: return '#5856D6';
    case NOTIFICATION_TYPES.CHATBOT_TRAINING: return '#FF2D55';
    case NOTIFICATION_TYPES.VIOLATION_REPORTED: return '#F44336';
    case NOTIFICATION_TYPES.MODERATION_ACTION: return '#FF3B30';
    default: return '#8E8E93';
  }
};



// Chat/space notification — never routes to profile view
export const isChatNotification = (type: string): boolean => {
  return [
    NOTIFICATION_TYPES.SPACE_INVITATION,
    NOTIFICATION_TYPES.SPACE_UPDATED,
    NOTIFICATION_TYPES.SPACE_CREATED,
    NOTIFICATION_TYPES.CALL_STARTED,
    NOTIFICATION_TYPES.CALL_ENDED,
    NOTIFICATION_TYPES.NEW_MESSAGE,
    NOTIFICATION_TYPES.MESSAGE_REACTION,
    NOTIFICATION_TYPES.MESSAGE_REPLY,
    NOTIFICATION_TYPES.MESSAGE_DELETED,
    NOTIFICATION_TYPES.PARTICIPANT_JOINED,
    NOTIFICATION_TYPES.MAGIC_EVENT,
    NOTIFICATION_TYPES.SCREEN_SHARE,
    NOTIFICATION_TYPES.ACTIVITY_CREATED,
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
  lastActiveTimes: { [userId: number]: string };
  initializationTime: Date | null;
  unreadCallCount: number;
  unreadMessageCount: number;
  unreadSpaceCount: number;
  unreadActivityCount: number;
  unreadChatbotTrainingCount: number;
  unreadModerationCount: number; // ✅ NEW

  isRealtimeReady: boolean;
  currentToastNotification: Notification | null; // ✅ NEW: For showing instant toast

  // Actions
  setCurrentToastNotification: (notif: Notification | null) => void;
  setNotificationPanelVisible: (visible: boolean) => void;
  setIsFollowersPanelVisible: (visible: boolean) => void;
  setCurrentUserId: (userId: number) => void;
  setInitializationTime: (time: Date) => void;
  setLastActiveTime: (time: string, userId?: number) => void;
  setIsRealtimeReady: (ready: boolean) => void;

  // Notification management
  addNotification: (notification: Omit<Notification, 'id' | 'isRead'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  markChatbotNotificationsAsRead: () => void;
  markAllFollowerNotificationsAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  markSpaceNotificationsAsRead: (spaceId: string) => void;
  clearAll: () => void;
  removeSpaceNotifications: (spaceId: string) => void;
  markModerationAsRead: () => void; // ✅ NEW


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
  reset: () => void;
}

// Helper to check if notification is follower type (existing)
const isFollowerNotification = (type: string): boolean => {
  return ['new_follower', 'user_unfollowed', 'new-follower', 'user-unfollowed', 'follow', 'follower', 'Follower'].includes(type);
};



// Add these helper functions
const isCallNotification = (type: string): boolean => {
  return [
    NOTIFICATION_TYPES.CALL_STARTED,
    NOTIFICATION_TYPES.CALL_ENDED,
  ].includes(type);
};

// Messages panel: chat messages, reactions, replies, and deletions
const isMessageNotification = (type: string): boolean => {
  return [
    NOTIFICATION_TYPES.NEW_MESSAGE,
    NOTIFICATION_TYPES.MESSAGE_REACTION,
    NOTIFICATION_TYPES.MESSAGE_REPLY,
    NOTIFICATION_TYPES.MESSAGE_DELETED,  // ✅ NEW
  ].includes(type);
};

// Spaces panel: invitations, updates, space_created
const isSpaceNotification = (type: string): boolean => {
  return [
    NOTIFICATION_TYPES.SPACE_INVITATION,
    NOTIFICATION_TYPES.SPACE_UPDATED,
    NOTIFICATION_TYPES.SPACE_CREATED,
    NOTIFICATION_TYPES.SPACE_DELETED,    // ✅ NEW
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

const isChatbotTrainingNotification = (type: string): boolean => {
  return [
    NOTIFICATION_TYPES.CHATBOT_TRAINING,
    'chatbot-training-needed',
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
      lastActiveTimes: {},
      initializationTime: null,
      unreadCallCount: 0,
      unreadMessageCount: 0,
      unreadSpaceCount: 0,
      unreadActivityCount: 0,
      unreadChatbotTrainingCount: 0,
      unreadModerationCount: 0, // ✅ NEW
      isRealtimeReady: false,
      currentToastNotification: null,

      setCurrentToastNotification: (notif) => set({ currentToastNotification: notif }),
      setNotificationPanelVisible: (visible) => set({ isNotificationPanelVisible: visible }),
      setIsFollowersPanelVisible: (visible) => set({ isFollowersPanelVisible: visible }),
      setCurrentUserId: (userId) => set({ currentUserId: userId }),
      setInitializationTime: (time) => set({ initializationTime: time }),
      setIsRealtimeReady: (ready) => set({ isRealtimeReady: ready }),
      setLastActiveTime: (time, userId) => {
        const id = userId || get().currentUserId;
        if (id) {
          set((state) => ({
            lastActiveTimes: {
              ...state.lastActiveTimes,
              [id]: time
            }
          }));
        }
      },

      addNotification: (notificationData) => {
        const { currentUserId } = get();
        console.log(`📣 addNotification triggered: Type=${notificationData.type}, ActorId=${notificationData.userId}, CurrentUserId=${currentUserId}`);

        // ✅ GLOBAL FILTER: Don't add notifications for events created by the current user
        if (notificationData.userId && currentUserId && notificationData.userId == currentUserId) {
          console.log('🚫 Skipping notification created by self:', notificationData.type);
          return;
        }

        // ✅ Fix empty titles/messages before storing
        if (!notificationData.title) {
          notificationData.title = 'New Notification';
        }
        if (!notificationData.message) {
          notificationData.message = 'You have a new update';
        }

        const newNotification: Notification = {
          ...notificationData,
          id: (notificationData as any).id || Date.now().toString(),
          isRead: false,
          createdAt: notificationData.createdAt || new Date()
        };

        // ✅ Update last seen time to the receipt of this notification 
        // to minimize missed notification gaps on reconnect
        get().setLastActiveTime(newNotification.createdAt.toISOString());

        const isFollower = isFollowerNotification(newNotification.type);
        const isCall = isCallNotification(newNotification.type);
        const isMessage = isMessageNotification(newNotification.type);
        const isSpace = isSpaceNotification(newNotification.type);
        const isActivity = isActivityNotification(newNotification.type);
        const isRegular = !isFollower && !isCall && !isMessage && !isSpace && !isActivity;

        set((state) => {
          const targetArray = isFollower ? state.followerNotifications : state.notifications;

          // ✅ Atomic Duplicate Check
          const isDuplicate = targetArray.some(notif => {
            if (notif.id === newNotification.id) return true;

            const isSameSpaceInv = notif.type === 'space_invitation' && 
                                 newNotification.type === 'space_invitation' && 
                                 String(notif.spaceId) === String(newNotification.spaceId);

            // Stricter check: avoid matching if both are undefined
            const isSameMetadata = notif.type === newNotification.type &&
                                 (notif.postId || newNotification.postId ? notif.postId === newNotification.postId : true) &&
                                 (notif.messageId || newNotification.messageId ? notif.messageId === newNotification.messageId : true) &&
                                 (notif.spaceId || newNotification.spaceId ? notif.spaceId === newNotification.spaceId : true) &&
                                 (notif.commentId || newNotification.commentId ? notif.commentId === newNotification.commentId : true);
            
            // Reduce aggressive 60s window to 3s to only catch actual double-fires / networking echoes
            // legitimate sequential messages from users should be permitted to ping sequentially!
            const withinWindow = Math.abs(new Date(notif.createdAt).getTime() - newNotification.createdAt.getTime()) < 3000;

            return (isSameSpaceInv && Math.abs(new Date(notif.createdAt).getTime() - newNotification.createdAt.getTime()) < 60000) || 
                   (isSameMetadata && withinWindow && (notif.messageId || notif.postId || notif.spaceId)); // Require at least one valid ID if not an invite
          });

          if (isDuplicate) {
            console.log('🔄 Skipping duplicate notification (atomic check):', newNotification.id, `Type: ${newNotification.type}`);
            return state;
          }

          console.log(`🔔 ADDING NOTIFICATION:
            ID: ${newNotification.id}
            Type: ${newNotification.type}
            Title: ${newNotification.title}
            Message: ${typeof newNotification.message === 'string' ? newNotification.message.substring(0, 30) : '[Object]'}...
            UserId (Actor): ${newNotification.userId}
            PostId: ${newNotification.postId}
            isFollower: ${isFollower}, isCall: ${isCall}, isMessage: ${isMessage}, isSpace: ${isSpace}, isActivity: ${isActivity}, isRegular: ${isRegular}
          `);
          
          // Trigger the toast globally
          get().setCurrentToastNotification(newNotification);

          if (isFollower) {
            const newFollowerNotifications = [newNotification, ...state.followerNotifications].slice(0, 50);
            return {
              followerNotifications: newFollowerNotifications,
              unreadFollowerCount: newFollowerNotifications.filter(n => !n.isRead).length,
            };
          } else {
            const newNotifications = [newNotification, ...state.notifications].slice(0, 50);
            return {
              notifications: newNotifications,
              unreadCount: newNotifications.filter(n => !n.isRead && !isCallNotification(n.type) && !isMessageNotification(n.type) && !isSpaceNotification(n.type) && !isActivityNotification(n.type) && !isChatbotTrainingNotification(n.type)).length,
              unreadCallCount: newNotifications.filter(n => !n.isRead && isCallNotification(n.type)).length,
              unreadMessageCount: newNotifications.filter(n => !n.isRead && isMessageNotification(n.type)).length,
              unreadSpaceCount: newNotifications.filter(n => !n.isRead && isSpaceNotification(n.type)).length,
              unreadActivityCount: newNotifications.filter(n => !n.isRead && isActivityNotification(n.type)).length,
              unreadChatbotTrainingCount: newNotifications.filter(n => !n.isRead && isChatbotTrainingNotification(n.type)).length,
              unreadModerationCount: newNotifications.filter(n => !n.isRead && n.type === NOTIFICATION_TYPES.MODERATION_ACTION).length,
            };
          }
        });
      },

      // Add getter methods with self-filtering safety net
      getCalls: () => {
        const { notifications, currentUserId } = get();
        const filtered = notifications.filter(n =>
          isCallNotification(n.type) &&
          !(n.userId && currentUserId && n.userId == currentUserId)
        );
        console.log('📞 Getting call notifications:', filtered.length);
        return filtered;
      },

      getMessages: () => {
        const { notifications, currentUserId } = get();
        const filtered = notifications.filter(n =>
          isMessageNotification(n.type) &&
          !(n.userId && currentUserId && n.userId == currentUserId)
        );
        console.log('💬 Getting message notifications:', filtered.length);
        return filtered;
      },

      getSpaces: () => {
        const { notifications, currentUserId } = get();
        const filtered = notifications.filter(n =>
          isSpaceNotification(n.type) &&
          !(n.userId && currentUserId && n.userId == currentUserId)
        );
        console.log('🌐 Getting space notifications:', filtered.length);
        return filtered;
      },

      getActivities: () => {
        const { notifications, currentUserId } = get();
        const filtered = notifications.filter(n =>
          isActivityNotification(n.type) &&
          !(n.userId && currentUserId && n.userId == currentUserId)
        );
        console.log('✨ Getting activity notifications:', filtered.length);
        return filtered;
      },

      getRegularNotifications: () => {
        const { notifications, currentUserId } = get();
        const filtered = notifications.filter(n =>
          !isFollowerNotification(n.type) &&
          !isCallNotification(n.type) &&
          !isMessageNotification(n.type) &&
          !isSpaceNotification(n.type) &&
          !isActivityNotification(n.type) &&
          !isChatbotTrainingNotification(n.type) &&
          !(n.userId && currentUserId && n.userId == currentUserId)
        );
        console.log('🔔 Getting regular notifications:', filtered.length);
        return filtered;
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

            // Calculate all counts
            const newUnreadCount = updatedNotifications.filter(n => !n.isRead && !isCallNotification(n.type) && !isMessageNotification(n.type) && !isSpaceNotification(n.type) && !isActivityNotification(n.type) && !isChatbotTrainingNotification(n.type)).length;
            const newUnreadCallCount = updatedNotifications.filter(n => !n.isRead && isCallNotification(n.type)).length;
            const newUnreadMessageCount = updatedNotifications.filter(n => !n.isRead && isMessageNotification(n.type)).length;
            const newUnreadSpaceCount = updatedNotifications.filter(n => !n.isRead && isSpaceNotification(n.type)).length;
            const newUnreadActivityCount = updatedNotifications.filter(n => !n.isRead && isActivityNotification(n.type)).length;
            const newUnreadChatbotTrainingCount = updatedNotifications.filter(n => !n.isRead && isChatbotTrainingNotification(n.type)).length;
            const newUnreadModerationCount = updatedNotifications.filter(n => !n.isRead && n.type === NOTIFICATION_TYPES.MODERATION_ACTION).length;

            return {
              notifications: updatedNotifications,
              unreadCount: newUnreadCount,
              unreadCallCount: newUnreadCallCount,
              unreadMessageCount: newUnreadMessageCount,
              unreadSpaceCount: newUnreadSpaceCount,
              unreadActivityCount: newUnreadActivityCount,
              unreadChatbotTrainingCount: newUnreadChatbotTrainingCount,
              unreadModerationCount: newUnreadModerationCount,
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
          unreadCallCount: 0,
          unreadMessageCount: 0,
          unreadSpaceCount: 0,
          unreadActivityCount: 0,
          unreadChatbotTrainingCount: 0,
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

      markChatbotNotificationsAsRead: () => {
        set((state) => {
          const updatedNotifications = state.notifications.map(notif =>
            isChatbotTrainingNotification(notif.type) ? { ...notif, isRead: true } : notif
          );

          const newUnreadCount = updatedNotifications.filter(n => !n.isRead && !isCallNotification(n.type) && !isMessageNotification(n.type) && !isSpaceNotification(n.type) && !isActivityNotification(n.type) && !isChatbotTrainingNotification(n.type)).length;

          return {
            notifications: updatedNotifications,
            unreadCount: newUnreadCount,
            unreadChatbotTrainingCount: 0,
          };
        });
      },

      markModerationAsRead: () => {
        set((state) => {
          const updatedNotifications = state.notifications.map(notif =>
            notif.type === NOTIFICATION_TYPES.MODERATION_ACTION ? { ...notif, isRead: true } : notif
          );

          return {
            notifications: updatedNotifications,
            unreadModerationCount: 0,
          };
        });
      },

      markSpaceNotificationsAsRead: (spaceId: string) => {
        set((state) => {
          const updatedNotifications = state.notifications.map(notif =>
            notif.spaceId === spaceId ? { ...notif, isRead: true } : notif
          );

          // Recalculate all counts
          const newUnreadCount = updatedNotifications.filter(n => !n.isRead && !isCallNotification(n.type) && !isMessageNotification(n.type) && !isSpaceNotification(n.type) && !isActivityNotification(n.type) && !isChatbotTrainingNotification(n.type)).length;
          const newUnreadCallCount = updatedNotifications.filter(n => !n.isRead && isCallNotification(n.type)).length;
          const newUnreadMessageCount = updatedNotifications.filter(n => !n.isRead && isMessageNotification(n.type)).length;
          const newUnreadSpaceCount = updatedNotifications.filter(n => !n.isRead && isSpaceNotification(n.type)).length;
          const newUnreadActivityCount = updatedNotifications.filter(n => !n.isRead && isActivityNotification(n.type)).length;
          const newUnreadChatbotTrainingCount = updatedNotifications.filter(n => !n.isRead && isChatbotTrainingNotification(n.type)).length;

          return {
            notifications: updatedNotifications,
            unreadCount: newUnreadCount,
            unreadCallCount: newUnreadCallCount,
            unreadMessageCount: newUnreadMessageCount,
            unreadSpaceCount: newUnreadSpaceCount,
            unreadActivityCount: newUnreadActivityCount,
            unreadChatbotTrainingCount: newUnreadChatbotTrainingCount,
          };
        });
      },


      removeSpaceNotifications: (spaceId: string) => {
        set((state) => {
          const newNotifications = state.notifications.filter(notif => notif.spaceId !== spaceId);
          const newFollowerNotifications = state.followerNotifications.filter(notif => notif.spaceId !== spaceId);

          // Recalculate all counts
          const newUnreadCount = newNotifications.filter(n => !n.isRead && !isCallNotification(n.type) && !isMessageNotification(n.type) && !isSpaceNotification(n.type) && !isActivityNotification(n.type) && !isChatbotTrainingNotification(n.type)).length;
          const newUnreadCallCount = newNotifications.filter(n => !n.isRead && isCallNotification(n.type)).length;
          const newUnreadMessageCount = newNotifications.filter(n => !n.isRead && isMessageNotification(n.type)).length;
          const newUnreadSpaceCount = newNotifications.filter(n => !n.isRead && isSpaceNotification(n.type)).length;
          const newUnreadActivityCount = newNotifications.filter(n => !n.isRead && isActivityNotification(n.type)).length;
          const newUnreadChatbotTrainingCount = newNotifications.filter(n => !n.isRead && isChatbotTrainingNotification(n.type)).length;
          const newUnreadFollowerCount = newFollowerNotifications.filter(n => !n.isRead).length;

          return {
            notifications: newNotifications,
            followerNotifications: newFollowerNotifications,
            unreadCount: newUnreadCount,
            unreadCallCount: newUnreadCallCount,
            unreadMessageCount: newUnreadMessageCount,
            unreadSpaceCount: newUnreadSpaceCount,
            unreadActivityCount: newUnreadActivityCount,
            unreadChatbotTrainingCount: newUnreadChatbotTrainingCount,
            unreadFollowerCount: newUnreadFollowerCount,
          };
        });
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

            // Calculate all counts
            const newUnreadCount = newNotifications.filter(n => !n.isRead && !isCallNotification(n.type) && !isMessageNotification(n.type) && !isSpaceNotification(n.type) && !isActivityNotification(n.type) && !isChatbotTrainingNotification(n.type)).length;
            const newUnreadCallCount = newNotifications.filter(n => !n.isRead && isCallNotification(n.type)).length;
            const newUnreadMessageCount = newNotifications.filter(n => !n.isRead && isMessageNotification(n.type)).length;
            const newUnreadSpaceCount = newNotifications.filter(n => !n.isRead && isSpaceNotification(n.type)).length;
            const newUnreadActivityCount = newNotifications.filter(n => !n.isRead && isActivityNotification(n.type)).length;
            const newUnreadChatbotTrainingCount = newNotifications.filter(n => !n.isRead && isChatbotTrainingNotification(n.type)).length;
            const newUnreadModerationCount = newNotifications.filter(n => !n.isRead && n.type === NOTIFICATION_TYPES.MODERATION_ACTION).length;

            return {
              notifications: newNotifications,
              unreadCount: newUnreadCount,
              unreadCallCount: newUnreadCallCount,
              unreadMessageCount: newUnreadMessageCount,
              unreadSpaceCount: newUnreadSpaceCount,
              unreadActivityCount: newUnreadActivityCount,
              unreadChatbotTrainingCount: newUnreadChatbotTrainingCount,
              unreadModerationCount: newUnreadModerationCount,
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
        unreadFollowerCount: 0,
        unreadCallCount: 0,
        unreadMessageCount: 0,
        unreadSpaceCount: 0,
        unreadActivityCount: 0,
        unreadChatbotTrainingCount: 0,
      }),

      reset: () => {
        get().disconnectRealtime();
        get().clearAll();
        set({
            isConnected: false,
            currentUserId: null
        });
        console.log('🧹 NotificationStore reset complete');
      },

      initializeRealtime: (token: string, userId: number) => {
        const { isConnected, currentUserId } = get();
        if (isConnected && currentUserId === userId) {
          console.log('ℹ️ Notification real-time already connected for user:', userId);
          return;
        }

        console.log('🔔 INITIALIZING NOTIFICATION REAL-TIME FOR USER:', userId);

        const success = PusherService.initialize(token);

        if (success && userId) {
          PusherService.subscribeToUserNotifications(userId, (notificationData) => {
            console.log('🔔 PUSHER EVENT RECEIVED → ADDING TO STORE:', notificationData);
            get().addNotification(notificationData);
            
            // ✅ Bridge to CollaborationStore if it's a space event
            if (notificationData.spaceId || notificationData.space_id) {
                require('@/stores/collaborationStore').useCollaborationStore.getState().handleSpaceEvent({
                 type: notificationData.type || 'new_message',
                 data: {
                   ...notificationData,
                   space_id: (notificationData.space_id || notificationData.spaceId)?.toString()
                 }
               });
            }
          });

          // ✅ Re-fetch missed notifications on initial connection and any subsequent re-connection
          PusherService.onConnected(() => {
            get().fetchMissedNotifications(token, userId);
          });

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
          // PusherService.unsubscribeFromChannel(`private-user-${currentUserId}`); // This was private
          get().setLastActiveTime(new Date().toISOString(), currentUserId);
        }
        PusherService.disconnect();

        set({ isConnected: false, currentUserId: null });
      },


      fetchMissedNotifications: async (token: string, userId: number) => {
        try {
          const { lastActiveTimes } = get();
          const lastActiveTime = lastActiveTimes[userId];
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
            console.log(`📬 Processing ${missedNotifications.length} missed notifications in reverse (oldest first)`);
            [...missedNotifications].reverse().forEach((notification: any) => {
              // Extract type and data
              const type = notification.type;
              const notifData = notification.data || notification;

              // Create properly formatted notification for store
              let formattedNotification: any = {
                id: notification.id || Date.now().toString(),
                type: type,
                title: notification.title || 'New Notification',
                message: notification.message || 'You have a new update',
                userId: notification.userId || notifData.userId || notifData.user_id,
                data: notifData,
                isRead: !!notification.read_at,
                createdAt: new Date(notification.created_at || notification.createdAt),
              };

              // 1. SPACE INVITATIONS
              if (type === 'space-invitation' || type === 'space_invitation' || type.includes('SpaceInvitation')) {
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
              else if (type === 'new_follower' || type === 'App\\Events\\NewFollower') {
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
              else if (type === 'comment' || type === 'App\\Events\\NewComment' || type === 'NewComment') {
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

              // 5. MODERATION ACTIONS
              else if (type === 'moderation_action' || type === NOTIFICATION_TYPES.MODERATION_ACTION || type.includes('ModerationAction')) {
                formattedNotification = {
                  ...formattedNotification,
                  type: NOTIFICATION_TYPES.MODERATION_ACTION,
                  title: 'Administration',
                  message: notifData.message || notification.message || 'A moderation action has been taken.',
                  data: notifData,
                };
              }

              // 5. REACTIONS
              else if (type === 'reaction' || type === 'App\\Events\\NewReaction' || type === 'NewReaction') {
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

              // 5. VIOLATIONS (Admin only)
              else if (type === 'violation_reported' || type.includes('ViolationReported')) {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'violation_reported',
                  title: notification.title || '🚨 Violation Alert',
                  message: notification.message || 'New high-severity violation detected',
                  severity: notifData.severity,
                  reportId: notifData.reportId,
                  data: notifData,
                };
              }

              // 4b. MESSAGE REACTIONS
              else if (type === 'message_reaction' || type.includes('MessageReacted')) {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'message_reaction',
                  title: notifData.title || 'New Reaction',
                  message: notifData.message || 'Someone reacted to your message',
                  spaceId: notifData.spaceId || notifData.space_id,
                  messageId: notifData.messageId || notifData.message_id || notifData.message?.id,
                  userId: notifData.userId || notifData.user_id || notifData.user?.id,
                  avatar: notifData.avatar || notifData.profile_photo || notifData.user?.profile_photo,
                  data: notifData,
                };
              }

              // 4c. MESSAGE REPLIES
              else if (type === 'message_reply' || type.includes('MessageReplied')) {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'message_reply',
                  title: notifData.title || 'New Reply',
                  message: notifData.message || 'Someone replied to your message',
                  spaceId: notifData.spaceId || notifData.space_id,
                  messageId: notifData.messageId || notifData.message_id || notifData.replyId,
                  userId: notifData.userId || notifData.user_id || notifData.user?.id,
                  avatar: notifData.avatar || notifData.profile_photo || notifData.user?.profile_photo,
                  data: notifData,
                };
              }

              // 5. POST UPDATES
              else if (type === 'post_updated' || type === 'App\\Events\\PostUpdated' || type === 'post-updated') {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'post_updated',
                  title: 'Post Updated',
                  message: notifData.message || 'A post was updated',
                  postId: notifData.postId,
                  userId: notifData.userId,
                  avatar: notifData.avatar || notifData.profile_photo,
                  data: notifData,
                };
              }

              // 6. POST DELETED
              else if (type === 'post_deleted' || type === 'App\\Events\\PostDeleted' || type === 'post-deleted') {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'post_deleted',
                  title: 'Post Deleted',
                  message: notifData.message || 'A post was deleted',
                  postId: notifData.postId,
                  data: notifData,
                };
              }

              // 6b. NEW POSTS
              else if (type === 'new_post' || type === 'App\\Events\\NewPost' || type === 'new-post') {
                const postData = notifData.post || notifData;
                const author = postData.user || {};

                formattedNotification = {
                  ...formattedNotification,
                  type: 'new_post',
                  title: notifData.title || 'New Post',
                  message: notifData.message || `${author.name || 'Someone'} created a new post`,
                  postId: postData.id,
                  userId: author.id || postData.user_id,
                  avatar: author.profile_photo,
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
              else if (type === 'new_message' || type.includes('NewMessage')) {
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

              // 11. CHATBOT TRAINING
              else if (type === 'chatbot_training' || type.includes('ChatbotTraining')) {
                formattedNotification = {
                  ...formattedNotification,
                  type: 'chatbot_training',
                  title: 'Chatbot Training Needed',
                  message: `New training data: "${notifData.question || 'New prompt'}"`,
                  data: notifData,
                  question: notifData.question,
                  category: notifData.category,
                  keywords: notifData.keywords,
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
        console.log('👥 Getting follower notifications:', followerNotifications);
        return followerNotifications;
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
        lastActiveTimes: state.lastActiveTimes,
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
          
          // RECALCULATE SPECIFIC BADGE COUNTS ON STARTUP
          state.unreadCallCount = state.notifications.filter(n => !n.isRead && isCallNotification(n.type)).length;
          state.unreadMessageCount = state.notifications.filter(n => !n.isRead && isMessageNotification(n.type)).length;
          state.unreadSpaceCount = state.notifications.filter(n => !n.isRead && isSpaceNotification(n.type)).length;
          state.unreadActivityCount = state.notifications.filter(n => !n.isRead && isActivityNotification(n.type)).length;
          state.unreadChatbotTrainingCount = state.notifications.filter(n => !n.isRead && isChatbotTrainingNotification(n.type)).length;
        }
      },
    }
  )
);