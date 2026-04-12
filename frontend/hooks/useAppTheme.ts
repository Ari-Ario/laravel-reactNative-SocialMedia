import { useColorScheme, Platform } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/constants/Colors';
import * as Context from 'expo-router'; // For potential future context usage

/**
 * Hook to resolve the current active theme color palette.
 * Supports Automatic (system), Light, Dark, and Dynamic (Android Material 3).
 */
export function useAppTheme() {
  const systemScheme = useColorScheme();
  const themePreference = useThemeStore((state) => state.themePreference);

  // Resolve active scheme ('light' or 'dark')
  let activeScheme: 'light' | 'dark' = 'light';

  if (themePreference === 'automatic') {
    activeScheme = systemScheme === 'dark' ? 'dark' : 'light';
  } else if (themePreference === 'dark') {
    activeScheme = 'dark';
  } else if (themePreference === 'light') {
    activeScheme = 'light';
  } else if (themePreference === 'dynamic') {
    // Dynamic color logic (Android specialized)
    // On Android 12+, we want to use Material 3 primary palette.
    // Expo Router provides access to these via Color.android.dynamic.* 
    // For simplicity in this iteration, we keep the scheme but can inject specific dynamic values.
    activeScheme = systemScheme === 'dark' ? 'dark' : 'light';
  }

  const colors = activeScheme === 'dark' ? Colors.dark : Colors.light;

  return {
    activeScheme,
    themePreference,
    colors,
    isDark: activeScheme === 'dark',
  };
}
