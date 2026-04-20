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
            boxShadow: `${width}px ${height}px ${radius}px rgba(0, 0, 0, ${opacity})`,
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

/**
 * Creates cross-platform text shadow styles.
 * On Web, it uses textShadow to avoid deprecation warnings.
 * On Native, it uses traditional textShadow props.
 */
export const createTextShadow = ({
    color = 'rgba(0, 0, 0, 0.75)',
    width = 0,
    height = 2,
    radius = 4,
}: { color?: string; width?: number; height?: number; radius?: number } = {}) => {
    return Platform.select({
        web: {
            textShadow: `${width}px ${height}px ${radius}px ${color}`,
        },
        default: {
            textShadowColor: color,
            textShadowOffset: { width, height },
            textShadowRadius: radius,
        },
    });
};
/**
 * Creates cross-platform pointer events styles.
 * On Web, it returns a style object.
 * On Native, it returns an empty object (pointerEvents is a prop, not a style).
 * This allows using ...createPointerEvents('none') in style arrays safely.
 */
export const createPointerEvents = (value: 'box-none' | 'none' | 'box-only' | 'auto'): any[] => {
    return Platform.select({
        web: [{ pointerEvents: value as any }],
        default: []
    }) || [];
};
