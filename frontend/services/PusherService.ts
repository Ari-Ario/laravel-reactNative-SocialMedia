import { Platform } from 'react-native';
import getApiBase from '@/services/getApiBase';

// Pusher type for TypeScript only (no runtime import at module level)
type PusherType = any; // Use any for internal reference since it's dynamic
export interface PusherChannel {
  bind(event: string, callback: (data: Record<string, unknown>) => void): void;
  unbind(event?: string, callback?: (data: Record<string, unknown>) => void): void;
  unbind_all?(): void;
  trigger?(event: string, data: any): void;
}
export interface PusherEventPayload extends Record<string, unknown> {
  type?: string;
  title?: string;
  message?: string;
  data?: Record<string, unknown> | unknown;
  userId?: number | string;
  user_id?: number | string;
  postId?: number | string;
  post_id?: number | string;
  spaceId?: string;
  space_id?: string;
  commentId?: number | string;
  comment_id?: number | string;
  messageId?: string;
  message_id?: string;
  activityId?: string;
  activity_id?: string;
  callId?: string;
  call_id?: string;
  avatar?: string;
  profile_photo?: string;
  user_avatar?: string;
  userName?: string;
  user?: {
    id: number;
    name?: string;
    profile_photo?: string;
  };
  comment?: {
    id: number;
    user_id: number;
    content: string;
    user?: {
      name: string;
      profile_photo?: string;
    };
    post_id?: number;
  };
  reaction?: {
    user_id: number;
    emoji: string;
    comment_id?: number;
    comment?: {
      content: string;
    };
    post?: {
      caption: string;
    };
    user?: {
      id: number;
      name: string;
      profile_photo?: string;
    };
  };
  followerName?: string;
  followerId?: number;
  follower?: {
    id: number;
    name: string;
    profile_photo?: string;
  };
  post?: {
    id: number;
    user_id: number;
    caption: string;
    user?: {
      name: string;
      profile_photo?: string;
    };
  };
  changes?: {
    caption?: {
      new: string;
    };
  };
  postCaption?: string;
  question?: string;
  category?: string;
  keywords?: string[];
  timestamp?: string | number;
  created_at?: string;
  id?: string;
  isCall?: boolean;
  is_sharing?: boolean;
  status?: number;
  call?: {
    id: string;
    type?: string;
  };
  call_type?: string;
  caller_id?: number;
  caller_name?: string;
  space_title?: string;
  inviter_id?: number;
  inviter_name?: string;
  inviter_avatar?: string;
  space?: {
    id: string;
    title?: string;
    space_type?: string;
  };
  notification_message?: string;
  chat_message?: Record<string, unknown>;
  content_state?: Record<string, unknown>;
  poll?: Record<string, unknown>;
  poll_id?: string;
}

class PusherService {
  private pusher: PusherType | null = null;
  private isInitialized: boolean = false;
  private connectionAttempts = 0;
  private maxReconnectAttempts = 8;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private maxConnectionAttempts = 3;
  private currentToken: string | null = null;
  private channels: Map<string, any> = new Map();
  private subscriptionRegistry: Map<string, {
    onEvent: (event: string, data: any) => void;
    bindings: Map<string, (data: any) => void>;
  }> = new Map();
  private pendingSubscriptions: Array<() => void> = []; // ✅ Queue for early subscriptions
  private onConnectedCallbacks: Array<() => void> = []; // ✅ Callbacks for reconnection/initial connection


  getPusher(): PusherType | null {
    return this.pusher;
  }

  initialize(token: string): boolean {
    // Guard: skip during SSR (Node.js has no window)
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      // ✅ FIX: Only skip if SAME token is being used. If token changed, we MUST re-initialize
      // to ensure the authorizer uses the new credentials (e.g. switching from User to Guest)
      if (this.pusher && this.isInitialized && this.currentToken === token) {
        console.log('ℹ️ Pusher already initialized with current token, reusing connection');
        return true;
      }

      // ✅ FIX: If token changed, we MUST reset connection attempts and re-initialize
      if (this.currentToken !== token) {
        console.log('🔄 Token changed, resetting connection attempts and re-initializing...');
        if (this.pusher) {
          this.pusher.disconnect();
          this.pusher = null;
        }
        this.isInitialized = false;
        this.channels.clear();
        this.connectionAttempts = 0;
      }

      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        console.error('❌ Max connection attempts reached, giving up');
        return false;
      }

      this.currentToken = token; // Store for future comparison

      const pusherKey = process.env.EXPO_PUBLIC_REVERB_APP_KEY || process.env.EXPO_PUBLIC_PUSHER_APP_KEY;
      const reverbHost = process.env.EXPO_PUBLIC_REVERB_HOST;
      const reverbPort = process.env.EXPO_PUBLIC_REVERB_PORT;
      const reverbScheme = process.env.EXPO_PUBLIC_REVERB_SCHEME || 'https';
      const pusherCluster = process.env.EXPO_PUBLIC_PUSHER_APP_CLUSTER;
      const apiUrl = getApiBase();

      // ✅ FIX: Dynamically derive Reverb host/port if on local development 
      // (localhost, 10.0.2.2, or local IP like 192.168.x.x). 
      // This ensures mobile browsers on the same network hit the local Reverb server.
      const isLocal = apiUrl.includes('localhost') ||
        apiUrl.includes('127.0.0.1') ||
        apiUrl.match(/^(http|https):\/\/(\d+\.\d+\.\d+\.\d+)/); // Matches any direct IP like 10.0.2.2 or 192.168.1.x

      const finalWsHost = isLocal ? apiUrl.split('//')[1].split('/')[0].split(':')[0] : reverbHost;
      const finalWsPort = isLocal ? 8080 : (reverbPort ? parseInt(reverbPort) : 443);
      const finalWsScheme = isLocal ? 'http' : (reverbScheme || 'https');

      if (!pusherKey || !apiUrl) {
        console.error('❌ Pusher/Reverb environment variables missing');
        return false;
      }

      console.log(`🔄 Initializing ${reverbHost ? 'Reverb' : 'Pusher'} connection...`);
      this.connectionAttempts++;

