import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthContext from '@/context/AuthContext';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import MessageBubble from '@/components/ChatScreen/MessageBubble';
import { createShadow } from '@/utils/styles';
import GlobalStyles from '@/styles/GlobalStyles';

const { width } = Dimensions.get('window');

const ChatHighlightsScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);
  const collaborationService = CollaborationService.getInstance();

  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchHighlights = useCallback(async (pageNum: number, isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const data = await collaborationService.fetchChatHighlights(pageNum, 10);
      
      if (isInitial) {
        setMessages(data.messages);
      } else {
        setMessages(prev => [...prev, ...data.messages]);
      }
      
      setHasMore(data.has_more);
      setTotal(data.total);
      setPage(pageNum);
      setError(null);
    } catch (error: any) {
      console.error('Failed to fetch highlights:', error);
      setError('Failed to load highlights. Please try again.');
      setHasMore(false); // Stop infinite loading on error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchHighlights(1, true);
  }, [fetchHighlights]);

  const loadMore = () => {
    if (!loadingMore && hasMore && !error) {
      const nextPage = page + 1;
      fetchHighlights(nextPage);
    }
  };

  const handleJumpToSpace = (message: any) => {
    const targetId = message.space_id || message.conversation_id;
    if (!targetId) return;

    router.push({
      pathname: '/(spaces)/[id]',
      params: { 
        id: targetId,
        highlightMessageId: message.id
      }
    });
  };

  const renderEngagementBadge = (message: any) => {
    const score = (message.replies_count || 0) + (message.reactions_count || 0);
    let label = "Trending";
    let icon = "flash";
    let color = "#FFD700";

    if (message.replies_count > message.reactions_count) {
      label = "Active Discussion";
      icon = "chatbubbles";
      color = "#0084ff";
    } else if (message.reactions_count > 5) {
      label = "Most Loved";
      icon = "heart";
      color = "#FF3B30";
    }

    return (
      <View style={[styles.engagementBadge, { borderColor: color + '40' }]}>
        <Ionicons name={icon as any} size={12} color={color} />
        <Text style={[styles.engagementLabel, { color }]}>{label}</Text>
        <View style={styles.statDot} />
        <Text style={styles.statText}>{message.reactions_count || 0} reactions</Text>
        <View style={styles.statDot} />
        <Text style={styles.statText}>{message.replies_count || 0} replies</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const isCurrentUser = item.user_id === user?.id;

    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
        style={styles.highlightWrapper}
      >
        <View style={styles.badgeContainer}>
          {renderEngagementBadge(item)}
        </View>

        <View style={styles.messageBubbleWrapper}>
          <MessageBubble
            message={item}
            isCurrentUser={isCurrentUser}
            showAvatar={true}
            isSelected={false}
            onPress={() => {}}
            onLongPress={() => {}}
            spaceId={item.space_id}
            currentUserId={user?.id}
          />
        </View>

        <TouchableOpacity 
          style={styles.jumpButton} 
          onPress={() => handleJumpToSpace(item)}
        >
          <LinearGradient
            colors={['#1063FD15', '#1063FD05']}
            style={styles.jumpGradient}
          >
            <Text style={styles.jumpText}>Jump to Conversation</Text>
            <Ionicons name="arrow-forward" size={14} color="#1063FD" />
          </LinearGradient>
        </TouchableOpacity>
      </MotiView>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 40 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color="#1063FD" />
      </View>
    );
  };

  return (
    <View style={[styles.container, GlobalStyles.popupContainer]}>
      <StatusBar barStyle="dark-content" />
      
      <LinearGradient
        colors={['#fff', '#f8f9fa']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Chat Highlights</Text>
          <View style={styles.headerUnderline} />
        </View>

        <View style={{ width: 44 }} />
      </LinearGradient>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1063FD" />
          <Text style={styles.loadingText}>Fetching trending moments...</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="flash-outline" size={48} color="rgba(0,0,0,0.1)" />
              </View>
              <Text style={styles.emptyTitle}>No highlights yet</Text>
              <Text style={styles.emptySubtitle}>
                Keep chatting and reacting to messages. Trending moments will automatically appear here!
              </Text>
            </View>
          }
          ListHeaderComponent={
            <View style={styles.infoBanner}>
              <View style={styles.infoIcon}>
                <Ionicons name="flash" size={20} color="#FFD700" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Automated Highlights</Text>
                <Text style={styles.infoText}>
                  Your most engaging conversations across all spaces are automatically ranked here.
                </Text>
              </View>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  headerUnderline: {
    width: 30,
    height: 3,
    backgroundColor: '#FFD700',
    borderRadius: 2,
    marginTop: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  highlightWrapper: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginBottom: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    ...createShadow({ opacity: 0.1, radius: 10 }),
  },
  badgeContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  engagementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
  },
  engagementLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginHorizontal: 8,
  },
  statText: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.4)',
    fontWeight: '600',
  },
  messageBubbleWrapper: {
    width: '100%',
    paddingVertical: 8,
  },
  jumpButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  jumpGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  jumpText: {
    color: '#1063FD',
    fontWeight: '700',
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: 'rgba(0,0,0,0.5)',
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: 'rgba(0,0,0,0.4)', textAlign: 'center', lineHeight: 20 },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    alignItems: 'center',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    ...createShadow({ opacity: 0.1, radius: 5 }),
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.6)',
    lineHeight: 16,
  },
});

export default ChatHighlightsScreen;