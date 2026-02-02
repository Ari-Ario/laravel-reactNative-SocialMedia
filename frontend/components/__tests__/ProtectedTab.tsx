// components/ProtectedTab.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface ProtectedTabProps {
  user: any;
  name: string;
  title: string;
  iconName: keyof typeof FontAwesome.glyphMap;
  requireAiAdmin?: boolean;
  requireEmailVerified?: boolean;
}

export const ProtectedTab: React.FC<ProtectedTabProps> = ({
  user,
  name,
  title,
  iconName,
  requireAiAdmin = false,
  requireEmailVerified = false,
}) => {
  const canAccess = () => {
    if (requireAiAdmin && user?.ai_admin !== 1) {
      return false;
    }
    
    if (requireEmailVerified && !user?.email_verified_at) {
      return false;
    }
    
    return true;
  };

  if (!canAccess()) {
    return null;
  }

  return (
    <Tabs.Screen
      name={name}
      options={{
        title,
        tabBarIcon: ({ color }) => <FontAwesome size={28} name={iconName} color={color} />,
      }}
    />
  );
};