// components/ChatScreen/InlinePollCard.tsx
// Renders a fully interactive poll directly inside the chat message list (WhatsApp-style).
// ──────────────────────────────────────────────────────────────────────────────
// Performance notes:
//   • The entire component is wrapped in React.memo with a custom equality check
//     so FlatList re-renders only when poll data actually changes.
//   • Progress bar widths are driven by Animated.Value to skip the JS-bridge
//     on subsequent renders.
//   • All callbacks are stable (defined with useCallback).
// ──────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Platform,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { createShadow } from '@/utils/styles';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PollOption {
    id: string;
    text: string;
    votes?: any[];
    voters?: any[];
    votes_count?: number;
}

interface InlinePollData {
    id: string;
    question: string;
    options: PollOption[];
    type?: 'single' | 'multiple' | 'ranked' | 'weighted';
    settings?: {
        allowMultipleVotes?: boolean;
        allowVoteChange?: boolean;
        showResults?: 'always' | 'after_vote' | 'after_deadline' | 'creator_only';
        anonymous?: boolean;
        maxSelections?: number;
    };
    status?: 'active' | 'closed' | 'archived';
    created_by?: number | string;
    creator?: { id: number; name: string };
    deadline?: string;
    total_votes?: number;
    unique_voters?: number;
}

interface InlinePollCardProps {
    poll: InlinePollData;
    spaceId: string;
    currentUserId: number;
    /** Creator's name for the "by…" subtitle */
    creatorName?: string;
    /** ISO timestamp for the "time" display */
    createdAt?: string;
    /** Whether this user created the message (right-bubble vs left) */
    isCurrentUser?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTime = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getTotalVotes = (options: PollOption[]): number =>
    options.reduce((sum, o) => sum + (o.votes_count ?? o.votes?.length ?? 0), 0);

const getOptionVotes = (option: PollOption): number =>
    option.votes_count ?? option.votes?.length ?? 0;

const didUserVote = (options: PollOption[], userId: number): string | null => {
    for (const opt of options) {
        const voters = opt.voters ?? [];
        const votes = opt.votes ?? [];
        const inVoters = voters.some(
            (v: any) => String(v.userId ?? v.id ?? v.user_id) === String(userId),
        );
        const inVotes = votes.some(
            (v: any) => String(v.user_id ?? v.userId ?? v) === String(userId),
        );
        if (inVoters || inVotes) return opt.id;
    }
    return null;
};

// ─── Option Row ──────────────────────────────────────────────────────────────

interface OptionProps {
    option: PollOption;
    totalVotes: number;
    isSelected: boolean;
    hasVoted: boolean;
    showResults: boolean;
    closed: boolean;
    onSelect: (id: string) => void;
}

const PollOptionRow = React.memo<OptionProps>(({
    option,
    totalVotes,
    isSelected,
    hasVoted,
    showResults,
    closed,
    onSelect,
}) => {
    const votes = getOptionVotes(option);
    const pct = totalVotes > 0 ? votes / totalVotes : 0;
    const barAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(barAnim, {
            toValue: pct,
            duration: 350,
            useNativeDriver: false,
        }).start();
    }, [pct]);

    const canTap = !closed && (!hasVoted || true); // we allow tap; logic handled by parent
    const showBar = showResults && (hasVoted || closed);

    return (
        <TouchableOpacity
            onPress={() => canTap && onSelect(option.id)}
            activeOpacity={closed ? 1 : 0.78}
            style={[
                styles.optionRow,
                isSelected && styles.optionRowSelected,
                closed && styles.optionRowClosed,
            ]}
        >
            {/* Animated progress fill — absolutely positioned background */}
            {showBar && (
                <Animated.View
                    style={[
                        styles.optionFill,
                        isSelected && styles.optionFillSelected,
                        {
                            width: barAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                            }) as any,
                        },
                    ]}
                />
            )}

            {/* Radio/check icon */}
            <View style={[styles.optionCheck, isSelected && styles.optionCheckSelected]}>
                {isSelected && <View style={styles.optionCheckInner} />}
            </View>

            {/* Label */}
            <Text
                style={[styles.optionText, isSelected && styles.optionTextSelected]}
                numberOfLines={2}
            >
                {option.text}
            </Text>

            {/* Vote count — only when results are exposed */}
            {showBar && (
                <Text style={styles.optionPct}>
                    {Math.round(pct * 100)}%
                </Text>
            )}
        </TouchableOpacity>
    );
}, (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.hasVoted === next.hasVoted &&
    prev.showResults === next.showResults &&
    prev.totalVotes === next.totalVotes &&
    prev.closed === next.closed &&
    getOptionVotes(prev.option) === getOptionVotes(next.option)
);

// ─── Main Card ───────────────────────────────────────────────────────────────

