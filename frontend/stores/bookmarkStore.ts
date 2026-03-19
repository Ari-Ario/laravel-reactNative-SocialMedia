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
    addBookmark: (postId: number, collection?: string, note?: string | null) => Promise<{ bookmark: Bookmark | null, bookmarked: boolean }>;
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
                    const data = await getBookmarks();
                    const validBookmarks = Array.isArray(data) 
                        ? data.filter(b => b && typeof b === 'object' && b.id) 
                        : [];
                    set({ bookmarks: validBookmarks, isLoading: false });
                } catch (error: any) {
                    set({ error: error.message, isLoading: false });
                }
            },

            addBookmark: async (postId, collection, note) => {
                try {
                    const result = await apiAddBookmark(postId, collection, note);
                    
                    if (!result.bookmarked) {
                        // Toggled off - remove from state
                        set((state) => ({
                            bookmarks: state.bookmarks.filter(b => b && b.post_id !== postId),
                        }));
                    } else if (result.bookmark) {
                        // Toggled on - add to state (preventing duplicates)
                        set((state) => ({
                            bookmarks: [
                                result.bookmark!, 
                                ...state.bookmarks.filter(b => b && b.id !== result.bookmark!.id && b.post_id !== postId)
                            ],
                        }));
                    }
                    
                    return result;
                } catch (error: any) {
                    set({ error: error.message });
                    throw error;
                }
            },

            removeBookmark: async (postId) => {
                try {
                    await apiRemoveBookmark(postId);
                    set((state) => ({
                        bookmarks: state.bookmarks.filter(b => b && b.post_id !== postId),
                    }));
                } catch (error: any) {
                    set({ error: error.message });
                    throw error;
                }
            },

            updateBookmarkNote: async (postId, note) => {
                const bookmark = get().bookmarks.find(b => b && b.post_id === postId);
                if (!bookmark) return;

                try {
                    const updated = await apiUpdateBookmark(bookmark.id, { note });
                    set((state) => ({
                        bookmarks: state.bookmarks.map(b =>
                            (b && b.post_id === postId) ? updated : b
                        ),
                    }));
                } catch (error: any) {
                    set({ error: error.message });
                    throw error;
                }
            },

            moveToCollection: async (postId, collection) => {
                const bookmark = get().bookmarks.find(b => b && b.post_id === postId);
                if (!bookmark) return;

                try {
                    const updated = await apiUpdateBookmark(bookmark.id, { collection });
                    set((state) => ({
                        bookmarks: state.bookmarks.map(b =>
                            (b && b.post_id === postId) ? updated : b
                        ),
                    }));
                } catch (error: any) {
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