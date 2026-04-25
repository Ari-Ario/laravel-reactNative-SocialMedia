import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useNotificationStore } from '@/stores/notificationStore';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useAuthStore } from '@/stores/useAuthStore';

export default function TabLayout() {
  const { colors, activeScheme } = useAppTheme();
  const { t, locale } = useTranslation();

  // Use useAuthStore for logic, but keep AuthContext for compatibility if needed
  // RootLayout already provides AuthContext bridged to useAuthStore.
  const { user } = useAuthStore();

  const {
    unreadModerationCount
  } = useNotificationStore();

  const totalUnreadSpaces = useCollaborationStore(state => state.totalUnreadSpaces);

  // If for some reason RootLayout hasn't finished, wait (should be rare)
  if (!user) return null;

  return (
    <>

      <Tabs
        key={locale}
        sceneContainerStyle={{ backgroundColor: colors.background }}
        screenOptions={{
          tabBarActiveTintColor: colors.tint,
          tabBarInactiveTintColor: colors.tabIconDefault,
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginBottom: 4,
          },
          tabBarStyle: Platform.select({
            web: {
              height: 64,
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            },
            default: {
              position: 'absolute',
              bottom: Platform.OS === 'ios' ? 10 : 5,
              left: 16,
              right: 16,
              height: 64,
              borderRadius: 32,
              backgroundColor: activeScheme === 'dark' ? 'rgba(21, 23, 24, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              borderTopWidth: 1,
              borderTopColor: colors.border,
              borderWidth: 1,
              borderColor: colors.border,
              elevation: 4,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              paddingBottom: 0,
              overflow: 'hidden',
            }
          }),
          tabBarItemStyle: {
            paddingVertical: Platform.OS === 'web' ? 12 : 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('home'),
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center' }}>
                <View style={{ transform: [{ scale: focused ? 1.15 : 1 }] }}>
                  <IconSymbol size={28} name="house.fill" color={color} />
                </View>
                {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.tint, marginTop: 4 }} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="chats"
          options={{
            title: t('chats'),
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center' }}>
                <View style={{ transform: [{ scale: focused ? 1.15 : 1 }] }}>
                  <FontAwesome size={26} name="comments" color={color} />
                </View>
                {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.tint, marginTop: 4 }} />}
              </View>
            ),
            tabBarBadge: totalUnreadSpaces > 0 ? totalUnreadSpaces : undefined,
          }}
        />
        <Tabs.Screen
          name="market"
          options={{
            title: t('market'),
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center' }}>
                <View style={{ transform: [{ scale: focused ? 1.15 : 1 }] }}>
                  <FontAwesome size={26} name="shopping-basket" color={color} />
                </View>
                {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.tint, marginTop: 4 }} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="chatbot"
          options={{
            title: t('chatbot'),
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center' }}>
                <View style={{ transform: [{ scale: focused ? 1.15 : 1 }] }}>
                  <FontAwesome size={26} name="android" color={color} />
                </View>
                {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.tint, marginTop: 4 }} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('settings'),
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center' }}>
                <View style={{ transform: [{ scale: focused ? 1.15 : 1 }] }}>
                  <FontAwesome size={26} name="gear" color={color} />
                </View>
                {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.tint, marginTop: 4 }} />}
              </View>
            ),
            tabBarBadge: (unreadModerationCount || 0) > 0 ? unreadModerationCount : undefined,
          }}
        />
      </Tabs>
    </>
  );
}