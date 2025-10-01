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
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;

  // SINGLE CONNECTION - reuse the same Pusher instance
  initialize(token: string): boolean {
    try {
      // Prevent multiple initializations
      if (this.isInitialized && this.pusher) {
        console.log('ℹ️ Pusher already initialized, reusing connection');
        return true;
      }

      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        console.error('❌ Max connection attempts reached, giving up');
        return false;
      }

      // ✅ FIX: Check environment variables properly
      const pusherKey = process.env.EXPO_PUBLIC_PUSHER_APP_KEY;
      const pusherCluster = process.env.EXPO_PUBLIC_PUSHER_APP_CLUSTER;
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;

      if (!pusherKey || !pusherCluster || !apiUrl) {
        console.error('❌ Pusher environment variables missing:', {
          hasKey: !!pusherKey,
          hasCluster: !!pusherCluster,
          hasApiUrl: !!apiUrl
        });
        return false;
      }

      console.log('🔄 Initializing Pusher connection...');
      this.connectionAttempts++;

      // ✅ FIX: Web platform configuration
      this.pusher = new Pusher(pusherKey, {
        cluster: pusherCluster,
        forceTLS: true,
        authEndpoint: `${apiUrl}/broadcasting/auth`,
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
        // ✅ FIX: Web-specific configuration
        wsHost: `ws-${pusherCluster}.pusher.com`,
        wsPort: 80,
        wssPort: 443,
        enabledTransports: ['ws', 'wss'],
      });

      // Connection event handlers
      this.pusher.connection.bind('connected', () => {
        console.log('✅ Pusher connected successfully - Socket ID:', this.pusher?.connection.socket_id);
        this.isInitialized = true;
        this.connectionAttempts = 0;
      });

      this.pusher.connection.bind('error', (err: any) => {
        console.error('❌ Pusher connection error:', err);
        this.isInitialized = false;
      });

      this.pusher.connection.bind('disconnected', () => {
        console.log('🔌 Pusher disconnected');
        this.isInitialized = false;
      });

      return true;
    } catch (error) {
      console.error('❌ Pusher initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // OPTIMIZED: Subscribe to user notifications with ALL event types
subscribeToUserNotifications(userId: number, onNotification: (data: any) => void): boolean {
  if (!this.pusher || !this.isInitialized) {
    console.warn('⚠️ Pusher not initialized. Skipping notification subscription.');
    return false;
  }
  
  try {
    const channelName = `user.${userId}`;
    
    if (this.channels.has(channelName)) {
      console.log(`ℹ️ Already subscribed to user notifications: ${channelName}`);
      return true;
    }
    
    const channel = this.pusher.subscribe(channelName);
    
    // ✅ PROPERLY FORMAT NOTIFICATIONS FOR THE STORE
    channel.bind('new-comment', (data: any) => {
      console.log('💬 New comment notification received:', data);
      
      const notification = {
        type: 'comment',
        title: 'New Comment',
        message: `${data.comment.user?.name || 'Someone'} commented: "${data.comment.content?.substring(0, 30)}..."`,
        data: data,
        userId: data.comment.user_id,
        postId: data.postId,
        commentId: data.comment.id,
        avatar: data.comment.user?.profile_photo,
        createdAt: new Date()
      };
      
      console.log('💬 SENDING TO NOTIFICATION STORE:', notification);
      onNotification(notification);
    });
    
    // ✅ FIX: Update other bindings too if they use broadcastAs
    channel.bind('new-reaction', (data: any) => {
      console.log('❤️ New reaction notification:', data);
      
      const notification = {
        type: 'reaction',
        title: 'New Reaction',
        message: `${data.reaction.user?.name || 'Someone'} reacted with ${data.reaction.emoji}`,
        data: data,
        userId: data.reaction.user_id,
        postId: data.postId,
        avatar: data.reaction.user?.profile_photo,
        createdAt: new Date()
      };
      
      console.log('❤️ SENDING TO NOTIFICATION STORE:', notification);
      onNotification(notification);
    });

    channel.bind('comment-reaction', (data: any) => {
      console.log('💖 New comment reaction:', data);
      
      const notification = {
        type: data.type || 'comment_reaction',
        title: data.title || 'Comment Reaction',
        message: data.message || `${data.reaction.user?.name || 'Someone'} reacted to your comment with ${data.reaction.emoji}`,
        data: data,
        userId: data.reaction.user_id,
        postId: data.postId,
        commentId: data.reaction.comment_id,
        avatar: data.reaction.user?.profile_photo,
        createdAt: new Date()
      };
      
      console.log('💖 SENDING TO NOTIFICATION STORE:', notification);
      onNotification(notification);
    });

    channel.bind('new-follower', (data: any) => {
      console.log('👤 New follower:', data);
      
      const notification = {
        type: data.type || 'new_follower',
        title: data.title || 'New Follower',
        message: data.message || `${data.follower.name} started following you`,
        data: data,
        userId: data.follower.id,
        avatar: data.follower.profile_photo,
        createdAt: new Date()
      };
      
      console.log('👤 SENDING TO NOTIFICATION STORE:', notification);
      onNotification(notification);
    });

    channel.bind('new-post', (data: any) => {
      console.log('📝 New post from followed user:', data);
      
      const notification = {
        type: data.type || 'new_post',
        title: data.title || 'New Post',
        message: data.message || `${data.post.user.name} created a new post: "${data.post.content?.substring(0, 30)}..."`,
        data: data,
        userId: data.post.user_id,
        postId: data.post.id,
        avatar: data.post.user.profile_photo,
        createdAt: new Date()
      };
      
      console.log('📝 SENDING TO NOTIFICATION STORE:', notification);
      onNotification(notification);
    });

    // Add more event types as needed...

    channel.bind('pusher:subscription_succeeded', () => {
      console.log(`✅ SUBSCRIBED TO USER NOTIFICATIONS: ${channelName}`);
    });
    
    channel.bind('pusher:subscription_error', (error: any) => {
      console.error(`❌ NOTIFICATION SUBSCRIPTION ERROR:`, error);
    });
    
    this.channels.set(channelName, channel);
    return true;
  } catch (error) {
    console.error(`❌ ERROR SUBSCRIBING TO NOTIFICATIONS:`, error);
    return false;
  }
}

  // Make sure you have this method:
  unsubscribeFromUserNotifications(userId: number): void {
    const channelName = `user.${userId}`;
    this.unsubscribeFromChannel(channelName);
  }

  // In the same PusherService.ts - update posts global binding
  subscribeToPosts(postIds: number[], onNewComment: (data: any) => void, onNewReaction: (data: any) => void): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.warn('⚠️ Pusher not initialized. Skipping global posts subscription.');
      return false;
    }

    try {
      const channelName = `posts.global`;
      
      if (this.channels.has(channelName)) {
        console.log(`ℹ️ Already subscribed to global posts channel`);
        return true;
      }

      const channel = this.pusher.subscribe(channelName);
      
      // ✅ FIX: Use 'new-comment' here too
      channel.bind('new-comment', (data: any) => {
        // Only handle if it's for one of our posts
        if (postIds.includes(data.postId)) {
          console.log('💬 Global channel: Relevant comment for post:', data.postId);
          onNewComment(data);
        }
      });
      
      // ✅ FIX: Use 'new-reaction' if your reaction event uses broadcastAs
      channel.bind('new-reaction', (data: any) => {
        if (postIds.includes(data.postId)) {
          console.log('❤️ Global channel: Relevant reaction for post:', data.postId);
          onNewReaction(data);
        }
      });

      channel.bind('pusher:subscription_succeeded', () => {
        console.log(`✅ SUBSCRIBED TO GLOBAL POSTS CHANNEL for ${postIds.length} posts`);
      });
      
      this.channels.set(channelName, channel);
      return true;
    } catch (error) {
      console.error(`❌ ERROR SUBSCRIBING TO GLOBAL POSTS:`, error);
      return false;
    }
  }

  // Update post subscriptions when posts change
  updatePostSubscriptions(postIds: number[], onNewComment: (data: any) => void, onNewReaction: (data: any) => void): boolean {
    // First unsubscribe from old channel
    this.unsubscribeFromChannel('posts.global');
    
    // Then subscribe with new post list
    return this.subscribeToPosts(postIds, onNewComment, onNewReaction);
  }
  
  unsubscribeFromIndividualPost(postId: number): void {
    const channelName = `post.${postId}`;
    this.unsubscribeFromChannel(channelName);
  }
  // Generic unsubscribe method
  unsubscribeFromChannel(channelName: string): void {
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

  // Cleanup all subscriptions
  disconnect(): void {
    if (this.pusher) {
      try {
        // Unsubscribe from all channels first
        this.channels.forEach((channel, channelName) => {
          this.pusher?.unsubscribe(channelName);
        });
        
        this.channels.clear();
        this.pusher.disconnect();
        this.pusher = null;
        this.isInitialized = false;
        this.connectionAttempts = 0;
        console.log('✅ Pusher completely disconnected and cleaned up');
      } catch (error) {
        console.error('❌ Error disconnecting Pusher:', error);
      }
    }
  }

  // Get connection status
  isReady(): boolean {
    return this.isInitialized && this.pusher !== null;
  }

  // Get current socket ID for debugging
  getSocketId(): string | null {
    return this.pusher?.connection.socket_id || null;
  }

  // Get active channels for debugging
  getActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }
}

export default new PusherService();