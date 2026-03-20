// app/moderation/index.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    Modal,
    Dimensions,
    Platform,
    Image,
    RefreshControl,
    Animated,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import { getAdminReports, resolveReport, assignReport, getMyAssignedReports } from '@/services/ModerationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createShadow } from '@/utils/styles';
import { router } from 'expo-router';
import { useToastStore } from '@/stores/toastStore';
import AuthContext from '@/context/AuthContext';
import getApiBaseImage from '@/services/getApiBaseImage';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

interface Report {
    report_id: string;
    target_type: 'post' | 'story' | 'space' | 'comment' | 'profile';
    target_id: number;
    target_data?: any;
    category: string;
    subcategory: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    created_at: string;
    reporter: {
        id: number;
        name: string;
        profile_photo: string | null;
    };
    assigned_to?: {
        id: number;
        name: string;
        admin_level?: string;
    };
    check?: {
        malicious_intent_score: number;
        fact_score: number;
        recommended_action: string;
        content_snapshot: string;
        ai_confidence: number;
        toxicity_score?: number;
        spam_score?: number;
    };
    status: 'pending' | 'in_review' | 'resolved' | 'dismissed';
}

interface TabType {
    id: string;
    label: string;
    icon: string;
    type?: string;
    count: number;
}

const TABS: TabType[] = [
    { id: 'all', label: 'All Reports', icon: 'apps', count: 0, type: undefined },
    { id: 'my', label: 'My Cases', icon: 'person', count: 0, type: undefined },
    { id: 'posts', label: 'Posts', icon: 'document-text', count: 0, type: 'post' },
    { id: 'comments', label: 'Comments', icon: 'chatbubbles', count: 0, type: 'comment' },
    { id: 'stories', label: 'Stories', icon: 'time', count: 0, type: 'story' },
    { id: 'spaces', label: 'Spaces', icon: 'people', count: 0, type: 'space' },
    { id: 'profiles', label: 'Profiles', icon: 'person-circle', count: 0, type: 'profile' },
];

const SEVERITY_CONFIG = {
    low: { color: '#4CAF50', bg: '#4CAF5020', icon: 'shield-checkmark', label: 'Low' },
    medium: { color: '#FF9800', bg: '#FF980020', icon: 'warning', label: 'Medium' },
    high: { color: '#F44336', bg: '#F4433620', icon: 'alert-circle', label: 'High' },
    critical: { color: '#9C27B0', bg: '#9C27B020', icon: 'skull', label: 'Critical' },
};

const STATUS_CONFIG = {
    pending: { color: '#FF9800', bg: '#FF980020', label: 'Pending', icon: 'time' },
    in_review: { color: '#2196F3', bg: '#2196F320', label: 'In Review', icon: 'eye' },
    resolved: { color: '#4CAF50', bg: '#4CAF5020', label: 'Resolved', icon: 'checkmark-circle' },
    dismissed: { color: '#9E9E9E', bg: '#9E9E9E20', label: 'Dismissed', icon: 'close-circle' },
};

