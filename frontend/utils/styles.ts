import { Platform } from 'react-native';

interface ShadowOptions {
    color?: string;
    width?: number;
    height?: number;
    opacity?: number;
    radius?: number;
    elevation?: number;
}

/**
 * Creates cross-platform shadow styles.
 * On Web, it uses boxShadow to avoid deprecation warnings.
 * On Native, it uses traditional shadow props and elevation.
 */
export const createShadow = ({
    color = '#000',
    width = 0,
    height = 2,
    opacity = 0.25,
    radius = 3.84,
    elevation = 5,
}: ShadowOptions = {}) => {
    return Platform.select({
        web: {
            boxShadow: `${width}px ${height}px ${radius}px ${color.replace('#', '%23')}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
        },
        default: {
            shadowColor: color,
            shadowOffset: { width, height },
            shadowOpacity: opacity,
            shadowRadius: radius,
            elevation: elevation,
        },
    });
};
