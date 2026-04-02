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
   * Initialize the notification service
   */
  public async initialize() {
    if (this.isInitialized) return;

    try {
      const token = await this.registerForPushNotificationsAsync();
      
      if (token) {
        await this.registerTokenWithBackend(token);
      }

      this.setupNotificationListeners();
      this.isInitialized = true;
      console.log('✅ PushNotificationService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PushNotificationService:', error);
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
    // === WEB PATH: Use direct VAPID browser subscription, skip Expo token server entirely ===
    // This eliminates the CORS error from exp.host. We send the raw Web Push subscription
    // to our own Laravel backend, which then uses VAPID to send notifications directly.
    if (Platform.OS === 'web') {
      return await this.subscribeWebPushAsync();
    }

    // === NATIVE PATH (iOS / Android) ===
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
      console.log('✅ Expo Push Token acquired:', response.data);
      return response.data;
    } catch (err) {
      console.error('Error getting Expo push token:', err);
      return null;
    }
  }

  /**
   * Web-only: Subscribe via browser Push API using VAPID keys.
   * Returns a JSON string of the PushSubscription that our backend can send to.
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
      console.warn('EXPO_PUBLIC_VAPID_PUBLIC_KEY is not defined in .env');
      return null;
    }

    try {
      // Request notification permission first
      const permResult = await Notification.requestPermission();
      if (permResult !== 'granted') {
        console.warn('Web push permission denied by user.');
        return null;
      }

      // Register and wait for service worker
      await navigator.serviceWorker.register('/expo-service-worker.js');
      const registration = await navigator.serviceWorker.ready;

      // Get existing or create new subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey) as any,
        });
        console.log('✅ New Web Push subscription created');
      } else {
        console.log('ℹ️ Reusing existing Web Push subscription');
      }

      // Cache the endpoint to detect if the subscription changed
      this.cachedWebEndpoint = subscription.endpoint;

      // Return as JSON string — our backend receives this as device_token
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
