import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import getApiBaseImage from '@/services/getApiBaseImage';

interface UserData {
    id?: number | string;
    name?: string;
    last_name?: string;
    profile_photo?: string | null;
}

interface AvatarProps {
    user: UserData | null | undefined;
    size?: number;
    style?: ViewStyle;
    textStyle?: TextStyle;
    showBorder?: boolean;
}

/**
 * A highly reusable Avatar component that handles 404 image fallbacks gracefully
 * by swapping to the user's initials.
 */
export const Avatar: React.FC<AvatarProps> = ({
    user,
    size = 40,
    style,
    textStyle,
    showBorder = false,
}) => {
    const [imgError, setImgError] = useState(false);

    // If there's no user object at all, render a default blank avatar
    if (!user) {
        return (
            <View style={[styles.fallbackContainer, { width: size, height: size, borderRadius: size / 2 }, style]}>
                <Text style={[styles.initials, { fontSize: size * 0.4 }, textStyle]}>?</Text>
            </View>
        );
    }

    // Determine initials
    const firstInitial = user.name ? user.name.charAt(0).toUpperCase() : '';
    const lastInitial = user.last_name ? user.last_name.charAt(0).toUpperCase() : '';
    const initials = (firstInitial + lastInitial) || '?';

    // If the user has a profile photo AND we haven't errored out yet fetching it
    if (user.profile_photo && !imgError) {
        const uri = user.profile_photo.startsWith('http')
            ? user.profile_photo
            : `${getApiBaseImage()}/storage/${user.profile_photo}`;

        return (
            <Image
                source={{ uri }}
                style={[
                    { width: size, height: size, borderRadius: size / 2 },
                    showBorder && styles.defaultBorder,
                    style
                ]}
                onError={() => setImgError(true)} // Crucial: Trip the fallback on 404
            />
        );
    }

    // Fallback state: Render Initials
    return (
        <View
            style={[
                styles.fallbackContainer,
                { width: size, height: size, borderRadius: size / 2 },
                showBorder && styles.defaultBorder,
                style
            ]}
        >
            <Text style={[styles.initials, { fontSize: size * 0.4 }, textStyle]}>
                {initials}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    fallbackContainer: {
        backgroundColor: '#007AFF15', // Light blue background for initials
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#007AFF30',
    },
    initials: {
        color: '#007AFF', // Blue text for initials
        fontWeight: '700',
    },
    defaultBorder: {
        borderWidth: 2,
        borderColor: '#fff',
    }
});
