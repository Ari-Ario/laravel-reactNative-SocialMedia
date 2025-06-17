import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { useRouter, Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
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

  // useEffect(() => {
  //   if (!isReady) return;

  //   if (user) {
  //     if (!pathname.startsWith('/(tabs)/settings')) {
  //       router.replace('/(tabs)/settings');
  //     }
  //   } else if (user) {
  //     if (!pathname.startsWith('/(tabs)/calls')) {
  //       router.replace('/(tabs)/calls');
  //     }
  //   } else if (user) {
  //     if (!pathname.startsWith('/(tabs)/chats')) {
  //       router.replace('/(tabs)/chats');
  //     }
  //   } else if (user) {
  //     if (!pathname.startsWith('/(tabs)')) {
  //       router.replace('/(tabs)');
  //     } 
  //   } else {
  //     if (!pathname.startsWith('/LoginScreen')) {
  //       router.replace('/');
  //     }
  //   }
  // }, [isReady, user]);

  useEffect(() => {
    if (!isReady) return;

    // Or better Logic
    if (pathname?.startsWith('/story/') || pathname?.startsWith('/profile-preview') || pathname?.startsWith('/CreatPost')) {
      return;
    }

    if (!user) {
      if (pathname !== '/' && !pathname?.startsWith('/LoginScreen')) {
        router.replace('/');
      }
    } 
    
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
    <AuthContext.Provider value={{ user, setUser }}>
      <ModalProvider>

        <ProfileViewProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
          <GlobalModals />
          <ModalManager />
        </ProfileViewProvider>

      </ModalProvider>

    </AuthContext.Provider>
  );
}