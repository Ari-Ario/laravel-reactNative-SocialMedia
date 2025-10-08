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
import { ActivityIndicator, View, Text } from 'react-native';
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

    if (pathname?.startsWith('/story/') 
      || pathname?.startsWith('/profile-preview') 
      || pathname?.startsWith('/CreatPost') 
      || pathname?.startsWith('/chats')) {
      return;
    }

    if (!user) {
      if (!pathname?.startsWith('/')) {
        return;
      }
      if (!pathname?.startsWith('/LoginScreen')) {
        return;
      }
    } 
    
    
    if (!pathname?.startsWith('/(tabs)')) {
      router.replace('/(tabs)');
    }

    if (pathname?.startsWith('/settings')) {
      router.replace('/settings');
    }

      // Handle chatbot and chatbotTraining routes more robustly because of same prefix .startsWith() 'chatbot'
    if (pathname === '/chatbotTraining' || pathname?.startsWith('/chatbotTraining/')) {
      router.replace('/chatbotTraining');
    } else if (pathname === '/chatbot' || pathname?.startsWith('/chatbot/')) {
      router.replace('/chatbot');
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthContext.Provider value={{ user, setUser }}>
        <ModalProvider>
          <ProfileViewProvider>
            {/* Stack must be the last child to properly handle gestures */}
            <Stack screenOptions={{ 
              headerShown: false, 
              animation: 'none',
              gestureEnabled: true // Ensure screen gestures work
            }} />
            
            {/* Modals render above Stack */}
            <GlobalModals />
            <ModalManager />
          </ProfileViewProvider>
        </ModalProvider>
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}