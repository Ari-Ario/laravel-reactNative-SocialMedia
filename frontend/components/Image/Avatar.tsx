import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LazyImage from './LazyImage';

interface AvatarProps {
  source?: string | null;
  size?: number;
  name?: string;
  isOnline?: boolean;
  onPress?: () => void;
  borderColor?: string;
  showStatus?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({
  source,
  size = 40,
  name,
  isOnline = false,
  onPress,
  borderColor = '#007AFF',
  showStatus = true,
}) => {
  // Generate initials or use fallback
  const initials = name
    ?.split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  // Use fallback if no source
  const actualSource = source 
    ? { uri: source }
    : { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=007AFF&color=fff&size=${size}` };

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress}>
      <View style={styles.container}>
        <LazyImage
          source={actualSource}
          style={[
            styles.avatar,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
          placeholderColor="#e0e0e0"
        />
        {showStatus && isOnline && (
          <View
            style={[
              styles.statusIndicator,
              {
                width: size * 0.25,
                height: size * 0.25,
                borderRadius: (size * 0.25) / 2,
                borderWidth: size * 0.03,
                borderColor: '#fff',
                backgroundColor: '#4CAF50',
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
  avatar: {
    overflow: 'hidden',
  },
  initialsContainer: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '600',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
});

export default Avatar;