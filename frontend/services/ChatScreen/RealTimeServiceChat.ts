// it is not used and PusherService is used instead, throeugh collaborationService.subscribeToSpace(spaceId,
// but we want to keep it around for now in case we need to add any custom logic later on.
// services/ChatScreen/RealTimeServiceChat.ts

import type Pusher from 'pusher-js';
import type { Channel } from 'pusher-js';
import { Platform } from 'react-native';
import { getToken } from '@/services/TokenService';
import getApiBase from '@/services/getApiBase';
import PusherService from '@/services/PusherService';

type EventCallback = (data: any) => void;

class RealTimeService {
  private static instance: RealTimeService;
  private pusherService: typeof PusherService;
  private channels: Map<string, any> = new Map();
  private subscriptions: Map<string, Map<string, EventCallback>> = new Map();

  private constructor() {
    // ✅ FIX: Use the existing PusherService - DO NOT create a new Pusher instance
    this.pusherService = PusherService;
  }

  static getInstance(): RealTimeService {
    if (!RealTimeService.instance) {
      RealTimeService.instance = new RealTimeService();
    }
    return RealTimeService.instance;
  }

  /**
   * ✅ FIXED: Don't create a new Pusher connection - use the existing one from PusherService
   */
  async initialize(userId: string) {
    // ✅ FIX: Check if PusherService is already initialized
    if (this.pusherService.isReady()) {
      console.log('✅ RealTimeService: Pusher already initialized, subscribing to user channel');
      this.subscribeToUserChannel(userId);
      return;
    }

    console.log('⏳ RealTimeService: Waiting for Pusher to be initialized...');

    // Wait up to 3 seconds for Pusher to be initialized
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (this.pusherService.isReady()) {
        console.log('✅ RealTimeService: Pusher became ready, subscribing to user channel');
        this.subscribeToUserChannel(userId);
        return;
      }
    }

    console.warn('⚠️ RealTimeService: Pusher not ready after waiting');
  }

  /**
   * ✅ FIXED: Get the pusher instance from PusherService
   */
  private getPusherInstance(): Pusher | null {
    return (this.pusherService as any).pusher || null;
  }

  private subscribeToUserChannel(userId: string) {
    const pusher = this.getPusherInstance();
    if (!pusher) {
      console.error('❌ RealTimeService: Cannot subscribe to user channel - Pusher not available');
      return;
    }

    const channelName = `user.${userId}`; // ✅ FIX: Use 'user.' not 'private-user.'

    if (this.channels.has(channelName)) {
      console.log(`ℹ️ RealTimeService: Already subscribed to ${channelName}`);
      return;
    }

    const channel = pusher.subscribe(channelName);
    this.channels.set(channelName, channel);

    channel.bind('pusher:subscription_succeeded', () => {
      console.log(`✅ RealTimeService: Subscribed to ${channelName}`);
    });

    channel.bind('pusher:subscription_error', (error: any) => {
      console.error(`❌ RealTimeService: Subscription error for ${channelName}:`, error);
    });

    channel.bind('user.activity', (data: any) => {
      console.log('👤 RealTimeService: User activity:', data);
      this.notifySubscribers('user', 'activity', data);
    });

    // Also bind to space invitations
    channel.bind('space-invitation', (data: any) => {
      console.log('📨 RealTimeService: Space invitation received:', data);
      this.notifySubscribers('user', 'invitation', data);
    });

    // Bind to call events
    channel.bind('call-started', (data: any) => {
      console.log('📞 RealTimeService: Call started:', data);
      this.notifySubscribers('user', 'call', data);
    });
  }

  subscribeToSpace(spaceId: string, callbacks: {
    onSpaceUpdate?: EventCallback;
    onParticipantUpdate?: EventCallback;
    onMessage?: EventCallback;
    onMagicEvent?: EventCallback;
  }) {
    const pusher = this.getPusherInstance();
    if (!pusher) {
      console.error('❌ RealTimeService: Cannot subscribe to space - Pusher not available');
      return;
    }

    const channelName = `presence-space.${spaceId}`;

    if (this.channels.has(channelName)) {
      console.log(`ℹ️ RealTimeService: Already subscribed to ${channelName}`);
      return;
    }

    const channel = pusher.subscribe(channelName);
    this.channels.set(channelName, channel);

    channel.bind('pusher:subscription_succeeded', () => {
      console.log(`✅ RealTimeService: Subscribed to ${channelName}`);
    });

    channel.bind('pusher:subscription_error', (error: any) => {
      console.error(`❌ RealTimeService: Subscription error for ${channelName}:`, error);
    });

    // Bind events
    if (callbacks.onSpaceUpdate) {
      channel.bind('space.updated', callbacks.onSpaceUpdate);
      channel.bind('space-updated', callbacks.onSpaceUpdate); // Also listen to hyphenated version
      this.addSubscription('space', spaceId, 'updated', callbacks.onSpaceUpdate);
    }

    if (callbacks.onParticipantUpdate) {
      channel.bind('participant.joined', callbacks.onParticipantUpdate);
      channel.bind('participant.left', callbacks.onParticipantUpdate);
      channel.bind('participant.updated', callbacks.onParticipantUpdate);
    }

    if (callbacks.onMessage) {
      channel.bind('message.sent', callbacks.onMessage);
      channel.bind('message.updated', callbacks.onMessage);
      channel.bind('message.deleted', callbacks.onMessage);
    }

    if (callbacks.onMagicEvent) {
      channel.bind('magic.triggered', callbacks.onMagicEvent);
    }
  }

  unsubscribeFromSpace(spaceId: string) {
    const pusher = this.getPusherInstance();
    if (!pusher) return;

    const channelName = `presence-space.${spaceId}`;
    const channel = this.channels.get(channelName);

    if (channel) {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      this.channels.delete(channelName);
      this.subscriptions.delete(`space-${spaceId}`);
      console.log(`✅ RealTimeService: Unsubscribed from ${channelName}`);
    }
  }

  private addSubscription(type: string, id: string, event: string, callback: EventCallback) {
    const key = `${type}-${id}`;

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Map());
    }

    this.subscriptions.get(key)!.set(event, callback);
  }

  private notifySubscribers(type: string, id: string, event: string, data: any) {
    const key = `${type}-${id}`;
    const callbacks = this.subscriptions.get(key);

    if (callbacks) {
      const callback = callbacks.get(event);
      if (callback) {
        callback(data);
      }
    }
  }

  disconnect() {
    // ✅ FIX: Don't disconnect the main Pusher connection - just clean up our channels
    const pusher = this.getPusherInstance();
    if (pusher) {
      this.channels.forEach((channel, channelName) => {
        channel.unbind_all();
        pusher.unsubscribe(channelName);
      });
    }

    this.channels.clear();
    this.subscriptions.clear();
    console.log('✅ RealTimeService: Cleaned up subscriptions');
  }
}

export default RealTimeService;