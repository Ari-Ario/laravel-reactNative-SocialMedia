import { create } from 'zustand';
import PusherService from '@/services/PusherService'; // Add this import

interface Reaction {
  id: number;
  emoji: string;
  user_id: number;
  post_id: number;
  comment_id?: number;
}

interface CommentReaction {
  id: number;
  user_id: number;
  comment_id: number;
  Reaction: string;
  created_at?: string;
  updated_at?: string;
}

interface Comment {
  reactions: any;
  id: number;
  content: string;
  user_id: number;
  user: {
    id: number;
    name: string;
    profile_photo: string | null;
  };
  post_id: number;
  parent_id?: number;
  replies?: Comment[];
  reaction_counts?: Array<{
    emoji: string;
    count: number;
  }>;
}

interface Post {
  id: number;
  [key: string]: any;
  reactions?: Reaction[];
  comments?: Comment[];
  reaction_counts?: Array<{
    emoji: string;
    count: number;
  }>;
}

interface PostStore {
  posts: Post[];
  setPosts: (posts: Post[]) => void;
  updatePost: (updatedPost: Post) => void;
  addPost: (newPost: Post) => void;
  deletePostById: (postId: number) => void;
  
  // Reactions
  addPostReaction: (postId: number, reaction: Reaction) => void;
  removePostReaction: (postId: number, reactionId: number) => void;
  
  // Comments
  addPostComment: (postId: number, comment: Comment) => void;
  updatePostWithNewComment: (postId: number, comment: Comment) => void;
  
  // Add internal subscription management
  subscribeToPostInternal: (postId: number) => void;
  unsubscribeFromPostInternal: (postId: number) => void;

  updateCommentReactions: (
    postId: number,
    commentId: number,
    newReaction: Reaction,
    counts?: number | null
  ) => void;

  addCommentReaction: (
    postId: string | number,
    commentId: string | number,
    userId: string | number,
    emoji: string
  ) => void;

  removeCommentReaction: (
    postId: string | number,
    commentId: string | number,
    userId: string | number
  ) => void;

  updateCommentWithServerData: (
    postId: string | number,
    commentId: string | number,
    serverComment: Comment
  ) => void;

  // NEW: Real-time methods (add these to your existing interface)
  initializeRealtime: (token: string) => void;
  subscribeToPost: (postId: number) => void;
  unsubscribeFromPost: (postId: number) => void;
  disconnectRealtime: () => void;
  handleNewComment: (data: { comment: any; postId: number }) => void;
  handleNewReaction: (data: { reaction: any; postId: number }) => void;
}

