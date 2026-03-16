import axiosLib from "axios";
import axios from "@/services/axios";
import { getToken } from "./TokenService";
import getApiBase from "./getApiBase";
import { Platform } from "react-native";

export async function createStory(formData: FormData) {
    const token = await getToken();
    const API_BASE = getApiBase();

    // Use a fresh axios instance for multipart uploads on web
    // to avoid global headers interfering with the boundary selection.
    const instance = axiosLib.create();

    const config: any = {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        }
    };

    if (Platform.OS !== 'web') {
        config.headers['Content-Type'] = 'multipart/form-data';
    }
    // On web, we leave Content-Type empty so the browser sets it with boundary

    const response = await instance.post(`${API_BASE}/stories`, formData, config);
    return response.data;
}

export async function markStoryAsViewed(storyId: number) {
    const token = await getToken();
    const API_BASE = getApiBase();
    try {
        const response = await axios.post(
            `${API_BASE}/stories/${storyId}/view`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error marking story as viewed:', error);
        throw error;
    }
}


export async function fetchUserStories(userId: number) {
    const token = await getToken();
    const API_BASE = getApiBase();
    try {
        const response = await axios.get(`${API_BASE}/users/${userId}/stories`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching user stories:', error);
        throw error;
    }
}


export async function fetchStories() {
    const token = await getToken();
    const API_BASE = getApiBase();
    try {
        const response = await axios.get(`${API_BASE}/stories`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching stories:', error);
        throw error;
    }
}

export async function fetchStory(storyId: number) {
    const token = await getToken();
    const API_BASE = getApiBase();
    try {
        const response = await axios.get(`${API_BASE}/stories/${storyId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        console.log('One Story', response.data)
        return response.data;
    } catch (error) {
        console.error('Error fetching story:', error);
        throw error;
    }
}

export async function sendStoryReply(storyId: number, message: string) {
    const token = await getToken();
    const API_BASE = getApiBase();
    try {
        const response = await axios.post(
            `${API_BASE}/stories/${storyId}/reply`,
            { message },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error sending story reply:', error);
        throw error;
    }
}

export async function deleteStory(storyId: number) {
    const token = await getToken();
    const API_BASE = getApiBase();
    try {
        const response = await axios.delete(`${API_BASE}/stories/${storyId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error deleting story:', error);
        throw error;
    }
}