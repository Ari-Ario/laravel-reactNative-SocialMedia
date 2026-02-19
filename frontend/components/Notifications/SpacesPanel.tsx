// components/Notifications/SpacesPanel.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '@/stores/notificationStore';
import { Notification } from '@/types/Notification';
import getApiBaseImage from '@/services/getApiBaseImage';
import { router } from 'expo-router';

type SpacesPanelProps = {
  visible: boolean;
  onClose: () => void;
};

const SpacesPanel = ({ visible, onClose }: SpacesPanelProps) => {
  const {
    getSpaces,
    markAsRead,
    removeNotification
  } = useNotificationStore();

  const spaces = getSpaces();

  const handleSpacePress = (item: Notification) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }

    if (item.spaceId || item.data?.space_id || item.data?.space?.id) {
      const spaceId = item.spaceId || item.data?.space_id || item.data?.space?.id;
      router.push({
        pathname: '/(spaces)/[id]',
        params: {
          id: spaceId,
          ...(item.type === 'space_invitation' ? { justInvited: 'true' } : {})
        }
      });
    }
    onClose();
  };

  const renderSpaceItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.spaceItem, !item.isRead && styles.unreadSpace]}
      onPress={() => handleSpacePress(item)}
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

      <View style={styles.spaceContent}>
        <View style={styles.textContent}>
          <View style={styles.titleRow}>
            <View style={styles.titleWithIcon}>
              <Ionicons
                name={item.type === 'space_invitation' ? 'people' : 'cube'}
                size={16}
                color="#5856D6"
              />
              <Text style={styles.spaceTitle}>{item.title}</Text>
            </View>
            <Text style={styles.spaceTime}>
              {formatTimeAgo(item.createdAt)}
            </Text>
          </View>
          <Text style={styles.spaceMessage}>{item.message}</Text>

          {item.data?.space?.title && (
            <View style={styles.metadataContainer}>
              <Ionicons name="cube" size={12} color="#5856D6" />
              <Text style={styles.metadataText}>{item.data.space.title}</Text>
            </View>
          )}
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
            Spaces {spaces.length > 0 ? `(${spaces.length})` : ''}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>
        {spaces.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No space notifications</Text>
            <Text style={styles.emptySubtext}>
              Space invitations and updates will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={spaces}
            renderItem={renderSpaceItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.spacesList}
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
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }
    }),
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
  spacesList: {
    flexGrow: 1,
  },
  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  unreadSpace: {
    backgroundColor: '#f8f9fa',
  },
  spaceContent: {
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
  spaceTitle: {
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  spaceMessage: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  spaceTime: {
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

export default SpacesPanel;