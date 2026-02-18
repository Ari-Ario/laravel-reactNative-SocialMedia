// components/Notifications/MessagesPanel.tsx
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
import { useProfileView } from '@/context/ProfileViewContext';

type MessagesPanelProps = {
  visible: boolean;
  onClose: () => void;
};

const MessagesPanel = ({ visible, onClose }: MessagesPanelProps) => {
  const {
    getMessages,
    markAsRead,
    removeNotification
  } = useNotificationStore();

  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const messages = getMessages();

  const handleMessagePress = (item: Notification) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }

    if (item.spaceId || item.data?.space_id) {
      const spaceId = item.spaceId || item.data?.space_id;
      router.push({
        pathname: '/(spaces)/[id]',
        params: { id: spaceId, tab: 'chat' }
      });
    } else if (item.userId) {
      router.push({
        pathname: '/(tabs)/chats/[id]',
        params: { id: item.userId.toString() }
      });
    }
    onClose();
  };

  const renderMessageItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.messageItem, !item.isRead && styles.unreadMessage]}
      onPress={() => handleMessagePress(item)}
    >
      <TouchableOpacity
        style={styles.Foto}
        onPress={(e) => {
          e.stopPropagation();
          if (item.userId) {
            setProfileViewUserId(item.userId.toString());
            setProfilePreviewVisible(true);
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

      <View style={styles.messageContent}>
        <View style={styles.textContent}>
          <View style={styles.titleRow}>
            <View style={styles.titleWithIcon}>
              <Ionicons name="chatbubble" size={16} color="#007AFF" />
              <Text style={styles.messageTitle}>{item.title}</Text>
            </View>
            <Text style={styles.messageTime}>
              {formatTimeAgo(item.createdAt)}
            </Text>
          </View>
          <Text style={styles.messagePreview}>
            {typeof item.message === 'string'
              ? item.message
              : (item.message as any)?.content
              ?? (item.message as any)?.text
              ?? 'New message received'}
          </Text>

          {item.data?.space?.title && (
            <View style={styles.metadataContainer}>
              <Ionicons name="cube" size={12} color="#5856D6" />
              <Text style={styles.metadataText}>in {item.data.space.title}</Text>
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
            Messages {messages.length > 0 ? `(${messages.length})` : ''}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No message notifications</Text>
            <Text style={styles.emptySubtext}>
              New messages will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
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
  messagesList: {
    flexGrow: 1,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  unreadMessage: {
    backgroundColor: '#f8f9fa',
  },
  messageContent: {
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
  messageTitle: {
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  messagePreview: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  messageTime: {
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

export default MessagesPanel;