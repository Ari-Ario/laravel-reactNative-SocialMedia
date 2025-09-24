import Pusher from 'pusher-js';

// Set up Pusher for React Native
(Pusher as any).Runtime.createXHR = function() {
  return new XMLHttpRequest();
};

(Pusher as any).Runtime.createWebSocket = function(url: string) {
  return new WebSocket(url);
};

class PusherService {
  private pusher: Pusher | null = null;
  private channels: Map<string, Pusher.Channel> = new Map();
  private isInitialized = false;

  initialize(token: string) {
    try {
      if (!process.env.EXPO_PUBLIC_PUSHER_APP_KEY || !process.env.EXPO_PUBLIC_PUSHER_APP_CLUSTER) {
        console.error('❌ Pusher environment variables missing');
        return null;
      }

      this.pusher = new Pusher(process.env.EXPO_PUBLIC_PUSHER_APP_KEY, {
        cluster: process.env.EXPO_PUBLIC_PUSHER_APP_CLUSTER,
        forceTLS: true,
        authEndpoint: `${process.env.EXPO_PUBLIC_API_URL}/broadcasting/auth`,
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      });

      // Log connection events
      this.pusher.connection.bind('connected', () => {
        console.log('✅ Pusher connected successfully');
        this.isInitialized = true;
      });

      this.pusher.connection.bind('error', (err: any) => {
        console.error('❌ Pusher connection error:', err);
        this.isInitialized = false;
      });

      this.pusher.connection.bind('disconnected', () => {
        console.log('🔌 Pusher disconnected');
        this.isInitialized = false;
      });

      return this.pusher;
    } catch (error) {
      console.error('❌ Pusher initialization failed:', error);
      return null;
    }
  }

  subscribeToPost(postId: number, onNewComment: (data: any) => void, onNewReaction: (data: any) => void) {
    if (!this.pusher || !this.isInitialized) {
      console.warn('⚠️ Pusher not initialized. Skipping subscription.');
      return null;
    }
    
    try {
      const channelName = `post.${postId}`;
      
      // Check if already subscribed
      if (this.channels.has(channelName)) {
        console.log(`ℹ️ Already subscribed to channel: ${channelName}`);
        return this.channels.get(channelName);
      }
      
      const channel = this.pusher.subscribe(channelName);
      
      channel.bind('new-comment', onNewComment);
      channel.bind('new-reaction', onNewReaction);
      
      channel.bind('pusher:subscription_succeeded', () => {
        console.log(`✅ Subscribed to channel: ${channelName}`);
      });
      
      channel.bind('pusher:subscription_error', (error: any) => {
        console.error(`❌ Subscription error for ${channelName}:`, error);
      });
      
      this.channels.set(channelName, channel);
      return channel;
    } catch (error) {
      console.error(`❌ Error subscribing to post ${postId}:`, error);
      return null;
    }
  }

  unsubscribeFromPost(postId: number) {
    const channelName = `post.${postId}`;
    const channel = this.channels.get(channelName);
    if (channel && this.pusher) {
      try {
        this.pusher.unsubscribe(channelName);
        this.channels.delete(channelName);
        console.log(`✅ Unsubscribed from channel: ${channelName}`);
      } catch (error) {
        console.error(`❌ Error unsubscribing from ${channelName}:`, error);
      }
    }
  }

  disconnect() {
    if (this.pusher) {
      try {
        this.pusher.disconnect();
        this.pusher = null;
        this.channels.clear();
        this.isInitialized = false;
        console.log('✅ Pusher disconnected');
      } catch (error) {
        console.error('❌ Error disconnecting Pusher:', error);
      }
    }
  }

  // Add a method to check initialization status
  isReady(): boolean {
    return this.isInitialized && this.pusher !== null;
  }
}

export default new PusherService();