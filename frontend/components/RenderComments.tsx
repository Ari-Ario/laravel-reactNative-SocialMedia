// components/RenderComments.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, FlatList } from 'react-native';
import EmojiPicker from 'rn-emoji-keyboard';
import { Ionicons } from '@expo/vector-icons';
import getApiBaseImage from '@/services/getApiBaseImage';
import { usePostStore } from '@/stores/postStore';
import ReportPost from './ReportPost';
import { LinkPreviewCard } from './LinkPreviewCard';
import { extractFirstUrl } from '@/utils/urlUtils';
import { useToastStore } from '@/stores/toastStore';
import { useReportedContentStore } from '@/stores/reportedContentStore';
import { deleteReportByTarget } from '@/services/ReportService';
import { useAppTheme } from '@/hooks/useAppTheme';

interface RenderCommentsProps {
  user: any;
  service: any;
  postId: number;
  onProfilePress: (userId: string) => void;
  onReply: (comment: any) => void;
  onReactComment: (commentId: number) => void;
  onDeleteCommentReaction: (commentId: number, emoji: string) => void;
  onDeleteComment: (commentId: number) => void;
  highlightedCommentId?: string | null;
  onCommentLayout?: (commentId: string, y: number) => void;
}

const RenderComments = ({
  user,
  service,
  postId,
  onProfilePress,
  onReply,
  onReactComment,
  onDeleteCommentReaction,
  onDeleteComment,
  highlightedCommentId,
  onCommentLayout
}: RenderCommentsProps) => {
  const { colors, activeScheme } = useAppTheme();
  const { posts } = usePostStore();
  const currentPost = posts.find(p => p.id === postId);
  const comments = currentPost?.comments || [];

  const [showReportModal, setShowReportModal] = React.useState(false);
  const [reportingCommentId, setReportingCommentId] = React.useState<number | null>(null);

  const getGroupedReactionsComments = (comment: { reaction_comments?: Array<{ emoji: string; user_id: number | string }> }) => {
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
      .map(([emoji, { count, user_ids }]) => ({ emoji, count, user_ids }))
      .sort((a, b) => b.count - a.count);
  };

  const renderComment = ({ item }: { item: any }) => {
    const groupedReactions = getGroupedReactionsComments(item);
    const isMyComment = String(item.user_id) === String(user?.id);
    const isHighlighted = highlightedCommentId && item.id.toString() === highlightedCommentId;

    // Detect URL in comment using unified utility
    const detectedUrl = extractFirstUrl(item.content);

    return (
      <View
        style={[
          styles.commentContainer,
          { borderTopColor: colors.border },
          isHighlighted && styles.highlightedComment,
          isHighlighted && { backgroundColor: colors.primary + '15', borderLeftColor: colors.primary }
        ]}
        onLayout={(e) => {
          if (isHighlighted && onCommentLayout) {
            onCommentLayout(item.id.toString(), e.nativeEvent.layout.y);
          }
        }}
      >
        <View style={styles.commentHeader}>
          <TouchableOpacity onPress={() => onProfilePress(item.user.id)}>
            <Image
              source={{ uri: `${getApiBaseImage()}/storage/${item.user.profile_photo}` || 'https://picsum.photos/200' }}
              style={styles.commentAvatar}
            />
            <Text style={[styles.commentUsername, { color: colors.text }]}>{item.user.name}</Text>
          </TouchableOpacity>
          <Text style={[styles.commentContent, { color: colors.text }]}>{item.content}</Text>
          {detectedUrl && (
            <View style={styles.commentLinkPreview}>
              <LinkPreviewCard url={detectedUrl} compact={true} />
            </View>
          )}
          {!isMyComment && (
            <TouchableOpacity
              style={styles.headerReportButton}
              onPress={async () => {
                const isAlreadyReported = useReportedContentStore.getState().isReported('comment', item.id);
                if (isAlreadyReported) {
                  try {
                    await deleteReportByTarget('comment', item.id);
                    useReportedContentStore.getState().removeReportedItem('comment', item.id);
                    useToastStore.getState().showToast('Report removed successfully', 'success');
                  } catch (error) {
                    console.error('Failed to delete report:', error);
                    useToastStore.getState().showToast('Failed to remove report', 'error');
                  }
                } else {
                  setReportingCommentId(item.id);
                  setShowReportModal(true);
                }
              }}
            >
              <Ionicons
                name={useReportedContentStore.getState().isReported('comment', item.id) ? "flag" : "flag-outline"}
                size={14}
                color={useReportedContentStore.getState().isReported('comment', item.id) ? "#ff4444" : colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.commentButtons}>
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => onReply(item)}
          >
            <Text style={[styles.replyButtonText, { color: colors.tint }]}>Reply</Text>
          </TouchableOpacity>

          <View style={styles.commentReactionsScrollContainer}>
            {groupedReactions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.commentReactionsScrollContent}
              >
                {groupedReactions.map((reaction, idx) => {
                  const isMyReaction = reaction.user_ids?.some(id => String(id) === String(user?.id));
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
                      style={[styles.reactionItem, { borderColor: colors.border }]}
                      onPress={() => {
                        service.setCurrentReactingComment({ postId, commentId: item.id });
                        service.setCurrentReactingItem(null);
                        onReactComment(item.id);
                      }}
                    >
                      <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                      {reaction.count > 1 && (
                        <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>
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
                <Ionicons name="happy-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.addReactionText, { color: colors.textSecondary }]}>React</Text>
              </TouchableOpacity>
            )}
          </View>

          {isMyComment && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDeleteComment(item.id)}
            >
              <Ionicons name="trash-bin-outline" size={18} color="#ff4444" />
            </TouchableOpacity>
          )}
        </View>

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
    return <Text style={[styles.noCommentsText, { color: colors.textSecondary }]}>No comments yet</Text>;
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(comment) => comment.id.toString()}
        scrollEnabled={false}
        extraData={comments}
        ListFooterComponent={
          <ReportPost
            visible={showReportModal}
            targetId={reportingCommentId || 0}
            type="comment"
            onClose={() => setShowReportModal(false)}
            onReportSubmitted={() => {
              useToastStore.getState().showToast('Report Submitted: Our AI is reviewing this comment.', 'success');
              setShowReportModal(false);
            }}
          />
        }
      />
      {typeof service.isEmojiPickerOpen === 'boolean' && (
        <EmojiPicker
          open={service.isEmojiPickerOpen && !!service.currentReactingComment}
          onClose={() => service.setIsEmojiPickerOpen(false)}
          onEmojiSelected={(emoji: any) => {
            if (service.currentReactingComment) {
              service.handleReactComment(emoji.emoji, postId, service.currentReactingComment.commentId!);
            }
          }}
          emojiSize={28}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  commentContainer: {
    padding: 0,
    borderTopWidth: 1,
  },
  highlightedComment: {
    borderLeftWidth: 3,
    marginLeft: -3,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    flex: 1,
  },
  commentLinkPreview: {
    marginLeft: 40,
    marginTop: 4,
    marginBottom: 4,
    width: '90%',
  },
  headerReportButton: {
    padding: 5,
    marginLeft: 5,
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
    fontSize: 12,
  },
  repliesContainer: {
    paddingLeft: 10,
    marginTop: 10,
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
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
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