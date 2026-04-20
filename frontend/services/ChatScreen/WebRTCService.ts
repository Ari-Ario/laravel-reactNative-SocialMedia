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
  private originalVideoTrack: MediaStreamTrack | null = null;
  private spaceId: string | null = null;
  private userId: number | null = null;
  private callId: string | null = null;
  private pusherService = PusherService;
  private isSubscribed = false;
  private isInitiator = false;
  private isViewer = false;
  private isTerminating = false;
  private signalingTimeout: any = null;

  // Callbacks
  private onRemoteStreamCallback: ((userId: string, stream: MediaStream) => void) | null = null;
  private onPromotedCallback: ((callId?: string) => void) | null = null;
  private onDemotedCallback: (() => void) | null = null;
  private onParticipantLeftCallback: ((userId: string) => void) | null = null;
  private onParticipantJoinedCallback: ((userId: string, isViewer: boolean) => void) | null = null;
  private onScreenShareStartedCallback: ((userId: string) => void) | null = null;
  private onScreenShareEndedCallback: ((userId: string) => void) | null = null;
  private onMuteStateChangedCallback: ((userId: string, isMuted: boolean) => void) | null = null;
  private onVideoStateChangedCallback: ((userId: string, hasVideo: boolean) => void) | null = null;
  private onCallEndedCallback: (() => void) | null = null;
  private onHandRaisedCallback: ((userId: string, isRaised: boolean) => void) | null = null;
  private onSpeakingUpdateCallback: ((userId: string, level: number) => void) | null = null;

  private audioContext: any = null;
  private audioAnalyzers: Map<string, any> = new Map();

  private knownParticipants = new Set<number>();
  private candidateQueue: Map<string, RTCIceCandidate[]> = new Map();
  private candidateTimers: Map<string, any> = new Map();
  private iceTimeouts: Map<string, any> = new Map();

  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // ✅ Private Coturn Server for 4G/5G - CRITICAL for carrier-grade NAT
      {
        urls: process.env.EXPO_PUBLIC_TURN_SERVER_URL || 'turn:159.89.101.120:3478',
        username: process.env.EXPO_PUBLIC_TURN_SERVER_USERNAME || 'ari_admin',
        credential: process.env.EXPO_PUBLIC_TURN_SERVER_PASSWORD || 'zmzir_secure_relay_2026'
      }
    ],
    iceCandidatePoolSize: 10,
    // ✅ 'all' allows both STUN and TURN simultaneously (correct setting)
    // Do NOT use 'relay' here — that forces TURN-only and will fail if TURN is unreachable
    iceTransportPolicy: 'all' as RTCIceTransportPolicy,
  };

  private constructor() { }

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  getSpaceId() { return this.spaceId; }
  getCallId() { return this.callId; }

  async initialize(userId: number) {
    this.userId = userId;
    this.isTerminating = false;
    // Reset signaling lock to allow joining different spaces in the same session
    this.isSubscribed = false;
    console.log('📞 WebRTCService initialized for user:', userId, 'Platform:', Platform.OS);
  }

  public async terminate() {
    this.isTerminating = true;
    console.log('📞 Terminating WebRTCService...');

    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`📞 Stopped local track: ${track.kind}`);
      });
      this.localStream = null;
    }

    // Close all peer connections
    this.peerConnections.forEach((pc, id) => {
      pc.close();
      console.log(`📞 Closed peer connection: ${id}`);
    });
    this.peerConnections.clear();
    this.knownParticipants.clear();
    this.pendingOffers = [];
    this.isSubscribed = false;

    // Stop audio monitoring
    this.audioAnalyzers.forEach((analyzer, id) => {
      if (analyzer.interval) clearInterval(analyzer.interval);
    });
    this.audioAnalyzers.clear();
    if (this.audioContext) {
      try { this.audioContext.close(); } catch (e) { }
      this.audioContext = null;
    }

    console.log('📞 WebRTCService terminated successfully');
  }

  async getLocalStream(videoEnabled: boolean = true, audioEnabled: boolean = true): Promise<MediaStream | null> {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = videoEnabled;
      });
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = audioEnabled;
      });
      return this.localStream;
    }

    try {
      console.log('📞 Acquiring MediaStream for Platform:', Platform.OS);

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
          this.localStream = await media_Devices.getUserMedia({
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
          this.localStream = await media_Devices.getUserMedia({
            video: false,
            audio: audioEnabled,
          });
        }
      } else {
        try {
          this.localStream = await media_Devices.getUserMedia({
            video: videoEnabled ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            } : false,
            audio: audioEnabled ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            } : false,
          });
        } catch (videoError) {
          console.warn('⚠️ Web video acquisition failed, falling back to audio only:', videoError);
          this.localStream = await media_Devices.getUserMedia({
            video: false,
            audio: audioEnabled ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            } : false,
          });
        }
      }

      // Start monitoring local audio
      if (this.localStream && this.localStream.getAudioTracks().length > 0) {
        this.startAudioMonitoring('local', this.localStream);
      }

      return this.localStream;
    } catch (error) {
      console.error('CRITICAL: Media acquisition failed entirely:', error);
      throw error;
    }
  }

  async getScreenStream(): Promise<MediaStream | null> {
    try {
      if (Platform.OS === 'web') {
        this.screenStream = await (media_Devices as any).getDisplayMedia({
          video: true,
          audio: true,
        });
      } else {
        // Native react-native-webrtc screen share
        // Note: For iOS, this often requires a Broadcast Extension
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
    this.isTerminating = false;

    console.log(`📞 Joining call ${callId} in space ${spaceId}, isInitiator: ${isInitiator}, isViewer: ${isViewer}, platform: ${Platform.OS}`);
    
    // ✅ NEW: Ensure audio context is ready (MUST be called from user gesture)
    if (Platform.OS === 'web') {
      await this.ensureAudioContext();
    }

    if (Platform.OS === 'web' && !isViewer) {
      try {
        await this.getLocalStream(true, true);
      } catch (error) {
        console.error('Failed to get local stream:', error);
      }
    }

    this.setupSignalingListeners();

    if (!isInitiator) {
      console.log('📞 Not initiator, waiting for WebRTC offers...');
    }
  }

  /**
   * ✅ NEW: Global fix for iOS/Safari audio routing.
   * Ensures AudioContext is active and ready before WebRTC streams arrive.
   */
  public async ensureAudioContext(): Promise<void> {
    if (Platform.OS !== 'web') return;

    try {
      if (!this.audioContext) {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
          console.log('📞 AudioContext initialized');
        }
      }

      if (this.audioContext && this.audioContext.state === 'suspended') {
        console.log('📞 Resuming suspended AudioContext...');
        await this.audioContext.resume();
        console.log('📞 AudioContext resumed successfully');
      }

      // 🍏 Safari-Specific Hack: Play a silent buffer to "unlock" audio routing
      // This forces the OS to open the audio session in 'PlayAndRecord' mode
      if (this.audioContext) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0; // Silent
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.start(0);
        oscillator.stop(0.001);
      }
    } catch (e) {
      console.warn('⚠️ Failed to ensure AudioContext:', e);
    }
  }

  /**
   * ✅ NEW: Allow setting audio output device (Android/Chrome only)
   */
  public async setAudioOutput(deviceId: string, videoElement: HTMLVideoElement | null): Promise<boolean> {
    if (Platform.OS !== 'web' || !videoElement) return false;
    
    try {
      if (typeof (videoElement as any).setSinkId !== 'undefined') {
        await (videoElement as any).setSinkId(deviceId);
        console.log(`📞 Audio output successfully set to ${deviceId}`);
        return true;
      } else {
        console.warn('⚠️ setSinkId is not supported on this browser (iOS Safari).');
        return false;
      }
    } catch (e) {
      console.error('📞 Failed to set audio output:', e);
      return false;
    }
  }

  private pendingCandidates: Map<string, any[]> = new Map();
  // ✅ Queue offers that arrive before localStream is ready (Android timing issue)
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
        if (this.isTerminating) return;
        const fromId = data.from_user_id;
        const type = data.type;

        console.log(`📞 WebRTC signal: ${type} from ${fromId} (target: ${data.target_user_id})`);

        // Use loose comparison to handle string/number mismatches from Pusher
        if (fromId == this.userId) return;

        // Check if signal is for us (or broadcast target 0)
        if (data.target_user_id && data.target_user_id != 0 && data.target_user_id != this.userId) {
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
            const joinedIsViewer = !!data.is_viewer;
            console.log(`👤 Participant joined call: ${joinedId} (Viewer: ${joinedIsViewer})`);
            this.handleNewParticipant(joinedId, joinedIsViewer);
            break;
          case 'hand-raised':
            if (this.onHandRaisedCallback) this.onHandRaisedCallback(fromId.toString(), true);
            break;
          case 'hand-lowered':
            if (this.onHandRaisedCallback) this.onHandRaisedCallback(fromId.toString(), false);
            break;
          case 'promoted':
            if (fromId === this.userId?.toString()) return;
            console.log(`📡 YOU HAVE BEEN PROMOTED BY HOST!`);
            this.isViewer = false;
            if (this.onPromotedCallback) {
              console.log('🎉 Promotion signal received from backend');
              this.onPromotedCallback(this.callId || undefined);
            }
            break;
          case 'demoted':
            if (fromId === this.userId?.toString()) return;
            console.log(`📡 YOU HAVE BEEN DEMOTED TO VIEWER!`);
            this.isViewer = true;
            if (this.onDemotedCallback) this.onDemotedCallback();
            break;
          case 'call-cancelled':
            console.log('📞 Call cancelled by initiator');
            if (this.onCallEndedCallback) this.onCallEndedCallback();
            break;
          case 'call-rejected':
            console.log('📞 Call rejected by target');
            if (this.onCallEndedCallback) this.onCallEndedCallback();
            break;
          case 'call-accepted':
            console.log('📞 Call accepted by target');
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
      onScreenShareStarted: (userId: string) => {
        if (this.onScreenShareStartedCallback && userId !== this.userId?.toString()) {
          this.onScreenShareStartedCallback(userId);
        }
      },
      onScreenShareEnded: (userId: string) => {
        if (this.onScreenShareEndedCallback && userId !== this.userId?.toString()) {
          this.onScreenShareEndedCallback(userId);
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

  public handleNewParticipant(joinedUserId: number, joinedUserIsViewer: boolean = false) {
    if (this.isTerminating || !joinedUserId || joinedUserId === this.userId) return;

    // ✅ Star Topology for Channels: Only Broadcasters offer to Viewers.
    // If I am a viewer, I NEVER initiate an offer.
    if (this.isViewer) {
      console.log(`📞 Audience member (${this.userId}) ignoring announcement from ${joinedUserId} (Waiting for host offer)`);
      return;
    }

    // Reliability: Handshake tie-breaker.
    // RULE 1: Broadcasters ALWAYS offer to Viewers.
    // RULE 2: If both are Broadcasters, Higher User ID offers to Lower User ID.
    const myIdNum = Number(this.userId);
    const targetIdNum = Number(joinedUserId);
    const shouldOffer = joinedUserIsViewer || (myIdNum > targetIdNum && !this.isViewer);

    if (shouldOffer) {
      console.log(`📞 Role-Aware Signaling: Offering to ${joinedUserId} (IsViewer: ${joinedUserIsViewer})`);
      setTimeout(() => this.createOffer(joinedUserId), 1000);
    } else {
      console.log(`📞 Role-Aware Signaling: Waiting for offer from ${joinedUserIsViewer ? 'Broadcaster' : 'High-ID Broadcaster'} ${joinedUserId}`);
    }

    // Cleanup existing connection if any (important for role transitions)
    const existingId = joinedUserId.toString();
    if (this.peerConnections.has(existingId)) {
      console.log(`🧹 Cleaning up existing peer connection for ${joinedUserId} before re-handshake`);
      try {
        const conn = this.peerConnections.get(existingId);
        if (conn && conn.close) conn.close();
      } catch (e) { }
      this.peerConnections.delete(existingId);
    }

    if (!this.knownParticipants.has(joinedUserId)) {
      this.knownParticipants.add(joinedUserId);
      if (this.onParticipantJoinedCallback) {
        this.onParticipantJoinedCallback(joinedUserId.toString(), joinedUserIsViewer);
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
    if (!this.spaceId) return;
    console.log(`📞 Broadcasting call active signal (As Viewer: ${this.isViewer})...`);
    await this.sendSignal(0, 'call-active', {
      user_id: this.userId,
      is_viewer: this.isViewer
    });
  }

  async createOffer(targetUserId: number) {
    if (this.isTerminating) return;
    if (!this.spaceId || !this.callId) {
      console.warn('Cannot create offer: missing call metadata');
      return;
    }

    try {
      console.log(`📞 Creating WebRTC offer for user ${targetUserId}`);

      const peerConnection = this.createPeerConnection(targetUserId.toString());

      // Add local tracks if available
      if (this.localStream) {
        const senders = peerConnection.getSenders();
        this.localStream.getTracks().forEach(track => {
          const alreadyAdded = senders.some((s: any) => s.track === track);
          if (!alreadyAdded) {
            peerConnection.addTrack(track, this.localStream!);
          } else {
            console.log(`ℹ️ Track ${track.kind} already added to peer ${targetUserId}`);
          }
        });
      }

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      // ✅ Glare handling: If we received an offer while creating ours, abort and let the incoming one win.
      if (peerConnection.signalingState !== 'stable') {
        console.warn(`⚠️ Glare detected for user ${targetUserId}: signaling state is ${peerConnection.signalingState}. Aborting local offer.`);
        return;
      }

      await peerConnection.setLocalDescription(offer);

      // ✅ Aggressive Thinning for outbound signal
      const thinnedSDP = this.normalizeSDP(offer.sdp!);
      await this.sendSignal(targetUserId, 'offer', {
        offer: {
          type: offer.type,
          sdp: thinnedSDP
        }
      });

    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  private async handleOffer(data: any) {
    if (this.isTerminating) return;
    // ✅ If stream not ready yet, queue the offer and retry once stream is available
    if (!this.spaceId || !this.callId) {
      console.warn('Cannot handle offer: missing call metadata — will retry');
      this.pendingOffers.push(data);
      return;
    }
    const fromId = data.from_user_id.toString();
    try {
      console.log(`📞 Handling WebRTC offer from user ${fromId}`);

      const peerConnection = this.createPeerConnection(fromId);

      // Add local tracks if available (Moderators only usually)
      if (this.localStream) {
        const senders = peerConnection.getSenders();
        this.localStream.getTracks().forEach(track => {
          const alreadyAdded = senders.some((s: any) => s.track === track);
          if (!alreadyAdded) {
            peerConnection.addTrack(track, this.localStream!);
          } else {
            console.log(`ℹ️ Track ${track.kind} already added to peer ${fromId}`);
          }
        });
      }

      // ✅ Normalize remote SDP to avoid parsing errors
      const normalizedSDP = this.normalizeSDP(data.offer.sdp);
      const offerDescription = new RTC_SessionDescription({
        type: data.offer.type,
        sdp: normalizedSDP
      });

      // ✅ Check signaling state before applying remote offer
      if (peerConnection.signalingState !== 'stable' && peerConnection.signalingState !== 'have-local-offer') {
        console.warn(`⚠️ Signaling state is ${peerConnection.signalingState}, cannot handle offer from ${fromId}.`);
        return;
      }

      await peerConnection.setRemoteDescription(offerDescription);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // ✅ Aggressive Thinning for outbound signal
      const thinnedSDP = this.normalizeSDP(answer.sdp!);
      await this.sendSignal(parseInt(fromId), 'answer', {
        answer: {
          type: answer.type,
          sdp: thinnedSDP
        }
      });

      // Process any queued candidates that arrived before the offer
      this.processQueuedCandidates(fromId);

    } catch (error) {
      console.error(`Error handling offer from ${fromId}:`, error);
    }
  }

  private async handleAnswer(data: any) {
    if (this.isTerminating) return;
    const fromId = data.from_user_id.toString();
    try {
      console.log(`📞 Handling WebRTC answer from user ${fromId}`);

      const peerConnection = this.peerConnections.get(fromId);
      if (peerConnection) {
        // ✅ Normalize remote SDP
        const normalizedSDP = this.normalizeSDP(data.answer.sdp);
        const answerDescription = new RTC_SessionDescription({
          type: data.answer.type,
          sdp: normalizedSDP
        });

        if (peerConnection.signalingState === 'have-local-offer' || peerConnection.signalingState === 'have-remote-offer') {
          await peerConnection.setRemoteDescription(answerDescription);
        } else {
          console.warn(`⚠️ Ignoring answer from ${fromId}: signalingState is ${peerConnection.signalingState}`);
        }

        // Process any queued candidates
        this.processQueuedCandidates(fromId);
      }
    } catch (error) {
      console.error(`Error handling answer from ${fromId}:`, error);
    }
  }

  private async handleIceCandidate(data: any) {
    if (this.isTerminating) return;
    const fromId = data.from_user_id.toString();
    try {
      const peerConnection = this.peerConnections.get(fromId);

      // Guard: ignore candidates for connections that no longer exist or are closed
      if (!peerConnection || peerConnection.connectionState === 'closed') {
        return;
      }

      // Guard: Ensure candidate data is valid for construction
      if (!data.candidate || (data.candidate.sdpMid === null && data.candidate.sdpMLineIndex === null)) {
        console.warn(`⚠️ Ignoring invalid ICE candidate from ${fromId}:`, data.candidate);
        return;
      }

      const candidate = new RTC_IceCandidate(data.candidate);

      if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
        try {
          await peerConnection.addIceCandidate(candidate);
        } catch (iceError: any) {
          // This is expected when a stale ICE candidate arrives after an ICE restart.
          // The new session's candidates will succeed — this one is from the old session.
          // Not dangerous: the call continues via other valid candidates.
          console.warn(
            `⚠️ Stale ICE candidate ignored for peer ${fromId} (likely from before an ICE restart — call unaffected)`
          );
        }
      } else {
        // Offer/Answer not yet processed, queue the candidate
        console.log(`📞 Queuing ICE candidate from ${fromId} (Remote description not ready)`);
        if (!this.pendingCandidates.has(fromId)) {
          this.pendingCandidates.set(fromId, []);
        }
        this.pendingCandidates.get(fromId)!.push(candidate);
      }
    } catch (error) {
      console.warn(`⚠️ Could not process ICE candidate from ${fromId}:`, error);
    }
  }

  private async onIceCandidate(targetUserId: number, candidate: any) {
    if (this.isTerminating) return;
    
    // Throttling ICE candidates to prevent backend signaling 500 errors (cURL timeouts)
    const peerId = targetUserId.toString();
    if (!this.candidateQueue.has(peerId)) this.candidateQueue.set(peerId, []);
    this.candidateQueue.get(peerId)!.push(candidate);

    if (!this.candidateTimers.has(peerId)) {
      this.candidateTimers.set(peerId, setTimeout(async () => {
        const queue = this.candidateQueue.get(peerId) || [];
        this.candidateQueue.set(peerId, []);
        this.candidateTimers.delete(peerId);

        if (queue.length > 0) {
          // Send each with a small delay to avoid overwhelming the sync queue
          for (const cand of queue) {
            await this.sendSignal(targetUserId, 'ice-candidate', { candidate: cand });
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms spacing
          }
        }
      }, 500));
    }
  }

  private processQueuedCandidates(peerId: string) {
    const candidates = this.pendingCandidates.get(peerId);
    if (candidates && this.peerConnections.has(peerId)) {
      const pc = this.peerConnections.get(peerId)!;
      console.log(`📞 Processing ${candidates.length} queued ICE candidates for ${peerId}`);
      candidates.forEach(async (candidate) => {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          // This is expected when a stale ICE candidate arrives after an ICE restart.
          console.warn(`⚠️ Queued ICE candidate for ${peerId} was stale or invalid - ignoring safely`);
        }
      });
      this.pendingCandidates.delete(peerId);
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    console.log(`📞 Creating new peer connection for ${peerId}`);

    const pcConfig = {
      ...this.iceServers,
      sdpSemantics: 'unified-plan',
    };

    const peerConnection = new RTC_PeerConnection(pcConfig);
    this.peerConnections.set(peerId, peerConnection);

    peerConnection.onicecandidate = (event: any) => {
      if (event.candidate && this.spaceId && this.callId) {
        this.onIceCandidate(parseInt(peerId), event.candidate);
      }
    };

    peerConnection.ontrack = (event: any) => {
      const stream = event.streams && event.streams[0];
      console.log(`📞 [ontrack] Received remote stream from ${peerId}. Tracks:`, stream?.getTracks().map((t: any) => `${t.kind}:${t.enabled}`));
      if (this.onRemoteStreamCallback && stream) {
        this.startAudioMonitoring(peerId, stream);
        this.onRemoteStreamCallback(peerId, stream);
      }
    };

    // ✅ Add onaddstream for better legacy/native compatibility
    (peerConnection as any).onaddstream = (event: any) => {
      const stream = event.stream;
      console.log(`📞 [onaddstream] Received remote stream from ${peerId}. Tracks:`, stream?.getTracks().map((t: any) => `${t.kind}:${t.enabled}`));
      if (this.onRemoteStreamCallback && stream) {
        this.startAudioMonitoring(peerId, stream);
        this.onRemoteStreamCallback(peerId, stream);
      }
    };

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

    // ✅ ICE connection state monitoring with timeout and detailed diagnostics
    let iceCheckingTimeout: ReturnType<typeof setTimeout> | null = null;

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log(`📞 ICE connection state with ${peerId}:`, state);

      if (state === 'connected' || state === 'completed') {
        // Clear timeout on success
        const timeout = this.iceTimeouts.get(peerId);
        if (timeout) { clearTimeout(timeout); this.iceTimeouts.delete(peerId); }
        console.log(`✅ ICE connected for ${peerId} - media should flow`);
      }

      if (state === 'checking') {
        // ✅ Set 15s timeout — if still checking, force ICE restart
        const timeout = setTimeout(() => {
          this.iceTimeouts.delete(peerId);
          if (peerConnection.signalingState === 'closed') return;
          
          console.warn(`⚠️ ICE checking timeout for ${peerId} — attempting forced restart`);
          peerConnection.createOffer({ iceRestart: true })
            .then((offer: any) => {
              if (peerConnection.signalingState === 'closed') return;
              return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
              const desc = peerConnection.localDescription;
              if (desc) this.sendSignal(parseInt(peerId), 'offer', { offer: desc });
            })
            .catch((e: any) => console.warn('ICE forced restart failed:', e));
        }, 15000);
        this.iceTimeouts.set(peerId, timeout);
      }

      if (state === 'failed' || state === 'disconnected') {
        const timeout = this.iceTimeouts.get(peerId);
        if (timeout) { clearTimeout(timeout); this.iceTimeouts.delete(peerId); }
        console.warn(`⚠️ ICE ${state} for ${peerId}, attempting restart...`);
        peerConnection.createOffer({ iceRestart: true })
          .then((offer: any) => peerConnection.setLocalDescription(offer))
          .then(() => {
            const description = peerConnection.localDescription;
            if (description) {
              this.sendSignal(parseInt(peerId), 'offer', { offer: description });
            }
          })
          .catch((e: any) => {
            console.warn(`⚠️ ICE restart for ${peerId} failed:`, e);
          });
      }
    };

    // ✅ ICE candidate error handler — log only once per peer to avoid console spam
    // Error 701 fires for every STUN/TURN server that times out; connection can still succeed via other candidates
    let iceErrorLogged = false;
    (peerConnection as any).onicecandidateerror = (error: any) => {
      if (error.errorCode !== 701) return; // Non-fatal, ignore
      if (iceErrorLogged) return;          // Already logged once for this peer
      iceErrorLogged = true;
      const isStun = error.url?.startsWith('stun:');
      const serverType = isStun ? 'STUN' : 'TURN';
      console.warn(
        `⚠️ ${serverType} server unreachable for peer ${peerId} (call may still connect via other candidates):`,
        error.errorText
      );
    };

    return peerConnection;
  }

  private async sendSignal(targetUserId: number, type: string, data: any) {
    if (!this.spaceId || this.spaceId === 'null' || !this.callId || this.callId === 'null') {
      console.error('Cannot send signal: missing or invalid spaceId/callId', { spaceId: this.spaceId, callId: this.callId });
      return;
    }

    try {
      // Standardize payload and prevent duplication
      const { target_user_id, call_id, type: _type, ...rest } = data;
      const isStandardWebRTC = ['offer', 'answer', 'ice-candidate', 'candidate', 'call-active', 'leave', 'call-rejected'].includes(type);
      
      const payload = {
        type,
        target_user_id: Number(targetUserId) || 0,
        call_id: this.callId,
        ...(isStandardWebRTC ? rest : { data: rest }) // Only flatten if standard WebRTC signal
      };

      console.log(`📞 Sending ${type} signal to user ${targetUserId}`);

      await CollaborationService.getInstance().sendWebRTCSignal(this.spaceId, payload);

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
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }

    if (this.spaceId && this.spaceId !== 'null' && this.callId && this.callId !== 'null') {
      try {
        await CollaborationService.getInstance().toggleCallMute(this.spaceId, this.callId, isMuted);
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    }
  }

  async toggleVideo(hasVideo: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = hasVideo;
      });
    }

    if (this.spaceId && this.spaceId !== 'null' && this.callId && this.callId !== 'null') {
      try {
        await CollaborationService.getInstance().toggleCallVideo(this.spaceId, this.callId, hasVideo);
      } catch (error) {
        console.error('Error toggling video:', error);
      }
    }
  }

  async startScreenShare(): Promise<void> {
    try {
      console.log('📞 Starting screen share on platform:', Platform.OS);

      let screenStream: MediaStream | null = null;

      if (Platform.OS === 'web') {
        screenStream = await (media_Devices as any).getDisplayMedia({
          video: true,
          audio: true,
        });
      } else {
        // Native: react-native-webrtc supports screen capture
        try {
          screenStream = await media_Devices.getDisplayMedia({
            video: true,
            audio: true,
          });
        } catch (nativeError) {
          console.warn('Native getDisplayMedia failed, trying alternative:', nativeError);
          // Fallback for Android - use getDisplayMedia with constraints
          screenStream = await media_Devices.getDisplayMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
            audio: true,
          });
        }
      }

      if (!screenStream) {
        throw new Error('Failed to get screen stream');
      }

      this.screenStream = screenStream;
      const videoTrack = screenStream.getVideoTracks()[0];

      if (!videoTrack) {
        throw new Error('No video track in screen stream');
      }

      // Update local preview
      if (this.localStream) {
        const localVideoTrack = this.localStream.getVideoTracks()[0];
        if (localVideoTrack) {
          this.originalVideoTrack = localVideoTrack;
          this.localStream.removeTrack(localVideoTrack);
          this.localStream.addTrack(videoTrack);
        }
      }

      // Replace video track for all peer connections
      this.peerConnections.forEach((connection) => {
        const sender = (connection as any).getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack).catch((e: any) => console.error('Error replacing track:', e));
        }
      });

      // Notify backend about screen share
      if (this.spaceId && this.spaceId !== 'null' && this.callId && this.callId !== 'null') {
        await CollaborationService.getInstance().toggleCallScreenShare(this.spaceId, this.callId, true);
      }

      // Handle track end event (user stops sharing via system UI)
      videoTrack.onended = () => {
        console.log('📞 Screen share track ended');
        this.stopScreenShare();
      };

      console.log('📞 Screen share started successfully');

    } catch (error) {
      console.error('Error starting screen share:', error);

      // Provide user-friendly error messages
      if (Platform.OS === 'android') {
        const { Alert } = require('react-native');
        Alert.alert(
          'Screen Share',
          'To share your screen on Android, you need to grant screen recording permission.\n\nTap "Start Now" when prompted.',
          [{ text: 'OK' }]
        );
      } else if (Platform.OS === 'ios') {
        const { Alert } = require('react-native');
        Alert.alert(
          'Screen Share',
          'Screen sharing on iOS requires a broadcast extension. This feature is coming soon.',
          [{ text: 'OK' }]
        );
      }

      throw error;
    }
  }

  async stopScreenShare(): Promise<void> {
    console.log('📞 Stopping screen share');

    // Restore original video track
    if (this.localStream && this.originalVideoTrack) {
      const currentTrack = this.localStream.getVideoTracks()[0];
      if (currentTrack) {
        this.localStream.removeTrack(currentTrack);
      }
      this.localStream.addTrack(this.originalVideoTrack);

      const restoredTrack = this.originalVideoTrack;
      this.peerConnections.forEach((connection) => {
        const sender = (connection as any).getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(restoredTrack).catch((e: any) => console.error('Error restoring track:', e));
        }
      });
      this.originalVideoTrack = null;
    }

    // Notify backend
    if (this.spaceId && this.spaceId !== 'null' && this.callId && this.callId !== 'null') {
      try {
        await CollaborationService.getInstance().toggleCallScreenShare(this.spaceId, this.callId, false);
      } catch (error) {
        console.error('Error stopping screen share:', error);
      }
    }

    // Stop and clean up screen stream
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => {
        track.stop();
      });
      this.screenStream = null;
    }

    console.log('📞 Screen share stopped');
  }

  async toggleHandRaise(isRaised: boolean) {
    if (this.spaceId && this.callId) {
      await this.sendSignal(0, isRaised ? 'hand-raised' : 'hand-lowered', { user_id: this.userId });
    }
  }

  /**
   * Replace the video track in all active peer connections.
   * Used by flipCamera on web to swap front/back camera without
   * rebuilding the MediaStream or affecting audio.
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    const replacePromises: Promise<void>[] = [];
    this.peerConnections.forEach((connection) => {
      const sender = (connection as any).getSenders?.().find((s: any) => s.track?.kind === 'video');
      if (sender) {
        replacePromises.push(
          sender.replaceTrack(newTrack).catch((e: any) =>
            console.warn('replaceVideoTrack error on peer:', e)
          )
        );
      }
    });
    await Promise.all(replacePromises);
    console.log('📞 Video track replaced across', replacePromises.length, 'peer connections');
  }


  async cleanup() {
    await this.leaveCall();
  }

  /**
   * Complete teardown of WebRTC session.
   * If initiator, notifies backend to end the call globally.
   * If viewer/participant, just cleans up locally.
   */
  async leaveCall(silent: boolean = false) {
    if (this.isTerminating) return;
    this.isTerminating = true;

    console.log('🧹 WebRTC: Leaving call and cleaning up...');

    // 1. Notify Backend (initiator only ends globally)
    if (!silent && this.spaceId && this.callId && this.spaceId !== 'null' && this.callId !== 'null') {
      try {
        if (this.isInitiator) {
          console.log('📞 Initiator ending call globally...');
          await CollaborationService.getInstance().endCall(this.spaceId, this.callId);
        } else {
          // Non-initiators just signal they are leaving to peers
          await this.sendSignal(0, 'leave', { user_id: this.userId });
        }
      } catch (error) {
        console.error('Error during backend call end/leave:', error);
      }
    }

    // 2. Clear All Timers (Signaling & ICE)
    if (this.signalingTimeout) {
      clearTimeout(this.signalingTimeout);
      this.signalingTimeout = null;
    }
    this.iceTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.iceTimeouts.clear();
    this.candidateTimers.forEach((timeout) => clearTimeout(timeout));
    this.candidateTimers.clear();
    this.candidateQueue.clear();

    // 3. Stop Local Tracks & Reset Stream (Important for role switches)
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) { }
      });
      this.localStream = null;
    }

    // 4. Close Peer Connections
    this.peerConnections.forEach((connection) => {
      try {
        if (connection.close) connection.close();
      } catch (e) { }
    });
    this.peerConnections.clear();

    // 4. Stop Local Tracks
    if (this.localStream) {
      (this.localStream as any).getTracks().forEach((track: any) => {
        try { track.stop(); } catch (e) { }
      });
      this.localStream = null;
    }

    if (this.screenStream) {
      (this.screenStream as any).getTracks().forEach((track: any) => {
        try { track.stop(); } catch (e) { }
      });
      this.screenStream = null;
    }

    // 5. Unsubscribe
    if (this.spaceId) {
      CollaborationService.getInstance().unsubscribeFromSpace(this.spaceId, 'webrtc-service');
      this.isSubscribed = false;
    }

    // 6. Reset State
    this.spaceId = null;
    this.callId = null;
    this.isViewer = false;
    this.isInitiator = false;
    this.knownParticipants.clear();

    console.log('✅ WebRTC: Cleanup complete.');
  }

  async endCall(silent: boolean = false) {
    // Alias for compatibility with existing UI components
    await this.leaveCall(silent);
  }

  private async retryWithFallbackServers(peerId: string) {
    console.log(`🔄 Retrying connection with fallback ICE servers for ${peerId}...`);

    const fallbackIceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // ✅ Private Coturn Server for 4G/5G (Forced Relay Mode)
        {
          urls: process.env.EXPO_PUBLIC_TURN_SERVER_URL || 'turn:159.89.101.120:3478',
          username: process.env.EXPO_PUBLIC_TURN_SERVER_USERNAME || 'ari_admin',
          credential: process.env.EXPO_PUBLIC_TURN_SERVER_PASSWORD || 'zmzir_secure_relay_2026'
        }
      ],
      iceTransportPolicy: 'relay' as RTCIceTransportPolicy // Force TURN relay
    };

    const oldConnection = this.peerConnections.get(peerId);
    if (oldConnection) {
      oldConnection.close();
      this.peerConnections.delete(peerId);
    }

    // Recreate offer logic for this peer
    const targetUserId = parseInt(peerId, 10);
    if (targetUserId) {
      // Create new connection with forced relay policy
      const newConnection = new RTC_PeerConnection(fallbackIceServers);
      this.peerConnections.set(peerId, newConnection);

      // standard setup
      newConnection.onicecandidate = (event: any) => {
        if (event.candidate && this.spaceId && this.callId) {
          this.sendSignal(targetUserId, 'ice-candidate', { candidate: event.candidate });
        }
      };

      newConnection.ontrack = (event: any) => {
        if (this.onRemoteStreamCallback && event.streams?.[0]) {
          this.startAudioMonitoring(peerId, event.streams[0]);
          this.onRemoteStreamCallback(peerId, event.streams[0]);
        }
      };

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => newConnection.addTrack(track, this.localStream!));
      }

      const offer = await newConnection.createOffer();
      await newConnection.setLocalDescription(offer);

      // ✅ Aggressive Thinning for outbound signal
      const thinnedSDP = this.normalizeSDP(offer.sdp!);
      await this.sendSignal(targetUserId, 'offer', {
        offer: {
          type: offer.type,
          sdp: thinnedSDP
        }
      });
    }
  }

  onPromoted(callback: (callId?: string) => void) {
    this.onPromotedCallback = callback;
  }

  async promoteParticipant(targetUserId: number) {
    if (!this.spaceId || !this.callId) return;
    console.log(`📡 Promoting audience member ${targetUserId} to speakers`);
    await this.sendSignal(targetUserId, 'promoted', {
      action: 'promote'
    });
  }

  async demoteParticipant(targetUserId: number) {
    if (!this.spaceId || !this.callId) return;
    console.log(`📡 Demoting speaker ${targetUserId} back to viewer`);
    await this.sendSignal(targetUserId, 'demoted', {
      action: 'demote'
    });
  }

  async rejectCall(targetUserId: number) {
    if (!this.spaceId || !this.callId) return;
    console.log(`📞 Rejecting call from ${targetUserId}`);
    await this.sendSignal(targetUserId, 'call-rejected', { user_id: this.userId });
  }

  private normalizeSDP(sdp: string): string {
    if (!sdp) return sdp;
    let lines = sdp.split('\r\n');

    // ✅ Aggressive Thinning: Remove extmap lines to save critical signaling space (~3KB-4KB)
    // This prevents Pusher 10KB payload limit errors on mobile networks.
    lines = lines.filter(line => !line.startsWith('a=extmap:'));

    // Remove non-essential attributes
    lines = lines.filter(line =>
      !line.startsWith('a=msid-semantic:') &&
      !line.startsWith('a=rid:') &&
      !line.startsWith('a=simulcast:')
    );
    return lines.join('\r\n') + '\r\n';
  }

  private async triggerHapticSuccess() {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.warn('Haptics not available:', error);
      }
    }
  }

  onRemoteStream(callback: (userId: string, stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  onCallEnded(callback: () => void) {
    this.onCallEndedCallback = callback;
  }

  onParticipantJoined(callback: (userId: string, isViewer: boolean) => void) {
    this.onParticipantJoinedCallback = callback;
  }

  onDemoted(callback: () => void) {
    this.onDemotedCallback = callback;
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

  onHandRaised(callback: (userId: string, isRaised: boolean) => void) {
    this.onHandRaisedCallback = callback;
  }

  onSpeakingUpdate(callback: (userId: string, level: number) => void) {
    this.onSpeakingUpdateCallback = callback;
  }

  private async startAudioMonitoring(userId: string, stream: MediaStream) {
    if (Platform.OS !== 'web') return; // Audio analysis currently web-only in this impl
    if (!stream || stream.getAudioTracks().length === 0) return; // No audio to monitor

    try {
      if (!this.audioContext) {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      }

      // Resume context if it was suspended (browser policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const interval = setInterval(() => {
        if (this.isTerminating) {
          clearInterval(interval);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalizedLevel = average / 128; // 0 to ~1 range

        if (this.onSpeakingUpdateCallback) {
          this.onSpeakingUpdateCallback(userId, normalizedLevel);
        }
      }, 100);

      this.audioAnalyzers.set(userId, { source, analyser, interval });
    } catch (e) {
      console.warn(`⚠️ Failed to start audio monitoring for ${userId}:`, e);
    }
  }

}


export default WebRTCService;