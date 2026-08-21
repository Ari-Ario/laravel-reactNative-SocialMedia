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
import { BackButton } from '@/components/ui/IconButton';
import { createShadow } from '@/utils/styles';
import * as Haptics from 'expo-haptics';
import { fetchFullSettings, updatePreferences } from '@/services/SettingService';
import OfflineService from '@/services/ChatScreen/OfflineServiceChat';
import axios from '@/services/axios';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';
import GlobalStyles from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';

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
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
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
            >
                <LinearGradient
                    colors={isSelected ? [color + '15', color + '05'] : [colors.surface, colors.surface]}
                    style={[styles.optionCard, isSelected && { borderColor: color, borderWidth: 2 }]}
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
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
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
                    setCacheSize(`${mb} MB`);
                } catch { setCacheSize(t('less_than_1mb')); }
            } else {
                setCacheSize(t('varies_by_device'));
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
            Alert.alert(t('error'), t('failed_update'));
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
                    Alert.alert(t('success'), t('save'));
                }, 800);
            } catch (error) {
                setClearing(false);
                Alert.alert(t('error'), t('failed_update'));
            }
        };

        if (isWeb) {
            if (window.confirm(t('clear_cache'))) {
                confirmClear();
            }
        } else {
            Alert.alert(
                t('clear_cache'),
                t('auto_clear_desc'),
                [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('clear_cache'), style: 'destructive', onPress: confirmClear }
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
                colors={[colors.surface, colors.background]}
                style={[styles.header, { paddingTop: insets.top + 10 }]}
            >
                <BackButton onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)"); }} />

                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{t('storage_data')}</Text>
                    <Animated.View style={[styles.headerUnderline, { opacity: headerOpacity }]} />
                </View>

                <View style={{ width: 44 }} />
            </LinearGradient>

            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={colors.tint} />
                    <Text style={styles.loaderText}>{t('loading')}</Text>
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
                        <LinearGradient
                            colors={['#1063FD', '#0050CC']}
                            style={styles.storageOverview}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.storageTitle}>{t('storage_usage')}</Text>
                            <Text style={styles.storageSize}>45.2 GB</Text>
                            <Text style={styles.storageSubtext}>{t('manage_storage_desc')}</Text>
                            <View style={styles.storageBar}>
                                <View style={[styles.storageBarFill, { width: '35%' }]} />
                            </View>
                            <View style={styles.storageStats}>
                                <View style={styles.storageStat}>
                                    <View style={[styles.storageDot, { backgroundColor: '#4CAF50' }]} />
                                    <Text style={styles.storageStatText}>{t('media')}: 32.4 GB</Text>
                                </View>
                                <View style={styles.storageStat}>
                                    <View style={[styles.storageDot, { backgroundColor: '#FF9800' }]} />
                                    <Text style={styles.storageStatText}>{t('common_other_label') || 'Other'}: 12.8 GB</Text>
                                </View>
                            </View>
                        </LinearGradient>

                        <Text style={styles.sectionTitle}>{t('media_quality')}</Text>
                        <StorageOption
                            label={t('standard_quality')}
                            value="standard"
                            isSelected={mediaQuality === 'standard'}
                            onPress={() => { setMediaQuality('standard'); updateStoragePref('media_quality', 'standard'); }}
                            icon="image-outline"
                            description={t('standard_quality_desc')}
                            color="#4CAF50"
                        />
                        <StorageOption
                            label={t('hd_quality')}
                            value="hd"
                            isSelected={mediaQuality === 'hd'}
                            onPress={() => { setMediaQuality('hd'); updateStoragePref('media_quality', 'hd'); }}
                            icon="sparkles-outline"
                            description={t('hd_quality_desc')}
                            color="#FF9800"
                        />
                        <StorageOption
                            label={t('original_quality')}
                            value="original"
                            isSelected={mediaQuality === 'original'}
                            onPress={() => { setMediaQuality('original'); updateStoragePref('media_quality', 'original'); }}
                            icon="star-outline"
                            description={t('original_quality_desc')}
                            color="#1063FD"
                        />

                        <Text style={styles.sectionTitle}>{t('cache_label')}</Text>
                        <View style={styles.cacheCard}>
                            <View style={styles.cacheInfoRow}>
                                <View>
                                    <Text style={styles.cacheLabel}>{t('cache_label')}</Text>
                                    <Text style={styles.cacheValue}>{cacheSize}</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.clearButton, (clearing || cacheSize === '0.0 MB') && styles.clearButtonDisabled]}
                                    onPress={handleClearCache}
                                    disabled={clearing || cacheSize === '0.0 MB'}
                                >
                                    <View
                                        style={[styles.clearButtonContainer, { backgroundColor: clearing ? colors.muted : colors.error }]}
                                    >
                                        {clearing ? (
                                            <ActivityIndicator size="small" color={colors.text} />
                                        ) : (
                                            <>
                                                <Ionicons name="trash-outline" size={16} color={colors.surface} />
                                                <Text style={styles.clearButtonText}>{t('clear_cache')}</Text>
                                            </>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={styles.sectionTitle}>{t('auto_clear')}</Text>
                        <StorageOption
                            label={t('weekly')}
                            value="weekly"
                            isSelected={autoClear === 'weekly'}
                            onPress={() => { setAutoClear('weekly'); updateStoragePref('auto_clear', 'weekly'); }}
                            icon="repeat-outline"
                            color="#34C759"
                            description={t('auto_clear_desc')}
                        />
                        <StorageOption
                            label={t('monthly')}
                            value="monthly"
                            isSelected={autoClear === 'monthly'}
                            onPress={() => { setAutoClear('monthly'); updateStoragePref('auto_clear', 'monthly'); }}
                            icon="calendar-outline"
                            color="#9C27B0"
                            description={t('auto_clear_desc')}
                        />
                        <StorageOption
                            label={t('never')}
                            value="never"
                            isSelected={autoClear === 'never'}
                            onPress={() => { setAutoClear('never'); updateStoragePref('auto_clear', 'never'); }}
                            icon="infinite-outline"
                            color="#666"
                            description={t('auto_clear_desc')}
                        />

                        <Text style={styles.sectionTitle}>{t('wifi_only_title')}</Text>
                        <View style={styles.cacheCard}>
                            <View style={styles.cacheInfoRow}>
                                <View>
                                    <Text style={styles.cacheLabel}>{t('wifi_only_title')}</Text>
                                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                        {t('wifi_only_desc')}
                                    </Text>
                                </View>
                                <Switch
                                    value={wifiOnly}
                                    onValueChange={(val) => {
                                        setWifiOnly(val);
                                        updateStoragePref('wifi_only', val);
                                    }}
                                    trackColor={{ false: colors.border, true: colors.tint + '80' }}
                                    thumbColor={wifiOnly ? colors.tint : '#fff'}
                                    ios_backgroundColor={colors.border}
                                />
                            </View>
                        </View>
                    </MotiView>
                </Animated.ScrollView>
            )}
        </View>
    );
}

