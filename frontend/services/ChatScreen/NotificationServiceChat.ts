import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Alert } from 'react-native';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

interface NotificationData {
  title: string;
  body: string;
  data?: any;
  channelId?: string;
}

class NotificationService {
  private static instance: NotificationService;
  private token: string | null = null;
  private expoPushToken: string | null = null;
  private isConfigured = false;

  private constructor() { }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async configure() {
    if (this.isConfigured) return;

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Permission required', 'Push notifications are needed for real-time updates');
        return;
      }

      // Get device token
      if (Platform.OS !== 'web' && Device.isDevice) {
        const token = (await Notifications.getExpoPushTokenAsync({
          projectId: 'your-project-id', // Add your project ID
        })).data;

        this.expoPushToken = token;
        await this.registerToken(token);
      } else if (Platform.OS !== 'web') {
        console.log('Must use physical device for push notifications');
      }

      // Handle notifications when app is in foreground
      if (Platform.OS !== 'web') {
        Notifications.addNotificationReceivedListener(notification => {
          console.log('Notification received:', notification);
          // You could update local state here
        });

        // Handle notification responses
        Notifications.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;
          this.handleNotificationTap(data);
        });
      }

      this.isConfigured = true;
    } catch (error) {
      console.error('Notification configuration error:', error);
    }
  }

  private async registerToken(token: string) {
    try {
      const userToken = await getToken();
      const API_BASE = getApiBase();

      await fetch(`${API_BASE}/notifications/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          device_token: token,
          device_type: Platform.OS,
          device_name: Device.deviceName,
        }),
      });
    } catch (error) {
      console.error('Failed to register device token:', error);
    }
  }

  async scheduleLocalNotification(data: NotificationData) {
    if (Platform.OS === 'web') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: data.title,
        body: data.body,
        data: data.data || {},
        sound: true,
        badge: 1,
      },
      trigger: null, // Send immediately
    });
  }

  private handleNotificationTap(data: any) {
    console.log('Push Notification tapped with metadata: ', data);

    // Normalize properties from the push notification payload
    const type = data.type || data.notificationType;
    const spaceId = data.spaceId || data.space_id;
    const userId = data.userId || data.user_id;
    const magicEventId = data.id || data.eventId || data.magic_id;

    // Handle navigation based on notification type or available IDs

    // 1. Prioritize Magic Event routing first if there is a specific magic query param
    if (type === 'magic_event' && spaceId) {
      import('expo-router').then(({ router }) => {
        router.push(`/(spaces)/${spaceId}?magic=${magicEventId}`);
      });
      return;
    }

    // 2. If it belongs to a Space (e.g., poll, message, activity, invitation), route there directly!
    if (spaceId) {
      import('expo-router').then(({ router }) => {
        router.push(`/(spaces)/${spaceId}`);
      });
      return;
    }

    // 3. Fallback to basic types (e.g., direct chat message)
    switch (type) {
      case 'new_message':
        if (userId) {
          import('expo-router').then(({ router }) => {
            router.push(`/(tabs)/chats/${userId}`);
          });
        }
        break;
      // Add other fallback cases as needed when spaceId is not present
    }
  }

  async clearBadgeCount() {
    if (Platform.OS !== 'web') {
      await Notifications.setBadgeCountAsync(0);
    }
  }

  async unregister() {
    if (this.expoPushToken) {
      try {
        const userToken = await getToken();
        const API_BASE = getApiBase();

        await fetch(`${API_BASE}/notifications/unregister-device`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            device_token: this.expoPushToken,
          }),
        });
      } catch (error) {
        console.error('Failed to unregister device token:', error);
      }
    }
  }
}

export default NotificationService;