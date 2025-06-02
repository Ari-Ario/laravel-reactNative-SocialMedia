import { Tabs, Stack, router, Redirect } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import AuthContext from '@/context/AuthContext';
import React from 'react';
import { Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import LoginScreen from '../LoginScreen';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, setUser } = useContext(AuthContext);

  // Redirect effect - handles both initial load and logout cases
  useEffect(() => {
      if (!user || (user === null)) {
        router.replace('/LoginScreen');
      } else { console.log("asking Authentication from Layout")}
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
    {user ? (
      <>
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
      <>
      <Stack.Screen name="Login" component={LoginScreen} />
      </>
    )}

  </AuthContext.Provider>
  );
}
