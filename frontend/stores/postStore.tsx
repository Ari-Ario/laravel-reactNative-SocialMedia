// stores/postStore.tsx
import { create } from 'zustand';
import PusherService from '@/services/PusherService';
import { useNotificationStore } from '@/stores/notificationStore';
import { fetchPostById } from '@/services/PostService';

export interface Reaction {
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

export interface Comment {
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
  reaction_comments?: any[];
  reaction_comments_count?: number;
  reaction_counts?: Array<{
    emoji: string;
    count: number;
  }>;
}

export interface Post {
  id: number;
  caption?: string;
  user?: {
    id: number | string;
    name: string;
    profile_photo: string | null;
  };
  media?: Array<{
    id: number;
    file_path: string;
    type: string;
  }>;
  comments_count?: number;
  created_at?: string;
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
  subscribedPostIds: number[];
  expandedPostId: number | null;

  // Track pending operations to prevent duplicates
  pendingCommentIds: Set<number>;
  pendingReactionIds: Set<number>;
  pendingPostIds: Set<number>;
  markPostAsPending: (postId: number) => void;
  clearPendingPost: (postId: number) => void;

  // Basic operations
  setPosts: (posts: Post[]) => void;
  updatePost: (updatedPostOrFn: Partial<Post> | ((p: Post) => Post)) => void;
  addPost: (newPost: Post) => void;
  deletePostById: (postId: number) => void;

  // Expanded post management
  setExpandedPostId: (postId: number | null) => void;
  toggleExpandedPostId: (postId: number) => void;

  // Reactions
  addPostReaction: (postId: number, reaction: Reaction) => void;
  removePostReaction: (postId: number, reactionIdOrUserId: number | { userId: number }) => void;

  // Comments
  addPostComment: (postId: number, comment: Comment) => void;
  updatePostWithNewComment: (postId: number, comment: Comment) => void;
  removeComment: (postId: number, commentId: number) => void;

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
    emoji: string,
    reaction_counts?: any[],
    reaction_comments_count?: number
  ) => void;

  removeCommentReaction: (
    postId: number,
    commentId: number,
    userId: number,
    reactionCounts?: any[],
    reactionCommentsCount?: number
  ) => void;

  updateCommentWithServerData: (
    postId: string | number,
    commentId: string | number,
    serverComment: Comment
  ) => void;

  // Real-time methods
  initializeRealtime: (token: string) => void;
  // subscribeToPost: (postId: number) => void;
  unsubscribeFromPost: (postId: number) => void;
  subscribeToPosts: (postIds: number[]) => void;
  unsubscribeFromAllPosts: () => void;
  disconnectRealtime: () => void;

  // Real-time event handlers with flexible data
  handleNewComment: (data: any) => void;
  handleNewReaction: (data: any) => void;
  handleCommentDeleted: (data: any) => void;
  handleReactionDeleted: (data: any) => void;
  handleCommentReaction: (data: any) => void;
  handleNewPost: (data: any) => void;
  handlePostUpdated: (data: any) => void;
  handlePostDeleted: (data: any) => void;

  // Duplicate prevention helpers
  markCommentAsPending: (commentId: number) => void;
  markReactionAsPending: (reactionId: number) => void;
  clearPendingComment: (commentId: number) => void;
  clearPendingReaction: (reactionId: number) => void;

  // Cleanup
  reset: () => void;
  hydratePost: (postId: number) => Promise<Post | undefined>;
}

