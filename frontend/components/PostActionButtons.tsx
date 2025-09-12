// components/PostActionButtons.tsx
import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import React from 'react';
import { usePostStore } from '@/stores/postStore';
import AuthContext from '@/context/AuthContext';
import { useDoubleTap } from '@/hooks/useDoubleTap'; // You might want to move this hook to a separate file

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
}: PostActionButtonsProps) => {
  const { user } = React.useContext(AuthContext);
  const reactionsToShow = getGroupedReactions(post, user?.id);

  return (
    <View style={styles.actionBar}>
      {/* Comment button */}
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={onCommentPress}
      >
        <Ionicons 
          name="chatbubble-outline" 
          size={24} 
          color={
            !post.comments || post.comments.length === 0
              ? '#888' // second color when no comments at all
              : post.comments.some(comment => comment.user_id === user?.id)
                ? '#10b981' // green if current user commented
                : '#000'    // black if others commented
          }
        />
        {post.comments_count > 0 && (
          <Text style={styles.actionCount}>{post.comments_count}</Text>
        )}
      </TouchableOpacity>

      {/* Repost button */}
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={onRepost}
      >
        <Feather
          name="repeat"
          size={24}
          color={post.is_reposted ? '#10b981' : '#000'}
        />
        {post.reposts_count > 0 && (
          <Text style={[
            styles.actionCount,
            post.is_reposted && styles.activeActionCount
          ]}>
            {post.reposts_count}
          </Text>
        )}
      </TouchableOpacity>

      {/* Share button */}
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={onShare}
      >
        <Feather name="send" size={24} />
      </TouchableOpacity>
      
      {/* Reaction bar of Post */}
      <View style={styles.reactionScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reactionBar}
        >
          {reactionsToShow.map((reaction, idx) => {
            const isMyReaction = reaction.user_ids?.includes(user?.id);
            
            return (
              <View 
                key={`reaction-${reaction.emoji}-${idx}`}
                style={[
                  styles.reactionItem,
                  isMyReaction && styles.reactionItemMine
                ]}
              >
                {isMyReaction ? (
                  <TouchableOpacity 
                    onPress={onDeleteReaction}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reactionEmoji}>
                      {reaction.emoji}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setCurrentReactingItem({ postId: post.id });
                      setIsEmojiPickerOpen(true);
                    }}
                  >
                    <Text style={styles.reactionEmoji}>
                      {reaction.emoji}
                    </Text>
                  </TouchableOpacity>
                )}
                
                {reaction.count > 0 && (
                  <Text style={[
                    styles.reactionCount,
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
      <TouchableOpacity 
        style={[styles.actionButton, { marginLeft: 'auto', marginRight: 0 }]}
        onPress={onBookmark}
      >
        <Feather name="bookmark" size={24} />
      </TouchableOpacity>
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
});