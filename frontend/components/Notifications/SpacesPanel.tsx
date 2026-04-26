// components/Notifications/SpacesPanel.tsx
// Grouped-by-space space notifications with invitation accept, mark-as-read on open.
import React, { useEffect, useCallback, useContext, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Modal,
    Alert,
    ActivityIndicator,
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
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { useCollaborationStore } from '@/stores/collaborationStore';
import AuthContext from '@/context/AuthContext';

type SpacesPanelProps = {
    visible: boolean;
    onClose: () => void;
    anchorPosition?: { top: number; left?: number; right?: number; arrowOffset?: number };
};

const SpacesPanel = ({ visible, onClose, anchorPosition }: SpacesPanelProps) => {
    const { colors, activeScheme } = useAppTheme();
    const { t } = useTranslation();
    const { user } = useContext(AuthContext);
    const { width: windowWidth } = useWindowDimensions();
    const panelWidth = Math.min(windowWidth - 16, 420);
    const [joiningSpaceId, setJoiningSpaceId] = useState<string | null>(null);

    const {
        getSpaces,
        markAsRead,
        markSpacesAsRead,
        removeNotification,
    } = useNotificationStore();

    const { fetchUserSpaces } = useCollaborationStore();
    const spaces = getSpaces();
    const groups = groupNotifications(spaces);
    const unreadCount = spaces.filter((n: Notification) => !n.isRead).length;

    // ✅ Mark all space notifications as read when panel opens
    useEffect(() => {
        if (visible && unreadCount > 0) {
            const timer = setTimeout(() => markSpacesAsRead(), 300);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    const handleGroupPress = useCallback((group: NotificationGroup) => {
        group.notifications.forEach(n => { if (!n.isRead) markAsRead(n.id); });

        const { latestNotification } = group;
        const spaceId = latestNotification.spaceId ||
            latestNotification.data?.space_id ||
            latestNotification.data?.space?.id;

        if (spaceId) {
            router.replace({
                pathname: '/(spaces)/[id]',
                params: { id: spaceId }
            });
        }
        onClose();
    }, [markAsRead, onClose]);

    const handleAcceptInvitation = useCallback(async (group: NotificationGroup, e: any) => {
        e.stopPropagation();
        const spaceId = group.latestNotification.spaceId ||
            group.latestNotification.data?.space_id ||
            group.latestNotification.data?.space?.id;

        if (!spaceId || !user) return;

        setJoiningSpaceId(spaceId);
        try {
            await CollaborationService.getInstance().joinSpace(spaceId);
            if (user?.id) await fetchUserSpaces(Number(user.id));

            group.notifications.forEach(n => markAsRead(n.id));
            router.replace({ pathname: '/(spaces)/[id]', params: { id: spaceId } });
            onClose();
        } catch (err) {
            Alert.alert(t('error'), t('error_accept_invitation'));
        } finally {
            setJoiningSpaceId(null);
        }
    }, [user, markAsRead, fetchUserSpaces, t, onClose]);

    const getSpaceIcon = (type: string): any => {
        if (type === 'space_invitation' || type === 'space-invitation') return 'mail-open';
        if (type === 'space_deleted' || type === 'space-deleted') return 'trash-outline';
        if (type === 'space_created' || type === 'space-created') return 'add-circle-outline';
        return 'cube-outline';
    };

    const getSpaceColor = (type: string): string => {
        if (type === 'space_invitation' || type === 'space-invitation') return '#5856D6';
        if (type === 'space_deleted' || type === 'space-deleted') return '#FF3B30';
        if (type === 'space_created' || type === 'space-created') return '#34C759';
        return '#FF9500';
    };

    const renderGroupItem = useCallback(({ item: group }: { item: NotificationGroup }) => {
        const { latestNotification: n } = group;
        const summary = getGroupSummary(group, t);
        const timeStr = formatTimeAgo(n.createdAt);
        const accentColor = getSpaceColor(group.type);
        const iconName = getSpaceIcon(group.type);
        const isInvitation = group.type === 'space_invitation' || group.type === 'space-invitation';
        const currentSpaceId = n.spaceId || n.data?.space_id || n.data?.space?.id;
        const isJoining = joiningSpaceId === currentSpaceId;

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
                {/* Avatar + count */}
                <View style={styles.avatarWrapper}>
                    <Avatar source={n.avatar} name={n.title} size={46} showStatus={false} />
                    {group.count > 1 && (
                        <View style={[styles.countBubble, { backgroundColor: accentColor, borderColor: colors.surface }]}>
                            <Text style={styles.countText}>{group.count}</Text>
                        </View>
                    )}
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <View style={styles.titleRow}>
                        <View style={styles.titleWithIcon}>
                            <Ionicons name={iconName} size={13} color={accentColor} />
                            <Text style={[styles.groupTitle, { color: colors.text }]} numberOfLines={1}>
                                {group.spaceName || n.title}
                            </Text>
                        </View>
                        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{timeStr}</Text>
                    </View>
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]} numberOfLines={2}>
                        {summary}
                    </Text>

                    {/* Accept button for invitations */}
                    {isInvitation && (
                        <TouchableOpacity
                            style={[styles.acceptBtn, { backgroundColor: accentColor }]}
                            onPress={(e) => handleAcceptInvitation(group, e)}
                            disabled={isJoining}
                        >
                            {isJoining ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark" size={12} color="#fff" />
                                    <Text style={styles.acceptBtnText}>{t('accept')}</Text>
                                </>
                            )}
                        </TouchableOpacity>
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
    }, [colors, t, handleGroupPress, handleAcceptInvitation, removeNotification, joiningSpaceId]);

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
                            <View style={[styles.headerIconBg, { backgroundColor: '#5856D622' }]}>
                                <Ionicons name="cube" size={16} color="#5856D6" />
                            </View>
                            <View>
                                <Text style={[styles.panelTitle, { color: colors.text }]}>
                                    {t('spaces_count', { count: groups.length })}
                                </Text>
                                {unreadCount > 0 && (
                                    <Text style={[styles.unreadHint, { color: '#5856D6' }]}>
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
                                    <Ionicons name="cube-outline" size={40} color={colors.textSecondary + '80'} />
                                </View>
                                <Text style={[styles.emptyText, { color: colors.text }]}>{t('no_spaces')}</Text>
                                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                                    {t('no_spaces_desc')}
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
    countBubble: { position: 'absolute', bottom: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    countText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    content: { flex: 1, gap: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    groupTitle: { fontWeight: '600', fontSize: 14, flex: 1 },
    timeText: { fontSize: 11, marginLeft: 8, flexShrink: 0 },
    summaryText: { fontSize: 13, lineHeight: 18 },
    acceptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start', marginTop: 4 },
    acceptBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginRight: 4 },
    deleteButton: { padding: 6, borderRadius: 14, width: 26, height: 26, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 12 },
    emptyIconBg: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    emptyText: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
    emptySubtext: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

export default SpacesPanel;