      // Dynamically import pusher-js to avoid SSR window crash
      import('pusher-js').then((mod) => {
        const Pusher = (mod.default || mod) as (new (key: string, options: any) => any);

        // ✅ FIX: Only apply React Native overrides if NOT on web
        if (Platform.OS !== 'web' && Pusher.Runtime) {
          console.log(`📱 Applying React Native Pusher overrides for ${Platform.OS}`);
          Pusher.Runtime.createXHR = () => new XMLHttpRequest();
          Pusher.Runtime.createWebSocket = (url: string) => new WebSocket(url);
        } else {
          console.log('🌐 Using native browser environment for Pusher');
        }

        // ✅ FIX: Use dynamic host/port for Reverb
        this.pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
          wsHost: finalWsHost || undefined,
          wsPort: finalWsPort,
          wssPort: finalWsPort,
          forceTLS: finalWsScheme === 'https',
          enabledTransports: ['ws', 'wss'],
          authorizer: (channel: { name: string }) => {
            return {
              authorize: (socketId: string, callback: (error: Error | null, data: Record<string, unknown> | null) => void) => {
                // ✅ HARDENING: DECISIVELY Use the api/broadcasting/auth endpoint.
                // Mobile (via getApiBase) already includes /api, so this is /api/broadcasting/auth.
                // Web also uses /api, so this is consistent across all platforms.
                const authUrl = `${apiUrl}/broadcasting/auth`;

                console.log(`🔐 Authorizing channel: ${channel.name} with socket: ${socketId}`);
                console.log(`🔐 Using token: ${token ? token.substring(0, 20) + '...' : 'MISSING'}`);
                console.log(`📡 Auth endpoint: ${authUrl}`);

                const performAuth = async (retries = 3, delayMs = 1000) => {
                  for (let i = 0; i < retries; i++) {
                    try {
                      const response = await fetch(authUrl, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${this.currentToken || token}`,
                          'Accept': 'application/json',
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          socket_id: socketId,
                          channel_name: channel.name
                        })
                      });

                      console.log(`📡 Auth response status: ${response.status}`);
                      if (!response.ok) {
                        const text = await response.text();
                        console.error(`❌ Auth failed with status ${response.status}:`, text);
                        // HTTP errors usually aren't transient network issues, but might be 502/504
                        if (response.status !== 502 && response.status !== 504) {
                          throw new Error(`Auth failed: ${response.status} - ${text}`);
                        }
                      } else {
                        const data = await response.json();
                        console.log(`✅ Channel authorized: ${channel.name}`);
                        callback(null, data);
                        return;
                      }
                    } catch (error: unknown) {
                      console.error(`⚠️ Auth loop attempt ${i + 1}/${retries} failed for ${channel.name}:`, error);
                      // If this was the last attempt, fail permanently
                      if (i === retries - 1) {
                        console.error(`❌ Channel authorization permanently failed: ${channel.name}`, error);
                        if (Platform.OS === 'android' && apiUrl.includes('localhost')) {
                          console.warn('⚠️ Android detected using localhost. Try 10.0.2.2 instead.');
                        }
                        callback(error as Error, null);
                        return; // Exit
                      }
                      // Otherwise wait and retry
                      await new Promise(resolve => setTimeout(resolve, delayMs));
                    }
                  }
                };

                performAuth();
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
        this.pusher?.connection.bind('connected', () => {
          const socketId = this.pusher?.connection.socket_id;
          console.log('✅ Pusher connected successfully - Socket ID:', socketId);
          this.isInitialized = true;
          this.connectionAttempts = 0;

          // ✅ Process queue of early subscriptions
          if (this.pendingSubscriptions.length > 0) {
            console.log(`📡 Processing ${this.pendingSubscriptions.length} pending subscriptions...`);
            this.pendingSubscriptions.forEach(sub => sub());
            this.pendingSubscriptions = [];
          }

          // 🚀 EXTREME PERFORMANCE: Re-apply registry subscriptions on re-init
          if (this.subscriptionRegistry.size > 0) {
            console.log(`🔄 Re-applying ${this.subscriptionRegistry.size} registered subscriptions`);
            this.subscriptionRegistry.forEach((reg, channelName) => {
              const channel = this.pusher!.subscribe(channelName);
              reg.bindings.forEach((callback, event) => {
                channel.bind(event, callback);
              });
              this.channels.set(channelName, channel);
            });
          }

          // ✅ Notify connection listeners (for re-syncing missed events)
          if (this.onConnectedCallbacks.length > 0) {
            console.log(`📡 Notifying ${this.onConnectedCallbacks.length} connection listeners...`);
            this.onConnectedCallbacks.forEach(cb => cb());
          }
        });

        this.pusher?.connection.bind('error', (err: Record<string, unknown>) => {
          console.error('❌ Pusher connection error:', err);

          // Code 4200 means "Please reconnect immediately"
          const errorCode = (err as any)?.error?.data?.code || (err as any)?.data?.code;
          if (errorCode === 4200 || errorCode === 4201) {
            console.log('🔄 Pusher: Reconnecting as requested by server...');
            this.pusher?.disconnect();
            setTimeout(() => {
              this.pusher?.connect();
            }, 1000);
          } else {
            this.isInitialized = false;
          }
        });

        this.pusher?.connection.bind('disconnected', () => {
          console.log('🔌 Pusher disconnected');
          this.isInitialized = false;
          this.handleReconnection();
        });
      }).catch((err: unknown) => {
        console.error('❌ Failed to load pusher-js:', err);
      });

      return true;
    } catch (error) {
      console.error('❌ Pusher initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  private handleReconnection() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (this.connectionAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Pusher: Max reconnection attempts reached');
      return;
    }

    this.connectionAttempts++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s... capped at 30s
    const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts - 1), 30000);

    console.log(`🔄 Pusher: Reconnecting in ${delay}ms (attempt ${this.connectionAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      if (!this.isInitialized && this.pusher) {
        console.log('🔄 Pusher: Attempting to connect...');
        this.pusher.connect();
      }
    }, delay);
  }

  /**
   * Registers a callback to be executed when Pusher successfully connects or reconnects.
   * This is useful for re-fetching data that might have been missed during a disconnection.
   * @param callback The function to call on connection.
   */
  onConnected(callback: () => void): void {
    this.onConnectedCallbacks.push(callback);
    // If already connected, execute immediately
    if (this.isInitialized) {
      callback();
    }
  }

  // OPTIMIZED: Subscribe to user notifications with ALL event types
  subscribeToUserNotifications(
    userId: number,
    onNotification: (data: Record<string, unknown>) => void
  ): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.log('⏳ Pusher not ready. Queuing notification subscription for user:', userId);
      this.pendingSubscriptions.push(() => this.subscribeToUserNotifications(userId, onNotification));
      return true; // Return true as it will happen later
    }

    try {
      const channelName = `private-user-${userId}`;
      console.log(`🔌 Pusher: Subscribing to private user channel: ${channelName}`);

      if (this.channels.has(channelName)) {
        console.log(`ℹ️ Already subscribed to user notifications: ${channelName}`);
        return true;
      }

      const channel = this.pusher.subscribe(channelName);

      // ✅ PROPERLY FORMAT NOTIFICATIONS FOR THE STORE
      channel?.bind('new-comment', (data: PusherEventPayload) => {
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
        onNotification(notification as Record<string, unknown>);
      });

      // ✅ FIX: Update other bindings too if they use broadcastAs
      channel?.bind('new-reaction', (data: PusherEventPayload) => {
        console.log('❤️ RAW DATA (new-reaction):', data);

        const notification = {
          type: data.type || 'reaction',
          title: data.title || 'New Reaction',
          message: data.message || `${data.reaction?.user?.name || 'Someone'} reacted with ${data.reaction?.emoji} on post: "${data.reaction?.post?.caption?.substring(0, 50)}..."`,
          data: data,
          userId: data.reaction?.user_id,
          postId: data.postId,
          avatar: data.reaction?.user?.profile_photo,
          createdAt: new Date()
        };

        console.log('❤️ SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('comment-reaction', (data: PusherEventPayload) => {
        console.log('💖 New comment reaction:', data);

        const notification = {
          type: data.type || 'comment_reaction',
          title: data.title || 'Comment Reaction',
          message: (data.reaction?.user?.name) ? `${data.reaction?.user?.name} reacted to your comment "${(data.reaction?.comment as Record<string, unknown>)?.content as string || ''}" with ${data.reaction?.emoji}` : (data.message as string || 'New reaction'),
          data: data,
          userId: data.reaction?.user_id,
          postId: data.postId,
          commentId: data.reaction?.comment_id,
          avatar: data.reaction?.user?.profile_photo,
          createdAt: new Date()
        };

        console.log('💖 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('new-follower', (data: PusherEventPayload) => {
        console.log('👤 RAW DATA (new-follower):', data);

        const notification = {
          type: data.type || 'new_follower',
          title: data.title || 'New Follower',
          message: data.message || `${data.followerName || data.follower?.name || 'Someone'} started following you`,
          data: data,
          userId: data.followerId || data.follower_id || data.follower?.id || data.user_id || data.userId,
          avatar: data.profile_photo || data.follower?.profile_photo || data.avatar || null,
          createdAt: new Date()
        };

        console.log('👤 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('new-post', (data: PusherEventPayload) => {
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
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('post-updated', (data: PusherEventPayload) => {
        console.log('✏️ Global channel: post update received:', data.postId);

        let message = data.message as string || 'Post updated';
        if (data.userName) {
          if (data.changes?.caption?.new) {
            message = `${data.userName} updated a post: "${data.changes.caption.new.substring(0, 30)}..."`;
          } else if (data.updatedFields?.includes('media')) {
            message = `${data.userName} updated the media in their post`;
          } else {
            message = `${data.userName} updated their post`;
          }
        }

        const notification = {
          type: data.type || 'post_updated',
          title: data.title || 'Post Updated',
          message: message,
          data: data,
          userId: data.userId,
          postId: data.postId,
          avatar: data.profile_photo,
          createdAt: new Date()
        };

        console.log('✏️ SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('post-deleted', (data: PusherEventPayload) => {
        console.log('✏️ Post deleted notification:', data);

        const notification = {
          type: data.type || 'post_deleted',
          title: data.title || 'Post deleted',
          message: data.userName ? `${data.userName} deleted post: ${data.postCaption}` : (data.message as string || 'Post deleted'),
          data: data,
          userId: data.userId,
          postId: data.postId,
          avatar: data.profile_photo,
          createdAt: new Date()
        };

        console.log('✏️ SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      // ✅ DELETED: Comment deleted notification binding
      // Reason: This was causing a redundant "dropdown" toast. 
      // The actual UI update is already handled by the global channel subscription in PostStore.

      channel?.bind('chatbot-training-needed', (data: PusherEventPayload) => {
        console.log('🤖 Chatbot training notification (user channel):', data);

        const notification = {
          id: data.id || `chatbot-${Date.now()}-${Math.random()}`,
          type: data.type || 'chatbot_training',
          title: data.title || 'Chatbot Training Needed',
          message: data.message ? (data.message as string).substring(0, 60) + '...' : `New training data: "${data.question}"`,
          data: data,
          question: data.question,
          category: data.category,
          keywords: data.keywords,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          createdAt: new Date(),
          $isRead: false,
        };

        console.log('🤖 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      // ==================== ADDITIONAL NOTIFICATIONS FOR CHAT PAGE ====================

      // Space invitations
      // Find this block (around line 200-215)
      // Space invitations moved/consolidated


      // ✅ FIX: capture direct message replies and reactions sent via Notifications
      channel?.bind('message_reply', (data: PusherEventPayload) => {
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
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('message_reaction', (data: PusherEventPayload) => {
        console.log('❤️ RAW DATA (message_reaction via notification):', data);
        const notification = {
          type: 'message_reaction',
          title: 'New Reaction',
          message: data.message || `Someone reacted ${data.reaction || ''} to your message`,
          data: data,
          userId: data.userId,
          messageId: data.messageId,
          spaceId: data.spaceId,
          avatar: data.profile_photo,
          createdAt: new Date()
        };
        console.log('❤️ SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('space-created', (data: PusherEventPayload) => {
        console.log('🚀 User channel: Space created received:', data);
        const notification = {
          type: 'space-created',
          title: 'New Space Created',
          message: data.message || `A new space "${data.space?.title || ''}" was created`,
          data: data,
          spaceId: data.space?.id,
          userId: data.creator?.id,
          avatar: data.creator?.profile_photo,
          createdAt: new Date()
        };
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('space-invitation', (data: PusherEventPayload) => {
        console.log('📨 User channel: Space invitation received:', data);
        const notification = {
          type: 'space-invitation',
          title: 'Space Invitation',
          message: data.message || `You were invited to join "${data.space?.title || ''}"`,
          data: data,
          spaceId: data.space?.id,
          userId: data.inviter?.id,
          avatar: data.inviter?.profile_photo,
          createdAt: new Date()
        };
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('space-deleted', (data: PusherEventPayload) => {
        console.log('🗑️ User channel: Space deleted received:', data);
        const notification = {
          type: 'space-deleted',
          title: 'Space Deleted',
          message: data.message || 'A space was deleted',
          data: data,
          spaceId: data.space_id,
          createdAt: new Date()
        };
        onNotification(notification as Record<string, unknown>);
      });

      // Handle Violation Reported (Specific Event)
      channel?.bind('violation-reported', (data: PusherEventPayload) => {
        console.log('🚨 Violation Report Received (Real-time):', data);

        const innerData = (data.data || data) as Record<string, unknown>;
        const notification = {
          id: data.id || Date.now().toString(),
          type: 'violation_reported',
          title: innerData.title || '🚨 AI Violation Alert',
          message: innerData.message || 'New policy violation detected',
          data: innerData,
          severity: innerData.severity,
          reportId: innerData.reportId,
          createdAt: new Date(),
          isRead: false,
        };

        console.log('🚨 SENDING VIOLATION TO STORE:', notification.severity);
        onNotification(notification as Record<string, unknown>);
      });

      // Handle Moderation Action (Real-time)
      channel?.bind('moderation_action', (data: PusherEventPayload) => {
        console.log('⚒️ Moderation Action Received (Real-time):', data);

        const notification = {
          id: data.id || Date.now().toString(),
          type: 'moderation_action',
          title: 'Administration',
          message: data.message || 'A moderation action has been taken.',
          data: data,
          createdAt: new Date(),
          isRead: false,
        };

        onNotification(notification as Record<string, unknown>);
      });

      // Handle Laravel's generic BroadcastNotificationCreated events
      channel?.bind('Illuminate\\Notifications\\Events\\BroadcastNotificationCreated', (data: PusherEventPayload) => {

        console.log('📨 Laravel notification received:', data);

        // Extract inner data which contains the actual message
        const innerData = (data.data || {}) as Record<string, unknown>;
        let notifType = (innerData.type || data.type || 'generic') as string;

        // Normalize type names
        const upperNotifType = notifType.toUpperCase();
        if (upperNotifType.includes('SPACEINVITATION') || upperNotifType.includes('SPACE_INVITATION')) {
          console.log('🚫 Skipping redundant SpaceInvitation broadcast (robust check), handled by dedicated event');
          return;
        }
        if (notifType.includes('MessageReacted')) notifType = 'message_reaction';
        if (notifType.includes('MessageReplied')) notifType = 'message_reply';
        if (notifType.includes('MessageSent')) notifType = 'new_message';
        if (notifType.includes('ModerationAction')) notifType = 'moderation_action';
        if (upperNotifType.includes('FOLLOW')) notifType = 'new_follower';
        if ((upperNotifType.includes('COMMENT') || upperNotifType.includes('COMMENTED')) && !upperNotifType.includes('REACTION')) notifType = 'comment';
        if ((upperNotifType.includes('REACTION') || upperNotifType.includes('REACTED')) && !upperNotifType.includes('COMMENT')) notifType = 'reaction';
        if (upperNotifType.includes('COMMENT') && upperNotifType.includes('REACTION')) notifType = 'comment_reaction';
        if (upperNotifType.includes('POSTCREATED') || (upperNotifType.includes('POST') && upperNotifType.includes('NEW'))) notifType = 'new_post';
        if (upperNotifType.includes('STORYCREATED') || (upperNotifType.includes('STORY') && upperNotifType.includes('NEW'))) notifType = 'story-created';

        // Map generic Laravel notification to our store format
        const idata = innerData as any;
        const notification: Record<string, unknown> = {
          id: data.id || Date.now().toString(),
          type: notifType,
          title: idata.title || (notifType === 'space_invitation' ? 'Space Invitation' : 'New Notification'),
          message: idata.message,
          data: idata,
          userId: idata.userId || idata.user_id || idata.inviter_id || idata.followerId || idata.follower_id || idata.follower?.id,
          postId: idata.postId || idata.post_id,
          spaceId: idata.spaceId || idata.space_id,
          messageId: idata.messageId || idata.message_id || idata.message?.id,
          commentId: idata.commentId || idata.comment_id || idata.comment?.id || idata.reaction?.comment_id,
          activityId: idata.activityId || idata.activity_id || idata.activity?.id,
          callId: idata.callId || idata.call_id || idata.call?.id,
          avatar: idata.avatar || idata.profile_photo || idata.inviter_avatar || idata.user?.profile_photo || idata.follower?.profile_photo,
          createdAt: new Date(data.created_at || Date.now()),
          isRead: false,
        };

        // ✅ PROACTIVE CALL DETECTION: If this looks like a call, flag it
        const msgText = (notification.message || '').toLowerCase();
        const looksLikeCall = notifType === 'incoming_call' || notifType === 'call_started' || notifType === 'call' ||
          msgText.includes('started a video call') || msgText.includes('started an audio call') ||
          msgText.includes('is calling you') || msgText.includes('is calling in');

        if (looksLikeCall) {
          notification.isCall = true;
          notification.type = 'call_started';

          // Trigger the modal bridge
          try {
            import('@/services/ChatScreen/CollaborationService').then((mod) => {
              const cs = mod.default.getInstance();
              cs.emitIncomingCall({
                callId: notification.callId as string,
                spaceId: notification.spaceId as string,
                callerId: notification.userId as number,
                callerName: (innerData.userName || (innerData.user as Record<string, unknown>)?.name || 'Someone') as string,
                callerAvatar: notification.avatar as string,
                callType: msgText.includes('audio') ? 'audio' : 'video',
                spaceType: 'direct', // Defaulting for notification-based calls
              });
            });
          } catch { /* ignore */ }
        }

        // Construct message if missing (common for Laravel notifications with raw data)
        if (!notification.message && notifType === 'space_invitation') {
          const inviter = innerData.inviter_name || innerData.userName || 'Someone';
          const space = innerData.space_title || innerData.space?.title || 'a space';
          notification.message = `${inviter} invited you to join "${space}"`;
        } else if (!notification.message && notifType === 'comment') {
          const actor = innerData.userName || innerData.user_name || innerData.user?.name || 'Someone';
          notification.message = `${actor} commented on your post`;
        } else if (!notification.message && notifType === 'reaction') {
          const actor = innerData.userName || innerData.user_name || innerData.user?.name || 'Someone';
          notification.message = `${actor} reacted to your post`;
        } else if (!notification.message && notifType === 'new_follower') {
          const actor = innerData.userName || innerData.user_name || innerData.user?.name || 'Someone';
          notification.message = `${actor} started following you`;
        } else if (!notification.message) {
          notification.message = 'You have a new update';
        }

        console.log('🛒 SENDING BROADCAST NOTIFICATION TO STORE:', notification.type, '| spaceId:', notification.spaceId);
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('market-item-commented', (data: PusherEventPayload) => {
        console.log('🛒 RAW DATA (market-item-commented):', data);

        const notification = {
          type: 'market_comment',
          title: data.title || 'New Market Comment',
          message: data.message || `${data.comment?.user?.name || 'Someone'} commented on your item`,
          data: data,
          userId: data.comment?.user_id || data.user_id,
          itemId: data.itemId,
          commentId: data.comment?.id,
          avatar: data.comment?.user?.profile_photo || data.user_avatar,
          createdAt: new Date()
        };

        console.log('🛒 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('market-item-reacted', (data: PusherEventPayload) => {
        console.log('🛒 RAW DATA (market-item-reacted):', data);

        const notification = {
          type: 'market_reaction',
          title: data.title || 'New Market Reaction',
          message: data.message || `${data.reaction?.user?.name || 'Someone'} reacted to your item`,
          data: data,
          userId: data.reaction?.user_id,
          itemId: data.itemId,
          avatar: data.reaction?.user?.profile_photo,
          createdAt: new Date()
        };

        console.log('🛒 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });



      // Call started
      channel?.bind('call-started', (data: PusherEventPayload) => {
        console.log('📞 [PusherService] call.started RAW payload:', JSON.stringify(data));

        const notification = {
          ...data,
          type: data.type || 'call_started',
          title: data.title || 'Incoming Call',
          message: data.message && typeof data.message === 'string' ? data.message : `${data.user?.name || 'Someone'} is calling you...`,
          spaceId: data.space_id,
          callId: data.call?.id,
          userId: data.user?.id,
          avatar: data.profile_photo || data.user?.profile_photo,
          createdAt: new Date()
        };
        console.log('📞 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);

        // ─── Incoming Call UI ─────────────────────────────────────────────
        // This event fires on the PRIVATE user channel (private-user.{userId}),
        // so it is already scoped to this specific user only.
        // We emit to IncomingCallModal for ALL calls where the caller is someone else.
        // The bridge hook (useIncomingCallBridge) filters out own calls and active calls.
        const callerId: number = data.user?.id || data.caller_id || 0;
        const spaceId: string = data.space_id || data.spaceId || data.space?.id || '';
        const callId: string = data.call?.id || data.call_id || '';
        const callType = (data.call?.type || data.call_type || 'video') as 'audio' | 'video';
        const spaceType: string = data.space?.space_type || data.space_type || 'direct';

        console.log('📞 [PusherService] Parsed call data:', { callerId, spaceId, callId, callType, spaceType });

        if (callerId && spaceId) {
          try {
            import('@/services/ChatScreen/CollaborationService').then((mod) => {
              const cs = mod.default.getInstance();
              console.log('📞 [PusherService] Calling emitIncomingCall...');
              cs.emitIncomingCall({
                callId,
                spaceId,
                callerId,
                callerName: data.user?.name || data.caller_name || 'Unknown',
                callerAvatar: data.user?.profile_photo || undefined,
                callType,
                spaceType,
              });
            });
          } catch { /* ignore */ }
        }
      });

      // ✅ Call Ended (Unified Payload)
      channel?.bind('call-ended', (data: PusherEventPayload) => {
        console.log('📞 [PusherService] call.ended RAW payload:', JSON.stringify(data));

        const notification = {
          ...data,
          id: data.id || `end-${data.call?.id || Date.now()}`,
          type: data.type || 'call_ended',
          title: data.title || 'Call Ended',
          message: data.message || 'The call has ended',
          spaceId: data.space_id,
          avatar: data.profile_photo || data.user?.profile_photo,
          createdAt: new Date()
        };

        console.log('📞 SENDING END-CALL TO STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      // ✅ Removed: redundant space-message (now handled by SpaceMessageNotification)

      // ✅ SPACE MANAGEMENT EVENTS
      channel?.bind('space-muted', (data: PusherEventPayload) => {
        onNotification({
          type: 'space_muted',
          spaceId: data.space_id,
          data: data,
          createdAt: new Date()
        } as Record<string, unknown>);
      });

      channel?.bind('space-pinned', (data: PusherEventPayload) => {
        onNotification({
          type: 'space_pinned',
          spaceId: data.space_id,
          data: data,
          createdAt: new Date()
        } as Record<string, unknown>);
      });

      channel?.bind('space-archived', (data: PusherEventPayload) => {
        onNotification({
          type: 'space_archived',
          spaceId: data.space_id,
          data: data,
          createdAt: new Date()
        } as Record<string, unknown>);
      });

      channel?.bind('space-unread', (data: PusherEventPayload) => {
        onNotification({
          type: 'space_unread',
          spaceId: data.space_id,
          data: data,
          createdAt: new Date()
        } as Record<string, unknown>);
      });

      // Space invitation
      channel?.bind('space-invitation', (data: PusherEventPayload) => {
        console.log('📨 Space invitation event received:', data);

        // ✅ FILTER: If this is a Laravel notification wrapper sent via the same event name, skip it.
        // The raw event has 'type: space_invitation', while the notification wrapper has the class name.
        if (data.type && (data.type as string).includes('Notifications')) {
          console.log('🚫 Skipping redundant SpaceInvitation broadcast (robust check), handled by dedicated event');
          return;
        }

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
        onNotification(notification as Record<string, unknown>);
      });

      // Participant joined space
      channel?.bind('participant-joined', (data: PusherEventPayload) => {
        console.log('👤 Participant joined notification:', data);
        const notification = {
          ...data,
          id: data.id || `join-${data.user?.id}-${data.space_id}-${Date.now()}`,
          type: data.type || 'participant_joined',
          title: data.title || 'New Participant',
          message: data.message || `${data.user?.name || 'Someone'} joined "${data.space_title || data.space?.title || 'the space'}"`,
          spaceId: data.space_id,
          userId: data.user?.id,
          avatar: data.profile_photo || data.user?.profile_photo,
          createdAt: data.timestamp ? new Date(data.timestamp) : new Date()
        };
        console.log('👤 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      // Participant left space
      channel?.bind('participant-left', (data: PusherEventPayload) => {
        console.log('👤 Participant left notification:', data);
        const notification = {
          ...data,
          id: data.id || `leave-${data.user_id || data.user?.id}-${data.space_id}-${Date.now()}`,
          type: data.type || 'participant_left',
          title: data.title || 'Participant Left',
          message: data.message || `${data.user?.name || 'Someone'} left "${data.space_title || data.space?.title || 'the space'}"`,
          spaceId: data.space_id,
          userId: data.user_id || data.user?.id,
          avatar: data.profile_photo || data.user?.profile_photo,
          createdAt: data.timestamp ? new Date(data.timestamp) : new Date()
        };
        console.log('👤 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      // Magic event triggered
      channel?.bind('magic-triggered', (data: PusherEventPayload) => {
        console.log('✨ Magic event notification:', data);
        const notification = {
          type: data.type || 'magic_event',
          title: data.title || '✨ Magic Discovered!',
          message: `A ${(data.event as Record<string, unknown>)?.event_type || 'magic'} event occurred in "${data.space?.title}"`,
          data: data,
          spaceId: data.space_id,
          eventId: (data.event as Record<string, unknown>)?.id,
          userId: data.triggered_by,
          createdAt: new Date()
        };
        console.log('✨ SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      // Screen share started
      channel?.bind('screen-share-started', (data: PusherEventPayload) => {
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
        onNotification(notification as Record<string, unknown>);
      });

      // Poll created
      channel?.bind('poll-created', (data: PusherEventPayload) => {
        console.log('📊 Poll created notification:', data);
        const notification = {
          type: 'poll_created',
          title: 'New Poll',
          message: `${data.creator_name || 'Someone'} created a poll in "${data.space_title || 'a space'}"`,
          data: data,
          spaceId: data.space_id,
          userId: data.created_by,
          createdAt: new Date()
        };
        console.log('📊 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      // Poll deleted
      channel?.bind('poll-deleted', (data: PusherEventPayload) => {
        console.log('📊 Poll deleted notification:', data);
        const notification = {
          type: 'poll_deleted',
          title: 'Poll Deleted',
          message: `A poll has been deleted in "${data.space_title || 'a space'}"`,
          data: data,
          spaceId: data.space_id,
          createdAt: new Date()
        };
        console.log('📊 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });

      channel?.bind('activity-created', (data: PusherEventPayload) => {
        console.log('📅 New activity notification:', data);
        const notification = {
          type: data.type || 'activity_created',
          title: data.title || 'New Activity',
          message: data.message || `${(data.creator as Record<string, unknown>)?.name || 'Someone'} created "${(data.activity as Record<string, unknown>)?.title}" in "${data.space?.title}"`,
          data: data,
          spaceId: data.space_id,
          activityId: (data.activity as Record<string, unknown>)?.id,
          userId: (data.creator as Record<string, unknown>)?.id,
          avatar: data.profile_photo || (data.creator as Record<string, unknown>)?.profile_photo || data.user?.profile_photo,
          createdAt: new Date()
        };
        console.log('📅 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);

        // Ensure the calendar gets updated instantly with the new activity
        if (data.activity) {
          try {
            import('@/stores/collaborationStore').then((mod) => {
              mod.useCollaborationStore.getState().handleSpaceEvent({
                type: 'activity-created',
                data: { activity: data.activity }
              });
            });
          } catch { /* ignore */ }
        }
      });

      channel?.bind('activity-updated', (data: PusherEventPayload) => {
        console.log('📅 Activity updated notification:', data);
        const notification = {
          type: data.type || 'activity_updated',
          title: data.title || 'Activity Updated',
          message: data.message || `Activity "${(data.activity as Record<string, unknown>)?.title}" was updated`,
          data: data,
          spaceId: data.space_id,
          activityId: (data.activity as Record<string, unknown>)?.id,
          avatar: data.profile_photo || (data.creator as Record<string, unknown>)?.profile_photo || data.user?.profile_photo,
          createdAt: new Date()
        };
        onNotification(notification as Record<string, unknown>);
        if (data.activity) {
          try {
            import('@/stores/collaborationStore').then((mod) => {
              mod.useCollaborationStore.getState().handleSpaceEvent({
                type: 'activity-updated',
                data: { activity: data.activity }
              });
            });
          } catch { /* ignore */ }
        }
      });

      channel?.bind('activity-deleted', (data: PusherEventPayload) => {
        console.log('📅 Activity deleted notification:', data);
        const notification = {
          type: 'activity_deleted',
          title: 'Activity Deleted',
          message: 'An activity was removed',
          data: data,
          spaceId: data.space_id,
          activityId: data.activity_id as string,
          createdAt: new Date()
        };
        onNotification(notification as Record<string, unknown>);
        try {
          import('@/stores/collaborationStore').then((mod) => {
            mod.useCollaborationStore.getState().handleSpaceEvent({
              type: 'activity-deleted',
              data: { activity_id: data.activity_id, space_id: data.space_id }
            });
          });
        } catch { /* ignore */ }
      });

      channel?.bind('space-created', (data: PusherEventPayload) => {
        console.log('🚀 New space created by someone you follow:', data);

        const notification = {
          type: 'space_created',
          title: 'New Space Created',
          message: `${(data.creator as Record<string, unknown>)?.name || 'Someone'} created a new space: "${data.space?.title}"`,
          data: data,
          spaceId: data.space?.id,
          userId: (data.creator as Record<string, unknown>)?.id,
          avatar: (data.creator as Record<string, unknown>)?.profile_photo,
          createdAt: new Date()
        };

        console.log('🚀 SENDING TO NOTIFICATION STORE:', notification);
        onNotification(notification as Record<string, unknown>);
      });
      // ==================== END OF CHAT PAGE NOTIFICATIONS ====================

      // Consistently moved to a single handler
      channel?.bind('pusher:subscription_succeeded', () => {
        console.log(`✅ SUBSCRIBED TO USER NOTIFICATIONS: ${channelName}`);
      });

      channel?.bind('pusher:subscription_error', (error: Record<string, unknown>) => {
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

  // UPDATED: Enhanced posts-global subscription with all event types
  subscribeToPosts(
    postIds: number[],
    onNewComment: (data: Record<string, unknown>) => void,
    onNewReaction: (data: Record<string, unknown>) => void,
    onCommentReaction: (data: Record<string, unknown>) => void,
    onNewPost: (data: Record<string, unknown>) => void,
    onPostUpdated: (data: Record<string, unknown>) => void,
    onPostDeleted: (data: Record<string, unknown>) => void,
    onCommentDeleted: (data: Record<string, unknown>) => void,
    onReactionDeleted: (data: Record<string, unknown>) => void
  ): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.log('⏳ Pusher not ready. Queuing posts subscription.');
      this.pendingSubscriptions.push(() =>
        this.subscribeToPosts(postIds, onNewComment, onNewReaction, onCommentReaction, onNewPost, onPostUpdated, onPostDeleted, onCommentDeleted, onReactionDeleted)
      );
      return true;
    }

    try {
      const channelName = `posts-global`;

      if (this.channels.has(channelName)) {
        console.log(`ℹ️ Already subscribed to global posts channel`);
        return true;
      }

      const channel = this.pusher.subscribe(channelName);

      // Comments
      channel?.bind('new-comment', (data: PusherEventPayload) => {
        console.log('💬 Global channel: comment received:', data.postId);
        onNewComment(data as Record<string, unknown>);
      });

      // Post Reactions
      channel?.bind('new-reaction', (data: PusherEventPayload) => {
        console.log('❤️ Global channel: reaction received:', data.postId);
        onNewReaction(data as Record<string, unknown>);
      });

      // New Posts
      channel?.bind('new-post', (data: PusherEventPayload) => {
        console.log('📝 Global channel: New post received:', data.post?.id);
        onNewPost(data as Record<string, unknown>);
      });

      // Comment Reactions
      channel?.bind('comment-reaction', (data: PusherEventPayload) => {
        console.log('💖 Global channel: comment reaction received:', data.postId);
        onCommentReaction(data as Record<string, unknown>);
      });


      // Post Updates
      channel?.bind('post-updated', (data: PusherEventPayload) => {
        console.log('✏️ Global channel: post update received:', data.postId);
        onPostUpdated(data as Record<string, unknown>);
      });

      // Post Deletions
      channel?.bind('post-deleted', (data: PusherEventPayload) => {
        console.log('🗑️ Global channel: post deletion received:', data.postId);
        onPostDeleted(data as Record<string, unknown>);
      });

      // Comment Deletions
      channel?.bind('comment-deleted', (data: PusherEventPayload) => {
        console.log('🗑️ Global channel: comment deletion received:', data.postId);
        onCommentDeleted(data as Record<string, unknown>);
      });

      // Reaction Deletions
      channel?.bind('reaction-deleted', (data: PusherEventPayload) => {
        console.log('❌ Global channel: reaction deletion received:', data.postId);
        onReactionDeleted(data as Record<string, unknown>);
      });

      // Chatbot Training (if relevant to posts)
      channel?.bind('chatbot-training-needed', (data: PusherEventPayload) => {
        console.log('🤖 Global channel: Chatbot training needed', data);
        // You might want to handle this differently for posts channel
      });

      channel?.bind('pusher:subscription_succeeded', () => {
        console.log(`✅ SUBSCRIBED TO GLOBAL POSTS CHANNEL for ${postIds.length} posts`);
      });

      channel?.bind('pusher:subscription_error', (error: Record<string, unknown>) => {
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
    onNewComment: (data: Record<string, unknown>) => void,
    onNewReaction: (data: Record<string, unknown>) => void,
    onCommentReaction: (data: Record<string, unknown>) => void,
    onNewPost: (data: Record<string, unknown>) => void,
    onPostUpdated: (data: Record<string, unknown>) => void,
    onPostDeleted: (data: Record<string, unknown>) => void,
    onCommentDeleted: (data: Record<string, unknown>) => void,
    onReactionDeleted: (data: Record<string, unknown>) => void
  ): boolean {
    // First unsubscribe from old channel
    this.unsubscribeFromChannel('posts-global');

    // Then subscribe with new post list
    return this.subscribeToPosts(
      postIds,
      onNewComment,
      onNewReaction,
      onCommentReaction,
      onNewPost,
      onPostUpdated,
      onPostDeleted,
      onCommentDeleted,
      onReactionDeleted
    );
  }

  unsubscribeFromIndividualPost(postId: number): void {
    const channelName = `post.${postId}`;
    this.unsubscribeFromChannel(channelName);
  }


  // subscribing to spaces
  subscribeToSpace(spaceId: string, callbacks: {
    onSpaceUpdate?: (data: Record<string, unknown>) => void;
    onParticipantJoined?: (data: Record<string, unknown>) => void;
    onParticipantLeft?: (data: Record<string, unknown>) => void;
    onMessage?: (data: Record<string, unknown>) => void;
    onCallStarted?: (data: Record<string, unknown>) => void;
    onCallEnded?: (data: Record<string, unknown>) => void;
    onMagicEvent?: (data: Record<string, unknown>) => void;
    onScreenShareStarted?: (data: Record<string, unknown>) => void;
    onScreenShareEnded?: (data: Record<string, unknown>) => void;
    onPollCreated?: (poll: Record<string, unknown>) => void;
    onPollUpdated?: (poll: Record<string, unknown>) => void;
    onPollDeleted?: (poll_id: string) => void;
    // ✅ NEW: message lifecycle events
    onMessageDeleted?: (data: Record<string, unknown>) => void;
    onMessageReacted?: (data: Record<string, unknown>) => void;
    onMessageReplied?: (data: Record<string, unknown>) => void;

    // Space Management Events
    onSpaceMuted?: (data: Record<string, unknown>) => void;
    onSpacePinned?: (data: Record<string, unknown>) => void;
    onSpaceArchived?: (data: Record<string, unknown>) => void;
    onSpaceUnread?: (data: Record<string, unknown>) => void;
    onSpaceDeleted?: (data: Record<string, unknown>) => void;

    // Activity Events
    onActivityCreated?: (data: Record<string, unknown>) => void;
    onActivityUpdated?: (data: Record<string, unknown>) => void;
    onActivityDeleted?: (data: Record<string, unknown>) => void;
    onWebRTCSignal?: (data: Record<string, unknown>) => void;
    onMuteStateChanged?: (data: Record<string, unknown>) => void;
    onvideoStateChanged?: (data: Record<string, unknown>) => void;
  }): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.log('⏳ Pusher not initialized. Queuing space subscription.');
      this.pendingSubscriptions.push(() => this.subscribeToSpace(spaceId, callbacks));
      return true;
    }

    // Guard: ignore invalid or reserved IDs that may be passed due to routing mishaps
    if (spaceId === 'Login' || spaceId === 'undefined' || spaceId === '[id]') {
      console.warn(`🛑 Ignoring invalid space subscription attempt for ID: ${spaceId}`);
      return false;
    }

    const channelName = `presence-space-${spaceId}`;
    let channel = this.channels.get(channelName);

    if (channel) {
      console.log(`ℹ️ Already subscribed to space: ${channelName}, applying additional bindings`);
    } else {
      console.log(`🔌 Subscribing to space channel: ${channelName}`);
      channel = this.pusher.subscribe(channelName);
      this.channels.set(channelName, channel);
    }

    // Bind all space events
    if (callbacks.onSpaceUpdate) {
      channel?.bind('space-updated', callbacks.onSpaceUpdate);
    }

    if (callbacks.onParticipantJoined) {
      channel?.bind('participant-joined', callbacks.onParticipantJoined);
    }

    if (callbacks.onParticipantLeft) {
      channel?.bind('participant-left', callbacks.onParticipantLeft);
    }

    if (callbacks.onMessage) {
      channel?.bind('message-sent', callbacks.onMessage);
    }

    if (callbacks.onCallStarted) {
      channel?.bind('call-started', callbacks.onCallStarted);
    }

    if (callbacks.onCallEnded) {
      channel?.bind('call-ended', callbacks.onCallEnded);
    }

    if (callbacks.onWebRTCSignal) {
      channel?.bind('webrtc-signal', callbacks.onWebRTCSignal);
    }

    if (callbacks.onMagicEvent) {
      channel?.bind('magic-triggered', callbacks.onMagicEvent);
    }

    if (callbacks.onScreenShareStarted) {
      channel?.bind('screen_share-started', callbacks.onScreenShareStarted);
    }

    if (callbacks.onScreenShareEnded) {
      channel?.bind('screen_share-ended', callbacks.onScreenShareEnded);
    }

    if (callbacks.onMuteStateChanged) {
      channel?.bind('mute-state-changed', callbacks.onMuteStateChanged);
    }

    if (callbacks.onvideoStateChanged) {
      channel?.bind('video-state-changed', callbacks.onvideoStateChanged);
    }

    // Space Management Events
    if (callbacks.onSpaceMuted) {
      channel?.bind('space-muted', callbacks.onSpaceMuted);
    }

    if (callbacks.onSpacePinned) {
      channel?.bind('space-pinned', callbacks.onSpacePinned);
    }

    if (callbacks.onSpaceArchived) {
      channel?.bind('space-archived', callbacks.onSpaceArchived);
    }

    if (callbacks.onSpaceUnread) {
      channel?.bind('space-unread', callbacks.onSpaceUnread);
    }

    // ✅ NEW: message lifecycle events → notification store
    if (callbacks.onMessageDeleted) {
      channel?.bind('message-deleted', callbacks.onMessageDeleted);
    }

    if (callbacks.onMessageReacted) {
      channel?.bind('message-reacted', callbacks.onMessageReacted);
    }

    if (callbacks.onMessageReplied) {
      channel?.bind('message-replied', callbacks.onMessageReplied);
    }

    if (callbacks.onSpaceDeleted) {
      channel?.bind('space-deleted', callbacks.onSpaceDeleted);
    }

    // Activity bindings
    if (callbacks.onActivityCreated) {
      channel?.bind('activity-created', callbacks.onActivityCreated);
    }
    if (callbacks.onActivityUpdated) {
      channel?.bind('activity-updated', callbacks.onActivityUpdated);
    }
    if (callbacks.onActivityDeleted) {
      channel?.bind('activity-deleted', callbacks.onActivityDeleted);
    }

    if (callbacks.onPollCreated) {
      channel?.bind('poll-created', (data: PusherEventPayload) => {
        console.log(`📊 Poll created in space ${spaceId}:`, (data.poll as Record<string, unknown>)?.question);
        callbacks.onPollCreated?.(data.poll as Record<string, unknown>);
      });
    }
    if (callbacks.onPollDeleted) {
      channel?.bind('poll-deleted', (data: PusherEventPayload) => {
        console.log(`🗑️ Poll deleted from space ${spaceId}:`, data.poll_id);
        callbacks.onPollDeleted?.(data.poll_id as string);
      });
    }

    if (callbacks.onPollUpdated) {
      channel?.bind('poll-updated', (data: PusherEventPayload) => {
        console.log(`📊 Poll updated in space ${spaceId}`);
        callbacks.onPollUpdated?.(data.poll as Record<string, unknown>);
      });
    }
    channel?.bind('pusher:subscription_succeeded', () => {
      console.log(`✅ Successfully subscribed to space: ${channelName}`);
    });

    channel?.bind('pusher:subscription_error', (error: Record<string, unknown>) => {
      console.error(`❌ Subscription error for space ${channelName}:`, error);
    });

    this.channels.set(channelName, channel);
    return true;
  }

  // ✅ NEW: Subscribe to global spaces channel
  subscribeToAllSpaces(onSpaceUpdated: (data: Record<string, unknown>) => void): boolean {
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

      channel?.bind('space-updated', (data: PusherEventPayload) => {
        console.log('🪐 Global space update received:', data);
        onSpaceUpdated(data as Record<string, unknown>);
      });

      channel?.bind('space-deleted', (data: PusherEventPayload) => {
        console.log('🗑️ Global space deletion received:', data);
        onSpaceUpdated({ ...data, type: 'space-deleted' } as Record<string, unknown>);
      });

      channel?.bind('pusher:subscription_succeeded', () => {
        console.log(`✅ SUBSCRIBED TO GLOBAL SPACES CHANNEL`);
      });

      channel?.bind('pusher:subscription_error', (error: Record<string, unknown>) => {
        console.error(`❌ GLOBAL SPACES SUBSCRIPTION ERROR:`, error);
      });

      this.channels.set(channelName, channel);
      return true;
    } catch (error) {
      console.error(`❌ ERROR SUBSCRIBING TO GLOBAL SPACES:`, error);
      return false;
    }
  }


  // Removed redundant subscribeToPrivateUser - handled in subscribeToUserNotifications
  // Generic unsubscribe method
  // ✅ NEW: Subscribe to follower-only stories channel (via private user channel)
  subscribeToStories(
    onStoryCreated: (data: Record<string, unknown>) => void,
    onStoryDeleted: (data: Record<string, unknown>) => void
  ): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.log('⏳ Pusher not ready. Queuing stories subscription.');
      this.pendingSubscriptions.push(() =>
        this.subscribeToStories(onStoryCreated, onStoryDeleted)
      );
      return true;
    }

    try {
      // 🚀 EXTREME PERFORMANCE: Get current user ID for private channel
      const { useAuthStore } = require('../stores/useAuthStore');
      const userId = useAuthStore.getState().user?.id;

      if (!userId) {
        console.warn('⚠️ No user ID found for stories subscription. Waiting for login.');
        // We will be re-initialized after login anyway thanks to currentToken check
        return false;
      }

      const channelName = `private-user-${userId}`;

      console.log(`📡 PusherService: Subscribing to stories on private channel: ${channelName}`);

      // Add to registry for auto-resubscription
      if (!this.subscriptionRegistry.has(channelName)) {
        this.subscriptionRegistry.set(channelName, {
          onEvent: (event, data) => { },
          bindings: new Map()
        });
      }

      const reg = this.subscriptionRegistry.get(channelName)!;
      reg.bindings.set('story-created', onStoryCreated);
      reg.bindings.set('story-deleted', onStoryDeleted);

      const channel = this.pusher.subscribe(channelName);

      channel?.bind('story-created', (data: any) => {
        console.log(`✨ PusherService: story-created received on channel ${channelName}`, data);
        onStoryCreated(data);
      });

      channel?.bind('story-deleted', (data: any) => {
        console.log(`🗑️ PusherService: story-deleted received on channel ${channelName}`, data);
        onStoryDeleted(data);
      });

      this.channels.set(channelName, channel);
      return true;
    } catch (error) {
      console.error(`❌ ERROR SUBSCRIBING TO STORIES:`, error);
      return false;
    }
  }

  unsubscribeFromStories(): void {
    const { useAuthStore } = require('../stores/useAuthStore');
    const userId = useAuthStore.getState().user?.id;
    if (userId) {
      this.unsubscribeFromChannel(`private-user-${userId}`);
    }
  }

  // ✅ ADDED: Generic subscribe method for custom notification types
  subscribe(channelName: string): PusherChannel {
    if (!this.pusher || !this.isInitialized) {
      console.warn('⚠️ Pusher not ready for subscription:', channelName);
      // Return a dummy object if not ready yet, or we could queue it
      return {
        bind: (event: string, callback: (data: Record<string, unknown>) => void) => {
          this.pendingSubscriptions.push(() => {
            const channel = this.pusher?.subscribe(channelName);
            channel?.bind(event, callback);
          });
        },
        unbind: () => { }, // Dummy for interface compliance
      };
    }
    return this.pusher.subscribe(channelName);
  }

  // ✅ Keep existing unsubscribe methods...
  public unsubscribeFromChannel(channelName: string): void {
    if (this.pusher && this.channels.has(channelName)) {
      this.pusher.unsubscribe(channelName);
      this.channels.delete(channelName);
      console.log(`🔌 Pusher: Unsubscribed from ${channelName}`);
    }
  }

  // Cleanup all subscriptions
  disconnect(): void {
    if (this.pusher) {
      try {
        // Unsubscribe from all channels first if connection is still active
        const connectionState = this.pusher.connection.state;
        const canUnsubscribe = connectionState === 'connected';

        this.channels.forEach((_channel, channelName) => {
          if (canUnsubscribe) {
            try {
              this.pusher?.unsubscribe(channelName);
            } catch {
              // Silently ignore closure errors during disconnect
            }
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
    // ✅ RELAXED: On web, pusher instance is enough because it queues commands.
    // On native, we still prefer to wait for initialized state for stability.
    if (Platform.OS === 'web') return this.pusher !== null;
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

  // NEW: Subscribe to market-global channel
  subscribeToMarket(
    onItemCommented: (data: Record<string, unknown>) => void,
    onItemReacted: (data: Record<string, unknown>) => void,
    onItemUpdated: (data: Record<string, unknown>) => void,
    onItemDeleted: (data: Record<string, unknown>) => void
  ): boolean {
    if (!this.pusher || !this.isInitialized) {
      console.log('⏳ Pusher not ready. Queuing market subscription.');
      this.pendingSubscriptions.push(() =>
        this.subscribeToMarket(onItemCommented, onItemReacted, onItemUpdated, onItemDeleted)
      );
      return true;
    }

    try {
      const channelName = `market-global`;

      if (this.channels.has(channelName)) {
        console.log(`ℹ️ Already subscribed to global market channel`);
        return true;
      }

      const channel = this.pusher.subscribe(channelName);

      channel?.bind('market-item-commented', (data: PusherEventPayload) => {
        console.log('🛒 Global channel: market item commented:', data.itemId);
        onItemCommented(data as Record<string, unknown>);
      });

      channel?.bind('market-item-reacted', (data: PusherEventPayload) => {
        console.log('🛒 Global channel: market item reacted:', data.itemId);
        onItemReacted(data as Record<string, unknown>);
      });

      channel?.bind('market-item-updated', (data: PusherEventPayload) => {
        console.log('🛒 Global channel: market item updated:', data.itemId);
        onItemUpdated(data as Record<string, unknown>);
      });

      channel?.bind('market-item-deleted', (data: PusherEventPayload) => {
        console.log('🛒 Global channel: market item deleted:', data.itemId);
        onItemDeleted(data as Record<string, unknown>);
      });

      this.channels.set(channelName, channel);
      return true;
    } catch (error) {
      console.error(`❌ ERROR SUBSCRIBING TO MARKET:`, error);
      return false;
    }
  }

  unsubscribeFromMarket(): void {
    this.unsubscribeFromChannel('market-global');
  }
}

export default new PusherService();