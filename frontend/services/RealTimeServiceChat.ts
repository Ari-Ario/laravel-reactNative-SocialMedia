// services/RealTimeServiceChat.ts
import Pusher, { Channel } from 'pusher-js';
import { Platform } from 'react-native';
import { getToken } from './TokenService';
import getApiBase from './getApiBase';

type EventCallback = (data: any) => void;

class RealTimeService {
  private static instance: RealTimeService;
  private pusher: Pusher | null = null;
  private channels: Map<string, Channel> = new Map();
  private subscriptions: Map<string, Map<string, EventCallback>> = new Map();

  private constructor() {
    // Initialize on demand
  }

  static getInstance(): RealTimeService {
    if (!RealTimeService.instance) {
      RealTimeService.instance = new RealTimeService();
    }
    return RealTimeService.instance;
  }

  async initialize(userId: string) {
    if (this.pusher) return;

    const token = await getToken();
    const API_BASE = getApiBase();

    this.pusher = new Pusher(process.env.EXPO_PUBLIC_PUSHER_APP_KEY!, {
      cluster: process.env.EXPO_PUBLIC_PUSHER_APP_CLUSTER!,
      authEndpoint: `${API_BASE}/broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
    });

    // Subscribe to user's private channel
    this.subscribeToUserChannel(userId);
  }

  private subscribeToUserChannel(userId: string) {
    const channelName = `private-user.${userId}`;
    const channel = this.pusher!.subscribe(channelName);
    this.channels.set(channelName, channel);

    channel.bind('user.activity', (data: any) => {
      console.log('User activity:', data);
      this.notifySubscribers('user', 'activity', data);
    });
  }

  subscribeToSpace(spaceId: string, callbacks: {
    onSpaceUpdate?: EventCallback;
    onParticipantUpdate?: EventCallback;
    onMessage?: EventCallback;
    onMagicEvent?: EventCallback;
  }) {
    const channelName = `presence-space.${spaceId}`;
    
    if (!this.channels.has(channelName)) {
      const channel = this.pusher!.subscribe(channelName);
      this.channels.set(channelName, channel);

      // Bind events
      if (callbacks.onSpaceUpdate) {
        channel.bind('space.updated', callbacks.onSpaceUpdate);
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
  }

  unsubscribeFromSpace(spaceId: string) {
    const channelName = `presence-space.${spaceId}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
      this.subscriptions.delete(`space-${spaceId}`);
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
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
      this.channels.clear();
      this.subscriptions.clear();
    }
  }
}

export default RealTimeService;