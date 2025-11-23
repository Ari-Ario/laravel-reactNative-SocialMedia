// Update your FollowerPanel component
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { Notification } from '@/types/Notification';
import getApiBaseImage from '@/services/getApiBaseImage';
import { followUser } from '@/services/UserService';
import { useProfileView } from '@/context/ProfileViewContext';

type FollowersPanelProps = {
  visible: boolean;
  onClose: () => void;
};

const FollowersPanel = ({ visible, onClose }: FollowersPanelProps) => {
  const { 
    getFollowerNotifications, 
    markAsRead, 
    removeNotification, 
    markAllFollowerNotificationsAsRead,
    getUnreadFollowerCount 
  } = useNotificationStore();
  
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Use getter methods to get filtered notifications
  const followerNotifications = getFollowerNotifications();
  const unreadFollowerCount = getUnreadFollowerCount();

  const renderFollowerItem = ({ item }: { item: Notification }) => (
    console.log('Rendering follower item:', item),
    <TouchableOpacity 
      style={[styles.followerItem, !item.isRead && styles.unreadFollower]}
      onPress={() => {
        if (!item.isRead) {
          markAsRead(item.id);
        }
        if (item.userId) {
          setProfileViewUserId(item.userId.toString());
          setProfilePreviewVisible(true);
          onClose();
        }
      }}
    >
      <TouchableOpacity 
        style={styles.Foto}
        onPress={() => {
          if (item.userId) {
            setProfileViewUserId(item.userId.toString());
            setProfilePreviewVisible(true);
            onClose();
          }
        }}
      >
        <Image
          source={{ 
            uri: item.avatar ? `${getApiBaseImage()}/storage/${item.avatar}` : undefined 
          }}
          defaultSource={require('@/assets/images/favicon.png')}
          style={styles.avatar}
        />
      </TouchableOpacity>

      <View style={styles.followerContent}>
        <View style={styles.textContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons 
              name={item.type === 'new_follower' ? 'person-add-outline' : 'person-remove-outline'} 
              size={20} 
              color={item.type === 'new_follower' ? '#5856D6' : '#FF3B30'} 
            />
            <Text style={styles.followerTitle}>{item.title}</Text>
            <Text style={styles.followerTime}>
              {formatTimeAgo(item.createdAt)}
            </Text>
          </View>
          <Text style={styles.followerMessage}>{item.message}</Text>
        </View>
        {/* {item.type === 'new_follower' && item.userId && (
          <TouchableOpacity
            style={[styles.followButton, item.data?.is_following && styles.followingButton]}
            onPress={async () => {
              setLoading(prev => ({ ...prev, [item.id]: true }));
              try {
                await followUser(item.userId!, item.data?.is_following ? 'unfollow' : 'follow');
                setNotificationStore.getState().addNotification({
                  ...item,
                  data: { ...item.data, is_following: !item.data?.is_following },
                });
              } catch (error) {
                console.error('Error following/unfollowing:', error);
              } finally {
                setLoading(prev => ({ ...prev, [item.id]: false }));
              }
            }}
            disabled={loading[item.id]}
          >
            <Text style={[styles.followButtonText, item.data?.is_following && styles.followingButtonText]}>
              {loading[item.id] ? '...' : item.data?.is_following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )} */}
      </View>
      <TouchableOpacity 
        onPress={() => removeNotification(item.id)}
        style={styles.deleteButton}
      >
        <Ionicons name="close" size={16} color="#999" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

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
      transparent={true}
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
            Followers {followerNotifications.length > 0 ? `(${followerNotifications.length})` : ''}
          </Text>
          <TouchableOpacity onPress={() => {
            markAllFollowerNotificationsAsRead();
            onClose();
          }} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>
        {followerNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-add-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No follower notifications</Text>
            <Text style={styles.emptySubtext}>
              New follower notifications will appear here in real-time
            </Text>
          </View>
        ) : (
          <FlatList
            data={followerNotifications}
            renderItem={renderFollowerItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.followersList}
          />
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
  followersList: {
    flexGrow: 1,
  },
  followerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  unreadFollower: {
    backgroundColor: '#f8f9fa',
  },
  followerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContent: {
    flex: 1,
    marginLeft: 12,
  },
  followerTitle: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 2,
  },
  followerMessage: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  followerTime: {
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
  followButton: {
    backgroundColor: '#3897f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  followingButton: {
    backgroundColor: '#efefef',
  },
  followButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  followingButtonText: {
    color: 'black',
  },
});

export default FollowersPanel;