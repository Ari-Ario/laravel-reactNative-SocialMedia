// components/Notifications/ActivitiesPanel.tsx
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  Image, 
  Modal 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '@/stores/notificationStore';
import { Notification } from '@/types/Notification';
import getApiBaseImage from '@/services/getApiBaseImage';
import { router } from 'expo-router';

type ActivitiesPanelProps = {
  visible: boolean;
  onClose: () => void;
};

const ActivitiesPanel = ({ visible, onClose }: ActivitiesPanelProps) => {
  const { 
    getActivities, 
    markAsRead, 
    removeNotification 
  } = useNotificationStore();

  const activities = getActivities();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'participant_joined': return 'person-add';
      case 'magic_event': return 'sparkles';
      case 'screen_share': return 'desktop';
      case 'activity_created': return 'calendar';
      default: return 'notifications';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'participant_joined': return '#FF9500';
      case 'magic_event': return '#FF2D55';
      case 'screen_share': return '#5856D6';
      case 'activity_created': return '#FF9500';
      default: return '#8E8E93';
    }
  };

  const handleActivityPress = (item: Notification) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }
    
    if (item.spaceId || item.data?.space_id) {
      const spaceId = item.spaceId || item.data?.space_id;
      const tab = item.type === 'activity_created' ? 'calendar' : 'chat';
      router.push({
        pathname: '/(spaces)/[id]',
        params: { id: spaceId, tab }
      });
    }
    onClose();
  };

  const renderActivityItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={[styles.activityItem, !item.isRead && styles.unreadActivity]}
      onPress={() => handleActivityPress(item)}
    >
      <TouchableOpacity 
        style={styles.Foto}
        onPress={(e) => {
          e.stopPropagation();
          // Optional: navigate to user profile
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

      <View style={styles.activityContent}>
        <View style={styles.textContent}>
          <View style={styles.titleRow}>
            <View style={styles.titleWithIcon}>
              <Ionicons 
                name={getActivityIcon(item.type)} 
                size={16} 
                color={getActivityColor(item.type)} 
              />
              <Text style={styles.activityTitle}>{item.title}</Text>
            </View>
            <Text style={styles.activityTime}>
              {formatTimeAgo(item.createdAt)}
            </Text>
          </View>
          <Text style={styles.activityMessage}>{item.message}</Text>
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
            Activities {activities.length > 0 ? `(${activities.length})` : ''}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>
        {activities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No activity notifications</Text>
            <Text style={styles.emptySubtext}>
              Magic events and activities will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={activities}
            renderItem={renderActivityItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.activitiesList}
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
  activitiesList: {
    flexGrow: 1,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  unreadActivity: {
    backgroundColor: '#f8f9fa',
  },
  activityContent: {
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
  activityTitle: {
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  activityMessage: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 10,
    color: '#999',
    marginLeft: 8,
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

export default ActivitiesPanel;