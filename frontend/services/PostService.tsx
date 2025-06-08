// services/PostService.tsx
import axios from "@/services/axios";
import { getToken } from "./TokenService";
import getApiBase from "./getApiBase";

export async function fetchPosts() {
    const token = await getToken();
    const API_BASE = getApiBase();
    const url = `${API_BASE}/posts`;
    
    const response = await axios.get(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    
    if (!response.data) {
        throw new Error('Failed to fetch posts');
    }
    
    return response.data.data; // Return the posts array
}

export async function createPost(formData) {
    const token = await getToken();
    const API_BASE = getApiBase();
    const url = (API_BASE === 'http://127.0.0.1:8000/api') ? '/posts' : `${API_BASE}/posts`;
    console.log(formData)

  const response = await axios.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
}

export async function deletePostMedia(postId: number, mediaId: number) {
    const token = await getToken();
    const API_BASE = getApiBase();
    
    const response = await axios.delete(`${API_BASE}/posts/${postId}/media/${mediaId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    
    return response.data;
}

export async function updatePost(postId: number, formData: FormData) {
    const token = await getToken();
    const API_BASE = getApiBase();
    
    // For Laravel to handle as PUT request
    formData.append('_method', 'PUT');
    
    const response = await axios.post(`${API_BASE}/posts/${postId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
        },
    });
    
    return response.data;
}

export async function deletePost(postId: number) {
    const token = await getToken();
    const API_BASE = getApiBase();
    
    try {
        const response = await axios.delete(`${API_BASE}/posts/${postId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        // Simple error handling that works universally
        const errorMessage = error.response?.data?.message || 
                           error.message || 
                           'Failed to delete post';
        console.error('Delete post error:', {
            status: error.response?.status,
            message: errorMessage,
            error: error
        });
        throw new Error(errorMessage);
    }
}

export async function fetchPost(postId: number) {
    const token = await getToken();
    const API_BASE = getApiBase();
    const response = await axios.get(`${API_BASE}/posts/${postId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data;
}

export async function reactToPost(postId: number, emoji: string) {
    const token = await getToken();
    const API_BASE = getApiBase();
    const response = await axios.post(`${API_BASE}/posts/${postId}/react`, 
        { emoji },
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return response.data;
}

export async function commentOnPost(postId: number, content: string, parentId?: number) {
    const token = await getToken();
    const API_BASE = getApiBase();
    const response = await axios.post(`${API_BASE}/posts/${postId}/comment`, 
        { content, parent_id: parentId },
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return response.data;
}

export async function repostPost(postId: number): Promise<{
  reposted: boolean;
  reposts_count: number;
  repost_user?: {
    id: number;
    name: string;
    avatar_url: string | null;
  };
}> {
  const token = await getToken();
  const API_BASE = getApiBase();
  try {
    const response = await axios.post(
      `${API_BASE}/posts/${postId}/repost`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error in repostPost:', error);
    throw error;
  }
}

export async function sharePost(postId: number) {
    const token = await getToken();
    const API_BASE = getApiBase();
    const response = await axios.post(`${API_BASE}/posts/${postId}/share`, 
        {},
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return response.data;
}

export async function bookmarkPost(postId: number) {
    const token = await getToken();
    const API_BASE = getApiBase();
    const response = await axios.post(`${API_BASE}/posts/${postId}/bookmark`, 
        {},
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return response.data;
}


export async function reportPost(postId: number, reason: string) {
    const token = await getToken();
    const API_BASE = getApiBase();
    const response = await axios.post(`${API_BASE}/posts/${postId}/report`, 
        { reason },
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return response.data;
}