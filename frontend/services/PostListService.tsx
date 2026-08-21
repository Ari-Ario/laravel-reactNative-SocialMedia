// services/PostListService.tsx
import { useState, useRef, useCallback } from 'react';
import { Platform, Alert, NativeSyntheticEvent, NativeTouchEvent, Dimensions } from 'react-native';
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
import { calculateAnchorPosition, AnchorPosition } from '@/utils/layout';

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
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [currentReactingItem, setCurrentReactingItem] = useState<{
    postId: number;
    commentId?: number;
  } | null>(null);
  const [currentReactingComment, setCurrentReactingComment] = useState<{
    commentId?: number;
    postId: number;
  } | null>(null);
  const [menuPosition, setMenuPosition] = useState<AnchorPosition>();
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

// Move heavy computation helpers outside to prevent re-creation
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

const getGroupedReactions = (post: Post, currentUserId?: number): { emoji: string; count: number; user_ids: number[] }[] => {
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
  const handleDelete = useCallback(async (postId: number) => {
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
  }, [deletePostById, showToast]);

  // Handle post edit
  const handleEdit = useCallback((post: Post) => {
    // 🛡️ SECURITY: Always pull the ABSOLUTE LATEST data from the store
    // This prevents "ghost data" if the list item was stale
    const latestPost = postStore.posts.find(p => p.id === post.id) || post;

    openModal('edit', {
      postId: latestPost.id,
      initialCaption: latestPost.caption,
      initialMedia: latestPost.media,
      initialLocation: latestPost.location,
      onPostCreated: (updatedPost: Post) => {
        updatePostInStore(updatedPost as any);
        setMenuVisible(false);
      }
    });
    setMenuVisible(false);
  }, [openModal, updatePostInStore, postStore.posts]);

  // Handle post report
  const handleReport = useCallback(() => {
    setMenuVisible(false);
    setReportVisible(true);
  }, []);

  const handleReportSubmitted = useCallback(() => {
    showToast("Report Submitted: Thank you for your report. We'll review it shortly.", "success");
  }, [showToast]);

  // Handle post reaction
  const handleReact = useCallback(async (emoji: string, postId: number, commentId?: number) => {
    if (!postId || !user?.id) {
      console.error('Missing reaction data:', { postId, user });
      return;
    }

    try {
      const currentPost = postStore.posts.find(p => p.id === postId);
      if (!currentPost) {
        throw new Error(`Post ${postId} not found`);
      }

      // 1. Identify existing reaction for swapping
      const reactionContext = commentId
        ? currentPost.comments?.find((c: any) => Number(c.id) === Number(commentId))
        : currentPost;

      const userId = Number(user.id);
      const existingReaction = reactionContext?.reactions?.find(
        (r: any) => Number(r.user_id) === userId
      ) || reactionContext?.reaction_comments?.find(
        (r: any) => Number(r.user_id) === userId
      );

      // 2. Call API
      const response = await reactToPost(postId, emoji, commentId);

      if (!response?.reaction) {
        throw new Error('Invalid API response');
      }

      // 3. Update Store Optimistically/Sync
      const updatedPost = { ...currentPost };

      if (commentId) {
        updatedPost.comments = updatedPost.comments?.map((comment: any) => {
          if (Number(comment.id) !== Number(commentId)) return comment;

          const filteredReactions = comment.reactions?.filter(
            (r: any) => Number(r.user_id) !== userId
          ) || comment.reaction_comments?.filter(
            (r: any) => Number(r.user_id) !== userId
          ) || [];

          const updatedReactions = [...filteredReactions, response.reaction];
          let updatedCounts = [...(comment.reaction_counts || [])];

          if (existingReaction) {
            updatedCounts = updateReactionCounts(updatedCounts, existingReaction.emoji, -1);
          }
          updatedCounts = updateReactionCounts(updatedCounts, emoji, 1);

          return {
            ...comment,
            reactions: updatedReactions,
            reaction_comments: updatedReactions, // Sync both field names for compatibility
            reaction_counts: updatedCounts,
            reactions_count: updatedReactions.length
          };
        });
      } else {
        const filteredReactions = updatedPost.reactions?.filter(
          (r: any) => Number(r.user_id) !== userId
        ) || [];

        updatedPost.reactions = [...filteredReactions, response.reaction];
        let updatedCounts = [...(updatedPost.reaction_counts || [])];

        if (existingReaction) {
          updatedCounts = updateReactionCounts(updatedCounts, existingReaction.emoji, -1);
        }
        updatedPost.reaction_counts = updateReactionCounts(updatedCounts, emoji, 1);
      }

      postStore.updatePost(updatedPost as any);

    } catch (error) {
      console.error('Reaction failed:', error);
      showToast("Couldn't process reaction", "error");
    } finally {
      setIsEmojiPickerOpen(false);
    }
  }, [user, postStore, showToast]);

  // Handle comment reaction
  const handleReactComment = useCallback(async (emoji: string, postId: number, commentId: number) => {
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
  }, [user, postStore, showToast]);

  // Delete post reaction
  const deletePostReaction = useCallback(async (postId: number) => {
    if (!postId || !user?.id) return;
    const targetPost = postStore.posts.find(p => p.id === Number(postId));

    try {
      console.log(`🗑️ Optimistically removing reaction from post ${postId}`);

      // 1. Optimistic update
      postStore.removePostReaction(postId, { userId: user.id });

      // 2. API call
      const response = await deleteReactionFromPost(postId);

      // 3. Final sync with server data
      if (response && response.reaction_counts) {
        postStore.updatePost({
          id: postId,
          reaction_counts: response.reaction_counts,
          reactions_count: (response as any).reaction_comments_count
        } as any);
      }
    } catch (error) {
      console.error('Failed to delete reaction:', error);
      // FULL REVERT on error
      if (targetPost) {
        postStore.updatePost(targetPost as any);
      }
      showToast("Failed to remove reaction", "error");
    }
  }, [user, postStore, showToast]);

  // Delete comment reaction
  const deleteCommentReaction = useCallback(async (commentId: number, emoji: string) => {
    if (!commentId || !user?.id) return;

    // Find the post containing this comment for reversion
    const pId = postStore.posts.find(p =>
      p.comments?.some(c => c.id === Number(commentId))
    )?.id;

    if (!pId) return;
    const targetPost = postStore.posts.find(p => p.id === pId);

    try {
      console.log(`🗑️ Optimistically removing reaction from comment ${commentId}`);

      // 1. Optimistic update
      postStore.removeCommentReaction(pId, commentId, user.id);

      // 2. API call
      const response = await deleteReactionFromComment(commentId);

      // 3. Final sync with server data
      if (response) {
        postStore.removeCommentReaction(
          pId,
          commentId,
          user.id,
          (response as any).reaction_counts,
          (response as any).reaction_comments_count
        );
      }

    } catch (error) {
      console.error('Failed to delete comment reaction:', error);
      // Revert on error
      if (targetPost) {
        postStore.updatePost(targetPost as any);
      }
      showToast("Failed to remove reaction", "error");
    }
  }, [user, postStore, showToast]);

  // Delete comment
  const handleDeleteComment = useCallback(async (postId: number, commentId: number) => {
    // Capture state for manual reversion if needed
    const postToRevert = postStore.posts.find(p => p.id === Number(postId));
    const previousComments = postToRevert ? [...(postToRevert.comments || [])] : [];
    const previousCount = postToRevert?.comments_count || 0;

    try {
      console.log(`🗑️ Optimistically removing comment ${commentId} from post ${postId}`);

      // 1. Optimistic update (Immediate removal for user)
      postStore.removeComment(postId, commentId);

      // 2. API call
      const response = await deleteComment(postId, commentId);

      // 3. Post-success sync (Device A specific)
      // The user wants to be ABSOLUTELY sure it's gone after success.
      // Since removeComment is idempotent, calling it again ensures certainty.
      if (response?.success) {
        console.log(`✅ Server confirmed deletion of comment ${commentId}`);
        showToast('Comment deleted successfully', 'success');
      } else {
        throw new Error('Server returned unsuccessful response');
      }

    } catch (error: any) {
      console.error('❌ Failed to delete comment:', error);

      // FULL REVERT on error
      if (postToRevert) {
        console.log('🔄 Reverting comment deletion due to error');
        postStore.updatePost({
          ...postToRevert,
          comments: previousComments,
          comments_count: previousCount
        } as any);
      }

      showToast(
        error.message || 'Failed to delete comment',
        'error'
      );
    }
  }, [postStore, showToast]);

  // Double tap handler
  const useDoubleTap = (onDoubleTap: () => void, onSingleTap: () => void = () => { }) => {
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
      if ((posts[newIndex]?.media?.length ?? 0) > 0) {
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
  const handleMenuPress = (event: any, ref?: React.RefObject<any>) => {
    const { pageX, pageY } = event.nativeEvent;
    
    if (ref?.current) {
      ref.current.measure((x: number, y: number, width: number, height: number, px: number, py: number) => {
        // Use touch coordinates (pageX/pageY) as the anchor point with 0 width/height 
        // to ensure it appears exactly where the user long-pressed, but still benefit from horizontal clamping
      const anchor = calculateAnchorPosition(pageX || px, pageY || py, 0, 0, 220);
        setMenuPosition(anchor);
        setMenuVisible(true);
      });
    } else {
      // Fallback if no ref
      const anchor = calculateAnchorPosition(pageX - 110, pageY, 220, 0, 220);
      setMenuPosition(anchor);
      setMenuVisible(true);
    }
  };

  // Submit comment
  const submitComment = useCallback(async (postId: number, onCommentSubmit: Function) => {
    if (!commentText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    // console.log('Submitting comment:', { postId, commentText, replyingTo, user });

    try {
      const comment = await onCommentSubmit(
        postId,
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
        reaction_counts: [],
        reactions: [],
        reaction_comments: [],
        reaction_comments_count: 0
      };

      // Update the store
      postStore.updatePostWithNewComment(postId, formattedComment);

      // Reset form
      setCommentText('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Full error details:', err);
      showToast("Failed to post comment", "error");
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentText, isSubmittingComment, replyingTo, postStore, showToast]);

  // Sort media for display
  const sortMedia = useCallback((media: any[]) => {
    if (!media) return { visualMedia: [], extraMedia: [] };
    
    const visualMedia = media.filter(m => m.type === 'image' || m.type === 'video')
      .sort((a, b) => (a.type === 'video' ? -1 : 1));
      
    const extraMedia = media.filter(m => m.type !== 'image' && m.type !== 'video');
    
    return { visualMedia, extraMedia };
  }, []);

  // Check if user is owner
  const isOwner = useCallback((postUserId: number | string) => {
    if (!user?.id || !postUserId) return false;
    return String(user.id) === String(postUserId);
  }, [user?.id]);

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
    isSubmittingComment,
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