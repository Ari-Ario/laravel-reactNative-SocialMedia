// app/(tabs)/_layout.tsx
import { Tabs, Stack, router, Redirect } from 'expo-router';
import { useContext, useEffect, useState, useRef } from 'react';
import AuthContext from '@/context/AuthContext';
import React from 'react';
import { Platform, ActivityIndicator, View, Text } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import LoginScreen from '../LoginScreen';
import { usePostStore } from '@/stores/postStore';
import { useNotificationStore, NOTIFICATION_TYPES } from '@/stores/notificationStore';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useReportedContentStore } from '@/stores/reportedContentStore';
import { logout } from '@/services/AuthService';
import { getToken } from '@/services/TokenService';
import { NotificationToast } from '@/components/Notifications/NotificationToast';
import { Toast } from '@/components/Shared/Toast';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, setUser } = useContext(AuthContext);
  const { initializeRealtime, disconnectRealtime } = usePostStore();
  const {
    initializeRealtime: initNotifications,
    disconnectRealtime: disconnectNotifications,
    setNotificationPanelVisible,
    isNotificationPanelVisible,
    setInitializationTime,
    setIsRealtimeReady: setGlobalRealtimeReady,
    unreadCallCount,
    unreadModerationCount
  } = useNotificationStore();
  const totalUnreadSpaces = useCollaborationStore(state => state.totalUnreadSpaces);

  const realtimeInitialized = useRef(false);
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Global toast state
  const currentToast = useNotificationStore(state => state.currentToastNotification);
  const setCurrentToast = useNotificationStore(state => state.setCurrentToastNotification);

  // Real-time initialization effect
  useEffect(() => {
    let isMounted = true;
    let initializationTimeout: NodeJS.Timeout;

    async function initializeRealtimeConnection() {
      if (realtimeInitialized.current) {
        console.log('ℹ️ Real-time already initialized, skipping...');
        return;
      }

      try {
        setIsLoading(true);
        const token = await getToken();

        if (!isMounted) return;

        if (token && user?.id) {
          console.log('🔐 Initializing real-time for user:', user.id);

          // Initialize both stores explicitly once
          initializeRealtime(token);
          initNotifications(token, Number(user.id));

          // Pre-fetch spaces to ensure the Chats tab badge exists offline instantly
          useCollaborationStore.getState().fetchUserSpaces(Number(user.id));

          // Pre-fetch reported content for red flags
          useReportedContentStore.getState().fetchReportedContent();


          if (typeof setInitializationTime === 'function') {
            setInitializationTime(new Date());
          }

          realtimeInitialized.current = true;
          setIsRealtimeReady(true);
          setGlobalRealtimeReady(true);
          console.log('✅ Real-time systems initialized');
        } else {
          setIsRealtimeReady(true);
          setGlobalRealtimeReady(true);
        }
      } catch (error) {
        console.error('❌ Real-time initialization failed:', error);
        setIsRealtimeReady(true);
        setGlobalRealtimeReady(true);
      } finally {
        if (isMounted) {
          initializationTimeout = setTimeout(() => {
            setIsLoading(false);
          }, 500);
        }
      }
    }

    const initializationTimer = setTimeout(() => {
      initializeRealtimeConnection();
    }, 800);

    return () => {
      isMounted = false;
      clearTimeout(initializationTimer);
      clearTimeout(initializationTimeout);
      if (realtimeInitialized.current) {
        console.log('🧹 Cleaning up real-time connections...');
        disconnectRealtime();
        disconnectNotifications();
        realtimeInitialized.current = false;
        setIsRealtimeReady(false);
        setGlobalRealtimeReady(false);
      }
    };
  }, [user?.id]);

  // NEW: Handle notification toasts (empty placeholder just in case passed from props)
  const handleShowToast = (notification: any) => {
    setCurrentToast(notification);
  };

  const handleHideToast = () => {
    setCurrentToast(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleToastPress = () => {
    setNotificationPanelVisible(true);
    handleHideToast();
  };

  // Show loading while checking token and initializing real-time
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Initializing app...</Text>
      </View>
    );
  }

  // FIX: Add debug logging to see what's happening
  console.log('🔐 TabLayout render state:', {
    isLoading,
    hasUser: !!user,
    isRealtimeReady
  });

  return (
    <AuthContext.Provider value={{ user, setUser, logout: handleLogout }}>
      {user ? (
        <>
          {/* NEW: Notification Toast */}
          <NotificationToast
            notification={currentToast}
            onPress={handleToastPress}
            onHide={handleHideToast}
            visible={!!currentToast}
          />

          <Toast />

          <Tabs
            screenOptions={{
              tabBarActiveTintColor: (Colors as any)[colorScheme ?? 'light']?.tint,
              headerShown: false,
              tabBarStyle: Platform.select({
                ios: { position: 'absolute' },
                default: {},
              }),
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: 'Home',
                tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
              }}
            />
            <Tabs.Screen
              name="chats"
              options={{
                title: 'Chats',
                tabBarIcon: ({ color }) => <FontAwesome size={28} name="comments" color={color} />,
                tabBarBadge: totalUnreadSpaces > 0 ? totalUnreadSpaces : undefined,
              }}
            />
            <Tabs.Screen
              name="market"
              options={{
                title: 'Market',
                tabBarIcon: ({ color }) => <FontAwesome size={28} name="shopping-basket" color={color} />,
              }}
            />
            <Tabs.Screen
              name="chatbot"
              options={{
                title: 'Chatbot',
                tabBarIcon: ({ color }) => <FontAwesome size={28} name="android" color={color} />,
              }}
            />
            <Tabs.Screen
              name="settings"
              options={{
                title: 'Settings',
                tabBarIcon: ({ color }) => <FontAwesome size={28} name="gear" color={color} />,
                tabBarBadge: (unreadCallCount || 0) + (unreadModerationCount || 0) > 0 ? (unreadCallCount || 0) + (unreadModerationCount || 0) : undefined,
              }}
            />

          </Tabs>
        </>
      ) : (
        <Redirect href="/LoginScreen" />
      )}
    </AuthContext.Provider>
  );
}