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
    NativeSyntheticEvent,
    NativeTouchEvent,
    findNodeHandle,
    UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
    SlideInDown,
    SlideOutDown,
} from 'react-native-reanimated';
import Avatar from '@/components/Image/Avatar';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { safeHaptics } from '@/utils/haptics';
import { createShadow } from '@/utils/styles';
import PollComponent from './PollComponent';
import PollVotersModal from './PollVotersModal';
import GenericMenu, { MenuItem } from '../GenericMenu';

const { width, height } = Dimensions.get('window');

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
    onEdit?: (pollId: string, updatedPoll: any) => void;
    isPreview?: boolean;
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
    onEdit,
    isPreview = false,
}) => {
    // State
    const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
    const [hasVoted, setHasVoted] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [localPoll, setLocalPoll] = useState<any>(poll);
    const [votingInProgress, setVotingInProgress] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [availableSpaces, setAvailableSpaces] = useState<any[]>([]);
    const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
    const [showShareResultsModal, setShowShareResultsModal] = useState(false);
    const [shareMessage, setShareMessage] = useState('');
    const [showEditPoll, setShowEditPoll] = useState(false);
    const [showVotersModal, setShowVotersModal] = useState(false);

    // Refs
    const menuButtonRef = useRef<any>(null);
    const collaborationService = CollaborationService.getInstance();

    // Update localPoll when poll prop changes
    useEffect(() => {
        setLocalPoll(poll);

        const userVoted = checkIfUserVoted(poll);
        setHasVoted(userVoted);

        if (!userVoted || !poll.settings?.allowVoteChange) {
            setSelectedOptions(new Set());
        }
    }, [poll, currentUserId]);

    // Helper to check if user voted
    const checkIfUserVoted = (pollData: any): boolean => {
        if (!pollData?.options) return false;
        return pollData.options.some((opt: any) => {
            const voters = opt.voters || [];
            const votes = opt.votes || [];

            const hasVoter = voters.some((v: any) =>
                String(v.userId) === String(currentUserId) || String(v.id) === String(currentUserId)
            );

            const hasVote = votes.some((v: any) =>
                String(v.user_id) === String(currentUserId) ||
                String(v.userId) === String(currentUserId) ||
                String(v) === String(currentUserId)
            );

            return hasVoter || hasVote;
        }) || false;
    };

    // Check if user can view results
    const canViewResults = (): boolean => {
        if (!localPoll) return false;
        const settings = localPoll.settings || {};

        if (settings.showResults === 'always') return true;
        if (settings.showResults === 'after_vote' && hasVoted) return true;
        if (settings.showResults === 'creator_only' && localPoll.created_by === currentUserId) return true;
        if (settings.showResults === 'after_deadline' &&
            localPoll.deadline && new Date() > new Date(localPoll.deadline)) return true;
        return showResults;
    };

    // Check if user can vote
    const canVote = (): boolean => {
        if (!localPoll) return false;
        if (localPoll.status !== 'active') return false;
        if (hasVoted && !localPoll.settings?.allowVoteChange) return false;
        if (localPoll.deadline && new Date() > new Date(localPoll.deadline)) return false;
        return true;
    };

    // Handle option selection (direct vote for single, toggle for multiple)
    const handleSelectOption = async (optionId: string) => {
        if (!canVote()) return;
        if (votingInProgress) return;

        if (isPreview) {
            Alert.alert('Preview Mode', 'Voting is disabled while previewing the poll.');
            return;
        }

        if (localPoll.type === 'single') {
            // Single choice: vote immediately
            setSelectedOptions(new Set([optionId]));
            await submitVote([optionId]);
        } else {
            // Multiple choice: toggle selection
            const newSelected = new Set(selectedOptions);

            if (newSelected.has(optionId)) {
                newSelected.delete(optionId);
            } else {
                if (localPoll.settings?.maxSelections &&
                    newSelected.size >= localPoll.settings.maxSelections) {
                    Alert.alert('Max Selections', `You can only select up to ${localPoll.settings.maxSelections} options`);
                    return;
                }
                newSelected.add(optionId);
            }

            setSelectedOptions(newSelected);
            safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
            // No auto-submit; user must press submit button
        }
    };

    // Submit vote
    const submitVote = async (optionIds: string[]) => {
        if (optionIds.length === 0) return;
        if (isPreview) {
            Alert.alert('Preview Mode', 'Voting is disabled while previewing the poll.');
            return;
        }

        setVotingInProgress(true);

        // Optimistic update
        const optimisticPoll = JSON.parse(JSON.stringify(localPoll));
        let oldVotesRemoved = 0;

        optimisticPoll.options.forEach((opt: any) => {
            if (opt.votes) {
                const initialLength = opt.votes.length;
                opt.votes = opt.votes.filter((v: any) =>
                    String(v.user_id) !== String(currentUserId) &&
                    String(v.userId) !== String(currentUserId) &&
                    String(v) !== String(currentUserId)
                );
                oldVotesRemoved += (initialLength - opt.votes.length);
            }
            if (opt.voters) {
                opt.voters = opt.voters.filter((v: any) =>
                    String(v.userId) !== String(currentUserId) && String(v.id) !== String(currentUserId)
                );
            }
        });

        optionIds.forEach(optId => {
            const option = optimisticPoll.options.find((o: any) => o.id === optId);
            if (option) {
                if (!option.votes) option.votes = [];
                if (!option.voters) option.voters = [];

                option.votes.push({
                    user_id: currentUserId,
                    id: `temp_${Date.now()}_${Math.random()}`,
                });

                option.voters.push({
                    userId: currentUserId,
                    name: 'You',
                });
            }
        });

        optimisticPoll.total_votes = (optimisticPoll.total_votes || 0) + optionIds.length - oldVotesRemoved;
        optimisticPoll.unique_voters = (optimisticPoll.unique_voters || 0) + (hasVoted ? 0 : 1);

        setLocalPoll(optimisticPoll);
        setHasVoted(true);

        try {
            await collaborationService.voteOnPoll(spaceId, localPoll.id, optionIds);
            await safeHaptics.success();

            if (onVote) {
                onVote(localPoll.id, optionIds);
            }

            if (onRefresh) {
                onRefresh();
            }
        } catch (error: any) {
            console.error('Error voting:', error);
            // Revert optimistic update
            setLocalPoll(poll);
            setHasVoted(checkIfUserVoted(poll));
            // Show validation errors if any
            if (error.response?.status === 422) {
                const errors = error.response.data.errors;
                const messages = Object.values(errors).flat().join('\n');
                Alert.alert('Validation Error', messages);
            } else {
                Alert.alert('Error', 'Failed to submit vote. Please try again.');
            }
        } finally {
            setVotingInProgress(false);
        }
    };

    // ==================== FIXED MENU PRESS - EXACT POSITIONING ====================
    const handleMenuPress = useCallback(() => {
        if (menuButtonRef.current) {
            menuButtonRef.current.measure((x: number, y: number, w: number, h: number, pageX: number, pageY: number) => {
                const menuWidth = 220;
                const menuHeight = 200; // Approximate based on number of items

                // Adjust position to keep menu on screen
                let left = pageX - menuWidth + w; // Align to the right edge of the button by default
                let top = pageY + h + 5;  // Render slightly below the button

                // Ensure menu doesn't go off screen
                if (left < 10) left = 10;
                if (left + menuWidth > width) left = width - menuWidth - 10;
                if (top + menuHeight > height) top = pageY - menuHeight - 10;

                setMenuPosition({ top, left });
                setShowMenu(true);
            });
        }
    }, [height, width]);
    // ==============================================================================

    // Close poll
    const handleClosePoll = useCallback(() => {
        setShowMenu(false);
        const title = 'Close Poll';
        const message = 'Are you sure you want to close this poll? No more votes will be accepted.';

        const executeClose = async () => {
            try {
                await collaborationService.closePoll(spaceId, localPoll.id);
                setLocalPoll((prev: any) => ({ ...prev, status: 'closed' }));
                await safeHaptics.warning();

                if (onClosePoll) {
                    onClosePoll(localPoll.id);
                }

                if (onRefresh) {
                    onRefresh();
                }

                await collaborationService.sendMessage(spaceId, {
                    content: `📊 Poll "${localPoll.question}" has been closed`,
                    type: 'text',
                    metadata: {
                        isPollNotification: true,
                        pollId: localPoll.id,
                        notificationType: 'poll_closed',
                    },
                });
            } catch (error) {
                console.error('Error closing poll:', error);
                if (Platform.OS === 'web') {
                    window.alert('Failed to close poll');
                } else {
                    Alert.alert('Error', 'Failed to close poll');
                }
            }
        };

        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`${title}\n\n${message}`);
            if (confirmed) {
                executeClose();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Close',
                        style: 'destructive',
                        onPress: executeClose,
                    },
                ]
            );
        }
    }, [spaceId, localPoll.id, localPoll.question, onClosePoll, onRefresh]);

    // Delete poll
    const handleDeletePoll = useCallback(() => {
        setShowMenu(false);

        const isCreator = String(localPoll?.created_by) === String(currentUserId);
        const isModerator = currentUserRole === 'owner' || currentUserRole === 'moderator';

        let title = 'Delete Poll';
        let message = '';

        if (isCreator) {
            message = 'As the creator, deleting this poll will remove it from ALL spaces it was shared to. This action cannot be undone.';
        } else if (isModerator) {
            message = 'As a moderator, you can only delete this poll from the current space. The original creator\'s copy in other spaces will remain. This action cannot be undone.';
        }

        const executeDelete = async () => {
            try {
                console.log('🗑️ Attempting to delete poll:', localPoll.id);
                const result: any = await collaborationService.deletePoll(spaceId, localPoll.id);
                console.log('✅ Delete successful:', result);

                // Show appropriate message
                if (Platform.OS === 'web') {
                    if (result && result.deleted_by === 'creator' && result.total_copies_deleted > 0) {
                        window.alert(`Poll deleted. ${result.total_copies_deleted} copies removed from other spaces.`);
                    } else {
                        window.alert('Poll deleted successfully');
                    }
                } else {
                    if (result && result.deleted_by === 'creator' && result.total_copies_deleted > 0) {
                        Alert.alert('Success', `Poll deleted. ${result.total_copies_deleted} copies removed from other spaces.`);
                    } else {
                        Alert.alert('Success', 'Poll deleted successfully');
                    }
                }

                if (onDelete) onDelete(localPoll.id);
            } catch (error: any) {
                console.error('❌ Delete failed:', error);
                if (Platform.OS === 'web') {
                    window.alert(error.response?.data?.message || 'Failed to delete poll');
                } else {
                    Alert.alert('Error', error.response?.data?.message || 'Failed to delete poll');
                }
            }
        };

        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`${title}\n\n${message}`);
            if (confirmed) {
                executeDelete();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: executeDelete,
                    },
                ]
            );
        }
    }, [spaceId, localPoll, currentUserId, currentUserRole, onDelete]);

    // Edit poll
    const handleEditPoll = useCallback(() => {
        setShowMenu(false);
        setShowEditPoll(true);
    }, []);

    // Handle poll update after edit
    const handlePollUpdated = useCallback(async (updatedPoll: any) => {
        setLocalPoll(updatedPoll);
        setShowEditPoll(false);

        if (onEdit) {
            onEdit(updatedPoll.id, updatedPoll);
        }

        try {
            // Send update notification to chat
            await collaborationService.sendMessage(spaceId, {
                content: `📊 Poll "${updatedPoll.question}" has been updated`,
                type: 'text',
                metadata: {
                    isPollNotification: true,
                    pollId: updatedPoll.id,
                    notificationType: 'poll_updated',
                },
            });
        } catch (error) {
            console.error('Failed to send poll update notification:', error);
        }
    }, [spaceId, onEdit]);

    // Calculate percentages
    const calculatedOptions = useMemo(() => {
        if (!localPoll?.options) return [];
        const total = localPoll.total_votes || 0;

        return localPoll.options.map((opt: any) => {
            const voteCount = opt.votes?.length || 0;
            return {
                ...opt,
                percentage: total > 0 ? Math.round((voteCount / total) * 100) : 0,
                voteCount,
            };
        });
    }, [localPoll?.options, localPoll?.total_votes]);

    // View results (toggle results view)
    const handleViewResults = useCallback(() => {
        setShowMenu(false);
        setShowResults(true);
    }, []);

    // Share results
    const handleShareResults = useCallback(() => {
        setShowMenu(false);

        const message = `📊 Poll Results: ${localPoll.question}\n\n` +
            calculatedOptions.map((opt: any) =>
                `${opt.text}: ${opt.voteCount} votes (${opt.percentage}%)`
            ).join('\n') +
            `\n\nTotal votes: ${localPoll.total_votes || 0}`;

        setShareMessage(message);
        setShowShareResultsModal(true);
    }, [localPoll.question, localPoll.total_votes, calculatedOptions]);

    // Send results as message
    const handleSendResults = useCallback(async () => {
        try {
            await collaborationService.sendMessage(spaceId, {
                content: shareMessage,
                type: 'text',
                metadata: {
                    isPollResults: true,
                    pollId: localPoll.id,
                },
            });

            await safeHaptics.success();
            Alert.alert('Success', 'Results shared to chat');
            setShowShareResultsModal(false);
        } catch (error) {
            console.error('Error sharing results:', error);
            Alert.alert('Error', 'Failed to share results');
        }
    }, [spaceId, shareMessage, localPoll.id, collaborationService]);

    // Load available spaces for forwarding
    const loadAvailableSpaces = useCallback(async () => {
        setIsLoadingSpaces(true);
        try {
            const userSpaces = await collaborationService.fetchUserSpaces(currentUserId);
            const filtered = userSpaces.filter(s => s.id !== spaceId);
            setAvailableSpaces(filtered);
        } catch (error) {
            console.error('Error loading spaces:', error);
            Alert.alert('Error', 'Could not load spaces for forwarding');
        } finally {
            setIsLoadingSpaces(false);
        }
    }, [currentUserId, spaceId, collaborationService]);

    // Forward poll
    const handleForwardPress = useCallback(() => {
        setShowMenu(false);
        loadAvailableSpaces();
        setShowForwardModal(true);
    }, [loadAvailableSpaces]);

    // Handle forward with notifications
    const handleForward = useCallback(async () => {
        if (selectedSpaces.size === 0) {
            Alert.alert('Error', 'Please select at least one space');
            return;
        }

        try {
            const targetSpaceIds = Array.from(selectedSpaces);
            await collaborationService.forwardPoll(localPoll.id, targetSpaceIds);

            for (const targetSpaceId of targetSpaceIds) {
                await collaborationService.sendMessage(targetSpaceId, {
                    content: `📊 Poll forwarded from another space: "${localPoll.question}"`,
                    type: 'poll', // Changed from 'text' to 'poll'
                    metadata: {
                        isPoll: true,      // Added so MessageList recognizes it
                        isPollForward: true,
                        pollId: localPoll.id,
                        pollData: localPoll, // Added so target space has the data
                        sourceSpaceId: spaceId,
                    },
                });
            }

            await safeHaptics.success();
            Alert.alert(
                'Success',
                `Poll forwarded to ${targetSpaceIds.length} space(s)`,
                [{ text: 'OK' }]
            );

            setShowForwardModal(false);
            setSelectedSpaces(new Set());

            if (onForward) {
                onForward(localPoll.id, targetSpaceIds);
            }
        } catch (error) {
            console.error('Error forwarding poll:', error);
            Alert.alert('Error', 'Failed to forward poll');
        }
    }, [selectedSpaces, localPoll.id, localPoll.question, spaceId, onForward, collaborationService]);

    // Render option
    const renderOption = (option: any) => {
        const isSelected = selectedOptions.has(option.id);
        const hasUserVoted = (option.voters || []).some((v: any) =>
            v.userId === currentUserId || v.id === currentUserId
        ) || (option.votes || []).some((v: any) =>
            v.user_id === currentUserId || v === currentUserId
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
                        ]}>
                            {option.text}
                        </Text>
                        {hasUserVoted && !localPoll.settings?.anonymous && (
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
                                        { width: `${option.percentage || 0}%` },
                                        isSelected && styles.progressBarSelected,
                                    ]}
                                />
                            </View>
                            <View style={styles.voteInfo}>
                                <Text style={styles.voteCount}>
                                    {option.voteCount || 0} vote{option.voteCount !== 1 ? 's' : ''}
                                </Text>
                                <Text style={styles.percentageText}>
                                    {option.percentage || 0}%
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const isCreator = localPoll?.created_by === currentUserId;
    const isModerator = currentUserRole === 'owner' || currentUserRole === 'moderator';
    const hasVotes = (localPoll?.total_votes || 0) > 0;
    const canClose = (isCreator || isModerator) && localPoll?.status === 'active';
    const canForward = (isCreator || isModerator) && localPoll?.status === 'active';
    const canEdit = isCreator && localPoll?.status === 'active' && !hasVotes; // Disable edit if any votes exist
    const canDelete = isCreator || isModerator;
    const canShareResults = localPoll?.status === 'closed' || !canVote();

    return (
        <>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.creatorInfo}
                        onPress={() => setShowVotersModal(true)} // Open voters modal on creator tap
                    >
                        <Avatar
                            source={localPoll?.creator?.profile_photo}
                            size={32}
                            name={localPoll?.creator?.name || 'User'}
                        />
                        <View style={styles.creatorText}>
                            <Text style={styles.creatorName}>
                                {localPoll?.creator?.name || 'User'}
                            </Text>
                            <Text style={styles.timestamp}>
                                {localPoll?.created_at
                                    ? new Date(localPoll.created_at).toLocaleString()
                                    : 'Just now'}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.headerRight}>
                        <View style={styles.badgeContainer}>
                            <View style={[
                                styles.statusBadge,
                                { backgroundColor: localPoll?.status === 'active' ? '#4CAF5020' : '#FF6B6B20' }
                            ]}>
                                <Text style={[
                                    styles.statusText,
                                    { color: localPoll?.status === 'active' ? '#4CAF50' : '#FF6B6B' }
                                ]}>
                                    {localPoll?.status?.toUpperCase() || 'ACTIVE'}
                                </Text>
                            </View>
                            <View style={styles.typeBadge}>
                                <Text style={styles.typeText}>{localPoll?.type}</Text>
                            </View>
                        </View>

                        {/* Three dots menu */}
                        {(canClose || canForward || canEdit || canDelete || canShareResults) && (
                            <TouchableOpacity
                                ref={menuButtonRef}
                                style={styles.menuButton}
                                onPress={handleMenuPress}
                            >
                                <Ionicons name="ellipsis-vertical" size={20} color="#666" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Question */}
                <Text style={styles.question}>{localPoll?.question}</Text>

                {/* Deadline */}
                {localPoll?.deadline && (
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
                    {calculatedOptions.map(renderOption)}
                </View>

                {/* Stats - now clickable to open voters modal */}
                <TouchableOpacity style={styles.statsContainer} onPress={() => setShowVotersModal(true)}>
                    <Text style={styles.statsText}>
                        <Ionicons name="people" size={14} color="#666" /> {localPoll?.unique_voters || 0} participant{(localPoll?.unique_voters || 0) !== 1 ? 's' : ''}
                        {' • '}
                        <Ionicons name="checkbox" size={14} color="#666" /> {localPoll?.total_votes || 0} total votes
                    </Text>
                    {localPoll?.settings?.quorum && (
                        <Text style={[
                            styles.quorumText,
                            (localPoll?.unique_voters || 0) >= localPoll.settings.quorum && styles.quorumMet
                        ]}>
                            Quorum: {localPoll?.unique_voters || 0}/{localPoll.settings.quorum}
                            {(localPoll?.unique_voters || 0) >= localPoll.settings.quorum && ' ✓'}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* Tags */}
                {localPoll?.tags && localPoll.tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                        {localPoll.tags.map((tag: string, idx: number) => (
                            <View key={idx} style={styles.tag}>
                                <Text style={styles.tagText}>#{tag}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Multiple choice submit button */}
                {localPoll?.type !== 'single' && selectedOptions.size > 0 && canVote() && (
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
                {localPoll?.forwarded_from && localPoll.forwarded_from.length > 0 && (
                    <View style={styles.forwardedContainer}>
                        <Ionicons name="share-social" size={14} color="#999" />
                        <Text style={styles.forwardedText}>
                            Forwarded from {localPoll.forwarded_from.length} other space(s)
                        </Text>
                    </View>
                )}
            </View>

            {/* Dropdown Menu - FIXED POSITIONING VIA GENERIC MENU */}
            <GenericMenu
                visible={showMenu}
                onClose={() => setShowMenu(false)}
                anchorPosition={menuPosition}
                items={useMemo(() => [
                    ...(!canViewResults() && !hasVoted ? [{
                        icon: 'bar-chart',
                        label: 'View Results',
                        onPress: handleViewResults,
                        color: '#007AFF'
                    }] : []),
                    ...(canShareResults ? [{
                        icon: 'share-social',
                        label: 'Share Results',
                        onPress: handleShareResults,
                        color: '#9C27B0'
                    }] : []),
                    ...(canForward ? [{
                        icon: 'share',
                        label: 'Forward to Spaces',
                        onPress: handleForwardPress,
                        color: '#4CAF50'
                    }] : []),
                    ...(canEdit ? [{
                        icon: 'create',
                        label: 'Edit Poll',
                        onPress: handleEditPoll,
                        color: '#FFA726'
                    }] : []),
                    ...(canClose ? [{
                        icon: 'lock-closed',
                        label: 'Close Poll',
                        onPress: handleClosePoll,
                        color: '#FF6B6B'
                    }] : []),
                    ...(canDelete ? [{
                        icon: 'trash',
                        label: 'Delete Poll',
                        onPress: handleDeletePoll,
                        destructive: true
                    }] : [])
                ] as MenuItem[], [
                    canViewResults, hasVoted, canShareResults, canForward, canEdit, canClose, canDelete,
                    handleViewResults, handleShareResults, handleForwardPress, handleEditPoll, handleClosePoll, handleDeletePoll
                ])}
            />

            {/* Edit Poll Modal */}
            <Modal
                visible={showEditPoll}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowEditPoll(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.editModalContainer}>
                        <PollComponent
                            spaceId={spaceId}
                            currentUserId={currentUserId}
                            currentUserRole={currentUserRole}
                            isVisible={showEditPoll}
                            onClose={() => setShowEditPoll(false)}
                            onPollCreated={handlePollUpdated}
                            editPoll={localPoll}
                            isEditing={true}
                        />
                    </View>
                </View>
            </Modal>

            {/* Share Results Modal */}
            <Modal
                visible={showShareResultsModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowShareResultsModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View
                        entering={SlideInDown.springify().damping(15)}
                        exiting={SlideOutDown}
                        style={styles.modalContent}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Share Poll Results</Text>
                            <TouchableOpacity onPress={() => setShowShareResultsModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalDescription}>
                            Share results as a message in this space
                        </Text>

                        <TextInput
                            style={styles.messageInput}
                            value={shareMessage}
                            onChangeText={setShareMessage}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonCancel]}
                                onPress={() => setShowShareResultsModal(false)}
                            >
                                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonConfirm]}
                                onPress={handleSendResults}
                            >
                                <Text style={styles.modalButtonTextConfirm}>Send to Chat</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>

            {/* Forward Modal */}
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
                            <Text style={styles.modalTitle}>Forward Poll</Text>
                            <TouchableOpacity onPress={() => setShowForwardModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalDescription}>
                            Select spaces to forward this poll
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
                                    s.title?.toLowerCase().includes(searchQuery.toLowerCase())
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
                                            <Text style={styles.spaceTitle}>{item.title}</Text>
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
                                onPress={handleForward}
                                disabled={selectedSpaces.size === 0}
                            >
                                <Text style={styles.modalButtonTextConfirm}>
                                    Forward ({selectedSpaces.size})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>

            {/* Voters Modal */}
            <PollVotersModal
                visible={showVotersModal}
                onClose={() => setShowVotersModal(false)}
                poll={localPoll}
                currentUserId={currentUserId}
                spaceId={spaceId}
            />
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
        ...createShadow({
            width: 0,
            height: 2,
            opacity: 0.05,
            radius: 8,
            elevation: 2,
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
        backgroundColor: '#007AFF',
        borderRadius: 3,
    },
    progressBarSelected: {
        backgroundColor: '#4CAF50',
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
        color: '#007AFF',
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
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    editModalContainer: {
        flex: 1,
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
    messageInput: {
        fontSize: 16,
        padding: 12,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        marginBottom: 16,
        minHeight: 120,
        textAlignVertical: 'top',
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