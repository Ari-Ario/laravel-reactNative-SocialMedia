import React, { useState, memo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Linking,
  Dimensions,
  Share,
  Alert,
  Animated,
  Pressable,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import LocationPreview from './ChatScreen/LocationPreview';
import { useSavedLocationsStore } from '@/stores/savedLocationsStore';
import { useModal } from '@/context/ModalContext';
import * as Clipboard from 'expo-clipboard';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const LIBRARIES: any = ['places'];

// Conditional imports for maps
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
  onSaveLocation?: (location: any) => void;
  isSaved?: boolean;
}

const LocationModal: React.FC<LocationModalProps> = ({
  visible,
  onClose,
  location,
  onSaveLocation,
  isSaved = false,
}) => {
  const insets = useSafeAreaInsets();
  const { openModal } = useModal();
  const { toggleFavorite, isFavorite } = useSavedLocationsStore();

  const [mapLoaded, setMapLoaded] = useState(false);
  const [copied, setCopied] = useState<'coordinates' | 'address' | null>(null);

  // More robust coordinate parsing
  const latStr = location.latitude?.toString() || location.lat?.toString();
  const lngStr = location.longitude?.toString() || location.lng?.toString();
  
  const lat = latStr ? parseFloat(latStr) : 0;
  const lng = lngStr ? parseFloat(lngStr) : 0;
  
  const saved = isFavorite(lat, lng);
  const [distance, setDistance] = useState<string | null>(null);
  const [travelTime, setTravelTime] = useState<string | null>(null);
  
  // Debug log for coordinates
  useEffect(() => {
    if (visible) {
      console.log('📍 LocationModal Coordinates:', { lat, lng, original: location });
    }
  }, [visible, lat, lng, location]);

  const [directionsMode, setDirectionsMode] = useState<'drive' | 'walk' | 'transit'>('drive');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);

  // Check location permission
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationStatus(status);
    })();
  }, []);

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Web loader
  const { isLoaded } = Platform.OS === 'web'
    ? (useJsApiLoader ? useJsApiLoader({
      id: 'google-map-script',
      googleMapsApiKey: apiKey || '',
      libraries: LIBRARIES
    }) : { isLoaded: false })
    : { isLoaded: true };

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  }, [visible]);

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceVal = R * c;

    // Format distance
    let distStr = '';
    if (distanceVal < 1) {
      distStr = `${Math.round(distanceVal * 1000)} m`;
    } else {
      distStr = `${distanceVal.toFixed(1)} km`;
    }
    setDistance(distStr);

    // Estimate travel time based on mode
    let speed = directionsMode === 'walk' ? 5 : directionsMode === 'transit' ? 20 : 50;
    const time = distanceVal / speed * 60; // in minutes
    let timeStr = '';
    if (time < 1) {
      timeStr = 'Less than 1 min';
    } else if (time < 60) {
      timeStr = `${Math.round(time)} min`;
    } else {
      const hours = Math.floor(time / 60);
      const minutes = Math.round(time % 60);
      timeStr = `${hours} hr ${minutes} min`;
    }
    setTravelTime(timeStr);
  }, [directionsMode]);

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      // Reset states AFTER parent removes the modal from tree
      setMapLoaded(false);
      setCopied(null);
    });
  }, [onClose, scaleAnim, opacityAnim]);

  // 2. User Location Effect
  useEffect(() => {
    if (!visible) return;

    const getUserLoc = async () => {
      if (Platform.OS !== 'web') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        }
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => console.log('Geolocation error:', error)
        );
      }
    };

    getUserLoc();
  }, [visible]);

  // 3. Distance Calculation Effect
  useEffect(() => {
    if (userLocation && lat && lng) {
      calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
    }
  }, [userLocation, lat, lng, directionsMode, calculateDistance]);

  useEffect(() => {
    // No longer needed as `saved` is derived from store
  }, [isSaved]);


  const handleOpenInMaps = useCallback(() => {
    let url;
    if (directionsMode === 'drive') {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    } else if (directionsMode === 'walk') {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=transit`;
    }

    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [directionsMode, lat, lng]);

  const handleShare = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    openModal('share', { location: { ...location, latitude: lat, longitude: lng } });
  }, [location, lat, lng, openModal]);


  const handleCopyAddress = useCallback(async () => {
    if (!location.address) return;
    await Clipboard.setStringAsync(location.address);
    setCopied('address');
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setCopied(null), 2000);
  }, [location.address]);

  const handleSaveLocation = useCallback(() => {
    toggleFavorite({
      latitude: lat,
      longitude: lng,
      name: location.name,
      address: location.address,
    });

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [lat, lng, location.name, location.address, toggleFavorite]);

  const handleGetDirections = useCallback(() => {
    if (userLocation) {
      handleOpenInMaps();
    } else {
      Alert.alert(
        'Location Required',
        'We need your location to calculate directions. Please enable location services.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
    }
  }, [userLocation, handleOpenInMaps]);

  const formatAddress = () => {
    if (location.address) return location.address;
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0 && !location.name)) {
    console.warn('📍 LocationModal: Invalid coordinates', { lat, lng });
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      {Platform.OS !== 'web' && (
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      )}
      <BlurView
        intensity={90}
        tint="dark"
        style={[styles.overlay, StyleSheet.absoluteFill]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
        />
        <Animated.View
          style={[
            GlobalStyles.popupContainer,
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
              paddingTop: insets.top,
              backgroundColor: '#1c1c1e', // Ensure contrast
            },
          ]}
        >
          {/* Premium Glass Header */}
          <LinearGradient
            colors={['rgba(40, 40, 45, 0.95)', 'rgba(28, 28, 30, 0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerInfo}>
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#0084ff', '#0066cc']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGradient}
                >
                  <Ionicons name="location" size={22} color="white" />
                </LinearGradient>
              </View>

              <View style={styles.headerText}>
                <Text style={styles.title} numberOfLines={1}>
                  {location.name || 'Location Pin'}
                </Text>
                {location.address && (
                  <TouchableOpacity onPress={handleCopyAddress} activeOpacity={0.7}>
                    <Text style={styles.headerAddress} numberOfLines={1}>
                      {location.address}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
              <BlurView intensity={40} tint="light" style={styles.closeButtonBlur}>
                <Ionicons name="close" size={20} color="white" />
              </BlurView>
            </TouchableOpacity>
          </LinearGradient>

          {/* Map Container with Floating Badge */}
          <View style={styles.mapContainer}>
            {/* Interactive Map */}
            {Platform.OS === 'web' ? (
              isLoaded ? (
                <GoogleMap
                  mapContainerStyle={styles.map}
                  center={{ lat, lng }}
                  zoom={16}
                  onLoad={() => setMapLoaded(true)}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    styles: darkMapStyle,
                    gestureHandling: 'greedy',
                  }}
                >
                  <MarkerF position={{ lat, lng }}>
                    <MotiView
                      from={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.2, opacity: 1 }}
                      transition={{ type: 'spring', loop: true }}
                      style={styles.webMarkerPulse}
                    />
                  </MarkerF>
                </GoogleMap>
              ) : (
                <LocationPreview latitude={lat} longitude={lng} name={location.name} />
              )
            ) : (
              MapView && (
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  onMapReady={() => {
                    console.log('📍 LocationModal: Map Ready');
                    setMapLoaded(true);
                  }}
                  // provider="google" - Removing explicit Google provider to allow default fallback on Simulator
                  customMapStyle={darkMapStyle}
                  showsUserLocation={locationStatus === 'granted'}
                  showsMyLocationButton={false}
                  loadingEnabled={true}
                  showsCompass={false}
                  showsScale={false}
                  rotateEnabled={false}
                >
                  <Marker coordinate={{ latitude: lat, longitude: lng }}>
                    <MotiView
                      from={{ scale: 1 }}
                      animate={{ scale: 1.2 }}
                      transition={{ loop: true, type: 'timing', duration: 1000 }}
                    >
                      <LinearGradient
                        colors={['#0084ff', '#0066cc']}
                        style={styles.nativeMarker}
                      >
                        <Ionicons name="location" size={20} color="white" />
                      </LinearGradient>
                    </MotiView>
                  </Marker>
                </MapView>
              )
            )}

            {/* Loading Overlay with Premium Animation */}
            {!mapLoaded && (
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={styles.loaderOverlay}
              >
                <BlurView intensity={80} tint="dark" style={styles.loaderContent}>
                  <ActivityIndicator size="large" color="#0084ff" />
                  <Text style={styles.loaderText}>Loading map...</Text>
                </BlurView>
              </MotiView>
            )}

            {/* Distance & Time Badge */}
            {distance && travelTime && (
              <MotiView
                from={{ opacity: 0, translateY: -10 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={styles.distanceBadge}
              >
                <BlurView intensity={80} tint="dark" style={styles.distanceBadgeBlur}>
                  <View style={styles.distanceRow}>
                    <Ionicons name="location-outline" size={14} color="#0084ff" />
                    <Text style={styles.distanceText}>{distance}</Text>
                  </View>
                  <View style={styles.distanceRow}>
                    <Ionicons name="time-outline" size={14} color="#0084ff" />
                    <Text style={styles.distanceText}>{travelTime}</Text>
                  </View>
                </BlurView>
              </MotiView>
            )}

            {/* Quick Actions Strip - Moved to Top */}
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickAction} onPress={handleCopyAddress}>
                <BlurView intensity={60} tint="dark" style={styles.quickActionBlur}>
                  <Ionicons
                    name={copied === 'address' ? 'checkmark' : 'document-text-outline'}
                    size={18}
                    color={copied === 'address' ? '#4CAF50' : 'white'}
                  />
                  <Text style={styles.quickActionText}>
                    {copied === 'address' ? 'Copied!' : 'Address'}
                  </Text>
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickAction} onPress={handleShare}>
                <BlurView intensity={60} tint="dark" style={styles.quickActionBlur}>
                  <Ionicons name="share-outline" size={18} color="white" />
                  <Text style={styles.quickActionText}>Share</Text>
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickAction} onPress={handleSaveLocation}>
                <BlurView intensity={60} tint="dark" style={styles.quickActionBlur}>
                  <Ionicons
                    name={saved ? 'heart' : 'heart-outline'}
                    size={18}
                    color={saved ? '#FF3B30' : 'white'}
                  />
                  <Text style={styles.quickActionText}>{saved ? 'Saved' : 'Save'}</Text>
                </BlurView>
              </TouchableOpacity>
            </View>

            {/* Travel Mode Selector */}
            <View style={styles.travelModeSelector}>
              <BlurView intensity={80} tint="dark" style={styles.travelModeBlur}>
                <TouchableOpacity
                  style={[styles.travelModeButton, directionsMode === 'drive' && styles.travelModeActive]}
                  onPress={() => setDirectionsMode('drive')}
                >
                  <Ionicons
                    name="car-outline"
                    size={18}
                    color={directionsMode === 'drive' ? '#0084ff' : 'white'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.travelModeButton, directionsMode === 'walk' && styles.travelModeActive]}
                  onPress={() => setDirectionsMode('walk')}
                >
                  <Ionicons
                    name="walk-outline"
                    size={18}
                    color={directionsMode === 'walk' ? '#0084ff' : 'white'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.travelModeButton, directionsMode === 'transit' && styles.travelModeActive]}
                  onPress={() => setDirectionsMode('transit')}
                >
                  <Ionicons
                    name="bus-outline"
                    size={18}
                    color={directionsMode === 'transit' ? '#0084ff' : 'white'}
                  />
                </TouchableOpacity>
              </BlurView>
            </View>
          </View>

          {/* Premium Footer with Gradient */}
          <LinearGradient
            colors={['rgba(28, 28, 30, 0.95)', '#1c1c1e']}
            style={styles.footer}
          >
            <TouchableOpacity style={styles.favButton} onPress={handleSaveLocation}>
              <BlurView intensity={40} tint="light" style={styles.favButtonBlur}>
                <Ionicons
                  name={saved ? 'heart' : 'heart-outline'}
                  size={24}
                  color={saved ? '#FF3B30' : 'white'}
                />
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity style={styles.directionsButton} onPress={handleGetDirections}>
              <LinearGradient
                colors={['#0084ff', '#0066cc']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.directionsGradient}
              >
                <Ionicons name="navigate" size={18} color="white" />
                <Text style={styles.directionsText}>Get Directions</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

// Enhanced dark map style with more depth
const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
  { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#2f2f2f" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0f0f0f" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#3d3d3d" }] }
];

const styles = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  container: {
    width: Math.min(width * 0.95, 600),
    height: Math.min(height * 0.85, 800),
    backgroundColor: '#1c1c1e',
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 25,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0084ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
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
    marginBottom: 4,
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
  webMarkerPulse: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,132,255,0.3)',
    borderWidth: 2,
    borderColor: 'white',
  },
  nativeMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#0084ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loaderContent: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  loaderText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  distanceBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 6,
  },
  distanceBadgeBlur: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  travelModeSelector: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 6,
  },
  travelModeBlur: {
    flexDirection: 'row',
    borderRadius: 25,
    padding: 4,
    gap: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  travelModeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  travelModeActive: {
    backgroundColor: 'rgba(0,132,255,0.2)',
  },
  headerAddress: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },
  quickActions: {
    position: 'absolute',
    top: '90%', // Moved to top, below distance badge
    left: '10%',
    right: '10%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    zIndex: 7,
  },
  quickAction: {
    flex: 1,
    maxWidth: 80, // Slightly smaller to fit 4 buttons
  },
  quickActionBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 30,
    gap: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quickActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  directionsButton: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 20,
    shadowColor: '#0084ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  directionsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  directionsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  favButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
  },
  favButtonBlur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  copiedBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  copiedBadgeText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default memo(LocationModal);