import 'react-native-gesture-handler'; // MUST BE FIRST IMPORT

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { useRouter, Redirect, Stack } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import AuthContext from '@/context/AuthContext';
import { Platform, ActivityIndicator, View, StatusBar } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAuthStore } from '@/stores/useAuthStore';
import AppInitializer from '@/services/AppInitializer';
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
import { useNotificationStore } from '@/stores/notificationStore';
import { NotificationToast } from '@/components/Notifications/NotificationToast';
import { setAudioModeAsync } from 'expo-audio';
import { setLocale, Locale } from '@/constants/i18n';


// Set global audio mode for call compatibility
if (Platform.OS !== 'web') {
  setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: true,
    interruptionMode: 'doNotMix',
    shouldRouteThroughEarpiece: false,
  }).catch(e => console.warn('Failed to set global audio mode:', e));
}

SplashScreen.preventAutoHideAsync();

/** Null-rendering child that activates incoming-call listening inside CallProvider */
function IncomingCallBridge() {
  useIncomingCallBridge();
  return null;
}

/** Isolated component to handle notification toasts without re-rendering RootLayout */
function NotificationToastBridge() {
  const currentToast = useNotificationStore(state => state.currentToastNotification);
  const setCurrentToast = useNotificationStore(state => state.setCurrentToastNotification);
  const setNotificationPanelVisible = useNotificationStore(state => state.setNotificationPanelVisible);

  const handleHideToast = () => setCurrentToast(null);
  const handleToastPress = () => {
    setNotificationPanelVisible(true);
    handleHideToast();
  };

  return (
    <NotificationToast
      notification={currentToast}
      onPress={handleToastPress}
      onHide={handleHideToast}
      visible={!!currentToast}
    />
  );
}

export default function RootLayout() {
  const { colors, activeScheme } = useAppTheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const { user, setUser, logout, initialize: initAuth, isInitialized: isAuthInitialized } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const pathname = usePathname();
  const segments = useSegments();
  const isInitialLoad = useRef(true);

  // ─── Param Preservation Helper ──────────────────────────────────────────
  const getCallParams = () => {
    const keys = ['ringing', 'call', 'callType', 'type', 'spaceType', 'callerName', 'callerId', 'id', 'spaceId'];
    const p: any = {};
    keys.forEach(k => { if (params[k]) p[k] = params[k]; });
    return p;
  };

  const safeReplace = (target: string) => {
    router.replace({ pathname: target as any, params: { ...params, ...getCallParams() } });
  };

  // 1. Initialize Auth Store
  useEffect(() => {
    initAuth();
  }, []);

  // 2. Initialize App Services (Pusher, etc.) when user is ready
  useEffect(() => {
    if (isAuthInitialized && user) {
      AppInitializer.initialize();
      
      // Sync language preference globally
      if (user.locale) {
        setLocale(user.locale as Locale);
      }
    }
  }, [isAuthInitialized, user?.id, user?.locale]);

  // 3. Handle Fonts & Splash Screen
  useEffect(() => {
    if (loaded && isAuthInitialized) {
      setIsReady(true);
      SplashScreen.hideAsync();
    }
  }, [loaded, isAuthInitialized]);

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
      '/PrivacyPolicy',
      '/TermsOfService',
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
        '/PrivacyPolicy',
        '/TermsOfService',
      ];

      // If the current path is NOT a public route, send to Login
      const isPublicRoute = publicRoutes.some(route => pathname === route || pathname?.startsWith(route + '/'));

      if (!isPublicRoute) {
        console.log("🛡️ Unauthorized access attempt to restricted route:", pathname, "Redirecting to /LoginScreen");
        safeReplace('/LoginScreen');
      }
      return;
    }

    // User is logged in
    if (user) {
      // 🛡️ Guest Access Guard
      if (user.is_guest) {
        const forbiddenPrefixes = ['/(tabs)', '/LoginScreen', '/RegisterScreen', '/VerificationScreen', '/ForgotPasswordScreen'];

        if (pathname === '/' || forbiddenPrefixes.some(prefix => pathname?.startsWith(prefix))) {
          console.log("🛡️ Guest attempted to navigate to a forbidden route. Destroying ephemeral session.");
          logout();
          return;
        }

        isInitialLoad.current = false;
        return;
      }

      if (user.email_verified_at) {
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
        }

        // If fully verified, redirect away from root, login, register, and verification screens
        const authScreens = ['/', '/LoginScreen', '/RegisterScreen', '/VerificationScreen'];
        if (authScreens.includes(pathname || '') && pathname !== '/(tabs)') {
          safeReplace('/(tabs)');
          return;
        }
      } else {
        // If email NOT verified, only allow VerificationScreen
        if (pathname !== '/VerificationScreen') {
          safeReplace('/VerificationScreen');
          return;
        }
      }
    }

    // Access control for AI Admin
    if (pathname?.startsWith('/chatbotTraining')) {
      if (!user?.ai_admin && pathname !== '/(tabs)') {
        safeReplace('/(tabs)');
        return;
      }
    }

    // If it's an allowed route, let it through
    if (isAllowedRoute) {
      return;
    }

    // Default: redirect to tabs for any other route
    if (!pathname?.startsWith('/(tabs)') && pathname !== '/(tabs)') {
      safeReplace('/(tabs)');
    }
  }, [isReady, user?.id, pathname]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        ...(Platform.OS === 'web' && {
          width: '100%',
          maxWidth: 1440,
          justifyContent: 'center',
          alignSelf: 'center',
          backgroundColor: colors.background,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: colors.border,
        }),
      }}
    >
      <SafeAreaProvider>
        <Head>
            <link rel="manifest" href="/manifest.json" />
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            <meta name="apple-mobile-web-app-title" content="Zmzir" />
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
          </Head>

          {/* Bridge AuthStore to Legacy AuthContext */}
          <AuthContext.Provider value={{ user: user as any, setUser: setUser as any, logout }}>
            <CallProvider>
              <IncomingCallBridge />
              <ModalProvider>
                <ProfileViewProvider>
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: colors.background }}
                    edges={['top', 'left', 'right']}
                  >
                    <StatusBar barStyle={activeScheme === 'dark' ? 'light-content' : 'dark-content'} />
                    <Stack screenOptions={{
                      headerShown: false,
                      animation: 'none',
                      gestureEnabled: true,
                      contentStyle: { backgroundColor: colors.background }
                    }}>
                      <Stack.Screen name="LoginScreen" options={{ headerShown: false }} />
                      <Stack.Screen name="RegisterScreen" options={{ headerShown: false }} />
                      <Stack.Screen name="ForgotPasswordScreen" options={{ headerShown: false }} />
                      <Stack.Screen name="ResetPasswordScreen" options={{ headerShown: false }} />
                      <Stack.Screen name="VerificationScreen" options={{ headerShown: false }} />
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                      <Stack.Screen name="chatbotTraining" options={{ headerShown: false }} />
                      <Stack.Screen name="moderation/index" options={{ headerShown: false }} />
                    </Stack>

                    {/* Global Overlays - Moved inside SafeAreaView for consistent layering and visibility */}
                    <GlobalModals />
                    <ModalManager />
                    <RootCallOverlay />
                    <IncomingCallModal />
                    <NotificationToastBridge />
                    <Toast />
                  </SafeAreaView>
                </ProfileViewProvider>
              </ModalProvider>
            </CallProvider>
          </AuthContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}