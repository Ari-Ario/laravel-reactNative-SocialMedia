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
import { getToken, setToken } from '@/services/TokenService';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import VerificationScreen from './VerificationScreen';
import { usePathname, useLocalSearchParams, useSegments } from 'expo-router';
import { ProfileViewProvider } from '@/context/ProfileViewContext';
import { GlobalModals } from '@/components/GlobalModals';
import { ModalProvider } from '@/context/ModalContext';
import ModalManager from '@/components/ModalManager';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Toast } from '@/components/Shared/Toast';
import { CallProvider } from '@/context/CallContext';
import { RootCallOverlay } from '@/components/ChatScreen/RootCallOverlay';
import { IncomingCallModal } from '@/components/ChatScreen/IncomingCallModal';
import { useIncomingCallBridge } from '@/hooks/useIncomingCallBridge';

SplashScreen.preventAutoHideAsync();

/** Null-rendering child that activates incoming-call listening inside CallProvider */
function IncomingCallBridge() {
  useIncomingCallBridge();
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [user, setUser] = useState<{
    id: string; // Changed from number to string to match AuthContext
    name: string;
    email: string;
    profile_photo: string | null; // Made required (can be null)
    email_verified_at?: string | null;
    is_admin?: boolean;
    ai_admin?: boolean;
    is_guest?: boolean;
  } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const segments = useSegments();

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const token = await getToken();
        if (!isMounted) return;

        if (token) {
          const userData = await loadUser();
          if (isMounted && userData) {
            // Ensure ID is string
            setUser({
              ...userData,
              id: userData.id.toString(),
              profile_photo: userData.profile_photo || null,
            });
            
            // Guarantee that guests re-subscribe to WebSockets if they refresh the Space directly,
            // since they completely bypass the NotificationStore bootloader in /(tabs) layout!
            if (userData.is_guest) {
                const PusherService = require('@/services/PusherService').default;
                PusherService.initialize(token);
            }
          }
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

  const logout = async () => {
    try {
      await setToken(null);
      setUser(null);
      router.replace('/LoginScreen');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const pathname = usePathname();

  // Tracking initial load to handle web reloads/app restarts
  const isInitialLoad = useRef(true);

  // User checking and routing logic
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
      '/moderation',
    ];

    // Check if current path starts with any allowed route
    const isAllowedRoute = allowedRoutes.some(route =>
      pathname?.startsWith(route)
    );

    const isGuestAccess = pathname?.startsWith('/spaces/') || pathname?.startsWith('/(spaces)/') || (segments as string[]).includes('(spaces)');

    if (!user) {
      if (isGuestAccess) return; // Allow unauthenticated guest access

      // ALLOWED PUBLIC ROUTES: /, Login, Register, ForgotPassword, ResetPassword, Verification
      const publicRoutes = [
        '/',
        '/LoginScreen',
        '/RegisterScreen',
        '/ForgotPasswordScreen',
        '/ResetPasswordScreen',
        '/VerificationScreen',
      ];

      // If the current path is NOT a public route, send to Login
      const isPublicRoute = publicRoutes.some(route => pathname === route || pathname?.startsWith(route + '/'));

      if (!isPublicRoute) {
        console.log("🛡️ Unauthorized access attempt to restricted route:", pathname, "Redirecting to /LoginScreen");
        router.replace('/LoginScreen');
      }
      return;
    }

    // User is logged in
    if (user) {
      // 🛡️ Guest Access Guard (Prevent guests from going anywhere but explicitly allowed spaces)
      if (user.is_guest) {
        // Enforce strictness: if the guest navigates to root `/` or any restricted area explicitly, destroy session!
        const forbiddenPrefixes = ['/(tabs)', '/LoginScreen', '/RegisterScreen', '/VerificationScreen', '/ForgotPasswordScreen'];
        
        if (pathname === '/' || forbiddenPrefixes.some(prefix => pathname?.startsWith(prefix))) {
          console.log("🛡️ Guest attempted to navigate to a forbidden route. Destroying ephemeral session.");
          logout();
          return;
        }
        
        isInitialLoad.current = false;
        return; // Halt any further redirect logic for guests!
      }

      if (user.email_verified_at) {
        // ✅ STRICT REDIRECT ON RELOAD: If this is the initial mount (reload/restart),
        // and we are NOT on a tab or root, force redirect to tabs home.
        // This solves the web refresh issue where subscriptions break.
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
          if (!pathname?.startsWith('/(tabs)') && pathname !== '/(tabs)' && pathname !== '/') {
            console.log("🔄 Initial load/reload detected outside tabs, redirecting to home:", pathname);
            router.replace('/(tabs)');
            return;
          }
        }

        // If fully verified, redirect away from root, login, register, and verification screens
        const authScreens = ['/', '/LoginScreen', '/RegisterScreen', '/VerificationScreen'];
        if (authScreens.includes(pathname || '') && pathname !== '/(tabs)') {
          router.replace('/(tabs)');
          return;
        }
      } else {
        // If email NOT verified, only allow VerificationScreen
        if (pathname !== '/VerificationScreen') {
          router.replace('/VerificationScreen');
          return;
        }
      }
    }

    // Access control for AI Admin
    if (pathname?.startsWith('/chatbotTraining')) {
      if (!user?.ai_admin && pathname !== '/(tabs)') {
        router.replace('/(tabs)');
        return;
      }
    }

    // If it's an allowed route, let it through
    if (isAllowedRoute) {
      return;
    }

    // Default: redirect to tabs for any other route
    if (!pathname?.startsWith('/(tabs)') && pathname !== '/(tabs)') {
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
        <AuthContext.Provider value={{ user, setUser, logout }}>
          <CallProvider>
            {/* Bridge: wires CollaborationService → CallContext for incoming calls */}
            <IncomingCallBridge />
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

                    <Stack.Screen
                      name="chatbotTraining"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="moderation/index"
                      options={{ headerShown: false }}
                    />
                  </Stack>
                </SafeAreaView>

                {/* Modals render above Stack */}
                <GlobalModals />
                <ModalManager />
                <RootCallOverlay />
                <IncomingCallModal />
                <Toast />
              </ProfileViewProvider>
            </ModalProvider>
          </CallProvider>
        </AuthContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}