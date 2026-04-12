import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Platform,
    Alert,
    ActivityIndicator,
    Dimensions,
    ScrollView,
    KeyboardAvoidingView,
    StatusBar,
    FlatList,
    Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MotiView, AnimatePresence } from 'moti';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/hooks/useAppTheme';

// Dynamic imports for platform-specific map implementations
let MapView: any;
let Marker: any;
let LoadScript: any;

if (Platform.OS === 'web') {
    // Web-specific imports
    try {
        const { GoogleMap, LoadScript: GoogleLoadScript, MarkerF } = require('@react-google-maps/api');
        MapView = GoogleMap;
        Marker = MarkerF;
        LoadScript = GoogleLoadScript;
    } catch (e) {
        console.warn('Google Maps API not available on web');
    }
} else {
    // Native imports
    try {
        const Maps = require('react-native-maps');
        MapView = Maps.default;
        Marker = Maps.Marker;
    } catch (e) {
        console.warn('react-native-maps not found on native');
    }
}

import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const { width, height } = Dimensions.get('window');

// Types
export interface LocationData {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
    isLive?: boolean;
    liveDuration?: number; // in minutes
}

interface ShareLocationProps {
    visible: boolean;
    onClose: () => void;
    onShareLocation: (location: LocationData) => void;
    onShareLiveLocation?: (location: LocationData, duration: number) => void;
    googlePlacesApiKey?: string;
}

interface Place {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distance?: string;
    icon?: string;
}

interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
}

// Predefined places near user
const NEARBY_PLACE_TYPES = [
    { icon: 'cafe', types: 'cafe', name: 'Coffee Shops' },
    { icon: 'restaurant', types: 'restaurant', name: 'Restaurants' },
    { icon: 'cart-outline', types: 'shopping_mall|store', name: 'Shopping' },
    { icon: 'leaf-outline', types: 'park', name: 'Parks' },
    { icon: 'car-outline', types: 'gas_station', name: 'Gas Stations' },
    { icon: 'medkit-outline', types: 'hospital', name: 'Hospitals' },
];

// Live location duration options (in minutes)
const LIVE_DURATIONS = [15, 30, 60, 120, 480];

// Web-specific map container style
const webMapContainerStyle = {
    width: '100%',
    height: '100%',
};

// Google Maps library array
const googleMapsLibraries = ['places'];

