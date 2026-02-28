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

interface NotificationPanelProps {
  visible: boolean;
  onClose: () => void;
  initialType?: 'all' | 'calls' | 'messages' | 'spaces' | 'activities' | 'regular';
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  visible,
  onClose,
  initialType = 'all',
}) => {
  const {
    getRegularNotifications,
    markAsRead,
    removeNotification,
    getCalls,
    getMessages,
    getSpaces,
    getActivities,
    getRegularFiltered,
  } = useNotificationStore();

  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const { addPost } = usePostStore();

  const [activeFilter, setActiveFilter] = useState<'all' | 'calls' | 'messages' | 'spaces' | 'activities' | 'regular'>(initialType);

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
        return getRegularFiltered();
      case 'all':
      default:
        const allNotifications = [
          ...getRegularFiltered(),
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
    console.log('🔔 Notification pressed:', item.type, 'data:', item.data);

    if (!item.isRead) {
      markAsRead(item.id);
    }

    try {
      // ============= CHAT & SPACE NOTIFICATIONS =============
      if (item.type === NOTIFICATION_TYPES.SPACE_INVITATION) {
        const spaceId = item.data?.space?.id || item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, justInvited: 'true' } });
          onClose();
          return;
        }
      }

      if (item.type === NOTIFICATION_TYPES.CALL_STARTED) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'meeting' } });
          onClose();
          return;
        }
      }

      if (item.type === NOTIFICATION_TYPES.NEW_MESSAGE) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'chat' } });
          onClose();
          return;
        }
        const userId = item.userId || item.data?.user?.id;
        if (userId) {
          router.push({ pathname: '/(tabs)/chats/[id]', params: { id: userId.toString() } });
          onClose();
          return;
        }
      }

      if (item.type === NOTIFICATION_TYPES.PARTICIPANT_JOINED) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'chat' } });
          onClose();
          return;
        }
      }

      if (item.type === NOTIFICATION_TYPES.MAGIC_EVENT) {
        const spaceId = item.spaceId || item.data?.space_id;
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

      if (item.type === NOTIFICATION_TYPES.SCREEN_SHARE) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'meeting' } });
          onClose();
          return;
        }
      }

      if (item.type === NOTIFICATION_TYPES.ACTIVITY_CREATED) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'calendar' } });
          onClose();
          return;
        }
      }

      if (item.type === NOTIFICATION_TYPES.SPACE_UPDATED) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId } });
          onClose();
          return;
        }
      }

      if (item.type === NOTIFICATION_TYPES.CALL_ENDED) {
        onClose();
        return;
      }

      // ============= RESTORED POST-RELATED NOTIFICATIONS =============
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
        router.push(`/post/${item.postId}`);
        onClose();
        return;
      }

      if ((item.type === NOTIFICATION_TYPES.COMMENT || item.type === NOTIFICATION_TYPES.COMMENT_REACTION) && item.postId && item.commentId) {
        const postData = await fetchPostById(item.postId);
        if (postData?.data) addPost(postData.data);
        router.push({
          pathname: `/post/${item.postId}`,
          params: { highlightCommentId: item.commentId.toString() },
        });
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

      // ============= PROFILE NAVIGATION =============
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
                <Ionicons name={iconName} size={16} color={iconColor} />
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
        {getRegularFiltered().filter(n => !n.isRead).length > 0 && (
          <View style={[styles.filterBadge, { backgroundColor: '#FF9500' }]}>
            <Text style={styles.filterBadgeText}>{getRegularFiltered().filter(n => !n.isRead).length}</Text>
          </View>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={styles.panelContainer}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>
            Notifications {totalCount > 0 ? `(${totalCount})` : ''}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {renderFilterTabs()}

        {/* Fixed container to prevent jumping when switching tabs */}
        <View style={{ flex: 1 }}>
          {totalCount > 0 ? (
            <FlatList
              data={filteredNotifications}
              renderItem={renderNotificationItem}
              keyExtractor={(item) => item.id}
              extraData={activeFilter}           // ← prevents jump
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySubtext}>New notifications will appear here in real-time</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  panelContainer: {
    position: 'absolute',
    top: 90,
    left: 16,
    right: 16,
    bottom: 90,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    ...createShadow({
      width: 0,
      height: 8,
      opacity: 0.15,
      radius: 24,
      elevation: 10,
    }),
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  panelTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabs: { maxHeight: 64, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  filterTabsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
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
});

export default NotificationPanel;