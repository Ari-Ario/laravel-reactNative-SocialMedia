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
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'poll';
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
  poll?: any;
}

interface MessageListProps {
  spaceId?: string;
  conversationId?: number;
  currentUserId: number;
  currentUserRole?: string;
  onMessageLongPress?: (message: any, x: number, y: number) => void;
  onPollPress?: (poll: any) => void;
  polls?: any[];
  participants?: any[];
}
const MessageList: React.FC<MessageListProps> = ({
  spaceId,
  conversationId,
  currentUserId,
  currentUserRole,
  onMessageLongPress,
  onPollPress,
  polls = [],
  participants = [],
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

  // Synchronize static embedded poll Data in messages with live Space API Polls, and PURGE ghost polls
  useEffect(() => {
    // If polls are undefined, it might not be loaded yet, but if it's an empty array, it means there are 0 active polls.
    if (!polls) return;

    setMessages(prev => {
      let hasChanges = false;
      
      // 1. Filter out ghost polls (polls that no longer exist in the DB)
      const validMessages = prev.filter(msg => {
        const isPollMsg = msg.type === 'poll' || msg.metadata?.isPoll;
        if (!isPollMsg) return true;
        
        const pollId = msg.poll?.id || msg.metadata?.pollId || msg.metadata?.pollData?.id;
        const livePoll = polls.find(p => String(p.id) === String(pollId) || (p.parent_poll_id && String(p.parent_poll_id) === String(pollId)));
        
        if (!livePoll) {
          hasChanges = true; // We are removing a ghost poll
          return false;
        }
        return true;
      });

      // 2. Update the data for the remaining valid polls
      const updatedMessages = validMessages.map(msg => {
        if (msg.type === 'poll' || msg.metadata?.isPoll) {
          const pollId = msg.poll?.id || msg.metadata?.pollId || msg.metadata?.pollData?.id;
          const livePoll = polls.find(p => String(p.id) === String(pollId) || (p.parent_poll_id && String(p.parent_poll_id) === String(pollId)));

          if (livePoll && JSON.stringify(msg.poll) !== JSON.stringify(livePoll)) {
            hasChanges = true;
            return { ...msg, poll: livePoll };
          }
        }
        return msg;
      });

      return hasChanges ? updatedMessages : prev;
    });
  }, [polls]);

  const enrichMessageWithParticipantData = (msg: Message) => {
    if (!participants || participants.length === 0) return msg;
    
    // Find the participant that matches the message sender
    const sender = participants.find(p => String(p.user_id) === String(msg.user_id));
    if (sender && sender.user && sender.user.profile_photo) {
      return {
        ...msg,
        user: {
          ...(msg.user ?? { id: msg.user_id, name: msg.user_name || 'User' }),
          profile_photo: sender.user.profile_photo
        }
      };
    }
    return msg;
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      let messageList: Message[] = [];

      if (spaceId) {
        const space = await collaborationService.fetchSpaceDetails(spaceId);
        if (space.content_state?.messages) {
          messageList = space.content_state.messages.map(enrichMessageWithParticipantData);
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

        let newMessage = data.message || data;
        // For poll messages: extract pollData from metadata into .poll
        if (newMessage.type === 'poll' || (newMessage.metadata?.isPoll && newMessage.metadata?.pollData)) {
          newMessage = { ...newMessage, poll: newMessage.metadata?.pollData ?? newMessage.poll };
        }
        
        // Enrich avatar from participants list
        newMessage = enrichMessageWithParticipantData(newMessage);

        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) {
            return prev;
          }

          const updated = [...prev, newMessage].sort((a: Message, b: Message) =>
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                .catch(err => console.warn('Haptics error:', err));
            } catch (error) {
              console.warn('Haptics not available:', error);
            }
          }
        }
      },

      onContentUpdate: (contentState) => {
        if (contentState.messages) {
          const mappedMessages = contentState.messages.map((m: any) => {
            if (m.type === 'poll' || (m.metadata?.isPoll && m.metadata?.pollData)) {
              return { ...m, poll: m.metadata?.pollData ?? m.poll };
            }
            return m;
          });
          setMessages(mappedMessages.sort((a: Message, b: Message) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ));
        }
      },

      onPollUpdated: (pollData) => {
        console.log('🔄 Inline poll updating via socket:', pollData?.id);
        setMessages(prev => prev.map(msg => {
          const isPollMsg = msg.type === 'poll' || msg.metadata?.isPoll;
          const matchesPoll = msg.poll?.id === pollData?.id || (pollData?.parent_poll_id && msg.poll?.id === pollData?.parent_poll_id);

          if (isPollMsg && matchesPoll) {
            return { ...msg, poll: pollData };
          }
          return msg;
        }));
      },

      // ✅ FIX: Remove deleted polls from chat window in real-time
      onPollDeleted: (deletedPollId) => {
        console.log('🗑️ Poll deleted via socket, removing from chat:', deletedPollId);
        setMessages(prev => prev.filter(msg => {
          const isPollMsg = msg.type === 'poll' || msg.metadata?.isPoll;
          const matchesPollId = msg.poll?.id === deletedPollId || msg.metadata?.pollData?.id === deletedPollId;
          
          return !(isPollMsg && matchesPollId);
        }));
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

  const renderMessage = React.useCallback(({ item, index }: { item: Message; index: number }) => {
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
        onLongPress={() => { }}
        onPollPress={onPollPress}
        spaceId={spaceId}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />
    );
  }, [currentUserId, currentUserRole, messages, selectedMessage, handleMessagePress, onMessageLongPress, onPollPress]);

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

export default React.memo(MessageList);