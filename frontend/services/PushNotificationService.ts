import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import axios from 'axios';
import { router } from 'expo-router';
import { getToken } from '@/services/TokenService';
import getApiBase from '@/services/getApiBase';

// Configure how notifications are handled when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class PushNotificationService {
  private static instance: PushNotificationService;
  private isInitialized = false;
  // Cache the current subscription to avoid redundant re-registrations
  private cachedWebEndpoint: string | null = null;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize the notification service.
   * On web/iOS, we only check for existing registration to avoid blocking permission errors.
   */
  public async initialize() {
    if (this.isInitialized) return;

    try {
      if (Platform.OS === 'web') {
        // Just register the worker so it's ready, but don't prompt for permission yet
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.register('/sw.js');
          const registration = await navigator.serviceWorker.ready;
          
          // Check if we already have a subscription
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            this.cachedWebEndpoint = subscription.endpoint;
            await this.registerTokenWithBackend(JSON.stringify(subscription.toJSON()));
          }
        }
      } else {
        const token = await this.registerForPushNotificationsAsync();
        if (token) {
          await this.registerTokenWithBackend(token);
        }
      }

      this.setupNotificationListeners();
      this.isInitialized = true;
      console.log('✅ PushNotificationService initialized');
    } catch (error) {
      console.error('Failed to initialize PushNotificationService:', error);
    }
  }

  /**
   * Public method to request permission and subscribe.
   * MUST be called from a user gesture (e.g., button click) for iOS compatibility.
   */
  public async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        const token = await this.subscribeWebPushAsync();
        if (token) {
          await this.registerTokenWithBackend(token);
          return true;
        }
        return false;
      } else {
        const token = await this.registerForPushNotificationsAsync();
        if (token) {
          await this.registerTokenWithBackend(token);
          return true;
        }
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Get auth headers for backend requests
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const authToken = await getToken();
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  /**
   * Register for push notifications and return the token
   */
  private async registerForPushNotificationsAsync(): Promise<string | null> {
    // Legacy support for initialize() calling this
    if (Platform.OS === 'web') {
      return await this.subscribeWebPushAsync();
    }

    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }

    try {
      const response = await Notifications.getExpoPushTokenAsync({
        projectId: 'c240eb93-f893-4faf-bb24-46b6f670501d',
      });
      return response.data;
    } catch (err) {
      console.error('Error getting Expo push token:', err);
      return null;
    }
  }

  /**
   * Web-only: Subscribe via browser Push API using VAPID keys.
   */
  private async subscribeWebPushAsync(): Promise<string | null> {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      console.log('Push notifications are not supported in this browser.');
      return null;
    }

    const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn('EXPO_PUBLIC_VAPID_PUBLIC_KEY is not defined');
      return null;
    }

    try {
      // Trigger the prompt (User Gesture required on iOS)
      const permResult = await Notification.requestPermission();
      if (permResult !== 'granted') return null;

      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      this.cachedWebEndpoint = subscription.endpoint;
      return JSON.stringify(subscription.toJSON());
    } catch (error) {
      console.error('Web Push subscription failed:', error);
      return null;
    }
  }

  /**
   * Utility for VAPID key conversion
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Push token to Laravel backend with auth header
   */
  private async registerTokenWithBackend(token: string) {
    try {
      const headers = await this.getAuthHeaders();
      const apiBase = getApiBase();
      await axios.post(
        `${apiBase}/notifications/register-device`,
        {
          device_token: token,
          device_type: Platform.OS === 'web' ? 'web' : (Platform.OS === 'ios' ? 'ios' : 'android'),
          device_name: Platform.OS === 'web' ? (navigator.userAgent.slice(0, 100)) : 'Mobile Device',
        },
        { headers }
      );
      console.log('✅ Device registered with backend');
    } catch (error) {
      console.error('Error registering token with backend:', error);
    }
  }

  /**
   * Setup listeners for notification events
   */
  private setupNotificationListeners() {
    Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notification received in foreground:', notification);
    });

    Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      this.handleNotificationNavigation(data);
    });
  }

  /**
   * Handle navigation based on notification data
   */
  private handleNotificationNavigation(data: any) {
    if (!data) return;

    const { type, spaceId, postId, userId } = data;

    switch (type) {
      case 'call':
      case 'incoming_call':
        if (spaceId) router.push(`/(spaces)/${spaceId}?tab=meeting`);
        break;
      case 'message':
      case 'message_reply':
      case 'message_reaction':
        if (spaceId) router.push(`/(spaces)/${spaceId}`);
        break;
      case 'space_invitation':
        if (spaceId) router.push(`/(spaces)/${spaceId}`);
        break;
      case 'post_reaction':
      case 'new_comment':
        if (postId) router.push(`/post/${postId}`);
        break;
      case 'new_follower':
        if (userId) router.push(`/profile/${userId}`);
        break;
      default:
        console.log('Unknown notification type:', type);
    }
  }

  /**
   * Unregister current device (logout cleanup)
   */
  public async unregister() {
    try {
      const headers = await this.getAuthHeaders();
      const apiBase = getApiBase();

      if (Platform.OS === 'web') {
        // Unsubscribe the browser and send the endpoint to the backend
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            const tokenJson = JSON.stringify(subscription.toJSON());
            await subscription.unsubscribe();
            await axios.post(
              `${apiBase}/notifications/unregister-device`,
              { device_token: tokenJson },
              { headers }
            );
          }
        }
      } else {
        const token = await this.registerForPushNotificationsAsync();
        if (token) {
          await axios.post(
            `${apiBase}/notifications/unregister-device`,
            { device_token: token },
            { headers }
          );
        }
      }

      this.isInitialized = false;
      this.cachedWebEndpoint = null;
      console.log('✅ Push notifications unregistered');
    } catch (error) {
      console.error('Error unregistering push notifications:', error);
    }
  }
}

export default PushNotificationService.getInstance();
