// services/PostListService.tsx
import { useState, useRef, useCallback } from 'react';
import { Alert, Platform, NativeSyntheticEvent, NativeTouchEvent, Dimensions } from 'react-native';
import { usePostStore } from '@/stores/postStore';
import { 
  deletePost, 
  reactToPost, 
  reactToComment, 
  deleteReactionFromPost, 
  deleteReactionFromComment, 
  deleteComment,
  commentOnPost
} from '@/services/PostService';
import { useModal } from '@/context/ModalContext';
import { useProfileView } from '@/context/ProfileViewContext';

export interface Comment {
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
  reaction_comments_count?: number;
}

export interface Repost {
  id: number;
  user: {
    id: number;
    name: string;
    profile_photo: string | null;
  };
  created_at: string;
}

export interface Post {
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

export interface Reaction {
  id: number;
  emoji: string;
  user_id: number;
  post_id: number;
  comment_id?: number;
  created_at?: string;
}

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export const usePostListService = (user: any) => {
  const { openModal } = useModal();
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const postStore = usePostStore();
  const { deletePostById, updatePost: updatePostInStore } = postStore;

  // State management
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
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Helper function for reaction counts
  const updateReactionCounts = (
    counts: Array<{ emoji: string; count: number }>,
    emoji: string,
    delta: number
  ): Array<{ emoji: string; count: number }> => {
    const newCounts = [...counts];
    const index = newCounts.findIndex(item => item.emoji === emoji);
    
    if (index >= 0) {
      newCounts[index] = {
        emoji,
        count: Math.max(0, newCounts[index].count + delta)
      };
      
      if (newCounts[index].count <= 0) {
        newCounts.splice(index, 1);
      }
    } else if (delta > 0) {
      newCounts.push({ emoji, count: 1 });
    }
    
    return newCounts;
  };

  // Get reactions to display
  const getGroupedReactions = (post: Post, currentUserId?: number): 
    { emoji: string; count: number; user_ids: number[] }[] => {
    
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
    })).sort((a, b) => b.count - a.count);
  };

  // Get comment reactions
  const getGroupedReactionsComments = (
    comment: Comment, 
    currentUserId?: number
  ): { emoji: string; count: number; user_ids: number[] }[] => {
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

  // Handle post deletion
  const handleDelete = async (postId: number) => {
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

      await deletePost(postId);
      deletePostById(postId);
      setMenuVisible(false);
      
      if (Platform.OS === 'web') {
        alert("Post deleted successfully");
      } else {
        Alert.alert("Success", "Post deleted successfully");
      }
      
    } catch (error: any) {
      console.error('Delete error:', error);
      const errorMessage = error.message || "Could not delete post. Please try again.";
      
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert("Error", errorMessage);
      }
    }
  };

  // Handle post edit
  const handleEdit = (post: Post) => {
    openModal('edit', {
      postId: post.id,
      initialCaption: post.caption,
      initialMedia: post.media,
      onPostCreated: (updatedPost) => {
        updatePostInStore(updatedPost);
        setMenuVisible(false);
      }
    });
    setMenuVisible(false);
  };

  // Handle post report
  const handleReport = () => {
    setMenuVisible(false);
    setReportVisible(true);
  };

  const handleReportSubmitted = () => {
    Alert.alert("Report Submitted", "Thank you for your report. We'll review it shortly.");
  };

  // Handle post reaction
  const handleReact = async (emoji: string, postId: number, commentId?: number) => {
    if (!postId || !user?.id) {
      console.error('Missing reaction data:', { postId, user });
      return;
    }
    
    try {
      const currentPost = postStore.posts.find(p => p.id === postId);
      if (!currentPost) {
        throw new Error(`Post ${postId} not found`);
      }

      const reactionContext = commentId
        ? currentPost.comments?.find(c => c.id === commentId)
        : currentPost;
      
      const existingReaction = reactionContext?.reactions?.find(
        r => r.user_id === user.id
      );

      const response = await reactToPost(postId, emoji, commentId);

      if (!response?.reaction) {
        throw new Error('Invalid API response');
      }

      const updatedPost = { ...currentPost };

      if (commentId) {
        updatedPost.comments = updatedPost.comments?.map(comment => {
          if (comment.id !== commentId) return comment;
          
          const filteredReactions = comment.reactions?.filter(
            r => r.user_id !== user.id
          ) || [];
          
          const updatedReactions = [...filteredReactions, response.reaction];
          
          let updatedCounts = [...(comment.reaction_counts || [])];
          
          if (existingReaction) {
            updatedCounts = updateReactionCounts(
              updatedCounts,
              existingReaction.emoji,
              -1
            );
          }
          
          updatedCounts = updateReactionCounts(updatedCounts, emoji, 1);
          
          return {
            ...comment,
            reactions: updatedReactions,
            reaction_counts: updatedCounts
          };
        });
      } else {
        const filteredReactions = updatedPost.reactions?.filter(
          r => r.user_id !== user.id
        ) || [];
        
        updatedPost.reactions = [...filteredReactions, response.reaction];
        
        let updatedCounts = [...(updatedPost.reaction_counts || [])];
        
        if (existingReaction) {
          updatedCounts = updateReactionCounts(
            updatedCounts,
            existingReaction.emoji,
            -1
          );
        }
        
        updatedPost.reaction_counts = updateReactionCounts(updatedCounts, emoji, 1);
      }

      postStore.updatePost(updatedPost);

    } catch (error) {
      console.error('Reaction failed:', error);
      Alert.alert("Error", "Couldn't process reaction");
    } finally {
      setIsEmojiPickerOpen(false);
    }
  };

  // Handle comment reaction
  const handleReactComment = async (emoji: string, postId: number, commentId: number) => {
    if (!postId || !commentId || !user?.id) {
      console.error('Missing reaction data:', { postId, commentId, user });
      return;
    }

    const { addCommentReaction, removeCommentReaction, updateCommentReactions } = postStore;

    try {
      const post = postStore.posts.find(p => p.id === postId);
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
      setIsEmojiPickerOpen(false);

    } catch (error) {
      console.error('Reaction error:', error);
      Alert.alert("Error", "Failed to save reaction");
    } finally {
      setIsEmojiPickerOpen(false);
    }
  };

  // Delete post reaction
  const deletePostReaction = async (postId: number) => {
    if (!postId || !user?.id) return;

    try {
      const post = postStore.posts.find(p => p.id === postId);
      if (!post) return;

      // Optimistic update
      const updatedPost = {
        ...post,
        reactions: post.reactions?.filter(r => r.user_id !== user.id) || [],
        reaction_counts: post.reaction_counts?.map(rc => ({
          ...rc,
          count: rc.user_id === user.id ? Math.max(0, rc.count - 1) : rc.count
        }))
      };
      
      postStore.updatePost(updatedPost);

      // API call
      const response = await deleteReactionFromPost(postId);
      
      // Update with server data if needed
      if (response.reaction_counts) {
        postStore.updatePost({
          ...updatedPost,
          reaction_counts: response.reaction_counts,
          reactions_count: response.reaction_comments_count
        });
      }
    } catch (error) {
      // Revert on error
      if (post) {
        postStore.updatePost(post);
      }
      console.error('Failed to delete reaction:', error);
    }
  };

  // Delete comment reaction
  const deleteCommentReaction = async (commentId: number, emoji: string) => {
    if (!commentId || !user?.id) return;

    try {
      // Find the post containing this comment
      const post = postStore.posts.find(p => 
        p.comments?.some(c => c.id === commentId)
      );
      
      if (!post) return;

      // Optimistic update
      const updatedPost = {
        ...post,
        comments: post.comments?.map(comment => {
          if (comment.id !== commentId) return comment;
          
          return {
            ...comment,
            reaction_comments: comment.reaction_comments?.filter(
              r => r.user_id !== user.id
            ),
            reaction_comments_count: Math.max(
              0,
              (comment.reaction_comments_count || 0) - 1
            )
          };
        })
      };
      
      postStore.updatePost(updatedPost);

      // API call
      const response = await deleteReactionFromComment(commentId);

      postStore.removeCommentReaction(
        post.id,
        commentId,
        user.id,
        response.reaction_counts,
        response.reaction_comments_count
      );
      
    } catch (error) {
      // Revert on error
      const post = postStore.posts.find(p => 
        p.comments?.some(c => c.id === commentId)
      );
      if (post) {
        postStore.updatePost(post);
      }
      console.error('Failed to delete comment reaction:', error);
    }
  };

  // Delete comment
  const handleDeleteComment = async (postId: number, commentId: number) => {
    try {
      // Optimistic update
      postStore.removeComment(postId, commentId);
      
      // API call
      await deleteComment(postId, commentId);
      
      // Optional: show success message
      Alert.alert('Success', 'Comment deleted successfully');
    } catch (error: any) {
      // Revert on error
      const post = postStore.posts.find(p => p.id === postId);
      if (post) {
        postStore.updatePost(post);
      }
      
      // Show error message
      Alert.alert(
        'Error', 
        error.response?.data?.error || 
        error.message || 
        'Failed to delete comment'
      );
      
      console.error('Failed to delete comment:', error);
    }
  };

  // Double tap handler
  const useDoubleTap = (onDoubleTap: () => void, onSingleTap: () => void = () => {}) => {
    const lastTap = useRef(0);
    
    return () => {
      const now = Date.now();
      if (lastTap.current && now - lastTap.current < 300) {
        onDoubleTap();
        lastTap.current = 0;
      } else {
        onSingleTap();
        lastTap.current = now;
      }
    };
  };

  // Media viewer functions
  const openMediaViewer = (index: number) => {
    setMediaViewerIndex(index);
    setMediaViewerVisible(true);
  };

  const handleCloseViewer = useCallback(() => {
    setMediaViewerVisible(false);
  }, []);

  const findAdjacentPostWithMedia = useCallback((direction: 'next' | 'prev', posts: Post[], currentPostId: number) => {
    const currentIndex = posts.findIndex(p => p.id === currentPostId);
    if (currentIndex === -1) return null;

    const increment = direction === 'next' ? 1 : -1;
    let newIndex = currentIndex + increment;

    while (newIndex >= 0 && newIndex < posts.length) {
      if (posts[newIndex]?.media?.length > 0) {
        return posts[newIndex];
      }
      newIndex += increment;
    }
    return null;
  }, []);

  const handleNavigateNextPost = useCallback((posts: Post[], currentPostId: number) => {
    const nextPost = findAdjacentPostWithMedia('next', posts, currentPostId);
    if (nextPost) {
      handleCloseViewer();
      // Implement navigation logic
      console.log('Navigate to next post:', nextPost.id);
    }
  }, [findAdjacentPostWithMedia, handleCloseViewer]);

  const handleNavigatePrevPost = useCallback((posts: Post[], currentPostId: number) => {
    const prevPost = findAdjacentPostWithMedia('prev', posts, currentPostId);
    if (prevPost) {
      handleCloseViewer();
      // Implement navigation logic
      console.log('Navigate to previous post:', prevPost.id);
    }
  }, [findAdjacentPostWithMedia, handleCloseViewer]);

  // Menu handler
  const handleMenuPress = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    setMenuVisible(true);
    setMenuPosition({
      top: event.nativeEvent.pageY,
      left: event.nativeEvent.pageX,
    });
  };

  // Submit comment
  const submitComment = async (postId: number, onCommentSubmit: Function) => {
    if (!commentText.trim()) return;
    // console.log(postId, commentText, onCommentSubmit)
    
    try {
      const comment = await onCommentSubmit(
        postId, 
        commentText, 
        replyingTo || undefined
      );
      console.warn(comment)

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

      // console.log(formattedComment)
      
      // Update the store
      postStore.updatePostWithNewComment(postId, formattedComment);
      
      // Reset form
      setCommentText('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Full error details:', {
        err,
        postId,
        commentText,
        replyingTo,
        user: user?.id
      });
      Alert.alert("Error", "Failed to post comment");
    }
  };

  // Sort media for display
  const sortMedia = (media: any[]) => {
    return media?.sort((a, b) => (a.type === 'video' ? -1 : 1)) || [];
  };

  // Check if user is owner
  const isOwner = (postUserId: number | string) => {
    return user?.id === postUserId;
  };

  return {
    // State
    showComments,
    setShowComments,
    commentText,
    setCommentText,
    replyingTo,
    setReplyingTo,
    isEmojiPickerOpen,
    setIsEmojiPickerOpen,
    currentReactingItem,
    setCurrentReactingItem,
    currentReactingComment,
    setCurrentReactingComment,
    menuPosition,
    setMenuPosition,
    menuVisible,
    setMenuVisible,
    reportVisible,
    setReportVisible,
    mediaViewerVisible,
    setMediaViewerVisible,
    mediaViewerIndex,
    setMediaViewerIndex,
    isFullScreen,
    setIsFullScreen,

    // Functions
    handleDelete,
    handleEdit,
    handleReport,
    handleReportSubmitted,
    handleReact,
    handleReactComment,
    deletePostReaction,
    deleteCommentReaction,
    handleDeleteComment,
    getGroupedReactions,
    getGroupedReactionsComments,
    updateReactionCounts,
    useDoubleTap,
    openMediaViewer,
    handleCloseViewer,
    handleNavigateNextPost,
    handleNavigatePrevPost,
    handleMenuPress,
    submitComment,
    sortMedia,
    isOwner,
    setProfileViewUserId,
    setProfilePreviewVisible,

    // Expose the postStore directly
    // postStore,
    // Constants
    width,
    isWeb
  };
};

// Helper function to update comment in tree (for Zustand store)
export const updateCommentInTree = (
  comments: Comment[],
  commentId: number,
  updater: (comment: Comment) => Comment
): Comment[] => {
  return comments.map(comment => {
    // Apply updater to matching comment
    if (comment.id === commentId) {
      return updater(comment);
    }
    
    // Recursively process replies if they exist
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: updateCommentInTree(comment.replies, commentId, updater)
      };
    }
    
    return comment;
  });
};

// Helper function to add reply to comment
export const addReplyToComment = (comments: Comment[], newComment: Comment): Comment[] => {
  return comments.map(comment => {
    if (comment.id === newComment.parent_id) {
      return {
        ...comment,
        replies: [...(comment.replies || []), newComment]
      };
    }
    
    if (comment.replies) {
      return {
        ...comment,
        replies: addReplyToComment(comment.replies, newComment)
      };
    }
    
    return comment;
  });
};