import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useTranslation } from '@/constants/i18n';
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
import { BackButton } from '@/components/ui/IconButton';
import AuthContext from '@/context/AuthContext';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import MessageBubble from '@/components/ChatScreen/MessageBubble';
import { createShadow } from '@/utils/styles';
import GlobalStyles from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';

const { width } = Dimensions.get('window');

const ChatHighlightsScreen = () => {
  const { t } = useTranslation();
  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, activeScheme);
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
      setError(t('failed_update'));
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
    let label = t('social');
    let icon = "flash";
    let color = "#FFD700";

    if (message.replies_count > message.reactions_count) {
      label = t('social');
      icon = "chatbubbles";
      color = "#0084ff";
    } else if (message.reactions_count > 5) {
      label = t('social');
      icon = "heart";
      color = "#FF3B30";
    }

    return (
      <View style={[styles.engagementBadge, { borderColor: color + '40' }]}>
        <Ionicons name={icon as any} size={12} color={color} />
        <Text style={[styles.engagementLabel, { color }]}>{label}</Text>
        <View style={styles.statDot} />
        <Text style={styles.statText}>{message.reactions_count || 0} {t('privacy')}</Text>
        <View style={styles.statDot} />
        <Text style={styles.statText}>{message.replies_count || 0} {t('privacy')}</Text>
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
            colors={[colors.tint + '15', colors.tint + '05']}
            style={styles.jumpGradient}
          >
            <Text style={styles.jumpText}>{t('social')}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.tint} />
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
        colors={[colors.surface, colors.background]}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <BackButton onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)"); }} />

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('social')}</Text>
          <View style={styles.headerUnderline} />
        </View>

        <View style={{ width: 44 }} />
      </LinearGradient>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1063FD" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
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
                <Ionicons name="flash-outline" size={48} color={colors.textSecondary + '40'} />
              </View>
              <Text style={styles.emptyTitle}>{t('failed_update')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('social')}
              </Text>
            </View>
          }
          ListHeaderComponent={
            <View style={styles.infoBanner}>
              <View style={styles.infoIcon}>
                <Ionicons name="flash" size={20} color="#FFD700" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>{t('social')}</Text>
                <Text style={styles.infoText}>
                  {t('social')}
                </Text>
              </View>
            </View>
          }
        />
      )}
    </View>
  );
};

function getStyles(colors: any, activeScheme: string) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerUnderline: {
    width: 30,
    height: 3,
    backgroundColor: colors.tint,
    borderRadius: 2,
    marginTop: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  highlightWrapper: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    marginBottom: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.background,
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
    backgroundColor: colors.textSecondary + '40',
    marginHorizontal: 8,
  },
  statText: {
    fontSize: 11,
    color: colors.textSecondary,
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
    color: colors.tint,
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
    color: colors.textSecondary,
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
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: activeScheme === 'dark' ? 'rgba(255, 215, 0, 0.05)' : 'rgba(255, 215, 0, 0.08)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
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
    color: colors.text,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});

}

export default ChatHighlightsScreen;
