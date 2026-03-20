import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    TextInput,
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { getAdminReports, resolveReport } from '@/services/ModerationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { router } from 'expo-router';
import { useToastStore } from '@/stores/toastStore';

export default function ModerationScreen() {
    const insets = useSafeAreaInsets();
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [isResolving, setIsResolving] = useState(false);
    const { showToast } = useToastStore();

    const fetchReports = async () => {
        try {
            setLoading(true);
            const data = await getAdminReports();
            setReports(data.data || []);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
            showToast('Failed to load moderation reports', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handleResolve = async (action: 'dismiss' | 'warn' | 'suspend' | 'ban') => {
        if (!selectedReport) return;

        setIsResolving(true);
        try {
            await resolveReport(selectedReport.report_id, {
                action,
                notes: resolutionNotes,
                duration_hours: action === 'suspend' ? 24 : undefined
            });
            showToast(`Report ${selectedReport.report_id} has been resolved.`, 'success');
            setSelectedReport(null);
            setResolutionNotes('');
            fetchReports();
        } catch (error) {
            console.error('Resolution failed:', error);
            showToast('Failed to resolve report', 'error');
        } finally {
            setIsResolving(false);
        }
    };

    const renderReportItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            style={styles.reportCard}
            onPress={() => setSelectedReport(item)}
        >
            <View style={styles.reportHeader}>
                <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) }]}>
                    <Text style={styles.severityText}>{item.severity.toUpperCase()}</Text>
                </View>
                <Text style={styles.reportDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>

            <Text style={styles.targetTitle} numberOfLines={1}>
                Target: {item.target_type} #{item.target_id}
            </Text>
            
            <View style={styles.categoryRow}>
                <Text style={styles.categoryText}>{item.category.replace('_', ' ')}</Text>
                <Ionicons name="chevron-forward" size={16} color="#999" />
                <Text style={styles.subcategoryText}>{item.subcategory?.replace('_', ' ')}</Text>
            </View>

            {item.check && (
                <View style={styles.aiScoreRow}>
                    <Text style={styles.aiScoreText}>AI Score: {(item.check.malicious_intent_score * 100).toFixed(0)}% Malicious</Text>
                    <View style={styles.miniBar}>
                        <View style={[styles.miniFill, { width: `${item.check.malicious_intent_score * 100}%`, backgroundColor: getSeverityColor(item.severity) }]} />
                    </View>
                </View>
            )}
        </TouchableOpacity>
    );

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return '#9C27B0';
            case 'high': return '#F44336';
            case 'medium': return '#FF9800';
            default: return '#4CAF50';
        }
    };

    return (
        <View style={[GlobalStyles.popupContainer, { paddingTop: 0 }]}>
            <View style={[styles.header, { paddingTop: insets.top }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Moderation Panel</Text>
                <TouchableOpacity onPress={fetchReports} style={styles.refreshButton}>
                    <Ionicons name="refresh" size={24} color="#1DA1F2" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#1DA1F2" style={styles.loader} />
            ) : (
                <FlatList
                    data={reports}
                    renderItem={renderReportItem}
                    keyExtractor={(item) => item.report_id}
                    contentContainerStyle={styles.listContent}
                    refreshing={refreshing}
                    onRefresh={() => {
                        setRefreshing(true);
                        fetchReports();
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="shield-checkmark-outline" size={64} color="#ccc" />
                            <Text style={styles.emptyText}>All systems clear. No pending reports.</Text>
                        </View>
                    }
                />
            )}

            {/* Resolution Detail Modal (Self-contained) */}
            <Modal
                visible={!!selectedReport}
                animationType="fade"
                transparent
                onRequestClose={() => setSelectedReport(null)}
            >
                <View style={styles.detailOverlay}>
                    <BlurView intensity={90} tint="dark" style={styles.detailContainer}>
                        {selectedReport && (
                            <>
                                <ScrollView style={styles.detailScroll}>
                                    <Text style={styles.detailId}>REPORT: {selectedReport.report_id}</Text>
                                    <Text style={styles.detailSectionTitle}>AI Analysis</Text>
                                    <View style={styles.scoreGrid}>
                                        <ScoreItem label="Malicious" score={selectedReport.check?.malicious_intent_score} color="#F44336" />
                                        <ScoreItem label="Fact Score" score={selectedReport.check?.fact_score} color="#4CAF50" />
                                        <ScoreItem label="Rec. Action" value={selectedReport.check?.recommended_action?.toUpperCase()} color="#1DA1F2" />
                                    </View>

                                    <Text style={styles.detailSectionTitle}>Report Content</Text>
                                    <View style={styles.contentBox}>
                                        <Text style={styles.contentLabel}>REPORTED TEXT:</Text>
                                        <Text style={styles.contentText}>{selectedReport.check?.content_snapshot || 'N/A'}</Text>
                                        
                                        <View style={styles.contentDivider} />
                                        
                                        <Text style={styles.contentLabel}>REPORTER NOTES:</Text>
                                        <Text style={styles.contentText}>{selectedReport.description || 'No description provided.'}</Text>
                                    </View>

                                    <Text style={styles.detailSectionTitle}>Resolution Action</Text>
                                    <TextInput
                                        style={styles.notesInput}
                                        placeholder="Add internal notes context..."
                                        placeholderTextColor="#999"
                                        multiline
                                        value={resolutionNotes}
                                        onChangeText={setResolutionNotes}
                                    />
                                </ScrollView>

                                <View style={styles.actionButtons}>
                                    <DecisionButton label="Dismiss" icon="close-circle" color="#999" onPress={() => handleResolve('dismiss')} />
                                    <DecisionButton label="Warning" icon="warning" color="#FF9800" onPress={() => handleResolve('warn')} />
                                    <DecisionButton label="Suspend" icon="timer" color="#F44336" onPress={() => handleResolve('suspend')} />
                                    <DecisionButton label="Ban" icon="skull" color="#000" onPress={() => handleResolve('ban')} />
                                </View>

                                <TouchableOpacity 
                                    style={styles.closeDetailButton}
                                    onPress={() => setSelectedReport(null)}
                                >
                                    <Text style={styles.closeDetailText}>Cancel</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </BlurView>
                </View>
            </Modal>
        </View>
    );
}

const ScoreItem = ({ label, score, color, value }: any) => (
    <View style={styles.scoreItem}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={[styles.scoreValue, { color }]}>{value || `${(score * 100).toFixed(0)}%`}</Text>
    </View>
);

const DecisionButton = ({ label, icon, color, onPress }: any) => (
    <TouchableOpacity style={[styles.decisionButton, { borderColor: color }]} onPress={onPress}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={[styles.decisionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    refreshButton: { padding: 4 },
    listContent: { padding: 16 },
    loader: { flex: 1, justifyContent: 'center' },
    reportCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    severityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    severityText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    reportDate: { fontSize: 12, color: '#999' },
    targetTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
    categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    categoryText: { fontSize: 14, color: '#1DA1F2', fontWeight: '500' },
    subcategoryText: { fontSize: 14, color: '#666' },
    aiScoreRow: { marginTop: 8 },
    aiScoreText: { fontSize: 12, color: '#666', marginBottom: 4 },
    miniBar: { height: 4, backgroundColor: '#eee', borderRadius: 2, overflow: 'hidden' },
    miniFill: { height: '100%' },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, color: '#999', textAlign: 'center' },
    
    // Detail Modal Styles
    detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    detailContainer: { width: '90%', height: '80%', borderRadius: 20, overflow: 'hidden', padding: 20 },
    detailScroll: { flex: 1 },
    detailId: { color: '#fff', fontSize: 12, opacity: 0.7, marginBottom: 16 },
    detailSectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 12 },
    scoreGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 12 },
    scoreItem: { alignItems: 'center' },
    scoreLabel: { color: '#fff', fontSize: 10, opacity: 0.7, marginBottom: 4 },
    scoreValue: { fontSize: 16, fontWeight: 'bold' },
    contentBox: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12 },
    contentLabel: { color: '#1DA1F2', fontSize: 10, fontWeight: 'bold', marginBottom: 8 },
    contentText: { color: '#fff', fontSize: 14, lineHeight: 20 },
    contentDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 },
    notesInput: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', padding: 12, borderRadius: 12, height: 100, textAlignVertical: 'top' },
    actionButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 24, gap: 8 },
    decisionButton: { flexBasis: '48%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 12, borderRadius: 12, justifyContent: 'center' },
    decisionLabel: { marginLeft: 8, fontWeight: 'bold' },
    closeDetailButton: { marginTop: 20, padding: 16, alignItems: 'center' },
    closeDetailText: { color: '#F44336', fontWeight: 'bold' },
});
