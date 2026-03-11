/**
 * MessageContextMenu.tsx
 *
 * A premium, Telegram-inspired message context menu — positioned
 * EXACTLY at the message that was long-pressed.
 *
 * Features:
 *  - Anchored floating card near the tapped message (auto-flips above/below)
 *  - Blurred/dimmed backdrop, non-fullscreen card
 *  - Quick emoji reaction strip
 *  - Role & ownership-aware action list
 *  - Smooth fade + scale animation
 *  - Haptic feedback
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    Clipboard,
    Platform,
    Animated,
    Dimensions,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import EmojiKeyboard from 'rn-emoji-keyboard';
import { createShadow } from '@/utils/styles';

const { width: SW, height: SH } = Dimensions.get('window');

/** Width of the floating menu card */
const CARD_W = SW > 400 ? 270 : 240;
/** Approximate height of the reaction bar */
const REACTION_H = 58;
/** Approximate height of one action row */
const ROW_H = 50;
/** Margin from screen edges */
const EDGE_PAD = 12;

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContextMessage {
    id: string;
    content?: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'voice' | 'poll' | 'album' | string;
    user?: { id: number; name: string };
    user_id?: number;
    created_at: string;
    metadata?: any;
    poll?: any;
}

export interface MessageContextMenuProps {
    visible: boolean;
    /** Message that was long-pressed */
    message: ContextMessage | null;
    /** Whether the message belongs to the current user */
    isCurrentUser: boolean;
    /** Role of the current user in the space (owner, moderator, participant, viewer) */
    currentUserRole?: string;
    /** Screen Y position of the long-pressed message bubble */
    anchorY: number;
    /** Is the bubble on the right side (current user) or left side? */
    anchorRight?: boolean;
    // ── Handlers ──────────────────────────────────────────────────────────────
    onClose: () => void;
    onReply?: (message: ContextMessage) => void;
    onForward?: (message: ContextMessage) => void;
    onReact?: (message: ContextMessage, emoji: string) => void;
    onCopy?: (message: ContextMessage) => void;
    onDeleteForAll?: (message: ContextMessage) => void;
    onDeleteForMe?: (message: ContextMessage) => void;
    onTranslate?: (message: ContextMessage) => void;
    onPin?: (message: ContextMessage) => void;
    onSelect?: (message: ContextMessage) => void;
    // ── Poll-specific handlers ─────────────────────────────────────────────────
    onClosePoll?: (message: ContextMessage) => void;
    onForwardPoll?: (message: ContextMessage) => void;
    onEditPoll?: (message: ContextMessage) => void;
    onSharePollResults?: (message: ContextMessage) => void;
}

// ─── Action Item ──────────────────────────────────────────────────────────────

