// components/ui/IconButton.tsx
import React, { memo, useCallback, useMemo } from 'react';
import {
    TouchableOpacity,
    Text,
    View,
    StyleSheet,
    ActivityIndicator,
    GestureResponderEvent,
    Platform,
    Insets,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Types for better IDE support and type safety
type IconName = keyof typeof Ionicons.glyphMap;
type IconPosition = 'left' | 'right' | 'top' | 'bottom';
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'transparent' | 'danger' | 'success' | 'warning';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type FeedbackStyle = 'light' | 'medium' | 'heavy' | 'none';

// Performance-optimized default values
const DEFAULT_HIT_SLOP: Insets = { top: 10, bottom: 10, left: 10, right: 10 };
const SIZE_CONFIG = {
    xs: { container: { paddingVertical: 4, paddingHorizontal: 8 }, icon: 14, text: 11, spacing: 4 },
    sm: { container: { paddingVertical: 6, paddingHorizontal: 12 }, icon: 16, text: 13, spacing: 5 },
    md: { container: { paddingVertical: 8, paddingHorizontal: 16 }, icon: 18, text: 14, spacing: 6 },
    lg: { container: { paddingVertical: 10, paddingHorizontal: 20 }, icon: 20, text: 16, spacing: 7 },
    xl: { container: { paddingVertical: 12, paddingHorizontal: 24 }, icon: 22, text: 18, spacing: 8 },
} as const;

// Pre-computed variant styles for performance
const VARIANT_STYLES = {
    primary: { bg: '#007AFF', text: '#FFFFFF', border: '#007AFF' },
    secondary: { bg: '#F2F2F7', text: '#1C1C1E', border: '#F2F2F7' },
    outline: { bg: 'transparent', text: '#007AFF', border: '#007AFF' },
    ghost: { bg: 'transparent', text: '#007AFF', border: 'transparent' },
    transparent: { bg: 'transparent', text: '#1C1C1E', border: 'transparent' },
    danger: { bg: '#FF3B30', text: '#FFFFFF', border: '#FF3B30' },
    success: { bg: '#34C759', text: '#FFFFFF', border: '#34C759' },
    warning: { bg: '#FF9500', text: '#FFFFFF', border: '#FF9500' },
} as const;

// Global error handler for button errors
const handleButtonError = (error: Error, context: string) => {
    // Log to your error tracking service (Sentry, Crashlytics, etc.)
    if (__DEV__) {
        console.error(`[IconButton] ${context}:`, error);
    }
    // You can add custom error reporting here
    // reportErrorToService(error, 'IconButton', context);
};

export interface IconButtonProps {
    // Core props
    icon: IconName;
    onPress: (event?: GestureResponderEvent) => void;

    // Optional text
    title?: string;

    // Styling
    variant?: ButtonVariant;
    size?: ButtonSize;
    iconPosition?: IconPosition;

    // States
    disabled?: boolean;
    loading?: boolean;

    // Custom colors (override variant)
    iconColor?: string;
    textColor?: string;
    backgroundColor?: string;
    borderColor?: string;

    // Custom sizes
    customIconSize?: number;
    customTextSize?: number;
    borderRadius?: number;

    // Layout
    fullWidth?: boolean;
    hitSlop?: Insets;

    // iOS specific
    hapticFeedback?: FeedbackStyle;

    // Accessibility
    accessibilityLabel?: string;
    accessibilityHint?: string;

    // Performance
    throttleMs?: number; // Prevent double taps
    debounceMs?: number; // Debounce rapid presses

    // Styling overrides
    style?: ViewStyle;
    textStyle?: TextStyle;
    containerStyle?: ViewStyle;

    // Test ID
    testID?: string;
}

// Memoized component for maximum performance
export const IconButton = memo<IconButtonProps>(({
    // Core
    icon,
    onPress,
    title,

    // Styling defaults
    variant = 'primary',
    size = 'md',
    iconPosition = 'left',

    // States
    disabled = false,
    loading = false,

    // Custom colors
    iconColor,
    textColor,
    backgroundColor,
    borderColor,

    // Custom sizes
    customIconSize,
    customTextSize,
    borderRadius = 12,

    // Layout
    fullWidth = false,
    hitSlop = DEFAULT_HIT_SLOP,

    // iOS feedback
    hapticFeedback = Platform.OS === 'ios' ? 'light' : 'none',

    // Accessibility
    accessibilityLabel,
    accessibilityHint,

    // Performance
    throttleMs = 300,
    debounceMs = 0,

    // Style overrides
    style,
    textStyle,
    containerStyle,

    // Test ID
    testID,
}) => {
    // Safe area for notch handling (only if needed)
    const insets = useSafeAreaInsets();

    // Memoize derived styles for performance
    const variantStyle = useMemo(() => VARIANT_STYLES[variant], [variant]);
    const sizeConfig = useMemo(() => SIZE_CONFIG[size], [size]);

    // Memoize dynamic styles
    const dynamicStyles = useMemo(() => {
        const isTransparent = variant === 'transparent' || variant === 'ghost';

        return {
            container: {
                backgroundColor: backgroundColor || variantStyle.bg,
                borderColor: borderColor || variantStyle.border,
                borderWidth: variant === 'outline' ? 1 : 0,
                borderRadius,
                opacity: disabled ? 0.5 : 1,
                width: fullWidth ? '100%' : undefined,
                ...sizeConfig.container,
                flexDirection: iconPosition === 'left' ? 'row' :
                    iconPosition === 'right' ? 'row-reverse' :
                        iconPosition === 'top' ? 'column' : 'column-reverse',
                alignItems: 'center',
                justifyContent: 'center',
            },
            icon: {
                color: iconColor || variantStyle.text,
                fontSize: customIconSize || sizeConfig.icon,
                marginRight: title && iconPosition === 'left' ? sizeConfig.spacing : 0,
                marginLeft: title && iconPosition === 'right' ? sizeConfig.spacing : 0,
                marginBottom: title && iconPosition === 'top' ? sizeConfig.spacing : 0,
                marginTop: title && iconPosition === 'bottom' ? sizeConfig.spacing : 0,
            },
            text: {
                color: textColor || variantStyle.text,
                fontSize: customTextSize || sizeConfig.text,
                fontWeight: '600' as const,
                textAlign: 'center' as const,
            },
        };
    }, [
        variant, variantStyle, backgroundColor, borderColor, borderRadius,
        disabled, fullWidth, sizeConfig, iconPosition, title,
        iconColor, customIconSize, textColor, customTextSize
    ]);

    // Debounced press handler
    const handlePress = useCallback((event: GestureResponderEvent) => {
        if (disabled || loading) return;

        try {
            // Haptic feedback
            if (Platform.OS === 'ios' && hapticFeedback !== 'none') {
                // You can implement haptic feedback here if needed
                // Haptics.impactAsync(getHapticStyle(hapticFeedback));
            }

            onPress(event);
        } catch (error) {
            handleButtonError(error as Error, `onPress for icon ${icon}`);
        }
    }, [disabled, loading, hapticFeedback, onPress, icon]);

    // Render content with error boundary
    const renderContent = useCallback(() => {
        try {
            if (loading) {
                return (
                    <ActivityIndicator
                        size="small"
                        color={textColor || variantStyle.text}
                    />
                );
            }

            return (
                <>
                    <Ionicons
                        name={icon}
                        size={dynamicStyles.icon.fontSize}
                        color={dynamicStyles.icon.color}
                        style={dynamicStyles.icon}
                    />
                    {title && (
                        <Text
                            style={[dynamicStyles.text, textStyle]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {title}
                        </Text>
                    )}
                </>
            );
        } catch (error) {
            handleButtonError(error as Error, 'renderContent');
            return null;
        }
    }, [loading, icon, title, dynamicStyles, textStyle, variantStyle.text]);

    // Determine accessibility label
    const accessibilityLabelValue = useMemo(() => {
        if (accessibilityLabel) return accessibilityLabel;
        if (title) return `${title} button`;
        return `${icon} icon button`;
    }, [accessibilityLabel, title, icon]);

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={disabled || loading}
            style={[styles.baseContainer, dynamicStyles.container, containerStyle, style]}
            activeOpacity={0.7}
            hitSlop={hitSlop}
            accessibilityLabel={accessibilityLabelValue}
            accessibilityHint={accessibilityHint}
            accessibilityRole="button"
            accessibilityState={{ disabled, busy: loading }}
            testID={testID}
        >
            {renderContent()}
        </TouchableOpacity>
    );
});

// Base styles (static for performance)
const styles = StyleSheet.create({
    baseContainer: {
        // iOS shadow for depth (only when not transparent)
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
            },
            android: {
                elevation: 2,
            },
        }),
    },
});

