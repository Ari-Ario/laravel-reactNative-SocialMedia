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
  avatar?: string;
}

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
}

// Helper function to check if a notification is a follower type
const isFollowerNotification = (type: string): boolean => {
  return ['new_follower', 'user_unfollowed', 'new-follower', 'user-unfollowed', 'follow'].includes(type);
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

      setNotificationPanelVisible: (visible) => set({ isNotificationPanelVisible: visible }),
      setIsFollowersPanelVisible: (visible) => set({ isFollowersPanelVisible: visible }),
      setCurrentUserId: (userId) => set({ currentUserId: userId }),
      setInitializationTime: (time) => set({ initializationTime: time }),
      setLastActiveTime: (time) => set({ lastActiveTime: time }),

      addNotification: (notificationData) => {
        const newNotification: Notification = {
          ...notificationData,
          id: notificationData.id || Date.now().toString(),
          isRead: false,
          createdAt: notificationData.createdAt || new Date()
        };

        const isFollower = isFollowerNotification(newNotification.type);

        // Prevent duplicates - check in the appropriate array
        const { notifications, followerNotifications } = get();
        const targetArray = isFollower ? followerNotifications : notifications;
        
        const isDuplicate = targetArray.some(notif => 
          notif.id === newNotification.id || 
          (notif.type === newNotification.type && 
           notif.postId === newNotification.postId && 
           notif.commentId === newNotification.commentId &&
           Math.abs(new Date(notif.createdAt).getTime() - newNotification.createdAt.getTime()) < 60000)
        );

        if (isDuplicate) {
          console.log('🔄 Skipping duplicate notification:', newNotification.id);
          return;
        }

        console.log('🔔 ADDING NOTIFICATION TO STORE:', newNotification.type, 'isFollower:', isFollower);

        set((state) => {
          if (isFollower) {
            // Add to follower notifications (newest first)
            const newFollowerNotifications = [newNotification, ...state.followerNotifications].slice(0, 50);
            const newUnreadFollowerCount = newFollowerNotifications.filter(n => !n.isRead).length;
            
            console.log('🔔 FOLLOWER STORE UPDATED - Total:', newFollowerNotifications.length, 'Unread:', newUnreadFollowerCount);
            
            return {
              followerNotifications: newFollowerNotifications,
              unreadFollowerCount: newUnreadFollowerCount,
              notifications: state.notifications,
              unreadCount: state.unreadCount
            };
          } else {
            // Add to regular notifications (newest first)
            const newNotifications = [newNotification, ...state.notifications].slice(0, 50);
            const newUnreadCount = newNotifications.filter(n => !n.isRead).length;
            
            console.log('🔔 REGULAR STORE UPDATED - Total:', newNotifications.length, 'Unread:', newUnreadCount);
            
            return {
              notifications: newNotifications,
              unreadCount: newUnreadCount,
              followerNotifications: state.followerNotifications,
              unreadFollowerCount: state.unreadFollowerCount
            };
          }
        });
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
          const tokken = await getToken();
          console.log('📬 Fetching missed notifications from:', url, 'since:', lastActiveTime);

          const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              last_seen_time: lastActiveTime || undefined,
            },
            timeout: 10000,
          });

          const missedNotifications = response.data;
          console.log('📬 Found missed notifications:', missedNotifications);

          if (missedNotifications.length > 0) {
            missedNotifications.forEach((notification: any) => {
              get().addNotification({
                ...notification,
                createdAt: new Date(notification.createdAt),
              });
            });
          }

          get().setLastActiveTime(new Date().toISOString());
        } catch (error: any) {
          console.error('❌ Error fetching missed notifications:', {
            message: error.message,
            code: error.code,
            config: error.config,
            response: error.response ? {
              status: error.response.status,
              data: error.response.data,
            } : null,
          });

          if (error.code === 'ERR_NETWORK' && !get().isConnected) {
            console.log('🔄 Retrying fetchMissedNotifications in 5 seconds...');
            setTimeout(() => get().fetchMissedNotifications(token, userId), 5000);
          }
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