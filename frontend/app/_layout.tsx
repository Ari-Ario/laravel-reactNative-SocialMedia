import 'react-native-gesture-handler'; // MUST BE FIRST IMPORT

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { useRouter, Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import AuthContext from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ActivityIndicator, View, Text, Platform } from 'react-native';
import { loadUser } from '@/services/AuthService';
import { getToken } from '@/services/TokenService';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import { usePathname } from 'expo-router';
import { ProfileViewProvider } from '@/context/ProfileViewContext';
import { GlobalModals } from '@/components/GlobalModals';
import { ModalProvider } from '@/context/ModalContext';
import ModalManager from '@/components/ModalManager';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });  
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const token = await getToken();
        if (!isMounted) return;

        if (token) {
          const userData = await loadUser();
          if (isMounted) setUser(userData);
        } else {
          router.replace('/LoginScreen');
        }
      } catch (error) {
        console.log("Initial auth check failed:", error);
      } finally {
        if (isMounted) {
          setIsReady(true);
          await SplashScreen.hideAsync();
        }
      }
    }

    initialize();

    return () => { isMounted = false };

  }, []);

  const pathname = usePathname();

  // ... rest of your existing pathname logic (UNCHANGED)
  useEffect(() => {
    if (!isReady) return;

    // Allowed routes that should NOT redirect to tabs
    const allowedRoutes = [
      '/story/',
      '/post/', 
      '/profile-preview/',
      '/CreatPost/',
      '/chats/',
      '/spaces/',  // ADD THIS: Allow spaces with IDs
      '/LoginScreen',
      '/',
      '/settings',
      '/chatbot',
      '/chatbotTraining',
    ];

    // Check if current path starts with any allowed route
    const isAllowedRoute = allowedRoutes.some(route => 
      pathname?.startsWith(route)
    );

    if (!user) {
      // If user not logged in, only allow LoginScreen and root
      if (pathname !== '/' && !pathname?.startsWith('/LoginScreen')) {
        router.replace('/LoginScreen');
      }
      return;
    }

    // User is logged in, check routing
    if (pathname === '/' || pathname === '/LoginScreen') {
      // Redirect from login/root to home
      router.replace('/(tabs)');
      return;
    }

    // If it's an allowed route, let it through
    if (isAllowedRoute) {
      return;
    }

    // Default: redirect to tabs for any other route
    if (!pathname?.startsWith('/(tabs)')) {
      router.replace('/(tabs)');
    }
  }, [isReady, user, pathname]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView 
    style={{
        flex: 1,
        // Only apply maxWidth on web
        ...(Platform.OS === 'web' && {
          width: '100%',
          maxWidth: 1440,
          justifyContent: 'center',
          alignSelf: 'center',
          // marginHorizontal: 'auto',
          backgroundColor: '#fff',  // Optional: clean background
          borderLeftWidth: 1,       // Optional: subtle side borders
          borderRightWidth: 1,
          borderColor: '#ddd',
        }),
        // Only apply top on IOS
        ...(Platform.OS === 'ios' && {
          paddingTop: 40,
          // top: 40,
        }),
      }}
    >
      <AuthContext.Provider value={{ user, setUser }}>
        <ModalProvider>
          <ProfileViewProvider>
            {/* Stack must be the last child to properly handle gestures */}
            <Stack screenOptions={{ 
              headerShown: false, 
              animation: 'none',
              gestureEnabled: true // Ensure screen gestures work
            }} >
              {/* Tabs */}
              <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false }}
              />

              {/* MODAL over tabs */}
              {/* <Stack.Screen 
                name="spaces/[id]" 
                options={{ 
                  headerShown: true,
                  title: 'Space',
                  presentation: 'modal'
                }} 
              /> */}
            </Stack>
            
            {/* Modals render above Stack */}
            <GlobalModals />
            <ModalManager />
          </ProfileViewProvider>
        </ModalProvider>
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}