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
import { useTranslation } from '@/constants/i18n';

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
  overrideComments?: any[];
  hideReactions?: boolean;
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
  onCommentLayout,
  overrideComments,
  hideReactions = false
}: RenderCommentsProps) => {
  const { colors, activeScheme } = useAppTheme();
  const { t, isRTL } = useTranslation();
  const { posts } = usePostStore();
  const currentPost = posts.find(p => p.id === postId);
  const comments = overrideComments || currentPost?.comments || [];
  const { locale } = useTranslation();

  const [translatedComments, setTranslatedComments] = React.useState<Record<number, string>>({});
  const [translatingCommentIds, setTranslatingCommentIds] = React.useState<Record<number, boolean>>({});

  const handleTranslateComment = React.useCallback(async (comment: any) => {
    if (translatedComments[comment.id]) {
      setTranslatedComments(prev => {
        const next = { ...prev };
        delete next[comment.id];
        return next;
      });
      return;
    }

    setTranslatingCommentIds(prev => ({ ...prev, [comment.id]: true }));
    try {
      const targetLang = locale || 'en';
      const langpair = `autodetect|${targetLang}`;
      
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(comment.content)}&langpair=${langpair}`);
      const data = await response.json();

      if (data && data.responseData && data.responseData.translatedText) {
        const translatedText = data.responseData.translatedText;
        if (translatedText.toUpperCase().includes('DISTINCT LANGUAGES')) {
           useToastStore.getState().showToast(t('message_already_in_your_language'), 'info');
           return;
        }
        setTranslatedComments(prev => ({ ...prev, [comment.id]: translatedText }));
      } else {
        throw new Error('Invalid translation response');
      }
    } catch (error) {
      console.error('Comment translation failed:', error);
      useToastStore.getState().showToast(t('could_not_translate'), 'error');
    } finally {
      setTranslatingCommentIds(prev => ({ ...prev, [comment.id]: false }));
    }
  }, [translatedComments, locale, t]);

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
          isHighlighted && { 
            backgroundColor: colors.primary + '15', 
            [isRTL ? 'borderRightColor' : 'borderLeftColor']: colors.primary,
            [isRTL ? 'borderRightWidth' : 'borderLeftWidth']: 3,
            [isRTL ? 'borderLeftWidth' : 'borderRightWidth']: 0,
          }
        ]}
        onLayout={(e) => {
          if (isHighlighted && onCommentLayout) {
            onCommentLayout(item.id.toString(), e.nativeEvent.layout.y);
          }
        }}
      >
        <View style={[styles.commentHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity 
            onPress={() => onProfilePress(item.user.id)}
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}
          >
            <Image
              source={{ uri: `${getApiBaseImage()}/storage/${item.user.profile_photo}` || 'https://picsum.photos/200' }}
              style={[styles.commentAvatar, { [isRTL ? 'marginLeft' : 'marginRight']: 8, [isRTL ? 'marginRight' : 'marginLeft']: 0 }]}
            />
            <Text style={[styles.commentUsername, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}>{item.user.name}</Text>
          </TouchableOpacity>
          <Text style={[styles.commentContent, { color: colors.text, textAlign: isRTL ? 'right' : 'left', [isRTL ? 'marginRight' : 'marginLeft']: 40, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>
            {translatedComments[item.id] || item.content}
          </Text>
          {detectedUrl && (
            <View style={[styles.commentLinkPreview, { [isRTL ? 'marginRight' : 'marginLeft']: 40, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>
              <LinkPreviewCard url={detectedUrl} compact={true} />
            </View>
          )}
          {!isMyComment && (
            <TouchableOpacity
              style={[styles.headerReportButton, { [isRTL ? 'marginRight' : 'marginLeft']: 5, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}
              onPress={async () => {
                const isAlreadyReported = useReportedContentStore.getState().isReported('comment', item.id);
                if (isAlreadyReported) {
                  try {
                    await deleteReportByTarget('comment', item.id);
                    useReportedContentStore.getState().removeReportedItem('comment', item.id);
                    useToastStore.getState().showToast(t('report_removed_msg'), 'success');
                  } catch (error) {
                    console.error('Failed to delete report:', error);
                    useToastStore.getState().showToast(t('failed_remove_report_msg'), 'error');
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

        <View style={[styles.commentButtons, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            style={[styles.replyButton, { [isRTL ? 'marginRight' : 'marginLeft']: 40, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}
            onPress={() => onReply(item)}
          >
            <Text style={[styles.replyButtonText, { color: colors.tint }]}>{t('reply')}</Text>
          </TouchableOpacity>

          {(!item.user?.locale || item.user.locale !== locale) && (
            <TouchableOpacity
              style={[styles.translateButton, { [isRTL ? 'marginRight' : 'marginLeft']: 15 }]}
              onPress={() => handleTranslateComment(item)}
            >
              <Text style={[styles.replyButtonText, { color: colors.tint }]}>
                {translatingCommentIds[item.id] ? t('translating') : translatedComments[item.id] ? t('see_original') : t('translate')}
              </Text>
            </TouchableOpacity>
          )}

          {!hideReactions && (
            <View style={[styles.commentReactionsScrollContainer, { [isRTL ? 'marginRight' : 'marginLeft']: 10, [isRTL ? 'marginLeft' : 'marginRight']: 10 }]}>
              {groupedReactions.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.commentReactionsScrollContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  {groupedReactions.map((reaction, idx) => {
                    const isMyReaction = reaction.user_ids?.some(id => String(id) === String(user?.id));
                    return isMyReaction ? (
                      <TouchableOpacity
                        key={`${reaction.emoji}-${idx}`}
                        style={[styles.reactionItem, styles.reactionItemMine, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                        onPress={() => onDeleteCommentReaction(item.id, reaction.emoji)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                        {reaction.count > 1 && (
                          <Text style={[styles.reactionCount, styles.reactionCountMine, { [isRTL ? 'marginRight' : 'marginLeft']: 4, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>
                            {reaction.count}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        key={`${reaction.emoji}-${idx}`}
                        style={[styles.reactionItem, { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                        onPress={() => {
                          service.setCurrentReactingComment({ postId, commentId: item.id });
                          service.setCurrentReactingItem(null);
                          onReactComment(item.id);
                        }}
                      >
                        <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                        {reaction.count > 1 && (
                          <Text style={[styles.reactionCount, { color: colors.textSecondary, [isRTL ? 'marginRight' : 'marginLeft']: 4, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>
                            {reaction.count}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <TouchableOpacity
                  style={[styles.addReactionButton, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                  onPress={() => {
                    service.setCurrentReactingComment({ postId, commentId: item.id });
                    service.setIsEmojiPickerOpen(true);
                  }}
                >
                  <Ionicons name="happy-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.addReactionText, { color: colors.textSecondary, [isRTL ? 'marginRight' : 'marginLeft']: 4, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>{t('react')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {isMyComment && (
            <TouchableOpacity
              style={[styles.deleteButton, { [isRTL ? 'marginRight' : 'marginLeft']: 'auto', [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}
              onPress={() => onDeleteComment(item.id)}
            >
              <Ionicons name="trash-bin-outline" size={18} color="#ff4444" />
            </TouchableOpacity>
          )}
        </View>

        {item.replies?.length > 0 && (
          <View style={[styles.repliesContainer, { [isRTL ? 'paddingRight' : 'paddingLeft']: 10, [isRTL ? 'paddingLeft' : 'paddingRight']: 0 }]}>
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
    return <Text style={[styles.noCommentsText, { color: colors.textSecondary }]}>{t('no_comments_yet')}</Text>;
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
              useToastStore.getState().showToast(t('report_ai_review_long'), 'success');
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
    // These will be overridden by inline styles to support RTL
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
  translateButton: {
    marginTop: 5,
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