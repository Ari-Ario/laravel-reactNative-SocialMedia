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
  unreadCount: number;
  isNotificationPanelVisible: boolean;
  isConnected: boolean;
  currentUserId: number | null;
  lastActiveTime: string | null;
  initializationTime: Date | null;

  // Actions
  setNotificationPanelVisible: (visible: boolean) => void;
  setCurrentUserId: (userId: number) => void;
  setInitializationTime: (time: Date) => void;
  setLastActiveTime: (time: string) => void;
  
  // Notification management
  addNotification: (notification: Omit<Notification, 'id' | 'isRead'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAll: () => void;
  
  // Real-time
  initializeRealtime: (token: string, userId: number) => void;
  disconnectRealtime: () => void;
  
  // Missed notifications
  fetchMissedNotifications: (token: string, userId: number) => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      isNotificationPanelVisible: false,
      isConnected: false,
      currentUserId: null,
      lastActiveTime: null,
      initializationTime: null,

      setNotificationPanelVisible: (visible) => set({ isNotificationPanelVisible: visible }),
      
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

        // Prevent duplicates
        const { notifications } = get();
        const isDuplicate = notifications.some(notif => 
          notif.id === newNotification.id || 
          (notif.type === newNotification.type && 
           notif.postId === newNotification.postId && 
           notif.commentId === newNotification.commentId &&
           Math.abs(new Date(notif.createdAt).getTime() - newNotification.createdAt.getTime()) < 60000) // Within 1 minute
        );

        if (isDuplicate) {
          console.log('🔄 Skipping duplicate notification:', newNotification.id);
          return;
        }

        console.log('🔔 ADDING NOTIFICATION TO STORE:', newNotification);

        set((state) => {
          const newNotifications = [newNotification, ...state.notifications].slice(0, 50); // Keep only latest 50
          const newUnreadCount = newNotifications.filter(n => !n.isRead).length;
          
          console.log('🔔 STORE UPDATED - Total:', newNotifications.length, 'Unread:', newUnreadCount);
          
          return {
            notifications: newNotifications,
            unreadCount: newUnreadCount
          };
        });
      },

      markAsRead: (notificationId) => {
        set((state) => {
          const updatedNotifications = state.notifications.map(notif =>
            notif.id === notificationId ? { ...notif, isRead: true } : notif
          );
          
          const newUnreadCount = updatedNotifications.filter(n => !n.isRead).length;
          
          return {
            notifications: updatedNotifications,
            unreadCount: newUnreadCount
          };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map(notif => ({ ...notif, isRead: true })),
          unreadCount: 0
        }));
        
        // Update last active time when marking all as read
        get().setLastActiveTime(new Date().toISOString());
      },

      removeNotification: (notificationId) => {
        set((state) => {
          const notificationToRemove = state.notifications.find(n => n.id === notificationId);
          const wasUnread = notificationToRemove?.isRead === false;
          
          const newNotifications = state.notifications.filter(n => n.id !== notificationId);
          const newUnreadCount = wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount;
          
          return {
            notifications: newNotifications,
            unreadCount: newUnreadCount
          };
        });
      },

      clearAll: () => set({ notifications: [], unreadCount: 0 }),

      initializeRealtime: (token: string, userId: number) => {
        console.log('🔔 INITIALIZING NOTIFICATION REAL-TIME FOR USER:', userId);
        
        const success = PusherService.initialize(token);
        
        if (success && userId) {
          // Subscribe to user notifications
          PusherService.subscribeToUserNotifications(userId, (notificationData) => {
            console.log('🔔 PUSHER EVENT RECEIVED → ADDING TO STORE:', notificationData);
            
            // Add to store
            get().addNotification(notificationData);
          });
          
          // Fetch missed notifications
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
        
        // Set last active time when disconnecting
        get().setLastActiveTime(new Date().toISOString());
        
        set({ isConnected: false, currentUserId: null });
      },

      fetchMissedNotifications: async (token: string, userId: number) => {
        try {
          const { lastActiveTime } = get();
          const apiUrl = getApiBase() || 'http://localhost:8000'; // Fallback URL
          const url = `${apiUrl}/notifications/missed`;
          const tokken = await getToken();
          console.log('📬 Fetching missed notifications from:', url, 'since:', lastActiveTime);

          const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              last_seen_time: lastActiveTime || undefined,
            },
            timeout: 10000, // 10-second timeout
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

          // Update last active time
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

          // Retry once after a delay if network error
          if (error.code === 'ERR_NETWORK' && !get().isConnected) {
            console.log('🔄 Retrying fetchMissedNotifications in 5 seconds...');
            setTimeout(() => get().fetchMissedNotifications(token, userId), 5000);
          }
        }
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
        unreadCount: state.unreadCount,
        lastActiveTime: state.lastActiveTime,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.notifications = state.notifications.map(notif => ({
            ...notif,
            createdAt: new Date(notif.createdAt)
          }));
        }
      },
    }
  )
);