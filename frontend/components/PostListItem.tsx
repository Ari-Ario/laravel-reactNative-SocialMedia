// components/PostListItem.tsx
import { 
  View, 
  Image, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  TextInput,
  ScrollView,
  Modal,
  NativeSyntheticEvent,
  findNodeHandle, UIManager,
  NativeTouchEvent
} from 'react-native';
import { Ionicons, Feather, AntDesign } from '@expo/vector-icons';
import { useState, useContext, useRef } from 'react';
import EmojiPicker from 'rn-emoji-keyboard';
import PostMenu from './PostMenu';
import ReportPost from './ReportPost';
import { deletePost, fetchPosts, reactToPost, reactToComment } from '@/services/PostService';
import AuthContext from '@/context/AuthContext';
import { router } from 'expo-router';
import { Platform, Alert } from 'react-native';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useProfileView } from '@/context/ProfileViewContext';
import { useModal } from '@/context/ModalContext';
import { usePostStore } from '@/stores/postStore';


interface Comment {
  reaction_comments: any;
  user_id: string | undefined;
  id: number;
  content: string;
  user: {
    id: number | string;
    name: string;
    profile_photo: string | null;
  };
  replies?: Comment[];
  reaction_counts?: Array<{
    emoji: string;
    count: number;
  }>;
}

interface Repost {
  id: number;
  user: {
    id: number;
    name: string;
    profile_photo: string | null;
  };
  created_at: string;
}

interface Post {
  reactions: any;
  id: number;
  caption: string;
  user: {
    id: number | string;
    name: string;
    profile_photo: string | null;
  };
  media: Array<{
    id: number;
    file_path: string;
    type: string;
  }>;
  reaction_counts: Array<{
    emoji: string;
    count: number;
  }>;
  comments: Comment[];
  comments_count: number;
  created_at: string;

  reposts?: Repost[];
  reposts_count?: number;
  is_reposted?: boolean;
}

interface Reaction {
  id: number;
  emoji: string;
  user_id: number;
  post_id: number;
  comment_id?: number;
  created_at?: string;
}

interface ReactionCount {
  emoji: string;
  count: number;
}

interface PostListItemProps {
  post: Post;
  onReact: (postId: number, emoji: string, commentId?: number) => void;
  onReactComment: (postId: number, emoji: string, commentId?: number) => void;
  onCommentSubmit: (postId: number, content: string, parentId?: number) => void;
  onRepost: (postId: number) => void;
  onShare: (postId: number) => void;
  onBookmark: (postId: number) => void;
  // onEditPost: () => void; 
  // setIsCreateModalVisible: (visible: boolean) => void;
}

