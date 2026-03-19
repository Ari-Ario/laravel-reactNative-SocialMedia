import axios from '@/services/axios';

export interface Bookmark {
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

export const getBookmarks = async (): Promise<Bookmark[]> => {
    const response = await axios.get('/bookmarks');
    return response.data;
};

export const addBookmark = async (postId: number, collection?: string, note?: string | null): Promise<Bookmark> => {
    const response = await axios.post(`/posts/${postId}/bookmark`, {
        collection,
        note
    });
    return response.data.bookmark;
};

export const removeBookmark = async (postId: number): Promise<void> => {
    await axios.post(`/posts/${postId}/bookmark`);
};

export const updateBookmark = async (id: number, data: { collection?: string; note?: string | null }): Promise<Bookmark> => {
    const response = await axios.put(`/bookmarks/${id}`, data);
    return response.data.bookmark;
};

export default {
    getBookmarks,
    addBookmark,
    removeBookmark,
    updateBookmark
};