export const usePostStore = create<PostStore>((set, get) => ({
  posts: [],
  subscribedPostIds: [],
  expandedPostId: null,

  // Track pending operations to prevent duplicates
  pendingCommentIds: new Set<number>(),
  pendingReactionIds: new Set<number>(),
  pendingPostIds: new Set<number>(),

  markPostAsPending: (postId) => {
    set((state) => {
      const newPending = new Set(state.pendingPostIds);
      newPending.add(postId);
      return { pendingPostIds: newPending };
    });
  },

  clearPendingPost: (postId) => {
    set((state) => {
      const newPending = new Set(state.pendingPostIds);
      newPending.delete(postId);
      return { pendingPostIds: newPending };
    });
  },

  // Basic post operations
  setPosts: (newPosts) => {
    set((state) => {
      const mergedPosts = newPosts.map((newPost: any) => {
        const existingPost = state.posts.find(p => p.id === newPost.id);
        if (existingPost) {
          // If new post is lite, merge it into existing post
          // If new post is NOT lite, it's a full refresh, replace it
          return newPost.is_lite 
            ? { ...existingPost, ...newPost } 
            : { ...newPost };
        }
        return newPost;
      });
      return { posts: mergedPosts };
    });
  },

  updatePost: (updatedPostOrFn) => {
    set((state) => {
      // If it's a function (mapper pattern)
      if (typeof updatedPostOrFn === 'function') {
        return {
          posts: state.posts.map(updatedPostOrFn)
        };
      }

      // If it's a partial post object
      const updatedPost = updatedPostOrFn;
      if (!updatedPost?.id) return state;

      console.log('🔄 Store: Updating post', updatedPost.id);
      return {
        posts: state.posts.map((p) =>
          p.id === updatedPost.id ? { ...p, ...updatedPost, is_lite: false } : p
        ),
      };
    });
  },

  addPost: (post) => {
    set((state) => {
      const existingIndex = state.posts.findIndex(p => p.id === post.id);

      if (existingIndex >= 0) {
        const existingPost = state.posts[existingIndex];
        if (JSON.stringify(existingPost) === JSON.stringify(post)) {
          return state;
        }

        const updatedPosts = [...state.posts];
        updatedPosts[existingIndex] = post;
        return { posts: updatedPosts };
      } else {
        return { posts: [post, ...state.posts] };
      }
    });
  },

  deletePostById: (postId: number) => set((state) => ({
    posts: state.posts.filter((p) => p.id !== postId),
  })),

  hydratePost: async (postId: number) => {
    if (!postId || isNaN(postId)) return undefined;

    const currentPost = get().posts.find(p => p.id === postId);
    // If post exists and is lite (missing full media or comments/reactions)
    if (currentPost && (!currentPost.reactions || currentPost.is_lite)) {
      try {
        console.log(`🌐 Hydrating post: ${postId}`);
        const fullPost = await fetchPostById(postId);
        get().updatePost({ ...fullPost, is_lite: false });
        return fullPost;
      } catch (error) {
        console.error(`❌ Error hydrating post ${postId}:`, error);
      }
    }
    return currentPost;
  },

  // Expanded post management
  setExpandedPostId: (postId) => set({ expandedPostId: postId }),

  toggleExpandedPostId: (postId) => {
    set((state) => ({
      expandedPostId: state.expandedPostId === postId ? null : postId
    }));
  },

  // Duplicate prevention helpers
  markCommentAsPending: (commentId: number) => {
    set((state) => ({
      pendingCommentIds: new Set([...state.pendingCommentIds, commentId])
    }));
  },

  markReactionAsPending: (reactionId: number) => {
    set((state) => ({
      pendingReactionIds: new Set([...state.pendingReactionIds, reactionId])
    }));
  },

  clearPendingComment: (commentId: number) => {
    set((state) => {
      const newPending = new Set(state.pendingCommentIds);
      newPending.delete(commentId);
      return { pendingCommentIds: newPending };
    });
  },

  clearPendingReaction: (reactionId: number) => {
    set((state) => {
      const newPending = new Set(state.pendingReactionIds);
      newPending.delete(reactionId);
      return { pendingReactionIds: newPending };
    });
  },

  // Reaction operations with duplicate prevention
  addPostReaction: (postId, reaction) => {
    const { pendingReactionIds } = get();

    // Skip if this reaction is already pending (being handled by real-time)
    if (pendingReactionIds.has(reaction.id)) {
      console.log('🔄 Skipping duplicate reaction (already pending):', reaction.id);
      return;
    }

    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;

        const existingReactions = post.reactions || [];
        const NumberUserId = Number(reaction.user_id);
        
        // Find if user already has ANY reaction to this post
        const oldReaction = existingReactions.find(r => Number(r.user_id) === NumberUserId);
        
        // If same emoji, skip
        if (oldReaction && oldReaction.emoji === reaction.emoji) return post;

        let updatedReactions = existingReactions;
        let updatedCounts = [...(post.reaction_counts || [])];

        // If swapping, remove old one first
        if (oldReaction) {
          updatedReactions = updatedReactions.filter(r => Number(r.user_id) !== NumberUserId);
          updatedCounts = updateReactionCounts(updatedCounts, oldReaction.emoji, -1);
        }

        return {
          ...post,
          reactions: [...updatedReactions, reaction],
          reaction_counts: updateReactionCounts(updatedCounts, reaction.emoji, 1)
        };
      }),
    }));
  },

  removePostReaction: (postId, identifier) => {
    set((state) => ({
      posts: state.posts.map((post) => {
        if (Number(post.id) !== Number(postId)) return post;

        const isUserIdLookup = typeof identifier === 'object' && 'userId' in identifier;
        const lookupId = isUserIdLookup ? identifier.userId : identifier;

        const existingReactions = post.reactions || [];
        const reactionToRemove = existingReactions.find(r => 
          isUserIdLookup ? Number(r.user_id) === Number(lookupId) : Number(r.id) === Number(lookupId)
        );

        if (!reactionToRemove) return post;

        return {
          ...post,
          reactions: existingReactions.filter(r => 
            isUserIdLookup ? Number(r.user_id) !== Number(lookupId) : Number(r.id) !== Number(lookupId)
          ),
          reaction_counts: updateReactionCounts(
            post.reaction_counts || [],
            reactionToRemove.emoji,
            -1
          )
        };
      }),
    }));
  },

  // Comment operations with duplicate prevention
  addPostComment: (postId, comment) => {
    const { pendingCommentIds } = get();

    if (pendingCommentIds.has(comment.id)) {
      console.log('🔄 Skipping duplicate comment (already pending):', comment.id);
      return;
    }

    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;

        const newComment = {
          ...comment,
          reaction_comments: comment.reaction_comments || [],
          reaction_counts: comment.reaction_counts || [],
          reaction_comments_count: comment.reaction_comments_count || 0,
        };

        const newComments = comment.parent_id
          ? addReplyToComment(post.comments || [], newComment)
          : [...(post.comments || []), newComment];

        return {
          ...post,
          comments: newComments,
          comments_count: (post.comments_count || 0) + 1
        };
      }),
    }));
  },

  updatePostWithNewComment: (postId, comment) => {
    const { pendingCommentIds } = get();

    if (pendingCommentIds.has(comment.id)) {
      console.log('🔄 Skipping duplicate comment in update:', comment.id);
      return;
    }

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

  // Comment reaction functions
  addCommentReaction: (postId, commentId, userId, emoji) => {
    const pId = Number(postId);
    const cId = Number(commentId);
    const uId = Number(userId);
    const { pendingReactionIds } = get();
    const tempReactionId = 1000000 + Date.now();

    get().markReactionAsPending(tempReactionId);

    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== pId) return post;

        const updater = (comment: Comment) => {
          const hasExistingReaction = comment.reaction_comments?.some(
            (r: any) => r.user_id === uId && r.emoji === emoji
          );

          if (hasExistingReaction) return comment;

          const tempReaction = {
            id: tempReactionId,
            user_id: uId,
            comment_id: cId,
            emoji,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const filteredReactions = comment.reaction_comments?.filter(
            (r: any) => r.user_id !== uId
          ) || [];

          return {
            ...comment,
            reaction_comments: [...filteredReactions, tempReaction],
            reaction_comments_count: (comment.reaction_comments_count || 0) + 1
          };
        };

        return {
          ...post,
          comments: updateCommentInTree(post.comments || [], cId, updater)
        };
      })
    }));
  },

  updateCommentReactions: (postId, commentId, newReaction, counts = null) => {
    const pId = Number(postId);
    const cId = Number(commentId);
    const { pendingReactionIds } = get();

    if (pendingReactionIds.has(newReaction.id)) {
      console.log('🔄 Skipping duplicate comment reaction:', newReaction.id);
      return;
    }

    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== pId) return post;

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
          comments: updateCommentInTree(post.comments || [], cId, updater)
        };
      }),
    }));
  },

  removeCommentReaction: (postId, commentId, userId, serverCounts, serverTotal) => {
    set((state) => ({
      posts: state.posts.map((post) => {
        if (Number(post.id) !== Number(postId)) return post;

        return {
          ...post,
          comments: post.comments?.map((comment) => {
            if (Number(comment.id) !== Number(commentId)) return comment;

            const existingReactions = comment.reaction_comments || [];
            // If server counts are provided, use them. Otherwise, calculate optimistically.
            if (serverCounts) {
              return {
                ...comment,
                reaction_comments: serverCounts,
                reaction_comments_count: serverTotal ?? comment.reaction_comments_count
              };
            }

            // Optimistic calculation by user_id
            const reactionToRemove = existingReactions.find(r => Number(r.user_id) === Number(userId));
            if (!reactionToRemove) return comment;

            return {
              ...comment,
              reaction_comments: existingReactions.filter(r => Number(r.user_id) !== Number(userId)),
              reaction_comments_count: Math.max(0, (comment.reaction_comments_count || 0) - 1)
            };
          })
        };
      })
    }));
  },

  updateCommentWithServerData: (postId, commentId, serverComment) => {
    const pId = Number(postId);
    const cId = Number(commentId);

    set((state) => {
      const ensureReactions = (comment: Comment) => ({
        ...comment,
        reaction_comments: comment.reaction_comments || [],
        replies: comment.replies?.map(ensureReactions as any) || []
      });

      return {
        posts: state.posts.map((post) => {
          if (post.id !== pId) return post;

          return {
            ...post,
            comments: post.comments?.map(comment => {
              if (comment.id !== cId) return comment;
              return ensureReactions(serverComment) as any;
            }) ?? [ensureReactions(serverComment) as any]
          };
        })
      };
    });
  },

  removeComment: (postId, commentId) => {
    const pId = Number(postId);
    const cId = Number(commentId);

    set((state) => {
      const removeCommentAndReplies = (comments: Comment[]): Comment[] => {
        return comments
          .filter(comment => Number(comment.id) !== cId)
          .map(comment => ({
            ...comment,
            replies: removeCommentAndReplies(comment.replies || [])
          }));
      };

      return {
        posts: state.posts.map(post => {
          if (Number(post.id) !== pId) return post;

          // Check if the comment actually exists before decrementing count
          const findComment = (comments: Comment[]): boolean => {
            return comments.some(c => 
              Number(c.id) === cId || (c.replies && findComment(c.replies))
            );
          };

          const hasComment = findComment(post.comments || []);
          const updatedComments = removeCommentAndReplies(post.comments || []);

          return {
            ...post,
            comments: updatedComments,
            comments_count: hasComment 
              ? Math.max(0, (post.comments_count || 0) - 1) 
              : (post.comments_count || 0)
          };
        })
      };
    });
  },

  // REAL-TIME METHODS
  initializeRealtime: (token: string) => {
    console.log('🔄 Initializing real-time connection...');
    PusherService.initialize(token);
  },

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

    const handleCommentReaction = (data: any) => {
      console.log('💖 Global channel comment reaction received:', data);
      get().handleCommentReaction(data);
    };

    const handleNewPost = (data: any) => {
      console.log('📝 Global channel new post received:', data);
      get().handleNewPost(data);
    };

    const handlePostUpdated = (data: any) => {
      console.log('✏️ Global channel post updated:', data);
      get().handlePostUpdated(data);
    };

    const handlePostDeleted = (data: any) => {
      console.log('🗑️ Global channel: post deleted:', data.postId);
      get().handlePostDeleted(data);
    };

    const handleCommentDeleted = (data: any) => {
      console.log('🗑️ Global channel: comment deleted:', data.commentId);
      get().handleCommentDeleted(data);
    };

    PusherService.subscribeToPosts(
      postIds,
      get().handleNewComment,
      get().handleNewReaction,
      get().handleCommentReaction,
      get().handleNewPost,
      get().handlePostUpdated,
      get().handlePostDeleted,
      get().handleCommentDeleted,
      get().handleReactionDeleted
    );
  },

  handleCommentReaction: (data) => {
    const { posts } = get();
    console.log('✅ Received comment reaction data:', data);

    const commentId = Number(data.commentId);
    const postId = Number(data.postId);

    get().markReactionAsPending(data.reaction.id);

    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        const updater = (comment: Comment) => {
          if (comment.id === commentId) {
            const existingReactions = comment.reaction_comments || [];
            const alreadyReacted = existingReactions.some(
              (r: any) => r.user_id === data.reaction.user_id && r.emoji === data.reaction.emoji
            );

            if (!alreadyReacted) {
              console.log('✅ Adding new comment reaction via real-time:', data.reaction.id);
              return {
                ...comment,
                reaction_comments: [...existingReactions, data.reaction],
                reaction_comments_count: (comment.reaction_comments_count || 0) + 1
              };
            }
            console.log('🔄 Comment reaction already exists:', data.reaction.id);
          }
          return comment;
        };

        return {
          ...post,
          comments: updateCommentInTree(post.comments || [], commentId, updater)
        };
      }
      return post;
    });
    set({ posts: updatedPosts });
  },

  handleNewPost: (data) => {
    const { posts } = get();
    get().markPostAsPending(data.post.id);

    const postExists = posts.some(post => post.id === data.post.id);

    if (!postExists) {
      console.log('✅ Adding new post via real-time:', data.post.id);
      set((state) => ({
        posts: [data.post, ...state.posts]
      }));
    } else {
      console.log('🔄 Post already exists, skipping duplicate:', data.post.id);
    }
  },

  handlePostUpdated: (data) => {
    const { posts } = get();
    const postId = Number(data.postId);

    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        console.log('✏️ Store: Applying real-time update to post', postId, 'Fields:', data.updatedFields);
        const updatedPost = { ...post };
        
        if (data.changes) {
          Object.keys(data.changes).forEach((field) => {
            // ✅ FORCE NEW REFERENCE for media to trigger carousel re-render
            if (field === 'media') {
               updatedPost.media = Array.isArray(data.changes[field].new) 
                 ? [...data.changes[field].new] 
                 : data.changes[field].new;
               console.log('🖼️ Store: Updated media count:', updatedPost.media?.length);
            } else {
               updatedPost[field] = data.changes[field].new;
            }
          });
        }
        return {
          ...updatedPost,
          updated_at: data.timestamp || new Date().toISOString(),
          // If we received media or caption updates, this post is no longer "lite" for those fields
          is_lite: data.updatedFields?.includes('media') ? false : post.is_lite
        };
      }
      return post;
    });

    set({ posts: updatedPosts });
  },

  handlePostDeleted: (data) => {
    const postId = Number(data.postId);
    console.log('🗑️ Removing post via real-time:', postId);
    set((state) => ({
      posts: state.posts.filter(post => post.id !== postId)
    }));
  },

  unsubscribeFromAllPosts: () => {
    console.log('🔄 Unsubscribing from all posts');
    PusherService.unsubscribeFromChannel('posts-global');
  },

  unsubscribeFromPost: (postId: number) => {
    console.log(`🔄 Unsubscribing from post ${postId}`);
    PusherService.unsubscribeFromIndividualPost(postId);

    set((state) => ({
      subscribedPostIds: state.subscribedPostIds.filter(id => id !== postId)
    }));
  },

  handleNewComment: (data) => {
    const { posts } = get();
    const postId = Number(data.postId);
    get().markCommentAsPending(data.comment.id);

    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        const existingComments = post.comments || [];
        const alreadyExists = existingComments.some(c => c.id === data.comment.id);

        if (alreadyExists) {
          console.log('🔄 Comment already exists, skipping duplicate:', data.comment.id);
          return post;
        }

        console.log('✅ Adding new comment via real-time:', data.comment.id);
        
        // ✅ Add notification if this post belongs to current user
        const currentUserId = useNotificationStore.getState().currentUserId;
        if (data.postOwnerId && Number(data.postOwnerId) === currentUserId) {
            console.log('🔔 Triggering notification for comment on owned post');
            useNotificationStore.getState().addNotification({
                type: 'comment',
                title: data.title || 'New Comment',
                message: data.message || `${data.comment?.user?.name || 'Someone'} commented: "${data.comment?.content?.substring(0, 30)}..."`,
                data: data,
                userId: data.comment?.user_id || data.user_id,
                postId: data.postId || postId,
                avatar: data.comment?.user?.profile_photo || data.user_avatar,
                createdAt: new Date()
            });
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
  },

  handleNewReaction: (data) => {
    const { posts } = get();
    const postId = Number(data.postId);
    get().markReactionAsPending(data.reaction.id);

    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        const existingReactions = post.reactions || [];
        const userId = Number(data.reaction.user_id);
        const reactionId = Number(data.reaction.id);

        const reactionAlreadyExists = existingReactions.some(
          (r: any) => Number(r.id) === reactionId
        );

        if (reactionAlreadyExists) {
          console.log('🔄 Reaction already exists, skipping duplicate:', reactionId);
          return post;
        }

        // ✅ SWAP LOGIC: If user already has a reaction, remove it first
        const filteredReactions = existingReactions.filter(r => Number(r.user_id) !== userId);
        const oldReaction = existingReactions.find(r => Number(r.user_id) === userId);
        
        let updatedCounts = [...(post.reaction_counts || [])];
        if (oldReaction) {
          console.log('🔄 Replacing old reaction for user:', userId);
          updatedCounts = updateReactionCounts(updatedCounts, oldReaction.emoji, -1);
        }

        console.log('✅ Adding new reaction via real-time:', reactionId);

        // ✅ Add notification if this post belongs to current user
        const currentUserId = useNotificationStore.getState().currentUserId;
        if (data.postOwnerId && Number(data.postOwnerId) === currentUserId) {
            console.log('🔔 Triggering notification for reaction on owned post');
            useNotificationStore.getState().addNotification({
                type: 'reaction',
                title: data.title || 'New Reaction',
                message: data.message || `${data.reaction.user?.name || 'Someone'} reacted with ${data.reaction.emoji} on your post`,
                data: data,
                userId: data.reaction.user_id || data.user_id,
                postId: data.postId || postId,
                avatar: data.reaction.user?.profile_photo || data.user_avatar,
                createdAt: new Date()
            });
        }

        return {
          ...post,
          reactions: [...existingReactions, data.reaction],
          reaction_counts: updateReactionCounts(post.reaction_counts || [], (data.reaction.emoji as string), 1)
        };
      }
      return post;
    });
    set({ posts: updatedPosts });
  },

  handleCommentDeleted: (data) => {
    const { posts } = get();
    const postId = Number(data.postId || data.post_id);
    const commentId = Number(data.commentId || data.comment_id);

    if (!postId || !commentId) {
      console.warn('⚠️ Missing data in handleCommentDeleted:', data);
      return;
    }

    console.log(`🗑️ Handling comment deletion event: post ${postId}, comment ${commentId}`);
    get().clearPendingComment(commentId);

    const updatedPosts = posts.map(post => {
      if (Number(post.id) === postId) {
        const removeCommentAndReplies = (comments: Comment[]): Comment[] => {
          return comments
            .filter(comment => Number(comment.id) !== commentId)
            .map(comment => ({
              ...comment,
              replies: removeCommentAndReplies(comment.replies || [])
            }));
        };

        const existingComments = post.comments || [];
        const findComment = (comments: Comment[]): boolean => {
          return comments.some(c => 
            Number(c.id) === commentId || (c.replies && findComment(c.replies))
          );
        };

        const hasComment = findComment(existingComments);
        const updatedComments = removeCommentAndReplies(existingComments);

        // ONLY decrement if the comment was actually in our local state
        // This prevents double-decrementing if we already did an optimistic update
        const newCount = hasComment 
          ? Math.max(0, (post.comments_count || 0) - 1) 
          : (post.comments_count || 0);

        return {
          ...post,
          comments: updatedComments,
          comments_count: newCount
        };
      }
      return post;
    });
    set({ posts: updatedPosts });
  },

  handleReactionDeleted: (data) => {
    const { posts } = get();
    console.log('❌ Handling reaction deletion event:', data);

    const postId = Number(data.postId || data.post_id);
    const userId = Number(data.userId || data.user_id);
    const commentId = data.commentId ? Number(data.commentId) : null;
    const reactionId = data.reactionId ? Number(data.reactionId) : null;

    if (reactionId) {
      get().clearPendingReaction(reactionId);
    }

    const updatedPosts = posts.map(post => {
      if (Number(post.id) === postId) {
        if (commentId) {
          // Handle comment reaction deletion
          // ... implementation to find comment and remove its reaction
          const updateCommentReactionsHelper = (comments: Comment[]): Comment[] => {
            return comments.map(comment => {
              if (Number(comment.id) === commentId) {
                const existingReactions = comment.reaction_comments || [];
                const reactionToRemove = existingReactions.find(r => 
                  reactionId ? r.id === reactionId : Number(r.user_id) === userId
                );

                if (reactionToRemove) {
                  return {
                    ...comment,
                    reaction_comments: existingReactions.filter(r => 
                      reactionId ? r.id !== reactionId : Number(r.user_id) !== userId
                    )
                  };
                }
              }
              if (comment.replies) {
                return {
                  ...comment,
                  replies: updateCommentReactionsHelper(comment.replies)
                };
              }
              return comment;
            });
          };
          return {
            ...post,
            comments: updateCommentReactionsHelper(post.comments || [])
          };
        } else {
          // Handle post reaction deletion
          const existingReactions = post.reactions || [];
          const reactionToRemove = existingReactions.find(r => 
            reactionId ? r.id === reactionId : Number(r.user_id) === userId
          );

          if (reactionToRemove) {
            return {
              ...post,
              reactions: existingReactions.filter(r => 
                reactionId ? r.id !== reactionId : Number(r.user_id) !== userId
              ),
              reaction_counts: updateReactionCounts(
                post.reaction_counts || [],
                reactionToRemove.emoji,
                -1
              )
            };
          }
        }
      }
      return post;
    });
    set({ posts: updatedPosts });
  },

  disconnectRealtime: () => {
    console.log('🔄 Disconnecting real-time...');
    get().unsubscribeFromAllPosts();
    PusherService.disconnect();
  },

  reset: () => {
    set({
      posts: [],
      subscribedPostIds: [],
      expandedPostId: null,
      pendingCommentIds: new Set(),
      pendingReactionIds: new Set(),
      pendingPostIds: new Set(),
    });
    console.log('🧹 PostStore reset complete');
  },
}));

// Helper functions (keep the same)
const updateReactionCounts = (
  counts: Array<{ emoji: string; count: number }>,
  emoji: string,
  delta: number
): Array<{ emoji: string; count: number }> => {
  const existing = counts.find(c => c.emoji === emoji);
  if (existing) {
    const newCount = Math.max(0, existing.count + delta);
    if (newCount === 0) {
      return counts.filter(c => c.emoji !== emoji);
    }
    return counts.map(c => 
      c.emoji === emoji ? { ...c, count: newCount } : c
    );
  }
  if (delta > 0) {
    return [...counts, { emoji, count: delta }];
  }
  return counts;
};

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