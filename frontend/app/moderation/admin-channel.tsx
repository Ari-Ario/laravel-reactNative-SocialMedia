import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNotificationStore, NOTIFICATION_TYPES } from '@/stores/notificationStore';
import MessageBubble from '@/components/ChatScreen/MessageBubble';
import Colors from '@/constants/Colors';

interface AdminMessage {
  id: string;
  content: string;
  type: string;
  created_at: string;
  user: {
    id: number;
    name: string;
    profile_photo: string;
  };
  data?: {
    report_details?: {
      type: string;
      category: string;
      subcategory: string;
      description: string;
    };
  };
}

const AdminChannelScreen = () => {
  const { notifications, markModerationAsRead } = useNotificationStore();
  const [messages, setMessages] = useState<AdminMessage[]>([]);

  useEffect(() => {
    const processedMessages = notifications
      .filter(n => n.type === NOTIFICATION_TYPES.MODERATION_ACTION)
      .map(n => ({
        id: n.id,
        content: n.message,
        type: 'text',
        created_at: n.createdAt.toString(),
        user: {
          id: 0,
          name: 'Administration',
          profile_photo: 'system_admin_shield',
        },
        data: n.data,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setMessages(processedMessages);
  }, [notifications]);

  useEffect(() => {
    markModerationAsRead();
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color={(Colors as any)?.light?.tint || '#007AFF'} />
      </TouchableOpacity>
      <View style={styles.headerTitleContainer}>
        <Ionicons name="shield-checkmark" size={24} color="#FF3B30" style={{ marginRight: 8 }} />
        <Text style={styles.headerTitle}>Administration</Text>
      </View>
      <View style={{ width: 40 }} /> 
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.bubbleWrapper}>
            <MessageBubble
              message={item as any}
              isCurrentUser={false}
              showAvatar={true}
              isSelected={false}
              onPress={() => {}}
              onLongPress={() => {}}
            />
            {item.data?.report_details && (
              <View style={styles.reportContextBubble}>
                <Text style={styles.reportContextTitle}>Reported Content Context:</Text>
                <Text style={styles.reportContextText}>
                  Type: {item.data.report_details.type}
                </Text>
                <Text style={styles.reportContextText}>
                  Reason: {item.data.report_details.category} - {item.data.report_details.subcategory}
                </Text>
                {item.data.report_details.description && (
                  <Text style={styles.reportContextDesc}>
                    "{item.data.report_details.description}"
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No administration messages yet.</Text>
          </View>
        }
        inverted={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: { paddingTop: 0 },
      android: { paddingTop: 10 }
    })
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  listContent: {
    paddingVertical: 20,
  },
  bubbleWrapper: {
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  reportContextBubble: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginLeft: 40,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  reportContextTitle: {
    color: '#FF9800',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  reportContextText: {
    color: '#333',
    fontSize: 13,
    fontWeight: '600',
  },
  reportContextDesc: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default AdminChannelScreen;
