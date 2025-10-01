// stores/postStore.tsx
import { create } from 'zustand';
import PusherService from '@/services/PusherService';

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
  subscribedPostIds: number[]; // Track which posts we're subscribed to
  
  // Basic operations
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
  removeComment: (postId: number, commentId: number) => void; // ADDED TO INTERFACE

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

  // Real-time methods - FIXED INTERFACE
  initializeRealtime: (token: string) => void;
  subscribeToPost: (postId: number) => void; // FIXED: This was missing implementation
  unsubscribeFromPost: (postId: number) => void;
  subscribeToPosts: (postIds: number[]) => void; // NEW: For global channel approach
  unsubscribeFromAllPosts: () => void; // NEW
  disconnectRealtime: () => void;
  handleNewComment: (data: { comment: any; postId: number }) => void;
  handleNewReaction: (data: { reaction: any; postId: number }) => void;
  handleCommentDeleted: (data: { commentId: number; postId: number }) => void;
  handleReactionDeleted: (data: { reactionId: number; postId: number }) => void;
}

export const usePostStore = create<PostStore>((set, get) => ({
  posts: [],
  subscribedPostIds: [], // Track subscriptions

  // Basic post operations
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

  // Reaction operations
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
  
  // Comment reaction functions
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
  
  // Comment operations
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

  removeComment: (postId, commentId) => set((state) => {
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

  // REAL-TIME METHODS - FIXED AND ENHANCED
  initializeRealtime: (token: string) => {
    console.log('🔄 Initializing real-time connection...');
    PusherService.initialize(token);
  },
  
  // OPTION A: Individual post subscriptions (if using individual channels)
  subscribeToPost: (postId: number) => {
    if (!PusherService.isReady()) {
      console.warn('⚠️ Pusher not ready, delaying subscription to post:', postId);
      setTimeout(() => {
        get().subscribeToPost(postId);
      }, 1000);
      return;
    }
    
    console.log(`🔄 Subscribing to individual post ${postId}`);
    
    const handleNewComment = (data: any) => {
      console.log('📝 Individual post comment received:', data);
      get().handleNewComment(data);
    };
    
    const handleNewReaction = (data: any) => {
      console.log('❤️ Individual post reaction received:', data);
      get().handleNewReaction(data);
    };
    
    // Use individual post subscription
    PusherService.subscribeToIndividualPost(postId, handleNewComment, handleNewReaction);
    
    // Track subscription
    set((state) => ({
      subscribedPostIds: [...state.subscribedPostIds, postId]
    }));
  },
  
  // OPTION B: Global channel approach (if using posts.global)
  subscribeToPosts: (postIds: number[]) => {
    if (!PusherService.isReady()) {
      console.warn('⚠️ Pusher not ready, delaying global subscription');
      setTimeout(() => {
        get().subscribeToPosts(postIds);
      }, 1000);
      return;
    }
    
    console.log(`🔄 Subscribing to ${postIds.length} posts via global channel`);
    
    const handleNewComment = (data: any) => {
      console.log('📝 Global channel comment received:', data);
      get().handleNewComment(data);
    };
    
    const handleNewReaction = (data: any) => {
      console.log('❤️ Global channel reaction received:', data);
      get().handleNewReaction(data);
    };
    
    // Use global posts subscription
    PusherService.subscribeToPosts(postIds, handleNewComment, handleNewReaction);
  },
  
  // SIMPLIFIED: Just unsubscribe from global channel
  unsubscribeFromAllPosts: () => {
    console.log('🔄 Unsubscribing from all posts');
    PusherService.unsubscribeFromChannel('posts.global');
  },
  
  unsubscribeFromPost: (postId: number) => {
    console.log(`🔄 Unsubscribing from post ${postId}`);
    PusherService.unsubscribeFromIndividualPost(postId);
    
    set((state) => ({
      subscribedPostIds: state.subscribedPostIds.filter(id => id !== postId)
    }));
  },
  

  
  // Event handlers
  handleNewComment: (data) => {
    const { posts } = get();
    const updatedPosts = posts.map(post => {
      if (post.id === data.postId) {
        const existingComments = post.comments || [];
        const alreadyExists = existingComments.some(c => c.id === data.comment.id);

        if (alreadyExists) {
          console.log('🔄 Comment already exists, skipping duplicate:', data.comment.id);
          return post;
        }

        console.log('✅ Adding new comment to post:', data.postId);
        return {
          ...post,
          comments: [...existingComments, data.comment],
          comments_count: (post.comments_count || 0) + 1
        };
      }
      return post;
    });
    set({ posts: updatedPosts });
  },
  
  handleNewReaction: (data) => {
    const { posts } = get();
    const updatedPosts = posts.map(post => {
      if (post.id === data.postId) {
        const existingReactions = post.reactions || [];
        
        const reactionAlreadyExists = existingReactions.some(
          (r: any) => r.id === data.reaction.id
        );
        
        if (reactionAlreadyExists) {
          console.log('🔄 Reaction already exists, skipping duplicate:', data.reaction.id);
          return post;
        }
        
        const alreadyReacted = existingReactions.some(
          (r: any) => r.user_id === data.reaction.user_id && r.emoji === data.reaction.emoji
        );
        
        if (!alreadyReacted) {
          console.log('✅ Adding new reaction to post:', data.postId);
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
  
  handleCommentDeleted: (data) => {
    const { posts } = get();
    console.log('🗑️ Handling comment deletion:', data);
    
    const updatedPosts = posts.map(post => {
      if (post.id === data.postId) {
        const removeCommentAndReplies = (comments: Comment[]): Comment[] => {
          return comments
            .filter(comment => comment.id !== data.commentId)
            .map(comment => ({
              ...comment,
              replies: removeCommentAndReplies(comment.replies || [])
            }));
        };

        const updatedComments = removeCommentAndReplies(post.comments || []);
        
        return {
          ...post,
          comments: updatedComments,
          comments_count: Math.max(0, (post.comments_count || 0) - 1)
        };
      }
      return post;
    });
    set({ posts: updatedPosts });
    console.log('✅ Comment deleted via real-time');
  },

  handleReactionDeleted: (data) => {
    const { posts } = get();
    console.log('❌ Handling reaction deletion:', data);
    
    const updatedPosts = posts.map(post => {
      if (post.id === data.postId) {
        const existingReactions = post.reactions || [];
        const reactionToRemove = existingReactions.find(r => r.id === data.reactionId);
        
        if (reactionToRemove) {
          return {
            ...post,
            reactions: existingReactions.filter(r => r.id !== data.reactionId),
            reaction_counts: updateReactionCounts(
              post.reaction_counts || [], 
              reactionToRemove.emoji, 
              -1
            )
          };
        }
      }
      return post;
    });
    set({ posts: updatedPosts });
    console.log('✅ Reaction deleted via real-time');
  },
  
  disconnectRealtime: () => {
    console.log('🔄 Disconnecting real-time...');
    get().unsubscribeFromAllPosts();
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