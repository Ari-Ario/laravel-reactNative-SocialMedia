import axios from "@/services/axios";
import { getToken } from "./TokenService";
import getApiBase from "./getApiBase";

export interface MarketItem {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  price: string;
  currency: string;
  condition: string;
  category: string | null;
  status: string;
  delivery_available: boolean;
  location: any | null;
  views: number;
  created_at: string;
  updated_at: string;
  user: any;
  media: any[];
  comments?: any[];
  reactions?: any[];
  reaction_counts?: any[];
  reposts?: any[];
  bookmarks?: any[];
}

export async function fetchMarketItems(page: number = 1, category?: string, search?: string) {
  const token = await getToken();
  const API_BASE = getApiBase();
  let url = `${API_BASE}/market?page=${page}`;
  if (category && category !== 'all') {
    url += `&category=${category}`;
  }
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function fetchMyMarketItems(page: number = 1, search?: string) {
  const token = await getToken();
  const API_BASE = getApiBase();
  let url = `${API_BASE}/market/my-items?page=${page}`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function fetchMarketItemById(id: number): Promise<MarketItem> {
  const token = await getToken();
  const API_BASE = getApiBase();
  const response = await axios.get(`${API_BASE}/market/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function createMarketItem(formData: FormData): Promise<MarketItem> {
  const token = await getToken();
  const API_BASE = getApiBase();
  const response = await axios.post(`${API_BASE}/market`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function updateMarketItem(id: number, data: any): Promise<MarketItem> {
  const token = await getToken();
  const API_BASE = getApiBase();

  if (data instanceof FormData) {
    // Laravel requires _method trick for PUT with multipart/form-data
    if (!data.has('_method')) {
      data.append('_method', 'PUT');
    }
    const response = await axios.post(`${API_BASE}/market/${id}`, data, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      }
    });
    return response.data;
  }
  
  const response = await axios.put(`${API_BASE}/market/${id}`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function deleteMarketItem(id: number): Promise<void> {
  const token = await getToken();
  const API_BASE = getApiBase();
  await axios.delete(`${API_BASE}/market/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept': 'application/json',
    }
  });
}

export async function startItemChat(id: number): Promise<any> {
  const token = await getToken();
  const API_BASE = getApiBase();
  const response = await axios.post(`${API_BASE}/market/${id}/chat`, {}, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function reactToMarketItem(id: number, emoji: string): Promise<any> {
  const token = await getToken();
  const API_BASE = getApiBase();
  const response = await axios.post(`${API_BASE}/market/${id}/react`, { emoji }, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function deleteMarketItemReaction(id: number): Promise<any> {
  const token = await getToken();
  const API_BASE = getApiBase();
  const response = await axios.post(`${API_BASE}/market/${id}/deletereaction`, {}, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function addMarketItemComment(id: number, content: string, parentId?: number): Promise<any> {
  const token = await getToken();
  const API_BASE = getApiBase();
  const response = await axios.post(`${API_BASE}/market/${id}/comment`, { content, parent_id: parentId }, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function deleteMarketItemComment(itemId: number, commentId: number): Promise<any> {
  const token = await getToken();
  const API_BASE = getApiBase();
  const response = await axios.delete(`${API_BASE}/market/${itemId}/comments/${commentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function reactToComment(commentId: number, emoji: string): Promise<any> {
  const token = await getToken();
  const API_BASE = getApiBase();
  const response = await axios.post(`${API_BASE}/comments/${commentId}/react`, { emoji }, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function deleteCommentReaction(commentId: number): Promise<any> {
  const token = await getToken();
  const API_BASE = getApiBase();
  const response = await axios.post(`${API_BASE}/comments/${commentId}/deletereaction`, {}, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function bookmarkMarketItem(id: number, collection?: string, note?: string): Promise<any> {
  const token = await getToken();
  const API_BASE = getApiBase();
  const response = await axios.post(`${API_BASE}/market/${id}/bookmark`, { collection, note }, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}

export async function repostMarketItem(id: number, context_tag?: string, personal_note?: string): Promise<any> {
  const token = await getToken();
  const API_BASE = getApiBase();
  const response = await axios.post(`${API_BASE}/market/${id}/repost`, { context_tag, personal_note }, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return response.data;
}
