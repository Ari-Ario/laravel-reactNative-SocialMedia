import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    StatusBar,
    Platform,
    Switch,
    Animated,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { getMyCompliance } from '@/services/ModerationService';
import { fetchFullSettings, updatePreferences } from '@/services/SettingService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Colors from '@/constants/Colors';
import { BackButton } from '@/components/ui/IconButton';
import { createShadow } from '@/utils/styles';
import * as Haptics from 'expo-haptics';
import GlobalStyles from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';

const isWeb = Platform.OS === 'web';

export default function AiSafetyScreen() {
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    const insets = useSafeAreaInsets();
    const [compliance, setCompliance] = useState<any>(null);
    const [preferences, setPreferences] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const scrollY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [complianceData, settingsData] = await Promise.all([
                getMyCompliance(),
                fetchFullSettings()
            ]);
            setCompliance(complianceData);
            setPreferences(settingsData.preferences);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePreference = async (field: string, value: boolean) => {
        try {
            const oldVal = preferences[field];
            setPreferences((prev: any) => ({ ...prev, [field]: value }));
            await updatePreferences({ [field]: value });

            if (!isWeb) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (error) {
            setPreferences((prev: any) => ({ ...prev, [field]: !value }));
            Alert.alert('Error', 'Failed to update safety preference');
        }
    };

    const getStatusColor = (score: number) => {
        if (score > 0.8) return '#4CAF50';
        if (score > 0.5) return '#FF9800';
        return '#F44336';
    };

    const getStatusLabel = (score: number) => {
        if (score > 0.8) return 'EXCELLENT';
        if (score > 0.5) return 'GOOD';
        return 'REDUCING';
    };

    const SafetyToggle = ({ label, description, icon, value, onToggle, color = "#0084ff" }: any) => (
        <View style={styles.toggleCard}>
            <View style={styles.toggleInfo}>
                <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                    <Ionicons name={icon} size={20} color={color} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.toggleLabel}>{label}</Text>
                    <Text style={styles.toggleDescription}>{description}</Text>
                </View>
            </View>
            <Switch
                value={!!value}
                onValueChange={onToggle}
                trackColor={{ false: colors.border, true: color + '80' }}
                thumbColor={value ? color : '#fff'}
            />
        </View>
    );

    const StatutoryItem = ({ label, value, icon, color }: any) => (
        <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );

    return (
        <View style={[styles.container, GlobalStyles.popupContainer]}>
            <StatusBar barStyle="dark-content" />

            <LinearGradient
                colors={[colors.surface, colors.background]}
                style={[styles.header, { paddingTop: insets.top + 10 }]}
            >
                <BackButton onPress={() => router.back()} />
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>AI Safety & Trust</Text>
                    <View style={styles.headerUnderline} />
                </View>
                <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
                    <Ionicons name="refresh" size={20} color="#0084ff" />
                </TouchableOpacity>
            </LinearGradient>

            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#0084ff" />
                    <Text style={styles.loaderText}>Assessing your trust level...</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.scoreCircleContainer}>
                        <LinearGradient
                            colors={[getStatusColor(compliance?.trust_score ?? 1) + '20', colors.background]}
                            style={styles.scoreCircleGradient}
                        >
                            <View style={[styles.scoreCircle, { borderColor: getStatusColor(compliance?.trust_score ?? 1) }]}>
                                <Text style={styles.scorePercent}>{((compliance?.trust_score ?? 1) * 100).toFixed(0)}%</Text>
                                <Text style={styles.scoreLabel}>Trust Score</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(compliance?.trust_score ?? 1) }]}>
                                <Text style={styles.statusText}>{getStatusLabel(compliance?.trust_score ?? 1)}</Text>
                            </View>
                        </LinearGradient>
                    </MotiView>

                    <View style={styles.statsGrid}>
                        <StatutoryItem label="Violations" value={compliance?.violation_count ?? 0} icon="alert-circle" color="#F44336" />
                        <StatutoryItem label="Integrity" value={((compliance?.reporting_integrity ?? 1) * 100).toFixed(0) + '%'} icon="shield-checkmark" color="#4CAF50" />
                        <StatutoryItem label="False Reports" value={compliance?.false_report_count ?? 0} icon="flag" color="#FF9800" />
                    </View>

                    <Text style={styles.sectionTitle}>Safety Controls</Text>
                    <SafetyToggle
                        label="Content Filters"
                        description="Automatically filter sensitive or offensive content from your feed."
                        icon="alert-outline"
                        value={preferences?.content_filters}
                        onToggle={(val: boolean) => handleTogglePreference('content_filters', val)}
                        color="#1063FD"
                    />
                    <SafetyToggle
                        label="AI Portals"
                        description="Allow AI to assist in connecting you with relevant community spaces."
                        icon="planet-outline"
                        value={preferences?.enable_web_portals}
                        onToggle={(val: boolean) => handleTogglePreference('enable_web_portals', val)}
                        color="#9C27B0"
                    />

                    <View style={styles.infoBox}>
                        <View style={styles.infoTitleRow}>
                            <Ionicons name="information-circle" size={20} color="#0084ff" />
                            <Text style={styles.infoTitle}>About Your Trust Score</Text>
                        </View>
                        <Text style={styles.infoText}>
                            Your trust score is calculated based on your content history and reporting accuracy.
                            A high score ensures your reports are prioritized and gives you a "Verified Contributor" standing.
                        </Text>

                        <View style={styles.divider} />

                        <Text style={styles.infoSubtitle}>How to maintain a high score:</Text>
                        <View style={styles.tipRow}>
                            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                            <Text style={styles.tipText}>Follow community guidelines consistently.</Text>
                        </View>
                        <View style={styles.tipRow}>
                            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                            <Text style={styles.tipText}>Only report content that clearly violates rules.</Text>
                        </View>
                    </View>
                </ScrollView>
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
        headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
        headerUnderline: { width: 30, height: 3, backgroundColor: colors.tint, borderRadius: 2, marginTop: 4 },
        backButton: { padding: 4 },
        refreshButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
        loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        loaderText: { marginTop: 12, color: colors.textSecondary, fontSize: 14 },
        scrollContent: { paddingHorizontal: 20, paddingBottom: 50 },
        scoreCircleContainer: { alignItems: 'center', marginVertical: 20 },
        scoreCircleGradient: { padding: 30, borderRadius: 100, alignItems: 'center' },
        scoreCircle: {
            width: 140,
            height: 140,
            borderRadius: 70,
            borderWidth: 6,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.surface,
            ...createShadow({ opacity: 0.1, radius: 10 })
        },
        scorePercent: { fontSize: 36, fontWeight: '900', color: colors.text },
        scoreLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' },
        statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: -15, ...createShadow({ opacity: 0.2, radius: 5 }) },
        statusText: { color: '#fff', fontSize: 12, fontWeight: '900' },
        statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, gap: 10 },
        statItem: { flex: 1, alignItems: 'center', backgroundColor: colors.surface, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
        statIconContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
        statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
        statLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
        sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.tint, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 15, marginLeft: 5 },
        toggleCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            padding: 18,
            borderRadius: 20,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            ...createShadow({ opacity: 0.05, radius: 8 }),
        },
        toggleInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
        iconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
        textContainer: { flex: 1 },
        toggleLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
        toggleDescription: { fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 14 },
        infoBox: { backgroundColor: colors.surface, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.border, marginTop: 10 },
        infoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
        infoTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
        infoSubtitle: { color: colors.tint, fontSize: 13, fontWeight: '700', marginBottom: 12 },
        infoText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 15 },
        divider: { height: 1, backgroundColor: colors.border, marginVertical: 15 },
        tipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
        tipText: { color: colors.text, fontSize: 13, marginLeft: 10, fontWeight: '500' },
    });
}
