// components/ModerationComplianceModal.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { getMyCompliance } from '@/services/ModerationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';

interface ModerationComplianceModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function ModerationComplianceModal({ visible, onClose }: ModerationComplianceModalProps) {
    const insets = useSafeAreaInsets();
    const [compliance, setCompliance] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible) {
            fetchCompliance();
        }
    }, [visible]);

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
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView intensity={90} tint="dark" style={[styles.container, { paddingTop: insets.top + 20 }]}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Account Compliance</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#1DA1F2" style={styles.loader} />
                    ) : (
                        <ScrollView contentContainerStyle={styles.scrollContent}>
                            <View style={styles.scoreCircleContainer}>
                                <View style={[styles.scoreCircle, { borderColor: getStatusColor(compliance?.trust_score ?? 1) }]}>
                                    <Text style={styles.scorePercent}>{( (compliance?.trust_score ?? 1) * 100).toFixed(0)}%</Text>
                                    <Text style={styles.scoreLabel}>Trust Score</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(compliance?.trust_score ?? 1) }]}>
                                    <Text style={styles.statusText}>{getStatusLabel(compliance?.trust_score ?? 1)}</Text>
                                </View>
                            </View>

                            <View style={styles.statsGrid}>
                                <StatItem label="Violations" value={compliance?.violation_count ?? 0} icon="alert-circle" color="#F44336" />
                                <StatItem label="Integrity" value={((compliance?.reporting_integrity ?? 1) * 100).toFixed(0) + '%'} icon="shield-checkmark" color="#4CAF50" />
                                <StatItem label="Reports" value={compliance?.false_report_count ?? 0} icon="flag" color="#FF9800" sublabel="False flags" />
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
                </BlurView>
            </View>
        </Modal>
    );
}

const StatItem = ({ label, value, icon, color, sublabel }: any) => (
    <View style={styles.statItem}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {sublabel && <Text style={styles.statSublabel}>{sublabel}</Text>}
    </View>
);

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    container: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    closeButton: { padding: 4 },
    loader: { flex: 1, justifyContent: 'center' },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
    scoreCircleContainer: { alignItems: 'center', marginVertical: 30 },
    scoreCircle: {
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    scorePercent: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
    scoreLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: -20, elevation: 5 },
    statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    statItem: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, marginHorizontal: 4 },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 8 },
    statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
    statSublabel: { fontSize: 8, color: 'rgba(255,255,255,0.4)' },
    infoBox: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 20 },
    infoTitle: { color: '#1DA1F2', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
    infoText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22, marginBottom: 15 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
    tipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    tipText: { color: '#fff', fontSize: 13, marginLeft: 10 },
});
