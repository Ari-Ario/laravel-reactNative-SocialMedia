import { Platform } from 'react-native';
import getApiBase from '@/services/getApiBase';

// Pusher type for TypeScript only (no runtime import at module level)
type PusherType = InstanceType<typeof import('pusher-js').default>;

class PusherService {
  private pusher: PusherType | null = null;
  private channels: Map<string, any> = new Map();
  private isInitialized = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private pendingSubscriptions: Array<() => void> = []; // ✅ Queue for early subscriptions

  initialize(token: string): boolean {
    // Guard: skip during SSR (Node.js has no window)
    if (typeof window === 'undefined') {
      return false;
    }
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

      // Dynamically import pusher-js to avoid SSR window crash
      import('pusher-js').then((mod) => {
        const Pusher = mod.default;

        // Set up React Native XHR/WebSocket overrides
        (Pusher as any).Runtime.createXHR = () => new XMLHttpRequest();
        (Pusher as any).Runtime.createWebSocket = (url: string) => new WebSocket(url);
        // ✅ FIX: Add authorizer for presence channels
        this.pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
          forceTLS: true,
          authorizer: (channel: any, options: any) => {
            return {
              authorize: (socketId: string, callback: Function) => {
                // Ensure we hit the correct auth endpoint. Laravel's Broadcast::routes() 
                // by default registers at /broadcasting/auth. 
                // If it's not under /api, we should use the root URL.
                const authUrl = apiUrl.endsWith('/api')
                  ? `${apiUrl}/broadcasting/auth` // If registered in routes/api.php
                  : `${apiUrl.split('/api')[0] || ''}/broadcasting/auth`; // If registered in BroadcastServiceProvider

                console.log(`🔐 Authorizing channel: ${channel.name} with socket: ${socketId}`);
                console.log(`🔐 Using token: ${token ? token.substring(0, 20) + '...' : 'MISSING'}`);
                console.log(`📡 Auth endpoint: ${authUrl}`);

                fetch(authUrl, {
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
                  .catch((error: any) => {
                    console.error(`❌ Channel authorization failed: ${channel.name}`, error);
                    if (Platform.OS === 'android' && apiUrl.includes('localhost')) {
                      console.warn('⚠️ Android detected using localhost. Try 10.0.2.2 instead.');
                    }
                    callback(error, null);
                  });
              }
            };
          },
          // ✅ FIX: optimize for React Native stability (fix error 1006)
          disableStats: true,
          // Note: using the default wsHost from the cluster is safer unless using self-hosted soketi/websockets
          activityTimeout: 30000,
          pongTimeout: 10000,
        });

        // Connection event handlers
        this.pusher.connection.bind('connected', () => {
          console.log('✅ Pusher connected successfully - Socket ID:', this.pusher?.connection.socket_id);
          this.isInitialized = true;
          this.connectionAttempts = 0;

          // ✅ Process queue of early subscriptions
          if (this.pendingSubscriptions.length > 0) {
            console.log(`📡 Processing ${this.pendingSubscriptions.length} pending subscriptions...`);
            this.pendingSubscriptions.forEach(sub => sub());
            this.pendingSubscriptions = [];
          }
        });

        this.pusher.connection.bind('error', (err: any) => {
          console.error('❌ Pusher connection error:', err);
          this.isInitialized = false;
        });

        this.pusher.connection.bind('disconnected', () => {
          console.log('🔌 Pusher disconnected');
          this.isInitialized = false;
        });
      }).catch((err: any) => {
        console.error('❌ Failed to load pusher-js:', err);
      });

      return true;
    } catch (error) {
      console.error('❌ Pusher initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // OPTIMIZED: Subscribe to user notifications with ALL event types
  subscribeToUserNotifications(
    userId: number,
    onNotification: (data: any) => void
  ): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.log('⏳ Pusher not ready. Queuing notification subscription for user:', userId);
      this.pendingSubscriptions.push(() => this.subscribeToUserNotifications(userId, onNotification));
      return true; // Return true as it will happen later
    }

    try {
      const channelName = `user.${userId}`;
      console.log(`🔌 Pusher: Subscribing to user channel: ${channelName}`);

      if (this.channels.has(channelName)) {
        console.log(`ℹ️ Already subscribed to user notifications: ${channelName}`);
        return true;
      }

      const channel = this.pusher.subscribe(channelName);

      // ✅ PROPERLY FORMAT NOTIFICATIONS FOR THE STORE
      channel.bind('new-comment', (data: any) => {
        console.log('💬 RAW DATA (new-comment):', data);

        const notification = {
          type: data.type || 'comment',
          title: data.title || 'New Comment',
          message: data.message || `${data.comment?.user?.name || 'Someone'} commented: "${data.comment?.content?.substring(0, 30)}..."`,
          data: data,
          userId: data.comment?.user_id || data.user_id,
          postId: data.postId || data.post_id || data.comment?.post_id,
          commentId: data.comment?.id,
          avatar: data.comment?.user?.profile_photo || data.user_avatar,
          createdAt: new Date()
        };

        console.log('💬 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification);
      });

      // ✅ FIX: Update other bindings too if they use broadcastAs
      channel.bind('new-reaction', (data: any) => {
        console.log('❤️ RAW DATA (new-reaction):', data);

        const notification = {
          type: data.type || 'reaction',
          title: data.title || 'New Reaction',
          message: data.message || `${data.reaction.user?.name || 'Someone'} reacted with ${data.reaction.emoji} on post: "${data.reaction.post?.caption?.substring(0, 50)}..."`,
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
        console.log('👤 RAW DATA (new-follower):', data);

        const notification = {
          type: data.type || 'new_follower',
          title: data.title || 'New Follower',
          message: data.message || `${data.followerName || data.follower?.name || 'Someone'} started following you`,
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
          message: data.message || `${data.post?.user?.name || 'Someone'} created a new post: ${data.post?.caption?.substring(0, 30)}...`,
          data: data,
          userId: data.post?.user_id || data.userId,
          postId: data.post?.id || data.postId,
          avatar: data.post?.user?.profile_photo || data.profile_photo,
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

      // ✅ ADDED: Comment deleted
      channel.bind('comment-deleted', (data: any) => {
        console.log('🗑️ Comment deleted notification:', data);

        const notification = {
          type: 'comment_deleted',
          title: 'Comment Deleted',
          message: data.message || 'A comment was deleted',
          data: data,
          postId: data.postId,
          commentId: data.commentId,
          createdAt: new Date()
        };

        console.log('🗑️ SENDING TO NOTIFICATION STORE:', notification);
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

      // Space invitations
      // Find this block (around line 200-215)
      // Space invitations moved/consolidated


      // ✅ FIX: capture direct message replies and reactions sent via Notifications
      channel.bind('message_reply', (data: any) => {
        console.log('↩️ RAW DATA (message_reply via notification):', data);
        const notification = {
          type: data.type || 'message_reply',
          title: data.title || 'New Reply',
          message: data.message || 'Someone replied to your message',
          data: data,
          userId: data.userId,
          messageId: data.messageId,
          spaceId: data.spaceId,
          avatar: data.profile_photo,
          createdAt: new Date()
        };
        console.log('↩️ SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification);
      });

      channel.bind('message_reaction', (data: any) => {
        console.log('❤️ RAW DATA (message_reaction via notification):', data);
        const notification = {
          type: data.type || 'message_reaction',
          title: data.title || 'New Reaction',
          message: data.message || `Someone reacted ${data.reaction || ''} to your message`,
          data: data,
          userId: data.userId,
          messageId: data.messageId,
          spaceId: data.spaceId,
          avatar: data.profile_photo,
          createdAt: new Date()
        };
        console.log('❤️ SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification);
      });

      // Handle Laravel's generic BroadcastNotificationCreated events
      channel.bind('Illuminate\\Notifications\\Events\\BroadcastNotificationCreated', (data: any) => {
        console.log('📨 Laravel notification received:', data);

        // Extract inner data which contains the actual message
        const innerData = data.data || {};
        const notifType = innerData.type || data.type || 'generic';

        // Map generic Laravel notification to our store format
        const notification: any = {
          id: data.id || Date.now().toString(),
          type: notifType,
          title: innerData.title || 'New Notification',
          message: innerData.message || 'You have a new update',
          data: innerData,
          userId: innerData.userId || innerData.user_id || innerData.inviter_id || innerData.followerId,
          postId: innerData.postId || innerData.post_id,
          spaceId: innerData.spaceId || innerData.space_id,
          // ✅ CRITICAL: Extract messageId for routing to the specific message
          messageId: innerData.messageId || innerData.message_id || innerData.message?.id,
          avatar: innerData.avatar || innerData.profile_photo || innerData.inviter_avatar
            || innerData.user?.profile_photo,
          createdAt: new Date(data.created_at || Date.now()),
          isRead: false,
        };

        // Special handling for common types if they come through this event
        if (notification.type.includes('NewComment')) notification.type = 'comment';
        if (notification.type.includes('NewReaction')) notification.type = 'reaction';
        if (notification.type.includes('NewPost')) notification.type = 'new_post';
        if (notification.type.includes('SpaceInvitation')) notification.type = 'space_invitation';
        // ✅ NEW: Map chat notification class names to store types
        if (notification.type.includes('MessageReacted')) notification.type = 'message_reaction';
        if (notification.type.includes('MessageReplied')) notification.type = 'message_reply';
        if (notification.type.includes('MessageSent') || notification.type.includes('NewMessage')) notification.type = 'new_message';

        console.log('📨 SENDING BROADCAST NOTIFICATION TO STORE:', notification.type, '| spaceId:', notification.spaceId, '| messageId:', notification.messageId);
        onNotification(notification);
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

      // ✅ SPACE MANAGEMENT EVENTS
      channel.bind('space.muted', (data: any) => {
        onNotification({
          type: 'space_muted',
          spaceId: data.space_id,
          data: data,
          createdAt: new Date()
        });
      });

      channel.bind('space.pinned', (data: any) => {
        onNotification({
          type: 'space_pinned',
          spaceId: data.space_id,
          data: data,
          createdAt: new Date()
        });
      });

      channel.bind('space.archived', (data: any) => {
        onNotification({
          type: 'space_archived',
          spaceId: data.space_id,
          data: data,
          createdAt: new Date()
        });
      });

      channel.bind('space.unread', (data: any) => {
        onNotification({
          type: 'space_unread',
          spaceId: data.space_id,
          data: data,
          createdAt: new Date()
        });
      });

      // Space invitation
      channel.bind('space.invitation', (data: any) => {
        console.log('📨 Space invitation notification:', data);
        const notification = {
          id: data.id,
          type: 'space_invitation',
          title: 'New Space Invitation',
          message: data.message || `${data.inviter_name || 'Someone'} invited you to join "${data.space_title || data.space?.title}"`,
          data: data,
          spaceId: data.space_id || data.space?.id,
          userId: data.inviter_id || data.inviter?.id || data.invited_by?.id,
          avatar: data.inviter_avatar || data.inviter?.profile_photo || data.invited_by?.profile_photo,
          createdAt: data.timestamp ? new Date(data.timestamp) : new Date(),
          isRead: false,
        };
        console.log('📨 SENDING INVITATION TO NOTIFICATION STORE:', notification);
        onNotification(notification);
      });

      // Participant joined space
      channel.bind('participant.joined', (data: any) => {
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

      channel.bind('space.created', (data: any) => {
        console.log('🚀 New space created by someone you follow:', data);

        const notification = {
          type: 'space_created',
          title: 'New Space Created',
          message: `${data.creator?.name || 'Someone'} created a new space: "${data.space?.title}"`,
          data: data,
          spaceId: data.space?.id,
          userId: data.creator?.id,
          avatar: data.creator?.profile_photo,
          createdAt: new Date()
        };

        console.log('🚀 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification);
      });
      // ==================== END OF CHAT PAGE NOTIFICATIONS ====================

      // Consistently moved to a single handler
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
    onPostDeleted: (data: any) => void,
    onCommentDeleted: (data: any) => void
  ): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.log('⏳ Pusher not ready. Queuing posts subscription.');
      this.pendingSubscriptions.push(() =>
        this.subscribeToPosts(postIds, onNewComment, onNewReaction, onCommentReaction, onNewPost, onPostUpdated, onPostDeleted, onCommentDeleted)
      );
      return true;
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
        console.log('💬 Global channel: comment received:', data.postId);
        onNewComment(data);
      });

      // Post Reactions
      channel.bind('new-reaction', (data: any) => {
        console.log('❤️ Global channel: reaction received:', data.postId);
        onNewReaction(data);
      });

      // New Posts
      channel.bind('new-post', (data: any) => {
        console.log('📝 Global channel: New post received:', data.post?.id);
        onNewPost(data);
      });

      // Comment Reactions
      channel.bind('comment-reaction', (data: any) => {
        console.log('💖 Global channel: comment reaction received:', data.postId);
        onCommentReaction(data);
      });


      // Post Updates
      channel.bind('post-updated', (data: any) => {
        console.log('✏️ Global channel: post update received:', data.postId);
        onPostUpdated(data);
      });

      // Post Deletions
      channel.bind('post-deleted', (data: any) => {
        console.log('🗑️ Global channel: post deletion received:', data.postId);
        onPostDeleted(data);
      });

      // Comment Deletions
      channel.bind('comment-deleted', (data: any) => {
        console.log('🗑️ Global channel: comment deletion received:', data.postId);
        onCommentDeleted(data);
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
    onPostDeleted: (data: any) => void,
    onCommentDeleted: (data: any) => void
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
      onPostDeleted,
      onCommentDeleted
    );
  }

  unsubscribeFromIndividualPost(postId: number): void {
    const channelName = `post.${postId}`;
    this.unsubscribeFromChannel(channelName);
  }


  // subscribing to spaces
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
    onPollCreated?: (poll: any) => void;
    onPollUpdated?: (poll: any) => void;
    onPollDeleted?: (poll: any) => void;
    // ✅ NEW: message lifecycle events
    onMessageDeleted?: (data: any) => void;
    onMessageReacted?: (data: any) => void;
    onMessageReplied?: (data: any) => void;

    // Space Management Events
    onSpaceMuted?: (data: any) => void;
    onSpacePinned?: (data: any) => void;
    onSpaceArchived?: (data: any) => void;
    onSpaceUnread?: (data: any) => void;
  }): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.warn('⚠️ Pusher not initialized. Skipping space subscription.');
      return false;
    }

    // Guard: ignore invalid or reserved IDs that may be passed due to routing mishaps
    if (spaceId === 'Login' || spaceId === 'undefined' || spaceId === '[id]') {
      console.warn(`🛑 Ignoring invalid space subscription attempt for ID: ${spaceId}`);
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

    // Space Management Events
    if (callbacks.onSpaceMuted) {
      channel.bind('space.muted', callbacks.onSpaceMuted);
    }

    if (callbacks.onSpacePinned) {
      channel.bind('space.pinned', callbacks.onSpacePinned);
    }

    if (callbacks.onSpaceArchived) {
      channel.bind('space.archived', callbacks.onSpaceArchived);
    }

    if (callbacks.onSpaceUnread) {
      channel.bind('space.unread', callbacks.onSpaceUnread);
    }

    // ✅ NEW: message lifecycle events → notification store
    if (callbacks.onMessageDeleted) {
      channel.bind('message.deleted', callbacks.onMessageDeleted);
    }

    if (callbacks.onMessageReacted) {
      channel.bind('message.reacted', callbacks.onMessageReacted);
    }

    if (callbacks.onMessageReplied) {
      channel.bind('message.replied', callbacks.onMessageReplied);
    }

    if (callbacks.onPollCreated) {
      channel.bind('poll.created', (data: any) => {
        console.log(`📊 Poll created in space ${spaceId}:`, data.poll.question);
        callbacks.onPollCreated?.(data.poll);
      });
    }
    if (callbacks.onPollDeleted) {
      channel.bind('poll.deleted', (data: any) => {
        console.log(`🗑️ Poll deleted from space ${spaceId}:`, data.poll.id);
        callbacks.onPollDeleted?.(data.poll_id);
      });
    }

    if (callbacks.onPollUpdated) {
      channel.bind('poll.updated', (data: any) => {
        console.log(`📊 Poll updated in space ${spaceId}`);
        callbacks.onPollUpdated?.(data.poll);
      });
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

      channel.bind('space.updated', (data: any) => {
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


  // Add this method to PusherService.ts

  /**
   * Subscribe to private user channel for real-time events
   */
  subscribeToPrivateUser(userId: number, onEvent: (data: any) => void): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.warn('⚠️ Pusher not initialized. Skipping private user subscription.');
      return false;
    }

    try {
      // Private channel format for Laravel
      const channelName = `private-user.${userId}`;

      if (this.channels.has(channelName)) {
        console.log(`ℹ️ Already subscribed to private user channel: ${channelName}`);
        return true;
      }

      console.log(`🔌 Subscribing to private user channel: ${channelName}`);
      const channel = this.pusher.subscribe(channelName);

      // Note: All relevant events (space.invitation, space.muted, etc.) 
      // are now handled in subscribeToUserNotifications to unify synchronization.

      this.channels.set(channelName, channel);
      return true;
    } catch (error) {
      console.error(`❌ Error subscribing to private user channel:`, error);
      return false;
    }
  }
  // Generic unsubscribe method
  unsubscribeFromChannel(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel && this.pusher) {
      try {
        const connectionState = this.pusher.connection.state;
        if (connectionState !== 'disconnected' && connectionState !== 'unavailable' && connectionState !== 'failed') {
          this.pusher.unsubscribe(channelName);
        }
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
        // Unsubscribe from all channels first if connection is still active
        const connectionState = this.pusher.connection.state;
        const canUnsubscribe = connectionState !== 'disconnected' && connectionState !== 'unavailable' && connectionState !== 'failed';

        this.channels.forEach((channel, channelName) => {
          if (canUnsubscribe) {
            this.pusher?.unsubscribe(channelName);
          }
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