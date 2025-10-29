// components/Notifications/NotificationPanel.tsx
import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  Modal,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '@/stores/notificationStore';
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
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  visible,
  onClose
}) => {
  const { getRegularNotifications, markAsRead, removeNotification } = useNotificationStore();
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const { addPost } = usePostStore();

  // Use getRegularNotifications to exclude follower notifications
  const regularNotifications = getRegularNotifications();

const handleNotificationPress = async (item: Notification) => {
  console.log('Notification pressed:', item.type, 'postId:', item.postId, 'commentId:', item.commentId);
  
  if (!item.isRead) {
    markAsRead(item.id);
  }

  try {
    if (item.type === 'post_deleted') {
      onClose();
      return;
    }

    if (['post', 'post_updated', 'reaction'].includes(item.type) && item.postId) {
      const postData = await fetchPostById(item.postId);
      if (postData?.data) addPost(postData.data);
      router.push(`/post/${item.postId}`);
      onClose();
      return;
    }

    if ((item.type === 'comment' || item.type === 'comment_reaction') && item.postId && item.commentId) {
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

    if (item.userId && !['new_follower', 'user_unfollowed', 'new-follower', 'user-unfollowed'].includes(item.type)) {
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
      
      // Ensure avatar is a string and not empty
      const avatarString = String(item.avatar).trim();
      if (!avatarString) {
        return require('@/assets/images/favicon.png');
      }
      
      return { uri: `${getApiBaseImage()}/storage/${avatarString}` };
    };

    const avatarSource = getAvatarSource();

    return (
      <TouchableOpacity 
        style={[styles.notificationItem, !item.isRead && styles.unreadNotification]}
        onPress={() => handleNotificationPress(item)}
      >
        <TouchableOpacity 
          style={styles.Foto}
          onPress={(e) => {
            e.stopPropagation(); // Prevent triggering the main notification press
            handleAvatarPress(item);
          }}
        >
          <Image
            source={avatarSource}
            style={styles.avatar}
            defaultSource={require('@/assets/images/favicon.png')}
            onError={(e) => {
              console.log('🖼️ Image load error for avatar:', item.avatar, e.nativeEvent.error);
            }}
            // onLoad={() => {
            //   console.log('🖼️ Image loaded successfully for avatar:', item.avatar);
            // }}
          />
        </TouchableOpacity>

        <View style={styles.notificationContent}>
          <View style={styles.textContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons 
                name={getNotificationIcon(item.type)} 
                size={20} 
                color={getNotificationColor(item.type)} 
              />
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationTime}>
                {formatTimeAgo(item.createdAt)}
              </Text>
            </View>

            <Text style={styles.notificationMessage}>{item.message}</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation(); // Prevent triggering the main notification press
            removeNotification(item.id);
          }}
          style={styles.deleteButton}
        >
          <Ionicons name="close" size={16} color="#999" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment': return 'chatbubble-outline';
      case 'reaction': return 'heart-outline';
      case 'post': return 'image-outline';
      case 'mention': return 'at-outline';
      case 'follow': return 'person-add-outline';
      // REMOVED: follower types since they're in separate panel
      case 'chatbot_training': return 'school-outline';
      case 'comment_reaction': return 'heart-outline';
      case 'post_updated': return 'pencil-outline';
      case 'post_deleted': return 'trash-outline';
      case 'comment_deleted': return 'trash-outline';
      default: return 'notifications-outline';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'comment': return '#007AFF';
      case 'reaction': return '#FF3B30';
      case 'post': return '#4CD964';
      case 'mention': return '#FF9500';
      case 'follow': return '#5856D6';
      // REMOVED: follower types since they're in separate panel
      case 'chatbot_training': return '#FF2D55';
      case 'comment_reaction': return '#FF3B30';
      case 'post_updated': return '#FF9500';
      case 'post_deleted': return '#FF3B30';
      case 'comment_deleted': return '#FF3B30';
      default: return '#8E8E93';
    }
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent={true} // Add for Android
    >
      <TouchableOpacity 
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      
      <View style={styles.panelContainer}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>
            Notifications {regularNotifications.length > 0 ? `(${regularNotifications.length})` : ''}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {regularNotifications.length > 0 ? (
          <FlatList
            data={regularNotifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false} // Add for better UX
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden', // Add for Android
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white', // Ensure background color
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 10, // Add some bottom padding
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12, // Slightly increased padding for better touch
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    minHeight: 70, // Ensure consistent height
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
  notificationTitle: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    lineHeight: 16, // Better text rendering
  },
  notificationTime: {
    fontSize: 10,
    color: '#999',
    marginLeft: 'auto',
    paddingRight: 10,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8, // Add some spacing
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
    backgroundColor: '#f0f0f0', // Fallback background
  },
});

export default NotificationPanel;