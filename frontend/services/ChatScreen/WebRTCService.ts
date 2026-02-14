import { Platform } from 'react-native';
import { getToken } from '../TokenService';
import getApiBase from '../getApiBase';
import PusherService from '@/services/PusherService';
import * as Haptics from 'expo-haptics';

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  isMuted: boolean;
  hasVideo: boolean;
}

class WebRTCService {
  private static instance: WebRTCService;
  private peerConnections: Map<string, any> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private spaceId: string | null = null;
  private userId: number | null = null;
  private callId: string | null = null;
  private pusherService = PusherService;
  
  // Callbacks
  private onRemoteStreamCallback: ((userId: string, stream: MediaStream) => void) | null = null;
  private onCallEndedCallback: (() => void) | null = null;
  private onParticipantJoinedCallback: ((userId: string) => void) | null = null;
  private onParticipantLeftCallback: ((userId: string) => void) | null = null;
  private onScreenShareStartedCallback: ((userId: string) => void) | null = null;
  private onScreenShareEndedCallback: ((userId: string) => void) | null = null;
  private onMuteStateChangedCallback: ((userId: string, isMuted: boolean) => void) | null = null;
  private onVideoStateChangedCallback: ((userId: string, hasVideo: boolean) => void) | null = null;

  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  private constructor() {}

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  async initialize(userId: number) {
    this.userId = userId;
    console.log('📞 WebRTCService initialized for user:', userId, 'Platform:', Platform.OS);
  }

