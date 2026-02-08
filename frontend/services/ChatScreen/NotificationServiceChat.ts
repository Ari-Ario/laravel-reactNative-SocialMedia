import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Alert } from 'react-native';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

  private constructor() {}

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
      if (Device.isDevice) {
        const token = (await Notifications.getExpoPushTokenAsync({
          projectId: 'your-project-id', // Add your project ID
        })).data;
        
        this.expoPushToken = token;
        await this.registerToken(token);
      } else {
        console.log('Must use physical device for push notifications');
      }

      // Handle notifications when app is in foreground
      Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
        // You could update local state here
      });

      // Handle notification responses
      Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        this.handleNotificationTap(data);
      });

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
    // Handle navigation based on notification type
    const { type, id, spaceId, userId } = data;
    
    switch (type) {
      case 'space_invitation':
        // Navigate to space
        import('expo-router').then(({ router }) => {
          router.push(`/(spaces)/${spaceId}`);
        });
        break;
        
      case 'new_message':
        if (spaceId) {
          import('expo-router').then(({ router }) => {
            router.push(`/(spaces)/${spaceId}`);
          });
        } else if (userId) {
          import('expo-router').then(({ router }) => {
            router.push(`/(tabs)/chats/${userId}`);
          });
        }
        break;
        
      case 'magic_event':
        if (spaceId) {
          import('expo-router').then(({ router }) => {
            router.push(`/(spaces)/${spaceId}?magic=${id}`);
          });
        }
        break;
    }
  }

  async clearBadgeCount() {
    await Notifications.setBadgeCountAsync(0);
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