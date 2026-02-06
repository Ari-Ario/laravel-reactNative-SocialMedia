// app/post/[id].tsx
import React, { useEffect, useState, useRef, useContext } from 'react';
import { 
  View, 
  Text, 
  Image, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  Pressable,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePostStore } from '@/stores/postStore';
import { fetchPostById, commentOnPost, deleteReactionFromPost, deleteComment, reactToPost, reactToComment, deleteReactionFromComment } from '@/services/PostService';
import RenderComments from '@/components/RenderComments';
import { useProfileView } from '@/context/ProfileViewContext';
import getApiBaseImage from '@/services/getApiBaseImage';
import { Ionicons } from '@expo/vector-icons';
import AuthContext from '@/context/AuthContext';
import EmojiPicker from 'rn-emoji-keyboard';
import { Video, Audio } from 'expo-av';
import { usePostListService } from '@/services/PostListService';

const PostDetailScreen = () => {
  const { id, highlightCommentId } = useLocalSearchParams();
  const { posts, addPost, updatePost } = usePostStore();
  const { user } = useContext(AuthContext);
  const post = posts.find(p => p.id.toString() === id);
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [currentReactingItem, setCurrentReactingItem] = useState<{ postId: number; commentId?: number } | null>(null);
  const [currentReactingComment, setCurrentReactingComment] = useState<{ postId: number; commentId: number } | null>(null);
  const [showComments, setShowComments] = useState(false);
  const service = usePostListService(user);

  const scrollViewRef = useRef<ScrollView>(null);
  const commentsSectionRef = useRef<View>(null);
  const highlightAnimation = useRef(new Animated.Value(0)).current;

  const postId = parseInt(id as string);

  useEffect(() => {
    // If post not found in store, fetch it
    if (!post && postId) {
      const fetchPost = async () => {
        setLoading(true);
        try {
          const postData = await fetchPostById(postId);
          if (postData) {
            addPost(postData);
          }
        } catch (error) {
          console.error('Error fetching post:', error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchPost();
    }
  }, [postId, post, addPost]);

  // Handle comment highlighting when highlightCommentId changes
useEffect(() => {
  if (highlightCommentId) {
    setHighlightedCommentId(highlightCommentId as string);
    setShowComments(true); // FORCE SHOW COMMENTS

    // Animate highlight
    Animated.sequence([
      Animated.timing(highlightAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(highlightAnimation, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      commentsSectionRef.current?.measure((x, y, width, height, pageX, pageY) => {
        scrollViewRef.current?.scrollTo({ y: pageY - 100, animated: true });
      });
    }, 300);
  }
}, [highlightCommentId]);

  console.log('📱 PostDetailScreen opened with:', { 
    id: postId, 
    highlightCommentId,
    postFound: !!post,
    loading 
  });

  // Handle post reaction
  const handleReact = async (emoji: string) => {
    if (!post) return;
    
    try {
      await reactToPost(post.id, emoji);
      // Refresh post data
      const postData = await fetchPostById(postId);
      if (postData) {
        addPost(postData);
      }
    } catch (error) {
      console.error('Error reacting to post:', error);
    }
  };

  // Handle comment reaction
  const handleReactComment = async (emoji: string, commentId: number) => {
    try {
      await reactToComment(postId, commentId, emoji);
      // Refresh post data
      const postData = await fetchPostById(postId);
      if (postData) {
        addPost(postData);
      }
    } catch (error) {
      console.error('Error reacting to comment:', error);
    }
  };

  // Handle delete post reaction
  const handleDeletePostReaction = async () => {
    if (!post) return;
    
    try {
      await deleteReactionFromPost(post.id);
      // Refresh post data
      const postData = await fetchPostById(postId);
      if (postData) {
        addPost(postData);
      }
    } catch (error) {
      console.error('Error deleting post reaction:', error);
    }
  };

  const handleProfilePress = (userId: string) => {
    setProfileViewUserId(userId);
    setProfilePreviewVisible(true);
  };

  const handleReply = (comment: any) => {
    setCommentText(`@${comment.user.name} `);
  };

  const handleReactCommentPress = (commentId: number) => {
    setCurrentReactingComment({ postId, commentId });
    setIsEmojiPickerOpen(true);
  };

  const handleDeleteCommentReaction = async (commentId: number, emoji: string) => {
    try {
      await deleteReactionFromComment(commentId);
      // Refresh post data
      const postData = await fetchPostById(postId);
      if (postData) {
        addPost(postData);
      }
    } catch (error) {
      console.error('Error deleting comment reaction:', error);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteComment(postId, commentId);
      // Refresh post data after deletion
      const postData = await fetchPostById(postId);
      if (postData) {
        addPost(postData);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmitting || !post) return;

    setIsSubmitting(true);
    try {
      await commentOnPost(postId, commentText.trim());
      setCommentText('');
      
      // Refresh post data to get updated comments
      const postData = await fetchPostById(postId);
      if (postData) {
        addPost(postData);
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikePost = async () => {
    try {
      await handleReact('❤️');
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleSharePost = async () => {
    try {
      // Implement share post logic
      console.log('Share post:', postId);
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  const handleBookmarkPost = async () => {
    try {
      // Implement bookmark post logic
      console.log('Bookmark post:', postId);
    } catch (error) {
      console.error('Error bookmarking post:', error);
    }
  };

  // Get grouped reactions for post
  const getGroupedReactions = () => {
    if (!post?.reactions) return [];
    
    const reactionMap = new Map();
    post.reactions.forEach(reaction => {
      const existing = reactionMap.get(reaction.emoji) || { count: 0, user_ids: [] };
      reactionMap.set(reaction.emoji, {
        count: existing.count + 1,
        user_ids: [...existing.user_ids, reaction.user_id]
      });
    });

    return Array.from(reactionMap.entries())
      .map(([emoji, { count, user_ids }]) => ({ 
        emoji, 
        count,
        user_ids 
      }))
      .sort((a, b) => b.count - a.count);
  };

  // Check if user has reacted to post
  const hasUserReacted = () => {
    if (!post?.reactions || !user) return false;
    return post.reactions.some(reaction => reaction.user_id === user.id);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Loading post...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#999" />
        <Text style={styles.errorText}>Post not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const interpolatedBackgroundColor = highlightAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', '#e6f3ff']
  });

  const groupedReactions = getGroupedReactions();
  const userHasReacted = hasUserReacted();

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#000" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Post Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={() => handleProfilePress(post.user.id.toString())}
          >
            <Image
              source={{ 
                uri: `${getApiBaseImage()}/storage/${post.user.profile_photo}`,
                cache: 'force-cache'
              }}
              style={styles.userAvatar}
              defaultSource={require('@/assets/images/favicon.png')}
            />
            <Text style={styles.userName}>{post.user.name}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Post Content */}
        <View style={styles.postContent}>
          <Text style={styles.contentText}>
            <Text style={styles.userName}>{post.user.name} </Text>
            {post.caption || post.content}
          </Text>
          {post.caption && post.content && post.caption !== post.content && (
            <Text style={styles.additionalContent}>
              {post.content}
            </Text>
          )}
        </View>

        {/* Post media – supports multiple images / videos (Instagram-style) */}
        {post.media && post.media.length > 0 && (
          <View style={styles.mediaContainer}>
            {/* Sort media exactly like in PostListItem */}
            {(() => {
              const sortedMedia = [...post.media].sort((a, b) => {
                if (a.type === 'video' && b.type !== 'video') return 1;
                if (a.type !== 'video' && b.type === 'video') return -1;
                return 0;
              });

              return sortedMedia.length === 1 ? (
                <TouchableOpacity onPress={() => service.openMediaViewer(0)}>
                  {sortedMedia[0].type === 'video' ? (
                    <Video
                      source={{ uri: `${getApiBaseImage()}/storage/${sortedMedia[0].file_path}` }}
                      style={styles.singleMedia}
                      resizeMode="cover"
                      shouldPlay={false}
                      isMuted={true}
                      useNativeControls={false}
                    />
                  ) : (
                    <Image
                      source={{ uri: `${getApiBaseImage()}/storage/${sortedMedia[0].file_path}` }}
                      style={styles.singleMedia}
                      resizeMode="cover"
                    />
                  )}
                </TouchableOpacity>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {sortedMedia.map((media, index) => (
                    <TouchableOpacity
                      key={`${media.id}-${index}`}
                      onPress={() => service.openMediaViewer(index)}
                      style={styles.multiMediaItem}
                    >
                      {media.type === 'video' ? (
                        <Video
                          source={{ uri: `${getApiBaseImage()}/storage/${media.file_path}` }}
                          style={styles.multiMediaContent}
                          resizeMode="cover"
                          shouldPlay={false}
                          isMuted={true}
                          useNativeControls={false}
                        />
                      ) : (
                        <Image
                          source={{ uri: `${getApiBaseImage()}/storage/${media.file_path}` }}
                          style={styles.multiMediaContent}
                          resizeMode="cover"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              );
            })()}
          </View>
        )}

        {/* Post Actions */}
        <View style={styles.postActions}>
          <View style={styles.leftActions}>
            { groupedReactions.length === 0 && (

            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => {
                setCurrentReactingItem({ postId: post.id });
                setIsEmojiPickerOpen(true);
              }}
            >
              <Ionicons 
                name={userHasReacted ? "heart" : "heart-outline"} 
                size={28} 
                color={userHasReacted ? "#ff3040" : "#000"} 
              />
            </TouchableOpacity>
            )
            }

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                setShowComments(true);
                setTimeout(() => {
                  commentsSectionRef.current?.measure((x, y, width, height, pageX, pageY) => {
                    scrollViewRef.current?.scrollTo({ y: pageY - 100, animated: true });
                  });
                }, 100);
              }}
            >
              <Ionicons name="chatbubble-outline" size={26} color="#000" />
              {post.comments_count > 0 && (
                <View style={styles.commentCountBadge}>
                  <Text style={styles.commentCountText}>{post.comments_count}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleSharePost}>
              <Ionicons name="paper-plane-outline" size={26} color="#000" />
            </TouchableOpacity>
            {/* Post Reactions */}
            {groupedReactions.length > 0 && (
              <View style={styles.reactionsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.reactionsList}>
                    {groupedReactions.map((reaction, index) => {
                      const isMyReaction = reaction.user_ids.includes(user?.id);
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.reactionItem,
                            isMyReaction && styles.reactionItemMine
                          ]}
                          onPress={() => isMyReaction ? handleDeletePostReaction() : handleReact(reaction.emoji)}
                        >
                          <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                          {reaction.count > 1 && (
                            <Text style={[
                              styles.reactionCount,
                              isMyReaction && styles.reactionCountMine
                            ]}>
                              {reaction.count}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={styles.addReactionButton}
                      onPress={() => {
                        setCurrentReactingItem({ postId: post.id });
                        setIsEmojiPickerOpen(true);
                      }}
                    >
                      <Ionicons name="add" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.actionButton} onPress={handleBookmarkPost}>
            <Ionicons name="bookmark-outline" size={26} color="#000" />
          </TouchableOpacity>
        </View>


        {/* Post Stats */}
        {/* <View style={styles.postStats}>
          <Text style={styles.likesCount}>{post.reactions_count || 0} Reactions</Text>
          <Text style={styles.timestamp}>
            {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Recently'}
          </Text>
        </View> */}

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <TouchableOpacity
            style={styles.commentsHeader}
            onPress={() => setShowComments(!showComments)}
          >
            <Text style={styles.commentsTitle}>
              Comments • {post.comments_count || 0}
            </Text>
            <Ionicons 
              name={showComments ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>

          {showComments && (
            <Animated.View style={[styles.highlightContainer, { backgroundColor: interpolatedBackgroundColor }]}>
              <RenderComments
                user={user}
                service={{ 
                  setCurrentReactingComment: setCurrentReactingComment, 
                  setCurrentReactingItem: setCurrentReactingItem, 
                  setIsEmojiPickerOpen: setIsEmojiPickerOpen 
                }}
                postId={post.id}
                onProfilePress={handleProfilePress}
                onReply={handleReply}
                onReactComment={handleReactCommentPress}
                onDeleteCommentReaction={handleDeleteCommentReaction}
                onDeleteComment={handleDeleteComment}
                highlightedCommentId={highlightedCommentId}
              />
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* Comment Input */}
      <View style={styles.commentInputContainer}>
        <Image
          source={{ 
            uri: user?.profile_photo 
              ? `${getApiBaseImage()}/storage/${user.profile_photo}`
              : require('@/assets/images/favicon.png')
          }}
          style={styles.currentUserAvatar}
          defaultSource={require('@/assets/images/favicon.png')}
        />
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          style={[
            styles.postButton, 
            (!commentText.trim() || isSubmitting) && styles.postButtonDisabled
          ]}
          onPress={handleSubmitComment}
          disabled={!commentText.trim() || isSubmitting}
        >
          <Text style={[
            styles.postButtonText,
            (!commentText.trim() || isSubmitting) && styles.postButtonTextDisabled
          ]}>
            Post
          </Text>
        </TouchableOpacity>
      </View>

      {/* Emoji Picker */}
      <EmojiPicker
        open={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onEmojiSelected={(emoji) => {
          if (currentReactingComment) {
            handleReactComment(emoji.emoji, currentReactingComment.commentId);
          } else if (currentReactingItem) {
            handleReact(emoji.emoji);
          }
          setIsEmojiPickerOpen(false);
          setCurrentReactingItem(null);
          setCurrentReactingComment(null);
        }}
        emojiSize={28}
        containerStyle={styles.emojiPicker}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
    backgroundColor: '#fff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 4,
    color: '#000',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 60, // Balance the header layout
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
    marginBottom: 20,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  userName: {
    fontWeight: '600',
    fontSize: 14,
  },
  moreButton: {
    padding: 4,
  },
  postMedia: {
    width: '100%',
    height: 400,
    backgroundColor: '#fafafa',
  },
  mediaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 8,
    overflow: 'hidden',
  },
  singleMedia: {
    aspectRatio: 16/9,
    width: '100%',
  },
  singleMediaContent: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  multiMediaItem: {
    width: Dimensions.get('window').width * 0.5,
    aspectRatio: 1,
    marginHorizontal: 4,
    maxWidth: Platform.OS === 'web' ? 400 : Dimensions.get('window').width * 0.5,
  },
  multiMediaContent: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
    marginRight: 12,
  },
  reactionsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  reactionsList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 15,
    borderColor: '#e8eaed',
    paddingHorizontal: 8,
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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  postStats: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  likesCount: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
  },
  timestamp: {
    color: '#8e8e8e',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  postContent: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  contentText: {
    fontSize: 14,
    lineHeight: 18,
  },
  additionalContent: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: 8,
    color: '#262626',
  },
  commentsSection: {
    paddingBottom: 80,
  },
  commentsTitle: {
    fontWeight: '600',
    fontSize: 14,
    padding: 12,
    color: '#8e8e8e',
  },
  highlightContainer: {
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#dbdbdb',
    backgroundColor: '#fff',
  },
  currentUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dbdbdb',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    marginRight: 8,
  },
  postButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#0095f6',
    fontWeight: '600',
    fontSize: 14,
  },
  postButtonTextDisabled: {
    color: '#b2dffc',
  },
  emojiPicker: {
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  commentCountBadge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  commentCountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default PostDetailScreen;