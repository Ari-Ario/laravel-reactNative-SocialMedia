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
  private notificationCallbacks: Map<string, (data: any) => void> = new Map(); // ADD THIS

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

  // ADD THE MISSING METHOD HERE:
  subscribeToUserNotifications(userId: number, onNotification: (data: any) => void) {
    if (!this.pusher || !this.isInitialized) {
      console.warn('⚠️ Pusher not initialized. Skipping notification subscription.');
      return null;
    }
    
    try {
      const channelName = `user.${userId}`;
      
      // Check if already subscribed
      if (this.channels.has(channelName)) {
        console.log(`ℹ️ Already subscribed to user notifications: ${channelName}`);
        return this.channels.get(channelName);
      }
      
      const channel = this.pusher.subscribe(channelName);
      
      // Listen for various notification types
      channel.bind('App\\Events\\NewComment', (data: any) => {
        console.log('🔔 New comment notification received:', data);
        
        if (data.comment && data.comment.user) {
          onNotification({
            type: 'comment',
            title: 'New Comment',
            message: `${data.comment.user.name} commented on your post: "${data.comment.content?.substring(0, 30)}..."`,
            data: data,
            userId: data.comment.user_id,
            postId: data.postId,
            commentId: data.comment.id,
            avatar: data.comment.user.profile_photo,
            createdAt: new Date()
          });
        }
      });
      
      channel.bind('App\\Events\\NewReaction', (data: any) => {
        console.log('🔔 New reaction notification received:', data);
        
        if (data.reaction) {
          onNotification({
            type: 'reaction',
            title: 'New Reaction',
            message: `${data.reaction.user?.name || 'Someone'} reacted with ${data.reaction.emoji}`,
            data: data,
            userId: data.reaction.user_id,
            postId: data.postId,
            avatar: data.reaction.user?.profile_photo,
            createdAt: new Date()
          });
        }
      });

      channel.bind('pusher:subscription_succeeded', () => {
        console.log(`✅ Subscribed to user notifications: ${channelName}`);
      });
      
      channel.bind('pusher:subscription_error', (error: any) => {
        console.error(`❌ Notification subscription error:`, error);
      });
      
      this.channels.set(channelName, channel);
      this.notificationCallbacks.set(channelName, onNotification);
      
      return channel;
    } catch (error) {
      console.error(`❌ Error subscribing to notifications:`, error);
      return null;
    }
  }

  unsubscribeFromUserNotifications(userId: number) {
    const channelName = `user.${userId}`;
    const channel = this.channels.get(channelName);
    if (channel && this.pusher) {
      try {
        this.pusher.unsubscribe(channelName);
        this.channels.delete(channelName);
        this.notificationCallbacks.delete(channelName);
        console.log(`✅ Unsubscribed from user notifications: ${channelName}`);
      } catch (error) {
        console.error(`❌ Error unsubscribing from notifications:`, error);
      }
    }
  }

subscribeToPost(postId: number, onNewComment: (data: any) => void, onNewReaction: (data: any) => void) {
  // ADD VALIDATION AT THE START
  if (typeof onNewComment !== 'function' || typeof onNewReaction !== 'function') {
    console.error('❌ INVALID CALLBACKS PASSED TO subscribeToPost:', {
      postId,
      onNewCommentType: typeof onNewComment,
      onNewReactionType: typeof onNewReaction,
      onNewCommentValue: onNewComment,
      onNewReactionValue: onNewReaction
    });
    return null;
  }
  
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
    
    // FIX: Add callback validation and error handling
    channel.bind('new-comment', (data: any) => {
      console.log('🔍 RAW new-comment event received:', {
        dataType: typeof data,
        data: data,
        isObject: typeof data === 'object',
        isArray: Array.isArray(data),
        isNull: data === null,
        isUndefined: data === undefined
      });
      
      // Validate data structure before processing
      if (!data || typeof data !== 'object') {
        console.error('❌ Invalid new-comment data format:', data);
        return;
      }
      
      if (!data.comment || !data.postId) {
        console.error('❌ Missing required fields in new-comment data:', data);
        return;
      }
      
      console.log('✅ Valid new-comment data, processing...');
      
      // FIX: Check if callback is actually a function before calling
      if (typeof onNewComment === 'function') {
        try {
          onNewComment(data);
        } catch (error) {
          console.error('❌ Error in onNewComment callback:', error);
        }
      } else {
        console.error('❌ onNewComment is not a function:', typeof onNewComment);
        console.error('❌ onNewComment value:', onNewComment);
      }
    });
    
    channel.bind('new-reaction', (data: any) => {
      console.log('🔍 RAW new-reaction event received:', {
        dataType: typeof data,
        data: data,
        isObject: typeof data === 'object',
        isArray: Array.isArray(data),
        isNull: data === null,
        isUndefined: data === undefined
      });
      
      // Validate data structure before processing
      if (!data || typeof data !== 'object') {
        console.error('❌ Invalid new-reaction data format:', data);
        return;
      }
      
      if (!data.reaction || !data.postId) {
        console.error('❌ Missing required fields in new-reaction data:', data);
        return;
      }
      
      console.log('✅ Valid new-reaction data, processing...');
      
      // FIX: Check if callback is actually a function before calling
      if (typeof onNewReaction === 'function') {
        try {
          onNewReaction(data);
        } catch (error) {
          console.error('❌ Error in onNewReaction callback:', error);
        }
      } else {
        console.error('❌ onNewReaction is not a function:', typeof onNewReaction);
        console.error('❌ onNewReaction value:', onNewReaction);
      }
    });
    
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
        this.notificationCallbacks.clear();
        this.isInitialized = false;
        console.log('✅ Pusher disconnected');
      } catch (error) {
        console.error('❌ Error disconnecting Pusher:', error);
      }
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.pusher !== null;
  }
}

export default new PusherService();