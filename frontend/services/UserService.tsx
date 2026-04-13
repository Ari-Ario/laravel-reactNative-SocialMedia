import { DeviceEventEmitter } from 'react-native';
import axios from "@/services/axios";
import { getToken } from "./TokenService";
import getApiBase from "./getApiBase";

const API_BASE = getApiBase();

export async function fetchUserProfile(userId: string) {
// ... existing fetchUserProfile code ...
  const token = await getToken();
  const response = await axios.get(`${API_BASE}/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}


//Functions handling every profile
export const fetchProfile = async (userId: string, page: number = 1) => {
// ... existing fetchProfile code ...
  try {
    const response = await axios.get(`${API_BASE}/profiles/${userId}?page=${page}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

export const followUser = async (userId: string, action: 'follow' | 'unfollow') => {
  try {
    // const action = isFollowing ? 'unfollow' : 'follow';
    const response = await axios.post(`${API_BASE}/profiles/${userId}/follow`, {
      action
    });
    
    // Emit global event for state sync across components
    DeviceEventEmitter.emit('user-follow-updated', { 
        userId, 
        isFollowing: action === 'follow' 
    });
    
    return response.data;
  } catch (error) {
    console.error('Error following user:', error);
    throw error;
  }
};

export const updateProfile = async (profileData: {
  name?: string;
  last_name?: string;
  bio?: string;
  profile_photo?: string;
}) => {
  try {
    const response = await axios.put(`${API_BASE}/profile`, profileData);
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

export const blockUser = async (userId: string) => {
  try {
    const response = await axios.post(`${API_BASE}/profiles/${userId}/block`);
    return response.data;
  } catch (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
};

export const unblockUser = async (userId: string) => {
  try {
    const response = await axios.post(`${API_BASE}/profiles/${userId}/unblock`);
    return response.data;
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
};

export const fetchUserByEmail = async (email: string) => {
  try {
    const response = await axios.post(`${API_BASE}/users/lookup`, {
        identifier: email,
        type: 'email'
    });
    return response.data.user;
  } catch (error) {
    console.error('Error searching user by email:', error);
    throw error;
  }
};

export const sendFriendRequest = async (userId: number) => {
  try {
    // Mapping friend request to follow for now as per api.php
    const response = await axios.post(`${API_BASE}/profiles/${userId}/follow`, {
        action: 'follow'
    });
    return response.data;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

export const sendEmailInvitation = async (email: string, message?: string) => {
  try {
    const response = await axios.post(`${API_BASE}/settings/invite`, {
        email,
        message
    });
    return response.data;
  } catch (error) {
    console.error('Error sending email invitation:', error);
    throw error;
  }
};

export const fetchBlockedUsers = async () => {
    try {
        const response = await axios.get(`${API_BASE}/profiles/blocked`);
        return response.data;
    } catch (error) {
        console.error('Error fetching blocked users:', error);
        throw error;
    }
};