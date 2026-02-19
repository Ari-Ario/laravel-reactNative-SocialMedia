// components/Notifications/CallsPanel.tsx
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

type CallsPanelProps = {
  visible: boolean;
  onClose: () => void;
};

const CallsPanel = ({ visible, onClose }: CallsPanelProps) => {
  const {
    getCalls,
    markAsRead,
    removeNotification
  } = useNotificationStore();

  const calls = getCalls();

  const handleCallPress = (item: Notification) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }

    if (item.spaceId || item.data?.space_id) {
      const spaceId = item.spaceId || item.data?.space_id;
      router.push({
        pathname: '/(spaces)/[id]',
        params: { id: spaceId, tab: 'meeting' }
      });
    }
    onClose();
  };

  const renderCallItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.callItem, !item.isRead && styles.unreadCall]}
      onPress={() => handleCallPress(item)}
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

      <View style={styles.callContent}>
        <View style={styles.textContent}>
          <View style={styles.titleRow}>
            <View style={styles.titleWithIcon}>
              <Ionicons
                name={item.type === 'call_ended' ? 'call-outline' : 'call'}
                size={16}
                color={item.type === 'call_ended' ? '#8E8E93' : '#4CD964'}
              />
              <Text style={styles.callTitle}>{item.title}</Text>
            </View>
            <Text style={styles.callTime}>
              {formatTimeAgo(item.createdAt)}
            </Text>
          </View>
          <Text style={styles.callMessage}>{item.message}</Text>

          {item.data?.call?.type && (
            <View style={styles.metadataContainer}>
              <Ionicons
                name={item.data.call.type === 'video' ? 'videocam' : 'call'}
                size={12}
                color="#4CD964"
              />
              <Text style={styles.metadataText}>
                {item.data.call.type === 'video' ? 'Video call' : 'Audio call'}
              </Text>
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
            Calls {calls.length > 0 ? `(${calls.length})` : ''}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>
        {calls.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="call-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No call notifications</Text>
            <Text style={styles.emptySubtext}>
              Incoming calls will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={calls}
            renderItem={renderCallItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.callsList}
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
  callsList: {
    flexGrow: 1,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  unreadCall: {
    backgroundColor: '#f8f9fa',
  },
  callContent: {
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
  callTitle: {
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  callMessage: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  callTime: {
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

export default CallsPanel;