export const usePostStore = create<PostStore>((set, get) => ({
  posts: [],

  // Basic post operations (UNCHANGED)
  setPosts: (posts) => set({ posts }),
  
  updatePost: (updatedPost) => {
    if (!updatedPost?.id) return;
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === updatedPost.id ? { ...p, ...updatedPost } : p
      ),
    }));
  },
  
  addPost: (newPost) => set((state) => ({
    posts: [newPost, ...state.posts],
  })),
    
  deletePostById: (postId) => set((state) => ({
    posts: state.posts.filter((p) => p.id !== postId),
  })),

  // Reaction operations (UNCHANGED)
  addPostReaction: (postId, reaction) => {
    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;
        
        const existingReactions = post.reactions || [];
        const alreadyReacted = existingReactions.some(
          (r) => r.user_id === reaction.user_id && r.emoji === reaction.emoji
        );
        
        if (alreadyReacted) return post;
        
        return {
          ...post,
          reactions: [...existingReactions, reaction],
          reaction_counts: updateReactionCounts(post.reaction_counts || [], reaction.emoji, 1)
        };
      }),
    }));
  },
  
  removePostReaction: (postId, reactionId) => {
    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;
        
        const reactionToRemove = post.reactions?.find(r => r.id === reactionId);
        if (!reactionToRemove) return post;
        
        return {
          ...post,
          reactions: post.reactions?.filter(r => r.id !== reactionId),
          reaction_counts: updateReactionCounts(
            post.reaction_counts || [], 
            reactionToRemove.emoji, 
            -1
          )
        };
      }),
    }));
  },
  
  // Comment reaction functions (UNCHANGED)
  addCommentReaction: (postId, commentId, userId, emoji) => set((state) => {
    const postIndex = state.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
      console.warn(`Post ${postId} not found in store`);
      return state;
    }

    return {
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;
        
        const updater = (comment: Comment) => {
          const hasExistingReaction = comment.reaction_comments?.some(
            (r: any) => r.user_id === userId && r.emoji === emoji
          );
          
          if (hasExistingReaction) return comment;
          
          const tempReaction = {
            id: 1000000 + Date.now(),
            user_id: userId,
            comment_id: commentId,
            emoji,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const filteredReactions = comment.reaction_comments?.filter(
            (r: any) => r.user_id !== userId
          ) || [];
          
          return {
            ...comment,
            reaction_comments: [...filteredReactions, tempReaction],
            reaction_comments_count: (comment.reaction_comments_count || 0) + 1
          };
        };

        return {
          ...post,
          comments: updateCommentInTree(post.comments, commentId, updater)
        };
      })
    };
  }),

  updateCommentReactions: (postId, commentId, newReaction, counts = null) =>
    set((state) => {
      const postIndex = state.posts.findIndex((p) => p.id === postId);
      if (postIndex === -1) {
        console.warn(`Post ${postId} not found when updating comment reactions`);
        return state;
      }

      return {
        posts: state.posts.map((post) => {
          if (post.id !== postId) return post;

          const updater = (comment: Comment) => {
            const filtered = (comment.reaction_comments || []).filter(
              (r: any) => r.user_id !== newReaction.user_id
            );

            return {
              ...comment,
              reaction_comments: [...filtered, newReaction],
              reaction_comments_count: counts ?? comment.reaction_comments_count,
            };
          };

          return {
            ...post,
            comments: updateCommentInTree(post.comments, commentId, updater)
          };
        }),
      };
    }),

  removeCommentReaction: (postId, commentId, userId, updatedCounts = [], updatedCountNumber = null) => set((state) => {
    const postIndex = state.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return state;

    return {
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;

        const updater = (comment: Comment) => {
          const filteredReactions = comment.reaction_comments?.filter(
            (r: any) => r.user_id !== userId
          ) || [];

          return {
            ...comment,
            reaction_comments: filteredReactions,
            reaction_counts: updatedCounts,
            reaction_comments_count: updatedCountNumber ?? filteredReactions.length
          };
        };

        return {
          ...post,
          comments: updateCommentInTree(post.comments, commentId, updater)
        };
      })
    };
  }),
  
  // Comment operations (UNCHANGED)
  addPostComment: (postId, comment) => {
    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;
        
        const newComments = comment.parent_id
          ? addReplyToComment(post.comments || [], comment)
          : [...(post.comments || []), comment];
        
        return {
          ...post,
          comments: newComments,
          comments_count: (post.comments_count || 0) + 1
        };
      }),
    }));
  },
  
  updatePostWithNewComment: (postId, comment) => {
    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;
        
        const currentComments = post.comments || [];
        
        if (comment.parent_id) {
          return {
            ...post,
            comments: addReplyToComment(currentComments, comment),
            comments_count: post.comments_count
          };
        }
        
        return {
          ...post,
          comments: [...currentComments, comment],
          comments_count: (post.comments_count || 0) + 1
        };
      }),
    }));
  },

  updateCommentWithServerData: (postId, commentId, serverComment) => set((state) => {
    const postIndex = state.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return state;

    const ensureReactions = (comment: Comment) => ({
      ...comment,
      reaction_comments: comment.reaction_comments || [],
      replies: comment.replies?.map(ensureReactions) || []
    });

    return {
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;
        
        return {
          ...post,
          comments: post.comments?.map(comment => {
            if (comment.id !== commentId) return comment;
            return ensureReactions(serverComment);
          }) ?? [ensureReactions(serverComment)]
        };
      })
    };
  }),

  removeComment: (postId: number, commentId: number) => set((state) => {
    const postIndex = state.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return state;

    const removeCommentAndReplies = (comments: Comment[]): Comment[] => {
      return comments
        .filter(comment => comment.id !== commentId)
        .map(comment => ({
          ...comment,
          replies: removeCommentAndReplies(comment.replies || [])
        }));
    };

    return {
      posts: state.posts.map(post => {
        if (post.id !== postId) return post;
        
        const updatedComments = removeCommentAndReplies(post.comments || []);
        
        return {
          ...post,
          comments: updatedComments,
        };
      })
    };
  }),

  // NEW: Real-time methods (ADD THESE AT THE END)
  initializeRealtime: (token: string) => {
    console.log('🔄 Initializing real-time connection...');
    PusherService.initialize(token);
  },
  
  subscribeToPostInternal: (postId: number) => {
    if (!PusherService.isReady()) {
      console.warn('⚠️ Pusher not ready, delaying subscription to post:', postId);
      setTimeout(() => {
        get().subscribeToPostInternal(postId);
      }, 1000);
      return;
    }
    
    console.log(`🔄 Store subscribing to post ${postId} with internal callbacks`);
    
    // Create stable callbacks that use store methods
    const handleNewComment = (data: any) => {
      console.log('📝 Pusher → Store handling new comment:', data);
      get().handleNewComment(data);
    };
    
    const handleNewReaction = (data: any) => {
      console.log('❤️ Pusher → Store handling new reaction:', data);
      get().handleNewReaction(data);
    };
    
    // DEBUG: Verify callbacks are functions
    console.log('🔧 Callback check:', {
      onNewCommentType: typeof handleNewComment,
      onNewReactionType: typeof handleNewReaction
    });
    
    // Subscribe with the stable callbacks
    PusherService.subscribeToPost(postId, handleNewComment, handleNewReaction);
  },
  
  unsubscribeFromPostInternal: (postId: number) => {
    console.log(`🔄 Store unsubscribing from post ${postId}`);
    PusherService.unsubscribeFromPost(postId);
  },
  
  // Your existing handlers (these work fine)
