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

  // Google Maps Static API URL with higher quality and zoom
  const staticMapUrl = apiKey && !imageError
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=18&size=600x300&maptype=roadmap&markers=color:red%7C${latitude},${longitude}&key=${apiKey}`
    : null;

  const openMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
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
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={styles.loadingContainer}
            >
              <ActivityIndicator size="small" color="#007AFF" />
            </MotiView>
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
        <MotiView
          from={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring' }}
          style={styles.mapGrid}
        >
          {/* Animated grid lines */}
          <MotiView
            from={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ type: 'timing', duration: 500 }}
            style={styles.roadH}
          />
          <MotiView
            from={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ type: 'timing', duration: 500, delay: 100 }}
            style={styles.roadV}
          />

          {/* Animated marker */}
          <MotiView
            from={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 200 }}
            style={styles.markerContainer}
          >
            <MotiView
              from={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{
                type: 'timing',
                duration: 1500,
                loop: true,
              }}
              style={styles.pulse}
            />
            <Ionicons name="location" size={24} color="#FF3B30" />
          </MotiView>

          {/* Location name if provided */}
          {name && (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 300 }}
              style={styles.nameTag}
            >
              <Text style={styles.nameText} numberOfLines={1}>
                {name}
              </Text>
            </MotiView>
          )}
        </MotiView>
      )}

      {/* Overlay with glass morphism effect */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 400 }}
        style={styles.overlay}
      >
        <Ionicons name="map-outline" size={16} color="#fff" />
        <Text style={styles.text}>Open in Maps</Text>
      </MotiView>

      {/* Coordinates badge for precision */}
      <MotiView
        from={{ opacity: 0, translateX: 20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ delay: 500 }}
        style={styles.coordsBadge}
      >
        <Ionicons name="navigate" size={12} color="#8E8E93" />
        <Text style={styles.coordsText}>
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </Text>
      </MotiView>
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
  mapGrid: {
    flex: 1,
    backgroundColor: '#2c2c2e',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  roadH: {
    position: 'absolute',
    height: 40,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: '40%',
    transform: [{ scaleX: 1 }],
  },
  roadV: {
    position: 'absolute',
    width: 40,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    left: '50%',
    transform: [{ scaleY: 1 }],
  },
  markerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  pulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
  },
  nameTag: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
  },
  nameText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
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
    paddingVertical: 8,
    gap: 6,
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  text: {
    fontSize: 12,
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
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
  },
  coordsText: {
    fontSize: 9,
    color: '#8E8E93',
    fontWeight: '400',
  },
});

export default LocationPreview;