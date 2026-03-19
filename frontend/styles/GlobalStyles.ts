import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

/**
 * Global styles for the application, particularly for standardizing 
 * the appearance of popups and modals across Web and Mobile.
 */
export const GlobalStyles = StyleSheet.create({
    /**
     * Standard container for full-screen or large popups.
     * Web: Centered with a maximum width and minimum height.
     * Mobile: Full screen, designed to be used with useSafeAreaInsets for notch handling.
     */
    popupContainer: {
        flex: 1,
        // backgroundColor: '#000', // Default background, can be overridden
        ...Platform.select({
            web: {
                width: '100%',
                minHeight: 700,
                maxWidth: 1440,
                height: '100%',
                alignSelf: 'center',
                boxShadow: '0 0 20px rgba(0,0,0,0.5)',
            },
        }),
    },

    /**
     * Helper for absolute filling with standard constraints.
     */
    fullScreen: {
        flex: 1,
        width: '100%',
        height: '100%',
    },

    /**
     * Common modal overlay backdrop.
     */
    modalOverlay: {
        flex: 1,
        // backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default GlobalStyles;
