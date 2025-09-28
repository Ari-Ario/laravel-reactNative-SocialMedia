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
import { useNotificationStore } from '@/stores/notificationStore';
import { getToken } from '@/services/TokenService';
import { NotificationToast } from '@/components/Notifications/NotificationToast';
import { NotificationPanel } from '@/components/Notifications/NotificationPanel';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, setUser } = useContext(AuthContext);
  const { initializeRealtime, disconnectRealtime } = usePostStore();
  const { 
    initializeRealtime: initNotifications, 
    disconnectRealtime: disconnectNotifications,
    setNotificationPanelVisible,
    isNotificationPanelVisible,
    setInitializationTime // ADD THIS IMPORT
  } = useNotificationStore();
  
  const realtimeInitialized = useRef(false);
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentToast, setCurrentToast] = useState<any>(null);

  // Real-time initialization effect - FIXED VERSION
  useEffect(() => {
    let isMounted = true;

    async function initializeRealtimeConnection() {
      try {
        setIsLoading(true);
        const token = await getToken();
        
        console.log('🔐 Token check result:', { hasToken: !!token, hasUser: !!user });
        
        if (!isMounted) return;

        if (token && user && !realtimeInitialized.current) {
          console.log('🔐 Token found, initializing real-time...');
          
          // Initialize both post and notification real-time
          initializeRealtime(token);
          initNotifications(token);
          
          // Set the initialization time for notifications
          setInitializationTime(new Date());
          
          realtimeInitialized.current = true;
          setIsRealtimeReady(true);
        } else {
          // FIX: Handle both cases - no token OR no user
          console.log('🔐 No token or user not authenticated, skipping real-time initialization');
          setIsRealtimeReady(true);
        }
      } catch (error) {
        console.error('❌ Real-time initialization failed:', error);
        setIsRealtimeReady(true);
      } finally {
        // FIX: Always set loading to false, regardless of token/user status
        if (isMounted) {
          setIsLoading(false);
          console.log('🔐 Loading complete, isLoading set to false');
        }
      }
    }

    initializeRealtimeConnection();

    // Cleanup when tabs layout unmounts
    return () => {
      isMounted = false;
      if (realtimeInitialized.current) {
        console.log('🧹 Cleaning up real-time connections...');
        disconnectRealtime();
        disconnectNotifications();
        realtimeInitialized.current = false;
        setIsRealtimeReady(false);
      }
    };
  }, [user]);

  // NEW: Handle notification toasts
  const handleShowToast = (notification: any) => {
    setCurrentToast(notification);
  };

  const handleHideToast = () => {
    setCurrentToast(null);
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
    <AuthContext.Provider value={{ user, setUser }}>
      {user ? (
        <>
          {/* NEW: Notification Toast */}
          <NotificationToast
            notification={currentToast}
            onPress={handleToastPress}
            onHide={handleHideToast}
            visible={!!currentToast}
          />

          {/* NEW: Notification Panel */}
          <NotificationPanel
            visible={isNotificationPanelVisible}
            onClose={() => setNotificationPanelVisible(false)}
          />

          <Tabs
            screenOptions={{
              tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
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
              }}
            />
            <Tabs.Screen
              name="calls"
              options={{
                title: 'Calls',
                tabBarIcon: ({ color }) => <FontAwesome size={28} name="phone" color={color} />,
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
              name="chatbotTraining"
              options={{
                title: 'Chatbot Training',
                tabBarIcon: ({ color }) => <FontAwesome size={28} name="server" color={color} />,
              }}
            />
            <Tabs.Screen
              name="settings"
              options={{
                title: 'Settings',
                tabBarIcon: ({ color }) => <FontAwesome size={28} name="gear" color={color} />,
              }}
            />
          </Tabs>
        </>
      ) : (
        // FIX: Make sure LoginScreen is properly rendered
        <View style={{ flex: 1 }}>
          <Stack.Screen 
            name="Login" 
            options={{
              headerShown: false,
            }}
          />
          <LoginScreen />
        </View>
      )}
    </AuthContext.Provider>
  );
}