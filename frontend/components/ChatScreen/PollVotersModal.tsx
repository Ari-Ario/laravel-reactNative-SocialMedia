// components/ChatScreen/PollVotersModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Alert,
    Share,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    SlideInDown,
    SlideOutDown,
    FadeIn,
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    interpolate,
    Extrapolate,
    SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Avatar from '@/components/Image/Avatar';
import { useRouter } from 'expo-router';
import { safeHaptics } from '@/utils/haptics';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';
import { GlobalStyles } from '@/styles/GlobalStyles';
import AddStory from '@/components/AddStory';
import CreatePost from '@/components/CreatePost';
import { createShadow } from '@/utils/styles';

const { width } = Dimensions.get('window');
const GRID_SIZE = 12;
const GRID_COLS = 8;

interface PollVotersModalProps {
    visible: boolean;
    onClose: () => void;
    poll: any;
    currentUserId: number;
    spaceId: string;
}

// BarItem component remains the same...
const BarItem: React.FC<{ option: any; color: string; maxVotes: number; progress: SharedValue<number>; totalVotes: number; styles: any }> = ({ option, color, maxVotes, progress, totalVotes, styles }) => {
    const percentage = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;
    const animatedBarStyle = useAnimatedStyle(() => ({
        width: `${interpolate(progress.value, [0, 1], [0, (option.voteCount / maxVotes) * 100], Extrapolate.CLAMP)}%`,
    }));
    return (
        <View style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>{option.text}</Text>
            <View style={styles.barContainer}>
                <Animated.View style={[animatedBarStyle, styles.bar]}>
                    <LinearGradient colors={[color, color + 'cc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                </Animated.View>
            </View>
            <View style={styles.barStats}>
                <Text style={styles.barVotes}>{option.voteCount}</Text>
                <Text style={styles.barPercent}>({percentage.toFixed(1)}%)</Text>
            </View>
        </View>
    );
};

const PollVotersModal: React.FC<PollVotersModalProps> = ({
    visible,
    onClose,
    poll,
    currentUserId,
    spaceId,
}) => {
    const { colors: themeColors, activeScheme } = useAppTheme();
    const { t } = useTranslation();
    const styles = getStyles(themeColors, activeScheme);
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'voters' | 'bars' | 'grid'>('voters');
    const [expandedOption, setExpandedOption] = useState<string | null>(null);
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [showPostModal, setShowPostModal] = useState(false);
    const barProgress = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            barProgress.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) });
        } else {
            barProgress.value = 0;
        }
    }, [visible]);

    if (!poll) return null;

    // Process options with voters (Memoized for performance)
    const processedPollData = React.useMemo(() => {
        if (!poll?.options) return { optionsWithVoters: [], totalVotes: 0, maxVotes: 1 };

        const optionsWithVoters = poll.options.map((opt: any) => {
            const voters = opt.voters || [];
            const votes = opt.votes || [];
            const allVoters = [...voters, ...votes.map((v: any) => ({
                userId: v.user_id || v.userId,
                name: v.name || t('user'),
                avatar: v.avatar,
            }))];
            const uniqueVoters = Array.from(new Map(allVoters.map(v => [v.userId, v])).values());
            return {
                ...opt,
                voters: uniqueVoters,
                voteCount: opt.votes?.length || 0,
            };
        }).sort((a: any, b: any) => b.voteCount - a.voteCount);

        const totalVotes = poll.total_votes || 0;
        const maxVotes = Math.max(...optionsWithVoters.map((o: any) => o.voteCount), 1);

        return { optionsWithVoters, totalVotes, maxVotes };
    }, [poll]);

    const { optionsWithVoters, totalVotes, maxVotes } = processedPollData;
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#D4A5A5', '#9B59B6', '#3498DB'];

    const getResultsText = React.useCallback(() => {
        return t('poll_results_title').replace('{question}', poll.question) + '\n\n' +
            optionsWithVoters.map((opt: any) => `${opt.text}: ${opt.voteCount} ${opt.voteCount !== 1 ? t('votes_plural') : t('votes_singular')}`).join('\n') +
            `\n\n${t('total_votes_label').replace('{count}', String(totalVotes))}`;
    }, [poll.question, optionsWithVoters, totalVotes]);

    const toggleOption = (optionId: string) => {
        setExpandedOption(expandedOption === optionId ? null : optionId);
        safeHaptics.impact();
    };

    const renderVotersTab = () => (
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {optionsWithVoters.map((option: any, idx: number) => {
                const isExpanded = expandedOption === option.id;
                const displayVoters = isExpanded ? option.voters : option.voters.slice(0, 3);
                const hasMore = option.voters.length > 3;
                return (
                    <Animated.View key={option.id} entering={FadeIn.delay(idx * 100)} style={styles.optionCard}>
                        <TouchableOpacity style={styles.optionHeader} onPress={() => toggleOption(option.id)} activeOpacity={0.7}>
                            <LinearGradient colors={[colors[idx % colors.length] + '20', colors[idx % colors.length] + '40']} style={styles.rankGradient}>
                                <Text style={[styles.optionRank, { color: colors[idx % colors.length] }]}>#{idx + 1}</Text>
                            </LinearGradient>
                            <View style={styles.optionInfo}>
                                <Text style={styles.optionText} numberOfLines={2}>{option.text}</Text>
                                <View style={styles.optionMeta}>
                                    <View style={[styles.voteCountBadge, { backgroundColor: colors[idx % colors.length] + '20' }]}>
                                        <Ionicons name="people" size={12} color={colors[idx % colors.length]} />
                                        <Text style={[styles.voteCountText, { color: colors[idx % colors.length] }]}>{option.voteCount}</Text>
                                    </View>
                                    {option.voters.length > 0 && (
                                        <Text style={styles.voterPreview}>
                                            {option.voters.slice(0, 2).map((v: any) => v.name).join(', ')}
                                            {option.voters.length > 2 ? ` +${option.voters.length - 2}` : ''}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#999" />
                        </TouchableOpacity>
                        {isExpanded && (
                            <Animated.View entering={FadeIn} style={styles.votersList}>
                                {option.voters.length === 0 ? (
                                    <Text style={styles.noVoters}>{t('no_votes_yet')}</Text>
                                ) : (
                                    displayVoters.map((voter: any) => (
                                        <View key={voter.userId} style={styles.voterItem}>
                                            <Avatar source={voter.avatar} size={32} name={voter.name} />
                                            <Text style={styles.voterName}>{voter.name}{voter.userId === currentUserId && ` (${t('you')})`}</Text>
                                        </View>
                                    ))
                                )}
                                {hasMore && !isExpanded && (
                                    <TouchableOpacity style={styles.viewMore} onPress={() => toggleOption(option.id)}>
                                        <Text style={styles.viewMoreText}>{t('view_all_voters_btn').replace('{count}', String(option.voters.length))}</Text>
                                    </TouchableOpacity>
                                )}
                            </Animated.View>
                        )}
                    </Animated.View>
                );
            })}
        </ScrollView>
    );

    const renderBarChart = () => {
        return (
            <ScrollView style={styles.chartScroll} contentContainerStyle={styles.chartContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.chartTitle}>{t('vote_distribution_title')}</Text>
                {optionsWithVoters.map((option: any, idx: number) => (
                    <BarItem
                        key={option.id}
                        option={option}
                        color={colors[idx % colors.length]}
                        maxVotes={maxVotes}
                        progress={barProgress}
                        totalVotes={totalVotes}
                        styles={styles}
                    />
                ))}
                <View style={styles.totalContainer}><Text style={styles.totalText}>{t('total_votes_label').replace('{count}', String(totalVotes))}</Text></View>
            </ScrollView>
        );
    };

    const renderGridView = () => {
        if (totalVotes === 0) {
            return (
                <View style={styles.emptyGrid}>
                    <Ionicons name="grid-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyGridText}>{t('no_votes_yet')}</Text>
                </View>
            );
        }
        const votesArray: { color: string; optionId: string }[] = [];
        optionsWithVoters.forEach((option: any, idx: number) => {
            for (let i = 0; i < option.voteCount; i++) votesArray.push({ color: colors[idx % colors.length], optionId: option.id });
        });
        const rows = Math.ceil(votesArray.length / GRID_COLS);
        return (
            <ScrollView style={styles.gridScroll}>
                <View style={styles.gridContainer}>
                    {Array.from({ length: rows }).map((_, rowIdx) => (
                        <View key={rowIdx} style={styles.gridRow}>
                            {votesArray.slice(rowIdx * GRID_COLS, (rowIdx + 1) * GRID_COLS).map((vote: any, colIdx: number) => (
                                <View key={`${rowIdx}-${colIdx}`} style={[styles.gridCell, { backgroundColor: vote.color }]} />
                            ))}
                            {rowIdx === rows - 1 && Array.from({ length: GRID_COLS - (votesArray.length % GRID_COLS) }).map((_, i) => (
                                <View key={`empty-${i}`} style={[styles.gridCell, styles.gridCellEmpty]} />
                            ))}
                        </View>
                    ))}
                </View>
                <View style={styles.gridLegend}>
                    {optionsWithVoters.map((opt: any, idx: number) => (
                        <View key={opt.id} style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: colors[idx % colors.length] }]} />
                            <Text style={styles.legendText} numberOfLines={1}>{opt.text} ({opt.voteCount})</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        );
    };

    const handleShareText = async () => {
        try {
            await Share.share({ message: getResultsText() });
            safeHaptics.success();
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const handleShareToStory = () => {
        setShowStoryModal(true);
    };

    const handleCreatePost = () => {
        setShowPostModal(true);
    };

    return (
        <>
            <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
                <View style={styles.modalOverlay}>
                    <Animated.View entering={SlideInDown.springify().damping(15)} exiting={Platform.OS === 'web' ? undefined : SlideOutDown} style={[styles.modalContent, GlobalStyles.popupContainer]}>
                        <LinearGradient colors={['#007AFF', '#005BB5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerGradient}>
                            <Text style={styles.title}>{t('poll_results_title_simple')}</Text>
                            <View style={styles.headerActions}>
                                <TouchableOpacity onPress={handleShareText} style={styles.headerButton}><Ionicons name="share-outline" size={22} color="#fff" /></TouchableOpacity>
                                <TouchableOpacity onPress={handleShareToStory} style={styles.headerButton}><Ionicons name="paper-plane-outline" size={22} color="#fff" /></TouchableOpacity>
                                <TouchableOpacity onPress={handleCreatePost} style={styles.headerButton}><Ionicons name="add-circle-outline" size={22} color="#fff" /></TouchableOpacity>
                                <TouchableOpacity onPress={onClose} style={styles.headerButton}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
                            </View>
                        </LinearGradient>
                        <View style={styles.questionContainer}><Text style={styles.questionText}>{poll.question}</Text></View>
                        <View style={styles.tabContainer}>
                            {['voters', 'bars', 'grid'].map((tab) => (
                                <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab as any)}>
                                    <Ionicons name={tab === 'voters' ? 'people' : tab === 'bars' ? 'bar-chart' : 'grid'} size={18} color={activeTab === tab ? '#007AFF' : '#999'} />
                                    <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{t(`${tab}_tab`)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {activeTab === 'voters' && renderVotersTab()}
                        {activeTab === 'bars' && renderBarChart()}
                        {activeTab === 'grid' && renderGridView()}
                    </Animated.View>
                </View>
            </Modal>

            {/* Story Modal - with initialCaption prop */}
            <AddStory
                visible={showStoryModal}
                onClose={() => setShowStoryModal(false)}
                onStoryCreated={() => safeHaptics.success()}
            />

            {/* Create Post Modal - already supports initialParams */}
            <CreatePost
                visible={showPostModal}
                onClose={() => setShowPostModal(false)}
                onPostCreated={() => safeHaptics.success()}
                initialParams={{ caption: getResultsText() }}
            />
        </>
    );
};

const getStyles = (colors: any, activeScheme: string) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: activeScheme === 'dark' ? colors.background : '#f4f4f5',
        borderRadius: 24,
        width: '92%',
        maxHeight: '85%',
        overflow: 'hidden',
        ...createShadow({ width: 0, height: 10, radius: 20, opacity: 0.3 }),
    },
    headerGradient: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 18,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    headerButton: {
        padding: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
    },
    questionContainer: {
        padding: 20,
        backgroundColor: activeScheme === 'dark' ? colors.surface : '#fff',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    questionText: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
        lineHeight: 24,
    },
    tabContainer: {
        flexDirection: 'row',
        padding: 8,
        gap: 8,
        backgroundColor: activeScheme === 'dark' ? colors.muted : '#e5e7eb',
        marginHorizontal: 20,
        marginTop: 20,
        marginBottom: 8,
        borderRadius: 24,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 20,
        backgroundColor: 'transparent',
        gap: 6,
    },
    activeTab: {
        backgroundColor: colors.card,
        ...createShadow({ width: 0, height: 2, radius: 8, opacity: 0.1 }),
    },
    tabText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    activeTabText: {
        color: colors.tint,
    },
    scrollContent: {
        padding: 16,
        paddingHorizontal: 20,
    },
    optionCard: {
        backgroundColor: colors.card,
        borderRadius: 16,
        marginBottom: 16,
        padding: 16,
        ...createShadow({ width: 0, height: 2, radius: 8, opacity: 0.08 }),
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rankGradient: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    optionRank: {
        fontSize: 14,
        fontWeight: '700',
    },
    optionInfo: {
        flex: 1,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
        marginBottom: 4,
    },
    optionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    voteCountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginRight: 8,
    },
    voteCountText: {
        marginLeft: 4,
        fontSize: 12,
        fontWeight: '600',
    },
    voterPreview: {
        fontSize: 12,
        color: colors.textSecondary,
        flex: 1,
    },
    votersList: {
        marginTop: 12,
        marginLeft: 52,
    },
    voterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    voterName: {
        marginLeft: 10,
        fontSize: 14,
        color: colors.text,
    },
    noVoters: {
        fontSize: 14,
        color: colors.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 12,
    },
    viewMore: {
        marginTop: 10,
        alignItems: 'center',
        paddingVertical: 8,
        backgroundColor: colors.muted,
        borderRadius: 12,
    },
    viewMoreText: {
        fontSize: 13,
        color: colors.tint,
        fontWeight: '600',
    },
    chartScroll: {
        flex: 1,
    },
    chartContent: {
        padding: 20,
        backgroundColor: colors.card,
        margin: 20,
        borderRadius: 16,
        ...createShadow({ width: 0, height: 2, radius: 8, opacity: 0.08 }),
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 20,
        textAlign: 'center',
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    barLabel: {
        width: 80,
        fontSize: 14,
        color: colors.text,
    },
    barContainer: {
        flex: 1,
        height: 24,
        backgroundColor: colors.muted,
        borderRadius: 12,
        marginHorizontal: 8,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: 12,
    },
    barStats: {
        width: 70,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    barVotes: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text,
        marginRight: 4,
    },
    barPercent: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    totalContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    totalText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'center',
    },
    gridScroll: {
        flex: 1,
    },
    gridContainer: {
        padding: 16,
        alignItems: 'center',
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 4,
    },
    gridCell: {
        width: GRID_SIZE,
        height: GRID_SIZE,
        borderRadius: 4,
        margin: 2,
    },
    gridCellEmpty: {
        backgroundColor: 'transparent',
    },
    emptyGrid: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyGridText: {
        marginTop: 12,
        fontSize: 16,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    gridLegend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: colors.card,
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 16,
        paddingTop: 16,
        ...createShadow({ width: 0, height: 2, radius: 8, opacity: 0.08 }),
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '50%',
        marginBottom: 12,
        paddingRight: 12,
    },
    legendColor: {
        width: 14,
        height: 14,
        borderRadius: 4,
        marginRight: 8,
    },
    legendText: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.textSecondary,
        flex: 1,
    },
});

export default PollVotersModal;