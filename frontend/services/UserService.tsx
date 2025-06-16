import axios from "@/services/axios";
import { getToken } from "./TokenService";
import getApiBase from "./getApiBase";

const API_BASE = getApiBase();

export async function fetchUserProfile(userId) {
    const token = await getToken();
    const response = await axios.get(`${API_BASE}/users/${userId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data;
}


//Functions handling every profile
export const fetchProfile = async (userId: string) => {
  try {
    const response = await axios.get(`${API_BASE}/profiles/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

export const followUser = async (userId: string) => {
  try {
    const action = isFollowing ? 'unfollow' : 'follow';
    const response = await axios.post(`${API_BASE}/profiles/${userId}/follow`, {
      action
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