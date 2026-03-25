import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    StatusBar,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { getMyCompliance } from '@/services/ModerationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { router } from 'expo-router';

export default function AiSafetyScreen() {
    const insets = useSafeAreaInsets();
    const [compliance, setCompliance] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCompliance();
    }, []);

    const fetchCompliance = async () => {
        try {
            setLoading(true);
            const data = await getMyCompliance();
            setCompliance(data);
        } catch (error) {
            console.error('Failed to fetch compliance:', error);
        } finally {
            setLoading(false);
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

    return (
        <View style={GlobalStyles.popupContainer}>
            <StatusBar barStyle="dark-content" />

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AI Safety & Trust</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#0084ff" />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.scoreCircleContainer}>
                        <View style={[styles.scoreCircle, { borderColor: getStatusColor(compliance?.trust_score ?? 1) }]}>
                            <Text style={styles.scorePercent}>{((compliance?.trust_score ?? 1) * 100).toFixed(0)}%</Text>
                            <Text style={styles.scoreLabel}>Trust Score</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(compliance?.trust_score ?? 1) }]}>
                            <Text style={styles.statusText}>{getStatusLabel(compliance?.trust_score ?? 1)}</Text>
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        <StatItem label="Violations" value={compliance?.violation_count ?? 0} icon="alert-circle" color="#F44336" />
                        <StatItem label="Integrity" value={((compliance?.reporting_integrity ?? 1) * 100).toFixed(0) + '%'} icon="shield-checkmark" color="#4CAF50" />
                        <StatItem label="False Reports" value={compliance?.false_report_count ?? 0} icon="flag" color="#FF9800" />
                    </View>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>About Your Trust Score</Text>
                        <Text style={styles.infoText}>
                            Your trust score is calculated based on your content history and reporting accuracy. 
                            A high score ensures your reports are prioritized and gives you a "Verified Contributor" standing.
                        </Text>
                        
                        <View style={styles.divider} />
                        
                        <Text style={styles.infoTitle}>Tips for Improving</Text>
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

const StatItem = ({ label, value, icon, color }: any) => (
    <View style={styles.statItem}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 },
  headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  scoreCircleContainer: { alignItems: 'center', marginVertical: 30 },
  scoreCircle: { width: 150, height: 150, borderRadius: 75, borderWidth: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.02)' },
  scorePercent: { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a' },
  scoreLabel: { fontSize: 12, color: 'rgba(0,0,0,0.4)', marginTop: 4 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: -20 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, gap: 8 },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 16 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginTop: 8 },
  statLabel: { fontSize: 10, color: 'rgba(0,0,0,0.4)', marginTop: 2, textAlign: 'center' },
  infoBox: { backgroundColor: 'rgba(0,84,255,0.05)', padding: 20, borderRadius: 20 },
  infoTitle: { color: '#0084ff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  infoText: { color: 'rgba(0,0,0,0.6)', fontSize: 14, lineHeight: 22, marginBottom: 15 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 15 },
  tipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  tipText: { color: '#333', fontSize: 13, marginLeft: 10 },
});
