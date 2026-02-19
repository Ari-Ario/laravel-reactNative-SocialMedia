import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import MessageBubble from './MessageBubble';
import CollaborationService from '@/services/ChatScreen/CollaborationService';

interface Message {
  id: string;
  conversation_id?: number;
  user_id: number;
  user_name?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'file' | 'voice';
  metadata?: any;
  file_path?: string;
  mime_type?: string;
  reactions?: any[];
  reply_to_id?: string;
  mood_detected?: string;
  created_at: string;
  user?: {
    id: number;
    name: string;
    profile_photo?: string;
  };
}

interface MessageListProps {
  spaceId?: string;
  conversationId?: number;
  currentUserId: number;
}

const MessageList: React.FC<MessageListProps> = ({
  spaceId,
  conversationId,
  currentUserId,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  const collaborationService = CollaborationService.getInstance();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();

    // ✅ FIX: Subscribe to real-time messages
    if (spaceId) {
      subscribeToMessages();
    }

    return () => {
      // Cleanup subscription
      if (spaceId) {
        collaborationService.unsubscribeFromSpace(spaceId);
      }
    };
  }, [spaceId, conversationId]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      let messageList: Message[] = [];

      if (spaceId) {
        const space = await collaborationService.fetchSpaceDetails(spaceId);
        if (space.content_state?.messages) {
          messageList = space.content_state.messages;
        }
      } else if (conversationId) {
        // Fetch from conversation messages endpoint
        // You'll need to implement this endpoint
      }

      setMessages(messageList.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!spaceId) return;

    collaborationService.subscribeToSpace(spaceId, {
      onMessage: (data: any) => {
        console.log('📨 New message received:', data);

        const newMessage = data.message || data;

        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) {
            return prev;
          }

          const updated = [...prev, newMessage].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          // Scroll to bottom on new message
          setTimeout(() => {
            try {
              flatListRef.current?.scrollToEnd({ animated: true });
            } catch (scrollError) {
              console.warn('Scroll error:', scrollError);
            }
          }, 100);

          return updated;
        });

        // ✅ FIX: Add comprehensive platform and availability check for haptics
        if (newMessage.user_id !== currentUserId) {
          // Only attempt haptics on native platforms
          if (Platform.OS !== 'web') {
            try {
              // Dynamic import to avoid web issues
              import('expo-haptics').then(Haptics => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  .catch(err => console.warn('Haptics error:', err));
              }).catch(err => {
                console.warn('Haptics module not available:', err);
              });
            } catch (error) {
              console.warn('Haptics not available:', error);
            }
          }
        }
      },

      onContentUpdate: (contentState) => {
        if (contentState.messages) {
          setMessages(contentState.messages.sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ));
        }
      },
    });
  };

  const handleMessagePress = async (message: Message) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.warn('Haptics error:', error);
      }
    }
    setSelectedMessage(selectedMessage === message.id ? null : message.id);
  };

  const handleMessageLongPress = (message: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Message Options',
      `From: ${message.user?.name || message.user_name || 'User'}\nTime: ${new Date(message.created_at).toLocaleTimeString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reply', onPress: () => handleReply(message) },
        { text: 'React', onPress: () => showReactionPicker(message) },
        { text: 'Copy', onPress: () => handleCopy(message) },
        { text: 'Forward', onPress: () => handleForward(message) },
        { text: 'Report', style: 'destructive', onPress: () => handleReport(message) },
      ]
    );
  };

  const handleReply = (message: Message) => {
    // Implement reply logic
    console.log('Reply to:', message.id);
  };

  const showReactionPicker = (message: Message) => {
    const reactions = ['❤️', '😂', '😮', '😢', '👏', '🔥'];
    Alert.alert(
      'React to Message',
      'Choose a reaction:',
      reactions.map(reaction => ({
        text: reaction,
        onPress: () => handleReact(message, reaction),
      })),
      { cancelable: true }
    );
  };

  const handleReact = async (message: Message, reaction: string) => {
    try {
      // Update local state optimistically
      setMessages(prev => prev.map(msg =>
        msg.id === message.id
          ? {
            ...msg,
            reactions: [...(msg.reactions || []), {
              user_id: currentUserId,
              reaction,
              created_at: new Date().toISOString(),
            }]
          }
          : msg
      ));

      // Send to backend
      await collaborationService.reactToMessage(message.id, reaction);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error reacting:', error);
    }
  };

  const handleCopy = (message: Message) => {
    // Implement copy to clipboard
    console.log('Copy:', message.content);
  };

  const handleForward = (message: Message) => {
    // Implement forward logic
    console.log('Forward:', message.id);
  };

  const handleReport = (message: Message) => {
    Alert.alert(
      'Report Message',
      'Why are you reporting this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Spam', onPress: () => submitReport(message, 'spam') },
        { text: 'Harassment', onPress: () => submitReport(message, 'harassment') },
        { text: 'Inappropriate', onPress: () => submitReport(message, 'inappropriate') },
      ]
    );
  };

  const submitReport = async (message: Message, reason: string) => {
    console.log('Report:', message.id, reason);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isCurrentUser = item.user_id === currentUserId;
    const showAvatar = index === 0 ||
      messages[index - 1]?.user_id !== item.user_id ||
      new Date(item.created_at).getTime() - new Date(messages[index - 1]?.created_at).getTime() > 5 * 60 * 1000;

    return (
      <MessageBubble
        message={item}
        isCurrentUser={isCurrentUser}
        showAvatar={showAvatar}
        isSelected={selectedMessage === item.id}
        onPress={() => handleMessagePress(item)}
        onLongPress={() => handleMessageLongPress(item)}
      />
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          // Load more messages
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>
              Start the conversation by sending a message
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
});

export default MessageList;