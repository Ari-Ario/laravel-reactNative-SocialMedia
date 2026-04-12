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
        justifyContent: 'center',
        alignItems: 'center',
    },

    /**
     * Responsive constraint for overlays.
     * Web: Limits width and centers content.
     * Mobile: Full width.
     */
    responsiveModal: {
        width: '100%',
        ...Platform.select({
            web: {
                maxWidth: 1440,
                alignSelf: 'center',
            },
        }),
    }
});

export default GlobalStyles;
