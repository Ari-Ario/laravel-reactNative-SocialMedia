// stores/bookmarkStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
    getBookmarks, 
    addBookmark as apiAddBookmark, 
    removeBookmark as apiRemoveBookmark, 
    updateBookmark as apiUpdateBookmark 
} from '@/services/BookmarkService';

interface Bookmark {
    id: number;
    post_id: number;
    user_id: number;
    collection: string;
    note: string | null;
    created_at: string;
    post: {
        id: number;
        caption: string;
        media: Array<{ file_path: string; type: string }>;
        user: {
            id: number;
            name: string;
            profile_photo: string | null;
        };
    };
}

interface BookmarkStore {
    bookmarks: Bookmark[];
    isLoading: boolean;
    error: string | null;

    // Actions
    loadBookmarks: () => Promise<void>;
    addBookmark: (postId: number, collection?: string, note?: string | null) => Promise<Bookmark>;
    removeBookmark: (postId: number) => Promise<void>;
    updateBookmarkNote: (postId: number, note: string | null) => Promise<void>;
    moveToCollection: (postId: number, collection: string) => Promise<void>;
    clearBookmarks: () => void;
}

export const useBookmarkStore = create<BookmarkStore>()(
    persist(
        (set, get) => ({
            bookmarks: [],
            isLoading: false,
            error: null,

            loadBookmarks: async () => {
                set({ isLoading: true });
                try {
                    const bookmarks = await getBookmarks();
                    set({ bookmarks, isLoading: false });
                } catch (error) {
                    set({ error: error.message, isLoading: false });
                }
            },

            addBookmark: async (postId, collection, note) => {
                try {
                    const newBookmark = await apiAddBookmark(postId, collection, note);
                    set((state) => ({
                        bookmarks: [newBookmark, ...state.bookmarks],
                    }));
                    return newBookmark;
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            removeBookmark: async (postId) => {
                try {
                    await apiRemoveBookmark(postId);
                    set((state) => ({
                        bookmarks: state.bookmarks.filter(b => b.post_id !== postId),
                    }));
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            updateBookmarkNote: async (postId, note) => {
                const bookmark = get().bookmarks.find(b => b.post_id === postId);
                if (!bookmark) return;

                try {
                    const updated = await apiUpdateBookmark(bookmark.id, { note });
                    set((state) => ({
                        bookmarks: state.bookmarks.map(b =>
                            b.post_id === postId ? updated : b
                        ),
                    }));
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            moveToCollection: async (postId, collection) => {
                const bookmark = get().bookmarks.find(b => b.post_id === postId);
                if (!bookmark) return;

                try {
                    const updated = await apiUpdateBookmark(bookmark.id, { collection });
                    set((state) => ({
                        bookmarks: state.bookmarks.map(b =>
                            b.post_id === postId ? updated : b
                        ),
                    }));
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            clearBookmarks: () => {
                set({ bookmarks: [] });
            },
        }),
        {
            name: 'bookmark-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);