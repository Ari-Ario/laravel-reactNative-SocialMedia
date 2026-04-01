import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';
import { router } from 'expo-router';

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
      // 1. Request permissions and get token
      const token = await this.registerForPushNotificationsAsync();
      
      if (token) {
        // 2. Register token with backend
        await this.registerTokenWithBackend(token);
      }

      // 3. Listen for notification interactions (Deep linking)
      this.setupNotificationListeners();

      this.isInitialized = true;
      console.log('PushNotificationService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PushNotificationService:', error);
    }
  }

  /**
   * Register for push notifications and return the token
   */
  private async registerForPushNotificationsAsync(): Promise<string | null> {
    let token: string | null = null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice || Platform.OS === 'web') {
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
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? 
                          'c240eb93-f893-4faf-bb24-46b6f670501d';
        
        // Final identity refinement for CORS: Use the experience name (@owner/slug) 
        // if possible, otherwise fallback to the slug ('zmzir'). 
        // For anonymous projects, '@anonymous/zmzir' is the standard format.
        const owner = Constants.expoConfig?.owner || 'anonymous';
        const slug = Constants.expoConfig?.slug || 'zmzir';
        const applicationId = Platform.OS === 'web' 
          ? (owner === 'anonymous' ? `@anonymous/${slug}` : slug) 
          : projectId;

        let devicePushToken: any = undefined;

        // MANUAL BYPASS FOR WEB: Hand-roll the browser subscription
        // This avoids the 'getDevicePushTokenAsync is not a function' bug in expo-notifications
        if (Platform.OS === 'web') {
          console.log('Web platform detected, manually registering push subscription...');
          devicePushToken = await this.subscribeWebPushAsync();
          if (!devicePushToken) return null;
        }

        let response = null;
        try {
          console.log(`Attempting Expo token fetch with identity: ${applicationId}`);
          response = await Notifications.getExpoPushTokenAsync({
              projectId,
              applicationId, // Refined for Web/Expo identity
              devicePushToken, // Providing this skips the broken internal call
              // @ts-ignore: vapidKey is required for web but missing from type definitions
              vapidKey: process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY,
          });
        } catch (err) {
          console.warn('Expo server unreachable (CORS/Network). Falling back to direct Web Push (VAPID)...', err);
          // FALLBACK: If Expo server fails, use the raw browser subscription data as the token.
          // This ensures the device is still registered for direct background push.
          return devicePushToken ? JSON.stringify(devicePushToken) : null;
        }

        if (response && response.data) {
          console.log('✅ Expo Push Token acquired successfuly');
          token = response.data;
        }
      } catch (err) {
        console.error('Error getting Expo push token:', err);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  /**
   * Helper to perform manual browser push subscription (Web only)
   */
  private async subscribeWebPushAsync(): Promise<any | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
       console.log('Push notifications are not supported in this browser.');
       return null;
    }

    const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn('VAPID Public Key missing in .env');
      return null;
    }

    try {
      // 1. Get or register service worker
      await navigator.serviceWorker.register('/expo-service-worker.js');
      
      // 2. Wait for the service worker to be ready (IMPORTANT: avoids registration race conditions)
      const registration = await navigator.serviceWorker.ready;

      // 3. Subscribe or get current subscription
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const subscribeOptions = {
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
        };
        subscription = await registration.pushManager.subscribe(subscribeOptions);
      }

      // 4. Format as WebDevicePushToken expected by Expo
      return {
        type: 'web',
        data: subscription.toJSON() // Explicitly return the standard JSON subscription
      };
    } catch (error) {
      console.error('Manual Web Push subscription failed:', error);
      return null;
    }
  }

  /**
   * Utility for VAPID key conversion
   */
  private urlBase64ToUint8Array(base64String: string) {
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
   * Push the token to our Laravel backend
   */
  private async registerTokenWithBackend(token: string) {
    try {
      await axios.post('/notifications/register-device', {
        device_token: token,
        device_type: Platform.OS === 'web' ? 'web' : (Platform.OS === 'ios' ? 'ios' : 'android'),
        device_name: Device.modelName || 'Web Browser',
      });
    } catch (error) {
      console.error('Error registering token with backend:', error);
    }
  }

  /**
   * Setup listeners for notification events
   */
  private setupNotificationListeners() {
    // This listener is fired whenever a notification is received while the app is foregrounded
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
    });

    // This listener is fired whenever a user taps on or interacts with a notification 
    // (works when app is foregrounded, backgrounded, or killed)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      this.handleNotificationNavigation(data);
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }

  /**
   * Handle navigation based on notification data
   */
  private handleNotificationNavigation(data: any) {
    console.log('Handling notification navigation with data:', data);
    
    if (!data) return;

    const { type, spaceId, postId, commentId, userId } = data;

    switch (type) {
      case 'message':
      case 'message_reply':
      case 'message_reaction':
        if (spaceId) {
          router.push(`/(tabs)/spaces/${spaceId}`);
        }
        break;
      case 'space_invitation':
        if (spaceId) {
            router.push(`/(tabs)/spaces/${spaceId}`);
        }
        break;
      case 'post_reaction':
      case 'new_comment':
        if (postId) {
          router.push(`/post/${postId}`);
        }
        break;
      case 'new_follower':
        if (userId) {
          router.push(`/profile/${userId}`);
        }
        break;
      default:
        console.log('Unknown notification type or no route defined:', type);
        break;
    }
  }

  /**
   * Unregister current device (logout cleanup)
   */
  public async unregister() {
    try {
      const token = await this.registerForPushNotificationsAsync();
      if (token) {
        await axios.post('/notifications/unregister-device', {
          device_token: token,
        });
      }
      this.isInitialized = false;
    } catch (error) {
      console.error('Error unregistering push notifications:', error);
    }
  }
}

export default PushNotificationService.getInstance();
