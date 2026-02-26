import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import getApiBaseImage from '@/services/getApiBaseImage';

interface AvatarProps {
  source?: string | null;
  size?: number;
  name?: string;
  isOnline?: boolean;
  onPress?: () => void;
  borderColor?: string;
  showStatus?: boolean;
}

/**
 * High-performance Avatar component with local initials fallback.
 * Handles 404 image errors without external dependencies.
 * Works on both Web and Mobile.
 */
const Avatar: React.FC<AvatarProps> = ({
  source,
  size = 40,
  name,
  isOnline = false,
  onPress,
  showStatus = true,
}) => {
  const [imgError, setImgError] = useState(false);

  // Resolve URI: relative paths become full API storage URLs
  const resolveUri = (src: string) =>
    src.startsWith('http') ? src : `${getApiBaseImage()}/storage/${src}`;

  // Build initials: up to 2 characters from name words
  const initials = name
    ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : '?';

  const renderAvatar = () => {
    if (source && !imgError) {
      return (
        <Image
          source={{ uri: resolveUri(source), cache: 'force-cache' }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImgError(true)}
        />
      );
    }
    // Initials fallback – zero external requests
    return (
      <View style={[
        styles.initialsContainer,
        { width: size, height: size, borderRadius: size / 2 },
      ]}>
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.container}>
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

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  initialsContainer: {
    backgroundColor: '#007AFF20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF40',
  },
  initials: {
    color: '#007AFF',
    fontWeight: '700',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderColor: '#fff',
    borderWidth: 2,
  },
});

export default Avatar;