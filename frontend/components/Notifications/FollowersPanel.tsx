// components/Notifications/FollowersPanel.tsx
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createShadow } from '@/utils/styles';
import { useState, useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { Notification } from '@/types/Notification';
import getApiBaseImage from '@/services/getApiBaseImage';
import { followUser } from '@/services/UserService';
import { useProfileView } from '@/context/ProfileViewContext';
import axios from "@/services/axios";
import { getToken } from "@/services/TokenService";
import getApiBase from "@/services/getApiBase";

const API_BASE = getApiBase();

type FollowersPanelProps = {
  visible: boolean;
  onClose: () => void;
  anchorPosition?: { top: number; left?: number; right?: number; arrowOffset?: number };
};

const FollowersPanel = ({ visible, onClose, anchorPosition }: FollowersPanelProps) => {
  const {
    getFollowerNotifications,
    markAsRead,
    removeNotification,
    markAllFollowerNotificationsAsRead,
    getUnreadFollowerCount
  } = useNotificationStore();

  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isFollowingMap, setIsFollowingMap] = useState<Record<string, boolean>>({});
  const [checkingStatus, setCheckingStatus] = useState<Record<string, boolean>>({});

  // Use getter methods to get filtered notifications
  const followerNotifications = getFollowerNotifications();
  const unreadFollowerCount = getUnreadFollowerCount();

  // Check follow status for all users when panel opens
  useEffect(() => {
    if (visible && followerNotifications.length > 0) {
      checkAllFollowStatus();
    }
  }, [visible]);

  const checkAllFollowStatus = async () => {
    const token = await getToken();

    for (const item of followerNotifications) {
      if (item.userId && item.type === 'new_follower') {
        await checkSingleFollowStatus(item, token);
      }
    }
  };

  const checkSingleFollowStatus = async (item: Notification, token: string | null | undefined) => {
    if (!item.userId || checkingStatus[item.id]) return;

    setCheckingStatus(prev => ({ ...prev, [item.id]: true }));

    try {
      // Use the existing profile/following API endpoint
      const response = await axios.get(`${API_BASE}/profile/following`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // The response should be an array of users you're following
      const followingList = response.data;

      // Check if this user ID is in the following list
      const isFollowing = followingList.some(
        (followedUser: any) =>
          followedUser.id?.toString() === item.userId?.toString() ||
          followedUser.user_id?.toString() === item.userId?.toString() ||
          followedUser.following_id?.toString() === item.userId?.toString()
      );

      setIsFollowingMap(prev => ({ ...prev, [item.userId!]: isFollowing }));
    } catch (error) {
      console.error('Error checking follow status:', error);
      // Default to false on error
      setIsFollowingMap(prev => ({ ...prev, [item.userId!]: false }));
    } finally {
      setCheckingStatus(prev => ({ ...prev, [item.id]: false }));
    }
  };

  // Handle follow back (only for new_follower notifications)
  const handleFollowBack = async (item: Notification) => {
    if (!item.userId) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    setLoading(prev => ({ ...prev, [item.id]: true }));

    try {
      await followUser(item.userId.toString(), 'follow');

      // Update local state to show following
      setIsFollowingMap(prev => ({ ...prev, [item.userId!]: true }));
      markAsRead(item.id);

      Alert.alert('Success', `You are now following ${item.title || 'this user'}`);

    } catch (error: any) {
      console.error('Follow back failed:', error);
      Alert.alert(
        'Failed to Follow Back',
        error.response?.data?.message ||
        error.message ||
        'Please try again later.'
      );
    } finally {
      setLoading(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const renderFollowerItem = ({ item }: { item: Notification }) => {
    const isFollowing = isFollowingMap[item.userId!] || false;
    const isLoading = loading[item.id] || false;
    const isChecking = checkingStatus[item.id] || false;

    return (
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
            <View style={styles.titleRow}>
              <Ionicons
                name={item.type === 'new_follower' ? 'person-add-outline' : 'person-remove-outline'}
                size={18}
                color={item.type === 'new_follower' ? '#5856D6' : '#FF3B30'}
              />
              <Text style={styles.followerTitle}>{item.title}</Text>
              <Text style={styles.followerTime}>
                {formatTimeAgo(item.createdAt)}
              </Text>
            </View>
            <Text style={styles.followerMessage}>{item.message}</Text>
          </View>
        </View>

        {/* FOLLOW BACK BUTTON - only for new_follower */}
        {item.type === 'new_follower' && (
          <View style={styles.buttonContainer}>
            {isChecking ? (
              <ActivityIndicator size="small" color="#007AFF" style={styles.followButton} />
            ) : (
              <TouchableOpacity
                style={[
                  styles.followButton,
                  isFollowing && styles.followingButton
                ]}
                onPress={() => handleFollowBack(item)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={isFollowing ? 'black' : 'white'}
                  />
                ) : (
                  <Text style={[
                    styles.followButtonText,
                    isFollowing && styles.followingButtonText
                  ]}>
                    {isFollowing ? 'Following' : 'Follow Back'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={() => removeNotification(item.id)}
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

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
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
              Followers {followerNotifications.length > 0 ? `(${followerNotifications.length})` : ''}
            </Text>
            <TouchableOpacity onPress={() => {
              markAllFollowerNotificationsAsRead();
              onClose();
            }} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
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
                showsVerticalScrollIndicator={false}
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
    zIndex: -1,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  followersList: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  followerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  unreadFollower: {
    backgroundColor: '#f8faff',
    borderLeftWidth: 3,
    borderLeftColor: '#5856D6',
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  followerTitle: {
    fontWeight: '600',
    fontSize: 15,
    color: '#1a1a1a',
    flex: 1,
  },
  followerMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  followerTime: {
    fontSize: 11,
    color: '#999',
    marginLeft: 8,
  },
  buttonContainer: {
    marginLeft: 8,
  },
  followButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    minWidth: 95,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
  },
  followButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 13,
  },
  followingButtonText: {
    color: '#1a1a1a',
  },
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
  emptyText: {
    marginTop: 16,
    color: '#666',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    marginTop: 8,
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  Foto: {
    alignSelf: 'flex-start',
  },
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

export default FollowersPanel;