export default function ModerationScreen() {
    const insets = useSafeAreaInsets();
    const { user } = React.useContext(AuthContext);
    const { showToast } = useToastStore();

    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [isResolving, setIsResolving] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [assignedReports, setAssignedReports] = useState<Set<string>>(new Set());

    const scrollY = useRef(new Animated.Value(0)).start();

    const fetchReports = async () => {
        try {
            setLoading(true);
            const data = await getAdminReports();
            setReports(data.data || []);

            // Fetch assigned reports
            const myAssigned = await getMyAssignedReports();
            setAssignedReports(new Set(myAssigned.data.map((r: any) => r.report_id)));
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

    // Filter reports based on active tab, search, and severity
    const filteredReports = useMemo(() => {
        let filtered = [...reports];

        // Tab filtering
        if (activeTab === 'my') {
            filtered = filtered.filter(r => assignedReports.has(r.report_id));
        } else if (activeTab !== 'all') {
            const tabType = TABS.find(t => t.id === activeTab)?.type;
            if (tabType) {
                filtered = filtered.filter(r => r.target_type === tabType);
            }
        }

        // Severity filter
        if (filterSeverity) {
            filtered = filtered.filter(r => r.severity === filterSeverity);
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(r =>
                r.report_id.toLowerCase().includes(query) ||
                r.category?.toLowerCase().includes(query) ||
                r.description?.toLowerCase().includes(query) ||
                r.reporter?.name?.toLowerCase().includes(query)
            );
        }

        // Sort by severity and date
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return filtered.sort((a, b) => {
            if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                return severityOrder[a.severity] - severityOrder[b.severity];
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [reports, activeTab, filterSeverity, searchQuery, assignedReports]);

    // Update tab counts
    const tabsWithCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        reports.forEach(report => {
            counts.all = (counts.all || 0) + 1;
            if (assignedReports.has(report.report_id)) {
                counts.my = (counts.my || 0) + 1;
            }
            counts[`${report.target_type}s`] = (counts[`${report.target_type}s`] || 0) + 1;
        });

        return TABS.map(tab => ({
            ...tab,
            count: counts[tab.id] || 0
        }));
    }, [reports, assignedReports]);

    const handleAssign = async (reportId: string) => {
        try {
            await assignReport(reportId);
            setAssignedReports(prev => new Set([...prev, reportId]));
            showToast('Report assigned to you', 'success');
            fetchReports();
        } catch (error) {
            console.error('Assignment failed:', error);
            showToast('Failed to assign report', 'error');
        }
    };

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

    const renderTargetContent = (report: Report) => {
        const targetData = report.target_data || {};

        switch (report.target_type) {
            case 'post':
                return (
                    <View style={styles.targetContentCard}>
                        {targetData.media?.[0] && (
                            <Image
                                source={{ uri: `${getApiBaseImage()}/storage/${targetData.media[0].file_path}` }}
                                style={styles.targetMedia}
                            />
                        )}
                        <View style={styles.targetTextContent}>
                            <Text style={styles.targetUsername}>{targetData.user?.name}</Text>
                            <Text style={styles.targetCaption} numberOfLines={2}>
                                {targetData.caption || targetData.content || 'No content'}
                            </Text>
                            {targetData.comments_count > 0 && (
                                <View style={styles.targetMeta}>
                                    <Ionicons name="chatbubble-outline" size={12} color="#666" />
                                    <Text style={styles.targetMetaText}>{targetData.comments_count} comments</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );

            case 'comment':
                return (
                    <View style={styles.targetContentCard}>
                        <View style={styles.commentAuthor}>
                            <Image
                                source={{ uri: targetData.user?.profile_photo ? `${getApiBaseImage()}/storage/${targetData.user.profile_photo}` : undefined }}
                                style={styles.targetAvatar}
                            />
                            <Text style={styles.targetUsername}>{targetData.user?.name}</Text>
                        </View>
                        <Text style={styles.targetCaption}>{targetData.content}</Text>
                        {targetData.post && (
                            <Text style={styles.targetContext} numberOfLines={1}>
                                On: {targetData.post.caption?.substring(0, 50)}...
                            </Text>
                        )}
                    </View>
                );

            case 'profile':
                return (
                    <View style={styles.targetContentCard}>
                        <Image
                            source={{ uri: targetData.profile_photo ? `${getApiBaseImage()}/storage/${targetData.profile_photo}` : undefined }}
                            style={styles.targetAvatarLarge}
                        />
                        <View style={styles.targetTextContent}>
                            <Text style={styles.targetUsername}>{targetData.name}</Text>
                            <Text style={styles.targetBio} numberOfLines={2}>
                                {targetData.bio || 'No bio'}
                            </Text>
                            <View style={styles.targetMeta}>
                                <Ionicons name="people" size={12} color="#666" />
                                <Text style={styles.targetMetaText}>{targetData.followers_count || 0} followers</Text>
                            </View>
                        </View>
                    </View>
                );

            case 'story':
                return (
                    <View style={styles.targetContentCard}>
                        {targetData.media?.[0] && (
                            <Image
                                source={{ uri: `${getApiBaseImage()}/storage/${targetData.media[0].file_path}` }}
                                style={styles.targetMediaSmall}
                            />
                        )}
                        <View style={styles.targetTextContent}>
                            <Text style={styles.targetUsername}>{targetData.user?.name}</Text>
                            <Text style={styles.targetCaption} numberOfLines={2}>
                                {targetData.caption || 'Story with no caption'}
                            </Text>
                            <Text style={styles.targetMeta}>Expires in {targetData.expires_in || '24'} hours</Text>
                        </View>
                    </View>
                );

            case 'space':
                return (
                    <View style={styles.targetContentCard}>
                        {targetData.cover_image && (
                            <Image
                                source={{ uri: `${getApiBaseImage()}/storage/${targetData.cover_image}` }}
                                style={styles.targetMediaSmall}
                            />
                        )}
                        <View style={styles.targetTextContent}>
                            <Text style={styles.targetUsername}>{targetData.name}</Text>
                            <Text style={styles.targetCaption} numberOfLines={2}>
                                {targetData.description || 'No description'}
                            </Text>
                            <View style={styles.targetMeta}>
                                <Ionicons name="people" size={12} color="#666" />
                                <Text style={styles.targetMetaText}>{targetData.member_count || 0} members</Text>
                            </View>
                        </View>
                    </View>
                );

            default:
                return null;
        }
    };

    const ReportCard = ({ report, index }: { report: Report; index: number }) => {
        const severity = SEVERITY_CONFIG[report.severity];
        const status = STATUS_CONFIG[report.status];
        const isAssigned = assignedReports.has(report.report_id);

        return (
            <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: index * 50, type: 'spring' }}
                style={styles.cardContainer}
            >
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setSelectedReport(report)}
                    style={styles.cardTouchable}
                >
                    <LinearGradient
                        colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                        style={styles.cardGradient}
                    >
                        {/* Card Header */}
                        <View style={styles.cardHeader}>
                            <View style={[styles.severityBadge, { backgroundColor: severity.bg }]}>
                                <Ionicons name={severity.icon as any} size={12} color={severity.color} />
                                <Text style={[styles.severityText, { color: severity.color }]}>
                                    {severity.label}
                                </Text>
                            </View>

                            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                                <Ionicons name={status.icon as any} size={10} color={status.color} />
                                <Text style={[styles.statusText, { color: status.color }]}>
                                    {status.label}
                                </Text>
                            </View>

                            <Text style={styles.reportDate}>
                                {new Date(report.created_at).toLocaleDateString()}
                            </Text>
                        </View>

                        {/* Target Type Icon */}
                        <View style={styles.typeIconContainer}>
                            {getTargetIcon(report.target_type, 20, '#fff')}
                            <Text style={styles.typeText}>
                                {report.target_type.toUpperCase()} #{report.target_id}
                            </Text>
                        </View>

                        {/* Reported Content */}
                        {renderTargetContent(report)}

                        {/* Report Details */}
                        <View style={styles.reportDetails}>
                            <View style={styles.categoryContainer}>
                                <Ionicons name="flag" size={12} color="#FF9800" />
                                <Text style={styles.categoryText}>
                                    {report.category.replace(/_/g, ' ')}
                                </Text>
                                {report.subcategory && (
                                    <>
                                        <Ionicons name="chevron-forward" size={10} color="#666" />
                                        <Text style={styles.subcategoryText}>
                                            {report.subcategory.replace(/_/g, ' ')}
                                        </Text>
                                    </>
                                )}
                            </View>

                            <Text style={styles.reportDescription} numberOfLines={2}>
                                {report.description}
                            </Text>

                            <View style={styles.reporterInfo}>
                                <Image
                                    source={{ uri: report.reporter.profile_photo ? `${getApiBaseImage()}/storage/${report.reporter.profile_photo}` : undefined }}
                                    style={styles.reporterAvatar}
                                />
                                <Text style={styles.reporterName}>Reported by {report.reporter.name}</Text>
                            </View>
                        </View>

                        {/* AI Score */}
                        {report.check && (
                            <View style={styles.aiSection}>
                                <View style={styles.aiScoreRow}>
                                    <Text style={styles.aiScoreLabel}>AI Confidence</Text>
                                    <View style={styles.aiScoreBar}>
                                        <View
                                            style={[
                                                styles.aiScoreFill,
                                                {
                                                    width: `${(report.check.ai_confidence || 0) * 100}%`,
                                                    backgroundColor: severity.color
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.aiScoreValue}>
                                        {((report.check.ai_confidence || 0) * 100).toFixed(0)}%
                                    </Text>
                                </View>
                                <View style={styles.aiTags}>
                                    {report.check.malicious_intent_score > 0.7 && (
                                        <View style={styles.aiTag}>
                                            <Ionicons name="warning" size={10} color="#F44336" />
                                            <Text style={styles.aiTagText}>High Malicious Intent</Text>
                                        </View>
                                    )}
                                    {report.check.fact_score < 0.3 && (
                                        <View style={styles.aiTag}>
                                            <Ionicons name="help-circle" size={10} color="#FF9800" />
                                            <Text style={styles.aiTagText}>Factually Questionable</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Action Buttons */}
                        <View style={styles.cardActions}>
                            {!isAssigned && report.status === 'pending' && (
                                <TouchableOpacity
                                    style={styles.assignButton}
                                    onPress={() => handleAssign(report.report_id)}
                                >
                                    <Ionicons name="person-add" size={16} color="#fff" />
                                    <Text style={styles.assignButtonText}>Take Case</Text>
                                </TouchableOpacity>
                            )}

                            {isAssigned && (
                                <View style={styles.assignedBadge}>
                                    <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                                    <Text style={styles.assignedText}>Assigned to you</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.detailButton}
                                onPress={() => setSelectedReport(report)}
                            >
                                <Text style={styles.detailButtonText}>Review →</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </MotiView>
        );
    };

    const getTargetIcon = (type: string, size: number, color: string) => {
        switch (type) {
            case 'post': return <Ionicons name="document-text" size={size} color={color} />;
            case 'comment': return <Ionicons name="chatbubbles" size={size} color={color} />;
            case 'story': return <Ionicons name="time" size={size} color={color} />;
            case 'space': return <Ionicons name="people" size={size} color={color} />;
            case 'profile': return <Ionicons name="person-circle" size={size} color={color} />;
            default: return <Ionicons name="flag" size={size} color={color} />;
        }
    };

    const ResolutionModal = () => (
        <Modal
            visible={!!selectedReport}
            animationType="fade"
            transparent
            onRequestClose={() => setSelectedReport(null)}
        >
            <BlurView intensity={90} tint="dark" style={styles.modalOverlay}>
                <MotiView
                    from={{ opacity: 0, scale: 0.9, translateY: 50 }}
                    animate={{ opacity: 1, scale: 1, translateY: 0 }}
                    transition={{ type: 'spring', damping: 20 }}
                    style={styles.modalContainer}
                >
                    {selectedReport && (
                        <>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Report Review</Text>
                                <TouchableOpacity onPress={() => setSelectedReport(null)}>
                                    <Ionicons name="close" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Report ID and Status */}
                                <View style={styles.modalIdRow}>
                                    <Text style={styles.modalId}>#{selectedReport.report_id}</Text>
                                    <View style={[styles.modalStatusBadge, { backgroundColor: STATUS_CONFIG[selectedReport.status].bg }]}>
                                        <Text style={[styles.modalStatusText, { color: STATUS_CONFIG[selectedReport.status].color }]}>
                                            {STATUS_CONFIG[selectedReport.status].label}
                                        </Text>
                                    </View>
                                </View>

                                {/* Reported Content Section */}
                                <Text style={styles.modalSectionTitle}>Reported Content</Text>
                                <View style={styles.modalContentCard}>
                                    {renderTargetContent(selectedReport)}
                                </View>

                                {/* Reporter Info */}
                                <Text style={styles.modalSectionTitle}>Reporter Details</Text>
                                <View style={styles.modalReporterCard}>
                                    <Image
                                        source={{ uri: selectedReport.reporter.profile_photo ? `${getApiBaseImage()}/storage/${selectedReport.reporter.profile_photo}` : undefined }}
                                        style={styles.modalReporterAvatar}
                                    />
                                    <View>
                                        <Text style={styles.modalReporterName}>{selectedReport.reporter.name}</Text>
                                        <Text style={styles.modalReporterDate}>
                                            Reported {new Date(selectedReport.created_at).toLocaleString()}
                                        </Text>
                                    </View>
                                </View>

                                {/* Report Description */}
                                <Text style={styles.modalSectionTitle}>Report Reason</Text>
                                <View style={styles.modalDescriptionCard}>
                                    <View style={styles.modalCategoryRow}>
                                        <Ionicons name="flag" size={16} color="#FF9800" />
                                        <Text style={styles.modalCategory}>
                                            {selectedReport.category.replace(/_/g, ' ')}
                                        </Text>
                                        {selectedReport.subcategory && (
                                            <>
                                                <Ionicons name="chevron-forward" size={14} color="#666" />
                                                <Text style={styles.modalSubcategory}>
                                                    {selectedReport.subcategory.replace(/_/g, ' ')}
                                                </Text>
                                            </>
                                        )}
                                    </View>
                                    <Text style={styles.modalDescription}>{selectedReport.description}</Text>
                                </View>

                                {/* AI Analysis */}
                                {selectedReport.check && (
                                    <>
                                        <Text style={styles.modalSectionTitle}>AI Analysis</Text>
                                        <View style={styles.modalAiCard}>
                                            <View style={styles.modalScoreGrid}>
                                                <View style={styles.modalScoreItem}>
                                                    <Text style={styles.modalScoreLabel}>Malicious Intent</Text>
                                                    <View style={styles.modalScoreBarContainer}>
                                                        <View style={styles.modalScoreBar}>
                                                            <View
                                                                style={[
                                                                    styles.modalScoreFill,
                                                                    {
                                                                        width: `${(selectedReport.check.malicious_intent_score || 0) * 100}%`,
                                                                        backgroundColor: '#F44336'
                                                                    }
                                                                ]}
                                                            />
                                                        </View>
                                                        <Text style={styles.modalScoreValue}>
                                                            {((selectedReport.check.malicious_intent_score || 0) * 100).toFixed(0)}%
                                                        </Text>
                                                    </View>
                                                </View>

                                                <View style={styles.modalScoreItem}>
                                                    <Text style={styles.modalScoreLabel}>Fact Score</Text>
                                                    <View style={styles.modalScoreBarContainer}>
                                                        <View style={styles.modalScoreBar}>
                                                            <View
                                                                style={[
                                                                    styles.modalScoreFill,
                                                                    {
                                                                        width: `${(selectedReport.check.fact_score || 0) * 100}%`,
                                                                        backgroundColor: '#4CAF50'
                                                                    }
                                                                ]}
                                                            />
                                                        </View>
                                                        <Text style={styles.modalScoreValue}>
                                                            {((selectedReport.check.fact_score || 0) * 100).toFixed(0)}%
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>

                                            <View style={styles.modalAiRecommendation}>
                                                <Text style={styles.modalAiRecommendationLabel}>Recommended Action</Text>
                                                <Text style={styles.modalAiRecommendationValue}>
                                                    {selectedReport.check.recommended_action?.toUpperCase() || 'REVIEW'}
                                                </Text>
                                            </View>
                                        </View>
                                    </>
                                )}

                                {/* Resolution Notes */}
                                <Text style={styles.modalSectionTitle}>Resolution Notes</Text>
                                <TextInput
                                    style={styles.modalNotesInput}
                                    placeholder="Add internal notes about this decision..."
                                    placeholderTextColor="#666"
                                    multiline
                                    value={resolutionNotes}
                                    onChangeText={setResolutionNotes}
                                />
                            </ScrollView>

                            {/* Action Buttons */}
                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.modalActionButton, styles.modalActionDismiss]}
                                    onPress={() => handleResolve('dismiss')}
                                    disabled={isResolving}
                                >
                                    <Ionicons name="close-circle" size={20} color="#999" />
                                    <Text style={styles.modalActionDismissText}>Dismiss</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalActionButton, styles.modalActionWarn]}
                                    onPress={() => handleResolve('warn')}
                                    disabled={isResolving}
                                >
                                    <Ionicons name="warning" size={20} color="#FF9800" />
                                    <Text style={[styles.modalActionText, { color: '#FF9800' }]}>Warn</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalActionButton, styles.modalActionSuspend]}
                                    onPress={() => handleResolve('suspend')}
                                    disabled={isResolving}
                                >
                                    <Ionicons name="timer" size={20} color="#F44336" />
                                    <Text style={[styles.modalActionText, { color: '#F44336' }]}>Suspend</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalActionButton, styles.modalActionBan]}
                                    onPress={() => handleResolve('ban')}
                                    disabled={isResolving}
                                >
                                    <Ionicons name="skull" size={20} color="#000" />
                                    <Text style={[styles.modalActionText, { color: '#000' }]}>Ban</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </MotiView>
            </BlurView>
        </Modal>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Moderation Panel</Text>
                    <Text style={styles.headerSubtitle}>
                        {filteredReports.length} pending {filteredReports.length === 1 ? 'report' : 'reports'}
                    </Text>
                </View>
                <TouchableOpacity onPress={fetchReports} style={styles.refreshButton}>
                    <Ionicons name="refresh" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search reports by ID, category, or reporter..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery !== '' && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowFilters(!showFilters)}>
                    <Ionicons name="options-outline" size={18} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
            </View>

            {/* Filter Bar */}
            {showFilters && (
                <MotiView
                    from={{ opacity: 0, translateY: -10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    style={styles.filterBar}
                >
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                            <TouchableOpacity
                                key={key}
                                style={[
                                    styles.filterChip,
                                    filterSeverity === key && { backgroundColor: config.bg, borderColor: config.color }
                                ]}
                                onPress={() => setFilterSeverity(filterSeverity === key ? null : key)}
                            >
                                <Ionicons name={config.icon as any} size={12} color={config.color} />
                                <Text style={[styles.filterChipText, { color: config.color }]}>{config.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </MotiView>
            )}

            {/* Tabs */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsScroll}
                contentContainerStyle={styles.tabsContainer}
            >
                {tabsWithCounts.map((tab) => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[
                            styles.tab,
                            activeTab === tab.id && styles.tabActive
                        ]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Ionicons
                            name={tab.icon as any}
                            size={16}
                            color={activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.6)'}
                        />
                        <Text style={[
                            styles.tabText,
                            activeTab === tab.id && styles.tabTextActive
                        ]}>
                            {tab.label}
                        </Text>
                        {tab.count > 0 && (
                            <View style={styles.tabBadge}>
                                <Text style={styles.tabBadgeText}>{tab.count}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Reports List */}
            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loaderText}>Loading reports...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredReports}
                    keyExtractor={(item) => item.report_id}
                    renderItem={({ item, index }) => <ReportCard report={item} index={index} />}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchReports();
                            }}
                            tintColor="#fff"
                        />
                    }
                    ListEmptyComponent={
                        <MotiView
                            from={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={styles.emptyContainer}
                        >
                            <View style={styles.emptyIcon}>
                                <Ionicons name="shield-checkmark" size={60} color="rgba(255,255,255,0.2)" />
                            </View>
                            <Text style={styles.emptyTitle}>All Clear</Text>
                            <Text style={styles.emptyText}>
                                No {activeTab === 'my' ? 'assigned' : ''} reports found
                            </Text>
                        </MotiView>
                    }
                />
            )}

            {/* Resolution Modal */}
            <ResolutionModal />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    refreshButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 12,
        paddingHorizontal: 15,
        paddingVertical: Platform.OS === 'ios' ? 12 : 8,
        borderRadius: 30,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        outlineStyle: 'none',
    },
    filterBar: {
        marginHorizontal: 20,
        marginBottom: 12,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '500',
    },
    tabsScroll: {
        maxHeight: 50,
    },
    tabsContainer: {
        paddingHorizontal: 20,
        gap: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 25,
        gap: 6,
    },
    tabActive: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    tabText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#fff',
    },
    tabBadge: {
        backgroundColor: '#F44336',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 4,
    },
    tabBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
        paddingTop: 12,
    },
    cardContainer: {
        marginBottom: 16,
    },
    cardTouchable: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    cardGradient: {
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    severityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    severityText: {
        fontSize: 10,
        fontWeight: '700',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
    },
    reportDate: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        marginLeft: 'auto',
    },
    typeIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 6,
    },
    typeText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    targetContentCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        gap: 12,
    },
    targetMedia: {
        width: 80,
        height: 80,
        borderRadius: 8,
    },
    targetMediaSmall: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    targetAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    targetAvatarLarge: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    targetTextContent: {
        flex: 1,
    },
    targetUsername: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    targetCaption: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 16,
    },
    targetBio: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 4,
    },
    targetMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    targetMetaText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
    },
    targetContext: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 4,
        fontStyle: 'italic',
    },
    commentAuthor: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    reportDetails: {
        marginBottom: 12,
    },
    categoryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
        flexWrap: 'wrap',
    },
    categoryText: {
        fontSize: 12,
        color: '#FF9800',
        fontWeight: '500',
    },
    subcategoryText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
    },
    reportDescription: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 18,
        marginBottom: 8,
    },
    reporterInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    reporterAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    reporterName: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
    },
    aiSection: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    aiScoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    aiScoreLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        width: 70,
    },
    aiScoreBar: {
        flex: 1,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    aiScoreFill: {
        height: '100%',
        borderRadius: 2,
    },
    aiScoreValue: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.6)',
        width: 35,
        textAlign: 'right',
    },
    aiTags: {
        flexDirection: 'row',
        gap: 8,
    },
    aiTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    aiTagText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    assignButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1DA1F2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    assignButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    assignedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    assignedText: {
        fontSize: 11,
        color: '#4CAF50',
    },
    detailButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    detailButtonText: {
        fontSize: 12,
        color: '#1DA1F2',
        fontWeight: '600',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        marginTop: 12,
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#1a1a2e',
        borderRadius: 30,
        width: Math.min(width - 40, 500),
        maxHeight: height * 0.9,
        padding: 20,
        ...createShadow({
            width: 0,
            height: 10,
            opacity: 0.3,
            radius: 20,
            elevation: 10,
        }),
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    modalIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    modalId: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    modalStatusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    modalStatusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    modalSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginTop: 16,
        marginBottom: 12,
    },
    modalContentCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 12,
    },
    modalReporterCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 12,
        gap: 12,
    },
    modalReporterAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    modalReporterName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    modalReporterDate: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    modalDescriptionCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 12,
    },
    modalCategoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
        flexWrap: 'wrap',
    },
    modalCategory: {
        fontSize: 13,
        color: '#FF9800',
        fontWeight: '500',
    },
    modalSubcategory: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
    },
    modalDescription: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 20,
    },
    modalAiCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 12,
    },
    modalScoreGrid: {
        marginBottom: 12,
    },
    modalScoreItem: {
        marginBottom: 12,
    },
    modalScoreLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 4,
    },
    modalScoreBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modalScoreBar: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    modalScoreFill: {
        height: '100%',
        borderRadius: 3,
    },
    modalScoreValue: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        width: 40,
        textAlign: 'right',
    },
    modalAiRecommendation: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    modalAiRecommendationLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 4,
    },
    modalAiRecommendationValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1DA1F2',
    },
    modalNotesInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 12,
        color: '#fff',
        fontSize: 14,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    modalActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 20,
    },
    modalActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 16,
        gap: 6,
        borderWidth: 1,
    },
    modalActionDismiss: {
        borderColor: '#999',
        backgroundColor: 'rgba(153,153,153,0.1)',
    },
    modalActionDismissText: {
        color: '#999',
        fontSize: 13,
        fontWeight: '600',
    },
    modalActionWarn: {
        borderColor: '#FF9800',
        backgroundColor: 'rgba(255,152,0,0.1)',
    },
    modalActionSuspend: {
        borderColor: '#F44336',
        backgroundColor: 'rgba(244,67,54,0.1)',
    },
    modalActionBan: {
        borderColor: '#000',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    modalActionText: {
        fontSize: 13,
        fontWeight: '600',
    },
});