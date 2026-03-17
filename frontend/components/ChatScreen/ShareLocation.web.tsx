import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StatusBar,
    FlatList,
    Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

// Types
export interface LocationData {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
    isLive?: boolean;
    liveDuration?: number;
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
}

// Constants
// Constants - Must be static and outside component to avoid re-load warnings
const GOOGLE_MAPS_LIBRARIES: any = ["places"];
const LIVE_DURATIONS = [15, 30, 60, 120, 480] as const;
const NEARBY_PLACE_TYPES = [
    { icon: 'cafe-outline', types: 'cafe', name: 'Coffee' },
    { icon: 'restaurant-outline', types: 'restaurant', name: 'Food' },
    { icon: 'bag-handle-outline', types: 'shopping_mall|store', name: 'Shops' },
    { icon: 'leaf-outline', types: 'park', name: 'Parks' },
    { icon: 'car-sport-outline', types: 'gas_station', name: 'Gas' },
] as const;

const containerStyle = {
    width: '100%',
    height: '100%'
};

// Memoized components for better performance
const PlaceTypeChip = memo(({
    icon,
    name,
    selected,
    onPress
}: {
    icon: keyof typeof Ionicons.glyphMap;
    name: string;
    selected: boolean;
    onPress: () => void;
}) => (
    <TouchableOpacity
        style={[styles.placeTypeChip, selected && styles.placeTypeChipSelected]}
        onPress={onPress}
    >
        <Ionicons name={icon} size={16} color="#fff" />
        <Text style={styles.placeTypeChipText}>{name}</Text>
    </TouchableOpacity>
));

const NearbyPlaceItem = memo(({
    item,
    onPress
}: {
    item: Place;
    onPress: (item: Place) => void;
}) => (
    <TouchableOpacity
        style={styles.nearbyPlace}
        onPress={() => onPress(item)}
    >
        <View style={styles.placeIcon}>
            <Ionicons name="location-outline" size={24} color="#007AFF" />
        </View>
        <View style={styles.placeInfo}>
            <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.placeAddress} numberOfLines={1}>{item.address}</Text>
        </View>
    </TouchableOpacity>
));

const darkMapStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#242424" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242424" }] },
    { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3c" }] },
    { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
    { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
    { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#2f3948" }] },
    { "featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
    { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];

// Create a wrapper for GooglePlacesAutocomplete to avoid initialization issues
const SearchBox = memo(({
    onPlaceSelected,
    apiKey,
    onFocus,
    onBlur
}: {
    onPlaceSelected: (place: any) => void;
    apiKey: string;
    onFocus: () => void;
    onBlur: () => void;
}) => {
    const [query, setQuery] = useState('');
    const [predictions, setPredictions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const autocompleteService = useRef<any>(null);
    const sessionToken = useRef<any>(null);

    useEffect(() => {
        // We use OpenStreetMap Nominatim for search instead of Google to avoid Legacy API issues.
    }, []);

    const searchPlaces = useCallback(async (text: string) => {
        if (!text.trim()) {
            setPredictions([]);
            return;
        }

        setLoading(true);
        setApiError(null);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5&addressdetails=1`
            );
            
            if (!response.ok) throw new Error('Search failed');
            const data = await response.json();
            
            const results = data.map((item: any) => ({
                place_id: item.place_id.toString(),
                description: item.display_name,
                structured_formatting: {
                    main_text: item.name || item.display_name.split(',')[0],
                    secondary_text: item.display_name.split(',').slice(1).join(',').trim()
                },
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon)
            }));

            setPredictions(results);
        } catch (error) {
            console.error('OSM Search error:', error);
            setApiError('Search service unavailable');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSelect = useCallback(async (prediction: any) => {
        // Map to structure expected by parent handlePlaceSelect
        onPlaceSelected({
            geometry: {
                location: {
                    lat: () => prediction.lat,
                    lng: () => prediction.lng
                }
            },
            name: prediction.structured_formatting.main_text,
            address: prediction.description
        });
        setQuery(prediction.structured_formatting.main_text);
        setShowResults(false);

        if (Platform.OS === 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [onPlaceSelected]);

    return (
        <View style={{ flex: 1, position: 'relative' }}>
            <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        searchPlaces(e.target.value);
                        setShowResults(true);
                    }}
                    onFocus={() => {
                        onFocus();
                        setShowResults(true);
                    }}
                    onBlur={() => {
                        setTimeout(() => {
                            setShowResults(false);
                            onBlur();
                        }, 200);
                    }}
                    placeholder="Search location..."
                    style={{
                        flex: 1,
                        height: 48,
                        backgroundColor: '#1c1c1e',
                        border: 'none',
                        borderRadius: 24,
                        paddingLeft: 44,
                        paddingRight: 24,
                        fontSize: 18,
                        color: '#fff',
                        outline: 'none',
                        width: '100%',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}
                />
            </View>

            {showResults && (predictions.length > 0 || apiError) && (
                <View style={styles.searchResults}>
                    {loading && (
                        <View style={styles.searchResultRow}>
                            <ActivityIndicator size="small" color="#007AFF" />
                        </View>
                    )}
                    {apiError ? (
                        <View style={styles.searchResultRow}>
                            <Ionicons name="warning-outline" size={18} color="#FF3B30" style={{ marginRight: 8 }} />
                            <Text style={[styles.searchDescription, { color: '#FF3B30' }]}>
                                {apiError}
                            </Text>
                        </View>
                    ) : (
                        predictions.map((prediction) => (
                            <TouchableOpacity
                                key={prediction.place_id}
                                style={styles.searchResultRow}
                                onPress={() => handleSelect(prediction)}
                            >
                                <Ionicons name="location-outline" size={18} color="#8E8E93" style={{ marginRight: 8 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.searchDescription, { fontWeight: '600', color: '#fff' }]}>
                                        {prediction.structured_formatting.main_text}
                                    </Text>
                                    <Text style={[styles.searchDescription, { fontSize: 13, color: '#8E8E93', marginTop: 2 }]} numberOfLines={1}>
                                        {prediction.structured_formatting.secondary_text}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            )}
        </View>
    );
});

const ShareLocation: React.FC<ShareLocationProps> = ({
    visible,
    onClose,
    onShareLocation,
    onShareLiveLocation,
    googlePlacesApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
}) => {
    const insets = useSafeAreaInsets();
    const [selectedPos, setSelectedPos] = useState({ lat: 37.78825, lng: -122.4324 });
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
    const [loadingNearby, setLoadingNearby] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const [showLiveOptions, setShowLiveOptions] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState<number>(30);
    const [selectedPlaceType, setSelectedPlaceType] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [apiError, setApiError] = useState<string | null>(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: googlePlacesApiKey,
        libraries: GOOGLE_MAPS_LIBRARIES,
        version: 'weekly',
    });

    const fetchNearbyPlaces = useCallback(async (lat: number, lng: number, type?: string) => {
        setLoadingNearby(true);
        setApiError(null);
        
        try {
            // First try Google Places - but only if it's likely searching for specific categories
            // If the user hasn't enabled the legacy API, we'll quickly failover to OSM.
            if (window.google && googlePlacesApiKey) {
                const service = new window.google.maps.places.PlacesService(document.createElement('div'));
                
                const request: any = {
                    location: new window.google.maps.LatLng(lat, lng),
                    radius: 1500,
                };

                if (type) {
                    if (type.includes('|')) {
                        request.keyword = type;
                    } else {
                        request.type = type;
                    }
                } else {
                    request.keyword = 'point of interest';
                }

                service.nearbySearch(request, (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                        const places: Place[] = results.slice(0, 10).map((place: any) => ({
                            id: place.place_id,
                            name: place.name,
                            address: place.vicinity,
                            latitude: place.geometry.location.lat(),
                            longitude: place.geometry.location.lng(),
                        }));
                        setNearbyPlaces(places);
                        setLoadingNearby(false);
                    } else {
                        // Failover to OSM if Google fails or is denied
                        fetchOSMNearby(lat, lng, type);
                    }
                });
            } else {
                fetchOSMNearby(lat, lng, type);
            }
        } catch (error) {
            fetchOSMNearby(lat, lng, type);
        }
    }, [googlePlacesApiKey]);

    const fetchOSMNearby = async (lat: number, lng: number, type?: string) => {
        try {
            // Use Nominatim search with bounded BOX/viewbox for nearby effect
            // Nominatim doesn't support '|' and needs broader terms for 'All'
            let query = type || 'point of interest';
            if (type && type.includes('|')) {
                if (type === 'shopping_mall|store') query = 'shop';
                else query = type.split('|')[0];
            }
            if (!type) query = 'amenity,shop,tourism,point of interest';

            const v = 0.01; // approx ~1km
            const viewbox = `${lng-v},${lat-v},${lng+v},${lat+v}`;
            
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
            }));
            
            setNearbyPlaces(places);
        } catch (error) {
            console.error('OSM Nearby error:', error);
        } finally {
            setLoadingNearby(false);
        }
    };

    const onMapLoad = useCallback((map: google.maps.Map) => {
        setMap(map);
        setIsLoading(false);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setSelectedPos(pos);
                    map.panTo(pos);
                    fetchNearbyPlaces(pos.lat, pos.lng);
                },
                () => {
                    // Default to SF if geolocation fails
                    fetchNearbyPlaces(37.78825, -122.4324);
                }
            );
        }
    }, [fetchNearbyPlaces]);

    const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const pos = {
                lat: e.latLng.lat(),
                lng: e.latLng.lng()
            };
            setSelectedPos(pos);
            fetchNearbyPlaces(pos.lat, pos.lng);

            if (Platform.OS === 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        }
    }, [fetchNearbyPlaces]);

    const handlePlaceSelect = useCallback((place: any) => {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const pos = { lat, lng };

        setSelectedPos(pos);
        if (map) {
            map.panTo(pos);
            map.setZoom(16);
        }
        fetchNearbyPlaces(pos.lat, pos.lng);
    }, [map, fetchNearbyPlaces]);

    const handleShare = useCallback(() => {
        onShareLocation({
            latitude: selectedPos.lat,
            longitude: selectedPos.lng,
            name: 'Selected Location',
            isLive: false,
        });
        onClose();
    }, [selectedPos, onShareLocation, onClose]);

    const handleShareLive = useCallback(() => {
        if (onShareLiveLocation) {
            onShareLiveLocation({
                latitude: selectedPos.lat,
                longitude: selectedPos.lng,
                isLive: true,
                liveDuration: selectedDuration,
            }, selectedDuration);
            onClose();
        }
    }, [selectedPos, selectedDuration, onShareLiveLocation, onClose]);

    const handleCurrentLocation = useCallback(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                setSelectedPos(pos);
                if (map) map.panTo(pos);
                fetchNearbyPlaces(pos.lat, pos.lng);
            });
        }
    }, [map, fetchNearbyPlaces]);

    const renderContent = () => {
        if (!isLoaded) {
            return (
                <View style={styles.loading}>
                    <MotiView
                        from={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring' }}
                    >
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.loadingText}>Loading Maps...</Text>
                    </MotiView>
                </View>
            );
        }

        return (
            <View style={styles.mapContainer}>
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={selectedPos}
                    zoom={15}
                    onLoad={onMapLoad}
                    onClick={onMapClick}
                    options={{
                        disableDefaultUI: true,
                        zoomControl: true,
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: false,
                        styles: darkMapStyle,
                    }}
                >
                    <MarkerF position={selectedPos} />
                </GoogleMap>

                {/* Animated live toggle */}
                <MotiView
                    from={{ opacity: 0, translateY: -10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 300 }}
                    style={styles.liveToggle}
                >
                    <TouchableOpacity
                        onPress={() => {
                            setShowLiveOptions(!showLiveOptions);
                            if (Platform.OS === 'web') {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                        }}
                    >
                        <BlurView intensity={80} tint="dark" style={styles.liveToggleContent}>
                            <View style={[styles.liveIndicator, { backgroundColor: '#FF3B30' }]} />
                            <Text style={styles.liveToggleText}>Live</Text>
                        </BlurView>
                    </TouchableOpacity>
                </MotiView>

                {/* Live options panel */}
                {showLiveOptions && (
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        exit={{ opacity: 0, translateY: 20 }}
                        style={styles.liveOptions}
                    >
                        <BlurView intensity={90} tint="dark" style={styles.liveOptionsContent}>
                            <Text style={styles.liveOptionsTitle}>Share live for:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {LIVE_DURATIONS.map((dur) => (
                                    <TouchableOpacity
                                        key={dur}
                                        style={[
                                            styles.durationOption,
                                            selectedDuration === dur && styles.durationOptionSelected
                                        ]}
                                        onPress={() => setSelectedDuration(dur)}
                                    >
                                        <Text style={styles.durationText}>
                                            {dur >= 60 ? `${dur / 60}h` : `${dur}m`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <TouchableOpacity
                                style={styles.startLiveButton}
                                onPress={handleShareLive}
                            >
                                <Text style={styles.startLiveText}>Start Sharing</Text>
                            </TouchableOpacity>
                        </BlurView>
                    </MotiView>
                )}

                {/* Bottom panel */}
                <MotiView
                    from={{ opacity: 0, translateY: 100 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', delay: 200 }}
                    style={styles.bottomPanel}
                >
                    <BlurView intensity={80} tint="dark" style={styles.bottomPanelContent}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.placeTypesScroll}
                        >
                            <PlaceTypeChip
                                icon="apps"
                                name="All"
                                selected={!selectedPlaceType}
                                onPress={() => {
                                    setSelectedPlaceType(null);
                                    fetchNearbyPlaces(selectedPos.lat, selectedPos.lng);
                                }}
                            />
                            {NEARBY_PLACE_TYPES.map((type) => (
                                <PlaceTypeChip
                                    key={type.types}
                                    icon={type.icon}
                                    name={type.name}
                                    selected={selectedPlaceType === type.types}
                                    onPress={() => {
                                        setSelectedPlaceType(type.types);
                                        fetchNearbyPlaces(selectedPos.lat, selectedPos.lng, type.types);
                                    }}
                                />
                            ))}
                        </ScrollView>

                        {apiError ? (
                            <View style={styles.nearbyLoading}>
                                <Ionicons name="warning-outline" size={24} color="#FF3B30" />
                                <Text style={[styles.loadingText, { color: '#FF3B30', textAlign: 'center', marginTop: 8 }]}>
                                    Places API (Legacy) not enabled.{"\n"}
                                    Please enable it in Google Cloud Console.
                                </Text>
                            </View>
                        ) : loadingNearby ? (
                            <View style={styles.nearbyLoading}>
                                <ActivityIndicator size="small" color="#007AFF" />
                            </View>
                        ) : (
                            <FlatList
                                data={nearbyPlaces}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <NearbyPlaceItem
                                        item={item}
                                        onPress={(place) => {
                                            setSelectedPos({ lat: place.latitude, lng: place.longitude });
                                            if (map) map.panTo({ lat: place.latitude, lng: place.longitude });
                                        }}
                                    />
                                )}
                                ListEmptyComponent={() => (
                                    <View style={styles.nearbyLoading}>
                                        <Text style={styles.loadingText}>No places found nearby</Text>
                                    </View>
                                )}
                                maxToRenderPerBatch={5}
                                windowSize={3}
                                removeClippedSubviews={true}
                            />
                        )}
                    </BlurView>
                </MotiView>
            </View>
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
                <MotiView
                    from={{ opacity: 0, translateY: -20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 16 }]}
                >
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Share Location</Text>
                    <TouchableOpacity
                        onPress={handleShare}
                        style={styles.shareButton}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.shareButtonText}>Share</Text>
                    </TouchableOpacity>
                </MotiView>

                {/* Search Header */}
                <View style={styles.searchHeader}>
                    <SearchBox
                        onPlaceSelected={handlePlaceSelect}
                        apiKey={googlePlacesApiKey}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                    />
                    <TouchableOpacity
                        onPress={handleCurrentLocation}
                        style={styles.currentLocationButton}
                    >
                        <Ionicons name="locate" size={24} color="#007AFF" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {renderContent()}
                </View>
            </SafeAreaView>
        </Modal>
    );
};

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
        zIndex: 100,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    closeButton: {
        padding: 4,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    shareButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#000',
        zIndex: 101,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    searchIcon: {
        position: 'absolute',
        left: 12,
        zIndex: 1,
    },
    searchResults: {
        position: 'absolute',
        top: 44,
        left: 0,
        right: 0,
        backgroundColor: '#1c1c1e',
        borderRadius: 12,
        marginTop: 4,
        maxHeight: 300,
        overflow: 'scroll',
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    searchResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    searchDescription: {
        color: '#fff',
        fontSize: 14,
        flex: 1,
    },
    currentLocationButton: {
        marginLeft: 12,
        backgroundColor: '#1c1c1e',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    liveToggle: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 50,
    },
    liveToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        overflow: 'hidden',
    },
    liveIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    liveToggleText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    liveOptions: {
        position: 'absolute',
        top: 70,
        right: 16,
        left: 16,
        zIndex: 60,
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
    },
    startLiveButton: {
        marginTop: 16,
        backgroundColor: '#FF3B30',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    startLiveText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    bottomPanel: {
        position: 'absolute',
        top: '50%',
        bottom: 24,
        left: 24,
        width: '45%',
        maxWidth: 560,
        borderRadius: 24,
        overflow: 'hidden',
        zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    bottomPanelContent: {
        paddingVertical: 12,
        flex: 1,
        paddingHorizontal: 16,
    },
    placeTypesScroll: {
        flexDirection: 'row',
        marginBottom: 16,
        flexGrow: 0,
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
        fontSize: 13,
        fontWeight: '500',
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
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 2,
    },
    placeAddress: {
        color: '#8E8E93',
        fontSize: 13,
    },
    nearbyLoading: {
        padding: 20,
        alignItems: 'center',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1c1c1e',
    },
    loadingText: {
        color: '#8E8E93',
        marginTop: 12,
        fontSize: 15,
    },
});

export default ShareLocation;