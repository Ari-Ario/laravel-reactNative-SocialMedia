// app/(settings)/LinkedDevicesScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Alert,
    Dimensions,
    Animated,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { fetchFullSettings, updateFullSettings } from '@/services/SettingService';
import GlobalStyles from '@/styles/GlobalStyles';
import { createShadow } from '@/utils/styles';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const relativeTime = (dateStr: string): string => {
    if (!dateStr || dateStr === 'Recently') return 'Recently';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const diffMs = Date.now() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    } catch {
        return dateStr;
    }
};

interface Device {
    id: string;
    name: string;
    location: string;
    lastSeen: string;
    isCurrent: boolean;
    ip: string;
    browser: string;
    os: string;
    token: string;
}

const DeviceCard = ({ device, index, onLogout }: { device: Device; index: number; onLogout: (token: string) => void }) => {
    const [isHovered, setIsHovered] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [showDetails, setShowDetails] = useState(false);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, friction: 5 }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
    };

    const getDeviceIcon = () => {
        const name = device.name.toLowerCase();
        const os = device.os.toLowerCase();
        if (os.includes('ios') || os.includes('android')) return 'phone-portrait';
        if (os.includes('macos')) return 'laptop';
        if (os.includes('windows')) return 'desktop';
        return 'tablet-portrait';
    };

    const getBrowserIcon = () => {
        const browser = device.browser.toLowerCase();
        if (browser.includes('chrome')) return 'logo-chrome';
        if (browser.includes('safari')) return 'logo-safari';
        if (browser.includes('firefox')) return 'logo-firefox';
        return 'globe-outline';
    };

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setShowDetails(!showDetails)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <LinearGradient
                    colors={device.isCurrent ? ['#1063FD', '#0050CC'] : isHovered ? ['#f8f9fa', '#fff'] : ['#fff', '#fff']}
                    style={[styles.deviceCard, device.isCurrent && styles.currentDevice]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.deviceRow}>
                        <View style={[styles.deviceIconContainer, device.isCurrent && styles.deviceIconCurrent]}>
                            <LinearGradient
                                colors={device.isCurrent ? ['#fff', '#f0f0f0'] : ['#1063FD', '#0050CC']}
                                style={styles.deviceIconGradient}
                            >
                                <Ionicons
                                    name={getDeviceIcon()}
                                    size={24}
                                    color={device.isCurrent ? '#1063FD' : '#fff'}
                                />
                            </LinearGradient>
                        </View>

                        <View style={styles.deviceInfo}>
                            <View style={styles.nameRow}>
                                <Text style={[styles.deviceName, device.isCurrent && styles.deviceNameCurrent]}>
                                    {device.name}
                                </Text>
                                {device.isCurrent && (
                                    <View style={styles.currentBadge}>
                                        <Ionicons name="checkmark-circle" size={12} color="#fff" />
                                        <Text style={styles.currentBadgeText}>Current</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.deviceMetaRow}>
                                <View style={styles.metaItem}>
                                    <Ionicons name="location-outline" size={12} color={device.isCurrent ? 'rgba(255,255,255,0.7)' : '#666'} />
                                    <Text style={[styles.metaText, device.isCurrent && styles.metaTextLight]}>
                                        {device.location || 'Unknown Location'}
                                    </Text>
                                </View>
                                <View style={styles.metaDot} />
                                <View style={styles.metaItem}>
                                    <Ionicons name="time-outline" size={12} color={device.isCurrent ? 'rgba(255,255,255,0.7)' : '#666'} />
                                    <Text style={[styles.metaText, device.isCurrent && styles.metaTextLight]}>
                                        {device.lastSeen}
                                    </Text>
                                </View>
                            </View>

                            <AnimatePresence>
                                {showDetails && (
                                    <MotiView
                                        from={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        style={styles.deviceDetails}
                                    >
                                        <View style={styles.detailRow}>
                                            <Ionicons name="hardware-chip-outline" size={14} color={device.isCurrent ? 'rgba(255,255,255,0.6)' : '#666'} />
                                            <Text style={[styles.detailText, device.isCurrent && styles.metaTextLight]}>
                                                Type: {device.os}
                                            </Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Ionicons name={getBrowserIcon()} size={14} color={device.isCurrent ? 'rgba(255,255,255,0.6)' : '#666'} />
                                            <Text style={[styles.detailText, device.isCurrent && styles.metaTextLight]}>
                                                {device.browser || 'Native App'}
                                            </Text>
                                        </View>
                                    </MotiView>
                                )}
                            </AnimatePresence>
                        </View>

                        <Ionicons
                            name={showDetails ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={device.isCurrent ? 'rgba(255,255,255,0.6)' : '#999'}
                        />
                    </View>

                    {!device.isCurrent && (
                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={() => onLogout(device.token)}
                        >
                            <LinearGradient
                                colors={['#FF3B30', '#CC2F26']}
                                style={styles.logoutGradient}
                            >
                                <Ionicons name="log-out-outline" size={16} color="#fff" />
                                <Text style={styles.logoutText}>Log Out This Device</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function LinkedDevicesScreen() {
    const insets = useSafeAreaInsets();
    const scrollY = useRef(new Animated.Value(0)).current;
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDevices();
    }, []);

    const loadDevices = async () => {
        try {
            setLoading(true);
            const data = await fetchFullSettings();
            const rawTokens = data.user.device_tokens || [];

            // In a real app, the current device token would be compared
            // For now, we'll mark the most recently registered token as current if only one exists,
            // or use a placeholder logic.
            const mappedDevices = rawTokens.map((t: any, idx: number) => ({
                id: idx.toString(),
                name: t.name || 'Unknown Device',
                location: 'United States',
                lastSeen: relativeTime(t.last_registered_at),
                isCurrent: idx === 0,
                ip: 'Hidden for security',
                browser: t.type === 'web' ? 'Web Browser' : 'Mobile App',
                os: t.type === 'ios' ? 'iOS' : t.type === 'android' ? 'Android' : 'Web',
                token: t.token
            }));

            setDevices(mappedDevices);
        } catch (error) {
            console.error('Failed to load devices:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogoutDevice = async (token: string) => {
        const confirmAction = async () => {
            try {
                const updatedTokens = devices
                    .filter(d => d.token !== token)
                    .map(d => ({ token: d.token, type: d.os.toLowerCase(), name: d.name }));

                await updateFullSettings({ device_tokens: updatedTokens });
                setDevices(devices.filter(d => d.token !== token));

                if (!isWeb) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            } catch (error) {
                Alert.alert('Error', 'Failed to revoke device session.');
            }
        };

        if (isWeb) {
            if (window.confirm('Log out this device? It will be immediately disconnected.')) {
                confirmAction();
            }
        } else {
            Alert.alert(
                'Log Out Device',
                'This device will be immediately disconnected from your account.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Log Out', style: 'destructive', onPress: confirmAction }
                ]
            );
        }
    };

    const handleLogoutAllOthers = async () => {
        const confirmAction = async () => {
            try {
                const currentDevice = devices.find(d => d.isCurrent);
                const updatedTokens = currentDevice ? [{
                    token: currentDevice.token,
                    type: currentDevice.os.toLowerCase(),
                    name: currentDevice.name
                }] : [];

                await updateFullSettings({ device_tokens: updatedTokens });
                setDevices(devices.filter(d => d.isCurrent));

                if (!isWeb) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            } catch (error) {
                Alert.alert('Error', 'Failed to log out other devices.');
            }
        };

        if (isWeb) {
            if (window.confirm('Log out all other devices? This will disconnect all sessions except this one.')) {
                confirmAction();
            }
        } else {
            Alert.alert(
                'Log Out All Devices',
                'This will log you out of all other active sessions and devices.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Log Out All', style: 'destructive', onPress: confirmAction }
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
                    <Text style={styles.headerTitle}>Active Sessions</Text>
                    <Animated.View style={[styles.headerUnderline, { opacity: headerOpacity }]} />
                </View>

                <TouchableOpacity onPress={handleLogoutAllOthers} style={styles.logoutAllHeader}>
                    <Ionicons name="exit-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
            </LinearGradient>

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
                    {/* Security Banner */}
                    <LinearGradient
                        colors={['#34C75915', '#34C75908']}
                        style={styles.securityBanner}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.securityIcon}>
                            <Ionicons name="shield-checkmark" size={28} color="#34C759" />
                        </View>
                        <View style={styles.bannerText}>
                            <Text style={styles.bannerTitle}>Account Security</Text>
                            <Text style={styles.bannerDescription}>
                                Monitor all devices where your account is currently logged in.
                                If you see anything suspicious, revoke access immediately.
                            </Text>
                        </View>
                    </LinearGradient>

                    {loading ? (
                        <View style={styles.loaderContainer}>
                            <ActivityIndicator size="large" color="#1063FD" />
                            <Text style={styles.loaderText}>Scanning connected devices...</Text>
                        </View>
                    ) : (
                        <>
                            {/* Stats Cards */}
                            <View style={styles.statsContainer}>
                                <View style={styles.statCard}>
                                    <Text style={styles.statNumber}>{devices.length}</Text>
                                    <Text style={styles.statLabel}>Total Devices</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={styles.statNumber}>1</Text>
                                    <Text style={styles.statLabel}>This Device</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={styles.statNumber}>
                                        {devices.filter(d => !d.isCurrent).length}
                                    </Text>
                                    <Text style={styles.statLabel}>Others</Text>
                                </View>
                            </View>

                            {/* Devices List */}
                            <View style={styles.sectionTitleRow}>
                                <Ionicons name="hardware-chip" size={14} color="#1063FD" />
                                <Text style={styles.sectionTitle}>Authorized Devices</Text>
                            </View>

                            {devices.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="phone-portrait-outline" size={48} color="#ccc" />
                                    <Text style={styles.emptyText}>No other linked devices found.</Text>
                                </View>
                            ) : (
                                devices.map((device, index) => (
                                    <DeviceCard
                                        key={device.id}
                                        device={device}
                                        index={index}
                                        onLogout={handleLogoutDevice}
                                    />
                                ))
                            )}

                            {/* Logout All Button */}
                            {devices.filter(d => !d.isCurrent).length > 0 && (
                                <TouchableOpacity
                                    style={styles.logoutAllCard}
                                    onPress={handleLogoutAllOthers}
                                >
                                    <LinearGradient
                                        colors={['#FFF0F0', '#FFE5E5']}
                                        style={styles.logoutAllGradient}
                                    >
                                        <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
                                        <Text style={styles.logoutAllText}>Log Out All Other Sessions</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </>
                    )}

                    {/* Security Tips */}
                    <View style={styles.tipsSection}>
                        <Text style={styles.tipsTitle}>🔒 Security Tips</Text>
                        <View style={styles.tipItem}>
                            <View style={styles.tipIcon}>
                                <Ionicons name="key" size={14} color="#1063FD" />
                            </View>
                            <Text style={styles.tipText}>Change your password regularly</Text>
                        </View>
                        <View style={styles.tipItem}>
                            <View style={styles.tipIcon}>
                                <Ionicons name="shield-half" size={14} color="#1063FD" />
                            </View>
                            <Text style={styles.tipText}>Revoke access to devices you no longer use</Text>
                        </View>
                    </View>
                </MotiView>
            </Animated.ScrollView>
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
    logoutAllHeader: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    securityBanner: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, marginTop: 10, marginBottom: 20, borderWidth: 1, borderColor: '#34C759', ...createShadow({ opacity: 0.05, radius: 8 }) },
    securityIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#34C75920', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    bannerText: { flex: 1 },
    bannerTitle: { fontSize: 16, fontWeight: '800', color: '#1E4620' },
    bannerDescription: { fontSize: 12, color: '#1E4620', opacity: 0.7, marginTop: 2, lineHeight: 16 },
    loaderContainer: { paddingVertical: 50, alignItems: 'center' },
    loaderText: { marginTop: 12, color: '#666', fontSize: 14 },
    statsContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e5e5e5', ...createShadow({ opacity: 0.05, radius: 8 }) },
    statNumber: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
    statLabel: { fontSize: 11, color: '#666', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15, marginLeft: 5 },
    sectionTitle: { fontSize: 13, fontWeight: '800', color: '#1063FD', textTransform: 'uppercase', letterSpacing: 1.5 },
    deviceCard: { borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e5e5', ...createShadow({ opacity: 0.05, radius: 8 }) },
    currentDevice: { borderColor: '#1063FD', borderWidth: 2 },
    deviceRow: { flexDirection: 'row', alignItems: 'flex-start' },
    deviceIconContainer: { width: 48, height: 48, borderRadius: 16, overflow: 'hidden', marginRight: 15 },
    deviceIconCurrent: { backgroundColor: '#fff' },
    deviceIconGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    deviceInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    deviceName: { fontSize: 16, fontWeight: '700', color: '#000' },
    deviceNameCurrent: { color: '#1063FD' },
    currentBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1063FD', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 3 },
    currentBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    deviceMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: 11, color: '#666' },
    metaTextLight: { color: 'rgba(0,0,0,0.5)' },
    metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#ccc' },
    deviceDetails: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    detailText: { fontSize: 11, color: '#666' },
    logoutButton: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
    logoutGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
    logoutText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    logoutAllCard: { borderRadius: 16, overflow: 'hidden', marginTop: 20 },
    logoutAllGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
    logoutAllText: { color: '#FF3B30', fontSize: 15, fontWeight: '800' },
    tipsSection: { marginTop: 30, padding: 20, backgroundColor: '#F8F9FA', borderRadius: 20, borderWidth: 1, borderColor: '#e5e5e5' },
    tipsTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
    tipItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    tipIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    tipText: { fontSize: 13, color: '#666', flex: 1 },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { marginTop: 12, color: '#999', fontSize: 14 },
});