import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
// import NetInfo from '@react-native-netinfo/netinfo';
import NetInfo from '@react-native-community/netinfo';

interface CacheItem {
  data: any;
  timestamp: number;
  expiresIn: number; // milliseconds
}

class OfflineService {
  private static instance: OfflineService;
  private isOnline = true;
  private pendingOperations: Array<() => Promise<void>> = [];

  private constructor() {
    this.initializeNetworkListener();
  }

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  private initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (!wasOnline && this.isOnline) {
        this.syncPendingOperations();
      }
      
      if (wasOnline && !this.isOnline) {
        Alert.alert(
          'You\'re offline',
          'Some features may be limited. Your changes will sync when you reconnect.',
          [{ text: 'OK' }]
        );
      }
    });
  }

  async cacheData(key: string, data: any, expiresIn = 24 * 60 * 60 * 1000) {
    try {
      const cacheItem: CacheItem = {
        data,
        timestamp: Date.now(),
        expiresIn
      };
      
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.error('Cache error:', error);
    }
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`cache_${key}`);
      
      if (!cached) return null;
      
      const cacheItem: CacheItem = JSON.parse(cached);
      const isExpired = Date.now() - cacheItem.timestamp > cacheItem.expiresIn;
      
      if (isExpired) {
        await AsyncStorage.removeItem(`cache_${key}`);
        return null;
      }
      
      return cacheItem.data as T;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  async clearCache(key?: string) {
    try {
      if (key) {
        await AsyncStorage.removeItem(`cache_${key}`);
      } else {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(k => k.startsWith('cache_'));
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  async cacheUserSpaces(userId: string, spaces: any[]) {
    await this.cacheData(`user_${userId}_spaces`, spaces, 5 * 60 * 1000); // 5 minutes
  }

  async cacheUserChats(userId: string, chats: any[]) {
    await this.cacheData(`user_${userId}_chats`, chats, 2 * 60 * 1000); // 2 minutes
  }

  async getCachedUserSpaces(userId: string) {
    return this.getCachedData<any[]>(`user_${userId}_spaces`);
  }

  async getCachedUserChats(userId: string) {
    return this.getCachedData<any[]>(`user_${userId}_chats`);
  }

  async queueOperation(operation: () => Promise<void>) {
    if (this.isOnline) {
      try {
        await operation();
      } catch (error) {
        // Queue for retry
        this.pendingOperations.push(operation);
      }
    } else {
      this.pendingOperations.push(operation);
      Alert.alert(
        'Operation queued',
        'Your action will be completed when you reconnect to the internet.',
        [{ text: 'OK' }]
      );
    }
  }

  private async syncPendingOperations() {
    const operations = [...this.pendingOperations];
    this.pendingOperations = [];
    
    for (const operation of operations) {
      try {
        await operation();
      } catch (error) {
        console.error('Failed to sync operation:', error);
        // Re-queue failed operations
        this.pendingOperations.push(operation);
      }
    }
    
    if (operations.length > 0) {
      Alert.alert(
        'Sync complete',
        `${operations.length} operations were synced.`,
        [{ text: 'OK' }]
      );
    }
  }

  isConnected() {
    return this.isOnline;
  }
}

export default OfflineService;