// components/PostActionButtons.tsx
import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import React from 'react';
import AuthContext from '@/context/AuthContext';
import { useReportedContentStore } from '@/stores/reportedContentStore';
import { deleteReportByTarget } from '@/services/ReportService';
import { useAppTheme } from '@/hooks/useAppTheme';

interface PostActionButtonsProps {
  post: {
    id: number;
    comments_count: number;
    comments: Array<{ user_id: string | number }>;
    reposts_count?: number;
    is_reposted?: boolean;
    reactions: any;
    reaction_counts: Array<{ emoji: string; count: number }>;
  };
  onReact: (emoji: string) => void;
  onDeleteReaction: () => void;
  onRepost: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onCommentPress: () => void;
  currentReactingItem: {
    postId: number;
    commentId?: number;
  } | null;
  setCurrentReactingItem: (item: { postId: number; commentId?: number } | null) => void;
  setIsEmojiPickerOpen: (open: boolean) => void;
  getGroupedReactions: (post: any, userId?: number) => Array<{
    emoji: string;
    count: number;
    user_ids: number[];
  }>;
  isBookmarked?: boolean;
  compact?: boolean;
  isDark?: boolean;
}

export const PostActionButtons = ({
  post,
  onReact,
  onDeleteReaction,
  onRepost,
  onShare,
  onBookmark,
  onCommentPress,
  currentReactingItem,
  setCurrentReactingItem,
  setIsEmojiPickerOpen,
  getGroupedReactions,
  isBookmarked,
  compact,
  isDark,
}: PostActionButtonsProps) => {
  const { colors } = useAppTheme();
  const { user } = React.useContext(AuthContext);
  const reactionsToShow = getGroupedReactions(post, Number(user?.id) || undefined);

  // Unified color logic based on isDark prop
  const activeColor = '#10b981';
  const primaryColor = isDark ? '#fff' : colors.text;
  const secondaryColor = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const reactionBorder = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';

  return (
    <View style={[styles.actionBar, compact && styles.compactActionBar]}>
      {/* Comment button */}
      <TouchableOpacity
        style={[styles.actionButton, compact && styles.compactActionButton]}
        onPress={onCommentPress}
      >
        <Ionicons
          name="chatbubble-outline"
          size={compact ? 20 : 24}
          color={
            post.comments?.some(comment => String(comment.user_id) === String(user?.id))
              ? activeColor
              : primaryColor
          }
        />
        {post.comments_count > 0 && (
          <Text style={[styles.actionCount, { color: secondaryColor }]}>{post.comments_count}</Text>
        )}
      </TouchableOpacity>

      {/* Repost button */}
      <TouchableOpacity
        style={[styles.actionButton, compact && styles.compactActionButton]}
        onPress={onRepost}
      >
        <Feather
          name="repeat"
          size={compact ? 20 : 24}
          color={post.is_reposted ? activeColor : primaryColor}
          strokeWidth={2}
        />
        {(post.reposts_count ?? 0) > 0 && (
          <Text style={[
            styles.actionCount,
            { color: secondaryColor },
            post.is_reposted && styles.activeActionCount
          ]}>
            {post.reposts_count}
          </Text>
        )}
      </TouchableOpacity>

      {/* Share button */}
      <TouchableOpacity
        style={[styles.actionButton, compact && styles.compactActionButton]}
        onPress={onShare}
      >
        <Feather 
          name="send" 
          size={24} 
          color={primaryColor}
          strokeWidth={2}
        />
      </TouchableOpacity>

      {/* Reaction bar Component */}
      <View style={styles.reactionScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.reactionBar, compact && styles.compactReactionBar]}
        >
          {reactionsToShow.map((reaction, idx) => {
            const isMyReaction = reaction.user_ids?.includes(Number(user?.id) || 0);

            return (
              <View
                key={`reaction-${reaction.emoji}-${idx}`}
                style={[
                  styles.reactionItem,
                  compact && styles.compactReactionItem,
                  isMyReaction ? styles.reactionItemMine : { borderColor: reactionBorder },
                  isDark && !isMyReaction && { backgroundColor: 'rgba(255,255,255,0.1)' }
                ]}
              >
                <TouchableOpacity
                  onPress={() => isMyReaction ? onDeleteReaction() : (setCurrentReactingItem({ postId: post.id }), setIsEmojiPickerOpen(true))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.reactionEmoji, compact && styles.compactReactionEmoji]}>
                    {reaction.emoji}
                  </Text>
                </TouchableOpacity>

                {reaction.count > 0 && (
                  <Text style={[
                    styles.reactionCount,
                    { color: secondaryColor },
                    compact && styles.compactReactionCount,
                    isMyReaction && styles.reactionCountMine
                  ]}>
                    {reaction.count}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Bookmark button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 12 }}>
          {useReportedContentStore.getState().isReported('post', post.id) && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  const { removeReportedItem } = useReportedContentStore.getState();
                  await deleteReportByTarget('post', post.id);
                  removeReportedItem('post', post.id);
                  // @ts-ignore
                  useToastStore.getState().showToast('Report removed successfully', 'success');
                } catch (error) {
                  console.error('Failed to delete report:', error);
                  // @ts-ignore
                  useToastStore.getState().showToast('Failed to remove report', 'error');
                }
              }}
            >
              <Ionicons
                name="flag"
                size={22}
                color="#ff4444"
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, { marginRight: 0 }]}
            onPress={onBookmark}
          >
            <Ionicons 
              name={isBookmarked ? "bookmark" : "bookmark-outline"} 
              size={24} 
              color={isBookmarked ? activeColor : primaryColor} 
            />
          </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionCount: {
    marginLeft: 5,
    fontSize: 12,
  },
  darkActionCount: {
    color: '#fff',
    fontWeight: '700',
  },
  reactionScrollContainer: {
    flex: 1,
    marginHorizontal: 5,
    overflow: 'hidden',
  },
  reactionBar: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  reactionItemMine: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  reactionCountMine: {
    color: '#10b981',
    fontWeight: '600',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
  },
  activeActionCount: {
    color: '#10b981',
  },
  compactActionBar: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  compactActionButton: {
    marginRight: 12,
  },
  compactReactionBar: {
    gap: 4,
  },
  compactReactionItem: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
  },
  compactReactionEmoji: {
    fontSize: 12,
  },
  compactReactionCount: {
    fontSize: 10,
    marginLeft: 2,
  },
});