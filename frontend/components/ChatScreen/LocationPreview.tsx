import React, { memo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { MotiView } from 'moti';

interface LocationPreviewProps {
  latitude: number;
  longitude: number;
  style?: any;
  name?: string;
}

const LocationPreviewComponent: React.FC<LocationPreviewProps> = ({
  latitude,
  longitude,
  style,
  name
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Use the same static map logic as web for performance and consistency
  const staticMapUrl = apiKey && !imageError
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=18&size=600x300&maptype=roadmap&markers=color:red%7C${latitude},${longitude}&key=${apiKey}`
    : null;

  const openMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={openMaps}
      style={[styles.container, style]}
    >
      {staticMapUrl ? (
        <>
          {imageLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          )}
          <Image
            source={{ uri: staticMapUrl }}
            style={[styles.image, imageLoading && styles.imageHidden]}
            resizeMode="cover"
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
          />
        </>
      ) : (
        <View style={styles.fallbackContainer}>
          <Ionicons name="map-outline" size={32} color="#8E8E93" />
          <Text style={styles.fallbackText}>Tap to open map</Text>
        </View>
      )}

      {/* Premium Overlay */}
      <View style={styles.overlay}>
        <Ionicons name="map-outline" size={14} color="#fff" />
        <Text style={styles.text}>Open in Maps</Text>
      </View>

      {/* Coordinate Badge */}
      <View style={styles.coordsBadge}>
        <Ionicons name="navigate" size={10} color="#8E8E93" />
        <Text style={styles.coordsText}>
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const LocationPreview = memo(LocationPreviewComponent);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1c1c1e',
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageHidden: {
    opacity: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    zIndex: 1,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    gap: 8,
  },
  fallbackText: {
    color: '#8E8E93',
    fontSize: 12,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  text: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  coordsBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  coordsText: {
    fontSize: 9,
    color: '#8E8E93',
    fontWeight: '400',
  },
});

export default LocationPreview;
