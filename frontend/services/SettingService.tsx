import axios from "@/services/axios";
import { getToken } from "./TokenService";
import getApiBase from "./getApiBase";
import * as ImagePicker from 'expo-image-picker';
import { Platform } from "react-native";

export const uploadProfilePhoto = async (uri: string) => {
  const token = await getToken();
  const API_BASE = getApiBase();
  const formData = new FormData();

  let file;

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
  } else {
    const fileType = uri.split('.').pop();
    file = {
      uri,
      name: `profile_${Date.now()}.${fileType}`,
      type: `image/${fileType}`,
    };
  }

  formData.append('profile_photo', file);

  const response = await axios.post(`${API_BASE}/profile/photo`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};


export const deleteProfilePhoto = async () => {
  const token = await getToken();
  const API_BASE = getApiBase();

  const response = await axios.delete(`${API_BASE}/profile/photo`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};

export const requestCameraPermission = async () => {
  if (Platform.OS === 'web') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch {
      return false;
    }
  }
  // Native: dynamic import to avoid SSR issues
  const { Camera } = await import('expo-camera');
  const { status } = await Camera.requestCameraPermissionsAsync();
  return status === 'granted';
};

export async function updateUserName(name: string) {
  const token = await getToken();
  const API_BASE = getApiBase();

  const formData = new FormData();
  formData.append('name', name);

  const response = await axios.post(`${API_BASE}/profile/name`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
}

export async function fetchFullSettings() {
  const token = await getToken();
  const API_BASE = getApiBase();

  const response = await axios.get(`${API_BASE}/settings/all`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

export async function updateFullSettings(data: any) {
  const token = await getToken();
  const API_BASE = getApiBase();

  const response = await axios.put(`${API_BASE}/settings/update`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

export async function updatePreferences(data: any) {
  const token = await getToken();
  const API_BASE = getApiBase();

  const response = await axios.put(`${API_BASE}/preferences`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

export async function deleteAccount(password: string) {
  const token = await getToken();
  const API_BASE = getApiBase();

  const response = await axios.delete(`${API_BASE}/settings/account`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { password }
  });
  return response.data;
}

export async function exportUserData() {
    const token = await getToken();
    const API_BASE = getApiBase();

    const response = await axios.get(`${API_BASE}/settings/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
    });
    return response.data;
}

export async function updatePassword(data: any) {
    const token = await getToken();
    const API_BASE = getApiBase();

    const response = await axios.post(`${API_BASE}/settings/password`, data, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
}

export async function broadcastMessage(data: { recipient_ids: string[]; content: string; type?: string; metadata?: any }) {
    const token = await getToken();
    const API_BASE = getApiBase();

    const response = await axios.post(`${API_BASE}/messages/broadcast`, data, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
}
export async function fetchUsersByIds(ids: number[]) {
    const token = await getToken();
    const API_BASE = getApiBase();

    const response = await axios.post(`${API_BASE}/users/batch-lookup`, { ids }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.users || [];
}
