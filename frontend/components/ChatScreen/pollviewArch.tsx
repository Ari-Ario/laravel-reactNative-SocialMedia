// components/ChatScreen/PollViewer.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform,
    ActivityIndicator,
    Modal,
    TextInput,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    NativeSyntheticEvent,
    NativeTouchEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    withSpring,
    useSharedValue,
} from 'react-native-reanimated';
import Avatar from '@/components/Image/Avatar';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { safeHaptics } from '@/utils/haptics';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Predefined beautiful colors for poll options
const OPTION_COLORS = [
    '#007AFF', '#4CAF50', '#FF6B6B', '#FFA726', '#9C27B0',
    '#00BCD4', '#FF4081', '#795548', '#607D8B', '#E91E63'
];

interface PollViewerProps {
    poll: any;
    spaceId: string;
    currentUserId: number;
    currentUserRole: string;
    onVote?: (pollId: string, optionIds: string[]) => void;
    onClosePoll?: (pollId: string) => void;
    onForward?: (pollId: string, targetSpaceIds: string[]) => void;
    onRefresh?: () => void;
    onDelete?: (pollId: string) => void;
}

const PollViewer: React.FC<PollViewerProps> = ({
    poll,
    spaceId,
    currentUserId,
    currentUserRole,
    onVote,
    onClosePoll,
    onForward,
    onRefresh,
    onDelete,
}) => {
    // State
    const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
    const [hasVoted, setHasVoted] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [localPoll, setLocalPoll] = useState<any>(null);
    const [votingInProgress, setVotingInProgress] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [availableSpaces, setAvailableSpaces] = useState<any[]>([]);
    const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
    const [showShareResultsModal, setShowShareResultsModal] = useState(false);
    const [shareMessage, setShareMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Refs
    const collaborationService = CollaborationService.getInstance();
    const menuScale = useSharedValue(0);

    const isCreator = localPoll?.created_by === currentUserId;
    const isOwner = currentUserRole === 'owner';
    const isModerator = currentUserRole === 'moderator';

    // Delete permission: creator OR owner
    const canDelete = isCreator || isOwner;

    // Close permission: creator OR moderator OR owner
    const canClose = (isCreator || isModerator || isOwner) && localPoll?.status === 'active';


    // Initialize localPoll with safe defaults
    useEffect(() => {
        if (poll) {
            // Create a deep copy with safe defaults
            const safePoll = {
                ...poll,
                options: Array.isArray(poll.options) ? poll.options.map((opt: any) => ({
                    ...opt,
                    votes: opt.votes || [],
                    voters: opt.voters || [],
                })) : [],
                settings: poll.settings || {},
                total_votes: poll.total_votes || 0,
                unique_voters: poll.unique_voters || 0,
                status: poll.status || 'active',
                created_by: poll.created_by || 0,
                creator: poll.creator || { name: 'Unknown' },
            };
            setLocalPoll(safePoll);
            setIsInitialized(true);
        }
    }, [poll]);

    // Check if user has voted
    useEffect(() => {
        if (!localPoll || !isInitialized) return;

        try {
            const userVoted = localPoll.options?.some((opt: any) => {
                const votes = opt.votes || [];
                const voters = opt.voters || [];

                return votes.some((v: any) =>
                    v === currentUserId || v?.user_id === currentUserId || v?.userId === currentUserId
                ) || voters.some((v: any) =>
                    v === currentUserId || v?.id === currentUserId || v?.userId === currentUserId
                );
            }) || false;

            setHasVoted(userVoted);

            if (!userVoted || !localPoll.settings?.allowVoteChange) {
                setSelectedOptions(new Set());
            }
        } catch (err) {
            console.error('Error checking vote status:', err);
        }
    }, [localPoll, currentUserId, isInitialized]);

    // Check if user can view results
    const canViewResults = useCallback((): boolean => {
        if (!localPoll) return false;

        try {
            const settings = localPoll.settings || {};

            if (settings.showResults === 'always') return true;
            if (settings.showResults === 'after_vote' && hasVoted) return true;
            if (settings.showResults === 'creator_only' && localPoll.created_by === currentUserId) return true;
            if (settings.showResults === 'after_deadline' &&
                localPoll.deadline && new Date(localPoll.deadline) < new Date()) return true;
            return showResults;
        } catch (err) {
            console.error('Error checking view results permission:', err);
            return false;
        }
    }, [localPoll, hasVoted, currentUserId, showResults]);

    // Check if user can vote
    const canVote = useCallback((): boolean => {
        if (!localPoll) return false;

        try {
            if (localPoll.status !== 'active') return false;
            if (hasVoted && !localPoll.settings?.allowVoteChange) return false;
            if (localPoll.deadline && new Date(localPoll.deadline) < new Date()) return false;
            return true;
        } catch (err) {
            console.error('Error checking vote permission:', err);
            return false;
        }
    }, [localPoll, hasVoted]);

    // Share results permission: closed poll OR any user who can't vote
    const canShareResults = localPoll?.status === 'closed' || !canVote();
    // Handle option selection (direct vote)
    const handleSelectOption = async (optionId: string) => {
        if (!canVote() || votingInProgress || !localPoll) return;

        try {
            // For single choice polls, vote immediately
            if (localPoll.type === 'single') {
                setSelectedOptions(new Set([optionId]));
                await submitVote([optionId]);
            }
            // For multiple choice, toggle selection
            else {
                const newSelected = new Set(selectedOptions);

                if (newSelected.has(optionId)) {
                    newSelected.delete(optionId);
                } else {
                    const maxSelections = localPoll.settings?.maxSelections;
                    if (maxSelections && newSelected.size >= maxSelections) {
                        Alert.alert(
                            'Max Selections',
                            `You can only select up to ${maxSelections} options`
                        );
                        return;
                    }
                    newSelected.add(optionId);
                }

                setSelectedOptions(newSelected);

                // Auto-submit if max selections reached
                const maxSelections = localPoll.settings?.maxSelections;
                if (maxSelections && newSelected.size === maxSelections) {
                    await submitVote(Array.from(newSelected));
                }

                await safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (err) {
            console.error('Error selecting option:', err);
        }
    };

    // Submit vote with comprehensive error handling
    const submitVote = async (optionIds: string[]) => {
        if (!localPoll || optionIds.length === 0 || votingInProgress) return;

        setVotingInProgress(true);
        setError(null);

        try {
            // Validate vote
            if (localPoll.type === 'single' && optionIds.length > 1) {
                throw new Error('Cannot vote for multiple options in single choice poll');
            }

            // Send to backend
            await collaborationService.voteOnPoll(spaceId, localPoll.id, optionIds);

            // Update local state optimistically
            const updatedPoll = { ...localPoll };
            optionIds.forEach(optId => {
                const option = updatedPoll.options.find((o: any) => o.id === optId);
                if (option) {
                    option.votes = [...(option.votes || []), currentUserId];
                    option.voters = [...(option.voters || []), {
                        userId: currentUserId,
                        name: 'You'
                    }];
                }
            });

            updatedPoll.total_votes = (updatedPoll.total_votes || 0) + optionIds.length;
            if (!hasVoted) {
                updatedPoll.unique_voters = (updatedPoll.unique_voters || 0) + 1;
            }

            setLocalPoll(updatedPoll);
            setHasVoted(true);

            await safeHaptics.success();

            if (onVote) {
                onVote(localPoll.id, optionIds);
            }

            if (onRefresh) {
                onRefresh();
            }
        } catch (err: any) {
            console.error('Error voting:', err);
            setError(err.message || 'Failed to submit vote');
            Alert.alert('Error', err.message || 'Failed to submit vote');
            // Revert optimistic update
            setLocalPoll(poll);
        } finally {
            setVotingInProgress(false);
        }
    };

    // Handle menu press with exact positioning
    const handleMenuPress = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
        try {
            const { pageX, pageY } = event.nativeEvent;

            // Adjust position to keep menu on screen
            const menuWidth = 200;
            const menuHeight = 200; // Approximate height

            let left = pageX - 20; // Offset to align under the dots
            let top = pageY + 10;

            // Prevent menu from going off screen
            if (left + menuWidth > width) {
                left = width - menuWidth - 10;
            }

            if (top + menuHeight > height) {
                top = height - menuHeight - 10;
            }

            // Ensure menu doesn't go off left edge
            if (left < 10) {
                left = 10;
            }

            setMenuPosition({ top, left });
            setMenuVisible(true);
            menuScale.value = withSpring(1, { damping: 15, stiffness: 150 });
        } catch (err) {
            console.error('Error handling menu press:', err);
        }
    };

    // Close poll with safe error handling
    const handleClosePoll = () => {
        if (!localPoll) return;

        Alert.alert(
            'Close Poll',
            'Are you sure you want to close this poll? No more votes will be accepted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Close',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setMenuVisible(false);
                            await collaborationService.closePoll(spaceId, localPoll.id);

                            setLocalPoll({ ...localPoll, status: 'closed' });
                            await safeHaptics.warning();

                            if (onClosePoll) {
                                onClosePoll(localPoll.id);
                            }

                            if (onRefresh) {
                                onRefresh();
                            }
                        } catch (err: any) {
                            console.error('Error closing poll:', err);
                            Alert.alert('Error', err.message || 'Failed to close poll');
                        }
                    },
                },
            ]
        );
    };

    // Delete poll - NO NOTIFICATION TO PARTICIPANTS
    // In PollViewer.tsx, replace the existing handleDeletePoll function with this:

    const handleDeletePoll = () => {
        if (!localPoll) return;

        const isCreator = localPoll.created_by === currentUserId;
        const isOwner = currentUserRole === 'owner';
        const canDelete = isCreator || isOwner;

        // Check permissions first
        if (!canDelete) {
            Alert.alert(
                'Permission Denied',
                'Only the poll creator or space owner can delete this poll.',
                [{ text: 'OK' }]
            );
            return;
        }

        // Direct deletion without confirmation alert
        const performDeletion = async () => {
            try {
                setMenuVisible(false);

                // Show loading indicator
                setVotingInProgress(true);

                // Call delete API
                await collaborationService.deletePoll(spaceId, localPoll.id);

                // Haptic feedback
                await safeHaptics.warning();

                // Trigger callback to remove from parent
                if (onDelete) {
                    onDelete(localPoll.id);
                }

            } catch (err: any) {
                console.error('Error deleting poll:', err);

                // Show error message if deletion fails
                Alert.alert(
                    'Error',
                    err.message || 'Failed to delete poll. Please try again.'
                );
            } finally {
                setVotingInProgress(false);
            }
        };

        performDeletion();
    };

    // View results
    const handleViewResults = () => {
        setMenuVisible(false);
        setShowResults(true);
    };

    // Generate beautiful results message
    const generateResultsMessage = useCallback((): string => {
        if (!localPoll) return '';

        try {
            const results = calculatePercentages();
            const totalVotes = localPoll.total_votes || 0;
            const totalVoters = localPoll.unique_voters || 0;

            const winner = results.reduce((prev: any, current: any) =>
                (current.voteCount > prev.voteCount) ? current : prev
                , results[0] || { text: 'No votes' });

            const message = `📊 **POLL RESULTS**\n\n` +
                `*${localPoll.question}*\n\n` +
                results.map((opt: any, idx: number) =>
                    `${idx + 1}. ${opt.text}\n` +
                    `   ${opt.voteCount} vote${opt.voteCount !== 1 ? 's' : ''} (${opt.percentage}%)\n` +
                    `   ${'█'.repeat(Math.floor(opt.percentage / 10))}${'░'.repeat(10 - Math.floor(opt.percentage / 10))}\n`
                ).join('\n') +
                `\n━━━━━━━━━━━━━━━━━━\n` +
                `📈 **Total Votes:** ${totalVotes}\n` +
                `👥 **Participants:** ${totalVoters}\n` +
                `🏆 **Winner:** ${winner.text} (${winner.percentage}%)`;

            return message;
        } catch (err) {
            console.error('Error generating results message:', err);
            return `📊 Poll Results: ${localPoll.question}\n\nTotal votes: ${localPoll.total_votes || 0}`;
        }
    }, [localPoll]);

    // Auto-share results when poll is closed
    useEffect(() => {
        if (localPoll && localPoll.status === 'closed' && poll?.status !== 'closed') {
            const shareResults = async () => {
                try {
                    const message = generateResultsMessage();
                    await collaborationService.sendMessage(spaceId, {
                        content: message,
                        type: 'text',
                        metadata: {
                            isPollResults: true,
                            pollId: localPoll.id,
                            isAutoGenerated: true,
                        },
                    });
                } catch (err) {
                    console.error('Error auto-sharing results:', err);
                }
            };
            shareResults();
        }
    }, [localPoll?.status, poll?.status]);

    // Share results to other spaces
    const handleShareToSpaces = () => {
        setMenuVisible(false);
        loadAvailableSpaces();
        setShowForwardModal(true);
        // Generate share message with beautiful formatting
        setShareMessage(generateResultsMessage());
    };

    // Load available spaces for sharing
    const loadAvailableSpaces = async () => {
        if (!currentUserId) return;

        setIsLoadingSpaces(true);
        setError(null);

        try {
            const userSpaces = await collaborationService.fetchUserSpaces(currentUserId);
            // Filter out current space and ensure valid data
            const filtered = (userSpaces || [])
                .filter(s => s && s.id && s.id !== spaceId)
                .map(s => ({
                    ...s,
                    title: s.title || 'Unnamed Space',
                    space_type: s.space_type || 'space',
                }));
            setAvailableSpaces(filtered);
        } catch (err: any) {
            console.error('Error loading spaces:', err);
            setError(err.message || 'Failed to load spaces');
        } finally {
            setIsLoadingSpaces(false);
        }
    };

    // Share poll results to selected spaces
    const handleShareToSelectedSpaces = async () => {
        if (selectedSpaces.size === 0 || !localPoll) {
            Alert.alert('Error', 'Please select at least one space');
            return;
        }

        try {
            const targetSpaceIds = Array.from(selectedSpaces);

            // Send beautiful results to each space
            for (const targetSpaceId of targetSpaceIds) {
                await collaborationService.sendMessage(targetSpaceId, {
                    content: shareMessage || generateResultsMessage(),
                    type: 'text',
                    metadata: {
                        isPollResults: true,
                        isPollForward: true,
                        pollId: localPoll.id,
                        sourceSpaceId: spaceId,
                    },
                });
            }

            await safeHaptics.success();
            Alert.alert(
                'Success',
                `Results shared to ${targetSpaceIds.length} space(s)`,
                [{ text: 'OK' }]
            );

            setShowForwardModal(false);
            setSelectedSpaces(new Set());

            if (onForward) {
                onForward(localPoll.id, targetSpaceIds);
            }
        } catch (err: any) {
            console.error('Error sharing results:', err);
            Alert.alert('Error', err.message || 'Failed to share results');
        }
    };

    // Calculate percentages safely
    const calculatePercentages = useCallback(() => {
        if (!localPoll || !Array.isArray(localPoll.options)) return [];

        try {
            const total = localPoll.total_votes || 0;

            return localPoll.options.map((opt: any, index: number) => {
                const voteCount = opt.votes?.length || 0;
                return {
                    ...opt,
                    voteCount,
                    percentage: total > 0 ? Math.round((voteCount / total) * 100) : 0,
                    color: OPTION_COLORS[index % OPTION_COLORS.length],
                };
            });
        } catch (err) {
            console.error('Error calculating percentages:', err);
            return [];
        }
    }, [localPoll]);

    // Render option with beautiful design
    const renderOption = useCallback((option: any) => {
        if (!option) return null;

        const isSelected = selectedOptions.has(option.id);
        const hasUserVoted = option.votes?.some((v: any) =>
            v === currentUserId || v?.user_id === currentUserId
        ) || option.voters?.some((v: any) =>
            v === currentUserId || v?.id === currentUserId || v?.userId === currentUserId
        );

        const showResult = canViewResults() || hasVoted;

        return (
            <TouchableOpacity
                key={option.id}
                style={[
                    styles.optionContainer,
                    isSelected && styles.optionSelected,
                    !canVote() && styles.optionDisabled,
                    votingInProgress && styles.optionDisabled,
                ]}
                onPress={() => handleSelectOption(option.id)}
                disabled={!canVote() || votingInProgress}
                activeOpacity={0.7}
            >
                <View style={styles.optionContent}>
                    <View style={styles.optionHeader}>
                        <Text style={[
                            styles.optionText,
                            isSelected && styles.optionTextSelected,
                        ]} numberOfLines={2}>
                            {option.text || 'Unnamed Option'}
                        </Text>
                        {hasUserVoted && !localPoll?.settings?.anonymous && (
                            <View style={styles.votedBadge}>
                                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                            </View>
                        )}
                    </View>

                    {showResult && (
                        <View style={styles.resultContainer}>
                            <View style={styles.progressBarContainer}>
                                <View
                                    style={[
                                        styles.progressBar,
                                        {
                                            width: `${option.percentage || 0}%`,
                                            backgroundColor: option.color || '#007AFF',
                                        },
                                        isSelected && styles.progressBarSelected,
                                    ]}
                                />
                            </View>
                            <View style={styles.voteInfo}>
                                <Text style={styles.voteCount}>
                                    {option.voteCount || 0} vote{option.voteCount !== 1 ? 's' : ''}
                                </Text>
                                <Text style={[
                                    styles.percentageText,
                                    { color: option.color || '#007AFF' }
                                ]}>
                                    {option.percentage || 0}%
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    }, [selectedOptions, canVote, votingInProgress, canViewResults, hasVoted, localPoll, currentUserId, handleSelectOption]);

    // Memoized permission checks
    const permissions = useMemo(() => {
        if (!localPoll || !isInitialized) {
            return {
                isCreator: false,
                isModerator: false,
                canClose: false,
                canForward: false,
                canDelete: false,
                canShareResults: false,
            };
        }

        const isCreator = localPoll.created_by === currentUserId;
        const isModerator = currentUserRole === 'owner' || currentUserRole === 'moderator';
        const isActive = localPoll.status === 'active';
        const isClosed = localPoll.status === 'closed';

        return {
            isCreator,
            isModerator,
            canClose: (isCreator || isModerator) && isActive,
            canForward: (isCreator || isModerator) && isActive,
            canDelete: isCreator || isModerator,
            canShareResults: isClosed || !canVote(),
        };
    }, [localPoll, currentUserId, currentUserRole, canVote, isInitialized]);

    // Animated menu style
    const menuAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: menuScale.value }],
        opacity: menuScale.value,
    }));

    // Don't render until initialized
    if (!isInitialized || !localPoll) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="small" color="#007AFF" />
            </View>
        );
    }

    return (
        <>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.creatorInfo}>
                        <Avatar
                            source={localPoll.creator?.profile_photo}
                            size={32}
                            name={localPoll.creator?.name || 'User'}
                        />
                        <View style={styles.creatorText}>
                            <Text style={styles.creatorName} numberOfLines={1}>
                                {localPoll.creator?.name || 'User'}
                            </Text>
                            <Text style={styles.timestamp}>
                                {localPoll.created_at
                                    ? new Date(localPoll.created_at).toLocaleString()
                                    : 'Just now'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.headerRight}>
                        <View style={styles.badgeContainer}>
                            <View style={[
                                styles.statusBadge,
                                {
                                    backgroundColor: localPoll.status === 'active'
                                        ? '#4CAF5020'
                                        : localPoll.status === 'closed'
                                            ? '#FF6B6B20'
                                            : '#f0f0f0'
                                }
                            ]}>
                                <Text style={[
                                    styles.statusText,
                                    {
                                        color: localPoll.status === 'active'
                                            ? '#4CAF50'
                                            : localPoll.status === 'closed'
                                                ? '#FF6B6B'
                                                : '#666'
                                    }
                                ]}>
                                    {localPoll.status?.toUpperCase() || 'ACTIVE'}
                                </Text>
                            </View>
                            <View style={styles.typeBadge}>
                                <Text style={styles.typeText}>{localPoll.type || 'poll'}</Text>
                            </View>
                        </View>

                        {/* Three dots menu */}
                        {(permissions.canClose || permissions.canDelete || permissions.canShareResults) && (
                            <TouchableOpacity
                                style={styles.menuButton}
                                onPress={handleMenuPress}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Question */}
                <Text style={styles.question}>{localPoll.question || 'Untitled Poll'}</Text>

                {/* Deadline */}
                {localPoll.deadline && (
                    <View style={styles.deadlineContainer}>
                        <Ionicons
                            name={new Date(localPoll.deadline) < new Date() ? "alert-circle" : "time"}
                            size={16}
                            color={new Date(localPoll.deadline) < new Date() ? "#FF6B6B" : "#666"}
                        />
                        <Text style={[
                            styles.deadlineText,
                            new Date(localPoll.deadline) < new Date() && styles.deadlinePassed
                        ]}>
                            {new Date(localPoll.deadline) < new Date()
                                ? `Closed: ${new Date(localPoll.deadline).toLocaleString()}`
                                : `Closes: ${new Date(localPoll.deadline).toLocaleString()}`}
                        </Text>
                    </View>
                )}

                {/* Options */}
                <View style={styles.optionsContainer}>
                    {calculatePercentages().map(renderOption)}
                </View>

                {/* Stats */}
                <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>
                        <Ionicons name="people" size={14} color="#666" /> {localPoll.unique_voters || 0} participant{(localPoll.unique_voters || 0) !== 1 ? 's' : ''}
                        {' • '}
                        <Ionicons name="checkbox" size={14} color="#666" /> {localPoll.total_votes || 0} total votes
                    </Text>
                    {localPoll.settings?.quorum && (
                        <Text style={[
                            styles.quorumText,
                            (localPoll.unique_voters || 0) >= localPoll.settings.quorum && styles.quorumMet
                        ]}>
                            Quorum: {localPoll.unique_voters || 0}/{localPoll.settings.quorum}
                            {(localPoll.unique_voters || 0) >= localPoll.settings.quorum && ' ✓'}
                        </Text>
                    )}
                </View>

                {/* Tags */}
                {localPoll.tags && localPoll.tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                        {localPoll.tags.map((tag: string, idx: number) => (
                            <View key={idx} style={styles.tag}>
                                <Text style={styles.tagText}>#{tag}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Multiple choice submit button */}
                {localPoll.type !== 'single' && selectedOptions.size > 0 && canVote() && (
                    <TouchableOpacity
                        style={[styles.submitButton, votingInProgress && styles.submitButtonDisabled]}
                        onPress={() => submitVote(Array.from(selectedOptions))}
                        disabled={votingInProgress}
                    >
                        {votingInProgress ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                <Text style={styles.submitButtonText}>
                                    Submit Vote ({selectedOptions.size})
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {/* Forwarded Info */}
                {localPoll.forwarded_from && localPoll.forwarded_from.length > 0 && (
                    <View style={styles.forwardedContainer}>
                        <Ionicons name="share-social" size={14} color="#999" />
                        <Text style={styles.forwardedText}>
                            Forwarded from {localPoll.forwarded_from.length} other space(s)
                        </Text>
                    </View>
                )}
            </View>

            {/* Dropdown Menu */}
            {menuVisible && (
                <>
                    <TouchableOpacity
                        style={styles.menuOverlay}
                        activeOpacity={1}
                        onPress={() => setMenuVisible(false)}
                    />
                    <Animated.View
                        style={[
                            styles.dropdownMenu,
                            menuAnimatedStyle,
                            {
                                position: 'absolute',
                                top: menuPosition.top,
                                left: menuPosition.left,
                            }
                        ]}
                    >
                        {/* View Results */}
                        {!canViewResults() && !hasVoted && (
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={handleViewResults}
                            >
                                <Ionicons name="bar-chart" size={20} color="#007AFF" />
                                <Text style={styles.menuItemText}>View Results</Text>
                            </TouchableOpacity>
                        )}

                        {/* Share Results */}
                        {canShareResults && (
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={handleShareToSpaces}
                            >
                                <Ionicons name="share-social" size={20} color="#9C27B0" />
                                <Text style={styles.menuItemText}>Share Results</Text>
                            </TouchableOpacity>
                        )}

                        {/* Close Poll */}
                        {canClose && (
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={handleClosePoll}
                            >
                                <Ionicons name="lock-closed" size={20} color="#FF6B6B" />
                                <Text style={[styles.menuItemText, { color: '#FF6B6B' }]}>
                                    Close Poll
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* Divider */}
                        {canDelete && canClose && (
                            <View style={styles.menuDivider} />
                        )}

                        {/* Delete Poll - Only for creator OR owner, no confirmation */}
                        {canDelete && (
                            <TouchableOpacity
                                style={[styles.menuItem, styles.menuItemDestructive]}
                                onPress={handleDeletePoll}
                            >
                                <Ionicons name="trash" size={20} color="#FF6B6B" />
                                <Text style={[styles.menuItemText, styles.menuItemTextDestructive]}>
                                    Delete Poll
                                </Text>
                            </TouchableOpacity>
                        )}
                    </Animated.View>
                </>
            )}

            {/* Share Results Modal */}
            <Modal
                visible={showForwardModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowForwardModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View
                        entering={SlideInDown.springify().damping(15)}
                        exiting={SlideOutDown}
                        style={styles.modalContent}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Share Results</Text>
                            <TouchableOpacity onPress={() => setShowForwardModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalDescription}>
                            Select spaces to share these beautiful results
                        </Text>

                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search spaces..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            clearButtonMode="while-editing"
                        />

                        {isLoadingSpaces ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#007AFF" />
                                <Text style={styles.loadingText}>Loading spaces...</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={availableSpaces.filter(s =>
                                    s.title.toLowerCase().includes(searchQuery.toLowerCase())
                                )}
                                keyExtractor={(item) => item.id}
                                style={styles.spacesList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.spaceItem,
                                            selectedSpaces.has(item.id) && styles.spaceItemSelected
                                        ]}
                                        onPress={() => {
                                            const newSelected = new Set(selectedSpaces);
                                            if (newSelected.has(item.id)) {
                                                newSelected.delete(item.id);
                                            } else {
                                                newSelected.add(item.id);
                                            }
                                            setSelectedSpaces(newSelected);
                                        }}
                                    >
                                        <Avatar
                                            source={item.creator?.profile_photo}
                                            size={40}
                                            name={item.title}
                                        />
                                        <View style={styles.spaceInfo}>
                                            <Text style={styles.spaceTitle} numberOfLines={1}>
                                                {item.title}
                                            </Text>
                                            <Text style={styles.spaceType}>{item.space_type}</Text>
                                        </View>
                                        {selectedSpaces.has(item.id) && (
                                            <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                                        )}
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>No spaces available</Text>
                                }
                            />
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonCancel]}
                                onPress={() => {
                                    setShowForwardModal(false);
                                    setSelectedSpaces(new Set());
                                }}
                            >
                                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.modalButtonConfirm,
                                    selectedSpaces.size === 0 && styles.modalButtonDisabled
                                ]}
                                onPress={handleShareToSelectedSpaces}
                                disabled={selectedSpaces.size === 0}
                            >
                                <Text style={styles.modalButtonTextConfirm}>
                                    Share ({selectedSpaces.size})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    creatorInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    creatorText: {
        marginLeft: 8,
        flex: 1,
    },
    creatorName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    timestamp: {
        fontSize: 11,
        color: '#999',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: 6,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
    },
    typeBadge: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#666',
        textTransform: 'capitalize',
    },
    menuButton: {
        padding: 4,
    },
    question: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
        lineHeight: 24,
    },
    deadlineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    deadlineText: {
        marginLeft: 6,
        fontSize: 12,
        color: '#666',
    },
    deadlinePassed: {
        color: '#FF6B6B',
    },
    optionsContainer: {
        gap: 8,
        marginBottom: 12,
    },
    optionContainer: {
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 12,
        padding: 12,
        backgroundColor: '#fff',
    },
    optionSelected: {
        borderColor: '#007AFF',
        backgroundColor: '#007AFF08',
    },
    optionDisabled: {
        opacity: 0.6,
    },
    optionContent: {
        gap: 8,
    },
    optionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionText: {
        fontSize: 15,
        color: '#333',
        flex: 1,
    },
    optionTextSelected: {
        fontWeight: '500',
        color: '#007AFF',
    },
    votedBadge: {
        marginLeft: 8,
    },
    resultContainer: {
        gap: 4,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: '#f0f0f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    },
    progressBarSelected: {
        opacity: 0.8,
    },
    voteInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    voteCount: {
        fontSize: 12,
        color: '#666',
    },
    percentageText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    statsText: {
        fontSize: 12,
        color: '#666',
    },
    quorumText: {
        fontSize: 12,
        color: '#FFA726',
    },
    quorumMet: {
        color: '#4CAF50',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    tag: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    tagText: {
        fontSize: 10,
        color: '#666',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4CAF50',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
        marginBottom: 8,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    forwardedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    forwardedText: {
        marginLeft: 4,
        fontSize: 11,
        color: '#999',
    },
    // Menu styles
    menuOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        zIndex: 999,
    },
    dropdownMenu: {
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 8,
        minWidth: 180,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
            },
            android: {
                elevation: 5,
            },
        }),
        zIndex: 1000,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        gap: 10,
    },
    menuItemDestructive: {},
    menuItemText: {
        fontSize: 14,
        color: '#333',
        flex: 1,
    },
    menuItemTextDestructive: {
        color: '#FF6B6B',
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginVertical: 4,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
    },
    modalDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    searchInput: {
        fontSize: 16,
        padding: 12,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        marginBottom: 16,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#666',
    },
    spacesList: {
        maxHeight: 400,
    },
    spaceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        backgroundColor: '#fff',
    },
    spaceItemSelected: {
        backgroundColor: '#007AFF08',
    },
    spaceInfo: {
        flex: 1,
        marginLeft: 12,
    },
    spaceTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 2,
    },
    spaceType: {
        fontSize: 12,
        color: '#999',
        textTransform: 'capitalize',
    },
    emptyText: {
        textAlign: 'center',
        padding: 20,
        color: '#999',
        fontSize: 14,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalButtonCancel: {
        backgroundColor: '#f0f0f0',
    },
    modalButtonConfirm: {
        backgroundColor: '#007AFF',
    },
    modalButtonDisabled: {
        opacity: 0.5,
    },
    modalButtonTextCancel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    modalButtonTextConfirm: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default PollViewer;