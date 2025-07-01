import { create } from 'zustand';

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
  
}

export const usePostStore = create<PostStore>((set) => ({
  posts: [],
  
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
  
  // comment Reaction
// Updated comment reaction functions to match backend data structure
addCommentReaction: (postId, commentId, userId, emoji) => set((state) => {
  const postIndex = state.posts.findIndex(p => p.id === postId);
  if (postIndex === -1) {
    console.warn(`Post ${postId} not found in store`);
    return state;
  }

  return {
    posts: state.posts.map((post) => {
      if (post.id !== postId) return post;
      
      return {
        ...post,
        comments: post.comments?.map(comment => {
          if (comment.id !== commentId) return comment;
          
          // Check if user already has this exact reaction
          const hasExistingReaction = comment.reaction_comments?.some(
            r => r.user_id === userId && r.emoji === emoji
          );
          
          if (hasExistingReaction) return comment;
          
          // Create temporary reaction matching backend structure
          const tempReaction = {
            id: 1000000 + Date.now(), // Temporary ID
            user_id: userId,
            comment_id: commentId,
            emoji,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Remove any existing reactions from this user first
          const filteredReactions = comment.reaction_comments?.filter(
            r => r.user_id !== userId
          ) || [];
          
          return {
            ...comment,
            reaction_comments: [...filteredReactions, tempReaction],
            reaction_comments_count: (comment.reaction_comments_count || 0) + 1
          };
        })
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

        return {
          ...post,
          comments: post.comments?.map((comment) => {
            if (comment.id !== commentId) return comment;

            // Remove any reaction by this user
            const filtered = (comment.reaction_comments || []).filter(
              (r) => r.user_id !== newReaction.user_id
            );

            return {
              ...comment,
              reaction_comments: [...filtered, newReaction],
              reaction_comments_count: counts ?? comment.reaction_comments_count,
            };
          }),
        };
      }),
    };
  }),

removeCommentReaction: (postId, commentId, userId) => set((state) => {
  const postIndex = state.posts.findIndex(p => p.id === postId);
  if (postIndex === -1) return state;
  
  return {
    posts: state.posts.map((post) => {
      if (post.id !== postId) return post;
      
      return {
        ...post,
        comments: post.comments?.map(comment => {
          if (comment.id !== commentId) return comment;
          
          // Count how many reactions we're removing
          const userReactions = comment.reaction_comments?.filter(
            r => r.user_id === userId
          ) || [];
          
          const removeCount = userReactions.length;
          
          return {
            ...comment,
            reaction_comments: comment.reaction_comments?.filter(
              r => r.user_id !== userId
            ),
            reaction_comments_count: Math.max(
              0,
              (comment.reaction_comments_count || 0) - removeCount
            )
          };
        })
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
      
      // Ensure comments array exists
      const currentComments = post.comments || [];
      
      // For replies, find the parent comment
      if (comment.parent_id) {
        return {
          ...post,
          comments: currentComments.map(parent => {
            if (parent.id === comment.parent_id) {
              return {
                ...parent,
                replies: [...(parent.replies || []), comment]
              };
            }
            return parent;
          }),
          // Don't increment count for replies
          comments_count: post.comments_count
        };
      }
      
      // For top-level comments
      return {
        ...post,
        comments: [...currentComments, comment],
        comments_count: (post.comments_count || 0) + 1
      };
    }),
  }));
}
}));

// Helper functions
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