handleNewComment: (data) => {
  const { posts } = get();
  const updatedPosts = posts.map(post => {
    if (post.id === data.postId) {
      const existingComments = post.comments || [];

      // 🔍 Check if comment already exists (by ID)
      const alreadyExists = existingComments.some(c => c.id === data.comment.id);

      if (alreadyExists) {
        console.log('🔄 Comment already exists, skipping duplicate:', data.comment.id);
        return post; // return unchanged
      }

      return {
        ...post,
        comments: [...existingComments, data.comment],
        comments_count: (post.comments_count || 0) + 1
      };
    }
    return post;
  });
  set({ posts: updatedPosts });
  console.log('✅ Comment added to store via real-time');
},

  
handleNewReaction: (data) => {
  const { posts } = get();
  const updatedPosts = posts.map(post => {
    if (post.id === data.postId) {
      const existingReactions = post.reactions || [];
      
      // ✅ CHECK FOR DUPLICATES BEFORE ADDING
      const reactionAlreadyExists = existingReactions.some(
        (r: any) => r.id === data.reaction.id
      );
      
      if (reactionAlreadyExists) {
        console.log('🔄 Reaction already exists, skipping duplicate:', data.reaction.id);
        return post; // Return unchanged post
      }
      
      const alreadyReacted = existingReactions.some(
        (r: any) => r.user_id === data.reaction.user_id && r.emoji === data.reaction.emoji
      );
      
      if (!alreadyReacted) {
        console.log('✅ Adding new reaction to store:', data.reaction.id);
        return {
          ...post,
          reactions: [...existingReactions, data.reaction],
          reaction_counts: updateReactionCounts(post.reaction_counts || [], data.reaction.emoji, 1)
        };
      }
    }
    return post;
  });
  set({ posts: updatedPosts });
},

  
  disconnectRealtime: () => {
    console.log('🔄 Disconnecting real-time...');
    PusherService.disconnect();
  },
  
}));

// Helper functions (UNCHANGED)
function updateReactionCounts(
  counts: Array<{ emoji: string; count: number }>,
  emoji: string,
  delta: number
) {
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
}

function addReplyToComment(comments: Comment[], newComment: Comment): Comment[] {
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
}

const updateCommentInTree = (
  comments: Comment[],
  commentId: number,
  updater: (comment: Comment) => Comment
): Comment[] => {
  return comments.map(comment => {
    if (comment.id === commentId) {
      return updater(comment);
    }
    
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: updateCommentInTree(comment.replies, commentId, updater)
      };
    }
    
    return comment;
  });
};