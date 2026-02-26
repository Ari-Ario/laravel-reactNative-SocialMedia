import axios from "@/services/axios";
import { getToken } from "./TokenService";
import getApiBase from "./getApiBase";
import { Platform } from "react-native";

export async function createStory(formData: FormData) {
    const token = await getToken();
    const API_BASE = getApiBase();

    // For web platform, we need to set the Content-Type header to undefined
    // so the browser can set it automatically with the correct boundary
    const config = {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
        }
    };

    const response = await axios.post(`${API_BASE}/stories`, formData, config);
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