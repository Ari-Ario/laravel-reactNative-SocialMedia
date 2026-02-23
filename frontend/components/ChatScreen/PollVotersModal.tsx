// components/ChatScreen/PollVotersModal.tsx
import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Avatar from '@/components/Image/Avatar';
import { captureRef } from 'react-native-view-shot'; // For screenshot sharing
import * as Sharing from 'expo-sharing';

const { width, height } = Dimensions.get('window');

interface PollVotersModalProps {
    visible: boolean;
    onClose: () => void;
    poll: any;
    currentUserId: number;
}

const PollVotersModal: React.FC<PollVotersModalProps> = ({
    visible,
    onClose,
    poll,
    currentUserId,
}) => {
    const [activeTab, setActiveTab] = useState<'voters' | 'chart'>('voters');
    const viewRef = React.useRef(null);

    if (!poll) return null;

    // Prepare options with vote counts and voters
    const optionsWithVoters = poll.options?.map((opt: any) => {
        const voters = opt.voters || [];
        const votes = opt.votes || [];
        // Combine voters from both arrays
        const allVoters = [...voters, ...votes.map((v: any) => ({
            userId: v.user_id || v.userId,
            name: v.name || 'User',
            avatar: v.avatar,
        }))];
        // Remove duplicates (in case both arrays contain same user)
        const uniqueVoters = Array.from(new Map(allVoters.map(v => [v.userId, v])).values());
        return {
            ...opt,
            voters: uniqueVoters,
            voteCount: opt.votes?.length || 0,
        };
    }).sort((a: any, b: any) => b.voteCount - a.voteCount); // Sort by most voted

    const totalVotes = poll.total_votes || 0;

    const renderVotersTab = () => (
        <ScrollView style={styles.scrollContent}>
            {optionsWithVoters.map((option: any, idx: number) => (
                <View key={option.id} style={styles.optionSection}>
                    <View style={styles.optionHeader}>
                        <Text style={styles.optionRank}>#{idx + 1}</Text>
                        <Text style={styles.optionText}>{option.text}</Text>
                        <View style={styles.voteBadge}>
                            <Text style={styles.voteBadgeText}>{option.voteCount}</Text>
                        </View>
                    </View>

                    {option.voters.length === 0 ? (
                        <Text style={styles.noVoters}>No votes yet</Text>
                    ) : (
                        <View style={styles.votersList}>
                            {option.voters.map((voter: any) => (
                                <View key={voter.userId} style={styles.voterItem}>
                                    <Avatar
                                        source={voter.avatar}
                                        size={32}
                                        name={voter.name}
                                    />
                                    <Text style={styles.voterName}>
                                        {voter.name}
                                        {voter.userId === currentUserId && ' (You)'}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            ))}
        </ScrollView>
    );

    const renderChartTab = () => (
        <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Vote Distribution</Text>
            {optionsWithVoters.map((option: any) => {
                const percentage = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;
                return (
                    <View key={option.id} style={styles.chartRow}>
                        <Text style={styles.chartLabel} numberOfLines={1}>
                            {option.text}
                        </Text>
                        <View style={styles.barContainer}>
                            <View style={[styles.bar, { width: `${percentage}%` }]} />
                        </View>
                        <Text style={styles.chartValue}>
                            {option.voteCount} ({percentage.toFixed(1)}%)
                        </Text>
                    </View>
                );
            })}
            <Text style={styles.totalVotes}>Total votes: {totalVotes}</Text>
        </View>
    );

    const handleShare = async () => {
        try {
            // For now, share as text (later implement screenshot)
            const message = `📊 Poll Results: ${poll.question}\n\n` +
                optionsWithVoters.map(opt =>
                    `${opt.text}: ${opt.voteCount} votes`
                ).join('\n') +
                `\n\nTotal votes: ${totalVotes}`;

            await Share.share({ message });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="none"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <Animated.View
                    entering={SlideInDown.springify().damping(15)}
                    exiting={SlideOutDown}
                    style={styles.modalContent}
                    ref={viewRef}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Poll Results</Text>
                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
                                <Ionicons name="share-outline" size={22} color="#007AFF" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'voters' && styles.activeTab]}
                            onPress={() => setActiveTab('voters')}
                        >
                            <Text style={[styles.tabText, activeTab === 'voters' && styles.activeTabText]}>
                                Voters
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'chart' && styles.activeTab]}
                            onPress={() => setActiveTab('chart')}
                        >
                            <Text style={[styles.tabText, activeTab === 'chart' && styles.activeTabText]}>
                                Chart
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {activeTab === 'voters' ? renderVotersTab() : renderChartTab()}
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        width: '90%',
        maxHeight: '80%',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    headerButton: {
        padding: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        padding: 12,
        gap: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
    },
    activeTab: {
        backgroundColor: '#007AFF',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
    },
    activeTabText: {
        color: '#fff',
    },
    scrollContent: {
        padding: 16,
    },
    optionSection: {
        marginBottom: 20,
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    optionRank: {
        fontSize: 14,
        fontWeight: '600',
        color: '#007AFF',
        marginRight: 8,
    },
    optionText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    voteBadge: {
        backgroundColor: '#007AFF',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    voteBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    votersList: {
        marginLeft: 24,
    },
    voterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    voterName: {
        marginLeft: 10,
        fontSize: 14,
        color: '#333',
    },
    noVoters: {
        marginLeft: 24,
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
    },
    chartContainer: {
        padding: 16,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 16,
        textAlign: 'center',
    },
    chartRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    chartLabel: {
        width: 80,
        fontSize: 14,
        color: '#333',
    },
    barContainer: {
        flex: 1,
        height: 20,
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
        marginHorizontal: 8,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 10,
    },
    chartValue: {
        width: 60,
        fontSize: 12,
        color: '#666',
        textAlign: 'right',
    },
    totalVotes: {
        marginTop: 16,
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
    },
});

export default PollVotersModal;