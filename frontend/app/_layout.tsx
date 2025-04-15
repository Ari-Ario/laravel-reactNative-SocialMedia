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
    let isMounted = true; // Track mounted state

    async function runEffct() {
      try {
        const token = await getToken();
        if (!isMounted) return;

        if (token) {
          const userData = await loadUser();
          if (isMounted) setUser(userData);
        } else {
          if (isMounted) setUser(null);
        }
      } catch (error) {
        if (isMounted) {
          setUser(null);
          console.log("Initial auth check failed:", error);
        }
      } finally {
        if (isMounted) {
          setIsReady(true);
          SplashScreen.hideAsync();
        }
      }
    }

    runEffct();
    
  }, []);

  useEffect(() => {
    if (isReady) {
      if (user) {
        router.replace('/(tabs)');
      } else if (!user || user === null) {
        router.replace('/');

      } else {
        router.replace('/');
      }
    }
  }, []); // Add  here

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {/* <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              transitionSpec: {
                open: config,
                close: config,
              },
            }}
          />
          
          <Stack.Screen 
          name="Register" 
          component={RegisterScreen} 
          options={{
            transitionSpec: {
              open: config,
              close: config,
            },
          }}
          />
        </Stack.Navigator>
      </NavigationContainer> */}

      {/* Empty stack since we're handling redirects via router */}
      <Stack screenOptions={{ headerShown: false }} />


    </AuthContext.Provider>
  );
}