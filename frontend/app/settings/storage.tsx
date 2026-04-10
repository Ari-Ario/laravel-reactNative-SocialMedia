// app/(settings)/StorageSettingsScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    StatusBar,
    ActivityIndicator,
    Dimensions,
    Animated,
    Platform,
    Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createShadow } from '@/utils/styles';
import * as Haptics from 'expo-haptics';
import { fetchFullSettings, updatePreferences } from '@/services/SettingService';
import OfflineService from '@/services/ChatScreen/OfflineServiceChat';
import axios from '@/services/axios';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';
import GlobalStyles from '@/styles/GlobalStyles';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

interface StorageOptionProps {
    label: string;
    value: string;
    onPress: () => void;
    isSelected: boolean;
    icon: string;
    description?: string;
    color?: string;
}

const StorageOption = ({
    label,
    value,
    onPress,
    isSelected,
    icon,
    description,
    color = "#1063FD"
}: StorageOptionProps) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [isHovered, setIsHovered] = useState(false);

    const handlePress = () => {
        Animated.sequence([
            Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, friction: 5 }),
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }),
        ]).start();

        if (!isWeb) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        onPress();
    };

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={handlePress}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <LinearGradient
                    colors={isSelected ? [color + '10', color + '05'] : isHovered ? ['#f8f9fa', '#fff'] : ['#fff', '#fff']}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <View style={styles.optionInfo}>
                        <View style={[styles.optionIconContainer, { backgroundColor: color + '15' }]}>
                            <Ionicons name={icon as any} size={20} color={color} />
                        </View>
                        <View style={styles.optionTextContainer}>
                            <Text style={[styles.optionLabel, isSelected && { color }]}>{label}</Text>
                            {description && (
                                <Text style={styles.optionDescription}>{description}</Text>
                            )}
                        </View>
                    </View>
                    <View style={[styles.radioCircle, isSelected && { borderColor: color, backgroundColor: color }]}>
                        {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function StorageSettingsScreen() {
    const insets = useSafeAreaInsets();
    const scrollY = useRef(new Animated.Value(0)).current;

    const [mediaQuality, setMediaQuality] = useState('standard');
    const [autoClear, setAutoClear] = useState('never');
    const [cacheSize, setCacheSize] = useState('—');
    const [clearing, setClearing] = useState(false);
    const [downloadQuality, setDownloadQuality] = useState('auto');
    const [wifiOnly, setWifiOnly] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStorageSettings();
    }, []);

    const loadStorageSettings = async () => {
        try {
            setLoading(true);
            const data = await fetchFullSettings();
            const prefs = data.preferences || {};
            // Mapping to collaboration_styles as a persistent JSON bucket for these interface prefs
            const storagePrefs = prefs.collaboration_styles || {};
            
            if (storagePrefs.media_quality) setMediaQuality(storagePrefs.media_quality);
            if (storagePrefs.auto_clear) setAutoClear(storagePrefs.auto_clear);
            if (storagePrefs.download_quality) setDownloadQuality(storagePrefs.download_quality);
            if (storagePrefs.wifi_only !== undefined) setWifiOnly(!!storagePrefs.wifi_only);
            // Compute real cache size from localStorage on web
            if (Platform.OS === 'web') {
                try {
                    let total = 0;
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i) || '';
                        const val = localStorage.getItem(key) || '';
                        total += (key.length + val.length) * 2;
                    }
                    const mb = (total / 1024 / 1024).toFixed(2);
                    setCacheSize(`${mb} MB`);
                } catch { setCacheSize('< 1 MB'); }
            } else {
                setCacheSize('Varies by device');
            }
        } catch (error) {
            console.error('Failed to load storage settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStoragePref = async (key: string, value: any) => {
        try {
            const data = await fetchFullSettings();
            const currentStyles = data.preferences?.collaboration_styles || {};
            const updatedStyles = { ...currentStyles, [key]: value };
            await updatePreferences({ collaboration_styles: updatedStyles });
            if (!isWeb) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to save storage preference.');
        }
    };

    const handleClearCache = () => {
        const confirmClear = async () => {
            try {
                setClearing(true);
                
                // 1. Clear Offline Service Cache (AsyncStorage)
                await OfflineService.getInstance().clearCache();
                
                // 2. Clear Web LocalStorage if applicable, but preserve the token!
                if (Platform.OS === 'web') {
                    const token = localStorage.getItem('token');
                    localStorage.clear();
                    if (token) localStorage.setItem('token', token);
                }

                // Simulate brief delay for UX if it's too fast
                setTimeout(() => {
                    setCacheSize('0.0 MB');
                    setClearing(false);
                    if (!isWeb) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                    Alert.alert('Success', 'Local cache cleared successfully.');
                }, 800);
            } catch (error) {
                setClearing(false);
                Alert.alert('Error', 'Failed to clear some local data.');
            }
        };

        if (isWeb) {
            if (window.confirm('Clear all cached data? This will free up space without deleting your account data.')) {
                confirmClear();
            }
        } else {
            Alert.alert(
                'Clear Cache',
                'This will remove temporary files and free up storage space.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: confirmClear }
                ]
            );
        }
    };

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0.95],
        extrapolate: 'clamp',
    });

    return (
        <View style={[styles.container, GlobalStyles.popupContainer]}>
            <StatusBar barStyle="dark-content" />

            <LinearGradient
                colors={['#fff', '#f8f9fa']}
                style={[styles.header, { paddingTop: insets.top + 10 }]}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Storage Manager</Text>
                    <Animated.View style={[styles.headerUnderline, { opacity: headerOpacity }]} />
                </View>

                <View style={{ width: 44 }} />
            </LinearGradient>

            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#1063FD" />
                    <Text style={styles.loaderText}>Analyzing storage...</Text>
                </View>
            ) : (
                <Animated.ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                        { useNativeDriver: false }
                    )}
                    scrollEventThrottle={16}
                >
                    <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }}>
                        {/* Storage Overview Card */}
                        <LinearGradient
                            colors={['#1063FD', '#0050CC']}
                            style={styles.storageOverview}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.storageTitle}>Account Storage</Text>
                            <Text style={styles.storageSize}>45.2 GB</Text>
                            <Text style={styles.storageSubtext}>of 128 GB used</Text>
                            <View style={styles.storageBar}>
                                <View style={[styles.storageBarFill, { width: '35%' }]} />
                            </View>
                            <View style={styles.storageStats}>
                                <View style={styles.storageStat}>
                                    <View style={[styles.storageDot, { backgroundColor: '#4CAF50' }]} />
                                    <Text style={styles.storageStatText}>Media: 32.4 GB</Text>
                                </View>
                                <View style={styles.storageStat}>
                                    <View style={[styles.storageDot, { backgroundColor: '#FF9800' }]} />
                                    <Text style={styles.storageStatText}>Other: 12.8 GB</Text>
                                </View>
                            </View>
                        </LinearGradient>

                        {/* Media Quality Section */}
                        <Text style={styles.sectionTitle}>Media Quality</Text>
                        <StorageOption
                            label="Standard"
                            value="standard"
                            isSelected={mediaQuality === 'standard'}
                            onPress={() => { setMediaQuality('standard'); updateStoragePref('media_quality', 'standard'); }}
                            icon="image-outline"
                            description="Uses less data, faster loading"
                            color="#4CAF50"
                        />
                        <StorageOption
                            label="High Definition (HD)"
                            value="hd"
                            isSelected={mediaQuality === 'hd'}
                            onPress={() => { setMediaQuality('hd'); updateStoragePref('media_quality', 'hd'); }}
                            icon="sparkles-outline"
                            description="Crisp quality, balanced data"
                            color="#FF9800"
                        />
                        <StorageOption
                            label="Full Original"
                            value="original"
                            isSelected={mediaQuality === 'original'}
                            onPress={() => { setMediaQuality('original'); updateStoragePref('media_quality', 'original'); }}
                            icon="star-outline"
                            description="Highest possible resolution"
                            color="#1063FD"
                        />

                        {/* Cache Management */}
                        <Text style={styles.sectionTitle}>Cache Management</Text>
                        <View style={styles.cacheCard}>
                            <View style={styles.cacheInfoRow}>
                                <View>
                                    <Text style={styles.cacheLabel}>Local Cache</Text>
                                    <Text style={styles.cacheValue}>{cacheSize}</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.clearButton, (clearing || cacheSize === '0.0 MB') && styles.clearButtonDisabled]}
                                    onPress={handleClearCache}
                                    disabled={clearing || cacheSize === '0.0 MB'}
                                >
                                    <LinearGradient
                                        colors={clearing ? ['#ccc', '#ccc'] : ['#FF3B30', '#CC2F26']}
                                        style={styles.clearButtonGradient}
                                    >
                                        {clearing ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <Ionicons name="trash-outline" size={16} color="#fff" />
                                                <Text style={styles.clearButtonText}>Clear</Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Auto-Cleanup Section */}
                        <Text style={styles.sectionTitle}>Auto-Cleanup</Text>
                        <StorageOption
                            label="Weekly"
                            value="weekly"
                            isSelected={autoClear === 'weekly'}
                            onPress={() => { setAutoClear('weekly'); updateStoragePref('auto_clear', 'weekly'); }}
                            icon="repeat-outline"
                            color="#34C759"
                            description="Every 7 days automatically"
                        />
                        <StorageOption
                            label="Monthly"
                            value="monthly"
                            isSelected={autoClear === 'monthly'}
                            onPress={() => { setAutoClear('monthly'); updateStoragePref('auto_clear', 'monthly'); }}
                            icon="calendar-outline"
                            color="#9C27B0"
                            description="Once per month automatically"
                        />
                        <StorageOption
                            label="Never"
                            value="never"
                            isSelected={autoClear === 'never'}
                            onPress={() => { setAutoClear('never'); updateStoragePref('auto_clear', 'never'); }}
                            icon="infinite-outline"
                            color="#666"
                            description="Manual clearing only"
                        />

                        {/* Download Preferences */}
                        <Text style={styles.sectionTitle}>Download Settings</Text>
                        <View style={styles.cacheCard}>
                            <View style={styles.cacheInfoRow}>
                                <View>
                                    <Text style={styles.cacheLabel}>Wi-Fi Only Downloads</Text>
                                    <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                                        Only auto-download media on Wi-Fi
                                    </Text>
                                </View>
                                <Switch
                                    value={wifiOnly}
                                    onValueChange={(val) => {
                                        setWifiOnly(val);
                                        updateStoragePref('wifi_only', val);
                                    }}
                                    trackColor={{ false: '#e5e5e5', true: '#1063FD80' }}
                                    thumbColor={wifiOnly ? '#1063FD' : '#fff'}
                                    ios_backgroundColor="#e5e5e5"
                                />
                            </View>
                        </View>
                    </MotiView>
                </Animated.ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerCenter: { alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
    headerUnderline: { width: 40, height: 3, backgroundColor: '#1063FD', borderRadius: 2, marginTop: 4 },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText: { marginTop: 12, color: '#666', fontSize: 14 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    storageOverview: { borderRadius: 24, padding: 20, marginTop: 10, marginBottom: 24, ...createShadow({ opacity: 0.15, radius: 12 }) },
    storageTitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    storageSize: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 2 },
    storageSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
    storageBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
    storageBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
    storageStats: { flexDirection: 'row', gap: 16 },
    storageStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    storageDot: { width: 8, height: 8, borderRadius: 4 },
    storageStatText: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
    sectionTitle: { fontSize: 13, fontWeight: '800', color: '#1063FD', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 24, marginBottom: 12, marginLeft: 5 },
    optionCard: { borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e5e5e5', ...createShadow({ opacity: 0.05, radius: 6 }) },
    optionCardSelected: { borderColor: '#1063FD', borderWidth: 2 },
    optionInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    optionIconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    optionTextContainer: { flex: 1 },
    optionLabel: { fontSize: 15, fontWeight: '700', color: '#000' },
    optionDescription: { fontSize: 11, color: '#666', marginTop: 2 },
    radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
    cacheCard: { borderRadius: 20, padding: 20, marginBottom: 10, borderWidth: 1, borderColor: '#e5e5e5', ...createShadow({ opacity: 0.05, radius: 8 }) },
    cacheInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cacheLabel: { fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase' },
    cacheValue: { fontSize: 28, fontWeight: '900', color: '#000', marginTop: 4 },
    clearButton: { borderRadius: 12, overflow: 'hidden' },
    clearButtonDisabled: { opacity: 0.6 },
    clearButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 6 },
    clearButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});