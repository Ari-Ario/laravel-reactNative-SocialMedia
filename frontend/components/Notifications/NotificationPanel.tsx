// components/Notifications/NotificationPanel.tsx
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Modal,
    Image,
    ScrollView,
    Platform,
    Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createShadow } from '@/utils/styles';
import { useNotificationStore, NOTIFICATION_TYPES, getNotificationIcon, getNotificationColor, isChatNotification } from '@/stores/notificationStore';
import { Notification } from '@/types/Notification';
import getApiBaseImage from '@/services/getApiBaseImage';
import { router } from 'expo-router';
import { useProfileView } from '@/context/ProfileViewContext';
import { usePostStore } from '@/stores/postStore';
import { fetchPostById } from '@/services/PostService';
import { fetchProfile } from '@/services/UserService';
import PushNotificationService from '@/services/PushNotificationService';

interface NotificationPanelProps {
    visible: boolean;
    onClose: () => void;
    initialType?: 'all' | 'calls' | 'messages' | 'spaces' | 'activities' | 'regular' | 'admin';
    anchorPosition?: { top: number; left?: number; right?: number; arrowOffset?: number };
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
    visible,
    onClose,
    initialType = 'all',
    anchorPosition,
}) => {
    const {
        getRegularNotifications,
        markAsRead,
        removeNotification,
        getCalls,
        getMessages,
        getSpaces,
        getActivities,
    } = useNotificationStore();

    const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
    const { addPost } = usePostStore();

    const [activeFilter, setActiveFilter] = useState<'all' | 'calls' | 'messages' | 'spaces' | 'activities' | 'regular' | 'admin'>(initialType);
    const [pushEnabled, setPushEnabled] = useState(true);

    const handlePushToggle = async (value: boolean) => {
        setPushEnabled(value);
        if (value) {
            await PushNotificationService.initialize();
        } else {
            await PushNotificationService.unregister();
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
            case 'admin':
                return getRegularNotifications().filter(n => n.type === NOTIFICATION_TYPES.MODERATION_ACTION);
            case 'all':
            default:
                const allNotifications = [
                    ...getRegularNotifications(),
                    ...getCalls(),
                    ...getMessages(),
                    ...getSpaces(),
                    ...getActivities(),
                ];
                return allNotifications.sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
        }
    };

    const filteredNotifications = getFilteredNotifications();
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
        const navigateToSpaceMessage = (spaceId: string, messageId?: string) => {
            router.push({
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
                    router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, justInvited: 'true' } });
                    onClose();
                    return;
                }
            }

            // ============= CALL STARTED =============
            if (item.type === NOTIFICATION_TYPES.CALL_STARTED) {
                const spaceId = resolveSpaceId();
                if (spaceId) {
                    router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'meeting' } });
                    onClose();
                    return;
                }
            }

            // ============= CHAT MESSAGES / REACTIONS / REPLIES / DELETIONS =============
            if (item.type === NOTIFICATION_TYPES.NEW_MESSAGE ||
                item.type === NOTIFICATION_TYPES.MESSAGE_REACTION ||
                item.type === NOTIFICATION_TYPES.MESSAGE_REPLY ||
                item.type === NOTIFICATION_TYPES.MESSAGE_DELETED) {

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
                    router.push({ pathname: '/(tabs)/chats/[id]', params: { id: userId.toString() } });
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
                    router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'chat' } });
                    onClose();
                    return;
                }
            }

            // ============= MAGIC EVENT =============
            if (item.type === NOTIFICATION_TYPES.MAGIC_EVENT) {
                const spaceId = resolveSpaceId();
                const eventId = item.data?.event?.id || item.data?.eventId;
                if (spaceId) {
                    router.push({
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
                    router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'meeting' } });
                    onClose();
                    return;
                }
            }

            // ============= ACTIVITY CREATED =============
            if (item.type === NOTIFICATION_TYPES.ACTIVITY_CREATED) {
                const spaceId = resolveSpaceId();
                if (spaceId) {
                    router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'calendar' } });
                    onClose();
                    return;
                }
            }

            // ============= SPACE UPDATED =============
            if (item.type === NOTIFICATION_TYPES.SPACE_UPDATED) {
                const spaceId = resolveSpaceId();
                if (spaceId) {
                    router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId } });
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

            // ============= POST-RELATED NOTIFICATIONS =============
            if (item.type === 'post_deleted') {
                onClose();
                return;
            }

            if (['training_needed', NOTIFICATION_TYPES.CHATBOT_TRAINING].includes(item.type)) {
                router.replace({
                    pathname: '/chatbotTraining',
                    params: { highlightChatbotTraining: 'true' },
                });
                onClose();
                return;
            }

            if (['post', NOTIFICATION_TYPES.POST_UPDATED, 'reaction'].includes(item.type) && item.postId) {
                const postData = await fetchPostById(item.postId);
                if (postData?.data) addPost(postData.data);
                router.push(`/post/${item.postId}` as any);
                onClose();
                return;
            }

            if ((item.type === NOTIFICATION_TYPES.COMMENT || item.type === NOTIFICATION_TYPES.COMMENT_REACTION) && item.postId && item.commentId) {
                const postData = await fetchPostById(item.postId);
                if (postData?.data) addPost(postData.data);
                router.push({
                    pathname: `/post/${item.postId}` as any,
                    params: { highlightCommentId: item.commentId.toString() },
                });
                onClose();
                return;
            }

            if (item.type === 'comment-deleted' && item.postId) {
                const postData = await fetchPostById(item.postId);
                if (postData?.data) addPost(postData.data);
                router.push(`/post/${item.postId}` as any);
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

    const renderNotificationItem = ({ item }: { item: Notification }) => {
        const getAvatarSource = () => {
            if (!item.avatar) return require('@/assets/images/favicon.png');
            const avatarString = String(item.avatar).trim();
            if (!avatarString) return require('@/assets/images/favicon.png');
            return { uri: `${getApiBaseImage()}/storage/${avatarString}` };
        };

        const avatarSource = getAvatarSource();
        const iconName = getNotificationIcon(item.type);
        const iconColor = getNotificationColor(item.type);

        return (
            <TouchableOpacity
                style={[styles.notificationItem, !item.isRead && styles.unreadNotification]}
                onPress={() => handleNotificationPress(item)}
            >
                <TouchableOpacity
                    style={styles.Foto}
                    onPress={(e) => {
                        e.stopPropagation();
                        handleAvatarPress(item);
                    }}
                >
                    <Image
                        source={avatarSource}
                        style={styles.avatar}
                        defaultSource={require('@/assets/images/favicon.png')}
                        onError={() => console.log('🖼️ Avatar load error:', item.avatar)}
                    />
                </TouchableOpacity>

                <View style={styles.notificationContent}>
                    <View style={styles.textContent}>
                        <View style={styles.titleRow}>
                            <View style={styles.titleWithIcon}>
                                <Ionicons name={iconName as any} size={16} color={iconColor} />
                                <Text style={styles.notificationTitle}>{item.title}</Text>
                            </View>
                            <Text style={styles.notificationTime}>
                                {formatTimeAgo(item.createdAt)}
                            </Text>
                        </View>

                        <Text style={styles.notificationMessage}>
                            {typeof item.message === 'object' ? JSON.stringify(item.message) : item.message}
                        </Text>

                        {/* Metadata for chat notifications */}
                        {item.type === NOTIFICATION_TYPES.SPACE_INVITATION && item.data?.space?.title && (
                            <View style={styles.metadataContainer}>
                                <Ionicons name="people" size={12} color="#666" />
                                <Text style={styles.metadataText}>Space: {item.data.space.title}</Text>
                            </View>
                        )}

                        {item.type === NOTIFICATION_TYPES.CALL_STARTED && item.data?.call?.type && (
                            <View style={styles.metadataContainer}>
                                <Ionicons name={item.data.call.type === 'video' ? 'videocam' : 'call'} size={12} color="#4CD964" />
                                <Text style={styles.metadataText}>
                                    {item.data.call.type === 'video' ? 'Video call' : 'Audio call'} started
                                </Text>
                            </View>
                        )}

                        {item.type === NOTIFICATION_TYPES.MAGIC_EVENT && (
                            <View style={styles.metadataContainer}>
                                <Ionicons name="sparkles" size={12} color="#FF2D55" />
                                <Text style={styles.metadataText}>✨ Magic discovered!</Text>
                            </View>
                        )}
                    </View>
                </View>

                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation();
                        removeNotification(item.id);
                    }}
                    style={styles.deleteButton}
                >
                    <Ionicons name="close" size={16} color="#999" />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const renderFilterTabs = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}

            style={styles.filterTabs}
            contentContainerStyle={styles.filterTabsContent}
        >
            {/* All tabs (same as before) */}
            <TouchableOpacity style={[styles.filterTab, activeFilter === 'all' && styles.activeFilterTab]} onPress={() => setActiveFilter('all')}>
                <Ionicons name="apps" size={16} color={activeFilter === 'all' ? '#007AFF' : '#666'} />
                <Text style={[styles.filterTabText, activeFilter === 'all' && styles.activeFilterText]}>All</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterTab, activeFilter === 'calls' && styles.activeFilterTab]} onPress={() => setActiveFilter('calls')}>
                <Ionicons name="call" size={16} color={activeFilter === 'calls' ? '#4CD964' : '#666'} />
                <Text style={[styles.filterTabText, activeFilter === 'calls' && styles.activeFilterText]}>Calls</Text>
                {getCalls().filter(n => !n.isRead).length > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: '#4CD964' }]}>
                        <Text style={styles.filterBadgeText}>{getCalls().filter(n => !n.isRead).length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterTab, activeFilter === 'messages' && styles.activeFilterTab]} onPress={() => setActiveFilter('messages')}>
                <Ionicons name="chatbubble" size={16} color={activeFilter === 'messages' ? '#007AFF' : '#666'} />
                <Text style={[styles.filterTabText, activeFilter === 'messages' && styles.activeFilterText]}>Messages</Text>
                {getMessages().filter(n => !n.isRead).length > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: '#007AFF' }]}>
                        <Text style={styles.filterBadgeText}>{getMessages().filter(n => !n.isRead).length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterTab, activeFilter === 'spaces' && styles.activeFilterTab]} onPress={() => setActiveFilter('spaces')}>
                <Ionicons name="cube" size={16} color={activeFilter === 'spaces' ? '#5856D6' : '#666'} />
                <Text style={[styles.filterTabText, activeFilter === 'spaces' && styles.activeFilterText]}>Spaces</Text>
                {getSpaces().filter(n => !n.isRead).length > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: '#5856D6' }]}>
                        <Text style={styles.filterBadgeText}>{getSpaces().filter(n => !n.isRead).length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterTab, activeFilter === 'activities' && styles.activeFilterTab]} onPress={() => setActiveFilter('activities')}>
                <Ionicons name="sparkles" size={16} color={activeFilter === 'activities' ? '#FF2D55' : '#666'} />
                <Text style={[styles.filterTabText, activeFilter === 'activities' && styles.activeFilterText]}>Activities</Text>
                {getActivities().filter(n => !n.isRead).length > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: '#FF2D55' }]}>
                        <Text style={styles.filterBadgeText}>{getActivities().filter(n => !n.isRead).length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterTab, activeFilter === 'regular' && styles.activeFilterTab]} onPress={() => setActiveFilter('regular')}>
                <Ionicons name="notifications" size={16} color={activeFilter === 'regular' ? '#000' : '#666'} />
                <Text style={[styles.filterTabText, activeFilter === 'regular' && styles.activeFilterText]}>Regular</Text>
                {getRegularNotifications().filter(n => !n.isRead).length > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: '#FF9500' }]}>
                        <Text style={styles.filterBadgeText}>{getRegularNotifications().filter(n => !n.isRead).length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterTab, activeFilter === 'admin' && styles.activeFilterTab]} onPress={() => setActiveFilter('admin')}>
                <Ionicons name="shield-checkmark" size={16} color={activeFilter === 'admin' ? '#FF3B30' : '#666'} />
                <Text style={[styles.filterTabText, activeFilter === 'admin' && styles.activeFilterText]}>Administration</Text>
                {useNotificationStore.getState().unreadModerationCount > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: '#FF3B30' }]}>
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
                    anchorPosition ? {
                        top: anchorPosition.top + 15,
                        left: anchorPosition.left,
                        right: anchorPosition.right,
                    } : styles.defaultPosition
                ]}
            >
                {/* Pointer Arrow */}
                {anchorPosition && (
                    <View
                        style={[
                            styles.pointer,
                            anchorPosition.right !== undefined
                                ? { right: anchorPosition.arrowOffset }
                                : { left: anchorPosition.arrowOffset }
                        ]}
                    />
                )}

                <View style={styles.contentWrapper}>
                    <View style={styles.panelHeader}>
                        <Text style={styles.panelTitle}>
                            Notifications {totalCount > 0 ? `(${totalCount})` : ''}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.filterTabsContainer}>
                        {renderFilterTabs()}
                    </View>

                    <View style={styles.listContainer}>
                        {totalCount > 0 ? (
                            <FlatList
                                style={{ flex: 1 }}
                                data={filteredNotifications}
                                renderItem={renderNotificationItem}
                                keyExtractor={(item) => item.id}
                                extraData={activeFilter}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                            />
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
                                <Text style={styles.emptyText}>No notifications yet</Text>
                            </View>
                        )}
                    </View>

                    {/* Footer Toggle */}
                    <View style={styles.panelFooter}>
                        <View style={styles.pushToggleRow}>
                            <Ionicons name="notifications-outline" size={16} color="#666" />
                            <Text style={styles.pushToggleText}>Push Notifications</Text>
                            <Switch
                                value={pushEnabled}
                                onValueChange={handlePushToggle}
                                trackColor={{ false: '#eee', true: '#30D158' }}
                                ios_backgroundColor="#eee"
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                        </View>
                        {Platform.OS === 'web' && /iPhone|iPad|iPod/.test(navigator.userAgent) && (
                            <View style={styles.iosWebTip}>
                                <Text style={styles.iosWebTipText}>
                                    Tap "Share" → "Add to Home Screen" for background alerts
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
        width: Platform.OS === 'web' ? 400 : 320,
        maxHeight: 500,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        ...createShadow({
            width: 0,
            height: 4,
            opacity: 0.2,
            radius: 12,
            elevation: 8,
        }),
        borderWidth: 1,
        borderColor: '#efefef',
        zIndex: 1000,
    },
    defaultPosition: {
        top: 90,
        left: 16,
        right: 16,
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
        backgroundColor: '#ffffff',
        transform: [{ rotate: '45deg' }],
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: '#efefef',
        zIndex: -1, // Behind the content but shadows will show
    },
    panelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        backgroundColor: '#fff',
        flexShrink: 0,
        zIndex: 10,
    },
    panelTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
    closeButton: {
        padding: 4,
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
    },
    filterTabsContainer: {
        height: 60,
        backgroundColor: '#fff',
        flexShrink: 0,
        zIndex: 100,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    filterTabs: {
        flex: 1,
    },
    filterTabsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    listContainer: {
        flex: 1,
        backgroundColor: '#fff',
        zIndex: 1,
        overflow: 'hidden',
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 24,
        backgroundColor: '#f8f9fa',
        marginRight: 8,
        gap: 6,
    },


    activeFilterTab: { backgroundColor: '#e8f0fe', borderColor: '#007AFF', borderWidth: 1 },
    filterTabText: { fontSize: 13, fontWeight: '500', color: '#666' },
    activeFilterText: { color: '#007AFF', fontWeight: '600' },
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
        borderColor: '#ffffff',
    },
    filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    listContent: { flexGrow: 1, paddingVertical: 8 },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
        minHeight: 80,
    },
    unreadNotification: { backgroundColor: '#f8faff', borderLeftWidth: 3, borderLeftColor: '#007AFF' },
    notificationContent: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
    textContent: { flex: 1, marginLeft: 12 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    titleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    notificationTitle: { fontWeight: '600', fontSize: 15, color: '#1a1a1a', flex: 1 },
    notificationMessage: { fontSize: 13, color: '#666', marginBottom: 6, lineHeight: 18 },
    notificationTime: { fontSize: 11, color: '#999', marginLeft: 8 },
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
    metadataText: { fontSize: 11, color: '#555', fontWeight: '500' },
    deleteButton: {
        padding: 6,
        marginLeft: 8,
        borderRadius: 16,
        backgroundColor: '#f5f5f5',
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
    emptyText: { marginTop: 16, color: '#666', fontSize: 18, fontWeight: '600' },
    emptySubtext: { marginTop: 8, color: '#999', fontSize: 14, textAlign: 'center', lineHeight: 20 },
    Foto: { alignSelf: 'flex-start' },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
        backgroundColor: '#f0f0f0',
        borderWidth: 2,
        borderColor: '#fff',
    },
    panelFooter: {
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        backgroundColor: '#fafafa',
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
        color: '#666',
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