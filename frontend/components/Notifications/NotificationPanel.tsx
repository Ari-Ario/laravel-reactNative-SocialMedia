// components/Notifications/NotificationPanel.tsx
import React, { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Modal,
    ScrollView,
    Platform,
    Switch,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../Image/Avatar';
import { createShadow } from '@/utils/styles';
import { useNotificationStore, NOTIFICATION_TYPES, getNotificationIcon, getNotificationColor, isChatNotification } from '@/stores/notificationStore';
import { Notification } from '@/types/Notification';
import { router } from 'expo-router';
import { useProfileView } from '@/context/ProfileViewContext';
import { usePostStore } from '@/stores/postStore';
import { fetchPostById } from '@/services/PostService';
import { fetchProfile } from '@/services/UserService';
import PushNotificationService from '@/services/PushNotificationService';
import { useAppTheme } from '@/hooks/useAppTheme';
import AuthContext from '@/context/AuthContext';
import { useTranslation } from '@/constants/i18n';
import { formatTimeAgo } from '@/utils/dateUtils';
import { groupNotifications, getGroupSummary, NotificationGroup } from '@/utils/groupNotifications';
import { useMarketStore } from '@/stores/marketStore';
import { fetchMarketItemById } from '@/services/MarketService';

interface NotificationPanelProps {
    visible: boolean;
    onClose: () => void;
    initialType?: 'all' | 'calls' | 'messages' | 'spaces' | 'activities' | 'regular' | 'admin' | 'chatbot';
    anchorPosition?: { top: number; left?: number; right?: number; arrowOffset?: number };
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
    visible,
    onClose,
    initialType = 'all',
    anchorPosition,
}) => {
    const { colors, activeScheme } = useAppTheme();
    const { user } = useContext(AuthContext);
    const { t, locale } = useTranslation();
    const {
        getRegularNotifications,
        markAsRead,
        markAllAsRead,
        removeNotification,
        getCalls,
        getMessages,
        getSpaces,
        getActivities,
        getChatbotNotifications,
        getAdminNotifications,
        unreadChatbotTrainingCount,
    } = useNotificationStore();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    // Adaptive panel width: near-fullscreen on narrow mobile web, capped at 420 on desktop
    const panelWidth = Platform.OS === 'web' && windowWidth < 500
        ? windowWidth - 8
        : Math.min(windowWidth - 16, 420);
    // Adaptive panel max-height: 78% of screen height, capped at 580
    const panelMaxHeight = Math.min(windowHeight * 0.78, 580);

    const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
    const { addPost } = usePostStore();

    const [activeFilter, setActiveFilter] = useState<'all' | 'calls' | 'messages' | 'spaces' | 'activities' | 'regular' | 'admin' | 'chatbot'>(initialType);
    const [pushEnabled, setPushEnabled] = useState(true);

    const handlePushToggle = async (value: boolean) => {
        if (value) {
            const granted = await PushNotificationService.requestPermission();
            setPushEnabled(granted);
        } else {
            await PushNotificationService.unregister();
            setPushEnabled(false);
        }
    };

    useEffect(() => {
        if (initialType) {
            setActiveFilter(initialType);
        }
    }, [initialType]);

    // Get filtered notifications based on activeFilter
    const getFilteredNotifications = () => {
        switch (activeFilter) {
            case 'calls':
                return getCalls();
            case 'messages':
                return getMessages();
            case 'spaces':
                return getSpaces();
            case 'activities':
                return getActivities();
            case 'regular':
                return getRegularNotifications();
            case 'chatbot':
                return getChatbotNotifications();
            case 'admin':
                return getAdminNotifications();
            case 'all':
            default:
                const allNotifications = [
                    ...getRegularNotifications(),
                    ...getCalls(),
                    ...getMessages(),
                    ...getSpaces(),
                    ...getActivities(),
                    ...(user?.ai_admin ? getChatbotNotifications() : []),
                    ...getAdminNotifications(),
                ];
                return allNotifications.sort((a: Notification, b: Notification) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
        }
    };

    const filteredNotifications = getFilteredNotifications();
    const groupedNotifications = groupNotifications(filteredNotifications);
    const totalCount = filteredNotifications.length;

    const handleNotificationPress = async (item: Notification) => {
        console.log('🔔 Notification pressed:', item.type);
        console.log('  → spaceId:', item.spaceId, '| data.spaceId:', item.data?.spaceId, '| data.space_id:', item.data?.space_id);
        console.log('  → messageId:', item.messageId, '| data.messageId:', item.data?.messageId, '| data.message?.id:', item.data?.message?.id);

        if (!item.isRead) {
            markAsRead(item.id);
        }

        // ✅ HELPER: Extract spaceId from all possible locations (top-level or nested in `data`)
        const resolveSpaceId = (): string | undefined =>
            item.spaceId
            || item.data?.spaceId
            || item.data?.space_id
            || item.data?.space?.id
            || undefined;

        // ✅ HELPER: Extract messageId from all possible locations
        const resolveMessageId = (): string | undefined =>
            item.messageId
            || item.data?.messageId
            || item.data?.message_id
            || item.data?.message?.id
            || item.data?.replyId
            || undefined;

        // ✅ HELPER: Navigate to space+chat+message
        // Use replace() not push() to avoid stacking space screens on top of each other.
        const navigateToSpaceMessage = (spaceId: string, messageId?: string) => {
            router.replace({
                pathname: '/(spaces)/[id]',
                params: {
                    id: spaceId,
                    tab: 'chat',
                    ...(messageId ? { highlightMessageId: messageId } : {}),
                }
            });
            onClose();
        };

        try {
            // ============= SPACE INVITATION =============
            if (item.type === NOTIFICATION_TYPES.SPACE_INVITATION) {
                const spaceId = resolveSpaceId();
                if (spaceId) {
                    // ✅ replace() prevents stacking space screens from notification taps
                    router.replace({ pathname: '/(spaces)/[id]', params: { id: spaceId, justInvited: 'true' } });
                    onClose();
                    return;
                }
            }

            // ============= CALL STARTED =============
            if (item.type === NOTIFICATION_TYPES.CALL_STARTED) {
                const spaceId = resolveSpaceId();
                if (spaceId) {
                    // ✅ replace() prevents stacking space screens from notification taps
                    router.replace({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'meeting' } });
                    onClose();
                    return;
                }
            }

            // ============= CHAT MESSAGES / REACTIONS / REPLIES / DELETIONS =============
            if (item.type === NOTIFICATION_TYPES.NEW_MESSAGE ||
                item.type === NOTIFICATION_TYPES.MESSAGE_REACTION ||
                item.type === NOTIFICATION_TYPES.MESSAGE_REPLY ||
                item.type === NOTIFICATION_TYPES.MESSAGE_DELETED ||
                item.type === NOTIFICATION_TYPES.SPACE_MESSAGE) {

                const spaceId = resolveSpaceId();
                const messageId = resolveMessageId();

                console.log(`  → [${item.type}] Resolved spaceId:`, spaceId, '| messageId:', messageId);

                if (spaceId) {
                    navigateToSpaceMessage(spaceId, messageId);
                    return;
                }

                // Fallback: DM chat — only if no spaceId found
                const userId = item.userId || item.data?.user?.id || item.data?.userId;
                if (userId) {
                    router.push({ pathname: '/(tabs)/chats', params: { id: userId.toString() } } as any);
                    onClose();
                    return;
                }

                // Last resort: close panel, user will see chat list
                console.warn('⚠️ No spaceId or userId found for message notification:', item);
                onClose();
                return;
            }

            // ============= PARTICIPANT JOINED =============
            if (item.type === NOTIFICATION_TYPES.PARTICIPANT_JOINED) {
                const spaceId = resolveSpaceId();
                if (spaceId) {
                    // ✅ replace() prevents stacking space screens from notification taps
                    router.replace({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'chat' } });
                    onClose();
                    return;
                }
            }

            // ============= MAGIC EVENT =============
            if (item.type === NOTIFICATION_TYPES.MAGIC_EVENT) {
                const spaceId = resolveSpaceId();
                const eventId = item.data?.event?.id || item.data?.eventId;
                if (spaceId) {
                    // ✅ replace() prevents stacking space screens from notification taps
                    router.replace({
                        pathname: '/(spaces)/[id]',
                        params: { id: spaceId, highlightMagic: eventId ? eventId.toString() : 'true' },
                    });
                    onClose();
                    return;
                }
            }

            // ============= SCREEN SHARE =============
            if (item.type === NOTIFICATION_TYPES.SCREEN_SHARE) {
                const spaceId = resolveSpaceId();
                if (spaceId) {
                    // ✅ replace() prevents stacking space screens from notification taps
                    router.replace({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'meeting' } });
                    onClose();
                    return;
                }
            }

            // ============= ACTIVITY CREATED =============
            if (item.type === NOTIFICATION_TYPES.ACTIVITY_CREATED || item.type === NOTIFICATION_TYPES.ACTIVITY_UPDATED) {
                const spaceId = resolveSpaceId();
                const activityId = item.data?.activity?.id || item.data?.activity_id;
                if (spaceId) {
                    // ✅ replace() prevents stacking space screens from notification taps
                    router.replace({
                        pathname: '/(spaces)/[id]',
                        params: { id: spaceId, tab: 'calendar', activity: activityId ? activityId.toString() : undefined }
                    });
                    onClose();
                    return;
                }
            }

            // ============= SPACE UPDATED =============
            if (item.type === NOTIFICATION_TYPES.SPACE_UPDATED) {
                const spaceId = resolveSpaceId();
                if (spaceId) {
                    // ✅ replace() prevents stacking space screens from notification taps
                    router.replace({ pathname: '/(spaces)/[id]', params: { id: spaceId } });
                    onClose();
                    return;
                }
            }

            // ============= CALL ENDED =============
            if (item.type === NOTIFICATION_TYPES.CALL_ENDED) {
                onClose();
                return;
            }

            // ============= VIOLATION NOTIFICATIONS =============
            if (item.type === NOTIFICATION_TYPES.VIOLATION_REPORTED) {
                router.push('/moderation');
                onClose();
                return;
            }

            // ============= MODERATION ACTIONS (Admin Channel) =============
            if (item.type === NOTIFICATION_TYPES.MODERATION_ACTION) {
                router.push('/moderation/admin-channel');
                onClose();
                return;
            }

            // ============= MARKET-RELATED NOTIFICATIONS =============
            if (item.type === NOTIFICATION_TYPES.MARKET_COMMENT || item.type === NOTIFICATION_TYPES.MARKET_REACTION) {
                const itemId = item.marketItemId || item.data?.itemId || item.data?.marketItemId;
                if (itemId) {
                    // Pre-load market item into store for instant view
                    try {
                        const marketData = await fetchMarketItemById(Number(itemId));
                        if (marketData) {
                            useMarketStore.getState().addOrUpdateItem(marketData);
                        }
                    } catch (err) {
                        console.error('Failed to preload market item:', err);
                    }

                    router.push({
                        pathname: '/post/[id]',
                        params: { 
                            id: itemId.toString(), 
                            isMarket: 'true', 
                            highlightCommentId: item.commentId?.toString() 
                        }
                    } as any);
                    onClose();
                    return;
                }
            }

            // ============= POST-RELATED NOTIFICATIONS =============
            if (item.type === 'post_deleted') {
                onClose();
                return;
            }

            if (['training_needed', NOTIFICATION_TYPES.CHATBOT_TRAINING].includes(item.type)) {
                router.push({ pathname: '/chatbotTraining', params: { highlightChatbotTraining: 'true', from: 'notifications' } });
                onClose();
                return;
            }

            if (['post', NOTIFICATION_TYPES.POST_UPDATED, 'reaction'].includes(item.type) && item.postId) {
                const postData = await fetchPostById(item.postId);
                if (postData?.data) addPost(postData.data);
                router.push(`/post/${item.postId}`);
                onClose();
                return;
            }

            if ((item.type === NOTIFICATION_TYPES.COMMENT || item.type === NOTIFICATION_TYPES.COMMENT_REACTION) && item.postId && item.commentId) {
                const postData = await fetchPostById(item.postId);
                if (postData?.data) addPost(postData.data);
                router.push({
                    pathname: '/post/[id]',
                    params: { id: item.postId.toString(), highlightCommentId: item.commentId.toString() },
                } as any);
                onClose();
                return;
            }

            if (item.type === 'comment-deleted' && item.postId) {
                const postData = await fetchPostById(item.postId);
                if (postData?.data) addPost(postData.data);
                router.push(`/post/${item.postId}`);
                onClose();
                return;
            }

            // ============= PROFILE NAVIGATION (last resort for social notifications) =============
            // ✅ CRITICAL: isChatNotification() now includes MESSAGE_REPLY and MESSAGE_REACTION
            // so they will NEVER reach this block
            if (item.userId && !isChatNotification(item.type) &&
                !['new_follower', 'user_unfollowed', 'new-follower', 'user-unfollowed'].includes(item.type)) {
                try {
                    await fetchProfile(item.userId.toString());
                } catch (err) {
                    console.error('Failed to preload profile:', err);
                }
                setProfileViewUserId(item.userId.toString());
                setProfilePreviewVisible(true);
                onClose();
                return;
            }

            onClose();
        } catch (error) {
            console.error('Error handling notification press:', error);
            onClose();
        }
    };

    const handleAvatarPress = (item: Notification) => {
        if (item.userId) {
            setProfileViewUserId(item.userId.toString());
            setProfilePreviewVisible(true);
            onClose();
        }
    };

    const handleGroupPress = async (group: NotificationGroup) => {
        // Mark all in group as read
        group.notifications.forEach(n => {
            if (!n.isRead) markAsRead(n.id);
        });

        // Use the latest notification for navigation logic
        handleNotificationPress(group.latestNotification);
    };

    const renderNotificationGroup = ({ item: group }: { item: NotificationGroup }) => {
        const item = group.latestNotification;
        const iconName = getNotificationIcon(item.type);
        const iconColor = getNotificationColor(item.type);
        const summary = getGroupSummary(group, t);
        const hasMultiple = group.count > 1;

        return (
            <TouchableOpacity
                style={[
                    styles.notificationItem,
                    { borderBottomColor: colors.border },
                    group.hasUnread && styles.unreadNotification,
                    group.hasUnread && { backgroundColor: colors.primary + '10', borderLeftColor: colors.primary }
                ]}
                onPress={() => handleGroupPress(group)}
            >
                <View style={styles.avatarWrapper}>
                    <TouchableOpacity
                        style={styles.Foto}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleAvatarPress(item);
                        }}
                    >
                        <Avatar
                            source={item.avatar}
                            name={item.title}
                            size={48}
                            showStatus={false}
                        />
                    </TouchableOpacity>

                    {group.actorAvatars.length > 1 && (
                        <View style={[styles.miniAvatar, { borderColor: colors.surface }]}>
                            <Avatar
                                source={group.actorAvatars[1]}
                                size={24}
                                showStatus={false}
                            />
                        </View>
                    )}

                {/* New (unread) count badge — primary color */}
                    {group.unreadCount > 0 && (
                        <View style={[styles.countBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                            <Text style={styles.countBadgeText}>{group.unreadCount > 99 ? '99+' : group.unreadCount}</Text>
                        </View>
                    )}
                    {/* Total count badge — muted, shown only when all read and count > 1 */}
                    {group.unreadCount === 0 && group.count > 1 && (
                        <View style={[styles.countBadge, { backgroundColor: colors.muted, borderColor: colors.surface }]}>
                            <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>{group.count > 99 ? '99+' : group.count}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.notificationContent}>
                    <View style={styles.textContent}>
                        <View style={styles.titleRow}>
                            <View style={styles.titleWithIcon}>
                                <Ionicons name={iconName as any} size={16} color={iconColor} />
                                <Text style={[styles.notificationTitle, { color: colors.text }]} numberOfLines={1}>
                                    {group.count > 1
                                        ? group.actorNames.slice(0, 2).join(', ') + (group.actorNames.length > 2 ? ` +${group.actorNames.length - 2}` : '')
                                        : item.title
                                    }
                                </Text>
                            </View>
                            <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>
                                {formatTimeAgo(item.createdAt)}
                            </Text>
                        </View>

                        <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                            {summary}
                        </Text>

                        {/* Metadata for specific types */}
                        {item.spaceId && group.spaceName && (
                            <View style={[styles.metadataContainer, { backgroundColor: colors.background }]}>
                                <Ionicons name="cube-outline" size={12} color={colors.textSecondary} />
                                <Text style={[styles.metadataText, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {group.spaceName}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation();
                        // Remove the whole group if requested, or just the latest?
                        // User likely expects to dismiss the whole card.
                        group.notifications.forEach(n => removeNotification(n.id));
                    }}
                    style={[styles.deleteButton, { backgroundColor: colors.muted }]}
                >
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };


    const renderFilterTabs = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}

            style={styles.filterTabs}
            contentContainerStyle={styles.filterTabsContent}
        >
            {/* All tabs (same as before) */}
            <TouchableOpacity style={[styles.filterTab, { backgroundColor: colors.muted }, activeFilter === 'all' && styles.activeFilterTab, activeFilter === 'all' && { borderColor: colors.primary }]} onPress={() => setActiveFilter('all')}>
                <Ionicons name="apps" size={16} color={activeFilter === 'all' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.filterTabText, { color: colors.textSecondary }, activeFilter === 'all' && { color: colors.primary, fontWeight: '600' }]}>{t('all')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterTab, { backgroundColor: colors.muted }, activeFilter === 'calls' && styles.activeFilterTab]} onPress={() => setActiveFilter('calls')}>
                <Ionicons name="call" size={16} color={activeFilter === 'calls' ? '#4CD964' : colors.textSecondary} />
                <Text style={[styles.filterTabText, { color: colors.textSecondary }, activeFilter === 'calls' && { color: '#4CD964', fontWeight: '600' }]}>{t('calls')}</Text>
                {getCalls().filter((n: Notification) => !n.isRead).length > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: '#4CD964', borderColor: colors.surface }]}>
                        <Text style={styles.filterBadgeText}>{getCalls().filter((n: Notification) => !n.isRead).length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterTab, { backgroundColor: colors.muted }, activeFilter === 'messages' && styles.activeFilterTab, activeFilter === 'messages' && { borderColor: colors.primary }]} onPress={() => setActiveFilter('messages')}>
                <Ionicons name="chatbubble" size={16} color={activeFilter === 'messages' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.filterTabText, { color: colors.textSecondary }, activeFilter === 'messages' && { color: colors.primary, fontWeight: '600' }]}>{t('messages')}</Text>
                {getMessages().filter((n: Notification) => !n.isRead).length > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                        <Text style={styles.filterBadgeText}>{getMessages().filter((n: Notification) => !n.isRead).length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterTab, { backgroundColor: colors.muted }, activeFilter === 'spaces' && styles.activeFilterTab]} onPress={() => setActiveFilter('spaces')}>
                <Ionicons name="cube" size={16} color={activeFilter === 'spaces' ? '#5856D6' : colors.textSecondary} />
                <Text style={[styles.filterTabText, { color: colors.textSecondary }, activeFilter === 'spaces' && { color: '#5856D6', fontWeight: '600' }]}>{t('spaces')}</Text>
                {getSpaces().filter((n: Notification) => !n.isRead).length > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: '#5856D6', borderColor: colors.surface }]}>
                        <Text style={styles.filterBadgeText}>{getSpaces().filter((n: Notification) => !n.isRead).length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterTab, { backgroundColor: colors.muted }, activeFilter === 'activities' && styles.activeFilterTab]} onPress={() => setActiveFilter('activities')}>
                <Ionicons name="sparkles" size={16} color={activeFilter === 'activities' ? '#FF2D55' : colors.textSecondary} />
                <Text style={[styles.filterTabText, { color: colors.textSecondary }, activeFilter === 'activities' && { color: '#FF2D55', fontWeight: '600' }]}>{t('activities')}</Text>
                {getActivities().filter((n: Notification) => !n.isRead).length > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: '#FF2D55', borderColor: colors.surface }]}>
                        <Text style={styles.filterBadgeText}>{getActivities().filter((n: Notification) => !n.isRead).length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterTab, { backgroundColor: colors.muted }, activeFilter === 'regular' && styles.activeFilterTab]} onPress={() => setActiveFilter('regular')}>
                <Ionicons name="notifications" size={16} color={activeFilter === 'regular' ? colors.text : colors.textSecondary} />
                <Text style={[styles.filterTabText, { color: colors.textSecondary }, activeFilter === 'regular' && { color: colors.text, fontWeight: '600' }]}>{t('regular')}</Text>
                {getRegularNotifications().filter((n: Notification) => !n.isRead).length > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: '#FF9500', borderColor: colors.surface }]}>
                        <Text style={styles.filterBadgeText}>{getRegularNotifications().filter((n: Notification) => !n.isRead).length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            {!!user?.ai_admin && (
                <TouchableOpacity style={[styles.filterTab, { backgroundColor: colors.muted }, activeFilter === 'chatbot' && styles.activeFilterTab]} onPress={() => setActiveFilter('chatbot')}>
                    <Ionicons name="school" size={16} color={activeFilter === 'chatbot' ? colors.tint : colors.textSecondary} />
                    <Text style={[styles.filterTabText, { color: colors.textSecondary }, activeFilter === 'chatbot' && { color: colors.tint, fontWeight: '600' }]}>{t('ai_training')}</Text>
                    {unreadChatbotTrainingCount > 0 && (
                        <View style={[styles.filterBadge, { backgroundColor: colors.tint, borderColor: colors.surface }]}>
                            <Text style={styles.filterBadgeText}>{unreadChatbotTrainingCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.filterTab, { backgroundColor: colors.muted }, activeFilter === 'admin' && styles.activeFilterTab]} onPress={() => setActiveFilter('admin')}>
                <Ionicons name="shield-checkmark" size={16} color={activeFilter === 'admin' ? '#FF3B30' : colors.textSecondary} />
                <Text style={[styles.filterTabText, { color: colors.textSecondary }, activeFilter === 'admin' && { color: '#FF3B30', fontWeight: '600' }]}>{t('administration')}</Text>
                {useNotificationStore.getState().unreadModerationCount > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: '#FF3B30', borderColor: colors.surface }]}>
                        <Text style={styles.filterBadgeText}>{useNotificationStore.getState().unreadModerationCount}</Text>
                    </View>
                )}
            </TouchableOpacity>
        </ScrollView>
    );

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

            <View
                style={[
                    styles.panelContainer,
                    { backgroundColor: colors.surface, borderColor: colors.border, width: panelWidth, maxHeight: panelMaxHeight },
                    anchorPosition ? {
                        top: anchorPosition.top + 15,
                        left: anchorPosition.left !== undefined
                            ? Math.min(anchorPosition.left, windowWidth - panelWidth - 4)
                            : undefined,
                        right: anchorPosition.right,
                    } : [styles.defaultPosition, { left: (windowWidth - panelWidth) / 2 }]
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

                <View style={styles.contentWrapper}>
                    <View style={[styles.panelHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                        <Text style={[styles.panelTitle, { color: colors.text }]}>
                            {t('notifications_count', { count: totalCount })}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {filteredNotifications.some((n: any) => !n.isRead) && (
                                <TouchableOpacity
                                    onPress={() => markAllAsRead()}
                                    style={[styles.markReadBtn, { backgroundColor: colors.muted }]}
                                >
                                    <Text style={[styles.markReadText, { color: colors.primary }]}>
                                        {t('mark_all_read_panel')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.muted }]}>
                                <Ionicons name="close" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={[styles.filterTabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                        {renderFilterTabs()}
                    </View>

                    <View style={[styles.listContainer, { backgroundColor: colors.surface }]}>
                        {groupedNotifications.length > 0 ? (
                            <FlatList
                                style={{ flex: 1 }}
                                data={groupedNotifications}
                                renderItem={renderNotificationGroup}
                                keyExtractor={(item) => item.key}
                                extraData={activeFilter}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                            />
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="notifications-off-outline" size={48} color={colors.textSecondary} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('no_notifications')}</Text>
                            </View>
                        )}
                    </View>

                    {/* Footer Toggle */}
                    <View style={[styles.panelFooter, { backgroundColor: colors.muted, borderTopColor: colors.border }]}>
                        <View style={styles.pushToggleRow}>
                            <Ionicons name="notifications-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.pushToggleText, { color: colors.textSecondary }]}>{t('push_notifications')}</Text>
                            <Switch
                                value={pushEnabled}
                                onValueChange={handlePushToggle}
                                trackColor={{ false: colors.border, true: '#30D158' }}
                                ios_backgroundColor={colors.border}
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                        </View>
                        {Platform.OS === 'web' && /iPhone|iPad|iPod/.test(navigator.userAgent) && (
                            <View style={styles.iosWebTip}>
                                <Text style={styles.iosWebTipText}>
                                    {t('ios_pwa_tip')}
                                </Text>
                            </View>
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
        backgroundColor: 'transparent' // Transparent for dropdown feel
    },
    panelContainer: {
        position: 'absolute',
        maxHeight: 520,
        borderRadius: 20,
        ...createShadow({
            width: 0,
            height: 8,
            opacity: 0.18,
            radius: 20,
            elevation: 12,
        }),
        borderWidth: 1,
        zIndex: 1000,
        overflow: 'hidden',
    },
    defaultPosition: {
        top: 90,
    },
    markReadBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    markReadText: {
        fontSize: 12,
        fontWeight: '600',
    },
    contentWrapper: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 16,
    },
    pointer: {
        position: 'absolute',
        top: -10,
        width: 20,
        height: 20,
        transform: [{ rotate: '45deg' }],
        borderTopWidth: 1,
        borderLeftWidth: 1,
        zIndex: -1, // Behind the content but shadows will show
    },
    panelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        flexShrink: 0,
        zIndex: 10,
    },
    panelTitle: { fontSize: 16, fontWeight: '700' },
    closeButton: {
        padding: 4,
        borderRadius: 20,
    },
    filterTabsContainer: {
        height: 60,
        flexShrink: 0,
        zIndex: 100,
        borderBottomWidth: 1,
    },
    filterTabs: {
        flex: 1,
    },
    filterTabsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    listContainer: {
        flex: 1,
        zIndex: 1,
        overflow: 'hidden',
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 24,
        marginEnd: 8,
        gap: 6,
    },


    activeFilterTab: { borderColor: '#007AFF', borderWidth: 1 },
    filterTabText: { fontSize: 13, fontWeight: '500' },
    activeFilterText: { fontWeight: '600' },
    filterBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
    },
    filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    listContent: { flexGrow: 1, paddingVertical: 8 },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        minHeight: 80,
    },
    unreadNotification: { borderLeftWidth: 3 },
    notificationContent: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
    textContent: { flex: 1, marginStart: 12 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    titleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    notificationTitle: { fontWeight: '600', fontSize: 15, flex: 1 },
    notificationMessage: { fontSize: 13, marginBottom: 6, lineHeight: 18 },
    notificationTime: { fontSize: 11, marginStart: 8 },
    metadataContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    metadataText: { fontSize: 11, fontWeight: '500' },
    deleteButton: {
        padding: 6,
        marginStart: 8,
        borderRadius: 16,
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    emptyText: { marginTop: 16, fontSize: 18, fontWeight: '600' },
    emptySubtext: { marginTop: 8, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    Foto: { alignSelf: 'flex-start' },
    avatarWrapper: {
        position: 'relative',
        alignSelf: 'flex-start'
    },
    miniAvatar: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        borderRadius: 12,
        borderWidth: 2,
        overflow: 'hidden'
    },
    countBadge: {
        position: 'absolute',
        top: -6,
        left: -6,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        paddingHorizontal: 2
    },
    countBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold'
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginStart: 12,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    initialsText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    panelFooter: {
        padding: 12,
        borderTopWidth: 1,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    pushToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    pushToggleText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
    },
    iosWebTip: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#e8f0fe',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    iosWebTipText: {
        fontSize: 10,
        color: '#007AFF',
        textAlign: 'center',
        fontWeight: '600',
    },
});

export default NotificationPanel;