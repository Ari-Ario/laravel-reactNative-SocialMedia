import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useAppTheme } from '@/hooks/useAppTheme';

interface AvatarProps {
  source?: string | null;
  size?: number;
  name?: string;
  isOnline?: boolean;
  onPress?: () => void;
  borderColor?: string;
  showStatus?: boolean;
  style?: any;
}

/**
 * High-performance Avatar component with local initials fallback.
 * Uses expo-image for superior caching and performance.
 */
const Avatar: React.FC<AvatarProps> = ({
  source,
  size = 40,
  name,
  isOnline = false,
  onPress,
  showStatus = true,
  style,
}) => {
  const { colors, activeScheme } = useAppTheme();
  const [imgError, setImgError] = useState(false);
  const styles = getStyles(colors, activeScheme);
  
  // Reset error state when source changes
  React.useEffect(() => {
    setImgError(false);
  }, [source]);

  // Resolve URI: relative paths become full API storage URLs
  const resolveUri = (src: string) => {
    if (!src) return '';
    if (
      src.startsWith('http') ||
      src.startsWith('blob:') ||
      src.startsWith('file:') ||
      src.startsWith('data:')
    ) {
      return src;
    }

    const base = getApiBaseImage();
    const cleanSrc = src.startsWith('/') ? src.substring(1) : src;

    // If it already starts with storage/, don't double it
    if (cleanSrc.startsWith('storage/')) {
      return `${base}/${cleanSrc}`;
    }

    return `${base}/storage/${cleanSrc}`;
  };

  // Build initials: up to 2 characters from name words
  const initials = name
    ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : '?';

  const renderAvatar = () => {
    if (source === 'system_admin_shield') {
      return (
        <View style={[styles.initialsContainer, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.error, borderColor: colors.error, borderWidth: 0 }]}>
          <Ionicons name="shield-checkmark" size={size * 0.6} color="white" />
        </View>
      );
    }
    if (source && String(source).trim() !== 'null' && !imgError) {
      return (
        <ExpoImage
          source={{ uri: resolveUri(source) }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={200}
          cachePolicy="disk"
          onError={() => setImgError(true)}
        />
      );
    }
    // Initials fallback – use theme colors or gradient
    return (
      <View 
        style={[
          styles.initialsContainer,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.muted },
        ]}
      >
        <Text style={[styles.initials, { fontSize: size * 0.38, color: colors.tint }]}>{initials}</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.container, style]}>
        {renderAvatar()}
        {showStatus && isOnline && (
          <View
            style={[
              styles.statusIndicator,
              {
                width: size * 0.25,
                height: size * 0.25,
                borderRadius: (size * 0.25) / 2,
                borderWidth: Math.max(1, size * 0.03),
              },
            ]}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

function getStyles(colors: any, activeScheme: string) {
  return StyleSheet.create({
  container: {
    position: 'relative',
  },
  initialsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  initials: {
    fontWeight: '700',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#34C759',
    borderColor: colors.background,
    borderWidth: 2,
  },
});
}

export default Avatar;