interface ActionItem {
    id: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color?: string;
    destructive?: boolean;
    onPress: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const canModerate = (role?: string) =>
    role === 'owner' || role === 'moderator';

// ─── Component ───────────────────────────────────────────────────────────────

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
    visible,
    message,
    isCurrentUser,
    currentUserRole,
    anchorY,
    anchorRight = false,
    onClose,
    onReply,
    onForward,
    onReact,
    onCopy,
    onDeleteForAll,
    onDeleteForMe,
    onTranslate,
    onPin,
    onSelect,
    onClosePoll,
    onForwardPoll,
    onEditPoll,
    onSharePollResults,
}) => {
    const scaleAnim = useRef(new Animated.Value(0.88)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                    damping: 18,
                    stiffness: 260,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(scaleAnim, { toValue: 0.88, duration: 100, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
            ]).start();
        }
    }, [visible]);

    // ── Build action list ───────────────────────────────────────────────────────
    const getActions = useCallback((): ActionItem[] => {
        if (!message) return [];
        const type = message.type;
        const isPoll = type === 'poll';
        const isText = type === 'text';
        const isModerator = canModerate(currentUserRole);
        const canDelete = isCurrentUser || isModerator;

        const actions: ActionItem[] = [];

        // Reply — everyone can reply, except polls
        if (!isPoll && onReply) {
            actions.push({
                id: 'reply',
                label: 'Reply',
                icon: 'arrow-undo-outline',
                onPress: () => { onClose(); onReply(message); },
            });
        }

        // Copy — text only
        if (isText && message.content && onCopy) {
            actions.push({
                id: 'copy',
                label: 'Copy Text',
                icon: 'copy-outline',
                onPress: () => {
                    onClose();
                    onCopy(message);
                    if (Platform.OS !== 'web') Clipboard.setString(message.content || '');
                },
            });
        }

        // Translate — text only
        if (isText && message.content && onTranslate) {
            actions.push({
                id: 'translate',
                label: 'Translate',
                icon: 'language-outline',
                color: '#5856D6',
                onPress: () => { onClose(); onTranslate(message); },
            });
        }

        // Forward — not polls
        if (!isPoll && onForward) {
            actions.push({
                id: 'forward',
                label: 'Forward',
                icon: 'arrow-redo-outline',
                onPress: () => { onClose(); onForward(message); },
            });
        }

        // Pin — owner or moderator only
        if (!isPoll && isModerator && onPin) {
            actions.push({
                id: 'pin',
                label: 'Pin Message',
                icon: 'pin-outline',
                color: '#FF9500',
                onPress: () => { onClose(); onPin(message); },
            });
        }

        // Select — available for all non-poll messages
        if (!isPoll && onSelect) {
            actions.push({
                id: 'select',
                label: 'Select',
                icon: 'checkmark-circle-outline',
                onPress: () => { onClose(); onSelect(message); },
            });
        }

        // ── Poll-specific actions ──────────────────────────────────────────────
        if (isPoll) {
            const pollData = message.metadata?.pollData || message.metadata?.poll;
            const pollStatus = pollData?.status;
            const pollActive = pollStatus === 'active' || !pollStatus;
            const hasVotes = (pollData?.total_votes || 0) > 0;

            // Share Results
            if (onSharePollResults) {
                actions.push({
                    id: 'poll_share_results',
                    label: 'Share Results',
                    icon: 'share-social-outline',
                    color: '#9C27B0',
                    onPress: () => { onClose(); onSharePollResults(message); },
                });
            }

            // Forward Poll — creator or moderator
            if (pollActive && (isCurrentUser || isModerator) && onForwardPoll) {
                actions.push({
                    id: 'poll_forward',
                    label: 'Forward to Spaces',
                    icon: 'share-outline',
                    color: '#4CAF50',
                    onPress: () => { onClose(); onForwardPoll(message); },
                });
            }

            // Edit Poll — creator only, no votes yet
            if (pollActive && isCurrentUser && !hasVotes && onEditPoll) {
                actions.push({
                    id: 'poll_edit',
                    label: 'Edit Poll',
                    icon: 'create-outline',
                    color: '#007AFF',
                    onPress: () => { onClose(); onEditPoll(message); },
                });
            }

            // Close Poll — creator or moderator
            if (pollActive && (isCurrentUser || isModerator) && onClosePoll) {
                actions.push({
                    id: 'poll_close',
                    label: 'Close Poll',
                    icon: 'close-circle-outline',
                    color: '#FF9500',
                    onPress: () => { onClose(); onClosePoll(message); },
                });
            }
        }

        // ── Destructive zone ──────────────────────────────────────────────────

        // Delete for All — for polls, ONLY the owner can delete for everyone.
        // For other messages, author or moderator can delete.
        const canDeleteForAll = isPoll ? isCurrentUser : (isCurrentUser || isModerator);

        if (canDeleteForAll && onDeleteForAll) {
            actions.push({
                id: 'delete_all',
                label: isPoll ? 'Delete Poll' : 'Delete for Everyone',
                icon: 'trash',
                destructive: true,
                onPress: () => {
                    onClose();

                    if (Platform.OS === 'web') {
                        if (window.confirm(`Delete ${isPoll ? 'Poll' : 'Message'}\n\nThis will remove it for everyone.`)) {
                            onDeleteForAll(message);
                        }
                    } else {
                        Alert.alert(
                            `Delete ${isPoll ? 'Poll' : 'Message'}`,
                            'This will remove it for everyone.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => onDeleteForAll(message) },
                            ]
                        );
                    }
                },
            });
        }

        // Delete for Me — for non-poll messages only
        if (!isPoll && onDeleteForMe) {
            actions.push({
                id: 'delete_me',
                label: 'Delete for Me',
                icon: 'trash-outline',
                destructive: true,
                onPress: () => {
                    onClose();

                    if (Platform.OS === 'web') {
                        if (window.confirm('Delete Message\n\nRemove this message from your view only?')) {
                            onDeleteForMe(message);
                        }
                    } else {
                        Alert.alert(
                            'Delete Message',
                            'Remove this message from your view only?',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => onDeleteForMe(message) },
                            ]
                        );
                    }
                },
            });
        }

        return actions;
    }, [message, isCurrentUser, currentUserRole, onClose, onReply, onCopy, onTranslate, onForward, onPin, onSelect, onDeleteForAll, onDeleteForMe, onClosePoll, onForwardPoll, onEditPoll, onSharePollResults]);

    const handleQuickReact = (emoji: string) => {
        if (!message) return;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        onReact?.(message, emoji);
        onClose();
    };

    const handlePickerReact = (emojiObj: { emoji: string }) => {
        if (!message) return;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        onReact?.(message, emojiObj.emoji);
        setEmojiPickerOpen(false);
        onClose();
    };

    if (!message) return null;

    const isPoll = message.type === 'poll';
    const showReactions = !isPoll && !!onReact;
    const actions = getActions();

    // ── Position calculation ─────────────────────────────────────────────────
    // Estimate total height of menu card
    const cardRows = Math.min(actions.length, 6);
    const estimatedCardHeight =
        (showReactions ? REACTION_H + 1 : 0) +
        cardRows * ROW_H +
        44; // meta strip

    // Decide: should card appear ABOVE or BELOW the message?
    const spaceBelow = SH - anchorY;
    const openUpward = spaceBelow < estimatedCardHeight + 80;
    const cardTop = openUpward
        ? Math.max(EDGE_PAD, anchorY - estimatedCardHeight - 12)
        : anchorY + 8;

    // Decide: left or right align, stay within screen
    const rightEdge = SW - EDGE_PAD;
    const cardLeft = anchorRight
        ? Math.max(EDGE_PAD, rightEdge - CARD_W)
        : Math.min(EDGE_PAD, rightEdge - CARD_W);
    const clampedLeft = Math.max(EDGE_PAD, Math.min(rightEdge - CARD_W, anchorRight ? SW - CARD_W - EDGE_PAD : EDGE_PAD));

    return (
        <>
            {/* ── Main context menu modal ── */}
            <Modal
                transparent
                visible={visible}
                animationType="none"
                statusBarTranslucent
                onRequestClose={onClose}
            >
                {/* ── Dimmed backdrop */}
                <TouchableWithoutFeedback onPress={onClose}>
                    <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
                        {Platform.OS !== 'web' ? (
                            <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
                        ) : (
                            <View style={[StyleSheet.absoluteFill, styles.webBackdrop]} />
                        )}
                    </Animated.View>
                </TouchableWithoutFeedback>

                {/* ── Floating Card */}
                <Animated.View
                    style={[
                        styles.card,
                        {
                            top: cardTop,
                            left: clampedLeft,
                            opacity: opacityAnim,
                            transform: [
                                { scale: scaleAnim },
                                {
                                    translateY: openUpward
                                        ? scaleAnim.interpolate({ inputRange: [0.88, 1], outputRange: [10, 0] })
                                        : scaleAnim.interpolate({ inputRange: [0.88, 1], outputRange: [-10, 0] })
                                },
                            ],
                        },
                    ]}
                    pointerEvents="box-none"
                >
                    <TouchableWithoutFeedback>
                        <View>

                            {/* Reaction bar */}
                            {showReactions && (
                                <>
                                    <View style={styles.reactionRow}>
                                        {QUICK_REACTIONS.map((emoji) => (
                                            <TouchableOpacity
                                                key={emoji}
                                                style={styles.reactionBtn}
                                                activeOpacity={0.65}
                                                onPress={() => handleQuickReact(emoji)}
                                            >
                                                <Text style={styles.reactionEmoji}>{emoji}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        <TouchableOpacity
                                            style={[styles.reactionBtn, styles.reactionBtnMore]}
                                            activeOpacity={0.65}
                                            onPress={() => setEmojiPickerOpen(true)}
                                        >
                                            <Ionicons name="add" size={18} color="#8E8E93" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.divider} />
                                </>
                            )}

                            {/* Actions */}
                            <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: ROW_H * 7 }}>
                                {actions.map((action, index) => {
                                    const prevDestructive = actions[index - 1]?.destructive;
                                    const showTopSep = action.destructive && !prevDestructive && index > 0;
                                    return (
                                        <React.Fragment key={action.id}>
                                            {showTopSep && <View style={styles.divider} />}
                                            <TouchableOpacity
                                                style={styles.actionRow}
                                                activeOpacity={0.7}
                                                onPress={action.onPress}
                                            >
                                                <Ionicons
                                                    name={action.icon}
                                                    size={19}
                                                    color={action.destructive ? '#FF453A' : action.color ?? '#3A7AFE'}
                                                />
                                                <Text
                                                    style={[
                                                        styles.actionLabel,
                                                        action.destructive && styles.actionLabelDestructive,
                                                        action.color && !action.destructive && { color: action.color },
                                                    ]}
                                                >
                                                    {action.label}
                                                </Text>
                                            </TouchableOpacity>
                                        </React.Fragment>
                                    );
                                })}
                            </ScrollView>

                            {/* Meta footer */}
                            <View style={styles.metaRow}>
                                <Text style={styles.metaText} numberOfLines={1}>
                                    {message.user?.name ?? 'Unknown'} · {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>

                        </View>
                    </TouchableWithoutFeedback>
                </Animated.View>
            </Modal>

            {/* ── Full Emoji Picker (opens from + button) ── */}
            <EmojiKeyboard
                open={emojiPickerOpen}
                onClose={() => setEmojiPickerOpen(false)}
                onEmojiSelected={handlePickerReact}
                emojiSize={32}
                enableSearchBar
                categoryPosition="bottom"
            />
        </>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.38)',
    },
    webBackdrop: {
        backgroundColor: 'rgba(0,0,0,0.42)',
    } as any,
    // ── Card ────────────────────────────────────────────────
    card: {
        position: 'absolute',
        width: CARD_W,
        backgroundColor: '#1C1C1E',
        borderRadius: 18,
        overflow: 'hidden',
        ...createShadow({ width: 0, height: 8, opacity: 0.36, radius: 24, elevation: 20 }),
    },
    // ── Reactions ───────────────────────────────────────────
    reactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 10,
        gap: 4,
    },
    reactionBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 5,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.07)',
    },
    reactionBtnMore: {
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    reactionEmoji: {
        fontSize: 20,
    },
    // ── Divider ─────────────────────────────────────────────
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.13)',
    },
    // ── Action row ──────────────────────────────────────────
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 13,
    },
    actionLabel: {
        flex: 1,
        fontSize: 15.5,
        fontWeight: '500',
        color: '#EBEBF5',
        letterSpacing: -0.1,
    },
    actionLabelDestructive: {
        color: '#FF453A',
    },
    // ── Meta ────────────────────────────────────────────────
    metaRow: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.10)',
    },
    metaText: {
        fontSize: 11.5,
        color: '#636366',
        letterSpacing: -0.1,
    },
});

export default MessageContextMenu;