  async getLocalStream(videoEnabled: boolean = true, audioEnabled: boolean = true): Promise<MediaStream | null> {
    // ✅ FIX: WebRTC is only available on web platform
    if (Platform.OS !== 'web') {
      console.log('📞 WebRTC not available on native, using native call UI instead');
      return null;
    }

    if (this.localStream) {
      // Update tracks if needed
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = videoEnabled;
      });
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = audioEnabled;
      });
      return this.localStream;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
        audio: audioEnabled,
      });

      return this.localStream;
    } catch (error) {
      console.error('Error getting local stream:', error);
      throw error;
    }
  }

  async getScreenStream(): Promise<MediaStream | null> {
    if (Platform.OS !== 'web') {
      console.log('📞 Screen sharing not available on native');
      return null;
    }

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      return this.screenStream;
    } catch (error) {
      console.error('Error getting screen stream:', error);
      throw error;
    }
  }

  async joinCall(spaceId: string, callId: string, isInitiator: boolean = false) {
    this.spaceId = spaceId;
    this.callId = callId;
    
    console.log(`📞 Joining call ${callId} in space ${spaceId}, isInitiator: ${isInitiator}, platform: ${Platform.OS}`);
    
    // ✅ FIX: Only get local stream on web platform
    if (Platform.OS === 'web') {
      try {
        await this.getLocalStream(true, true);
      } catch (error) {
        console.error('Failed to get local stream:', error);
      }
    }
    
    // Set up signaling listeners
    this.setupSignalingListeners();
    
    // If not initiator, we wait for offers
    if (!isInitiator) {
      console.log('📞 Not initiator, waiting for WebRTC offers...');
    }
  }

  private setupSignalingListeners() {
    if (!this.spaceId || !this.pusherService.isReady()) {
      console.warn('📞 Cannot setup signaling listeners: Pusher not ready or no spaceId');
      return;
    }

    const pusher = (this.pusherService as any).pusher;
    if (!pusher) return;

    const channelName = `presence-space.${this.spaceId}`;
    console.log(`📞 Setting up WebRTC signaling listeners on channel: ${channelName}`);
    
    const channel = pusher.channel(channelName);
    
    if (!channel) {
      console.warn(`📞 Channel ${channelName} not found, will retry...`);
      setTimeout(() => this.setupSignalingListeners(), 1000);
      return;
    }

    // Bind to WebRTC signal events
    channel.bind('webrtc.signal', async (data: any) => {
      console.log('📞 WebRTC signal received:', data.type, 'from:', data.from_user_id);
      
      if (data.from_user_id === this.userId) {
        return; // Ignore our own signals
      }

      // ✅ FIX: Only handle WebRTC on web platform
      if (Platform.OS !== 'web') {
        console.log('📞 Ignoring WebRTC signal on native platform');
        return;
      }

      switch (data.type) {
        case 'offer':
          await this.handleOffer(data);
          break;
        case 'answer':
          await this.handleAnswer(data);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(data);
          break;
      }
    });

    // Bind to call events
    channel.bind('call.ended', (data: any) => {
      console.log('📞 Call ended event received:', data);
      if (this.onCallEndedCallback) {
        this.onCallEndedCallback();
      }
    });

    channel.bind('mute.state.changed', (data: any) => {
      if (this.onMuteStateChangedCallback && data.user_id !== this.userId) {
        this.onMuteStateChangedCallback(data.user_id.toString(), data.is_muted);
      }
    });

    channel.bind('video.state.changed', (data: any) => {
      if (this.onVideoStateChangedCallback && data.user_id !== this.userId) {
        this.onVideoStateChangedCallback(data.user_id.toString(), data.has_video);
      }
    });

    console.log('📞 WebRTC signaling listeners setup complete');
  }

  async createOffer(targetUserId: number) {
    // ✅ FIX: Only create offers on web platform
    if (Platform.OS !== 'web') {
      console.log('📞 WebRTC offers only available on web');
      return;
    }

    if (!this.spaceId || !this.localStream || !this.callId) {
      console.error('Cannot create offer: missing required data');
      return;
    }

    try {
      console.log(`📞 Creating WebRTC offer for user ${targetUserId}`);
      
      const peerConnection = this.createPeerConnection(targetUserId.toString());
      
      // Add local stream tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });

      // Create offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      await peerConnection.setLocalDescription(offer);
      console.log('📞 Offer created, sending to backend...');

      // Send offer via API
      await this.sendSignal(targetUserId, 'offer', { offer });

    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  private async handleOffer(data: any) {
    if (Platform.OS !== 'web') return;

    if (!this.spaceId || !this.localStream || !this.callId) {
      console.error('Cannot handle offer: missing required data');
      return;
    }

    try {
      console.log(`📞 Handling WebRTC offer from user ${data.from_user_id}`);
      
      const peerConnection = this.createPeerConnection(data.from_user_id.toString());
      
      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });

      // Set remote description
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      // Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      console.log('📞 Answer created, sending to backend...');
      
      // Send answer via API
      await this.sendSignal(data.from_user_id, 'answer', { answer });

    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  private async handleAnswer(data: any) {
    if (Platform.OS !== 'web') return;

    try {
      console.log(`📞 Handling WebRTC answer from user ${data.from_user_id}`);
      
      const peerConnection = this.peerConnections.get(data.from_user_id.toString());
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('📞 Remote description set successfully');
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  private async handleIceCandidate(data: any) {
    if (Platform.OS !== 'web') return;

    try {
      console.log(`📞 Handling ICE candidate from user ${data.from_user_id}`);
      
      const peerConnection = this.peerConnections.get(data.from_user_id.toString());
      if (peerConnection && data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('📞 ICE candidate added successfully');
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    if (Platform.OS !== 'web') {
      throw new Error('WebRTC only available on web');
    }

    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    console.log(`📞 Creating new peer connection for ${peerId}`);
    
    const peerConnection = new RTCPeerConnection(this.iceServers);
    this.peerConnections.set(peerId, peerConnection);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.spaceId && this.callId) {
        console.log('📞 ICE candidate generated, sending to peer...');
        this.sendSignal(parseInt(peerId), 'ice-candidate', {
          candidate: event.candidate,
        });
      }
    };

    // Handle incoming streams
    peerConnection.ontrack = (event) => {
      console.log(`📞 Received remote stream from ${peerId}`);
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(peerId, event.streams[0]);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`📞 Connection state with ${peerId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        this.triggerHapticSuccess();
      }
      
      if (peerConnection.connectionState === 'disconnected' || 
          peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'closed') {
        this.handleParticipantLeft(parseInt(peerId));
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`📞 ICE connection state with ${peerId}:`, peerConnection.iceConnectionState);
    };

    return peerConnection;
  }

  private async sendSignal(targetUserId: number, type: string, data: any) {
    if (!this.spaceId || !this.callId) {
      console.error('Cannot send signal: missing spaceId or callId');
      return;
    }

    try {
      const token = await getToken();
      const API_BASE = getApiBase();
      
      const payload = {
        type,
        target_user_id: targetUserId,
        call_id: this.callId,
        ...data,
      };

      console.log(`📞 Sending ${type} signal to user ${targetUserId}`);

      const response = await fetch(`${API_BASE}/spaces/${this.spaceId}/call/signal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to send signal: ${response.status}`);
      }

      console.log(`📞 ${type} signal sent successfully`);

    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }

  private handleParticipantLeft(userId: number) {
    const peerId = userId.toString();
    const connection = this.peerConnections.get(peerId);
    
    if (connection) {
      connection.close();
      this.peerConnections.delete(peerId);
    }
    
    if (this.onParticipantLeftCallback) {
      this.onParticipantLeftCallback(peerId);
    }
  }

  async toggleMute(isMuted: boolean) {
    if (Platform.OS === 'web' && this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
    
    // Broadcast mute state
    if (this.spaceId && this.callId) {
      const token = await getToken();
      const API_BASE = getApiBase();
      
      await fetch(`${API_BASE}/spaces/${this.spaceId}/call/mute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_muted: isMuted,
          call_id: this.callId,
        }),
      });
    }
  }

  async toggleVideo(hasVideo: boolean) {
    if (Platform.OS === 'web' && this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = hasVideo;
      });
    }
    
    // Broadcast video state
    if (this.spaceId && this.callId) {
      const token = await getToken();
      const API_BASE = getApiBase();
      
      await fetch(`${API_BASE}/spaces/${this.spaceId}/call/video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          has_video: hasVideo,
          call_id: this.callId,
        }),
      });
    }
  }

  async startScreenShare(): Promise<void> {
    if (Platform.OS !== 'web') {
      throw new Error('Screen sharing only available on web');
    }

    try {
      const screenStream = await this.getScreenStream();
      if (!screenStream) return;
      
      const videoTrack = screenStream.getVideoTracks()[0];
      
      this.peerConnections.forEach((connection) => {
        const sender = connection.getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
      
      if (this.spaceId && this.callId) {
        const token = await getToken();
        const API_BASE = getApiBase();
        
        await fetch(`${API_BASE}/spaces/${this.spaceId}/call/screen-share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            is_sharing: true,
            call_id: this.callId,
          }),
        });
      }
      
      videoTrack.onended = () => {
        this.stopScreenShare();
      };
      
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (Platform.OS !== 'web' || !this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    
    this.peerConnections.forEach((connection) => {
      const sender = connection.getSenders().find((s: any) => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
    });
    
    if (this.spaceId && this.callId) {
      const token = await getToken();
      const API_BASE = getApiBase();
      
      await fetch(`${API_BASE}/spaces/${this.spaceId}/call/screen-share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_sharing: false,
          call_id: this.callId,
        }),
      });
    }
    
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
  }

  async endCall() {
    // Close all peer connections
    this.peerConnections.forEach((connection) => {
      if (connection.close) {
        connection.close();
      }
    });
    this.peerConnections.clear();
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Stop screen share
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    
    this.spaceId = null;
    this.callId = null;
  }

  // ✅ FIX: Platform-safe haptics
  private async triggerHapticSuccess() {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.warn('Haptics not available:', error);
      }
    }
  }

  // Callback setters
  onRemoteStream(callback: (userId: string, stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  onCallEnded(callback: () => void) {
    this.onCallEndedCallback = callback;
  }

  onParticipantJoined(callback: (userId: string) => void) {
    this.onParticipantJoinedCallback = callback;
  }

  onParticipantLeft(callback: (userId: string) => void) {
    this.onParticipantLeftCallback = callback;
  }

  onScreenShareStarted(callback: (userId: string) => void) {
    this.onScreenShareStartedCallback = callback;
  }

  onScreenShareEnded(callback: (userId: string) => void) {
    this.onScreenShareEndedCallback = callback;
  }

  onMuteStateChanged(callback: (userId: string, isMuted: boolean) => void) {
    this.onMuteStateChangedCallback = callback;
  }

  onVideoStateChanged(callback: (userId: string, hasVideo: boolean) => void) {
    this.onVideoStateChangedCallback = callback;
  }

  cleanup() {
    this.endCall();
  }
}

export default WebRTCService;