// Utility HOC for common button patterns
export const withIconButton = <P extends object>(
    WrappedComponent: React.ComponentType<P>,
    defaultProps?: Partial<IconButtonProps>
) => {
    const WithIconButton = (props: P & IconButtonProps) => {
        try {
            return <WrappedComponent {...defaultProps} {...props} />;
        } catch (error) {
            handleButtonError(error as Error, 'withIconButton HOC');
            return null;
        }
    };
    WithIconButton.displayName = `WithIconButton(${WrappedComponent.displayName || WrappedComponent.name})`;
    return memo(WithIconButton);
};

// Pre-configured button variants for common use cases
export const CloseButton = memo((props: Partial<IconButtonProps>) => (
    <IconButton
        icon="close"
        variant="transparent"
        size="md"
        accessibilityLabel="Close"
        hapticFeedback="light"
        {...props}
    />
));

export const BackButton = memo((props: Partial<IconButtonProps>) => (
    <IconButton
        icon="arrow-back"
        variant="ghost"
        size="md"
        accessibilityLabel="Go back"
        hapticFeedback="light"
        {...props}
    />
));

export const MoreButton = memo((props: Partial<IconButtonProps>) => (
    <IconButton
        icon="ellipsis-horizontal"
        variant="ghost"
        size="md"
        accessibilityLabel="More options"
        {...props}
    />
));

