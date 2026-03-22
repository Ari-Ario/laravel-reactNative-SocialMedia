// app/moderation/index.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { useToastStore } from '@/stores/toastStore';
import AuthContext from '@/context/AuthContext';
import getApiBaseImage from '@/services/getApiBaseImage';
import { Avatar } from '@/components/ui/Avatar';
import StoryViewer from '@/components/StoryViewer';
import ProfilePreview from '@/components/ProfilePreview';

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
    reviewing: { color: '#2196F3', bg: '#2196F320', label: 'In Review', icon: 'eye' },
    in_review: { color: '#2196F3', bg: '#2196F320', label: 'In Review', icon: 'eye' },
    resolved: { color: '#4CAF50', bg: '#4CAF5020', label: 'Resolved', icon: 'checkmark-circle' },
    dismissed: { color: '#9E9E9E', bg: '#9E9E9E20', label: 'Dismissed', icon: 'close-circle' },
};

function ModerationPanel() {
    const insets = useSafeAreaInsets();
    const { user } = React.useContext(AuthContext);
    const { showToast } = useToastStore();

    const { returnTo } = useLocalSearchParams();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [isResolving, setIsResolving] = useState(false);
    const [activeMainTab, setActiveMainTab] = useState<'all' | 'my'>('all');
    const [activeTypeTab, setActiveTypeTab] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [assignedReports, setAssignedReports] = useState<Set<string>>(new Set());
    const [viewerTarget, setViewerTarget] = useState<{ type: string; id: any; data?: any } | null>(null);

    const scrollY = useRef(new Animated.Value(0)).current;

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

    // Filter reports based on active tabs, search, and severity
    const filteredReports = useMemo(() => {
        let filtered = [...reports];

        // Main Tab (All vs My Cases)
        if (activeMainTab === 'my') {
            filtered = filtered.filter(r => assignedReports.has(r.report_id) || r.assigned_to?.id === user?.id);
        }

        // Type filtering
        if (activeTypeTab !== 'all') {
            const tabType = TABS.find(t => t.id === activeTypeTab)?.type;
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

        // Sort: by type first if in My Cases, then by severity and date
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const typeOrder = { post: 0, story: 1, space: 2, comment: 3, profile: 4 };

        return filtered.sort((a, b) => {
            if (activeMainTab === 'my') {
                if (typeOrder[a.target_type] !== typeOrder[b.target_type]) {
                    return typeOrder[a.target_type] - typeOrder[b.target_type];
                }
            }
            if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                return severityOrder[a.severity] - severityOrder[b.severity];
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [reports, activeMainTab, activeTypeTab, filterSeverity, searchQuery, assignedReports, user]);

    // Update tab counts based on selection
    const tabsWithCounts = useMemo(() => {
        const counts: Record<string, number> = {};

        reports.forEach(report => {
            const isMine = assignedReports.has(report.report_id) || report.assigned_to?.id === user?.id;

            // Increment type counts based on whether we are in "All" or "My" view
            if (activeMainTab === 'all' || (activeMainTab === 'my' && isMine)) {
                counts.all = (counts.all || 0) + 1;
                const typeKey = report.target_type === 'story' ? 'stories' : `${report.target_type}s`;
                counts[typeKey] = (counts[typeKey] || 0) + 1;
            }

            // Always track My Cases overall count
            if (isMine) {
                counts.my = (counts.my || 0) + 1;
            }
        });

        // Current All total
        counts.all_reports = reports.length;

        return TABS.map(tab => ({
            ...tab,
            count: counts[tab.id] || 0
        }));
    }, [reports, assignedReports, activeMainTab, user]);

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

    const { setProfilePreviewVisible, setProfileViewUserId } = require('@/context/ProfileViewContext').useProfileView();

    const handleNavigateToTarget = (report: Report) => {
        const target = report.target_data;
        if (!target) return;

        switch (report.target_type) {
            case 'post':
                router.replace({
                    pathname: `/post/${target.id}` as any,
                    params: { returnTo: '/moderation' }
                });
                break;
            case 'comment':
                router.replace({
                    pathname: `/post/${target.post_id || target.post?.id}` as any,
                    params: { returnTo: '/moderation', highlightCommentId: target.id }
                });
                break;
            case 'profile':
                setProfileViewUserId(String(target.id));
                setProfilePreviewVisible(true);
                setViewerTarget({ type: 'profile', id: target.id, data: target });
                break;
            case 'story':
                router.replace({
                    pathname: `/story/${target.id}` as any,
                    params: { returnTo: '/moderation' }
                });
                break;
            case 'space':
                router.replace({
                    pathname: `/(spaces)/${target.id}` as any,
                    params: { returnTo: '/moderation' }
                });
                break;
        }
    };

    const renderTargetContent = (report: Report) => {
        const target = report.target_data;
        if (!target) {
            return (
                <View style={[styles.targetContentCard, { borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.4)" />
                        <Text style={[styles.targetCaption, { color: 'rgba(255,255,255,0.4)' }]}>Content not available or deleted</Text>
                    </View>
                </View>
            );
        }

        switch (report.target_type) {
            case 'post':
                return (
                    <View style={styles.targetContentCard}>
                        <View style={styles.contentHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Avatar user={target.user} size={32} />
                                <View>
                                    <Text style={styles.targetUsername}>{target.user?.name || 'User'}</Text>
                                    <Text style={[styles.targetHandle, { fontSize: 11 }]}>@{target.user?.username || 'user'}</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={styles.typeTag}>
                                    <Text style={styles.typeTagText}>POST</Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.viewButton}
                                    onPress={() => handleNavigateToTarget(report)}
                                >
                                    <Ionicons name="eye" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {target.media && target.media.length > 0 && (
                            <View style={styles.mediaPreviewContainer}>
                                <Image
                                    source={{ uri: `${getApiBaseImage()}/storage/${target.media[0].path || target.media[0].file_path}` }}
                                    style={styles.targetMedia}
                                    resizeMode="cover"
                                />
                                {target.media.length > 1 && (
                                    <View style={styles.mediaCountBadge}>
                                        <Ionicons name="images" size={14} color="#fff" />
                                        <Text style={styles.mediaCountText}>+{target.media.length - 1}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        <View style={styles.targetTextContent}>
                            {(target.content || target.caption) ? (
                                <Text style={[styles.targetCaption, { color: '#fff' }]} numberOfLines={10}>
                                    {target.content || target.caption}
                                </Text>
                            ) : null}
                            
                            <View style={styles.targetStats}>
                                <View style={styles.statItem}>
                                    <Ionicons name="heart-outline" size={12} color="rgba(255,255,255,0.6)" />
                                    <Text style={styles.statText}>{target.reactions_count || 0}</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Ionicons name="chatbubble-outline" size={12} color="rgba(255,255,255,0.6)" />
                                    <Text style={styles.statText}>{target.comments_count || 0}</Text>
                                </View>
                                <Text style={styles.targetDate}>
                                    {new Date(target.created_at).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                    </View>
                );

            case 'comment':
                return (
                    <View style={styles.targetContentCard}>
                        <View style={styles.contentHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Avatar user={target.user} size={32} />
                                <View>
                                    <Text style={styles.targetUsername}>{target.user?.name || 'User'}</Text>
                                    <Text style={styles.targetHandle}>@{target.user?.username || 'user'}</Text>
                                </View>
                            </View>
                             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[styles.typeTag, { backgroundColor: '#2196F340' }]}>
                                    <Text style={[styles.typeTagText, { color: '#2196F3' }]}>COMMENT</Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.viewButton}
                                    onPress={() => handleNavigateToTarget(report)}
                                >
                                    <Ionicons name="eye" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.commentBody}>
                            <Text style={styles.targetCaption}>{target.content}</Text>
                        </View>

                        {target.post && (
                            <View style={styles.parentContext}>
                                <Text style={styles.contextLabel}>ON POST:</Text>
                                <View style={styles.contextPreview}>
                                    {target.post.media?.[0] && (
                                        <Image
                                            source={{ uri: `${getApiBaseImage()}/storage/${target.post.media[0].path || target.post.media[0].file_path}` }}
                                            style={styles.contextMedia}
                                            resizeMode="cover"
                                        />
                                    )}
                                    <Text style={styles.contextText} numberOfLines={2}>
                                        {target.post.content || target.post.caption || 'Media Post'}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                );

            case 'profile':
                return (
                    <View style={styles.targetContentCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                            <Avatar user={target} size={70} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.targetUsername}>{target.name}</Text>
                                <Text style={styles.targetHandle}>@{target.username}</Text>
                                <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={[styles.typeTag, { backgroundColor: '#9C27B040' }]}>
                                            <Text style={[styles.typeTagText, { color: '#9C27B0' }]}>PROFILE</Text>
                                        </View>
                                        <TouchableOpacity 
                                            style={styles.viewButton}
                                            onPress={() => handleNavigateToTarget(report)}
                                        >
                                            <Ionicons name="eye" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                        
                        <View style={[styles.targetStats, { marginTop: 15, justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 12 }]}>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={styles.statNumber}>{target.followers_count || 0}</Text>
                                <Text style={styles.statLabel}>Followers</Text>
                            </View>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={styles.statNumber}>{target.following_count || 0}</Text>
                                <Text style={styles.statLabel}>Following</Text>
                            </View>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={styles.statNumber}>{target.posts_count || 0}</Text>
                                <Text style={styles.statLabel}>Posts</Text>
                            </View>
                        </View>
                    </View>
                );

            case 'story':
                return (
                    <View style={styles.targetContentCard}>
                        <View style={styles.contentHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Avatar user={target.user} size={32} />
                                <View>
                                    <Text style={styles.targetUsername}>{target.user?.name || 'User'}</Text>
                                    <View style={styles.storyMeta}>
                                        <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.4)" />
                                        <Text style={styles.targetDate}>
                                            {target.expires_at ? `Expires ${new Date(target.expires_at).toLocaleTimeString()}` : 'Story'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[styles.typeTag, { backgroundColor: '#FF980040' }]}>
                                    <Text style={[styles.typeTagText, { color: '#FF9800' }]}>STORY</Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.viewButton}
                                    onPress={() => handleNavigateToTarget(report)}
                                >
                                    <Ionicons name="eye" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {target.media_path && (
                            <View style={styles.mediaPreviewContainer}>
                                <Image
                                    source={{ uri: `${getApiBaseImage()}/storage/${target.media_path}` }}
                                    style={styles.targetMedia}
                                    resizeMode="cover"
                                />
                            </View>
                        )}
                        
                        {target.caption && (
                            <Text style={[styles.targetCaption, { marginTop: 8 }]}>{target.caption}</Text>
                        )}
                    </View>
                );

            case 'space':
                return (
                    <View style={styles.targetContentCard}>
                        <View style={styles.contentHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={styles.spaceIconContainer}>
                                    <Ionicons name="mic" size={20} color="#fff" />
                                </View>
                                <View>
                                    <Text style={styles.targetUsername}>{target.title || 'Live Space'}</Text>
                                    <Text style={styles.targetHandle}>by @{target.creator?.username || 'user'}</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[styles.typeTag, { backgroundColor: '#4CAF5040' }]}>
                                    <Text style={[styles.typeTagText, { color: '#4CAF50' }]}>SPACE</Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.viewButton}
                                    onPress={() => handleNavigateToTarget(report)}
                                >
                                    <Ionicons name="eye" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.spaceMetaRow}>
                            <View style={styles.statItem}>
                                <Ionicons name="people" size={14} color="rgba(255,255,255,0.6)" />
                                <Text style={styles.statText}>{target.participants_count || 0} listening</Text>
                            </View>
                            {target.is_live && (
                                <View style={[styles.liveBadge, { backgroundColor: '#F4433620' }]}>
                                    <View style={[styles.liveDot, { backgroundColor: '#F44336' }]} />
                                    <Text style={[styles.liveText, { color: '#F44336' }]}>LIVE</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );

            default:
                return (
                    <View style={[styles.targetContentCard, styles.emptyTarget]}>
                        <Ionicons name="alert-circle-outline" size={24} color="rgba(255,255,255,0.3)" />
                        <Text style={styles.emptyTargetText}>Content not available or deleted</Text>
                    </View>
                );
        }
    };

    const renderAiScore = (report: any) => {
        const check = report.check || report.ai_check_results;
        if (!check) return null;

        const confidence = check.ai_confidence || check.malicious_intent_score || 0;
        const color = confidence > 0.7 ? '#F44336' : confidence > 0.4 ? '#FF9800' : '#4CAF50';

        return (
            <View style={styles.aiSection}>
                <View style={styles.aiScoreRow}>
                    <Text style={styles.aiScoreLabel}>AI Confidence</Text>
                    <View style={styles.aiScoreBar}>
                        <View
                            style={[
                                styles.aiScoreFill,
                                {
                                    width: `${confidence * 100}%`,
                                    backgroundColor: color
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.aiScoreValue}>
                        {(confidence * 100).toFixed(0)}%
                    </Text>
                </View>
                <View style={styles.aiTags}>
                    {(check.malicious_intent_score > 0.7 || check.ai_confidence > 0.7) && (
                        <View style={[styles.aiTag, { backgroundColor: 'rgba(244, 67, 54, 0.15)', borderColor: 'rgba(244, 67, 54, 0.3)', borderWidth: 1 }]}>
                            <Ionicons name="warning" size={10} color="#F44336" />
                            <Text style={[styles.aiTagText, { color: '#F44336', fontWeight: '800' }]}>High Risk</Text>
                        </View>
                    )}
                    {check.fact_score < 0.3 && check.fact_score !== undefined && (
                        <View style={[styles.aiTag, { backgroundColor: 'rgba(255, 152, 0, 0.15)', borderColor: 'rgba(255, 152, 0, 0.3)', borderWidth: 1 }]}>
                            <Ionicons name="help-circle" size={10} color="#FF9800" />
                            <Text style={[styles.aiTagText, { color: '#FF9800', fontWeight: '800' }]}>Unverified</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const ReportCard = ({ report, index }: { report: Report; index: number }) => {
        const severity = SEVERITY_CONFIG[report.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.low;
        const status = STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
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
                        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
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
                                {new Date(report.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
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
                                <Avatar
                                    user={report.reporter}
                                    size={24}
                                />
                                <Text style={styles.reporterName}>Reported by {report.reporter?.name || 'Anonymous'}</Text>
                            </View>
                        </View>

                        {/* AI Score */}
                        {renderAiScore(report)}

                        {/* Action Buttons */}
                        <View style={styles.cardActions}>
                            {report.status === 'pending' || report.status === 'in_review' ? (
                                !isAssigned && !report.assigned_to ? (
                                    <TouchableOpacity
                                        style={styles.assignButton}
                                        onPress={() => handleAssign(report.report_id)}
                                    >
                                        <Ionicons name="hand-right" size={16} color="#fff" />
                                        <Text style={styles.assignButtonText}>Take Report</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View style={[styles.moderatorBadge, isAssigned && styles.moderatorBadgeMine]}>
                                        <Ionicons
                                            name={isAssigned ? "checkmark-done-circle" : "person"}
                                            size={14}
                                            color={isAssigned ? "#4CAF50" : "#1DA1F2"}
                                        />
                                        <Text style={[styles.moderatorName, isAssigned && styles.moderatorNameMine]}>
                                            {isAssigned ? "Yours" : `Moderator: ${report.assigned_to?.name}`}
                                        </Text>
                                    </View>
                                )
                            ) : null}

                            <TouchableOpacity
                                style={styles.reviewButton}
                                onPress={() => setSelectedReport(report)}
                            >
                                <Text style={styles.reviewButtonText}>View Details →</Text>
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

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => {
                        if (returnTo) {
                            router.replace(returnTo as any);
                        } else {
                            router.back();
                        }
                    }} 
                    style={styles.backButton}
                >
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

            {/* Sticky Header: Search, Main Toggle, and Sub-Tabs */}
            <View style={styles.stickyHeader}>
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

                {/* Main Toggle (All / My Case) */}
                <View style={styles.mainToggleContainer}>
                    <TouchableOpacity
                        style={[styles.mainToggleBtn, activeMainTab === 'all' && styles.mainToggleBtnActive]}
                        onPress={() => setActiveMainTab('all')}
                    >
                        <Ionicons name="apps" size={14} color={activeMainTab === 'all' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                        <Text style={[styles.mainToggleText, activeMainTab === 'all' && styles.mainToggleTextActive]}>
                            All Reports ({tabsWithCounts.find(t => t.id === 'all')?.count || 0})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.mainToggleBtn, activeMainTab === 'my' && styles.mainToggleBtnActive]}
                        onPress={() => setActiveMainTab('my')}
                    >
                        <Ionicons name="person" size={14} color={activeMainTab === 'my' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                        <Text style={[styles.mainToggleText, activeMainTab === 'my' && styles.mainToggleTextActive]}>
                            My Cases ({tabsWithCounts.find(t => t.id === 'my')?.count || 0})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Sub-Tabs (Types) */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.typeTabsScroll}
                    contentContainerStyle={styles.typeTabsContainer}
                >
                    {tabsWithCounts.filter(t => t.id !== 'all' && t.id !== 'my').map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[
                                styles.typeTab,
                                activeTypeTab === tab.id && styles.typeTabActive
                            ]}
                            onPress={() => setActiveTypeTab(tab.id === activeTypeTab ? 'all' : tab.id)}
                        >
                            <Ionicons
                                name={tab.icon as any}
                                size={16}
                                color={activeTypeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.6)'}
                            />
                            <Text style={[
                                styles.typeTabText,
                                activeTypeTab === tab.id && styles.typeTabTextActive
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
            </View>

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
                                No {activeMainTab === 'my' ? 'assigned' : ''} reports found
                            </Text>
                        </MotiView>
                    }
                />
            )}

            {/* Resolution Modal */}
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
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalTitle}>Report Review</Text>
                                        <Text style={styles.modalId}>#{selectedReport.report_id}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <TouchableOpacity
                                            style={[styles.viewButton, { width: 36, height: 36, borderRadius: 18 }]}
                                            onPress={() => handleNavigateToTarget(selectedReport)}
                                        >
                                            <Ionicons name="eye" size={20} color="#fff" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.closeButton}
                                            onPress={() => setSelectedReport(null)}
                                        >
                                            <Ionicons name="close" size={24} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                                    {/* Status Section */}
                                    <View style={styles.modalIdRow}>
                                        <View style={[styles.modalStatusBadge, { backgroundColor: STATUS_CONFIG[selectedReport.status].bg }]}>
                                            <Text style={[styles.modalStatusText, { color: STATUS_CONFIG[selectedReport.status].color }]}>
                                                {STATUS_CONFIG[selectedReport.status].label}
                                            </Text>
                                        </View>
                                        <Text style={styles.modalDate}>
                                            {new Date(selectedReport.created_at).toLocaleString()}
                                        </Text>
                                    </View>

                                    {/* Reported Content Section */}
                                    <Text style={styles.modalSectionTitle}>Reported Content</Text>
                                    <View style={styles.modalContentCard}>
                                        {renderTargetContent(selectedReport)}
                                    </View>

                                    {/* Reporter Info */}
                                    <Text style={styles.modalSectionTitle}>Reporter Details</Text>
                                    <View style={styles.modalReporterCard}>
                                        <Avatar
                                            user={selectedReport.reporter}
                                            size={40}
                                            style={styles.modalReporterAvatar}
                                        />
                                        <View>
                                            <Text style={styles.modalReporterName}>{selectedReport.reporter?.name || 'Anonymous'}</Text>
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

                                    {/* Action Buttons Section */}
                                    <Text style={styles.modalSectionTitle}>Take Action</Text>
                                    <View style={styles.actionDescriptions}>
                                        <Text style={styles.actionDescText}><Text style={{fontWeight:'700', color:'#999'}}>Dismiss:</Text> Close without action. No penalty for target.</Text>
                                        <Text style={styles.actionDescText}><Text style={{fontWeight:'700', color:'#FF9800'}}>Warn:</Text> Send a formal warning to the user.</Text>
                                        <Text style={styles.actionDescText}><Text style={{fontWeight:'700', color:'#F44336'}}>Suspend:</Text> Temporary 24h ban from all features.</Text>
                                        <Text style={styles.actionDescText}><Text style={{fontWeight:'700', color:'#fff'}}>Ban:</Text> Permanent removal from the platform.</Text>
                                    </View>

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
                                            style={[styles.modalActionButton, { backgroundColor: '#000', borderColor: '#FF453A', borderWidth: 1 }]}
                                            onPress={() => handleResolve('ban')}
                                            disabled={isResolving}
                                        >
                                            <Ionicons name="skull" size={20} color="#FF453A" />
                                            <Text style={[styles.modalActionText, { color: '#FF453A' }]}>Ban</Text>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </>
                        )}
                    </MotiView>
                </BlurView>
            </Modal>

            {/* Story Viewer Modal - Removed as we now use routing for stories */}

            {/* Profile Preview Modal */}
            {viewerTarget?.type === 'profile' && (
                <ProfilePreview
                    userId={String(viewerTarget.id)}
                    visible={true}
                    onClose={() => setViewerTarget(null)}
                />
            )}
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
    filterChipActive: {
        backgroundColor: 'rgba(29, 161, 242, 0.15)',
        borderColor: '#1DA1F2',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.6)',
    },
    filterChipTextActive: {
        color: '#1DA1F2',
    },
    mainToggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 25,
        padding: 4,
        height: 48,
    },
    mainToggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        gap: 6,
        height: '100%',
    },
    mainToggleBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    mainToggleText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '500',
    },
    mainToggleTextActive: {
        color: '#fff',
        fontWeight: '700',
    },
    typeTabsScroll: {
        paddingHorizontal: 0,
        marginBottom: 20,
        height: 40,
    },
    typeTab: {
        paddingHorizontal: 16,
        height: 36,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        marginRight: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        gap: 6,
    },
    typeTabActive: {
        backgroundColor: '#1DA1F2',
    },
    typeTabText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
    },
    typeTabTextActive: {
        color: '#fff',
    },

    stickyHeader: {
        backgroundColor: '#000', // Solid background to prevent cards showing through
        paddingBottom: 8,
        zIndex: 10,
        elevation: 10, // For Android
    },
    typeTabsContainer: {
        paddingHorizontal: 20,
        gap: 8,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 8,
    },
    reportCard: {
        backgroundColor: '#161616',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    reportHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    reportId: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.3)',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    reasonBadge: {
        backgroundColor: 'rgba(255,152,0,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    reasonText: {
        color: '#FF9800',
        fontSize: 11,
        fontWeight: '600',
    },
    targetContentCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
    },
    targetMediaContainer: {
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    targetMedia: {
        width: '100%',
        height: 200,
        resizeMode: 'cover',
    },
    mediaCountBadge: {
        position: 'absolute',
        right: 12,
        bottom: 12,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    mediaCountText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    targetTextContent: {
        gap: 8,
    },
    targetCaption: {
        color: '#fff',
        fontSize: 14,
        lineHeight: 20,
    },
    targetStats: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 4,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
    },
    commentAuthor: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    targetAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    targetUsername: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    replyingTo: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
    },
    commentBody: {
        paddingLeft: 42,
    },
    postContext: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    targetContext: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        fontStyle: 'italic',
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        marginBottom: 12,
    },
    targetAvatarLarge: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    profileInfo: {
        flex: 1,
    },
    targetUsernameLarge: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
    },
    targetHandle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
    },
    profileBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    adminBadge: {
        backgroundColor: 'rgba(244,67,54,0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    adminBadgeText: {
        color: '#F44336',
        fontSize: 10,
        fontWeight: '700',
    },
    targetBio: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 18,
        marginBottom: 12,
    },
    profileStatsRow: {
        flexDirection: 'row',
        gap: 20,
    },
    profileStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    profileStatValue: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    profileStatLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
    },
    storyPreview: {
        width: '100%',
        height: 300,
        borderRadius: 16,
        overflow: 'hidden',
    },
    viewButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    storyImage: {
        width: '100%',
        height: '100%',
    },
    storyOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 15,
        justifyContent: 'space-between',
    },
    spaceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    spaceTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
        flex: 1,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F44336',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    liveText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
    },
    spaceHost: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    hostAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    hostName: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
    },
    spaceStats: {
        flexDirection: 'row',
        gap: 15,
        marginTop: 12,
    },
    reportFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    reporterInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
    reportDate: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.3)',
    },
    actionSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
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
    moderatorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(29, 161, 242, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        gap: 4,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        // padding: 20,
    },
    modalContainer: {
        backgroundColor: '#1a1a2e',
        borderRadius: 30,
        width: '100%',
        maxHeight: '85%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        ...Platform.select({
            web: {
                maxWidth: 1440,
                maxHeight: '90%',
            },
        }),
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: 'rgba(255,255,255,0.03)',
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
    modalDate: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
    },
    modalSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginTop: 20,
        marginBottom: 12,
        marginHorizontal: 20,
        textTransform: 'uppercase',
        letterSpacing: 1,
        opacity: 0.6,
    },
    modalContentCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        marginHorizontal: 20,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalReporterCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        marginHorizontal: 20,
        padding: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalReporterAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    modalReporterName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    modalReporterDate: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 2,
    },
    modalDescriptionCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        marginHorizontal: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalCategoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
    },
    modalCategory: {
        fontSize: 14,
        color: '#FF9800',
        fontWeight: '600',
    },
    modalSubcategory: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
    },
    modalDescription: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 22,
    },
    modalAiCard: {
        backgroundColor: 'rgba(29,161,242,0.08)',
        borderRadius: 16,
        marginHorizontal: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(29,161,242,0.2)',
    },
    modalScoreGrid: {
        gap: 16,
    },
    modalScoreItem: {
        gap: 8,
    },
    modalScoreLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
    },
    modalScoreBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalScoreBar: {
        flex: 1,
        height: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    modalScoreFill: {
        height: '100%',
        borderRadius: 4,
    },
    modalScoreValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
        width: 45,
    },
    modalAiRecommendation: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    modalAiRecommendationLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    modalAiRecommendationValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1DA1F2',
    },
    modalNotesInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        marginHorizontal: 20,
        padding: 16,
        color: '#fff',
        fontSize: 15,
        minHeight: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 20,
    },
    modalActionText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
    modalActions: {
        flexDirection: 'row',
        padding: 20,
        gap: 8,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    modalActionButton: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
    },
    modalActionDismiss: {
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    modalActionDismissText: {
        color: '#fff',
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
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    actionDescriptions: {
        marginHorizontal: 20,
        marginBottom: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        gap: 6,
    },
    actionDescText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        lineHeight: 18,
    },
    // Card styles
    cardContainer: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 20,
        overflow: 'hidden',
    },
    cardTouchable: {
        borderRadius: 20,
    },
    cardGradient: {
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    severityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    severityText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    typeIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    typeText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
    },
    reportDetails: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
    },
    categoryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    categoryText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FF9800',
    },
    subcategoryText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    reportDescription: {
        fontSize: 14,
        color: '#fff',
        lineHeight: 20,
        marginBottom: 12,
    },
    aiSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    aiScoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    aiScoreLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        width: 80,
    },
    aiScoreBar: {
        flex: 1,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
    },
    aiScoreFill: {
        height: '100%',
        borderRadius: 2,
    },
    aiScoreValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
        width: 35,
    },
    aiTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    aiTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    aiTagText: {
        fontSize: 10,
        fontWeight: '600',
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    reviewButton: {
        paddingVertical: 6,
    },
    reviewButtonText: {
        color: '#1DA1F2',
        fontSize: 13,
        fontWeight: '700',
    },
    moderatorBadgeMine: {
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    moderatorName: {
        fontSize: 10,
        color: '#1DA1F2',
        fontWeight: '600',
    },
    moderatorNameMine: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '600',
    },
    contentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    miniAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    targetMediaStory: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    storyAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#1DA1F2',
    },
    targetMetaText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    spaceIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    spaceInfo: {
        marginLeft: 12,
        flex: 1,
    },
    spaceMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginTop: 8,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 4,
    },
    emptyTarget: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        gap: 10,
    },
    emptyTargetText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.3)',
    },
    tabBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 6,
    },
    tabBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    targetAvatarLarge: {
        width: 70,
        height: 70,
        borderRadius: 35,
    },
    parentContext: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    contextLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.4)',
        marginBottom: 8,
    },
    contextPreview: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 8,
        borderRadius: 8,
        gap: 10,
        alignItems: 'center',
    },
    mediaPreviewContainer: {
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 8,
    },
    storyMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    contextMedia: {
        width: 40,
        height: 40,
        borderRadius: 4,
    },
    contextText: {
        flex: 1,
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        fontStyle: 'italic',
    },
    targetAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    targetDate: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
    },
    statNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    statLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
    },
    typeTag: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    typeTagText: {
        fontSize: 10,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 0.5,
    },
});

export default ModerationPanel;