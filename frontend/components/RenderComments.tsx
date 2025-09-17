// components/RenderComments.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import getApiBaseImage from '@/services/getApiBaseImage';
import { usePostStore } from '@/stores/postStore';

interface RenderCommentsProps {
  user: any;
  service: any;
  postId: number;
  // comments: any[];
  onProfilePress: (userId: string) => void;
  onReply: (comment: any) => void;
  onReactComment: (commentId: number) => void;
  onDeleteCommentReaction: (commentId: number, emoji: string) => void;
  onDeleteComment: (commentId: number) => void;
}

const RenderComments = ({
  user,
  service,
  postId,
  // comments,
  onProfilePress,
  onReply,
  onReactComment,
  onDeleteCommentReaction,
  onDeleteComment
}: RenderCommentsProps) => {
  // Get the latest comments from Zustand store
  const { posts } = usePostStore();
  const currentPost = posts.find(p => p.id === postId);
  const comments = currentPost?.comments || [];

  const getGroupedReactionsComments = (comment: any) => {
    const defaultEmojis = ['🤍'];
    
    if (!comment?.reaction_comments || comment?.reaction_comments.length === 0) {
      return defaultEmojis.map(emoji => ({ 
        emoji, 
        count: 0,
        user_ids: []
      }));
    }

    const reactionMap = new Map<string, { count: number, user_ids: number[] }>();

    for (const reaction of comment.reaction_comments) {
      const existing = reactionMap.get(reaction.emoji) || { count: 0, user_ids: [] };
      reactionMap.set(reaction.emoji, {
        count: existing.count + 1,
        user_ids: [...existing.user_ids, reaction.user_id]
      });
    }

    return [...reactionMap.entries()]
      .map(([emoji, { count, user_ids }]) => ({ 
        emoji, 
        count,
        user_ids 
      }))
      .sort((a, b) => b.count - a.count);
  };

  const renderComment = ({ item }: { item: any }) => {
    const groupedReactions = getGroupedReactionsComments(item);
    const isMyComment = item.user_id === user?.id;

    return (
      <View style={styles.commentContainer}>
        {/* Comment header */}
        <View style={styles.commentHeader}>
          <TouchableOpacity onPress={() => onProfilePress(item.user.id)}>
            <Image
              source={{ uri: `${getApiBaseImage()}/storage/${item.user.profile_photo}` || 'https://via.placeholder.com/32' }}
              style={styles.commentAvatar}
            />
            <Text style={styles.commentUsername}>{item.user.name}</Text>
          </TouchableOpacity>
          <Text style={styles.commentContent}>{item.content}</Text>
        </View>
        
        <View style={styles.commentButtons}>
          {/* Reply button */}
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => onReply(item)}
          >
            <Text style={styles.replyButtonText}>Reply</Text>
          </TouchableOpacity>
          
          {/* Comment reactions */}
          <View style={styles.commentReactionsScrollContainer}>
            {groupedReactions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.commentReactionsScrollContent}
              >
                {groupedReactions.map((reaction, idx) => {
                  const isMyReaction = reaction.user_ids?.includes(user?.id);
                  
                  return isMyReaction ? (
                    <TouchableOpacity
                      key={`${reaction.emoji}-${idx}`}
                      style={[styles.reactionItem, styles.reactionItemMine]}
                      onPress={() => onDeleteCommentReaction(item.id, reaction.emoji)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                      {reaction.count > 1 && (
                        <Text style={[styles.reactionCount, styles.reactionCountMine]}>
                          {reaction.count}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      key={`${reaction.emoji}-${idx}`}
                      style={styles.reactionItem}
                      onPress={() => {
                        service.setCurrentReactingComment({ postId, commentId: item.id });
                        service.setCurrentReactingItem(null);
                        onReactComment(item.id);
                      }}
                    >
                      <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                      {reaction.count > 1 && (
                        <Text style={styles.reactionCount}>
                          {reaction.count}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <TouchableOpacity
                style={styles.addReactionButton}
                onPress={() => {
                  service.setCurrentReactingComment({ postId, commentId: item.id });
                  service.setIsEmojiPickerOpen(true);
                }}
              >
                <Ionicons name="happy-outline" size={16} color="#666" />
                <Text style={styles.addReactionText}>React</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Add delete button for my comments */}
          {isMyComment && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDeleteComment(item.id)}
            >
              <Ionicons name="trash-bin-outline" size={18} color="#ff4444" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Nested replies */}
        {item.replies?.length > 0 && (
          <View style={styles.repliesContainer}>
            <FlatList
              data={item.replies}
              renderItem={renderComment}
              keyExtractor={(reply) => reply.id.toString()}
            />
          </View>
        )}
      </View>
    );
  };

  if (comments.length === 0) {
    return <Text style={styles.noCommentsText}>No comments yet</Text>;
  }

  return (
    <FlatList
      data={comments}
      renderItem={renderComment}
      keyExtractor={(comment) => comment.id.toString()}
      scrollEnabled={false}
      extraData={comments} // This ensures re-render when comments change
    />
  );
};

const styles = StyleSheet.create({
  commentContainer: {
    padding: 0,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    // backgroundColor: '#f0f0f0'
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  commentUsername: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  commentContent: {
    fontSize: 14,
    marginLeft: 40,
  },
  commentButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 5,
  },
  commentReactionsScrollContainer: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 10,
    overflow: 'hidden',
  },
  commentReactionsScrollContent: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  replyButton: {
    marginLeft: 40,
    marginTop: 5,
  },
  replyButtonText: {
    color: '#3498db',
    fontSize: 12,
  },
  repliesContainer: {
    paddingLeft: 10,
    marginTop: 10,
    borderLeftColor: '#eee',
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
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
    color: '#65676B',
  },
  reactionCountMine: {
    color: '#10b981',
    fontWeight: '600',
  },
  addReactionButton: {
    flex: 1,
    flexDirection: 'row',
    padding: 5,
  },
  addReactionText: {
    fontSize: 12,
    color: '#65676B',
    fontStyle: 'italic',
  },
  deleteButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  noCommentsText: {
    textAlign: 'center',
    padding: 10,
    color: '#888',
  },
});

export default RenderComments;