export const ShareLocation: React.FC<ShareLocationProps> = ({
    visible,
    onClose,
    onShareLocation,
    onShareLiveLocation,
    googlePlacesApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY',
}) => {
    const insets = useSafeAreaInsets();
    const { colors, activeScheme } = useAppTheme();

    // Location state
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [locationStatus, setLocationStatus] = useState<'pending' | 'granted' | 'denied' | 'unavailable'>('pending');
    const [address, setAddress] = useState<string>('');
    const [region, setRegion] = useState<Region>({
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    });
    const [selectedLocation, setSelectedLocation] = useState<{
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
    } | null>(null);

    // UI state
    const [loading, setLoading] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const [showLiveOptions, setShowLiveOptions] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState<number>(30);
    const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
    const [loadingNearby, setLoadingNearby] = useState(false);
    const [showPlaceTypes, setShowPlaceTypes] = useState(false);
    const [selectedPlaceType, setSelectedPlaceType] = useState<string | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    const mapRef = useRef<any>(null);
    const searchRef = useRef<any>(null);
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);

    // Request location permission and get current location
    const requestLocationPermission = useCallback(async () => {
        setLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status === 'granted') {
                setLocationStatus('granted');
                const currentLocation = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Highest,
                });
                setLocation(currentLocation);

                // Update region to current location
                const newRegion = {
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                };
                setRegion(newRegion);
                setSelectedLocation({
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                });

                // Get address for current location
                const [addressResult] = await Location.reverseGeocodeAsync({
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                });

                if (addressResult) {
                    const formattedAddress = [
                        addressResult.name,
                        addressResult.street,
                        addressResult.city,
                        addressResult.region,
                        addressResult.country,
                    ].filter(Boolean).join(', ');
                    setAddress(formattedAddress);
                }

                // Fetch nearby places
                fetchNearbyPlaces(currentLocation.coords.latitude, currentLocation.coords.longitude);
            } else if (status === 'denied') {
                setLocationStatus('denied');
                setRegion({
                    latitude: 20,
                    longitude: 0,
                    latitudeDelta: 100,
                    longitudeDelta: 50,
                });
            } else {
                setLocationStatus('unavailable');
            }
        } catch (error) {
            console.error('Location permission error:', error);
            setLocationStatus('unavailable');
        } finally {
            setLoading(false);
        }
    }, []);

    // Calculate distance between two coordinates
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance < 1) {
            return `${Math.round(distance * 1000)} m`;
        }
        return `${distance.toFixed(1)} km`;
    };

    const fetchOSMNearby = async (lat: number, lng: number, type?: string) => {
        try {
            let query = type || 'point of interest';
            if (type && type.includes('|')) {
                if (type === 'shopping_mall|store') query = 'shop';
                else query = type.split('|')[0];
            }
            if (!type) query = 'amenity,shop,tourism,point of interest';

            const v = 0.01; // approx ~1km
            const viewbox = `${lng - v},${lat - v},${lng + v},${lat + v}`;

            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=${viewbox}&bounded=1&limit=10`
            );

            const data = await response.json();
            const places: Place[] = data.map((item: any) => ({
                id: item.place_id.toString(),
                name: item.name || item.display_name.split(',')[0],
                address: item.display_name.split(',').slice(1, 3).join(',').trim(),
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                distance: calculateDistance(
                    lat,
                    lng,
                    parseFloat(item.lat),
                    parseFloat(item.lon)
                ),
            }));

            setNearbyPlaces(places);
        } catch (error) {
            console.error('OSM Nearby error:', error);
        }
    };

    // Fetch nearby places
    const fetchNearbyPlaces = async (lat: number, lng: number, type?: string) => {
        if (!googlePlacesApiKey || googlePlacesApiKey === 'YOUR_API_KEY') {
            const demoPlaces: Place[] = [
                { id: '1', name: 'Central Park', address: 'New York, NY', latitude: lat + 0.01, longitude: lng + 0.01, distance: '0.5 km' },
                { id: '2', name: 'Starbucks', address: '123 Main St', latitude: lat - 0.005, longitude: lng + 0.008, distance: '0.8 km' },
                { id: '3', name: 'Whole Foods Market', address: '456 Oak Ave', latitude: lat + 0.015, longitude: lng - 0.01, distance: '1.2 km' },
            ];
            setNearbyPlaces(demoPlaces);
            return;
        }

        setLoadingNearby(true);
        try {
            const searchParam = type 
                ? (type.includes('|') ? `&keyword=${encodeURIComponent(type)}` : `&type=${type}`)
                : `&keyword=point of interest`;

            const response = await fetch(
                `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1500${searchParam}&key=${googlePlacesApiKey}`
            );
            const data = await response.json();

            if (data.results) {
                const places: Place[] = data.results.slice(0, 10).map((place: any) => ({
                    id: place.place_id,
                    name: place.name,
                    address: place.vicinity,
                    latitude: place.geometry.location.lat,
                    longitude: place.geometry.location.lng,
                    icon: place.icon,
                    distance: calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng),
                }));
                setNearbyPlaces(places);
            } else {
                fetchOSMNearby(lat, lng, type);
            }
        } catch (error) {
            fetchOSMNearby(lat, lng, type);
        } finally {
            setLoadingNearby(false);
        }
    };

    // Helper to get a descriptive name from Google Places if reverse geocode is generic
    const getNearbyPlaceName = async (lat: number, lng: number): Promise<string | null> => {
        if (!googlePlacesApiKey || googlePlacesApiKey === 'YOUR_API_KEY') return null;
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=500&key=${googlePlacesApiKey}`
            );
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const candidates = data.results.filter((p: any) => 
                    !p.types.includes('locality') && !p.types.includes('political') && !p.types.includes('route')
                );
                return candidates.length > 0 ? candidates[0].name : data.results[0].name;
            }
        } catch (error) {}
        return null;
    };

    const stopLiveLocation = useCallback(() => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
    }, []);

    // Start live location sharing
    const startLiveLocation = useCallback(async () => {
        if (!location && locationStatus !== 'granted') return;
        try {
            const subscription = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
                (newLocation) => { setLocation(newLocation); }
            );
            locationSubscription.current = subscription;
            if (onShareLiveLocation && selectedLocation) {
                onShareLiveLocation({ ...selectedLocation, isLive: true, liveDuration: selectedDuration }, selectedDuration);
            }
            setTimeout(() => { stopLiveLocation(); }, selectedDuration * 60 * 1000);
            setShowLiveOptions(false);
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Could not start live location sharing.');
        }
    }, [location, locationStatus, selectedLocation, selectedDuration, onShareLiveLocation, stopLiveLocation, onClose]);

    const handlePlaceSelect = (place: any) => {
        const lat = place.geometry?.location?.lat() || place.geometry?.location?.lat || place.latitude;
        const lng = place.geometry?.location?.lng() || place.geometry?.location?.lng || place.longitude;
        setSelectedLocation({
            latitude: lat,
            longitude: lng,
            name: place.name || place.structured_formatting?.main_text,
            address: place.description || place.address,
        });
        if (mapRef.current) {
            if (Platform.OS === 'web') {
                mapRef.current.panTo({ lat, lng });
                mapRef.current.setZoom(16);
            } else {
                mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
            }
        }
        setSearchFocused(false);
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleMapPress = async (e: any) => {
        let latitude, longitude;
        if (Platform.OS === 'web') {
            latitude = e.latLng.lat();
            longitude = e.latLng.lng();
        } else {
            latitude = e.nativeEvent.coordinate.latitude;
            longitude = e.nativeEvent.coordinate.longitude;
        }
        setSelectedLocation({ latitude, longitude });
        try {
            const [addressResult] = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (addressResult) {
                const formattedAddress = [addressResult.name, addressResult.street, addressResult.city, addressResult.region, addressResult.country].filter(Boolean).join(', ');
                const isGenericName = !addressResult.name || /^[0-9-]+$/.test(addressResult.name);
                let resolvedName = addressResult.name;
                if (isGenericName) {
                    const nearbyName = await getNearbyPlaceName(latitude, longitude);
                    if (nearbyName) resolvedName = nearbyName;
                }
                setSelectedLocation(prev => ({ ...prev!, name: resolvedName || undefined, address: formattedAddress }));
            }
        } catch (error) {}
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleShare = () => {
        if (selectedLocation) {
            if (showLiveOptions) {
                startLiveLocation();
            } else {
                onShareLocation({ ...selectedLocation, name: selectedLocation.name || 'Selected Location', address: selectedLocation.address, isLive: false });
                onClose();
            }
        }
    };

    useEffect(() => {
        if (visible) {
            requestLocationPermission();
        } else {
            stopLiveLocation();
            setShowLiveOptions(false);
            setSelectedPlaceType(null);
        }
        return () => { stopLiveLocation(); };
    }, [visible, requestLocationPermission, stopLiveLocation]);

    const renderPermissionRequest = () => (
        <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.permissionContainer}>
            <View style={[styles.permissionIcon, { backgroundColor: colors.tint + '20' }]}>
                <Ionicons name="location-outline" size={48} color={colors.tint} />
            </View>
            <Text style={[styles.permissionTitle, { color: colors.text }]}>Share Your Location</Text>
            <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
                Allow access to your location to share where you are, find nearby places, and get directions.
            </Text>
            <View style={styles.permissionOptions}>
                <TouchableOpacity style={[styles.permissionButton, styles.allowOnceButton, { backgroundColor: colors.muted }]} onPress={() => requestLocationPermission()}>
                    <Text style={[styles.allowOnceText, { color: colors.text }]}>Allow Once</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.permissionButton, styles.allowAlwaysButton, { backgroundColor: colors.tint }]} onPress={() => requestLocationPermission()}>
                    <Text style={styles.allowAlwaysText}>While Using App</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.notNowButton} onPress={() => setLocationStatus('denied')}>
                <Text style={[styles.notNowText, { color: colors.tint }]}>Not Now</Text>
            </TouchableOpacity>
        </MotiView>
    );

    const renderMap = () => {
        if (!MapView) {
            return (
                <View style={[styles.map, styles.fallbackContainer, { backgroundColor: colors.muted }]}>
                    <Ionicons name="map-outline" size={64} color={colors.textSecondary} />
                    <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>
                        {Platform.OS === 'web' ? 'Loading Google Maps...' : 'Maps not available.'}
                    </Text>
                </View>
            );
        }

        if (Platform.OS === 'web' && googlePlacesApiKey && googlePlacesApiKey !== 'YOUR_API_KEY') {
            return (
                <LoadScript googleMapsApiKey={googlePlacesApiKey} libraries={googleMapsLibraries} onLoad={() => setMapLoaded(true)}>
                    {!mapLoaded && (
                        <View style={[styles.map, styles.fallbackContainer, { backgroundColor: colors.muted }]}>
                            <ActivityIndicator size="large" color={colors.tint} />
                            <Text style={[styles.loadingText, { color: colors.text }]}>Loading Map...</Text>
                        </View>
                    )}
                    <MapView
                        mapContainerStyle={webMapContainerStyle}
                        center={selectedLocation ? { lat: selectedLocation.latitude, lng: selectedLocation.longitude } : { lat: region.latitude, lng: region.longitude }}
                        zoom={15}
                        onClick={handleMapPress}
                        onLoad={(map: any) => { mapRef.current = map; setMapLoaded(true); }}
                        options={{ disableDefaultUI: true, mapTypeControl: false, styles: activeScheme === 'dark' ? darkMapStyle : [] }}
                    >
                        {selectedLocation && (
                            <Marker position={{ lat: selectedLocation.latitude, lng: selectedLocation.longitude }} title={selectedLocation.name || 'Selected Location'} />
                        )}
                    </MapView>
                </LoadScript>
            );
        }

        return (
            <MapView
                ref={mapRef}
                style={styles.map}
                region={region}
                onRegionChangeComplete={setRegion}
                onPress={handleMapPress}
                showsUserLocation={locationStatus === 'granted'}
                showsMyLocationButton={false}
                customMapStyle={activeScheme === 'dark' ? darkMapStyle : []}
            >
                {selectedLocation && (
                    <Marker coordinate={{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }}>
                        <View style={styles.markerContainer}>
                            <MotiView from={{ scale: 0.8, opacity: 0.5 }} animate={{ scale: 2, opacity: 0 }} transition={{ type: 'timing', duration: 1500, loop: true }} style={[styles.pulseRing, { backgroundColor: colors.tint + '40' }]} />
                            <View style={[styles.markerBubble, { backgroundColor: colors.surface, borderColor: colors.tint }]}>
                                <Ionicons name="location" size={24} color={colors.tint} />
                            </View>
                            <View style={[styles.markerArrow, { borderTopColor: colors.tint }]} />
                        </View>
                    </Marker>
                )}
            </MapView>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <StatusBar barStyle={activeScheme === 'dark' ? 'light-content' : 'dark-content'} />
            <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 16, borderBottomColor: colors.border + '40' }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.tint} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Share Location</Text>
                    <TouchableOpacity onPress={handleShare} disabled={!selectedLocation} style={[styles.shareButton, !selectedLocation && styles.shareButtonDisabled]}>
                        <Text style={[styles.shareButtonText, { color: selectedLocation ? colors.tint : colors.textSecondary }]}>Share</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={[styles.searchContainer, { borderBottomColor: colors.border + '20' }]}>
                    <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                    <GooglePlacesAutocomplete
                        ref={searchRef}
                        placeholder="Search for a place"
                        onPress={handlePlaceSelect}
                        query={{ key: googlePlacesApiKey, language: 'en', ...(location && { location: `${location.coords.latitude},${location.coords.longitude}`, radius: 50000 }) }}
                        styles={{
                            container: styles.autocompleteContainer,
                            textInput: [styles.searchInput, { backgroundColor: colors.muted, color: colors.text }],
                            listView: [styles.searchResults, { backgroundColor: colors.surface }],
                            row: [styles.searchResultRow, { backgroundColor: colors.surface }],
                            separator: [styles.searchSeparator, { backgroundColor: colors.border + '20' }],
                            description: [styles.searchDescription, { color: colors.text }],
                        }}
                        enablePoweredByContainer={false}
                        fetchDetails={true}
                        textInputProps={{ placeholderTextColor: colors.textSecondary }}
                    />
                </View>

                {/* Content Area */}
                <View style={styles.contentContainer}>
                    {locationStatus === 'denied' || locationStatus === 'pending' ? renderPermissionRequest() : renderMap()}
                    
                    {/* Live Location Toggle */}
                    <TouchableOpacity style={styles.liveToggle} onPress={() => setShowLiveOptions(!showLiveOptions)}>
                        <BlurView intensity={80} tint={activeScheme as any} style={[styles.liveToggleContent, { borderColor: colors.border + '40' }]}>
                            <Ionicons name="radio-outline" size={20} color={showLiveOptions ? '#FF3B30' : colors.text} />
                            <Text style={[styles.liveToggleText, { color: colors.text }, showLiveOptions && { color: '#FF3B30' }]}>Live Location</Text>
                        </BlurView>
                    </TouchableOpacity>

                    {/* Live Duration Options */}
                    <AnimatePresence>
                        {showLiveOptions && (
                            <MotiView from={{ opacity: 0, translateY: -20 }} animate={{ opacity: 1, translateY: 0 }} exit={{ opacity: 0, translateY: -20 }} style={styles.liveOptions}>
                                <BlurView intensity={90} tint={activeScheme as any} style={[styles.liveOptionsContent, { borderColor: colors.border + '40' }]}>
                                    <Text style={[styles.liveOptionsTitle, { color: colors.textSecondary }]}>Share your live location for:</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {LIVE_DURATIONS.map(dur => (
                                            <TouchableOpacity key={dur} style={[styles.durationOption, { backgroundColor: colors.muted }, selectedDuration === dur && { backgroundColor: colors.tint }]} onPress={() => setSelectedDuration(dur)}>
                                                <Text style={[styles.durationText, { color: colors.text }, selectedDuration === dur && { color: '#fff' }]}>{dur < 60 ? `${dur}m` : `${dur / 60}h`}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </BlurView>
                            </MotiView>
                        )}
                    </AnimatePresence>

                    {/* Bottom Places List */}
                    <View style={styles.bottomPanel}>
                        <BlurView intensity={90} tint={activeScheme as any} style={[styles.bottomPanelContent, { borderTopColor: colors.border + '20', backgroundColor: colors.surface + '80' }]}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.placeTypesScroll}>
                                {NEARBY_PLACE_TYPES.map(type => (
                                    <TouchableOpacity key={type.name} style={[styles.placeTypeChip, { backgroundColor: colors.muted }, selectedPlaceType === type.types && { backgroundColor: colors.tint }]} onPress={() => { setSelectedPlaceType(type.types); fetchNearbyPlaces(region.latitude, region.longitude, type.types); }}>
                                        <Ionicons name={type.icon as any} size={16} color={selectedPlaceType === type.types ? '#fff' : colors.text} />
                                        <Text style={[styles.placeTypeChipText, { color: colors.text }, selectedPlaceType === type.types && { color: '#fff' }]}>{type.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {loadingNearby ? (
                                <View style={styles.nearbyLoading}><ActivityIndicator color={colors.tint} /><Text style={[styles.nearbyLoadingText, { color: colors.textSecondary }]}>Finding nearby places...</Text></View>
                            ) : (
                                <FlatList
                                    data={nearbyPlaces}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity style={[styles.nearbyPlace, { borderBottomColor: colors.border + '20' }]} onPress={() => handlePlaceSelect(item)}>
                                            <View style={[styles.placeIcon, { backgroundColor: colors.tint + '10' }]}><Ionicons name="location-outline" size={20} color={colors.tint} /></View>
                                            <View style={styles.placeInfo}><Text style={[styles.placeName, { color: colors.text }]}>{item.name}</Text><Text style={[styles.placeAddress, { color: colors.textSecondary }]} numberOfLines={1}>{item.address}</Text></View>
                                            <Text style={[styles.placeDistance, { color: colors.textSecondary }]}>{item.distance}</Text>
                                        </TouchableOpacity>
                                    )}
                                    ListEmptyComponent={<View style={styles.emptyContainer}><Text style={[styles.emptyText, { color: colors.textSecondary }]}>No nearby places found</Text></View>}
                                />
                            )}
                        </BlurView>
                    </View>
                </View>
            </SafeAreaView>
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
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0f0f0f" }] }
];

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    closeButton: { padding: 4 },
    shareButton: { paddingHorizontal: 16, paddingVertical: 8 },
    shareButtonDisabled: { opacity: 0.5 },
    shareButtonText: { fontSize: 16, fontWeight: '600' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, zIndex: 100 },
    searchIcon: { marginRight: 8 },
    autocompleteContainer: { flex: 1 },
    searchInput: { height: 44, borderRadius: 22, paddingHorizontal: 16, fontSize: 16 },
    searchResults: { position: 'absolute', top: 50, left: 0, right: 0, zIndex: 1000, elevation: 5, borderRadius: 12, overflow: 'hidden' },
    searchResultRow: { padding: 13, height: 44, flexDirection: 'row' },
    searchSeparator: { height: 1 },
    searchDescription: { fontSize: 14 },
    contentContainer: { flex: 1, position: 'relative' },
    map: { width: width, height: height },
    markerContainer: { alignItems: 'center', justifyContent: 'center' },
    pulseRing: { position: 'absolute', width: 40, height: 40, borderRadius: 20 },
    markerBubble: { padding: 8, borderRadius: 24, borderWidth: 2 },
    markerArrow: { width: 0, height: 0, borderStyle: 'solid', borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
    fallbackContainer: { justifyContent: 'center', alignItems: 'center', padding: 40 },
    fallbackText: { textAlign: 'center', marginTop: 20, fontSize: 14 },
    loadingText: { marginTop: 16, fontSize: 14 },
    liveToggle: { position: 'absolute', top: 16, right: 16, zIndex: 30 },
    liveToggleContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1 },
    liveToggleText: { fontSize: 14, fontWeight: '500' },
    liveOptions: { position: 'absolute', top: 80, right: 16, left: 16, zIndex: 25 },
    liveOptionsContent: { padding: 16, borderRadius: 16, borderWidth: 1 },
    liveOptionsTitle: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
    durationOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
    durationText: { fontSize: 14, fontWeight: '500' },
    bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: height * 0.4 },
    bottomPanelContent: { padding: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1 },
    placeTypesScroll: { flexDirection: 'row', marginBottom: 16 },
    placeTypeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, gap: 6 },
    placeTypeChipText: { fontSize: 14, fontWeight: '500' },
    nearbyLoading: { padding: 32, alignItems: 'center' },
    nearbyLoadingText: { marginTop: 12, fontSize: 14 },
    nearbyPlace: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    placeIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    placeInfo: { flex: 1 },
    placeName: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
    placeAddress: { fontSize: 14 },
    placeDistance: { fontSize: 14, marginLeft: 12 },
    emptyContainer: { alignItems: 'center', padding: 32 },
    emptyText: { fontSize: 14 },
    permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    permissionIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    permissionTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    permissionText: { fontSize: 16, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
    permissionOptions: { width: '100%', gap: 12, marginBottom: 16 },
    permissionButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    allowOnceButton: {},
    allowAlwaysButton: {},
    allowOnceText: { fontSize: 16, fontWeight: '600' },
    allowAlwaysText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    notNowButton: { paddingVertical: 12 },
    notNowText: { fontSize: 16 },
});

export default ShareLocation;