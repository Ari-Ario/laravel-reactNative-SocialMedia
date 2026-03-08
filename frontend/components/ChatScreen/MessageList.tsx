import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import MessageBubble from './MessageBubble';
import MessageContextMenu from './MessageContextMenu';
import PollComponent from './PollComponent';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { MediaViewer } from '@/components/MediaViewer';
import getApiBaseImage from '@/services/getApiBaseImage';
import AuthContext from '@/context/AuthContext';
import { useContext } from 'react';
import { createShadow } from '@/utils/styles';
import ContactService from '@/services/ChatScreen/ContactService';

interface Message {
  id: string;
  conversation_id?: number;
  user_id: number;
  user_name?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'poll' | 'album' | 'system' | '__divider__';
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
  onReply?: (message: any) => void;
  onPollPress?: (poll: any) => void;
  polls?: any[];
  participants?: any[];
  highlightMessageId?: string;
  /** ISO timestamp of user's last read position in this space */
  lastReadAt?: string | null;
}
const MessageList: React.FC<MessageListProps> = ({
  spaceId,
  conversationId,
  currentUserId,
  currentUserRole,
  onMessageLongPress,
  onReply,
  onPollPress,
  polls = [],
  participants = [],
  highlightMessageId,
  lastReadAt,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [translatingMessageId, setTranslatingMessageId] = useState<string | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  const [activeMediaPost, setActiveMediaPost] = useState<any>(null);
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  // anchor position for the floating context menu
  const [contextAnchorY, setContextAnchorY] = useState(200);
  const [contextAnchorRight, setContextAnchorRight] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});

  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [availableSpaces, setAvailableSpaces] = useState<any[]>([]);
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [selectedSpacesForForward, setSelectedSpacesForForward] = useState<Set<string>>(new Set());
  const [selectedContactsForForward, setSelectedContactsForForward] = useState<Set<string>>(new Set());
  const [pendingMessageToForward, setPendingMessageToForward] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState(false);
  // Poll edit modal state
  const [editPollVisible, setEditPollVisible] = useState(false);
  const [editingPollData, setEditingPollData] = useState<any>(null);

  const { user: currentUser } = useContext(AuthContext);

  const collaborationService = CollaborationService.getInstance();
  const flatListRef = useRef<FlatList>(null);
  // track per-item heights for reliable scroll
  const itemHeights = useRef<Record<string, number>>({});
  // guard: only do the initial scroll once
  const initialScrollDone = useRef(false);

  // ─── Divider: inject before FIRST unread message ──────────────────────────
  // The divider position is determined by lastReadAt, NOT by highlightMessageId.
  // highlightMessageId is only used to visually highlight + scroll to a specific message.
  const listData = React.useMemo(() => {
    if (!lastReadAt || messages.length === 0) return messages;

    const lastReadTime = new Date(lastReadAt).getTime();
    // Find the first message that was created AFTER the last read time
    const firstUnreadIdx = messages.findIndex(
      (m) => new Date(m.created_at).getTime() > lastReadTime
    );

    // No unread messages, or all messages are unread from the start — no divider
    if (firstUnreadIdx <= 0) return messages;

    const divider: Message = {
      id: '__new_messages_divider__',
      type: '__divider__',
      user_id: 0,
      content: '',
      created_at: '',
    };
    return [...messages.slice(0, firstUnreadIdx), divider, ...messages.slice(firstUnreadIdx)];
  }, [messages, lastReadAt]);

  const handleTranslate = React.useCallback(async (msg: any) => {
    if (!msg.content) return;

    // Toggle off if already translated
    if (translatedMessages[msg.id]) {
      setTranslatedMessages(prev => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      return;
    }

    setTranslatingMessageId(msg.id);
    try {
      const langpair = 'autodetect|en'; // Future: Use setting from AuthContext if available
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(msg.content)}&langpair=${langpair}`);
      const data = await response.json();

      if (data && data.responseData && data.responseData.translatedText) {
        setTranslatedMessages(prev => ({ ...prev, [msg.id]: data.responseData.translatedText }));
      } else {
        throw new Error('Invalid translation response');
      }
    } catch (error) {
      console.error('Translation failed:', error);
      Alert.alert('Translation Error', 'Could not translate this message at the moment.');
    } finally {
      setTranslatingMessageId(null);
    }
  }, [translatedMessages]);

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

  // ─── Initial scroll: to divider (if unreads) or bottom (no unreads) ──────
  useEffect(() => {
    if (listData.length === 0 || initialScrollDone.current) return;

    // If there's a notification highlight, skip the initial scroll — the highlight effect handles it
    if (highlightMessageId) {
      initialScrollDone.current = true;
      return;
    }

    const dividerIdx = listData.findIndex(m => m.id === '__new_messages_divider__');
    const hasUnreads = dividerIdx !== -1;

    const doInitialScroll = () => {
      if (hasUnreads) {
        // Scroll to just above the first unread message (the divider)
        try {
          flatListRef.current?.scrollToIndex({
            index: dividerIdx,
            animated: true,
            viewPosition: 0, // Show divider at top of view
          });
        } catch {
          let offset = 0;
          for (let i = 0; i < dividerIdx; i++) {
            offset += itemHeights.current[listData[i].id] ?? 72;
          }
          flatListRef.current?.scrollToOffset({ offset, animated: true });
        }
      } else {
        // No unreads: jump to bottom (newest messages)
        flatListRef.current?.scrollToEnd({ animated: false });
      }
      initialScrollDone.current = true;
    };

    // Give FlatList time to lay out items
    const t = setTimeout(doInitialScroll, 300);
    return () => clearTimeout(t);
  }, [listData.length]);

  // ─── Highlight scroll: when notification navigates to a specific message ──
  useEffect(() => {
    if (!highlightMessageId || listData.length === 0) return;
    const idx = listData.findIndex(m => String(m.id) === String(highlightMessageId));
    if (idx === -1) return;

    const doScroll = () => {
      try {
        flatListRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewPosition: 0.4,
        });
      } catch {
        let offset = 0;
        for (let i = 0; i < idx; i++) {
          offset += itemHeights.current[listData[i].id] ?? 72;
        }
        flatListRef.current?.scrollToOffset({ offset, animated: true });
      }
    };

    // Two attempts: FlatList may not have measured items yet
    const t1 = setTimeout(doScroll, 400);
    const t2 = setTimeout(doScroll, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [highlightMessageId, listData.length]);

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

      onMessageDeleted: (data: any) => {
        console.log('🗑️ Message deleted via socket:', data.id);
        const deletedId = data.id || data.message_id;
        if (deletedId) {
          setMessages(prev => prev.filter(msg => msg.id !== deletedId));
        }
      },

      onMessagePinned: (data: any) => {
        console.log('📌 Message pin state changed via socket:', data);
        const messageId = data.message_id || data.id;
        const isPinned = data.is_pinned;
        if (messageId !== undefined && isPinned !== undefined) {
          setMessages(prev => prev.map(msg =>
            msg.id === messageId
              ? { ...msg, metadata: { ...msg.metadata, is_pinned: isPinned } }
              : msg
          ));
        }
      },

      onMessageReacted: (data: any) => {
        console.log('👍 Message reacted via socket:', data);
        const messageId = data.id || data.message?.id || data.message_id;

        if (messageId) {
          setMessages(prev => prev.map(msg => {
            if (msg.id === messageId) {
              const currentReactions = msg.reactions || [];
              if (data.message?.reactions !== undefined) {
                return { ...msg, reactions: data.message.reactions };
              } else if (data.reaction && data.user) {
                // Check if user already reacted with this emoji to toggle it
                const existingIndex = currentReactions.findIndex((r: any) => r.user_id === data.user.id && r.reaction === data.reaction);
                let newReactions = [...currentReactions];
                if (existingIndex >= 0) {
                  newReactions.splice(existingIndex, 1);
                } else {
                  newReactions.push({
                    user_id: data.user.id,
                    reaction: data.reaction,
                    created_at: new Date().toISOString()
                  });
                }
                return { ...msg, reactions: newReactions };
              }
            }
            return msg;
          }));
        }
      },

      onMessageReplied: (data: any) => {
        console.log('↩️ Message replied via socket:', data);
        let newMessage = data.message || data;
        if (newMessage.type === 'poll') {
          newMessage = { ...newMessage, poll: newMessage.metadata?.pollData ?? newMessage.poll };
        }
        newMessage = enrichMessageWithParticipantData(newMessage);

        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      },
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedMessages(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMessagePress = async (message: Message) => {
    if (selectedMessages.size > 0) {
      toggleSelection(message.id);
      return;
    }
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.warn('Haptics error:', error);
      }
    }
    // Original single message selection logic (if any)
    // setSelectedMessage(selectedMessage === message.id ? null : message.id);
  };

  const handleMediaPress = (message: Message, index: number) => {
    setActiveMediaPost(message);
    setMediaViewerIndex(index);
    setMediaViewerVisible(true);
  };

  const handleMessageLongPress = (message: Message, pageY: number, isRight: boolean) => {
    if (selectedMessages.size > 0) {
      toggleSelection(message.id);
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    }
    setContextMenuMessage(message);
    setContextAnchorY(pageY);
    setContextAnchorRight(isRight);
    setContextMenuVisible(true);
  };

  const handleReply = (message: Message) => {
    if (onReply) {
      onReply(message);
    }
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

  const handleForward = async (message: Message) => {
    // Generic message forward
    try {
      setPendingMessageToForward(message);
      setSelectedMessages(new Set([message.id]));

      const [spacesResponse, followersResponse, followingResponse] = await Promise.all([
        collaborationService.getUserSpaces(currentUserId),
        ContactService.getInstance().fetchFollowers(),
        ContactService.getInstance().fetchFollowing()
      ]);

      const finalSpaces = Array.isArray(spacesResponse) ? spacesResponse : (spacesResponse.spaces || []);
      setAvailableSpaces(finalSpaces.filter((s: any) => String(s.id) !== String(spaceId)));

      // Merge and unique contacts
      const contactsMap = new Map();
      [...(followersResponse || []), ...(followingResponse || [])].forEach(c => {
        const user = c.follower || c.following || c;
        if (user && user.id !== currentUserId) {
          contactsMap.set(String(user.id), user);
        }
      });
      setAvailableContacts(Array.from(contactsMap.values()));

      setSelectedSpacesForForward(new Set());
      setSelectedContactsForForward(new Set());
      setForwardModalVisible(true);
    } catch (e) {
      console.error('Error loading forwarding targets:', e);
      Alert.alert('Error', 'Failed to load targets for forwarding.');
    }
  };

  // ─── Poll Handlers ────────────────────────────────────────────────────────

  const handleClosePoll = async (msg: Message) => {
    const pollId = msg.poll?.id || msg.metadata?.pollId || msg.metadata?.pollData?.id;
    if (!spaceId || !pollId) return;
    const execute = async () => {
      try {
        await collaborationService.closePoll(spaceId, pollId);
        setMessages(prev => prev.map(m => {
          if (m.id === msg.id) {
            return { ...m, poll: { ...(m.poll || {}), status: 'closed' } };
          }
          return m;
        }));
      } catch (e) {
        Alert.alert('Error', 'Failed to close poll');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Close Poll?\n\nNo more votes will be accepted.')) execute();
    } else {
      Alert.alert('Close Poll', 'No more votes will be accepted.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Close', style: 'destructive', onPress: execute },
      ]);
    }
  };

  const handleEditPoll = (msg: Message) => {
    const pollData = msg.poll || msg.metadata?.pollData;
    if (!pollData) return;
    setEditingPollData(pollData);
    setEditPollVisible(true);
  };

  const handleForwardPoll = async (msg: Message) => {
    const pollId = msg.poll?.id || msg.metadata?.pollId || msg.metadata?.pollData?.id;
    if (!pollId) return;
    try {
      setPendingMessageToForward(msg);
      setSelectedMessages(new Set([msg.id]));

      const [spacesResponse, followersResponse, followingResponse] = await Promise.all([
        collaborationService.getUserSpaces(currentUserId),
        ContactService.getInstance().fetchFollowers(),
        ContactService.getInstance().fetchFollowing()
      ]);

      const finalSpaces = Array.isArray(spacesResponse) ? spacesResponse : (spacesResponse.spaces || []);
      setAvailableSpaces(finalSpaces.filter((s: any) => String(s.id) !== String(spaceId)));

      // Merge and unique contacts
      const contactsMap = new Map();
      [...(followersResponse || []), ...(followingResponse || [])].forEach(c => {
        const user = c.follower || c.following || c;
        if (user && user.id !== currentUserId) {
          contactsMap.set(String(user.id), user);
        }
      });
      setAvailableContacts(Array.from(contactsMap.values()));

      setSelectedSpacesForForward(new Set());
      setSelectedContactsForForward(new Set());
      setForwardModalVisible(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to load targets for forwarding.');
    }
  };

  const handleSharePollResults = async (msg: Message) => {
    if (!spaceId) return;
    const poll = msg.poll || msg.metadata?.pollData;
    if (!poll) return;

    // Calculate results summary
    const total = poll.total_votes || 0;
    const optionsSummary = (poll.options || []).map((opt: any) => {
      const voteCount = opt.votes?.length || opt.votes || 0;
      const percentage = total > 0 ? Math.round((voteCount / total) * 100) : 0;
      return `• ${opt.text}: ${voteCount} votes (${percentage}%)`;
    }).join('\n');

    const resultsMessage = `📊 *Poll Results: ${poll.question}*\n\n${optionsSummary}\n\nTotal votes: ${total}`;

    try {
      await collaborationService.sendMessage(spaceId, {
        content: resultsMessage,
        type: 'text',
        metadata: {
          isPollResults: true,
          pollId: poll.id,
        },
      });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      }
      Alert.alert('Success', 'Results shared to chat.');
    } catch (e) {
      console.error('Error sharing poll results:', e);
      Alert.alert('Error', 'Failed to share poll results.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

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
    // ── Divider row ──────────────────────────────────────────
    if (item.type === '__divider__') {
      return (
        <View style={styles.newMessagesDivider}>
          <View style={styles.newMessagesDividerLine} />
          <Text style={styles.newMessagesDividerText}>New Messages</Text>
          <View style={styles.newMessagesDividerLine} />
        </View>
      );
    }
    
    // ── System Message row (WhatsApp style) ──────────────────
    if (item.type === 'system') {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBadge}>
            <Text style={styles.systemMessageText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    // ── Normal message ───────────────────────────────────────
    const isCurrentUser = item.user_id === currentUserId;
    // Adjust index to account for the injected divider
    const prevItem = listData[index - 1];
    const showAvatar =
      index === 0 ||
      !prevItem ||
      prevItem.type === '__divider__' ||
      prevItem.user_id !== item.user_id ||
      new Date(item.created_at).getTime() - new Date(prevItem.created_at).getTime() > 5 * 60 * 1000;

    const repliedToMessage = item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : undefined;

    return (
      <View
        onLayout={(e) => { itemHeights.current[item.id] = e.nativeEvent.layout.height; }}
      >
        <MessageBubble
          message={item}
          repliedToMessage={repliedToMessage}
          translatedContent={translatedMessages[item.id]}
          isCurrentUser={isCurrentUser}
          showAvatar={showAvatar}
          isSelected={selectedMessages.has(item.id)}
          onPress={() => handleMessagePress(item)}
          onMediaPress={(idx) => handleMediaPress(item, idx)}
          onLongPress={() => handleMessageLongPress(item, 300, isCurrentUser)}
          onLongPressWithPosition={(msg, _x, pageY) => handleMessageLongPress(item, pageY, isCurrentUser)}
          onPollPress={onPollPress}
          onToggleTranslation={() => handleTranslate(item)}
          highlighted={String(item.id) === String(highlightMessageId)}
          spaceId={spaceId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      </View>
    );
  }, [currentUserId, currentUserRole, listData, messages, translatedMessages, selectedMessages, handleMessagePress, onMessageLongPress, onPollPress, handleTranslate, spaceId, highlightMessageId]);

  const handleDeleteSelected = async () => {
    if (!spaceId || selectedMessages.size === 0) return;
    Alert.alert(
      'Delete Messages',
      `Are you sure you want to delete ${selectedMessages.size} messages?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const idsToDelete = Array.from(selectedMessages);
            // Optimistic update
            const oldMessages = [...messages];
            setMessages(prev => prev.filter(m => !selectedMessages.has(m.id)));
            setSelectedMessages(new Set());

            try {
              for (const id of idsToDelete) {
                await collaborationService.deleteSpaceMessage(spaceId, id).catch(e => console.error('Delete failed for', id, e));
              }
            } catch (e) {
              setMessages(oldMessages);
              Alert.alert('Error', 'Failed to delete some messages');
            }
          }
        }
      ]
    );
  };

  const handleForwardSelected = async () => {
    if (selectedMessages.size === 0) return;
    try {
      const [spacesResponse, followersResponse, followingResponse] = await Promise.all([
        collaborationService.getUserSpaces(currentUserId),
        ContactService.getInstance().fetchFollowers(),
        ContactService.getInstance().fetchFollowing()
      ]);

      const finalSpaces = Array.isArray(spacesResponse) ? spacesResponse : (spacesResponse.spaces || []);
      setAvailableSpaces(finalSpaces.filter((s: any) => String(s.id) !== String(spaceId)));

      // Merge and unique contacts
      const contactsMap = new Map();
      [...(followersResponse || []), ...(followingResponse || [])].forEach(c => {
        const user = c.follower || c.following || c;
        if (user && user.id !== currentUserId) {
          contactsMap.set(String(user.id), user);
        }
      });
      setAvailableContacts(Array.from(contactsMap.values()));

      setSelectedSpacesForForward(new Set());
      setSelectedContactsForForward(new Set());
      setForwardModalVisible(true);
    } catch (e) {
      console.error('Error fetching targets to forward to:', e);
      Alert.alert('Error', 'Failed to load targets.');
    }
  };

  const executeMultiForward = async () => {
    if ((selectedMessages.size === 0 && !pendingMessageToForward) ||
      (selectedSpacesForForward.size === 0 && selectedContactsForForward.size === 0)) return;

    setForwarding(true);
    try {
      const idsToForward = selectedMessages.size > 0 ? Array.from(selectedMessages) : [pendingMessageToForward!.id];
      const destinationSpaceIds = Array.from(selectedSpacesForForward);
      const destinationContactIds = Array.from(selectedContactsForForward);

      // Handle Space Forwarding
      if (destinationSpaceIds.length > 0) {
        if (idsToForward.length === 1) {
          const msg = pendingMessageToForward || messages.find(m => m.id === idsToForward[0]);
          const isPoll = msg?.type === 'poll' || msg?.metadata?.isPoll;
          const pollId = msg?.poll?.id || msg?.metadata?.pollId;

          if (isPoll && pollId) {
            await collaborationService.forwardPoll(pollId, destinationSpaceIds);
            for (const destId of destinationSpaceIds) {
              await collaborationService.sendMessage(destId, {
                content: `📊 Poll forwarded: "${msg?.poll?.question || msg?.content}"`,
                type: 'poll',
                metadata: {
                  isPoll: true,
                  pollId: pollId,
                  pollData: msg?.poll,
                  is_forwarded: true,
                  original_space_id: spaceId
                }
              });
            }
          } else {
            for (const destId of destinationSpaceIds) {
              await collaborationService.forwardSpaceMessages(spaceId || '0', idsToForward, destId);
            }
          }
        } else {
          for (const destId of destinationSpaceIds) {
            await collaborationService.forwardSpaceMessages(spaceId || '0', idsToForward, destId);
          }
        }
      }

      // Handle Contact Forwarding
      if (destinationContactIds.length > 0) {
        for (const contactId of destinationContactIds) {
          for (const msgId of idsToForward) {
            const msg = messages.find(m => m.id === msgId);
            if (!msg) continue;

            // Note: This requires a search/create conversation logic on backend if we don't have conversionId
            // A safer approach for now is to use the contact's ID as a target if the API supports it, 
            // but usually we need a conversation. 
            // Assuming sendMessage handles participant finding if conversation_id is missing, or we need another method.
            // For now, let's try to send a message to a direct chat if possible.

            await collaborationService.sendMessageToUser(Number(contactId), {
              content: msg.content,
              type: msg.type,
              metadata: {
                ...msg.metadata,
                is_forwarded: true,
                original_space_id: spaceId
              },
              file_path: msg.file_path,
              mime_type: msg.mime_type
            });
          }
        }
      }

      Alert.alert('Success', `Forwarded to ${destinationSpaceIds.length + destinationContactIds.length} destination(s).`);
      setForwardModalVisible(false);
      setSelectedMessages(new Set());
      setSelectedSpacesForForward(new Set());
      setSelectedContactsForForward(new Set());
      setPendingMessageToForward(null);
    } catch (e) {
      console.error('Forward failed', e);
      Alert.alert('Error', 'Failed to forward messages to some destinations.');
    } finally {
      setForwarding(false);
    }
  };

  return (
    <View style={styles.container}>
      {selectedMessages.size > 0 && (
        <View style={styles.selectionHeader}>
          <TouchableOpacity onPress={() => setSelectedMessages(new Set())} style={styles.selectionClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.selectionCount}>{selectedMessages.size} Selected</Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={handleForwardSelected} style={styles.selectionActionBtn}>
              <Ionicons name="arrow-redo-outline" size={22} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteSelected} style={styles.selectionActionBtn}>
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={listData}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          // Load more messages
        }}
        onEndReachedThreshold={0.5}
        onScrollToIndexFailed={(info) => {
          // Fallback when item height is unknown
          let offset = 0;
          for (let i = 0; i < info.index; i++) {
            offset += itemHeights.current[listData[i]?.id] ?? 72;
          }
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset, animated: true });
          }, 100);
        }}
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

      {/* ── Context Menu ──────────────────────────────────── */}
      <MessageContextMenu
        visible={contextMenuVisible}
        message={contextMenuMessage as any}
        isCurrentUser={(contextMenuMessage?.user_id ?? 0) === currentUserId}
        currentUserRole={currentUserRole}
        anchorY={contextAnchorY}
        anchorRight={contextAnchorRight}
        onClose={() => {
          setContextMenuVisible(false);
          setTimeout(() => setContextMenuMessage(null), 200);
        }}
        onReply={(msg) => handleReply(msg as any)}
        onForward={(msg) => handleForward(msg as any)}
        onCopy={(msg) => handleCopy(msg as any)}
        // ── Poll callbacks ──────────────────────────────────────────────────
        onClosePoll={(msg) => handleClosePoll(msg as any)}
        onEditPoll={(msg) => handleEditPoll(msg as any)}
        onForwardPoll={(msg) => handleForwardPoll(msg as any)}
        onSharePollResults={(msg) => handleSharePollResults(msg as any)}
        onReact={(msg, emoji) => {
          if (spaceId) {
            // Optimistic update
            const oldMessages = [...messages];
            setMessages(prev => prev.map(m => {
              if (m.id === msg.id) {
                const reactions = m.reactions || [];
                // Simple toggle logic for optimistic update
                const existing = reactions.find(r => r.reaction === emoji && r.user_id === currentUserId);
                let newReactions;
                if (existing) {
                  newReactions = reactions.filter(r => r.id !== existing.id);
                } else {
                  newReactions = [...reactions, { reaction: emoji, user_id: currentUserId, created_at: new Date().toISOString() }];
                }
                return { ...m, reactions: newReactions };
              }
              return m;
            }));

            collaborationService.reactToSpaceMessage(spaceId, msg.id, emoji).catch(e => {
              console.warn('Failed to react:', e);
              setMessages(oldMessages); // rollback
            });
          }
        }}
        onTranslate={handleTranslate}
        onDeleteForAll={async (msg) => {
          if (spaceId) {
            const isPoll = msg.type === 'poll' || msg.metadata?.isPoll;
            const pollId = msg.poll?.id || msg.metadata?.pollId;
            const oldMessages = [...messages];

            // Optimistic update
            setMessages(prev => prev.filter(m => m.id !== msg.id));

            try {
              if (isPoll && pollId) {
                // Use poll-specific deletion which cleans up global copies and messages
                await collaborationService.deletePoll(spaceId, pollId);
              } else {
                await collaborationService.deleteSpaceMessage(spaceId, msg.id);
              }
            } catch (e) {
              console.warn('Failed to delete message for all:', e);
              setMessages(oldMessages); // rollback
              Alert.alert('Error', 'Failed to delete message');
            }
          }
        }}
        onDeleteForMe={async (msg) => {
          if (spaceId) {
            const oldMessages = [...messages];
            setMessages(prev => prev.filter(m => m.id !== msg.id));
            try {
              await collaborationService.hideSpaceMessage(spaceId, msg.id);
            } catch (e) {
              console.warn('Failed to hide message for me:', e);
              setMessages(oldMessages); // rollback
            }
          }
        }}
        onPin={async (msg) => {
          if (spaceId) {
            const oldMessages = [...messages];
            const currentlyPinned = msg.metadata?.is_pinned || false;
            setMessages(prev => prev.map(m =>
              m.id === msg.id ? { ...m, metadata: { ...m.metadata, is_pinned: !currentlyPinned } } : m
            ));

            try {
              await collaborationService.pinSpaceMessage(spaceId, msg.id);
            } catch (e) {
              console.warn('Failed to pin message:', e);
              setMessages(oldMessages); // rollback
            }
          }
        }}
        onSelect={(msg) => setSelectedMessages(new Set([msg.id]))}
      />

      {activeMediaPost && (
        <MediaViewer
          visible={mediaViewerVisible}
          mediaItems={activeMediaPost.type === 'album'
            ? activeMediaPost.metadata?.media_items?.map((item: any, idx: number) => ({
              ...item,
              id: item.id || `${activeMediaPost.id}_${idx}`
            }))
            : (activeMediaPost.media || [{
              id: activeMediaPost.id,
              type: activeMediaPost.type,
              file_path: activeMediaPost.file_path,
              metadata: activeMediaPost.metadata
            }])
          }
          startIndex={mediaViewerIndex}
          onClose={() => setMediaViewerVisible(false)}
          post={null}
          getApiBaseImage={getApiBaseImage}
          onReact={(emoji) => handleReact(activeMediaPost, emoji)}
          onDeleteReaction={() => { }} // Implement if needed
          onRepost={() => { }}
          onShare={() => { }}
          onBookmark={() => { }}
          onCommentPress={() => { }} // Implement if needed
          onDoubleTap={() => { }}
          currentReactingItem={null}
          setCurrentReactingItem={() => { }}
          setIsEmojiPickerOpen={() => { }}
          onCommentSubmit={async () => { }}
          handleReactComment={() => { }}
          deleteCommentReaction={() => { }}
          onNavigateNext={() => { }}
          onNavigatePrev={() => { }}
          getGroupedReactions={collaborationService.getGroupedReactions}
        />
      )}

      {/* ── Forward Modal ──────────────────────────────────── */}
      <Modal visible={forwardModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Forward to...</Text>
              <TouchableOpacity onPress={() => {
                setForwardModalVisible(false);
                setPendingMessageToForward(null);
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {forwarding ? (
              <View style={styles.forwardingState}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={{ marginTop: 12, color: '#666' }}>Forwarding...</Text>
              </View>
            ) : (
              <>
                <FlatList
                  data={[
                    ...(availableSpaces.length > 0 ? [{ type: 'header', title: 'Spaces' }, ...availableSpaces.map(s => ({ ...s, targetType: 'space' }))] : []),
                    ...(availableContacts.length > 0 ? [{ type: 'header', title: 'Contacts' }, ...availableContacts.map(c => ({ ...c, targetType: 'contact' }))] : [])
                  ]}
                  keyExtractor={(item, index) => item.type === 'header' ? `header-${item.title}` : `target-${item.id}-${index}`}
                  renderItem={({ item }) => {
                    if (item.type === 'header') {
                      return <Text style={styles.modalSectionHeader}>{item.title}</Text>;
                    }

                    const isSelected = item.targetType === 'space'
                      ? selectedSpacesForForward.has(item.id)
                      : selectedContactsForForward.has(item.id);

                    return (
                      <TouchableOpacity
                        style={[styles.spaceItem, isSelected && styles.spaceItemSelected]}
                        onPress={() => {
                          if (item.targetType === 'space') {
                            setSelectedSpacesForForward(prev => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          } else {
                            setSelectedContactsForForward(prev => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }
                        }}
                      >
                        <View style={styles.spaceAvatarPlaceholder}>
                          {item.profile_photo ? (
                            <Image
                              source={{ uri: `${getApiBaseImage()}/storage/${item.profile_photo}` }}
                              style={styles.targetAvatar}
                            />
                          ) : (
                            <Text style={styles.spaceAvatarText}>{(item.name || item.title || '?').charAt(0)}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.spaceNameText}>{item.name || item.title}</Text>
                          <Text style={styles.targetTypeText}>{item.targetType === 'space' ? 'Space' : 'Contact'}</Text>
                        </View>
                        <Ionicons
                          name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                          size={24}
                          color={isSelected ? "#007AFF" : "#ccc"}
                        />
                      </TouchableOpacity>
                    );
                  }}
                  contentContainerStyle={{ paddingBottom: 20 }}
                />

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[
                      styles.modalSendBtn,
                      (selectedSpacesForForward.size === 0 && selectedContactsForForward.size === 0) && styles.modalSendBtnDisabled
                    ]}
                    disabled={selectedSpacesForForward.size === 0 && selectedContactsForForward.size === 0}
                    onPress={executeMultiForward}
                  >
                    <Text style={styles.modalSendBtnText}>
                      Forward to {selectedSpacesForForward.size + selectedContactsForForward.size} item(s)
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  selectionClose: {
    padding: 4,
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginLeft: 16,
  },
  selectionActions: {
    flexDirection: 'row',
  },
  selectionActionBtn: {
    padding: 8,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  forwardingState: {
    padding: 32,
    alignItems: 'center',
  },
  noSpacesText: {
    textAlign: 'center',
    padding: 24,
    color: '#666',
  },
  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  spaceAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  spaceAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  spaceNameText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  spaceItemSelected: {
    backgroundColor: '#F2F2F7',
    borderColor: '#007AFF',
  },
  modalSendBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    marginTop: 16,
    ...createShadow({ width: 0, height: 4, opacity: 0.2, radius: 8, elevation: 4 }),
  },
  modalSendBtnDisabled: {
    backgroundColor: '#C6C6C8',
  },
  modalSendBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // ✅ WhatsApp/Telegram-style "New Messages" divider
  newMessagesDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    marginHorizontal: 16,
  },
  newMessagesDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#25A244',
    opacity: 0.5,
  },
  newMessagesDividerText: {
    marginHorizontal: 10,
    color: '#25A244',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  modalSectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  targetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  targetTypeText: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  
  // WhatsApp-style system message
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 20,
  },
  systemMessageBadge: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  systemMessageText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default React.memo(MessageList);