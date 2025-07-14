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
    // console.log('data back in PostService: ',response.data.data)
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
    // console.log(response.data)
    
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

export const reactToPost = async (
  postId: number,
  emoji: string,
  commentId?: number
): Promise<{ reaction: Reaction }> => {
  const token = await getToken();
  const API_BASE = getApiBase();

  try {
    const response = await axios.post(
      `${API_BASE}/posts/${postId}/react`,
      { emoji, comment_id: postId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      }
    );

    if (!response.data?.reaction) {
      throw new Error('Invalid response structure');
    }

    return response.data;
  } catch (error) {
    console.error('API reaction error:', {
      error,
      postId,
      commentId,
      emoji
    });
    throw error;
  }
};

export const deleteReactionFromPost = async (
  postId: number,
  commentId?: number
): Promise<{ success: boolean; reaction_counts?: ReactionCount[] }> => {
  const token = await getToken();
  const API_BASE = getApiBase();

  try {
    const endpoint = commentId 
      ? `${API_BASE}/comments/${commentId}/deletereaction`
      : `${API_BASE}/posts/${postId}/deletereaction`;

    const response = await axios.post(  // Changed from DELETE to POST
      endpoint,
      {},  // Empty body since your route doesn't expect any data
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.success !== true) {
      throw new Error('Failed to delete reaction');
    }

    return response.data;
  } catch (error) {
    console.error('API delete reaction error:', {
      error,
      postId,
      commentId
    });
    throw error;
  }
};

export const reactToComment = async (
  postId: number,
  commentId: number,
  emoji: string
): Promise<{
  comment(postId: number, commentId: number, comment: any): unknown; reaction: Reaction 
}> => {
  const token = await getToken();
  const API_BASE = getApiBase();

  try {
    const response = await axios.post(
      `${API_BASE}/comments/${commentId}/react`,
      { emoji, comment_id: commentId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      }
    );

    if (!response.data?.reaction) {
      throw new Error('Invalid response structure');
    }
    console.log('Returned Data of changing reaction to Comment: ' ,response.data)
    return response.data;
  } catch (error) {
    console.error('API reaction error:', {
      error,
      postId,
      commentId,
      emoji
    });
    throw error;
  }
};

export const deleteReactionFromComment = async (
  commentId: number
): Promise<{ 
  success: boolean; 
  reaction_counts?: ReactionCount[];
  reaction_comments_count?: number;
}> => {
  const token = await getToken();
  const API_BASE = getApiBase();

  try {
    const response = await axios.post(
      `${API_BASE}/comments/${commentId}/deletereaction`,
      {}, // Empty body
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.success !== true) {
      throw new Error('Failed to delete comment reaction');
    }
    console.log(response.data)
    return response.data;
  } catch (error) {
    console.error('API delete comment reaction error:', {
      error,
      commentId
    });
    throw error;
  }
};


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

export async function deleteComment(postId: number, commentId: number) {
  const token = await getToken();
  const API_BASE = getApiBase();
  
  try {
    const response = await axios.delete(
      `${API_BASE}/posts/${postId}/comments/${commentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    if (response.data.success) {
      return response.data;
    } else {
      throw new Error(response.data.message || 'Failed to delete comment');
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw new Error('Failed to delete comment');
  }
}