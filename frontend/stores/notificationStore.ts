import { create } from 'zustand';
import { Notification, NotificationState } from '@/types/Notification';
import PusherService from '@/services/PusherService';

interface NotificationStore extends NotificationState {
  initializationTime: Date | null;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  setNotificationPanelVisible: (visible: boolean) => void;
  initializeRealtime: (token: string) => void;
  disconnectRealtime: () => void;
  setInitializationTime: (time: Date) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isNotificationPanelVisible: false,
  initializationTime: null,

  // FIX: Only ONE addNotification method
  addNotification: (notificationData) => {
    const now = new Date();
    const { initializationTime } = get();
    
    // ONLY add notifications that occur AFTER initialization time
    if (initializationTime && notificationData.createdAt < initializationTime) {
      console.log('🔔 Ignoring old notification (before initialization)');
      return;
    }

    const newNotification: Notification = {
      id: Date.now().toString(),
      ...notificationData,
      createdAt: now,
      isRead: false
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1
    }));

    // Show toast notification for 3 seconds
    get().showTemporaryNotification(newNotification);
  },

  // REMOVE THIS DUPLICATE METHOD:
  // addNotification: (notificationData) => {
  //   const newNotification: Notification = {
  //     id: Date.now().toString(),
  //     ...notificationData,
  //     createdAt: new Date(),
  //     isRead: false
  //   };
  //
  //   set((state) => ({
  //     notifications: [newNotification, ...state.notifications],
  //     unreadCount: state.unreadCount + 1
  //   }));
  //
  //   get().showTemporaryNotification(newNotification);
  // },

  markAsRead: (notificationId) => {
    set((state) => ({
      notifications: state.notifications.map(notif =>
        notif.id === notificationId ? { ...notif, isRead: true } : notif
      ),
      unreadCount: Math.max(0, state.unreadCount - 1)
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map(notif => ({ ...notif, isRead: true })),
      unreadCount: 0
    }));
  },

  removeNotification: (notificationId) => {
    set((state) => {
      const notification = state.notifications.find(n => n.id === notificationId);
      const wasUnread = notification && !notification.isRead;
      
      return {
        notifications: state.notifications.filter(n => n.id !== notificationId),
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      };
    });
  },

  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  setNotificationPanelVisible: (visible) => {
    set({ isNotificationPanelVisible: visible });
    
    if (visible) {
      get().markAllAsRead();
    }
  },

  initializeRealtime: (token: string) => {
    const { addNotification, setInitializationTime } = get();

    // Set initialization time FIRST
    const initTime = new Date();
    setInitializationTime(initTime);
    console.log('🔔 Notification system initialized at:', initTime.toISOString());

    // Initialize Pusher for notifications
    PusherService.initialize(token);

    // FIX: Get actual user ID - you need to replace this with your actual user ID
    // If your user object has an ID, you'll need to pass it here
    const currentUserId = 1; // TODO: Replace with actual user ID
    
    console.log('🔔 Subscribing to notifications for user:', currentUserId);

    PusherService.subscribeToUserNotifications(currentUserId, (notificationData) => {
      console.log('🔔 Received real-time notification:', notificationData);
      addNotification(notificationData);
    });
  },

  disconnectRealtime: () => {
    console.log('🔔 Disconnecting notification real-time');
    // FIX: Add proper cleanup
    const currentUserId = 1; // TODO: Replace with actual user ID
    PusherService.unsubscribeFromUserNotifications(currentUserId);
  },

  setInitializationTime: (time: Date) => {
    set({ initializationTime: time });
  },

  showTemporaryNotification: (notification: Notification) => {
    console.log('🔔 Showing temporary notification:', notification.message);
  }
}));