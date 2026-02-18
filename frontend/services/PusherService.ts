import Pusher from 'pusher-js';
import { Platform } from 'react-native';
import getApiBase from '@/services/getApiBase';
import { get } from 'react-native/Libraries/TurboModule/TurboModuleRegistry';

// Set up Pusher for React Native
(Pusher as any).Runtime.createXHR = function () {
  return new XMLHttpRequest();
};

(Pusher as any).Runtime.createWebSocket = function (url: string) {
  return new WebSocket(url);
};

class PusherService {
  private pusher: Pusher | null = null;
  private channels: Map<string, any> = new Map();
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

      const pusherKey = process.env.EXPO_PUBLIC_PUSHER_APP_KEY;
      const pusherCluster = process.env.EXPO_PUBLIC_PUSHER_APP_CLUSTER;
      const apiUrl = getApiBase();

      if (!pusherKey || !pusherCluster || !apiUrl) {
        console.error('❌ Pusher environment variables missing');
        return false;
      }

      console.log('🔄 Initializing Pusher connection...');
      this.connectionAttempts++;

      // ✅ FIX: Add authorizer for presence channels
      this.pusher = new Pusher(pusherKey, {
        cluster: pusherCluster,
        forceTLS: true,
        authorizer: (channel, options) => {
          return {
            authorize: (socketId, callback) => {
              console.log(`🔐 Authorizing channel: ${channel.name} with socket: ${socketId}`);
              console.log(`🔐 Using token: ${token.substring(0, 20)}...`); // Log partial token

              fetch(`${apiUrl}/broadcasting/auth`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  socket_id: socketId,
                  channel_name: channel.name
                })
              })
                .then(response => {
                  console.log(`📡 Auth response status: ${response.status}`);
                  if (!response.ok) {
                    return response.text().then(text => {
                      console.error(`❌ Auth failed with status ${response.status}:`, text);
                      throw new Error(`Auth failed: ${response.status} - ${text}`);
                    });
                  }
                  return response.json();
                })
                .then(data => {
                  console.log(`✅ Channel authorized: ${channel.name}`);
                  callback(null, data);
                })
                .catch(error => {
                  console.error(`❌ Channel authorization failed: ${channel.name}`, error);
                  callback(error, null);
                });
            }
          };
        },
        // Web-specific configuration
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
          type: data.type || 'comment',
          title: data.title || 'New Comment',
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
          type: data.type || 'reaction',
          title: data.title || 'New Reaction',
          message: `${data.reaction.user?.name || 'Someone'} reacted with ${data.reaction.emoji} on post: "${data.reaction.post.caption.substring(0, 50)}..."`,
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
          message: `${data.reaction.user?.name || 'Someone'} reacted to your comment "${data.reaction.comment.content.substring(0, 50)}..." with ${data.reaction.emoji}` || data.message,
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
          userId: data.followerId,
          avatar: data.profile_photo || null,
          createdAt: new Date()
        };

        console.log('👤 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification);
      });

      channel.bind('new-post', (data: any) => {
        console.log('📝 New post notification:', data);

        const notification = {
          type: data.type || 'new_post',
          title: data.title || 'New Post',
          message: `${data.post.user.name} created a new post: ${data.post.caption.substring(0, 30)}...` || data.message,
          data: data,
          userId: data.post.user_id,
          postId: data.post.id,
          avatar: data.post.user.profile_photo,
          createdAt: new Date()
        };

        console.log('📝 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification);
      });

      channel.bind('post-updated', (data: any) => {
        console.log('✏️ Post updated notification:', data);

        const notification = {
          type: data.type || 'post_updated',
          title: data.title || 'Post Updated',
          message: `${data.userName} updated a post : ${data.changes.caption?.new.substring(0, 30)}...` || data.message,
          data: data,
          userId: data.userId,    // ✅ Use userId instead of data.post.user_id
          postId: data.postId,    // ✅ Use postId instead of data.post.id
          avatar: data.profile_photo,           // Your current event doesn't send avatar
          createdAt: new Date()
        };

        console.log('✏️ SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification);
      });

      channel.bind('post-deleted', (data: any) => {
        console.log('✏️ Post deleted notification:', data);

        const notification = {
          type: data.type || 'post_deleted',
          title: data.title || 'Post deleted',
          message: `${data.userName} deleted post: ${data.postCaption}` || data.message,
          data: data,
          userId: data.userId,
          postId: data.postId,
          avatar: data.profile_photo,
          createdAt: new Date()
        };

        console.log('✏️ SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification);
      });

      channel.bind('chatbot-training-needed', (data: any) => {
        console.log('🤖 Chatbot training notification (user channel):', data);

        const notification = {
          id: data.id || `chatbot-${Date.now()}-${Math.random()}`,
          type: data.type || 'chatbot_training',
          title: data.title || 'Chatbot Training Needed',
          message: `New training data: "${data.question}"` || data.message.substring(0, 60) + '...',
          data: data,
          question: data.question,
          category: data.category,
          keywords: data.keywords,
          timestamp: new Date(data.timestamp),
          createdAt: new Date(),
          $isRead: false,
        };

        console.log('🤖 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification);
      });

      // ==================== ADDITIONAL NOTIFICATIONS FOR CHAT PAGE ====================
      // ==================== CHAT PAGE NOTIFICATIONS ====================

      // Space invitations
      channel.bind('space-invitation', (data: any) => {
        console.log('📨 Space invitation received:', data);
        const notification = {
          type: data.type || 'space_invitation',
          title: data.title || 'Space Invitation',
          message: `${data.invited_by?.name || 'Someone'} invited you to join "${data.space?.title}"`,
          data: data,
          spaceId: data.space?.id,
          userId: data.invited_by?.id,
          avatar: data.invited_by?.profile_photo,
          createdAt: new Date()
        };
        console.log('📨 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification); // ✅ ADD THIS LINE
      });

      // Call started
      channel.bind('call-started', (data: any) => {
        console.log('📞 Call started notification:', data);
        const notification = {
          type: 'call_started',
          title: 'Incoming Call',
          message: `${data.user?.name || 'Someone'} started a ${data.call?.type || 'video'} call in "${data.space?.title}"`,
          data: data,
          spaceId: data.space_id,
          callId: data.call?.id,
          userId: data.user?.id,
          avatar: data.user?.profile_photo,
          createdAt: new Date()
        };
        console.log('📞 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification); // ✅ ADD THIS LINE
      });

      // New message in space (for users not currently in the space)
      channel.bind('message.sent', (data: any) => {
        console.log('💬 New message notification:', data);
        const notification = {
          type: data.type || 'new_message',
          title: data.title || 'New Message',
          message: `${data.user?.name || 'Someone'}: ${data.message?.content?.substring(0, 50)}...`,
          data: data,
          spaceId: data.space_id,
          messageId: data.message?.id,
          userId: data.user?.id,
          avatar: data.message?.user?.profile_photo,
          createdAt: new Date()
        };
        console.log('💬 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification); // ✅ ADD THIS LINE
      });

      // Participant joined space
      channel.bind('participant-joined', (data: any) => {
        console.log('👤 Participant joined notification:', data);
        const notification = {
          type: data.type || 'participant_joined',
          title: data.title || 'New Participant',
          message: `${data.user?.name || 'Someone'} joined "${data.space?.title}"`,
          data: data,
          spaceId: data.space_id,
          userId: data.user?.id,
          avatar: data.user?.profile_photo,
          createdAt: new Date()
        };
        console.log('👤 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification); // ✅ ADD THIS LINE
      });

      // Magic event triggered
      channel.bind('magic-triggered', (data: any) => {
        console.log('✨ Magic event notification:', data);
        const notification = {
          type: data.type || 'magic_event',
          title: data.title || '✨ Magic Discovered!',
          message: `A ${data.event?.event_type || 'magic'} event occurred in "${data.space?.title}"`,
          data: data,
          spaceId: data.space_id,
          eventId: data.event?.id,
          userId: data.triggered_by,
          createdAt: new Date()
        };
        console.log('✨ SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification); // ✅ ADD THIS LINE
      });

      // Screen share started
      channel.bind('screen-share-started', (data: any) => {
        console.log('🖥️ Screen share notification:', data);
        const notification = {
          type: data.type || 'screen_share',
          title: data.title || 'Screen Sharing',
          message: `${data.user?.name || 'Someone'} started sharing screen in "${data.space?.title}"`,
          data: data,
          spaceId: data.space_id,
          userId: data.user?.id,
          avatar: data.user?.profile_photo,
          createdAt: new Date()
        };
        console.log('🖥️ SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification); // ✅ ADD THIS LINE
      });

      // New collaborative activity
      channel.bind('activity.created', (data: any) => {
        console.log('📅 New activity notification:', data);
        const notification = {
          type: data.type || 'activity_created',
          title: data.title || 'New Activity',
          message: `${data.creator?.name || 'Someone'} created "${data.activity?.title}" in "${data.space?.title}"`,
          data: data,
          spaceId: data.space_id,
          activityId: data.activity?.id,
          userId: data.creator?.id,
          avatar: data.creator?.profile_photo,
          createdAt: new Date()
        };
        console.log('📅 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification); // ✅ ADD THIS LINE
      });
      // ==================== END OF CHAT PAGE NOTIFICATIONS ====================


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

  // UPDATED: Enhanced posts.global subscription with all event types
  subscribeToPosts(
    postIds: number[],
    onNewComment: (data: any) => void,
    onNewReaction: (data: any) => void,
    onCommentReaction: (data: any) => void,
    onNewPost: (data: any) => void,
    onPostUpdated: (data: any) => void,
    onPostDeleted: (data: any) => void
  ): boolean {
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

      // Comments
      channel.bind('new-comment', (data: any) => {
        if (postIds.includes(data.postId)) {
          console.log('💬 Global channel: Relevant comment for post:', data.postId);
          onNewComment(data);
        }
      });

      // Post Reactions
      channel.bind('new-reaction', (data: any) => {
        if (postIds.includes(data.postId)) {
          console.log('❤️ Global channel: Relevant reaction for post:', data.postId);
          onNewReaction(data);
        }
      });

      // New Posts
      channel.bind('new-post', (data: any) => {
        console.log('📝 Global channel: New post received:', data.post?.id);
        onNewPost(data);
      });

      // Comment Reactions
      channel.bind('comment-reaction', (data: any) => {
        if (postIds.includes(data.postId)) {
          console.log('💖 Global channel: Relevant comment reaction for post:', data.postId);
          onCommentReaction(data);
        }
      });


      // Post Updates
      channel.bind('post-updated', (data: any) => {
        if (postIds.includes(data.postId)) {
          console.log('✏️ Global channel: Post updated:', data.postId);
          onPostUpdated(data);
        }
      });

      // Post Deletions
      channel.bind('post-deleted', (data: any) => {
        if (postIds.includes(data.postId)) {
          console.log('🗑️ Global channel: Post deleted:', data.postId);
          onPostDeleted(data);
        }
      });

      // Chatbot Training (if relevant to posts)
      channel.bind('chatbot-training-needed', (data: any) => {
        console.log('🤖 Global channel: Chatbot training needed');
        // You might want to handle this differently for posts channel
      });

      channel.bind('pusher:subscription_succeeded', () => {
        console.log(`✅ SUBSCRIBED TO GLOBAL POSTS CHANNEL for ${postIds.length} posts`);
      });

      channel.bind('pusher:subscription_error', (error: any) => {
        console.error(`❌ GLOBAL POSTS SUBSCRIPTION ERROR:`, error);
      });

      this.channels.set(channelName, channel);
      return true;
    } catch (error) {
      console.error(`❌ ERROR SUBSCRIBING TO GLOBAL POSTS:`, error);
      return false;
    }
  }

  // Update post subscriptions when posts change
  updatePostSubscriptions(
    postIds: number[],
    onNewComment: (data: any) => void,
    onNewReaction: (data: any) => void,
    onCommentReaction: (data: any) => void,
    onNewPost: (data: any) => void,
    onPostUpdated: (data: any) => void,
    onPostDeleted: (data: any) => void
  ): boolean {
    // First unsubscribe from old channel
    this.unsubscribeFromChannel('posts.global');

    // Then subscribe with new post list
    return this.subscribeToPosts(
      postIds,
      onNewComment,
      onNewReaction,
      onCommentReaction,
      onNewPost,
      onPostUpdated,
      onPostDeleted
    );
  }

  unsubscribeFromIndividualPost(postId: number): void {
    const channelName = `post.${postId}`;
    this.unsubscribeFromChannel(channelName);
  }


  // subscribing to spces
  subscribeToSpace(spaceId: string, callbacks: {
    onSpaceUpdate?: (data: any) => void;
    onParticipantJoined?: (data: any) => void;
    onParticipantLeft?: (data: any) => void;
    onMessage?: (data: any) => void;
    onCallStarted?: (data: any) => void;
    onCallEnded?: (data: any) => void;
    onMagicEvent?: (data: any) => void;
    onScreenShareStarted?: (data: any) => void;
    onScreenShareEnded?: (data: any) => void;
  }): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.warn('⚠️ Pusher not initialized. Skipping space subscription.');
      return false;
    }

    const channelName = `presence-space.${spaceId}`;

    if (this.channels.has(channelName)) {
      console.log(`ℹ️ Already subscribed to space: ${channelName}`);
      return true;
    }

    console.log(`🔌 Subscribing to space channel: ${channelName}`);
    const channel = this.pusher.subscribe(channelName);

    // Bind all space events
    if (callbacks.onSpaceUpdate) {
      channel.bind('space.updated', callbacks.onSpaceUpdate);
    }

    if (callbacks.onParticipantJoined) {
      channel.bind('participant.joined', callbacks.onParticipantJoined);
    }

    if (callbacks.onParticipantLeft) {
      channel.bind('participant.left', callbacks.onParticipantLeft);
    }

    if (callbacks.onMessage) {
      channel.bind('message.sent', callbacks.onMessage);
    }

    if (callbacks.onCallStarted) {
      channel.bind('call.started', callbacks.onCallStarted);
    }

    if (callbacks.onCallEnded) {
      channel.bind('call.ended', callbacks.onCallEnded);
    }

    if (callbacks.onMagicEvent) {
      channel.bind('magic.triggered', callbacks.onMagicEvent);
    }

    if (callbacks.onScreenShareStarted) {
      channel.bind('screen_share.started', callbacks.onScreenShareStarted);
    }

    if (callbacks.onScreenShareEnded) {
      channel.bind('screen_share.ended', callbacks.onScreenShareEnded);
    }

    channel.bind('pusher:subscription_succeeded', () => {
      console.log(`✅ Successfully subscribed to space: ${channelName}`);
    });

    channel.bind('pusher:subscription_error', (error: any) => {
      console.error(`❌ Subscription error for space ${channelName}:`, error);
    });

    this.channels.set(channelName, channel);
    return true;
  }

  // ✅ NEW: Subscribe to global spaces channel
  subscribeToAllSpaces(onSpaceUpdated: (data: any) => void): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.warn('⚠️ Pusher not initialized. Skipping global spaces subscription.');
      return false;
    }

    try {
      const channelName = 'spaces';

      if (this.channels.has(channelName)) {
        console.log(`ℹ️ Already subscribed to global spaces channel`);
        return true;
      }

      console.log(`🔌 Subscribing to global spaces channel: ${channelName}`);
      const channel = this.pusher.subscribe(channelName);

      channel.bind('presence-space.updated', (data: any) => {
        console.log('🪐 Global space update received:', data);
        onSpaceUpdated(data);
      });

      channel.bind('pusher:subscription_succeeded', () => {
        console.log(`✅ SUBSCRIBED TO GLOBAL SPACES CHANNEL`);
      });

      channel.bind('pusher:subscription_error', (error: any) => {
        console.error(`❌ GLOBAL SPACES SUBSCRIPTION ERROR:`, error);
      });

      this.channels.set(channelName, channel);
      return true;
    } catch (error) {
      console.error(`❌ ERROR SUBSCRIBING TO GLOBAL SPACES:`, error);
      return false;
    }
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