export default function PostListItem({ 
  post, 
  onReact,
  onReactComment,
  onCommentSubmit,
  onRepost,
  onShare,
  onBookmark,
}: Omit<PostListItemProps, 'onEditPost' | 'setIsCreateModalVisible'>) {
  const { openModal } = useModal();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [currentReactingItem, setCurrentReactingItem] = useState<{
    postId: number;
    commentId?: number;
  } | null>(null);

  const [currentReactingComment, setCurrentReactingComment] = useState<{
    commentId?: number;
    postId: number;
  } | null>(null);

const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
const [menuVisible, setMenuVisible] = useState(false);
const [reportVisible, setReportVisible] = useState(false);
const { user, setUser } = useContext(AuthContext);
const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
// const reactionsToShow = getGroupedReactions(post, user?.id);
const { deletePostById, updatePost: updatePostInStore } = usePostStore();
const postStore = usePostStore();

// const { posts } = usePostStore();
// At the top of your component
const { posts, updatePost } = usePostStore();
const currentPost = posts.find(p => p.id === post.id) || post;

// Then use currentPost instead of post throughout your component
// For example:
const reactionsToShow = getGroupedReactions(currentPost, user?.id);
const totalReactions = reactionsToShow.reduce((acc, r) => acc + r.count, 0);
const comments = currentPost.comments || [];

const isOwner = user?.id === post.user.id;

const [isFullScreen, setIsFullScreen] = useState(false);


const handleDelete = async () => {
    try {
        const confirmMessage = Platform.OS === 'web' 
            ? window.confirm("Are you sure you want to delete this post?")
            : await new Promise((resolve) => {
                Alert.alert(
                    "Delete Post",
                    "Are you sure you want to delete this post?",
                    [
                        { text: "Cancel", onPress: () => resolve(false) },
                        { text: "Delete", onPress: () => resolve(true) }
                    ]
                );
            });

        if (!confirmMessage) {
            setMenuVisible(false);
            return;
        }

        await deletePost(post.id);
        deletePostById(post.id);
        setMenuVisible(false);
        
        if (Platform.OS === 'web') {
            alert("Post deleted successfully");
        } else {
            Alert.alert("Success", "Post deleted successfully");
        }
        
        // Refresh posts list
        // if (onPostDeleted) {
        //     onPostDeleted();
        // }
        fetchPosts();
        setMenuVisible(false);

    } catch (error) {
        console.error('Delete error:', error);
        const errorMessage = error.message || "Could not delete post. Please try again.";
        
        if (Platform.OS === 'web') {
            alert(errorMessage);
        } else {
            Alert.alert("Error", errorMessage);
        }
    }
};

  const handleEdit = () => {
    openModal('edit', {
      postId: post.id,
      initialCaption: post.caption,
      initialMedia: post.media,

      // Optional: Add any refresh logic you need
      onPostCreated: (updatedPost) => {
        // console.log('✅ Got post in PostListItem:', updatedPost);
        // console.log('✅ Post ID:', updatedPost?.id);
        updatePostInStore(updatedPost);
        setMenuVisible(false);
      }
    });
    setMenuVisible(false);
  };

  const handleReport = () => {
      setMenuVisible(false);
      setReportVisible(true);
  };

  const handleReportSubmitted = () => {
      Alert.alert("Report Submitted", "Thank you for your report. We'll review it shortly.");
  };


  // Default emojis to show if no reactions exist
  // const defaultEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  
  // Get reactions to display (from backend or default)
  function getGroupedReactions(post: Post, currentUserId?: number): 
    { emoji: string; count: number; user_ids: number[] }[] {
    
    const defaultEmojis = ['🤍'];
    
    if (!post.reactions || post.reactions.length === 0) {
      return defaultEmojis.map(emoji => ({ 
        emoji, 
        count: 0,
        user_ids: []
      }));
    }

    const reactionMap = new Map<string, { count: number, user_ids: number[] }>();

    for (const reaction of post.reactions) {
      const existing = reactionMap.get(reaction.emoji) || { count: 0, user_ids: [] };
      reactionMap.set(reaction.emoji, {
        count: existing.count + 1,
        user_ids: [...existing.user_ids, reaction.user_id]
      });
    }

    return [...reactionMap.entries()].map(([emoji, { count, user_ids }]) => ({ 
      emoji, 
      count,
      user_ids 
    }));
  }

  function getGroupedReactionsComments(
  comment: Comment, 
  currentUserId?: number
): { emoji: string; count: number; user_ids: number[] }[] {
  
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

  return [...reactionMap.entries()].map(([emoji, { count, user_ids }]) => ({ 
    emoji, 
    count,
    user_ids 
  }));
}

  // helper function for handleReact function below
  const updateReactionCounts = (
    counts: Array<{ emoji: string; count: number }>,
    emoji: string,
    delta: number
  ): Array<{ emoji: string; count: number }> => {
    const newCounts = [...counts];
    const index = newCounts.findIndex(item => item.emoji === emoji);
    
    if (index >= 0) {
      // Update existing emoji count
      newCounts[index] = {
        emoji,
        count: Math.max(0, newCounts[index].count + delta)
      };
      
      // Remove if count reaches zero
      if (newCounts[index].count <= 0) {
        newCounts.splice(index, 1);
      }
    } else if (delta > 0) {
      // Add new emoji
      newCounts.push({ emoji, count: 1 });
    }
    
    return newCounts;
  };

  const handleReact = async (emoji: string) => {
    // if (!currentReactingItem?.postId || !user?.id) {
    //   console.error('Missing reaction data:', { currentReactingItem, user });
    //   return;
    // }

    const { postId, commentId } = currentReactingItem;
    
    try {
      console.log('Processing reaction:', { postId, commentId, emoji });

      // 1. Get current post from store
      const currentPost = postStore.posts.find(p => p.id === postId);
      if (!currentPost) {
        throw new Error(`Post ${postId} not found`);
      }

      // 2. Check for any existing reaction from this user
      const reactionContext = commentId
        ? currentPost.comments?.find(c => c.id === commentId)
        : currentPost;
      
      const existingReaction = reactionContext?.reactions?.find(
        r => r.user_id === user.id
      );

      // 3. Call API - always send the new emoji
      const response = await reactToPost(postId, emoji, commentId);
      // console.log('API Response:', response);

      if (!response?.reaction) {
        throw new Error('Invalid API response');
      }

      // 4. Prepare updated post
      const updatedPost = { ...currentPost };

      if (commentId) {
        // Update comment reactions
        updatedPost.comments = updatedPost.comments?.map(comment => {
          if (comment.id !== commentId) return comment;
          
          // Remove any existing reaction from this user
          const filteredReactions = comment.reactions?.filter(
            r => r.user_id !== user.id
          ) || [];
          
          // Add new reaction
          const updatedReactions = [...filteredReactions, response.reaction];
          
          // Update counts
          let updatedCounts = [...(comment.reaction_counts || [])];
          
          // Decrement old emoji if existed
          if (existingReaction) {
            updatedCounts = updateReactionCounts(
              updatedCounts,
              existingReaction.emoji,
              -1
            );
          }
          
          // Increment new emoji
          updatedCounts = updateReactionCounts(updatedCounts, emoji, 1);
          
          return {
            ...comment,
            reactions: updatedReactions,
            reaction_counts: updatedCounts
          };
        });
      } else {
        // Update post reactions
        // Remove any existing reaction from this user
        const filteredReactions = updatedPost.reactions?.filter(
          r => r.user_id !== user.id
        ) || [];
        
        // Add new reaction
        updatedPost.reactions = [...filteredReactions, response.reaction];
        
        // Update counts
        let updatedCounts = [...(updatedPost.reaction_counts || [])];
        
        // Decrement old emoji if existed
        if (existingReaction) {
          updatedCounts = updateReactionCounts(
            updatedCounts,
            existingReaction.emoji,
            -1
          );
        }
        
        // Increment new emoji
        updatedPost.reaction_counts = updateReactionCounts(updatedCounts, emoji, 1);
      }

      // 5. Update Zustand store
      postStore.updatePost(updatedPost);

    } catch (error) {
      console.error('Reaction failed:', {
        error,
        postId,
        commentId,
        emoji,
        userId: user.id
      });
      Alert.alert("Error", "Couldn't process reaction");
    } finally {
      setIsEmojiPickerOpen(false);
    }
  };

const useDoubleTap = (callback: () => void, delay = 300) => {
  const lastTap = useRef<number>(0);

  return () => {
    const now = Date.now();
    if (lastTap.current && now - lastTap.current < delay) {
      callback();
    }
    lastTap.current = now;
  };
};


const handleReactComment = async (emoji: string) => {
  if (!currentReactingComment?.postId || !currentReactingComment?.commentId || !user?.id) {
    console.error('Missing reaction data:', { currentReactingComment, user });
    return;
  }

  const { postId, commentId } = currentReactingComment;
  const {
    addCommentReaction,
    removeCommentReaction,
    updateCommentReactions,
  } = usePostStore.getState();

  try {
    const post = usePostStore.getState().posts[postId];
    const comment = post?.comments?.find(c => c.id === commentId);
    const hasExistingReaction = comment?.reaction_comments?.some(
      r => r.user_id === user.id && r.emoji === emoji
    );

    if (hasExistingReaction) {
      removeCommentReaction(postId, commentId, user.id);
    } else {
      addCommentReaction(postId, commentId, user.id, emoji);
    }

    const response = await reactToComment(postId, commentId, emoji);

    if (response?.reaction) {
      updateCommentReactions(
        postId,
        commentId,
        response.reaction,
        response.reaction_counts ?? null
      );
    }

  } catch (error) {
    console.error('Reaction error:', error);
    const post = usePostStore.getState().posts[postId];
    const comment = post?.comments?.find(c => c.id === commentId);
    const originalHadReaction = comment?.reaction_comments?.some(
      r => r.user_id === user.id && r.id <= 1000000
    );

    if (originalHadReaction) {
      addCommentReaction(postId, commentId, user.id, emoji);
    } else {
      removeCommentReaction(postId, commentId, user.id);
    }

    Alert.alert("Error", "Failed to save reaction");
  } finally {
    setIsEmojiPickerOpen(false);
  }
};


  const submitComment =async () => {
    if (!commentText.trim()) return;
    
    try {
      // The response IS the comment object (not nested under .comment)
      const comment = await onCommentSubmit(
        post.id, 
        commentText, 
        replyingTo || undefined
      );

      if (!comment?.id) {
        throw new Error('Invalid comment response - missing id');
      }

      // Format the comment for Zustand
      const formattedComment = {
        id: comment.id,
        content: comment.content,
        user_id: comment.user_id,
        user: {
          id: comment.user.id,
          name: comment.user.name,
          profile_photo: comment.user.profile_photo
        },
        post_id: comment.post_id,
        parent_id: comment.parent_id,
        replies: comment.replies || [],
        reaction_counts: []
      };
      
      // Update the store
      postStore.updatePostWithNewComment(post.id, formattedComment);
      
      // Reset form
      setCommentText('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Full error details:', {
        error,
        postId: post.id,
        commentText,
        replyingTo,
        user: user?.id
      });
      Alert.alert("Error", "Failed to post comment");
    }
  }

const renderComment = ({ item }: { item: Comment }) => {
  const groupedReactions = getGroupedReactionsComments(item);
  
  return (
    <View style={styles.commentContainer}>
      {/* Comment header */}
      <View style={styles.commentHeader}>
        <TouchableOpacity onPress={() => {
          setProfileViewUserId(item.user.id);
          setProfilePreviewVisible(true);
        }}>
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
          onPress={() => {
            setReplyingTo(item?.id);
            setCommentText(`@${item.user.name} `);
          }}
        >
          <Text style={styles.replyButtonText}>Reply</Text>
        </TouchableOpacity>
        
        {/* Comment reactions - now using grouped reactions */}
        <View style={styles.commentReactions}>
          {groupedReactions.length > 0 ? (
            <TouchableOpacity
              style={styles.reactionBar}
              onPress={() => {
                setCurrentReactingComment({ postId: post.id, commentId: item.id });
                setCurrentReactingItem(null);
                setIsEmojiPickerOpen(true);
              }}
            >
              {groupedReactions.slice(0, 3).map((reaction, idx) => {
                const isMyReaction = reaction.user_ids?.includes(user?.id);
                
                return ( // Don't forget the return statement!
                  <View 
                    key={`${reaction.emoji}-${idx}`}
                    style={[
                      styles.reactionItem,
                      isMyReaction && styles.reactionItemMine
                    ]}
                  >
                    <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                    {reaction.count > 1 && (
                      <Text style={[
                        styles.reactionCount,
                        isMyReaction && styles.reactionCountMine // Optional: style count differently if it's your reaction
                      ]}>
                        {reaction.count}
                      </Text>
                    )}
                  </View>
                );
              })}
              {groupedReactions.length > 3 && (
                <Text style={styles.reactionCount}>+{groupedReactions.length - 3}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.addReactionButton}
              onPress={() => {
                setCurrentReactingComment({ postId: post.id, commentId: item.id });
                setCurrentReactingItem(null);
                setIsEmojiPickerOpen(true);
              }}
            >
              <Ionicons name="happy-outline" size={16} color="#666" />
              <Text style={styles.addReactionText}>React</Text>
            </TouchableOpacity>
          )}
        </View>
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



  const handleMenuPress = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    setMenuVisible(true);
    setMenuPosition({
      top: event.nativeEvent.pageY,
      left: event.nativeEvent.pageX,
    });
  };


  return (
    <View style={styles.container}>

      {/* Show repost header if this is a repost */}
      {(post.reposts?.length > 0 && (post.reposts[0].user.name !== user?.name)) && (
        <View style={styles.repostHeader}>
          <Feather name="repeat" size={16} color="#666" />
          <Text style={styles.repostText}>
            {post.reposts[0].user.name} reposted
          </Text>
        </View>
      )}

      <View style={styles.head}>
        {/* Post header */}
        <View style={styles.header}>

          <View style={styles.infoFoto}>
            <TouchableOpacity 
            style={styles.Foto}
            onPress={() => {
              setProfileViewUserId(post.user.id);
              setProfilePreviewVisible(true);
            }}
            >
              <Image
                source={{ uri: `${getApiBaseImage()}/storage/${post.user.profile_photo}` || '@/assets/favicon.png' }}
                style={styles.avatar}
              />
            </TouchableOpacity>

            <View style={styles.nameCaption}>
              <Text style={styles.username}>{post.user.name}</Text>
              <View style={styles.menuContainer}>
              {/* Post caption */}
              {post.caption && <Text style={styles.caption}>{post.caption}</Text>}
              </View>
            </View>
            
          </View>

          <TouchableOpacity 
              style={styles.menuButton}
              // onPress={() => setMenuVisible(true)}
              onPress={handleMenuPress}
          >
              <Ionicons name="ellipsis-horizontal" size={20} />
          </TouchableOpacity>
        </View>

      </View>

      {/* Post media */}
      {post.media?.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={useDoubleTap(() => {
            setCurrentReactingItem({ postId: post.id });
            handleReact("❤️");
          })}
        >
          <Image
            source={{ uri: `${getApiBaseImage()}/storage/${post.media[0].file_path}` }}
            style={styles.media}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}




      {/* Action buttons */}
      <View style={styles.actionBar}>
        {/* Comment button */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowComments(!showComments)}
        >
          <Ionicons 
            name="chatbubble-outline" 
            size={24} 
            color={
              post.comments.some(comment => comment.user_id === user?.id) 
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
          style={styles.actionButton}
          onPress={() => onRepost(post.id)}
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
          onPress={() => onShare(post.id)}
        >
          <Feather name="send" size={24} />
        </TouchableOpacity>
        
        {/* Post reaction bar */}
        {reactionsToShow.map((reaction, idx) => {
          const isMyReaction = reaction.user_ids?.includes(user?.id);
          
          return (
          <TouchableOpacity
            style={styles.reactionBar}
            key={`reaction-${reaction.emoji}-${idx}`} 
            onPress={() => {
              setCurrentReactingItem({ postId: post.id });
              setIsEmojiPickerOpen(true);
            }}
          >
            <View 
              key={idx} 
              style={[
                styles.reactionItem,
                isMyReaction && styles.reactionItemMine
              ]}
            >
              <Text style={styles.reactionEmoji}>
                {reaction.emoji}
              </Text>
              {reaction.count > 0 && (
                <Text style={[
                  styles.reactionCount,
                  isMyReaction && styles.reactionCountMine
                ]}>
                  {reaction.count}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          );
        })}

        {/* Bookmark button */}
        <TouchableOpacity 
          style={[styles.actionButton, { marginLeft: 'auto' }]}
          onPress={() => onBookmark(post.id)}
        >
          <Feather name="bookmark" size={24} />
        </TouchableOpacity>
      </View>

      {/* Comments section */}
      {showComments && (
        <Modal
          visible={showComments}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setIsFullScreen(false)
            setShowComments(false)
          }}
        >
          <TouchableOpacity
            style={styles.commentsBackdrop}
            activeOpacity={1}
            onPress={() => setShowComments(false)}
          />

          <View style={[
            styles.commentsSheet,
            isFullScreen && styles.fullScreenSheet
          ]}>
            <TouchableOpacity 
              style={styles.sheetHandleContainer}
              onPress={() => setIsFullScreen(!isFullScreen)}
            >
              <View style={styles.sheetHandle} />
            </TouchableOpacity>

            {/* Comments List */}
            <ScrollView
              style={styles.commentsList}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {comments.length > 0 ? (
                <FlatList
                  data={comments}
                  renderItem={renderComment}
                  keyExtractor={(comment) => comment.id.toString()}
                  scrollEnabled={false}
                />
              ) : (
                <Text style={styles.noCommentsText}>No comments yet</Text>
              )}
            </ScrollView>

            {/* Comment input */}
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder={
                  replyingTo ? "Replying to comment..." : "Write a comment..."
                }
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={styles.commentSubmitButton}
                // Modify your onCommentSubmit prop usage:
                onPress={submitComment}
                disabled={!commentText.trim()}
              >
                <Text style={styles.commentSubmitText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}


      {/* Emoji Picker */}
      <EmojiPicker
        open={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onEmojiSelected={(emoji) => {
          if (currentReactingComment) {
            handleReactComment(emoji.emoji);
          } else if (currentReactingItem) {
            handleReact(emoji.emoji);
          }
        }}
        emojiSize={28}
        containerStyle={styles.emojiPicker}
      />

      <PostMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onReport={handleReport}
          isOwner={isOwner}
          anchorPosition={menuPosition}
      />

      <ReportPost
          visible={reportVisible}
          postId={post.id}
          onClose={() => setReportVisible(false)}
          onReportSubmitted={handleReportSubmitted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 10,
  },
  infoFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '92%',
  },
  Foto: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
      alignSelf: 'flex-start',

  },
  menuContainer: {
    flexDirection: 'row',
    width: '80%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  username: {
    fontWeight: 'bold',
    fontSize: 14,
    alignSelf: 'flex-start'
  },
  nameCaption: {
    width: '84%'
  },
  caption: {
    padding: 0,
    margin: 0,
    fontSize: 14,
    minWidth: '80%'
  },
  media: {
    width: '100%',
    aspectRatio: 16 / 9, // or 1 for square
  },
  reactionBarContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },


  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 15,
    borderColor: '#e8eaed',
    paddingHorizontal: 6,
    paddingVertical: 4,
    // Add this new property:
    backgroundColor: 'transparent', // Default background
  },
  // Add these new styles:
  reactionItemMine: {
    borderColor: '#10b981', // Green border for your reactions
    backgroundColor: 'rgba(16, 185, 129, 0.1)', // Light green background
  },
  reactionCountMine: {
    color: '#10b981', // Green text for your reaction counts
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
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#65676B',
  },


  commentsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  commentsSheet: {
    // position: 'absolute',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    bottom: 0,
    // left: 0,
    // right: 0,
    height: '66%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 20,
  },
  fullScreenSheet: {
    height: '100%', // Or '100%' if you want truly full screen
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ccc',
  },


  commentsList: {
    // paddingHorizontal: 10,
  },
  noCommentsText: {
    textAlign: 'center',
    padding: 10,
    color: '#888',
  },
  commentContainer: {
    padding: 0,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginBottom: 5,
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
    marginLeft: 40, // Align with text under avatar
  },
  commentButtons : {
    flex: 1,
    flexDirection: 'row',
  },
  commentReactions: {
    marginLeft: 40,
    marginTop: 0,
    marginBottom:5,
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
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight:10,
    // borderTopWidth: 1,
    // borderTopColor: '#eee',
    backgroundColor: 'white',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    padding: 5,
    paddingHorizontal: 10,
    marginRight: 10,
    marginBottom: 10,
  },
  commentSubmitButton: {
    backgroundColor: '#3498db',
    padding: 10,
    borderRadius: 20,
    paddingHorizontal: 15,
  },
  commentSubmitText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emojiPicker: {
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 999,
    position: 'absolute'
  },


  menuButton: {
    // marginLeft: 'auto',
    paddingLeft: 8,
    alignSelf: 'flex-start'
},
  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingBottom: 0,
    backgroundColor: '#f9f9f9',
  },
  repostText: {
    marginLeft: 5,
    fontSize: 12,
    color: '#666',
  },
  activeActionCount: {
    color: '#10b981',
  },
});