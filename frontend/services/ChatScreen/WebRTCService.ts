import { Platform } from 'react-native';
import PusherService from '@/services/PusherService';
import CollaborationService from './CollaborationService';
import * as Haptics from 'expo-haptics';

let RTC_PeerConnection: any;
let RTC_SessionDescription: any;
let RTC_IceCandidate: any;
let media_Devices: any;

if (Platform.OS !== 'web') {
  try {
    const webrtc = require('react-native-webrtc');
    RTC_PeerConnection = webrtc.RTCPeerConnection;
    RTC_SessionDescription = webrtc.RTCSessionDescription;
    RTC_IceCandidate = webrtc.RTCIceCandidate;
    media_Devices = webrtc.mediaDevices;
    console.log('📞 WebRTC Native bindings loaded successfully');
  } catch (e) {
    console.error('📞 Failed to load react-native-webrtc:', e);
  }
} else {
  RTC_PeerConnection = window.RTCPeerConnection || (window as any).webkitRTCPeerConnection || (window as any).mozRTCPeerConnection;
  RTC_SessionDescription = window.RTCSessionDescription;
  RTC_IceCandidate = window.RTCIceCandidate;
  media_Devices = navigator.mediaDevices;
}

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
  private isSubscribed = false;
  private isInitiator = false;
  private signalingTimeout: any = null;
  private localStreamPromise: Promise<MediaStream | null> | null = null;
  private offerInProgress = new Set<number>();
  private isTerminating = false;
  private isViewer = false;

  // Callbacks
  private onRemoteStreamCallback: ((userId: string, stream: MediaStream) => void) | null = null;
  private onCallEndedCallback: (() => void) | null = null;
  private onParticipantJoinedCallback: ((userId: string) => void) | null = null;
  private onParticipantLeftCallback: ((userId: string) => void) | null = null;
  private onScreenShareStartedCallback: ((userId: string) => void) | null = null;
  private onScreenShareEndedCallback: ((userId: string) => void) | null = null;
  private handRaisedCallback: ((userId: string, isRaised: boolean) => void) | null = null;
  private promotedCallback: (() => void) | null = null;
  private onMuteStateChangedCallback: ((userId: string, isMuted: boolean) => void) | null = null;
  private onVideoStateChangedCallback: ((userId: string, hasVideo: boolean) => void) | null = null;
  private onHandRaisedCallback: ((userId: string, isRaised: boolean) => void) | null = null;

  private knownParticipants = new Set<number>();

  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { 
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:3478',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all' as RTCIceTransportPolicy,
  };

  private constructor() { }

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  async initialize(userId: number) {
    this.userId = userId;
    this.isViewer = false; // Reset to default
    console.log('📞 WebRTCService initialized for user:', userId, 'Platform:', Platform.OS);
  }

  async getLocalStream(videoEnabled: boolean = true, audioEnabled: boolean = true): Promise<MediaStream | null> {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => { track.enabled = videoEnabled; });
      this.localStream.getAudioTracks().forEach(track => { track.enabled = audioEnabled; });
      return this.localStream;
    }

    if (this.localStreamPromise) {
      console.log('📞 MediaStream acquisition already in progress, waiting...');
      return this.localStreamPromise;
    }

    this.localStreamPromise = (async () => {
      try {
        console.log('📞 Acquiring MediaStream for Platform:', Platform.OS);

        let stream: MediaStream;
        if (Platform.OS !== 'web') {
          const sourceInfos: any = await media_Devices.enumerateDevices();
          let videoSourceId;
          for (let i = 0; i < sourceInfos.length; i++) {
            const sourceInfo = sourceInfos[i];
            if (sourceInfo.kind === "videoinput" && sourceInfo.facing === "front") {
              videoSourceId = sourceInfo.deviceId;
            }
          }

          try {
            stream = await media_Devices.getUserMedia({
              video: videoEnabled ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
                ...(videoSourceId ? { optional: [{ sourceId: videoSourceId }] } : {})
              } : false,
              audio: audioEnabled,
            });
          } catch (videoError) {
            console.warn('⚠️ Video acquisition failed, falling back to audio only:', videoError);
            stream = await media_Devices.getUserMedia({ video: false, audio: audioEnabled });
          }
        } else {
          try {
            stream = await media_Devices.getUserMedia({
              video: videoEnabled ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
              } : false,
              audio: audioEnabled,
            });
          } catch (videoError) {
            console.warn('⚠️ Web video acquisition failed, falling back to audio only:', videoError);
            stream = await media_Devices.getUserMedia({ video: false, audio: audioEnabled });
          }
        }

        this.localStream = stream;
        return stream;
      } catch (error) {
        console.error('CRITICAL: Media acquisition failed entirely:', error);
        return null;
      } finally {
        this.localStreamPromise = null;
      }
    })();

    return this.localStreamPromise;
  }

  async getScreenStream(): Promise<MediaStream | null> {
    try {
      if (Platform.OS === 'web') {
        this.screenStream = await (media_Devices as any).getDisplayMedia({
          video: true,
          audio: true,
        });
      } else {
        this.screenStream = await media_Devices.getDisplayMedia({
          video: true
        });
      }
      return this.screenStream;
    } catch (error) {
      console.error('Error getting screen stream:', error);
      throw error;
    }
  }

  async joinCall(spaceId: string, callId: string, isInitiator: boolean = false, isViewer: boolean = false) {
    this.spaceId = spaceId;
    this.callId = callId;
    this.isInitiator = isInitiator;
    this.isViewer = isViewer;

    console.log(`📞 Joining call ${callId} (Space: ${spaceId}), isInitiator: ${isInitiator}, isViewer: ${isViewer}`);

    if (Platform.OS === 'web' && !isViewer) {
      try {
        await this.getLocalStream(true, true);
      } catch (error) {
        console.error('Failed to get local stream:', error);
      }
    }

    this.isTerminating = false; // Reset termination flag on join
    this.setupSignalingListeners();

    if (!isInitiator && !isViewer) {
      console.log('📞 Not initiator, waiting for WebRTC offers...');
    } else if (isViewer) {
      console.log('📞 Joined as AUDIENCE (Receiver Only)');
    }
  }

  private pendingCandidates: Map<string, any[]> = new Map();
  private pendingOffers: any[] = [];

  private setupSignalingListeners() {
    if (!this.spaceId || !this.pusherService.isReady()) {
      console.warn('📞 Cannot setup signaling listeners: Pusher not ready or no spaceId');
      if (this.signalingTimeout) clearTimeout(this.signalingTimeout);
      this.signalingTimeout = setTimeout(() => this.setupSignalingListeners(), 2000);
      return;
    }

    if (this.signalingTimeout) {
      clearTimeout(this.signalingTimeout);
      this.signalingTimeout = null;
    }

    if (this.isSubscribed) {
      console.log(`ℹ️ WebRTC signaling already subscribed for space: ${this.spaceId}`);
      return;
    }

    console.log(`🔌 Subscribing to WebRTC signaling for space: ${this.spaceId}`);

    CollaborationService.getInstance().subscribeToSpace(this.spaceId, 'webrtc-service', {
      onWebRTCSignal: async (data: any) => {
        const fromId = data.from_user_id;
        const type = data.type;

        console.log(`📞 WebRTC signal: ${type} from ${fromId} (target: ${data.target_user_id})`);

        if (fromId === this.userId) return;

        if (data.target_user_id && data.target_user_id !== 0 && data.target_user_id !== this.userId) {
          return;
        }

        switch (type) {
          case 'offer':
            await this.handleOffer(data);
            break;
          case 'answer':
            await this.handleAnswer(data);
            break;
          case 'ice-candidate':
            await this.handleIceCandidate(data);
            break;
          case 'call-active':
            const joinedId = parseInt(data.user_id?.toString() || fromId?.toString() || '0', 10);
            console.log(`👤 Participant joined call: ${joinedId}`);
            this.handleNewParticipant(joinedId);
            break;
          case 'hand-raised':
          case 'hand-lowered':
            this.handRaisedCallback?.(fromId.toString(), type === 'hand-raised');
            break;

          case 'promoted':
            if (this.isViewer) {
              this.promotedCallback?.();
            }
            break;

          case 'call-ended':
            if (this.onHandRaisedCallback) this.onHandRaisedCallback(fromId.toString(), false);
            break;
        }
      },

      onCallEnded: () => {
        console.log('📞 Call ended notification received');
        if (this.onCallEndedCallback) this.onCallEndedCallback();
      },
      onMuteStateChanged: (data: any) => {
        if (this.onMuteStateChangedCallback && data.user_id !== this.userId) {
          this.onMuteStateChangedCallback(data.user_id.toString(), data.is_muted);
        }
      },
      onvideoStateChanged: (data: any) => {
        if (this.onVideoStateChangedCallback && data.user_id !== this.userId) {
          this.onVideoStateChangedCallback(data.user_id.toString(), data.has_video);
        }
      },
      onParticipantLeft: (data: any) => {
        const leftUserId = parseInt(data.user_id?.toString() || '0', 10);
        console.log('👤 Participant left call:', leftUserId);
        this.handleParticipantLeft(leftUserId);
      }
    });

    this.isSubscribed = true;
    console.log('📞 WebRTC signaling listeners setup complete');
  }

  public handleNewParticipant(joinedUserId: number) {
    if (!joinedUserId || joinedUserId === this.userId) return;

    // Star Topology Adjustment:
    // Viewers NEVER initiate offers. They only wait for offers from Broadcasters.
    // Broadcasters initiate offers to everyone (both other Broadcasters and Viewers).
    if (!this.isViewer) {
       console.log(`📞 Broadcaster/Initiator signaling to ${joinedUserId}`);
       setTimeout(() => this.createOffer(joinedUserId), 1000);
    } else {
      console.log(`📞 Viewer waiting for possible offer from ${joinedUserId}`);
    }

    if (!this.knownParticipants.has(joinedUserId)) {
      this.knownParticipants.add(joinedUserId);
      if (this.onParticipantJoinedCallback) {
        this.onParticipantJoinedCallback(joinedUserId.toString());
      }
    }
  }

  public syncParticipants(participantIds: string[]) {
    participantIds.forEach(id => {
      const pid = parseInt(id, 10);
      if (pid && pid !== this.userId) {
        this.handleNewParticipant(pid);
      }
    });
  }

  async notifyCallActive() {
    if (!this.spaceId || this.isViewer) return; // Viewers do not announce themselves space-wide
    console.log('📞 Broadcasting call active signal (Broadcaster)...');
    await this.sendSignal(0, 'call-active', { user_id: this.userId });
  }

  async createOffer(targetUserId: number) {
    if (!this.spaceId || !this.callId) {
      console.warn('Cannot create offer: missing call metadata');
      return;
    }

    if (this.offerInProgress.has(targetUserId)) {
      console.warn(`⚠️ Offer already in-flight for ${targetUserId}, skipping concurrent duplicate`);
      return;
    }
    this.offerInProgress.add(targetUserId);

    try {
      if (!this.localStream) {
        console.log(`📞 localStream not ready for ${targetUserId}, acquiring now...`);
        const stream = await this.getLocalStream();
        if (!stream) {
          console.error(`❌ Failed to acquire stream for offer to ${targetUserId}`);
          return;
        }
      }

      console.log(`📞 Creating WebRTC offer for user ${targetUserId}`);
      const peerConnection = this.createPeerConnection(targetUserId.toString());

      const senders = peerConnection.getSenders();
      
      // Only add tracks if we have local media (Broadcasters)
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          const alreadyAdded = senders.some((s: any) => s.track === track);
          if (!alreadyAdded) {
            peerConnection.addTrack(track, this.localStream!);
          }
        });
      }

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(offer);
      
      // ✅ SDP THINNING: Ensure offer stays under 10KB for Pusher/Reverb
      const thinnedSDP = this.normalizeSDP(offer.sdp);
      await this.sendSignal(targetUserId, 'offer', { 
        offer: { type: offer.type, sdp: thinnedSDP } 
      });

    } catch (error) {
      console.error('Error creating offer:', error);
    } finally {
      this.offerInProgress.delete(targetUserId);
    }
  }

  private async handleOffer(data: any) {
    if (!this.spaceId || !this.callId) {
      console.warn('Cannot handle offer: missing call metadata — will retry');
      this.pendingOffers.push(data);
      return;
    }

    if (!this.localStream) {
      console.log('📞 localStream not ready for incoming offer, acquiring now...');
      const stream = await this.getLocalStream();
      if (!stream) {
        console.error('❌ Failed to acquire stream for incoming offer');
        return;
      }
    }

    const fromId = data.from_user_id.toString();
    try {
      console.log(`📞 Handling WebRTC offer from user ${fromId}`);
      const peerConnection = this.createPeerConnection(fromId);

      const senders = peerConnection.getSenders();
      
      // Viewers ANSWER with receiver-only (no tracks added)
      if (!this.isViewer && this.localStream) {
        this.localStream!.getTracks().forEach(track => {
          const alreadyAdded = senders.some((s: any) => s.track === track);
          if (!alreadyAdded) {
            peerConnection.addTrack(track, this.localStream!);
          }
        });
      }

      const normalizedSDP = this.normalizeSDP(data.offer.sdp);
      const offerDescription = new RTC_SessionDescription({
        type: data.offer.type,
        sdp: normalizedSDP
      });

      // ✅ PERFECT NEGOTIATION: Handle Signaling Glare (Collision)
      const remoteId = parseInt(fromId, 10);
      const isPolite = this.userId! < remoteId;
      const isGlare = peerConnection.signalingState !== 'stable' || this.offerInProgress.has(remoteId);

      if (isGlare) {
        if (!isPolite) {
          console.warn(`⚠️ Glare detected with user ${fromId}: I am impolite, IGNORING remote offer.`);
          return;
        }
        console.warn(`⚠️ Glare detected with user ${fromId}: I am polite, ROLLING BACK my local offer.`);
        try {
          await peerConnection.setLocalDescription({ type: 'rollback' } as any);
        } catch (rollbackError) {
          console.warn(`⚠️ Rollback failed for ${fromId}, attempting to apply offer anyway:`, rollbackError);
        }
      }

      await peerConnection.setRemoteDescription(offerDescription);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // ✅ SDP THINNING: Ensure answer stays under 10KB
      const thinnedSDP = this.normalizeSDP(answer.sdp);
      await this.sendSignal(parseInt(fromId), 'answer', { 
        answer: { type: answer.type, sdp: thinnedSDP } 
      });
      this.processQueuedCandidates(fromId);

    } catch (error) {
      console.error(`Error handling offer from ${fromId}:`, error);
    }
  }

  private async handleAnswer(data: any) {
    const fromId = data.from_user_id.toString();
    try {
      console.log(`📞 Handling WebRTC answer from user ${fromId}`);
      const peerConnection = this.peerConnections.get(fromId);
      if (peerConnection) {
        const normalizedSDP = this.normalizeSDP(data.answer.sdp);
        const answerDescription = new RTC_SessionDescription({
          type: data.answer.type,
          sdp: normalizedSDP
        });

        if (peerConnection.signalingState === 'have-local-offer' || peerConnection.signalingState === 'have-remote-offer') {
          await peerConnection.setRemoteDescription(answerDescription);
        }
        this.processQueuedCandidates(fromId);
      }
    } catch (error) {
      console.error(`Error handling answer from ${fromId}:`, error);
    }
  }

  private async handleIceCandidate(data: any) {
    const fromId = data.from_user_id.toString();
    try {
      // ✅ Proactively create peer connection if it doesn't exist yet
      // This ensures we can queue candidates even if the offer arrives slightly later (common in mesh)
      const peerConnection = this.createPeerConnection(fromId);
      
      if (peerConnection.connectionState === 'closed') return;

      const candidate = new RTC_IceCandidate(data.candidate);
      if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
        try {
          await peerConnection.addIceCandidate(candidate);
        } catch (iceError: any) {
          console.warn(`⚠️ Stale ICE candidate ignored for peer ${fromId} (expected if session expired)`);
        }
      } else {
        if (!this.pendingCandidates.has(fromId)) this.pendingCandidates.set(fromId, []);
        this.pendingCandidates.get(fromId)!.push(candidate);
        console.log(`📞 Queued ICE candidate from ${fromId} (awaiting remote description)`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not process ICE candidate from ${fromId}:`, error);
    }
  }

  private processQueuedCandidates(peerId: string) {
    const candidates = this.pendingCandidates.get(peerId);
    if (candidates && this.peerConnections.has(peerId)) {
      const pc = this.peerConnections.get(peerId)!;
      candidates.forEach(async (candidate) => {
        try { await pc.addIceCandidate(candidate); } catch (e) { }
      });
      this.pendingCandidates.delete(peerId);
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) return this.peerConnections.get(peerId)!;

    const pcConfig = {
      ...this.iceServers,
      sdpSemantics: 'unified-plan',
    };

    const peerConnection = new RTC_PeerConnection(pcConfig);
    this.peerConnections.set(peerId, peerConnection);

    peerConnection.onicecandidate = (event: any) => {
      if (event.candidate && this.spaceId && this.callId) {
        this.sendSignal(parseInt(peerId), 'ice-candidate', { candidate: event.candidate });
      }
    };

    peerConnection.ontrack = (event: any) => {
      const stream = event.streams && event.streams[0];
      if (this.onRemoteStreamCallback && stream) this.onRemoteStreamCallback(peerId, stream);
    };

    (peerConnection as any).onaddstream = (event: any) => {
      const stream = event.stream;
      if (this.onRemoteStreamCallback && stream) this.onRemoteStreamCallback(peerId, stream);
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') this.triggerHapticSuccess();
      if (peerConnection.connectionState === 'disconnected' ||
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'closed') {
        this.handleParticipantLeft(parseInt(peerId));
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log(`📞 ICE connection state with ${peerId}:`, state);

      if (this.isTerminating) return; // ✅ Safety: ignore connection drops while leaving

      if (state === 'failed' || state === 'disconnected') {
        console.warn(`⚠️ ICE ${state} for ${peerId}, triggering automatic reconnection...`);
        this.reconnectPeer(peerId);
      }
    };

    return peerConnection;
  }

  private async sendSignal(targetUserId: number, type: string, data: any) {
    if (!this.spaceId || this.spaceId === 'null' || !this.callId || this.callId === 'null') return;
    try {
      const payload = { type, target_user_id: targetUserId || 0, call_id: this.callId, ...data };
      await CollaborationService.getInstance().sendWebRTCSignal(this.spaceId, payload);
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
    if (this.onParticipantLeftCallback) this.onParticipantLeftCallback(peerId);
  }

  async toggleMute(isMuted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
    }
    if (this.spaceId && this.callId) {
      CollaborationService.getInstance().toggleCallMute(this.spaceId, this.callId, isMuted).catch(() => {});
    }
  }

  async toggleVideo(hasVideo: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => { track.enabled = hasVideo; });
    }
    if (this.spaceId && this.callId) {
      CollaborationService.getInstance().toggleCallVideo(this.spaceId, this.callId, hasVideo).catch(() => {});
    }
  }

  async startScreenShare(): Promise<void> {
    try {
      let screenStream: MediaStream | null = null;
      if (Platform.OS === 'web') {
        screenStream = await (media_Devices as any).getDisplayMedia({ video: true, audio: true });
      } else {
        screenStream = await media_Devices.getDisplayMedia({ video: true, audio: true });
      }
      if (!screenStream) throw new Error('Failed to get screen stream');
      this.screenStream = screenStream;
      const videoTrack = screenStream.getVideoTracks()[0];
      this.peerConnections.forEach((connection) => {
        const sender = (connection as any).getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack).catch(() => {});
      });
      if (this.spaceId && this.callId) {
        CollaborationService.getInstance().toggleCallScreenShare(this.spaceId, this.callId, true).catch(() => {});
      }
      videoTrack.onended = () => this.stopScreenShare();
    } catch (error) {
      if (Platform.OS === 'android') {
        const { Alert } = require('react-native');
        Alert.alert('Screen Share', 'Grant screen recording permission to share.', [{ text: 'OK' }]);
      }
      throw error;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        this.peerConnections.forEach((connection) => {
          const sender = (connection as any).getSenders().find((s: any) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack).catch(() => {});
        });
      }
    }
    if (this.spaceId && this.callId) {
      CollaborationService.getInstance().toggleCallScreenShare(this.spaceId, this.callId, false).catch(() => {});
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
  }
  
  async reconnectAll() {
    console.log('🔄 Manually triggering reconnection for all peers...');
    const peerIds = Array.from(this.peerConnections.keys());
    for (const peerId of peerIds) {
      const pid = parseInt(peerId, 10);
      if (pid === this.userId) continue; // ✅ Safety: never reconnect with self
      await this.reconnectPeer(peerId);
    }
  }

  async reconnectPeer(peerId: string) {
    if (this.isTerminating) return; // ✅ Safety: never reconnect while leaving
    const peerConnection = this.peerConnections.get(peerId);
    if (!peerConnection) return;

    console.log(`🔄 Attempting ICE restart for peer ${peerId}`);
    try {
      // ✅ We only initiate restart if we are the "Offerer" for this peer relation
      // or if the connection is already in a failed state.
      const remoteId = parseInt(peerId, 10);
      const isInitiator = this.userId! > remoteId;

      if (isInitiator) {
        const offer = await peerConnection.createOffer({ iceRestart: true });
        await peerConnection.setLocalDescription(offer);
        
        // ✅ SDP THINNING for ICE Restart
        const thinnedSDP = this.normalizeSDP(offer.sdp);
        await this.sendSignal(remoteId, 'offer', { 
          offer: { type: offer.type, sdp: thinnedSDP } 
        });
      } else {
        // Polite peers just wait for the restart offer, but we can log it
        console.log(`ℹ️ Peer ${peerId} is the initiator, waiting for their ICE restart offer...`);
      }
    } catch (error) {
      console.warn(`⚠️ Reconnection attempt failed for ${peerId}:`, error);
    }
  }

  async toggleHandRaise(isRaised: boolean) {
    if (this.spaceId && this.callId) {
      await this.sendSignal(0, isRaised ? 'hand-raised' : 'hand-lowered', { user_id: this.userId });
    }
  }

  async promoteParticipant(userId: string) {
    if (this.spaceId && this.callId) {
      await this.sendSignal(parseInt(userId), 'promoted', { targetUserId: userId });
    }
  }

  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    const replacePromises: Promise<void>[] = [];
    this.peerConnections.forEach((connection) => {
      const sender = (connection as any).getSenders?.().find((s: any) => s.track?.kind === 'video');
      if (sender) replacePromises.push(sender.replaceTrack(newTrack).catch(() => {}));
    });
    await Promise.all(replacePromises);
  }

  async cleanup() { await this.leaveCall(); }

  /**
   * Leave the call silently (for spectators)
   */
  async leaveCall() {
    this.isTerminating = true;
    console.log('📞 [WebRTC] Leaving call and releasing hardware...');
    await this.performLocalCleanup();
  }

  /**
   * End the call for everyone (for owners/initiators)
   */
  async endCall() {
    this.isTerminating = true; 
    console.log('📞 [WebRTC] Aggressive cleanup: Ending call for all...');
    
    // 1. Notify backend to terminate the session (only if initiator/allowed)
    if (this.spaceId && this.callId && !this.isViewer) {
      CollaborationService.getInstance().endCall(this.spaceId, this.callId).catch(() => {});
    }

    await this.performLocalCleanup();
  }

  private async performLocalCleanup() {
    // 2. Immediate track disposal (Aggressive hardware release)
    if (this.localStream) {
      console.log('📞 Stopping local media tracks...');
      this.localStream.getTracks().forEach(track => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {
          console.warn('Error stopping local track:', e);
        }
      });
      this.localStream = null;
    }

    if (this.screenStream) {
      console.log('📞 Stopping screen share tracks...');
      this.screenStream.getTracks().forEach(track => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {
          console.warn('Error stopping screen track:', e);
        }
      });
      this.screenStream = null;
    }

    // 3. Sever all P2P connections
    this.peerConnections.forEach((connection, peerId) => {
      try {
        console.log(`📞 Closing connection to peer ${peerId}`);
        connection.close();
      } catch (e) {
        console.warn(`Error closing peer ${peerId}:`, e);
      }
    });
    this.peerConnections.clear();

    // 4. Reset signaling state
    this.localStreamPromise = null;
    this.offerInProgress.clear();
    this.pendingCandidates.clear();
    this.pendingOffers = [];

    if (this.spaceId) {
      console.log('🔌 Unsubscribing from WebRTC signaling...');
      CollaborationService.getInstance().unsubscribeFromSpace(this.spaceId, 'webrtc-service');
      this.isSubscribed = false;
    }

    this.spaceId = null;
    this.callId = null;
    this.knownParticipants.clear();
    console.log('✅ WebRTC cleanup complete');
  }

  private normalizeSDP(sdp: string): string {
    if (!sdp) return '';
    
    // 1. Basic cleaning
    const lines = sdp.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // 2. Aggressive thinning to stay under 10KB budget
    // Stripping extension maps (extmap) saves significant space (~2KB-4KB)
    // and they are often redundant for standard audio/video.
    const thinnedLines = lines.filter(line => {
      if (line.startsWith('a=extmap:')) return false;
      if (line.startsWith('a=rtcp-fb:')) {
         // Keep only essential feedback mechanisms
         if (line.includes('nack') || line.includes('goog-remb') || line.includes('transport-cc')) return true;
         return false; 
      }
      return true;
    });

    return thinnedLines.join('\r\n') + '\r\n';
  }

  private async triggerHapticSuccess() {
    if (Platform.OS !== 'web') {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
    }
  }

  onRemoteStream(callback: (userId: string, stream: MediaStream) => void) { this.onRemoteStreamCallback = callback; }
  onCallEnded(callback: () => void) { this.onCallEndedCallback = callback; }
  onParticipantJoined(callback: (userId: string) => void) { this.onParticipantJoinedCallback = callback; }
  onParticipantLeft(callback: (userId: string) => void) { this.onParticipantLeftCallback = callback; }
  onScreenShareStarted(callback: (userId: string) => void) { this.onScreenShareStartedCallback = callback; }
  onScreenShareEnded(callback: (userId: string) => void) { this.onScreenShareEndedCallback = callback; }
  onMuteStateChanged(callback: (userId: string, isMuted: boolean) => void) { this.onMuteStateChangedCallback = callback; }
  onVideoStateChanged(callback: (userId: string, hasVideo: boolean) => void) { this.onVideoStateChangedCallback = callback; }
  onHandRaised(callback: (userId: string, isRaised: boolean) => void) {
    this.handRaisedCallback = callback;
  }

  onPromoted(callback: () => void) {
    this.promotedCallback = callback;
  }
}

export default WebRTCService;