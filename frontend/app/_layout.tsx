import 'react-native-gesture-handler'; // MUST BE FIRST IMPORT

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { useRouter, Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import AuthContext from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ActivityIndicator, View, Text, Platform } from 'react-native';
import { loadUser } from '@/services/AuthService';
import { getToken } from '@/services/TokenService';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import VerificationScreen from './VerificationScreen';
import { usePathname } from 'expo-router';
import { ProfileViewProvider } from '@/context/ProfileViewContext';
import { GlobalModals } from '@/components/GlobalModals';
import { ModalProvider } from '@/context/ModalContext';
import ModalManager from '@/components/ModalManager';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [user, setUser] = useState<{
    id: number;
    name: string;
    email: string;
    email_verified_at?: string | null;
    is_admin?: boolean;
    ai_admin?: boolean;
  } | null>(null);
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
        }
        // else {
        //   router.replace('/LoginScreen');
        // }
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
      '/spaces/',
      '/LoginScreen',
      '/RegisterScreen',
      '/ForgotPasswordScreen',
      '/ResetPasswordScreen',
      '/VerificationScreen',
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
      if (pathname !== '/' && pathname?.startsWith('/LoginScreen')) {
        router.replace('/LoginScreen');
      } else if (pathname?.startsWith('/RegisterScreen')) {
        router.replace('/RegisterScreen');
      } else if (pathname?.startsWith('/ForgotPasswordScreen')) {
        router.replace('/ForgotPasswordScreen');
      } else if (pathname?.startsWith('/VerificationScreen')) {
        router.replace('/VerificationScreen');
      } else if (!pathname || pathname === '/ResetPasswordScreen') {
        router.replace('/ResetPasswordScreen');
      } else {
        router.replace('/');
      }
      return;
    }

    // User is logged in
    if (pathname === '/' || pathname === '/LoginScreen') {
      router.replace('/(tabs)');
      return;
    }

    // Check if email is verified
    if (!user.email_verified_at) {
      // If email not verified, only allow VerificationScreen
      if (pathname !== '/VerificationScreen') {
        router.replace('/VerificationScreen');
        return;
      }
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
      }}
    >
      <SafeAreaProvider>
        <AuthContext.Provider value={{ user, setUser }}>
          <ModalProvider>
            <ProfileViewProvider>
              {/* Stack must be the last child to properly handle gestures */}
              <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
                <Stack screenOptions={{
                  headerShown: false,
                  animation: 'none',
                  gestureEnabled: true
                }}>
                  {/* Define ALL screens statically - no conditional rendering */}
                  <Stack.Screen
                    name="LoginScreen"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="RegisterScreen"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="ForgotPasswordScreen"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="ResetPasswordScreen"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="VerificationScreen"
                    options={{ headerShown: false }}
                  />

                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />
                </Stack>
              </SafeAreaView>

              {/* Modals render above Stack */}
              <GlobalModals />
              <ModalManager />
            </ProfileViewProvider>
          </ModalProvider>
        </AuthContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}