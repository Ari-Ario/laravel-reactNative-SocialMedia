// components/Notifications/CallsPanel.tsx
// Displays call notifications grouped by space (Instagram-style).
// Marks all calls as read when the panel opens.
import React, { useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Modal,
    Platform,
    useWindowDimensions,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { createShadow } from '@/utils/styles';
import { useNotificationStore } from '@/stores/notificationStore';
import { Notification } from '@/types/Notification';
import Avatar from '../Image/Avatar';
import { router } from 'expo-router';
import { useTranslation } from '@/constants/i18n';
import { formatTimeAgo } from '@/utils/dateUtils';
import { groupNotifications, getGroupSummary, NotificationGroup } from '@/utils/groupNotifications';

type CallsPanelProps = {
    visible: boolean;
    onClose: () => void;
    anchorPosition?: { top: number; left?: number; right?: number; arrowOffset?: number };
};

const CallsPanel = ({ visible, onClose, anchorPosition }: CallsPanelProps) => {
    const { colors, activeScheme } = useAppTheme();
    const { t } = useTranslation();
    const { width: windowWidth } = useWindowDimensions();
    const panelWidth = Math.min(windowWidth - 16, 420);

    const {
        getCalls,
        markAsRead,
        markCallsAsRead,
        removeNotification,
    } = useNotificationStore();

    const calls = getCalls();
    const groups = groupNotifications(calls);

    // ✅ Mark all calls as read when panel opens
    useEffect(() => {
        if (visible && calls.some(c => !c.isRead)) {
            // Small delay so the badge animation looks smooth
            const timer = setTimeout(() => markCallsAsRead(), 300);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    const handleGroupPress = useCallback((group: NotificationGroup) => {
        const { latestNotification, notifications } = group;

        // Mark all in group as read
        notifications.forEach(n => { if (!n.isRead) markAsRead(n.id); });

        const spaceId = latestNotification.spaceId ||
            latestNotification.data?.space_id ||
            latestNotification.data?.space?.id;

        if (spaceId) {
            router.replace({
                pathname: '/(spaces)/[id]',
                params: {
                    id: spaceId,
                    tab: 'calls',
                }
            });
        }
        onClose();
    }, [markAsRead, onClose]);

    const handleRemoveGroup = useCallback((group: NotificationGroup, e: any) => {
        e.stopPropagation();
        group.notifications.forEach(n => removeNotification(n.id));
    }, [removeNotification]);

    const renderGroupItem = useCallback(({ item: group }: { item: NotificationGroup }) => {
        const isIncoming = group.type === 'call_started' || group.type === 'incoming_call';
        const isMissed = group.type === 'call_ended';
        const iconName: any = isIncoming ? 'call' : isMissed ? 'call-outline' : 'videocam';
        const iconColor = isMissed ? '#FF3B30' : '#4CD964';
        const summary = getGroupSummary(group, t);
        const timeStr = formatTimeAgo(group.latestNotification.createdAt);
        const showCount = group.count > 1;

        return (
            <TouchableOpacity
                style={[
                    styles.groupItem,
                    { borderBottomColor: colors.border },
                    group.hasUnread && styles.unreadItem,
                    group.hasUnread && { backgroundColor: iconColor + '0D', borderLeftColor: iconColor },
                ]}
                onPress={() => handleGroupPress(group)}
                activeOpacity={0.7}
            >
                {/* Avatar Stack */}
                <View style={styles.avatarStack}>
                    {group.actorAvatars.slice(0, 2).map((av, idx) => (
                        <View
                            key={idx}
                            style={[
                                styles.stackedAvatar,
                                { left: idx * 18, zIndex: 3 - idx, borderColor: colors.surface },
                            ]}
                        >
                            <Avatar
                                source={av}
                                name={group.actorNames[idx] || group.latestNotification.title}
                                size={44}
                                showStatus={false}
                            />
                        </View>
                    ))}
                    {/* Count bubble */}
                    {showCount && (
                        <View style={[styles.countBubble, { backgroundColor: iconColor, borderColor: colors.surface }]}>
                            <Text style={styles.countBubbleText}>{group.count}</Text>
                        </View>
                    )}
                </View>

                {/* Content */}
                <View style={styles.groupContent}>
                    <View style={styles.titleRow}>
                        <View style={styles.titleWithIcon}>
                            <View style={[styles.iconBadge, { backgroundColor: iconColor + '22' }]}>
                                <Ionicons name={iconName} size={14} color={iconColor} />
                            </View>
                            <Text style={[styles.groupTitle, { color: colors.text }]} numberOfLines={1}>
                                {group.spaceName || group.latestNotification.title}
                            </Text>
                        </View>
                        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{timeStr}</Text>
                    </View>

                    <Text style={[styles.summaryText, { color: colors.textSecondary }]} numberOfLines={2}>
                        {summary}
                    </Text>

                    {/* Actor names pill */}
                    {group.actorNames.length > 0 && (
                        <View style={styles.actorsRow}>
                            <Text style={[styles.actorsText, { color: colors.textSecondary }]}>
                                {group.actorNames.slice(0, 2).join(', ')}
                                {group.actorNames.length > 2 && ` ${t('and_n_more', { count: group.actorNames.length - 2 })}`}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Unread dot */}
                {group.hasUnread && (
                    <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />
                )}

                {/* Remove */}
                <TouchableOpacity
                    onPress={(e) => handleRemoveGroup(group, e)}
                    style={[styles.deleteButton, { backgroundColor: colors.muted }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="close" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    }, [colors, t, handleGroupPress, handleRemoveGroup]);

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

            <View
                style={[
                    styles.panelContainer,
                    { backgroundColor: colors.surface, borderColor: colors.border, width: panelWidth },
                    anchorPosition ? {
                        top: anchorPosition.top + 15,
                        left: anchorPosition.left,
                        right: anchorPosition.right,
                    } : [styles.defaultPosition, { left: (windowWidth - panelWidth) / 2 }],
                ]}
            >
                {/* Pointer Arrow */}
                {anchorPosition && (
                    <View
                        style={[
                            styles.pointer,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                            anchorPosition.right !== undefined
                                ? { right: anchorPosition.arrowOffset }
                                : { left: anchorPosition.arrowOffset }
                        ]}
                    />
                )}

                <View style={[styles.contentWrapper, { borderRadius: 16 }]}>
                    {/* Header */}
                    <View style={[styles.panelHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
                        <View style={styles.headerLeft}>
                            <View style={[styles.headerIconBg, { backgroundColor: '#4CD96422' }]}>
                                <Ionicons name="call" size={16} color="#4CD964" />
                            </View>
                            <View>
                                <Text style={[styles.panelTitle, { color: colors.text }]}>
                                    {t('calls_count', { count: groups.length })}
                                </Text>
                                {calls.filter(c => !c.isRead).length > 0 && (
                                    <Text style={[styles.unreadHint, { color: '#4CD964' }]}>
                                        {calls.filter(c => !c.isRead).length} unread
                                    </Text>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.muted }]}>
                            <Ionicons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* List */}
                    <View style={{ flex: 1 }}>
                        {groups.length === 0 ? (
                            <View style={styles.emptyState}>
                                <View style={[styles.emptyIconBg, { backgroundColor: colors.muted }]}>
                                    <Ionicons name="call-outline" size={40} color={colors.textSecondary + '80'} />
                                </View>
                                <Text style={[styles.emptyText, { color: colors.text }]}>{t('no_calls')}</Text>
                                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                                    {t('no_calls_desc')}
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={groups}
                                renderItem={renderGroupItem}
                                keyExtractor={(g) => g.key}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                                indicatorStyle={activeScheme === 'dark' ? 'white' : 'black'}
                            />
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    panelContainer: {
        position: 'absolute',
        maxHeight: 520,
        borderRadius: 20,
        ...createShadow({ width: 0, height: 8, opacity: 0.18, radius: 20, elevation: 12 }),
        borderWidth: 1,
        zIndex: 1000,
        overflow: 'hidden',
    },
    defaultPosition: {
        top: 90,
    },
    contentWrapper: {
        flex: 1,
        overflow: 'hidden',
    },
    pointer: {
        position: 'absolute',
        top: -10,
        width: 20,
        height: 20,
        transform: [{ rotate: '45deg' }],
        borderTopWidth: 1,
        borderLeftWidth: 1,
        zIndex: -1,
    },
    panelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerIconBg: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    panelTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    unreadHint: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 1,
    },
    closeButton: {
        padding: 6,
        borderRadius: 20,
    },
    listContent: {
        flexGrow: 1,
        paddingVertical: 4,
    },
    groupItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    unreadItem: {
        borderLeftWidth: 3,
    },
    avatarStack: {
        width: 62,
        height: 48,
        position: 'relative',
        flexShrink: 0,
    },
    stackedAvatar: {
        position: 'absolute',
        top: 0,
        borderWidth: 2,
        borderRadius: 24,
        overflow: 'hidden',
    },
    countBubble: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    countBubbleText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
    },
    groupContent: {
        flex: 1,
        gap: 3,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titleWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    iconBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    groupTitle: {
        fontWeight: '600',
        fontSize: 14,
        flex: 1,
    },
    timeText: {
        fontSize: 11,
        marginLeft: 8,
        flexShrink: 0,
    },
    summaryText: {
        fontSize: 13,
        lineHeight: 18,
    },
    actorsRow: {
        marginTop: 2,
    },
    actorsText: {
        fontSize: 11,
        fontStyle: 'italic',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        flexShrink: 0,
        marginRight: 4,
    },
    deleteButton: {
        padding: 6,
        borderRadius: 14,
        width: 26,
        height: 26,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 32,
        gap: 12,
    },
    emptyIconBg: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default CallsPanel;