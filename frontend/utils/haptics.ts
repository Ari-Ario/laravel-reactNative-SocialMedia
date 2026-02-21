// utils/haptics.ts
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const safeHaptics = {
    success: async () => {
        if (Platform.OS !== 'web') {
            try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
                console.warn('Haptics success not available');
            }
        }
    },

    warning: async () => {
        if (Platform.OS !== 'web') {
            try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (error) {
                console.warn('Haptics warning not available');
            }
        }
    },

    error: async () => {
        if (Platform.OS !== 'web') {
            try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } catch (error) {
                console.warn('Haptics error not available');
            }
        }
    },

    impact: async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
        if (Platform.OS !== 'web') {
            try {
                await Haptics.impactAsync(style);
            } catch (error) {
                console.warn('Haptics impact not available');
            }
        }
    },

    selection: async () => {
        if (Platform.OS !== 'web') {
            try {
                await Haptics.selectionAsync();
            } catch (error) {
                console.warn('Haptics selection not available');
            }
        }
    },
};