const InlinePollCard: React.FC<InlinePollCardProps> = ({
    poll: pollProp,
    spaceId,
    currentUserId,
    creatorName,
    createdAt,
    isCurrentUser = false,
}) => {
    const collaborationService = CollaborationService.getInstance();

    // Local poll state (for optimistic updates)
    const [poll, setPoll] = useState<InlinePollData>(pollProp);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hasVoted, setHasVoted] = useState(false);
    const [voting, setVoting] = useState(false);

    // Sync when parent sends fresh poll data
    useEffect(() => {
        setPoll(pollProp);
        const voted = didUserVote(pollProp.options, currentUserId);
        setHasVoted(!!voted);
        if (voted) setSelectedId(voted);
    }, [pollProp, currentUserId]);

    // ── Derived ──────────────────────────────────────────────────────────────
    const closed = poll.status === 'closed' || poll.status === 'archived';
    const isPast = !!(poll.deadline && new Date() > new Date(poll.deadline));
    const isEffectivelyClosed = closed || isPast;

    const totalVotes = useMemo(() => getTotalVotes(poll.options), [poll.options]);

    const showResults = useMemo(() => {
        const s = poll.settings?.showResults ?? 'after_vote';
        if (s === 'always') return true;
        if (s === 'after_vote' && hasVoted) return true;
        if (s === 'creator_only' && String(poll.created_by) === String(currentUserId)) return true;
        if (s === 'after_deadline' && isPast) return true;
        return isEffectivelyClosed;
    }, [poll.settings, hasVoted, isEffectivelyClosed, isPast, poll.created_by, currentUserId]);

    // ── Vote logic (with optimistic update) ──────────────────────────────────
    const handleSelect = useCallback(async (optionId: string) => {
        if (isEffectivelyClosed) return;
        if (hasVoted && !poll.settings?.allowVoteChange) return;
        if (voting) return;

        // For multiple-choice: toggle selection (no immediate submission)
        const isMultiple = poll.type === 'multiple';
        // For single: submit immediately (WhatsApp style)
        if (!isMultiple) {
            if (selectedId === optionId && !poll.settings?.allowVoteChange) return;
            await submitVote([optionId]);
        } else {
            // Toggle selection; user still needs to press "Submit"
            setSelectedId(prev => prev === optionId ? null : optionId);
        }
    }, [isEffectivelyClosed, hasVoted, poll, voting, selectedId]);

    const submitVote = useCallback(async (optionIds: string[]) => {
        if (optionIds.length === 0) return;
        setVoting(true);

        // ── Optimistic update ────────────────────────────────────────────────
        setPoll(prev => {
            const updated = {
                ...prev,
                options: prev.options.map(o => {
                    if (optionIds.includes(o.id)) {
                        return {
                            ...o,
                            votes_count: (o.votes_count ?? o.votes?.length ?? 0) + 1,
                            voters: [...(o.voters ?? []), { userId: currentUserId, name: 'You' }],
                        };
                    }
                    return o;
                }),
                total_votes: (prev.total_votes ?? 0) + optionIds.length,
                unique_voters: (prev.unique_voters ?? 0) + (hasVoted ? 0 : 1),
            };
            return updated;
        });
        setSelectedId(optionIds[0]);
        setHasVoted(true);
        // ────────────────────────────────────────────────────────────────────

        try {
            await collaborationService.voteOnPoll(spaceId, poll.id, optionIds);
        } catch (err: any) {
            // Revert on failure
            setPoll(pollProp);
            setHasVoted(!!didUserVote(pollProp.options, currentUserId));
            if (err.response?.status === 422) {
                const msgs = Object.values(err.response.data.errors ?? {}).flat().join('\n');
                Alert.alert('Vote error', msgs);
            } else {
                Alert.alert('Vote failed', 'Please try again.');
            }
        } finally {
            setVoting(false);
        }
    }, [poll, spaceId, currentUserId, hasVoted, pollProp]);

    // ── Status badge ─────────────────────────────────────────────────────────
    const statusLabel = isEffectivelyClosed
        ? (isPast ? 'Expired' : 'Closed')
        : 'Active';

    const deadline = poll.deadline
        ? new Date(poll.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null;

    return (
        <View style={[styles.card, isCurrentUser && styles.cardRight]}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.pollIcon}>
                        <Ionicons name="bar-chart" size={14} color="#007AFF" />
                    </View>
                    <Text style={styles.pollLabel}>POLL</Text>
                    <View style={[styles.statusDot, isEffectivelyClosed && styles.statusDotClosed]} />
                    <Text style={[styles.statusText, isEffectivelyClosed && styles.statusTextClosed]}>
                        {statusLabel}
                    </Text>
                </View>
                {voting && (
                    <Ionicons name="sync" size={14} color="#007AFF" style={styles.syncIcon} />
                )}
            </View>

            {/* ── Creator / time ── */}
            {(creatorName || createdAt) && (
                <Text style={styles.meta}>
                    {creatorName ? `By ${creatorName}` : ''}
                    {creatorName && createdAt ? '  ·  ' : ''}
                    {createdAt ? formatTime(createdAt) : ''}
                </Text>
            )}

            {/* ── Question ── */}
            <Text style={styles.question} numberOfLines={4}>
                {poll.question}
            </Text>

            {/* ── Options ── */}
            <View style={styles.options}>
                {poll.options.map(opt => (
                    <PollOptionRow
                        key={opt.id}
                        option={opt}
                        totalVotes={totalVotes}
                        isSelected={selectedId === opt.id}
                        hasVoted={hasVoted}
                        showResults={showResults}
                        closed={isEffectivelyClosed}
                        onSelect={handleSelect}
                    />
                ))}
            </View>

            {/* ── Multi-choice submit button ── */}
            {poll.type === 'multiple' && !isEffectivelyClosed && !hasVoted && selectedId && (
                <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={() => selectedId ? submitVote([selectedId]) : undefined}
                    activeOpacity={0.8}
                >
                    <Text style={styles.submitBtnText}>Submit Vote</Text>
                </TouchableOpacity>
            )}

            {/* ── Footer: vote count + deadline ── */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                    {poll.unique_voters != null && poll.unique_voters !== totalVotes
                        ? `  ·  ${poll.unique_voters} voters`
                        : ''}
                </Text>
                {deadline && (
                    <Text style={[styles.footerText, styles.deadlineText]} numberOfLines={1}>
                        ⏰ {deadline}
                    </Text>
                )}
                {hasVoted && !isEffectivelyClosed && poll.settings?.allowVoteChange && (
                    <Text style={styles.changeVoteHint}>Tap to change</Text>
                )}
            </View>
        </View>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD_RADIUS = 16;

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: CARD_RADIUS,
        padding: 14,
        marginVertical: 4,
        marginHorizontal: 8,
        maxWidth: '88%',
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#E8E8E8',
        ...createShadow({ width: 0, height: 2, opacity: 0.08, radius: 8, elevation: 4 }),
    },
    cardRight: {
        alignSelf: 'flex-end',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pollIcon: {
        backgroundColor: 'rgba(0,122,255,0.10)',
        borderRadius: 6,
        padding: 3,
    },
    pollLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#007AFF',
        letterSpacing: 1.2,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#34C759',
    },
    statusDotClosed: { backgroundColor: '#999' },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#34C759',
    },
    statusTextClosed: { color: '#999' },
    syncIcon: {
        opacity: 0.5,
    },

    // Meta
    meta: {
        fontSize: 11,
        color: '#AAA',
        marginBottom: 6,
    },

    // Question
    question: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A1A',
        lineHeight: 21,
        marginBottom: 12,
    },

    // Options
    options: {
        gap: 8,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4F6FA',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 44,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    optionRowSelected: {
        borderColor: '#007AFF',
        backgroundColor: '#EBF3FF',
    },
    optionRowClosed: {
        opacity: 0.85,
    },
    optionFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,122,255,0.08)',
        borderRadius: 10,
    },
    optionFillSelected: {
        backgroundColor: 'rgba(0,122,255,0.14)',
    },
    optionCheck: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#BCC2CB',
        marginRight: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    optionCheckSelected: {
        borderColor: '#007AFF',
        backgroundColor: '#007AFF',
    },
    optionCheckInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
    },
    optionText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
        lineHeight: 19,
    },
    optionTextSelected: {
        color: '#007AFF',
        fontWeight: '600',
    },
    optionPct: {
        fontSize: 12,
        fontWeight: '700',
        color: '#666',
        marginLeft: 8,
        minWidth: 32,
        textAlign: 'right',
    },

    // Submit btn (multi)
    submitBtn: {
        marginTop: 10,
        backgroundColor: '#007AFF',
        borderRadius: 10,
        paddingVertical: 9,
        alignItems: 'center',
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },

    // Footer
    footer: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 11,
        color: '#999',
    },
    deadlineText: {
        color: '#FF9500',
    },
    changeVoteHint: {
        fontSize: 11,
        color: '#007AFF',
        fontStyle: 'italic',
    },
});

// ── Outer memo: skip full re-render if poll id+data hasn't changed ────────────
export default React.memo(InlinePollCard, (prev, next) =>
    prev.poll.id === next.poll.id &&
    getTotalVotes(prev.poll.options) === getTotalVotes(next.poll.options) &&
    prev.poll.status === next.poll.status &&
    prev.isCurrentUser === next.isCurrentUser
);
