import React, { useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { MotiView, AnimatePresence } from 'moti';
import LocationPreview from './ChatScreen/LocationPreview';

// Conditional imports for maps to handle both web and native platforms
let MapView: any;
let Marker: any;
let GoogleMap: any;
let MarkerF: any;
let useJsApiLoader: any;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
  } catch (e) {
    console.error('Error loading react-native-maps:', e);
  }
} else {
  try {
    const GoogleMaps = require('@react-google-maps/api');
    GoogleMap = GoogleMaps.GoogleMap;
    MarkerF = GoogleMaps.MarkerF;
    useJsApiLoader = GoogleMaps.useJsApiLoader;
  } catch (e) {
    console.error('Error loading @react-google-maps/api:', e);
  }
}

interface LocationModalProps {
  visible: boolean;
  onClose: () => void;
  location: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    name?: string;
    address?: string;
  };
}

const LocationModal: React.FC<LocationModalProps> = ({ visible, onClose, location }) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const lat = location?.latitude || location?.lat;
  const lng = location?.longitude || location?.lng;

  // Web loader
  const { isLoaded } = Platform.OS === 'web' 
    ? useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: apiKey || '',
        libraries: ['places']
      })
    : { isLoaded: true };

  if (!lat || !lng) return null;

  const handleOpenInMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={90} tint="dark" style={styles.overlay}>
        <AnimatePresence>
          {visible && (
            <MotiView
              from={{ opacity: 0, scale: 0.9, translateY: 20 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              exit={{ opacity: 0, scale: 0.9, translateY: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 150 }}
              style={styles.container}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerInfo}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="location" size={20} color="#0084ff" />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.title} numberOfLines={1}>
                      {location.name || 'Location Hub'}
                    </Text>
                    {location.address && (
                      <Text style={styles.subtitle} numberOfLines={1}>
                        {location.address}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <BlurView intensity={40} tint="light" style={styles.closeButtonBlur}>
                    <Ionicons name="close" size={22} color="white" />
                  </BlurView>
                </TouchableOpacity>
              </View>

              {/* Map Container */}
              <View style={styles.mapContainer}>
                {/* Instant Static Placeholder (while interactive map loads) */}
                {!mapLoaded && (
                  <View style={StyleSheet.absoluteFill}>
                    <LocationPreview latitude={lat} longitude={lng} name={location.name} />
                    <View style={styles.loaderOverlay}>
                      <ActivityIndicator size="small" color="#0084ff" />
                      <Text style={styles.loaderText}>Activating Lens...</Text>
                    </View>
                  </View>
                )}

                {/* Interactive Map */}
                {Platform.OS === 'web' ? (
                  isLoaded && (
                    <GoogleMap
                      mapContainerStyle={styles.map}
                      center={{ lat, lng }}
                      zoom={15}
                      onLoad={() => setMapLoaded(true)}
                      options={{
                        disableDefaultUI: true,
                        zoomControl: true,
                        styles: darkMapStyle
                      }}
                    >
                      <MarkerF position={{ lat, lng }} />
                    </GoogleMap>
                  )
                ) : (
                  MapView && (
                    <MapView
                      style={styles.map}
                      initialRegion={{
                        latitude: lat,
                        longitude: lng,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      onMapReady={() => setMapLoaded(true)}
                      provider="google"
                      customMapStyle={darkMapStyle}
                    >
                      <Marker coordinate={{ latitude: lat, longitude: lng }}>
                         <MotiView
                           from={{ scale: 1, opacity: 0.5 }}
                           animate={{ scale: 1.5, opacity: 0 }}
                           transition={{ loop: true, type: 'timing', duration: 1500 }}
                           style={styles.nativeMarkerPulse}
                         />
                         <Ionicons name="location" size={32} color="#0084ff" />
                      </Marker>
                    </MapView>
                  )
                )}
              </View>

              {/* Bottom Action Bar */}
              <View style={styles.footer}>
                <TouchableOpacity style={styles.directionsButton} onPress={handleOpenInMaps}>
                  <Ionicons name="navigate" size={18} color="white" />
                  <Text style={styles.directionsText}>Get Directions</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.shareLocIcon} onPress={() => {}}>
                   <Ionicons name="share-social-outline" size={24} color="#0084ff" />
                </TouchableOpacity>
              </View>
            </MotiView>
          )}
        </AnimatePresence>
      </BlurView>
    </Modal>
  );
};

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 600,
    height: '75%',
    backgroundColor: '#1c1c1e',
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 132, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    marginLeft: 10,
  },
  closeButtonBlur: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    zIndex: 2,
  },
  loaderText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    backgroundColor: '#1c1c1e',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  directionsButton: {
    flex: 1,
    backgroundColor: '#0084ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 15,
    gap: 8,
  },
  directionsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareLocIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeMarkerPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 132, 255, 0.3)',
    top: -14,
    left: -14,
  }
});

export default memo(LocationModal);
