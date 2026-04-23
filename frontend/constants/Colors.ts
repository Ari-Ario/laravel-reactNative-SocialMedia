/**
 * Global color definitions for the application.
 * Supports Light, Dark, and Dynamic (Material 3) modes.
 */

const tintColorLight = '#1063FD';
const tintColorDark = '#0A84FF';

export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#687076',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    border: '#E2E2E2',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorLight,
    card: '#FFFFFF',
    muted: '#F1F1F1',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    primary: '#1063FD',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    background: '#000000',
    surface: '#121212',
    border: '#2C2C2E',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#48484A',
    tabIconSelected: tintColorDark,
    card: '#1C1C1E',
    muted: '#262629',
    error: '#FF453A',
    success: '#32D74B',
    warning: '#FF9F0A',
    primary: '#0A84FF',
  },
  primary: '#1063FD',
  secondary: '#3A5A92',
  nav: {
    light: '#FFFFFF',
    dark: '#000000',
    tint: '#1063FD',
  }
};

export default Colors;
