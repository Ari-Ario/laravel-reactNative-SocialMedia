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
    SafeAreaView,
    StatusBar,
    FlatList,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Dynamic imports for platform-specific map implementations
let MapView: any;
let Marker: any;

if (Platform.OS === 'web') {
    // Web-specific imports
    try {
        // We'll use a dynamic import pattern for web
        const { GoogleMap, LoadScript, MarkerF } = require('@react-google-maps/api');
        MapView = GoogleMap;
        Marker = MarkerF;
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

// Predefined places near user (will be populated with real data)
const NEARBY_PLACE_TYPES = [
    { icon: 'cafe', types: 'cafe', name: 'Coffee Shops' },
    { icon: 'restaurant', types: 'restaurant', name: 'Restaurants' },
    { icon: 'shopping-bag', types: 'shopping_mall|store', name: 'Shopping' },
    { icon: 'park', types: 'park', name: 'Parks' },
    { icon: 'gas-station', types: 'gas_station', name: 'Gas Stations' },
    { icon: 'hospital', types: 'hospital', name: 'Hospitals' },
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
    googlePlacesApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY', // Replace with your key or use env
}) => {
    const insets = useSafeAreaInsets();

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

    // Fetch nearby places using Google Places API (or fallback)
    const fetchNearbyPlaces = async (lat: number, lng: number, type?: string) => {
        if (!googlePlacesApiKey || googlePlacesApiKey === 'YOUR_API_KEY') {
            // Demo data when no API key
            const demoPlaces: Place[] = [
                {
                    id: '1',
                    name: 'Central Park',
                    address: 'New York, NY',
                    latitude: lat + 0.01,
                    longitude: lng + 0.01,
                    distance: '0.5 km',
                },
                {
                    id: '2',
                    name: 'Starbucks',
                    address: '123 Main St',
                    latitude: lat - 0.005,
                    longitude: lng + 0.008,
                    distance: '0.8 km',
                },
                {
                    id: '3',
                    name: 'Whole Foods Market',
                    address: '456 Oak Ave',
                    latitude: lat + 0.015,
                    longitude: lng - 0.01,
                    distance: '1.2 km',
                },
                {
                    id: '4',
                    name: 'Planet Fitness',
                    address: '789 Pine Rd',
                    latitude: lat - 0.02,
                    longitude: lng - 0.015,
                    distance: '1.8 km',
                },
                {
                    id: '5',
                    name: 'Walgreens',
                    address: '321 Elm St',
                    latitude: lat + 0.025,
                    longitude: lng + 0.02,
                    distance: '2.1 km',
                },
            ];
            setNearbyPlaces(demoPlaces);
            return;
        }

        setLoadingNearby(true);
        try {
            const typesParam = type ? `&type=${type}` : '';
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1500${typesParam}&key=${googlePlacesApiKey}`
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
                    distance: calculateDistance(
                        lat,
                        lng,
                        place.geometry.location.lat,
                        place.geometry.location.lng
                    ),
                }));
                setNearbyPlaces(places);
            }
        } catch (error) {
            console.error('Error fetching nearby places:', error);
        } finally {
            setLoadingNearby(false);
        }
    };

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

    // Start live location sharing
    const startLiveLocation = useCallback(async () => {
        if (!location && locationStatus !== 'granted') return;

        try {
            const subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 5000,
                    distanceInterval: 10,
                },
                (newLocation) => {
                    setLocation(newLocation);
                }
            );

            locationSubscription.current = subscription;

            if (onShareLiveLocation && selectedLocation) {
                onShareLiveLocation({
                    ...selectedLocation,
                    isLive: true,
                    liveDuration: selectedDuration,
                }, selectedDuration);
            }

            setTimeout(() => {
                stopLiveLocation();
            }, selectedDuration * 60 * 1000);

            setShowLiveOptions(false);
            onClose();
        } catch (error) {
            console.error('Live location error:', error);
            Alert.alert('Error', 'Could not start live location sharing.');
        }
    }, [location, locationStatus, selectedLocation, selectedDuration, onShareLiveLocation]);

    const stopLiveLocation = useCallback(() => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
    }, []);

    // Handle place selection from search or nearby
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
                mapRef.current?.animateToRegion({
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }, 1000);
            }
        }

        setSearchFocused(false);
        if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    // Handle current location button
    const handleCurrentLocation = () => {
        if (location) {
            const { latitude, longitude } = location.coords;

            if (Platform.OS === 'web' && mapRef.current) {
                mapRef.current.panTo({ lat: latitude, lng: longitude });
                mapRef.current.setZoom(16);
            } else {
                mapRef.current?.animateToRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }, 1000);
            }

            setSelectedLocation({
                latitude,
                longitude,
                name: 'Current Location',
                address: address,
            });
        }
    };

    // Handle map press to select custom location
    const handleMapPress = async (e: any) => {
        let latitude, longitude;

        if (Platform.OS === 'web') {
            latitude = e.latLng.lat();
            longitude = e.latLng.lng();
        } else {
            latitude = e.nativeEvent.coordinate.latitude;
            longitude = e.nativeEvent.coordinate.longitude;
        }

        setSelectedLocation({
            latitude,
            longitude,
        });

        try {
            const [addressResult] = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            if (addressResult) {
                const formattedAddress = [
                    addressResult.name,
                    addressResult.street,
                    addressResult.city,
                    addressResult.region,
                    addressResult.country,
                ].filter(Boolean).join(', ');

                setSelectedLocation(prev => ({
                    ...prev!,
                    address: formattedAddress,
                }));
            }
        } catch (error) {
            console.error('Reverse geocode error:', error);
        }

        if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    // Handle share button
    const handleShare = () => {
        if (selectedLocation) {
            if (showLiveOptions) {
                startLiveLocation();
            } else {
                onShareLocation({
                    ...selectedLocation,
                    name: selectedLocation.name || 'Selected Location',
                    address: selectedLocation.address,
                    isLive: false,
                });
                onClose();
            }
        }
    };

    // Initialize on mount
    useEffect(() => {
        if (visible) {
            requestLocationPermission();
        } else {
            stopLiveLocation();
            setShowLiveOptions(false);
            setSelectedPlaceType(null);
        }

        return () => {
            stopLiveLocation();
        };
    }, [visible]);

    // Render permission request UI
    const renderPermissionRequest = () => (
        <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={styles.permissionContainer}
        >
            <View style={styles.permissionIcon}>
                <Ionicons name="location-outline" size={48} color="#007AFF" />
            </View>
            <Text style={styles.permissionTitle}>Share Your Location</Text>
            <Text style={styles.permissionText}>
                Allow access to your location to share where you are, find nearby places, and get directions.
            </Text>
            <View style={styles.permissionOptions}>
                <TouchableOpacity
                    style={[styles.permissionButton, styles.allowOnceButton]}
                    onPress={async () => {
                        await requestLocationPermission();
                        if (Platform.OS === 'ios') {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                    }}
                >
                    <Text style={styles.allowOnceText}>Allow Once</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.permissionButton, styles.allowAlwaysButton]}
                    onPress={async () => {
                        await requestLocationPermission();
                        if (Platform.OS === 'ios') {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                    }}
                >
                    <Text style={styles.allowAlwaysText}>While Using App</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                style={styles.notNowButton}
                onPress={() => {
                    setLocationStatus('denied');
                    if (Platform.OS === 'ios') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                }}
            >
                <Text style={styles.notNowText}>Not Now</Text>
            </TouchableOpacity>
        </MotiView>
    );

    // Render map based on platform
    const renderMap = () => {
        if (!MapView) {
            return (
                <View style={[styles.map, styles.fallbackContainer]}>
                    <Ionicons name="map-outline" size={64} color="#8E8E93" />
                    <Text style={styles.fallbackText}>
                        {Platform.OS === 'web'
                            ? 'Loading Google Maps... Please ensure API key is configured.'
                            : 'Maps not available. Please rebuild the app with npx expo run:android'}
                    </Text>
                </View>
            );
        }

        if (Platform.OS === 'web' && googlePlacesApiKey && googlePlacesApiKey !== 'YOUR_API_KEY') {
            return (
                <LoadScript
                    googleMapsApiKey={googlePlacesApiKey}
                    libraries={googleMapsLibraries}
                    onLoad={() => setMapLoaded(true)}
                >
                    {!mapLoaded && (
                        <View style={[styles.map, styles.fallbackContainer]}>
                            <ActivityIndicator size="large" color="#007AFF" />
                            <Text style={styles.loadingText}>Loading Map...</Text>
                        </View>
                    )}
                    <MapView
                        mapContainerStyle={webMapContainerStyle}
                        center={selectedLocation ? selectedLocation : region}
                        zoom={15}
                        onClick={handleMapPress}
                        onLoad={(map: any) => {
                            mapRef.current = map;
                            setMapLoaded(true);
                        }}
                        options={{
                            streetViewControl: false,
                            mapTypeControl: false,
                            fullscreenControl: false,
                        }}
                    >
                        {selectedLocation && (
                            <Marker
                                position={{
                                    lat: selectedLocation.latitude,
                                    lng: selectedLocation.longitude,
                                }}
                                title={selectedLocation.name || 'Selected Location'}
                            />
                        )}
                    </MapView>
                </LoadScript>
            );
        }

        // Native map implementation
        return (
            <MapView
                ref={mapRef}
                style={styles.map}
                region={region}
                onRegionChangeComplete={setRegion}
                onPress={handleMapPress}
                showsUserLocation={locationStatus === 'granted'}
                showsMyLocationButton={false}
                showsCompass={true}
                showsScale={true}
                loadingEnabled={true}
            >
                {selectedLocation && (
                    <Marker
                        coordinate={{
                            latitude: selectedLocation.latitude,
                            longitude: selectedLocation.longitude,
                        }}
                        title={selectedLocation.name || 'Selected Location'}
                        description={selectedLocation.address}
                    >
                        <View style={styles.markerContainer}>
                            <MotiView
                                from={{ scale: 0.8, opacity: 0.5 }}
                                animate={{ scale: 2, opacity: 0 }}
                                transition={{
                                    type: 'timing',
                                    duration: 1500,
                                    loop: true,
                                }}
                                style={styles.pulseRing}
                            />
                            <View style={styles.markerBubble}>
                                <Ionicons name="location" size={24} color="#007AFF" />
                            </View>
                            <View style={styles.markerArrow} />
                        </View>
                    </Marker>
                )}
            </MapView>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 16 }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Share Location</Text>
                    <TouchableOpacity
                        onPress={handleShare}
                        disabled={!selectedLocation}
                        style={[
                            styles.shareButton,
                            !selectedLocation && styles.shareButtonDisabled,
                        ]}
                    >
                        <Text
                            style={[
                                styles.shareButtonText,
                                !selectedLocation && styles.shareButtonTextDisabled,
                            ]}
                        >
                            Share
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
                    <GooglePlacesAutocomplete
                        ref={searchRef}
                        placeholder="Search for a place"
                        onPress={handlePlaceSelect}
                        query={{
                            key: googlePlacesApiKey,
                            language: 'en',
                            ...(location && {
                                location: `${location.coords.latitude},${location.coords.longitude}`,
                                radius: 50000,
                            }),
                        }}
                        styles={{
                            container: styles.autocompleteContainer,
                            textInput: styles.searchInput,
                            listView: styles.searchResults,
                            row: styles.searchResultRow,
                            separator: styles.searchSeparator,
                            description: styles.searchDescription,
                        }}
                        enablePoweredByContainer={false}
                        fetchDetails={true}
                        keepResultsAfterBlur={false}
                        textInputProps={{
                            placeholderTextColor: '#8E8E93',
                            returnKeyType: 'search',
                            onFocus: () => setSearchFocused(true),
                            onBlur: () => setSearchFocused(false),
                        }}
                    />
                    {locationStatus === 'granted' && (
                        <TouchableOpacity onPress={handleCurrentLocation} style={styles.currentLocationButton}>
                            <Ionicons name="locate" size={24} color="#007AFF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Main Content */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.loadingText}>Getting your location...</Text>
                    </View>
                ) : locationStatus === 'pending' ? (
                    renderPermissionRequest()
                ) : (
                    <View style={styles.contentContainer}>
                        {/* Map */}
                        {renderMap()}

                        {/* Live Location Toggle */}
                        {onShareLiveLocation && locationStatus === 'granted' && (
                            <TouchableOpacity
                                style={styles.liveToggle}
                                onPress={() => {
                                    setShowLiveOptions(!showLiveOptions);
                                    if (Platform.OS === 'ios') {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }
                                }}
                            >
                                <BlurView intensity={80} tint="dark" style={styles.liveToggleContent}>
                                    <Ionicons
                                        name={showLiveOptions ? 'radio-button-on' : 'radio-button-off'}
                                        size={20}
                                        color={showLiveOptions ? '#FF3B30' : '#fff'}
                                    />
                                    <Text style={[styles.liveToggleText, showLiveOptions && styles.liveToggleActive]}>
                                        Share Live Location
                                    </Text>
                                    <Ionicons
                                        name={showLiveOptions ? 'chevron-up' : 'chevron-down'}
                                        size={20}
                                        color="#fff"
                                    />
                                </BlurView>
                            </TouchableOpacity>
                        )}

                        {/* Live Duration Options */}
                        {showLiveOptions && (
                            <MotiView
                                from={{ opacity: 0, translateY: 20 }}
                                animate={{ opacity: 1, translateY: 0 }}
                                style={styles.liveOptions}
                            >
                                <BlurView intensity={80} tint="dark" style={styles.liveOptionsContent}>
                                    <Text style={styles.liveOptionsTitle}>Share live location for:</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {LIVE_DURATIONS.map((duration) => (
                                            <TouchableOpacity
                                                key={duration}
                                                style={[
                                                    styles.durationOption,
                                                    selectedDuration === duration && styles.durationOptionSelected,
                                                ]}
                                                onPress={() => setSelectedDuration(duration)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.durationText,
                                                        selectedDuration === duration && styles.durationTextSelected,
                                                    ]}
                                                >
                                                    {duration < 60 ? `${duration} min` : `${duration / 60} hr`}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </BlurView>
                            </MotiView>
                        )}

                        {/* Bottom Panel */}
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                            style={styles.bottomPanel}
                        >
                            <BlurView intensity={80} tint="dark" style={styles.bottomPanelContent}>
                                {/* Place Types Filter */}
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.placeTypesScroll}
                                >
                                    <TouchableOpacity
                                        style={[
                                            styles.placeTypeChip,
                                            !selectedPlaceType && styles.placeTypeChipSelected,
                                        ]}
                                        onPress={() => {
                                            setSelectedPlaceType(null);
                                            if (location) {
                                                fetchNearbyPlaces(location.coords.latitude, location.coords.longitude);
                                            }
                                        }}
                                    >
                                        <Ionicons name="apps" size={16} color="#fff" />
                                        <Text style={styles.placeTypeChipText}>All</Text>
                                    </TouchableOpacity>

                                    {NEARBY_PLACE_TYPES.map((type) => (
                                        <TouchableOpacity
                                            key={type.types}
                                            style={[
                                                styles.placeTypeChip,
                                                selectedPlaceType === type.types && styles.placeTypeChipSelected,
                                            ]}
                                            onPress={() => {
                                                setSelectedPlaceType(type.types);
                                                if (location) {
                                                    fetchNearbyPlaces(
                                                        location.coords.latitude,
                                                        location.coords.longitude,
                                                        type.types
                                                    );
                                                }
                                            }}
                                        >
                                            <Ionicons name={type.icon as any} size={16} color="#fff" />
                                            <Text style={styles.placeTypeChipText}>{type.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                {/* Nearby Places */}
                                {loadingNearby ? (
                                    <View style={styles.nearbyLoading}>
                                        <ActivityIndicator size="small" color="#fff" />
                                        <Text style={styles.nearbyLoadingText}>Finding nearby places...</Text>
                                    </View>
                                ) : (
                                    <FlatList
                                        data={nearbyPlaces}
                                        keyExtractor={(item) => item.id}
                                        showsVerticalScrollIndicator={false}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={styles.nearbyPlace}
                                                onPress={() => handlePlaceSelect(item)}
                                            >
                                                <View style={styles.placeIcon}>
                                                    <Ionicons name="location-outline" size={24} color="#007AFF" />
                                                </View>
                                                <View style={styles.placeInfo}>
                                                    <Text style={styles.placeName} numberOfLines={1}>
                                                        {item.name}
                                                    </Text>
                                                    <Text style={styles.placeAddress} numberOfLines={1}>
                                                        {item.address}
                                                    </Text>
                                                </View>
                                                {item.distance && (
                                                    <Text style={styles.placeDistance}>{item.distance}</Text>
                                                )}
                                            </TouchableOpacity>
                                        )}
                                        ListEmptyComponent={
                                            <View style={styles.emptyContainer}>
                                                <Ionicons name="map-outline" size={48} color="rgba(255,255,255,0.3)" />
                                                <Text style={styles.emptyText}>No places found nearby</Text>
                                            </View>
                                        }
                                    />
                                )}
                            </BlurView>
                        </KeyboardAvoidingView>
                    </View>
                )}
            </SafeAreaView>
        </Modal>
    );
};

interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: '#1c1c1e',
        zIndex: 10,
    },
    closeButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    shareButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#007AFF',
        borderRadius: 20,
    },
    shareButtonDisabled: {
        backgroundColor: '#1c1c1e',
    },
    shareButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    shareButtonTextDisabled: {
        color: '#8E8E93',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#000',
        zIndex: 20,
    },
    searchIcon: {
        marginRight: 8,
    },
    autocompleteContainer: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    searchInput: {
        height: 44,
        backgroundColor: '#1c1c1e',
        borderRadius: 22,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#fff',
    },
    searchResults: {
        backgroundColor: '#1c1c1e',
        borderRadius: 12,
        marginTop: 8,
        overflow: 'hidden',
    },
    searchResultRow: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2c2c2e',
    },
    searchSeparator: {
        height: 0,
    },
    searchDescription: {
        color: '#fff',
        fontSize: 14,
    },
    currentLocationButton: {
        marginLeft: 8,
        padding: 10,
        backgroundColor: '#1c1c1e',
        borderRadius: 22,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#8E8E93',
        fontSize: 16,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    permissionIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#1c1c1e',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    permissionTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    permissionText: {
        fontSize: 16,
        color: '#8E8E93',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    permissionOptions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    permissionButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    allowOnceButton: {
        backgroundColor: '#1c1c1e',
    },
    allowAlwaysButton: {
        backgroundColor: '#007AFF',
    },
    allowOnceText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    allowAlwaysText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    notNowButton: {
        paddingVertical: 12,
    },
    notNowText: {
        color: '#8E8E93',
        fontSize: 16,
    },
    contentContainer: {
        flex: 1,
        position: 'relative',
    },
    map: {
        width: width,
        height: height,
    },
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseRing: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,122,255,0.3)',
    },
    markerBubble: {
        backgroundColor: '#fff',
        padding: 8,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        borderWidth: 2,
        borderColor: '#007AFF',
    },
    markerArrow: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#007AFF',
        marginTop: -1,
    },
    fallbackContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#1c1c1e',
    },
    fallbackText: {
        color: '#8E8E93',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 14,
    },
    liveToggle: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 30,
    },
    liveToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        gap: 8,
        overflow: 'hidden',
    },
    liveToggleText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    liveToggleActive: {
        color: '#FF3B30',
    },
    liveOptions: {
        position: 'absolute',
        top: 80,
        right: 16,
        left: 16,
        zIndex: 25,
    },
    liveOptionsContent: {
        padding: 16,
        borderRadius: 16,
        overflow: 'hidden',
    },
    liveOptionsTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 12,
        opacity: 0.8,
    },
    durationOption: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        marginRight: 8,
    },
    durationOptionSelected: {
        backgroundColor: '#007AFF',
    },
    durationText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    durationTextSelected: {
        color: '#fff',
    },
    bottomPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: height * 0.4,
    },
    bottomPanelContent: {
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    placeTypesScroll: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    placeTypeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        gap: 6,
    },
    placeTypeChipSelected: {
        backgroundColor: '#007AFF',
    },
    placeTypeChipText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    nearbyLoading: {
        padding: 32,
        alignItems: 'center',
    },
    nearbyLoadingText: {
        color: '#8E8E93',
        marginTop: 12,
        fontSize: 14,
    },
    nearbyPlace: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    placeIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,122,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    placeInfo: {
        flex: 1,
    },
    placeName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
    },
    placeAddress: {
        color: '#8E8E93',
        fontSize: 14,
    },
    placeDistance: {
        color: '#8E8E93',
        fontSize: 14,
        marginLeft: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        color: '#8E8E93',
        fontSize: 14,
        marginTop: 12,
    },
});

export default ShareLocation;