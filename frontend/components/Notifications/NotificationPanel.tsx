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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  initialType = 'all', // Default to 'all' instead of 'regular'
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
        // For 'all', combine regular + calls + messages + spaces + activities
        const allNotifications = [
          ...getRegularFiltered(),
          ...getCalls(),
          ...getMessages(),
          ...getSpaces(),
          ...getActivities(),
        ];
        // Sort by date (newest first)
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
      
      // Space invitation
      if (item.type === NOTIFICATION_TYPES.SPACE_INVITATION) {
        const spaceId = item.data?.space?.id || item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({
            pathname: '/(spaces)/[id]',
            params: { id: spaceId, justInvited: 'true' }
          });
          onClose();
          return;
        }
      }
      
      // Call started
      if (item.type === NOTIFICATION_TYPES.CALL_STARTED) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({
            pathname: '/(spaces)/[id]',
            params: { id: spaceId, tab: 'meeting' }
          });
          onClose();
          return;
        }
      }
      
      // New message
      if (item.type === NOTIFICATION_TYPES.NEW_MESSAGE) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({
            pathname: '/(spaces)/[id]',
            params: { id: spaceId, tab: 'chat' }
          });
          onClose();
          return;
        }
        
        // If it's a direct message (not in a space)
        const userId = item.userId || item.data?.user?.id;
        if (userId) {
          router.push({
            pathname: '/(tabs)/chats/[id]',
            params: { id: userId.toString() }
          });
          onClose();
          return;
        }
      }
      
      // Participant joined
      if (item.type === NOTIFICATION_TYPES.PARTICIPANT_JOINED) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({
            pathname: '/(spaces)/[id]',
            params: { id: spaceId, tab: 'chat' }
          });
          onClose();
          return;
        }
      }
      
      // Magic event
      if (item.type === NOTIFICATION_TYPES.MAGIC_EVENT) {
        const spaceId = item.spaceId || item.data?.space_id;
        const eventId = item.data?.event?.id || item.data?.eventId;
        if (spaceId) {
          router.push({
            pathname: '/(spaces)/[id]',
            params: { 
              id: spaceId, 
              highlightMagic: eventId ? eventId.toString() : 'true' 
            }
          });
          onClose();
          return;
        }
      }
      
      // Screen share
      if (item.type === NOTIFICATION_TYPES.SCREEN_SHARE) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({
            pathname: '/(spaces)/[id]',
            params: { id: spaceId, tab: 'meeting' }
          });
          onClose();
          return;
        }
      }
      
      // Activity created
      if (item.type === NOTIFICATION_TYPES.ACTIVITY_CREATED) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({
            pathname: '/(spaces)/[id]',
            params: { id: spaceId, tab: 'calendar' }
          });
          onClose();
          return;
        }
      }
      
      // Space updated
      if (item.type === NOTIFICATION_TYPES.SPACE_UPDATED) {
        const spaceId = item.spaceId || item.data?.space_id;
        if (spaceId) {
          router.push({
            pathname: '/(spaces)/[id]',
            params: { id: spaceId }
          });
          onClose();
          return;
        }
      }
      
      // Call ended (maybe just log, no navigation needed)
      if (item.type === NOTIFICATION_TYPES.CALL_ENDED) {
        // Just mark as read, no navigation
        onClose();
        return;
      }

      // ============= EXISTING NOTIFICATIONS =============
      
      if (item.type === 'post_deleted') {
        onClose();
        return;
      }
      
      if (['training_needed', NOTIFICATION_TYPES.CHATBOT_TRAINING].includes(item.type)) {
        router.replace({
          pathname: '/(tabs)/chatbotTraining',
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
          params: { highlightCommentId: item.commentId.toString() }
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

      // Profile navigation for user-related notifications
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
    console.log('🖼️ Avatar pressed for user:', item.userId);
    if (item.userId) {
      setProfileViewUserId(item.userId.toString());
      setProfilePreviewVisible(true);
      onClose();
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    // Safe avatar URL handling
    const getAvatarSource = () => {
      if (!item.avatar) {
        return require('@/assets/images/favicon.png');
      }
      
      const avatarString = String(item.avatar).trim();
      if (!avatarString) {
        return require('@/assets/images/favicon.png');
      }
      
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
            onError={(e) => {
              console.log('🖼️ Image load error for avatar:', item.avatar);
            }}
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

            <Text style={styles.notificationMessage}>{item.message}</Text>
            
            {/* Show additional info for chat notifications */}
            {item.type === NOTIFICATION_TYPES.SPACE_INVITATION && item.data?.space?.title && (
              <View style={styles.metadataContainer}>
                <Ionicons name="people" size={12} color="#666" />
                <Text style={styles.metadataText}>Space: {item.data.space.title}</Text>
              </View>
            )}
            
            {item.type === NOTIFICATION_TYPES.CALL_STARTED && item.data?.call?.type && (
              <View style={styles.metadataContainer}>
                <Ionicons 
                  name={item.data.call.type === 'video' ? 'videocam' : 'call'} 
                  size={12} 
                  color="#4CD964" 
                />
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
      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'all' && styles.activeFilterTab]}
        onPress={() => setActiveFilter('all')}
      >
        <Ionicons name="apps" size={16} color={activeFilter === 'all' ? '#007AFF' : '#666'} />
        <Text style={[styles.filterTabText, activeFilter === 'all' && styles.activeFilterText]}>All</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'calls' && styles.activeFilterTab]}
        onPress={() => setActiveFilter('calls')}
      >
        <Ionicons name="call" size={16} color={activeFilter === 'calls' ? '#4CD964' : '#666'} />
        <Text style={[styles.filterTabText, activeFilter === 'calls' && styles.activeFilterText]}>Calls</Text>
        {getCalls().filter(n => !n.isRead).length > 0 && (
          <View style={[styles.filterBadge, { backgroundColor: '#4CD964' }]}>
            <Text style={styles.filterBadgeText}>{getCalls().filter(n => !n.isRead).length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'messages' && styles.activeFilterTab]}
        onPress={() => setActiveFilter('messages')}
      >
        <Ionicons name="chatbubble" size={16} color={activeFilter === 'messages' ? '#007AFF' : '#666'} />
        <Text style={[styles.filterTabText, activeFilter === 'messages' && styles.activeFilterText]}>Messages</Text>
        {getMessages().filter(n => !n.isRead).length > 0 && (
          <View style={[styles.filterBadge, { backgroundColor: '#007AFF' }]}>
            <Text style={styles.filterBadgeText}>{getMessages().filter(n => !n.isRead).length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'spaces' && styles.activeFilterTab]}
        onPress={() => setActiveFilter('spaces')}
      >
        <Ionicons name="cube" size={16} color={activeFilter === 'spaces' ? '#5856D6' : '#666'} />
        <Text style={[styles.filterTabText, activeFilter === 'spaces' && styles.activeFilterText]}>Spaces</Text>
        {getSpaces().filter(n => !n.isRead).length > 0 && (
          <View style={[styles.filterBadge, { backgroundColor: '#5856D6' }]}>
            <Text style={styles.filterBadgeText}>{getSpaces().filter(n => !n.isRead).length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'activities' && styles.activeFilterTab]}
        onPress={() => setActiveFilter('activities')}
      >
        <Ionicons name="sparkles" size={16} color={activeFilter === 'activities' ? '#FF2D55' : '#666'} />
        <Text style={[styles.filterTabText, activeFilter === 'activities' && styles.activeFilterText]}>Activities</Text>
        {getActivities().filter(n => !n.isRead).length > 0 && (
          <View style={[styles.filterBadge, { backgroundColor: '#FF2D55' }]}>
            <Text style={styles.filterBadgeText}>{getActivities().filter(n => !n.isRead).length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'regular' && styles.activeFilterTab]}
        onPress={() => setActiveFilter('regular')}
      >
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <TouchableOpacity 
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      
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

        {totalCount > 0 ? (
          <FlatList
            data={filteredNotifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              New notifications will appear here in real-time
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panelContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    bottom: 100,
    backgroundColor: 'white',
    borderRadius: 16,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    elevation: 5,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  filterTabs: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  filterTabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    gap: 4,
    position: 'relative',
  },
  activeFilterTab: {
    backgroundColor: '#e3f2fd',
  },
  filterTabText: {
    fontSize: 12,
    color: '#666',
  },
  activeFilterText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    minHeight: 70,
  },
  unreadNotification: {
    backgroundColor: '#f8f9fa',
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  textContent: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  notificationTitle: {
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    lineHeight: 16,
  },
  notificationTime: {
    fontSize: 10,
    color: '#999',
    marginLeft: 8,
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  metadataText: {
    fontSize: 11,
    color: '#666',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    color: '#999',
    fontSize: 16,
  },
  emptySubtext: {
    marginTop: 4,
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  Foto: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
});

export default NotificationPanel;