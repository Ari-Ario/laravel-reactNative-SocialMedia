// services/PostListService.tsx
import { useState, useRef, useCallback } from 'react';
import { Alert, Platform, NativeSyntheticEvent, NativeTouchEvent, Dimensions } from 'react-native';
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
import { useToastStore } from '@/stores/toastStore';
import { usePostStore, Post, Comment, Reaction } from '@/stores/postStore';

export interface Repost {
  id: number;
  user: {
    id: number;
    name: string;
    profile_photo: string | null;
  };
  created_at: string;
  context_tag?: string;
  personal_note?: string;
  collection_id?: number;
}

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export const usePostListService = (user: any) => {
  const { openModal } = useModal();
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const postStore = usePostStore();
  const { showToast } = useToastStore();
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
      
      showToast("Post deleted successfully", "success");
      
    } catch (error: any) {
      console.error('Delete error:', error);
      const errorMessage = error.message || "Could not delete post. Please try again.";
      showToast(errorMessage, "error");
    }
  };

  // Handle post edit
  const handleEdit = (post: Post) => {
    openModal('edit', {
      postId: post.id,
      initialCaption: post.caption,
      initialMedia: post.media,
      onPostCreated: (updatedPost: Post) => {
        updatePostInStore(updatedPost as any);
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
    showToast("Report Submitted: Thank you for your report. We'll review it shortly.", "success");
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
        ? currentPost.comments?.find((c: any) => c.id === commentId)
        : currentPost;
      
      const existingReaction = reactionContext?.reactions?.find(
        (r: any) => r.user_id === user.id
      );

      const response = await reactToPost(postId, emoji, commentId);

      if (!response?.reaction) {
        throw new Error('Invalid API response');
      }

      const updatedPost = { ...currentPost };

      if (commentId) {
        updatedPost.comments = updatedPost.comments?.map((comment: any) => {
          if (comment.id !== commentId) return comment;
          
          const filteredReactions = comment.reactions?.filter(
            (r: any) => r.user_id !== user.id
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
          (r: any) => r.user_id !== user.id
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
      showToast("Couldn't process reaction", "error");
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
          (response as any).reaction_counts ?? null
        );
      }
      setIsEmojiPickerOpen(false);

    } catch (error) {
      console.error('Reaction error:', error);
      showToast("Failed to save reaction", "error");
    } finally {
      setIsEmojiPickerOpen(false);
    }
  };

  // Delete post reaction
  const deletePostReaction = async (postId: number) => {
    if (!postId || !user?.id) return;
    let targetPost: Post | undefined;

    try {
      targetPost = postStore.posts.find(p => p.id === postId);
      if (!targetPost) return;

      // Optimistic update
      const updatedPost = {
        ...targetPost,
        reactions: targetPost.reactions?.filter((r: any) => r.user_id !== user.id) || [],
        reaction_counts: targetPost.reaction_counts?.map((rc: any) => ({
          ...rc,
          count: rc.user_id === user.id ? Math.max(0, rc.count - 1) : rc.count
        }))
      };
      
      postStore.updatePost(updatedPost as any);

      // API call
      const response = await deleteReactionFromPost(postId);
      
      // Update with server data if needed
      if ((response as any).reaction_counts) {
        postStore.updatePost({
          ...updatedPost,
          reaction_counts: (response as any).reaction_counts,
          reactions_count: (response as any).reaction_comments_count
        } as any);
      }
    } catch (error) {
      // Revert on error
      if (targetPost) {
        postStore.updatePost(targetPost as any);
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
        comments: post.comments?.map((comment: any) => {
          if (comment.id !== commentId) return comment;
          
          return {
            ...comment,
            reaction_comments: comment.reaction_comments?.filter(
              (r: any) => r.user_id !== user.id
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
        (response as any).reaction_counts,
        (response as any).reaction_comments_count
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
      // Find the comment first for reversion if needed
      const postBeforeDelete = postStore.posts.find(p => p.id === postId);
      
      // Optimistic update
      postStore.removeComment(postId, commentId);
      
      // API call
      await deleteComment(postId, commentId);
      
      // Optional: show success message
      showToast('Comment deleted successfully', 'success');
    } catch (error: any) {
      // Revert on error
      const postToRevert = postStore.posts.find(p => p.id === postId);
      if (postToRevert) {
        postStore.updatePost(postToRevert);
      }
      
      // Show error message
      showToast(
        error.response?.data?.error || 
        error.message || 
        'Failed to delete comment',
        'error'
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
    // console.log('Submitting comment:', { postId, commentText, replyingTo, user });
    
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
        reaction_counts: [],
        reactions: []
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
      showToast("Failed to post comment", "error");
    }
  };

  // Sort media for display
  const sortMedia = (media: any[]) => {
    return media?.sort((a, b) => (a.type === 'video' ? -1 : 1)) || [];
  };

  // Check if user is owner
  const isOwner = (postUserId: number | string) => {
    if (!user?.id || !postUserId) return false;
    return String(user.id) === String(postUserId);
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