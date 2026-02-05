// services/SearchServiceChat.ts
import Fuse from 'fuse.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from './TokenService';
import getApiBase from './getApiBase';

export interface SearchResult {
  id: string;
  type: 'space' | 'chat' | 'contact' | 'message' | 'post';
  title: string;
  description?: string;
  avatar?: string;
  timestamp?: string;
  relevance: number;
  data: any;
}

class SearchService {
  private static instance: SearchService;
  private fuseOptions: Fuse.IFuseOptions<any> = {
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'title', weight: 0.5 },
      { name: 'description', weight: 0.3 },
      { name: 'lastMessage', weight: 0.2 },
      { name: 'content', weight: 0.2 },
      { name: 'email', weight: 0.1 },
      { name: 'username', weight: 0.1 },
    ],
    threshold: 0.3,
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
  };

  private constructor() {}

  static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  async localSearch(query: string, items: any[]): Promise<SearchResult[]> {
    if (!query.trim() || items.length === 0) {
      return [];
    }

    const fuse = new Fuse(items, this.fuseOptions);
    const results = fuse.search(query);

    return results.map(result => ({
      id: result.item.id,
      type: result.item.type,
      title: result.item.name || result.item.title,
      description: result.item.description || result.item.lastMessage,
      avatar: result.item.avatar,
      timestamp: result.item.timestamp,
      relevance: 1 - (result.score || 0),
      data: result.item,
    }));
  }

  async searchAll(query: string, userId: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const token = await getToken();
    const API_BASE = getApiBase();

    console.log('Searching with:', {
      query,
      userId,
      apiBase: API_BASE,
      hasToken: !!token
    });

    try {
      const response = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          user_id: userId,
          types: ['spaces', 'chats', 'contacts'],
          limit: 20,
        }),
      });

      console.log('Search response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        // If it's a 401, token might be invalid
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Search results:', data);
      
      return data.results || [];

    } catch (error) {
      console.error('Search API error:', error);
      
      // Fallback to local search
      console.log('Falling back to local search...');
      return this.fallbackLocalSearch(query, userId);
    }
  }

  private async fallbackLocalSearch(query: string, userId: string): Promise<SearchResult[]> {
    try {
      // Try to load cached data
      const cachedSpaces = await this.getCachedSpaces(userId);
      const cachedChats = await this.getCachedChats(userId);
      const cachedContacts = await this.getCachedContacts(userId);

      const allItems = [
        ...(cachedSpaces || []).map(item => ({ ...item, type: 'space' })),
        ...(cachedChats || []).map(item => ({ ...item, type: 'chat' })),
        ...(cachedContacts || []).map(item => ({ ...item, type: 'contact' })),
      ];

      console.log('Local search items:', allItems.length);
      
      return this.localSearch(query, allItems);
    } catch (error) {
      console.error('Local search error:', error);
      return [];
    }
  }

  private async getCachedSpaces(userId: string) {
    try {
      const cached = await AsyncStorage.getItem(`search_cache_spaces_${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Get cached spaces error:', error);
      return null;
    }
  }

  private async getCachedChats(userId: string) {
    try {
      const cached = await AsyncStorage.getItem(`search_cache_chats_${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Get cached chats error:', error);
      return null;
    }
  }

  private async getCachedContacts(userId: string) {
    try {
      const cached = await AsyncStorage.getItem(`search_cache_contacts_${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Get cached contacts error:', error);
      return null;
    }
  }

  async cacheSearchData(userId: string, data: any[]) {
    try {
      // Categorize data
      const spaces = data.filter(item => item.type === 'space');
      const chats = data.filter(item => item.type === 'chat');
      const contacts = data.filter(item => item.type === 'contact');

      await Promise.all([
        AsyncStorage.setItem(`search_cache_spaces_${userId}`, JSON.stringify(spaces)),
        AsyncStorage.setItem(`search_cache_chats_${userId}`, JSON.stringify(chats)),
        AsyncStorage.setItem(`search_cache_contacts_${userId}`, JSON.stringify(contacts)),
      ]);
      
      console.log('Search data cached successfully');
    } catch (error) {
      console.error('Cache search data error:', error);
    }
  }

  async clearSearchCache(userId?: string) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => 
        k.startsWith('search_cache') && 
        (!userId || k.includes(userId))
      );
      await AsyncStorage.multiRemove(cacheKeys);
      console.log('Search cache cleared');
    } catch (error) {
      console.error('Clear search cache error:', error);
    }
  }
}

export default SearchService;