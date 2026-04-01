import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export const usePushNotification = () => {
  const registerForPushNotificationsAsync = async (): Promise<string | null> => {
    // 1. Check if browser supports Push API
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications are not supported in this browser environment.');
      return null;
    }

    try {
      // 2. Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions denied by user.');
        return null;
      }

      // 3. Get Expo Push Token with VAPID
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? 
                        'c240eb93-f893-4faf-bb24-46b6f670501d';
      
      const vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidKey) {
        console.warn('EXPO_PUBLIC_VAPID_PUBLIC_KEY is not defined in .env - Web Push may fail.');
      }

      const response = await Notifications.getExpoPushTokenAsync({
        projectId,
        vapidKey,
      });

      return response.data;
    } catch (e) {
      console.error('Error fetching Expo push token (Web):', e);
      // Detailed error for debugging known Expo web issues
      if (e instanceof Error && e.message.includes('getDevicePushTokenAsync')) {
        console.warn('Known Expo issue: getExpoPushTokenAsync attempted a native call on web. Ensure your Service Worker is correctly configured.');
      }
      return null;
    }
  };

  return { registerForPushNotificationsAsync };
};

export type PushNotificationHook = ReturnType<typeof usePushNotification>;
