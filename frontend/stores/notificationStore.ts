// stores/notificationStore.ts - FIXED VERSION
import { create } from 'zustand';
import PusherService from '@/services/PusherService';

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

  // Actions
  setNotificationPanelVisible: (visible: boolean) => void;
  setCurrentUserId: (userId: number) => void;
  
  // ✅ FIXED: Notification management
  addNotification: (notification: Omit<Notification, 'id' | 'isRead'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  initializationTime: Date | null;
  setInitializationTime: (time: Date) => void;
  clearAll: () => void;
  
  // ✅ FIXED: Real-time initialization
  initializeRealtime: (token: string, userId: number) => void;
  disconnectRealtime: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isNotificationPanelVisible: false,
  isConnected: false,
  currentUserId: null,
  initializationTime: null,


  setNotificationPanelVisible: (visible) => set({ isNotificationPanelVisible: visible }),
  
  setCurrentUserId: (userId) => set({ currentUserId: userId }),
  setInitializationTime: (time) => set({ initializationTime: time }),

  // ✅ FIXED: This is the key function that updates the store
  addNotification: (notificationData) => {
    const newNotification: Notification = {
      ...notificationData,
      id: Date.now().toString(), // Generate unique ID
      isRead: false,
      createdAt: notificationData.createdAt || new Date()
    };

    console.log('🔔 ADDING NOTIFICATION TO STORE:', newNotification);

    set((state) => {
      const newNotifications = [newNotification, ...state.notifications];
      const newUnreadCount = state.unreadCount + 1;
      
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
      
      console.log('🔔 Marked as read - Unread count:', newUnreadCount);
      
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

  // ✅ FIXED: This connects Pusher events to the store
  initializeRealtime: (token: string, userId: number) => {
    console.log('🔔 INITIALIZING NOTIFICATION REAL-TIME FOR USER:', userId);
    
    const success = PusherService.initialize(token);
    
    if (success && userId) {
      // ✅ CRITICAL: Subscribe to user notifications and connect to store
      PusherService.subscribeToUserNotifications(userId, (notificationData) => {
        console.log('🔔 PUSHER EVENT RECEIVED → ADDING TO STORE:', notificationData);
        
        // ✅ This is what was missing - add to store!
        get().addNotification(notificationData);
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
    }
    PusherService.disconnect();
    set({ isConnected: false, currentUserId: null });
  },
}));