function getStyles(colors: any, activeScheme: string) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerCenter: { alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
    headerUnderline: { width: 40, height: 3, backgroundColor: colors.tint, borderRadius: 2, marginTop: 4 },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText: { marginTop: 12, color: colors.textSecondary, fontSize: 14 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    storageOverview: { borderRadius: 24, padding: 20, marginTop: 10, marginBottom: 24, ...createShadow({ opacity: 0.15, radius: 12 }) },
    storageTitle: { fontSize: 12, color: colors.surface + 'B3', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    storageSize: { fontSize: 32, fontWeight: '800', color: colors.surface, marginBottom: 2 },
    storageSubtext: { fontSize: 13, color: colors.surface + 'B3', marginBottom: 12 },
    storageBar: { height: 6, backgroundColor: colors.surface + '4D', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
    storageBarFill: { height: '100%', backgroundColor: colors.surface, borderRadius: 3 },
    storageStats: { flexDirection: 'row', gap: 16 },
    storageStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    storageDot: { width: 8, height: 8, borderRadius: 4 },
    storageStatText: { fontSize: 11, color: colors.surface + 'B3' },
    sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.tint, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 24, marginBottom: 12, marginLeft: 5 },
    optionCard: { borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, ...createShadow({ opacity: 0.05, radius: 6 }) },
    optionCardSelected: { borderColor: colors.tint, borderWidth: 2 },
    optionInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    optionIconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    optionTextContainer: { flex: 1 },
    optionLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
    optionDescription: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
    cacheCard: { borderRadius: 20, padding: 20, marginBottom: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, ...createShadow({ opacity: 0.05, radius: 8 }) },
    cacheInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cacheLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
    cacheValue: { fontSize: 28, fontWeight: '900', color: colors.text, marginTop: 4 },
    clearButton: { borderRadius: 12, overflow: 'hidden' },
    clearButtonDisabled: { opacity: 0.6 },
    clearButtonContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 6 },
    clearButtonText: { color: colors.surface, fontSize: 13, fontWeight: '700' },
});
}