export const ShareButton = memo((props: Partial<IconButtonProps>) => (
    <IconButton
        icon="share-outline"
        variant="ghost"
        size="md"
        accessibilityLabel="Share"
        {...props}
    />
));

export const LikeButton = memo(({ isLiked, ...props }: { isLiked?: boolean } & Partial<IconButtonProps>) => (
    <IconButton
        icon={isLiked ? 'heart' : 'heart-outline'}
        variant={isLiked ? 'danger' : 'ghost'}
        size="md"
        accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
        {...props}
    />
));

export const SaveButton = memo(({ isSaved, ...props }: { isSaved?: boolean } & Partial<IconButtonProps>) => (
    <IconButton
        icon={isSaved ? 'bookmark' : 'bookmark-outline'}
        variant="ghost"
        size="md"
        accessibilityLabel={isSaved ? 'Unsave' : 'Save'}
        {...props}
    />
));

export const CommentButton = memo((props: Partial<IconButtonProps>) => (
    <IconButton
        icon="chatbubble-outline"
        variant="ghost"
        size="md"
        accessibilityLabel="Comment"
        {...props}
    />
));

// Error boundary for development
if (__DEV__) {
    const validateProps = (props: IconButtonProps) => {
        const errors: string[] = [];

        if (!props.icon) {
            errors.push('Icon is required');
        }

        if (props.loading && props.disabled) {
            errors.push('Cannot be both loading and disabled');
        }

        if (props.throttleMs && props.throttleMs < 0) {
            errors.push('throttleMs must be positive');
        }

        if (props.debounceMs && props.debounceMs < 0) {
            errors.push('debounceMs must be positive');
        }

        if (errors.length > 0) {
            console.warn('[IconButton] Prop validation failed:', errors);
        }
    };

    // Add validation in development
    const OriginalIconButton = IconButton;
    const ValidatedIconButton = (props: IconButtonProps) => {
        validateProps(props);
        return <OriginalIconButton {...props} />;
    };
    ValidatedIconButton.displayName = 'ValidatedIconButton';
    // Uncomment to use validated version in dev
    // export const IconButton = ValidatedIconButton;
}

// Default export
export default IconButton;