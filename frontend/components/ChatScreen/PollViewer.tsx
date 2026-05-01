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
import { calculateAnchor, AnchorPosition } from '@/utils/layout';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';
import { GlobalStyles } from '@/styles/GlobalStyles';

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
    /** When true, the 3-dot menu is hidden (actions handled by MessageContextMenu) */
    inChatMode?: boolean;
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
    inChatMode = false,
}) => {
    const { colors, activeScheme } = useAppTheme();
    const { t, isRTL } = useTranslation();
    const styles = getStyles(colors, activeScheme, isRTL);

    // State
    const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
    const [hasVoted, setHasVoted] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [localPoll, setLocalPoll] = useState<any>(poll);
    const [votingInProgress, setVotingInProgress] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState<AnchorPosition>();
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
            Alert.alert(t('preview_mode'), t('voting_disabled_preview'));
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
                    Alert.alert(t('max_selections_title'), t('max_selections_msg').replace('{count}', String(localPoll.settings.maxSelections)));
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
            Alert.alert(t('preview_mode'), t('voting_disabled_preview'));
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
                    name: t('you'),
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
                Alert.alert(t('validation_error'), messages);
            } else {
                Alert.alert(t('error'), t('failed_submit_vote'));
            }
        } finally {
            setVotingInProgress(false);
        }
    };

    // ==================== FIXED MENU PRESS - EXACT POSITIONING ====================
    const handleMenuPress = useCallback(() => {
        if (menuButtonRef.current) {
            menuButtonRef.current.measure((x: number, y: number, w: number, h: number, pageX: number, pageY: number) => {
                const anchor = calculateAnchor(pageX, pageY, w, h, 220); // 220 is GenericMenu width
                setMenuPosition(anchor);
                setShowMenu(true);
            });
        }
    }, []);
    // ==============================================================================

    // Close poll
    const handleClosePoll = useCallback(() => {
        setShowMenu(false);
        const title = t('close_poll_title');
        const message = t('confirm_close_poll_msg');

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
                    content: t('poll_closed_notif').replace('{question}', localPoll.question),
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
                    window.alert(t('failed_close_poll'));
                } else {
                    Alert.alert(t('error'), t('failed_close_poll'));
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
                        text: t('close'),
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

        const title = t('delete_poll_title');
        let message = '';

        if (isCreator) {
            message = t('creator_delete_poll_msg');
        } else if (isModerator) {
            message = t('moderator_delete_poll_msg');
        }

        const executeDelete = async () => {
            try {
                console.log('🗑️ Attempting to delete poll:', localPoll.id);
                const result: any = await collaborationService.deletePoll(spaceId, localPoll.id);
                console.log('✅ Delete successful:', result);

                // Show appropriate message
                if (Platform.OS === 'web') {
                    if (result && result.deleted_by === 'creator' && result.total_copies_deleted > 0) {
                        window.alert(t('poll_deleted_copies_msg').replace('{count}', String(result.total_copies_deleted)));
                    } else {
                        window.alert(t('poll_deleted_success'));
                    }
                } else {
                    if (result && result.deleted_by === 'creator' && result.total_copies_deleted > 0) {
                        Alert.alert(t('success'), t('poll_deleted_copies_msg').replace('{count}', String(result.total_copies_deleted)));
                    } else {
                        Alert.alert(t('success'), t('poll_deleted_success'));
                    }
                }

                if (onDelete) onDelete(localPoll.id);
            } catch (error: any) {
                console.error('❌ Delete failed:', error);
                if (Platform.OS === 'web') {
                    window.alert(error.response?.data?.message || t('failed_delete_poll_msg'));
                } else {
                    Alert.alert(t('error'), error.response?.data?.message || t('failed_delete_poll_msg'));
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
                        text: t('delete'),
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
            await collaborationService.sendMessage(spaceId, {
                content: t('poll_updated_notif').replace('{question}', updatedPoll.question),
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

        const message = t('poll_results_title').replace('{question}', localPoll.question) + '\n\n' +
            calculatedOptions.map((opt: any) =>
                `${opt.text}: ${opt.voteCount} ${opt.voteCount !== 1 ? t('votes_plural') : t('votes_singular')} (${opt.percentage}%)`
            ).join('\n') +
            `\n\n${t('total_votes_label').replace('{count}', String(localPoll.total_votes || 0))}`;

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
            Alert.alert(t('success'), t('results_shared_chat'));
            setShowShareResultsModal(false);
        } catch (error) {
            console.error('Error sharing results:', error);
            Alert.alert(t('error'), t('failed_share_results'));
        }
    }, [spaceId, shareMessage, localPoll.id, collaborationService]);

    // Load available spaces for forwarding
    const loadAvailableSpaces = useCallback(async () => {
        setIsLoadingSpaces(true);
        try {
            const result = await collaborationService.fetchUserSpaces(currentUserId);
            const userSpaces = result.spaces;
            const filtered = userSpaces.filter(s => s.id !== spaceId);
            setAvailableSpaces(filtered);
        } catch (error) {
            console.error('Error loading spaces:', error);
            Alert.alert(t('error'), t('failed_load_spaces_msg'));
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
            Alert.alert(t('error'), t('select_one_space_error'));
            return;
        }

        try {
            const targetSpaceIds = Array.from(selectedSpaces);
            await collaborationService.forwardPoll(localPoll.id, targetSpaceIds);

            for (const targetSpaceId of targetSpaceIds) {
                await collaborationService.sendMessage(targetSpaceId, {
                    content: t('poll_forwarded_notif').replace('{question}', localPoll.question),
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
                t('success'),
                t('poll_forwarded_success').replace('{count}', String(targetSpaceIds.length)),
                [{ text: t('ok') }]
            );

            setShowForwardModal(false);
            setSelectedSpaces(new Set());

            if (onForward) {
                onForward(localPoll.id, targetSpaceIds);
            }
        } catch (error) {
            console.error('Error forwarding poll:', error);
            Alert.alert(t('error'), t('failed_forward_poll'));
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
                                    {option.voteCount || 0} {option.voteCount !== 1 ? t('votes_plural') : t('votes_singular')}
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
            <View style={inChatMode ? [styles.chatModeContainer] : styles.container}>
                {/* Header — hidden in chat mode as bubble already has avatar/name */}
                {!inChatMode && (
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.creatorInfo}
                            onPress={() => setShowVotersModal(true)} // Open voters modal on creator tap
                        >
                            <Avatar
                                source={localPoll?.creator?.profile_photo}
                                size={32}
                                name={localPoll?.creator?.name || t('user')}
                            />
                            <View style={styles.creatorText}>
                                <Text style={styles.creatorName}>
                                    {localPoll?.creator?.name || t('user')}
                                </Text>
                                <Text style={styles.timestamp}>
                                    {localPoll?.created_at
                                        ? new Date(localPoll.created_at).toLocaleString()
                                        : t('time_just_now')}
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
                                        {t(`poll_status_${localPoll?.status || 'active'}`)}
                                    </Text>
                                </View>
                                <View style={styles.typeBadge}>
                                    <Text style={styles.typeText}>{t(`${localPoll?.type || 'single'}_choice`)}</Text>
                                </View>
                            </View>

                            {/* Three dots menu — only visible outside chat; in chat the MessageContextMenu is used */}
                            {!inChatMode && (canClose || canForward || canEdit || canDelete || canShareResults) && (
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
                )}

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
                                ? t('closed_label_colon').replace('{time}', new Date(localPoll.deadline).toLocaleString())
                                : t('clozes_label_colon').replace('{time}', new Date(localPoll.deadline).toLocaleString())}
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
                        <Ionicons name="people" size={14} color="#666" /> {localPoll?.unique_voters || 0} { (localPoll?.unique_voters || 0) !== 1 ? t('participants_plural') : t('participant_singular')}
                        {' • '}
                        <Ionicons name="checkbox" size={14} color="#666" /> {localPoll?.total_votes || 0} { (localPoll?.total_votes || 0) !== 1 ? t('votes_plural') : t('votes_singular')}
                    </Text>
                    {localPoll?.settings?.quorum && (
                        <Text style={[
                            styles.quorumText,
                            (localPoll?.unique_voters || 0) >= localPoll.settings.quorum && styles.quorumMet
                        ]}>
                            {t('quorum_label')}: {localPoll?.unique_voters || 0}/{localPoll.settings.quorum}
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
                                    {t('submit_vote_btn').replace('{count}', String(selectedOptions.size))}
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
                            {t('forwarded_from_msg').replace('{count}', String(localPoll.forwarded_from.length))}
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
                        label: t('view_results_label'),
                        onPress: handleViewResults,
                        color: '#007AFF'
                    }] : []),
                    ...(canShareResults ? [{
                        icon: 'share-social',
                        label: t('share_results_label'),
                        onPress: handleShareResults,
                        color: '#9C27B0'
                    }] : []),
                    ...(canForward ? [{
                        icon: 'share',
                        label: t('forward_to_spaces_label'),
                        onPress: handleForwardPress,
                        color: '#4CAF50'
                    }] : []),
                    ...(canEdit ? [{
                        icon: 'create',
                        label: t('edit_poll_label'),
                        onPress: handleEditPoll,
                        color: '#FFA726'
                    }] : []),
                    ...(canClose ? [{
                        icon: 'lock-closed',
                        label: t('close_poll_label'),
                        onPress: handleClosePoll,
                        color: '#FF6B6B'
                    }] : []),
                    ...(canDelete ? [{
                        icon: 'trash',
                        label: t('delete_poll_label'),
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
                    <View style={[styles.editModalContainer, GlobalStyles.popupContainer]}>
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
                        style={[styles.modalContent, GlobalStyles.popupContainer]}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('share_poll_results_title')}</Text>
                            <TouchableOpacity onPress={() => setShowShareResultsModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalDescription}>
                            {t('share_results_description')}
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
                                <Text style={styles.modalButtonTextCancel}>{t('cancel')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonConfirm]}
                                onPress={handleSendResults}
                            >
                                <Text style={styles.modalButtonTextConfirm}>{t('send_to_chat_btn')}</Text>
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
                        style={[styles.modalContent, GlobalStyles.popupContainer]}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('forward_poll_title')}</Text>
                            <TouchableOpacity onPress={() => setShowForwardModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalDescription}>
                            {t('forward_poll_description')}
                        </Text>

                        <TextInput
                            style={styles.searchInput}
                            placeholder={t('search_spaces_placeholder')}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            clearButtonMode="while-editing"
                        />

                        {isLoadingSpaces ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#007AFF" />
                                <Text style={styles.loadingText}>{t('loading_spaces_msg')}</Text>
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
                                    <Text style={styles.emptyText}>{t('no_spaces_available')}</Text>
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
                                <Text style={styles.modalButtonTextCancel}>{t('cancel')}</Text>
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
                                    {t('forward_count_btn').replace('{count}', String(selectedSpaces.size))}
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


function getStyles(colors: any, activeScheme: string, isRTL: boolean) {
    return StyleSheet.create({
    container: {
        backgroundColor: activeScheme === 'dark' ? colors.surface : '#fff',
        borderRadius: 16,
        padding: 16,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: activeScheme === 'dark' ? colors.border : '#f0f0f0',
        ...createShadow({
            width: 0,
            height: 2,
            opacity: 0.05,
            radius: 8,
            elevation: 2,
        }),
    },
    chatModeContainer: {
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    creatorInfo: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        flex: 1,
    },
    creatorText: {
        marginLeft: isRTL ? 0 : 10,
        marginRight: isRTL ? 10 : 0,
    },
    creatorName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    timestamp: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    headerRight: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
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
        backgroundColor: activeScheme === 'dark' ? colors.muted : '#f0f0f0',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeText: {
        fontSize: 10,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    menuButton: {
        padding: 4,
    },
    question: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 12,
        lineHeight: 24,
        textAlign: isRTL ? 'right' : 'left',
    },
    deadlineContainer: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    deadlineText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginLeft: isRTL ? 0 : 6,
        marginRight: isRTL ? 6 : 0,
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
        borderColor: activeScheme === 'dark' ? colors.border : '#e0e0e0',
        borderRadius: 12,
        padding: 12,
        backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
    },
    optionSelected: {
        borderColor: colors.tint,
        backgroundColor: colors.tint + '15',
    },
    optionDisabled: {
        opacity: 0.6,
    },
    optionContent: {
        flex: 1,
        alignItems: isRTL ? 'flex-end' : 'flex-start',
    },
    optionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionText: {
        fontSize: 16,
        color: colors.text,
        flex: 1,
        textAlign: isRTL ? 'right' : 'left',
    },
    optionTextSelected: {
        fontWeight: '500',
        color: colors.tint,
    },
    votedBadge: {
        marginLeft: 8,
    },
    resultContainer: {
        gap: 4,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: activeScheme === 'dark' ? colors.muted : '#f0f0f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.tint,
        borderRadius: 3,
    },
    progressBarSelected: {
        backgroundColor: '#4CAF50',
    },
    voteInfo: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        marginTop: 4,
        alignItems: 'center',
    },
    voteCount: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    percentageText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.tint,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    statsText: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: isRTL ? 'right' : 'left',
    },
    quorumText: {
        fontSize: 12,
        color: '#FFA726',
    },
    quorumMet: {
        color: '#4CAF50',
    },
    tagsContainer: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        marginTop: 12,
        gap: 8,
    },
    tag: {
        backgroundColor: activeScheme === 'dark' ? colors.muted : '#f0f0f0',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    tagText: {
        fontSize: 10,
        color: colors.textSecondary,
    },
    submitButton: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        backgroundColor: colors.tint,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        gap: 8,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: isRTL ? 0 : 8,
        marginRight: isRTL ? 8 : 0,
    },
    forwardedContainer: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 6,
    },
    forwardedText: {
        fontSize: 11,
        color: colors.textSecondary,
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
        backgroundColor: colors.card,
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
        color: colors.text,
    },
    modalDescription: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 16,
    },
    messageInput: {
        fontSize: 16,
        padding: 12,
        backgroundColor: colors.muted,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.text,
        marginBottom: 16,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    searchInput: {
        fontSize: 16,
        padding: 12,
        backgroundColor: colors.muted,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.text,
        marginBottom: 16,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: colors.textSecondary,
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
        borderBottomColor: colors.border,
        backgroundColor: colors.card,
    },
    spaceItemSelected: {
        backgroundColor: colors.tint + '15',
    },
    spaceInfo: {
        flex: 1,
        marginLeft: 12,
    },
    spaceTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
        marginBottom: 2,
    },
    spaceType: {
        fontSize: 12,
        color: colors.textSecondary,
        textTransform: 'capitalize',
    },
    emptyText: {
        textAlign: 'center',
        padding: 20,
        color: colors.textSecondary,
        fontSize: 14,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalButtonCancel: {
        backgroundColor: colors.muted,
    },
    modalButtonConfirm: {
        backgroundColor: colors.tint,
    },
    modalButtonDisabled: {
        opacity: 0.5,
    },
    modalButtonTextCancel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    modalButtonTextConfirm: {
        fontSize: 16,
        fontWeight: '600',
        color: activeScheme === 'dark' ? '#000' : '#fff',
    },
});
}

export default PollViewer;