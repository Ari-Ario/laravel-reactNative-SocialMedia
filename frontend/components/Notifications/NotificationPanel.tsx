// components/Notifications/NotificationPanel.tsx
import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  Modal,
  Image,
  ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '@/stores/notificationStore';
import { Notification } from '@/types/Notification';
import getApiBaseImage from '@/services/getApiBaseImage';

interface NotificationPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  visible,
  onClose
}) => {
  const { notifications, markAsRead, removeNotification } = useNotificationStore();

  // DEBUG: Log when panel opens
  // React.useEffect(() => {
  //   if (visible) {
  //     console.log('🔔 Notification Panel Opened');
  //     console.log('🔔 Total notifications:', notifications.length);
  //     console.log('🔔 Unread count:', notifications.filter(n => !n.isRead).length);
  //   }
  // }, [visible, notifications.length]);

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={[styles.notificationItem, !item.isRead && styles.unreadNotification]}
      onPress={() => {
        if (!item.isRead) {
          markAsRead(item.id);
        }
        // Handle notification tap (navigate to post, etc.)
        onClose();
      }}
    >

      <TouchableOpacity 
      style={styles.Foto}
      // onPress={() => {
      //   service.setProfileViewUserId(post.user.id);
      //   service.setProfilePreviewVisible(true);
      // }}
      >
        <Image
          source={{ uri: `${getApiBaseImage()}/storage/${item.avatar}` || require('@/assets/images/favicon.png') }}
          style={styles.avatar}
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
        onPress={() => removeNotification(item.id)}
        style={styles.deleteButton}
      >
        <Ionicons name="close" size={16} color="#999" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment': return 'chatbubble-outline';
      case 'reaction': return 'heart-outline';
      case 'post': return 'image-outline';
      case 'mention': return 'at-outline';
      case 'follow': return 'person-add-outline';
      case 'new_follower': return 'person-add-outline';
      case 'user_unfollowed': return 'person-remove-outline';
      case 'chatbot_training': return 'school-outline';
      case 'comment_reaction': return 'heart-outline';
      case 'post_updated': return 'pencil-outline';
      case 'post_deleted': return 'trash-outline';
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
      case 'new_follower': return '#5856D6';
      case 'user_unfollowed': return '#FF3B30';
      case 'chatbot_training': return '#FF2D55';
      case 'comment_reaction': return '#FF3B30';
      case 'post_updated': return '#FF9500';
      case 'post_deleted': return '#FF3B30';
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
    >
      <TouchableOpacity 
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      
      <View style={styles.panelContainer}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>
            Notifications {notifications.length > 0 ? `(${notifications.length})` : ''}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {notifications.length > 0 ? (
          <FlatList
            data={notifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
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
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
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
  },
  notificationTime: {
    fontSize: 10,
    color: '#999',
    marginLeft: 'auto',
    paddingRight: 10,
  },
  deleteButton: {
    padding: 4,
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
  },
});

export default NotificationPanel;