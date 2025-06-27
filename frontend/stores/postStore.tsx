// stores/postStore.ts
import { create } from 'zustand';

interface Post {
  id: number;
  [key: string]: any;
}

interface PostStore {
  posts: Post[];
  setPosts: (posts: Post[]) => void;
  updatePost: (updated: Post) => void;
  addPost: (newPost: Post) => void;
  deletePostById: (postId: number) => void;
}

export const usePostStore = create<PostStore>((set) => ({
  posts: [],
  setPosts: (posts) => set({ posts }),
    updatePost: (updatedPost: Post) => {
    if (!updatedPost?.id) return;
    set((state) => ({
        posts: state.posts.map((p) =>
        p.id === updatedPost.id ? updatedPost : p
        ),
    }));
    },

  addPost: (newPost) =>
    set((state) => ({
      posts: [newPost, ...state.posts],
    })),
  deletePostById: (postId) =>
    set((state) => ({
      posts: state.posts.filter((p) => p.id !== postId),
    })),

  updatePostComments: (updatedPost: Post) => {
    set((state) => ({
      posts: state.posts.map((post) =>
        post.id === updatedPost.id ? { ...post, comments: updatedPost.comments } : post
      ),
    }));
  },

  updatePostReactions: (updatedPost: Post) => {
    set((state) => ({
      posts: state.posts.map((post) =>
        post.id === updatedPost.id ? { ...post, reactions: updatedPost.reactions } : post
      ),
    }));
  },

}));
