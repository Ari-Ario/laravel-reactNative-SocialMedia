// components/Notifications/ActivitiesPanel.tsx
// Grouped-by-space activity notifications with mark-as-read on open.
import React, { useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Modal,
    useWindowDimensions,
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

type ActivitiesPanelProps = {
    visible: boolean;
    onClose: () => void;
    anchorPosition?: { top: number; left?: number; right?: number; arrowOffset?: number };
};

const getActivityIcon = (type: string): any => {
    switch (type) {
        case 'participant_joined': return 'person-add';
        case 'participant_left': return 'person-remove-outline';
        case 'magic_event': return 'sparkles';
        case 'screen_share': return 'desktop';
        case 'activity_created': return 'calendar';
        case 'activity_updated': return 'create';
        case 'activity_deleted': return 'trash';
        case 'poll_created': return 'bar-chart';
        case 'poll_deleted': return 'bar-chart-outline';
        default: return 'notifications-outline';
    }
};

const getActivityColor = (type: string): string => {
    switch (type) {
        case 'participant_joined': return '#FF9500';
        case 'participant_left': return '#8E8E93';
        case 'magic_event': return '#FF2D55';
        case 'screen_share': return '#5856D6';
        case 'activity_created': return '#FF9500';
        case 'activity_updated': return '#34C759';
        case 'activity_deleted': return '#FF3B30';
        case 'poll_created': return '#007AFF';
        default: return '#8E8E93';
    }
};

const ActivitiesPanel = ({ visible, onClose, anchorPosition }: ActivitiesPanelProps) => {
    const { colors, activeScheme } = useAppTheme();
    const { t } = useTranslation();
    const { width: windowWidth } = useWindowDimensions();
    const panelWidth = Math.min(windowWidth - 16, 420);

    const {
        getActivities,
        markAsRead,
        markActivitiesAsRead,
        removeNotification,
    } = useNotificationStore();

    const activities = getActivities();
    const groups = groupNotifications(activities);
    const unreadCount = activities.filter((n: Notification) => !n.isRead).length;

    // ✅ Mark all activities as read when panel opens
    useEffect(() => {
        if (visible && unreadCount > 0) {
            const timer = setTimeout(() => markActivitiesAsRead(), 300);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    const handleGroupPress = useCallback((group: NotificationGroup) => {
        group.notifications.forEach(n => { if (!n.isRead) markAsRead(n.id); });

        const { latestNotification: n } = group;
        const spaceId = n.spaceId || n.data?.space_id || n.data?.space?.id;
        const activityId = n.data?.activity?.id || n.data?.activity_id;

        if (spaceId) {
            const tab = (n.type === 'activity_created' || n.type === 'activity_updated')
                ? 'calendar'
                : n.type === 'magic_event' ? 'magic' : 'chat';

            router.replace({
                pathname: '/(spaces)/[id]',
                params: {
                    id: spaceId,
                    tab,
                    ...(activityId ? { activity: activityId.toString() } : {}),
                }
            });
        }
        onClose();
    }, [markAsRead, onClose]);

    const renderGroupItem = useCallback(({ item: group }: { item: NotificationGroup }) => {
        const { latestNotification: n } = group;
        const summary = getGroupSummary(group, t);
        const timeStr = formatTimeAgo(n.createdAt);
        const accentColor = getActivityColor(group.type);
        const iconName = getActivityIcon(group.type);

        return (
            <TouchableOpacity
                style={[
                    styles.groupItem,
                    { borderBottomColor: colors.border },
                    group.hasUnread && styles.unreadItem,
                    group.hasUnread && { backgroundColor: accentColor + '0D', borderLeftColor: accentColor },
                ]}
                onPress={() => handleGroupPress(group)}
                activeOpacity={0.7}
            >
                {/* Icon badge + avatar stack */}
                <View style={styles.avatarWrapper}>
                    <Avatar source={n.avatar} name={n.title} size={46} showStatus={false} />
                    <View style={[styles.typeBadge, { backgroundColor: accentColor, borderColor: colors.surface }]}>
                        <Ionicons name={iconName} size={10} color="#fff" />
                    </View>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <View style={styles.titleRow}>
                        <View style={styles.titleWithIcon}>
                            <Text style={[styles.groupTitle, { color: colors.text }]} numberOfLines={1}>
                                {group.spaceName || n.title}
                            </Text>
                        </View>
                        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{timeStr}</Text>
                    </View>

                    <Text style={[styles.summaryText, { color: colors.textSecondary }]} numberOfLines={2}>
                        {summary}
                    </Text>

                    {/* Actor count for participant notifications */}
                    {group.count > 1 && (
                        <View style={[styles.countChip, { backgroundColor: accentColor + '22' }]}>
                            <Ionicons name={iconName} size={11} color={accentColor} />
                            <Text style={[styles.countChipText, { color: accentColor }]}>
                                {group.count}× {n.type === 'participant_joined' ? t('n_people_joined', { count: '', space: '' }).split(' ')[0] : ''}
                            </Text>
                        </View>
                    )}
                </View>

                {group.hasUnread && (
                    <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />
                )}

                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation();
                        group.notifications.forEach(n2 => removeNotification(n2.id));
                    }}
                    style={[styles.deleteButton, { backgroundColor: colors.muted }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="close" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    }, [colors, t, handleGroupPress, removeNotification]);

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
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

                <View style={styles.contentWrapper}>
                    <View style={[styles.panelHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
                        <View style={styles.headerLeft}>
                            <View style={[styles.headerIconBg, { backgroundColor: '#FF2D5522' }]}>
                                <Ionicons name="sparkles" size={16} color="#FF2D55" />
                            </View>
                            <View>
                                <Text style={[styles.panelTitle, { color: colors.text }]}>
                                    {t('activities_count', { count: groups.length })}
                                </Text>
                                {unreadCount > 0 && (
                                    <Text style={[styles.unreadHint, { color: '#FF2D55' }]}>
                                        {unreadCount} unread
                                    </Text>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.muted }]}>
                            <Ionicons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1 }}>
                        {groups.length === 0 ? (
                            <View style={styles.emptyState}>
                                <View style={[styles.emptyIconBg, { backgroundColor: colors.muted }]}>
                                    <Ionicons name="sparkles-outline" size={40} color={colors.textSecondary + '80'} />
                                </View>
                                <Text style={[styles.emptyText, { color: colors.text }]}>{t('no_activities')}</Text>
                                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                                    {t('no_activities_desc')}
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
    backdrop: { flex: 1, backgroundColor: 'transparent' },
    panelContainer: {
        position: 'absolute',
        maxHeight: 520,
        borderRadius: 20,
        ...createShadow({ width: 0, height: 8, opacity: 0.18, radius: 20, elevation: 12 }),
        borderWidth: 1,
        zIndex: 1000,
        overflow: 'hidden',
    },
    defaultPosition: { top: 90 },
    contentWrapper: { flex: 1, overflow: 'hidden', borderRadius: 20 },
    pointer: { position: 'absolute', top: -10, width: 20, height: 20, transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, zIndex: -1 },
    panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIconBg: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    panelTitle: { fontSize: 15, fontWeight: '700' },
    unreadHint: { fontSize: 11, fontWeight: '500', marginTop: 1 },
    closeButton: { padding: 6, borderRadius: 20 },
    listContent: { flexGrow: 1, paddingVertical: 4 },
    groupItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
    unreadItem: { borderLeftWidth: 3 },
    avatarWrapper: { position: 'relative', flexShrink: 0 },
    typeBadge: { position: 'absolute', bottom: -2, right: -4, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    content: { flex: 1, gap: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    groupTitle: { fontWeight: '600', fontSize: 14, flex: 1 },
    timeText: { fontSize: 11, marginLeft: 8, flexShrink: 0 },
    summaryText: { fontSize: 13, lineHeight: 18 },
    countChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginTop: 4 },
    countChipText: { fontSize: 11, fontWeight: '600' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginRight: 4 },
    deleteButton: { padding: 6, borderRadius: 14, width: 26, height: 26, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 12 },
    emptyIconBg: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    emptyText: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
    emptySubtext: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

export default ActivitiesPanel;