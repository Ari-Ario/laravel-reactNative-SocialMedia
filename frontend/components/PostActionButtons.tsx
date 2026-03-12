// components/PostActionButtons.tsx
import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import React from 'react';
import AuthContext from '@/context/AuthContext';

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
  compact?: boolean;
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
  compact,
}: PostActionButtonsProps) => {
  const { user } = React.useContext(AuthContext);
  const reactionsToShow = getGroupedReactions(post, Number(user?.id) || undefined);

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
            !post.comments || post.comments.length === 0
              ? '#888'
              : post.comments.some(comment => String(comment.user_id) === String(user?.id))
                ? '#10b981'
                : '#000'
          }
        />
        {post.comments_count > 0 && (
          <Text style={styles.actionCount}>{post.comments_count}</Text>
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
          color={post.is_reposted ? '#10b981' : '#000'}
        />
        {(post.reposts_count ?? 0) > 0 && (
          <Text style={[
            styles.actionCount,
            post.is_reposted && styles.activeActionCount
          ]}>
            {post.reposts_count}
          </Text>
        )}
      </TouchableOpacity>

      {/* Share button */}
      {!compact && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onShare}
        >
          <Feather name="send" size={24} />
        </TouchableOpacity>
      )}

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
                  isMyReaction && styles.reactionItemMine
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
      {!compact && (
        <TouchableOpacity
          style={[styles.actionButton, { marginLeft: 'auto', marginRight: 0 }]}
          onPress={onBookmark}
        >
          <Feather name="bookmark" size={24} />
        </TouchableOpacity>
      )}
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
    backgroundColor: 'rgba(247, 240, 240, 0.7)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionCount: {
    marginLeft: 5,
    fontSize: 12,
    color: '#65676B',
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
    borderColor: '#e8eaed',
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
    color: '#65676B',
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