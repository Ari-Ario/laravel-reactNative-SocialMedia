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

  // Callbacks
  private onRemoteStreamCallback: ((userId: string, stream: MediaStream) => void) | null = null;
  private onCallEndedCallback: (() => void) | null = null;
  private onParticipantJoinedCallback: ((userId: string) => void) | null = null;
  private onParticipantLeftCallback: ((userId: string) => void) | null = null;
  private onScreenShareStartedCallback: ((userId: string) => void) | null = null;
  private onScreenShareEndedCallback: ((userId: string) => void) | null = null;
  private onMuteStateChangedCallback: ((userId: string, isMuted: boolean) => void) | null = null;
  private onVideoStateChangedCallback: ((userId: string, hasVideo: boolean) => void) | null = null;
  private onHandRaisedCallback: ((userId: string, isRaised: boolean) => void) | null = null;

  private knownParticipants = new Set<number>();
  // Tracks peers for whom an offer has been *scheduled* (setTimeout fired but not yet created a PC).
  // Prevents the duplicate call-active race where peerConnections.has() is still false
  // when the second signal arrives within the 1s scheduling window.
  private scheduledOfferPeers = new Set<number>();
  // Mutex: tracks peers for whom createOffer() is *currently executing* (async in-flight).
  // Prevents the concurrent async race where both calls see signalingState='stable'
  // before either has called setLocalDescription.
  private offerInProgress = new Set<number>();


  private iceServers = {
    iceServers: [
      // Google STUN servers — fast but only work on direct-connectable networks
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Metered.ca free TURN — authenticated, more reliable than openrelay for carrier NAT
      // These credentials are from the free tier and work for mobile data (5G/4G CGNAT)
      {
        urls: 'turn:relay.metered.ca:80',
        username: 'e29e254c0f8dd6a79e02e27f',
        credential: 'yv2vWAMF9ctoJoLv',
      },
      {
        urls: 'turn:relay.metered.ca:80?transport=tcp',
        username: 'e29e254c0f8dd6a79e02e27f',
        credential: 'yv2vWAMF9ctoJoLv',
      },
      {
        urls: 'turn:relay.metered.ca:443',
        username: 'e29e254c0f8dd6a79e02e27f',
        credential: 'yv2vWAMF9ctoJoLv',
      },
      {
        urls: 'turns:relay.metered.ca:443?transport=tcp',
        username: 'e29e254c0f8dd6a79e02e27f',
        credential: 'yv2vWAMF9ctoJoLv',
      },
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
    console.log('📞 WebRTCService initialized for user:', userId, 'Platform:', Platform.OS);
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
            audio: audioEnabled,
          });
        } catch (videoError) {
          console.warn('⚠️ Web video acquisition failed, falling back to audio only:', videoError);
          this.localStream = await media_Devices.getUserMedia({
            video: false,
            audio: audioEnabled,
          });
        }
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

  async joinCall(spaceId: string, callId: string, isInitiator: boolean = false) {
    this.spaceId = spaceId;
    this.callId = callId;
    this.isInitiator = isInitiator;

    console.log(`📞 Joining call ${callId} in space ${spaceId}, isInitiator: ${isInitiator}, platform: ${Platform.OS}`);

    if (Platform.OS === 'web') {
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
        const fromId = data.from_user_id;
        const type = data.type;

        console.log(`📞 WebRTC signal: ${type} from ${fromId} (target: ${data.target_user_id})`);

        if (fromId === this.userId) return;

        // Check if signal is for us (or broadcast target 0)
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
            if (this.onHandRaisedCallback) this.onHandRaisedCallback(fromId.toString(), true);
            break;
          case 'hand-lowered':
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

    // Guard 1: If we already HAVE a peer connection, this is a late duplicate signal.
    if (this.peerConnections.has(joinedUserId.toString())) {
      if (!this.knownParticipants.has(joinedUserId)) {
        this.knownParticipants.add(joinedUserId);
        if (this.onParticipantJoinedCallback) {
          this.onParticipantJoinedCallback(joinedUserId.toString());
        }
      }
      return;
    }

    // Guard 2: If we already SCHEDULED an offer (but PC not created yet within the 1s window),
    // skip silently. This prevents the async race where both duplicate call-active signals
    // both see peerConnections.has() = false and both schedule a createOffer setTimeout.
    if (this.scheduledOfferPeers.has(joinedUserId)) {
      console.log(`ℹ️ Duplicate call-active from ${joinedUserId} within 1s window — offer already scheduled`);
      if (!this.knownParticipants.has(joinedUserId)) {
        this.knownParticipants.add(joinedUserId);
        if (this.onParticipantJoinedCallback) {
          this.onParticipantJoinedCallback(joinedUserId.toString());
        }
      }
      return;
    }

    if (this.userId! > joinedUserId) {
      console.log(`📞 P2P Mesh: High ID (${this.userId}) offering to Low ID (${joinedUserId})`);
      // Mark scheduled BEFORE the setTimeout so any duplicate arriving in the next 1s is blocked
      this.scheduledOfferPeers.add(joinedUserId);
      setTimeout(() => {
        this.scheduledOfferPeers.delete(joinedUserId); // Release schedule-lock; PC now exists
        this.createOffer(joinedUserId);
      }, 1000);
    } else {
      console.log(`📞 P2P Mesh: Low ID (${this.userId}) waiting for offer from High ID (${joinedUserId})`);
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
    if (!this.spaceId) return;
    console.log('📞 Broadcasting call active signal...');
    await this.sendSignal(0, 'call-active', { user_id: this.userId });
  }

  async createOffer(targetUserId: number) {
    if (!this.spaceId || !this.localStream || !this.callId) {
      console.warn('Cannot create offer: missing stream or call metadata');
      return;
    }

    // ✅ MUTEX: prevents two concurrent createOffer() calls for the same peer
    // from both seeing signalingState='stable' before either calls setLocalDescription.
    // This is a JS async race: both awaits can overlap if called within ~10ms of each other.
    if (this.offerInProgress.has(targetUserId)) {
      console.warn(`⚠️ Offer already in-flight for ${targetUserId}, skipping concurrent duplicate`);
      return;
    }
    this.offerInProgress.add(targetUserId);

    try {
      console.log(`📞 Creating WebRTC offer for user ${targetUserId}`);

      const peerConnection = this.createPeerConnection(targetUserId.toString());

      // Backup signalingState guard (catches restarts and other edge cases)
      if (peerConnection.signalingState !== 'stable') {
        console.warn(
          `⚠️ Skipping offer to ${targetUserId}: signalingState is "${peerConnection.signalingState}"`
        );
        return;
      }

      // Add all tracks from local stream
      const senders = peerConnection.getSenders();
      this.localStream.getTracks().forEach(track => {
        const alreadyAdded = senders.some((s: any) => s.track === track);
        if (!alreadyAdded) {
          peerConnection.addTrack(track, this.localStream!);
        } else {
          console.log(`ℹ️ Track ${track.kind} already added to peer ${targetUserId}`);
        }
      });

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(offer);
      await this.sendSignal(targetUserId, 'offer', { offer });

    } catch (error) {
      console.error('Error creating offer:', error);
    } finally {
      // Always release mutex so future offers (e.g. after ICE restart) can proceed
      this.offerInProgress.delete(targetUserId);
    }
  }

  private async handleOffer(data: any) {
    // ✅ If stream not ready yet, queue the offer and retry once stream is available
    if (!this.spaceId || !this.callId) {
      console.warn('Cannot handle offer: missing call metadata — will retry');
      this.pendingOffers.push(data);
      return;
    }
    if (!this.localStream) {
      console.warn('Cannot handle offer: localStream not ready yet — queuing offer');
      this.pendingOffers.push(data);
      // Attempt to acquire stream immediately so we can process queued offers
      this.getLocalStream(true, true).then(stream => {
        if (stream) {
          console.log('📞 Stream acquired — processing queued offers:', this.pendingOffers.length);
          const queued = [...this.pendingOffers];
          this.pendingOffers = [];
          queued.forEach(o => this.handleOffer(o));
        }
      }).catch(e => console.error('Failed to acquire stream for queued offer:', e));
      return;
    }

    const fromId = data.from_user_id.toString();
    try {
      console.log(`📞 Handling WebRTC offer from user ${fromId}`);

      const peerConnection = this.createPeerConnection(fromId);

      // Add local tracks to response
      const senders = peerConnection.getSenders();
      this.localStream.getTracks().forEach(track => {
        const alreadyAdded = senders.some((s: any) => s.track === track);
        if (!alreadyAdded) {
          peerConnection.addTrack(track, this.localStream!);
        } else {
          console.log(`ℹ️ Track ${track.kind} already added to peer ${fromId}`);
        }
      });

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

      await this.sendSignal(parseInt(fromId), 'answer', { answer });

      // Process any queued candidates that arrived before the offer
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
    const fromId = data.from_user_id.toString();
    try {
      const peerConnection = this.peerConnections.get(fromId);

      // Guard: ignore candidates for connections that no longer exist or are closed
      if (!peerConnection || peerConnection.connectionState === 'closed') {
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

  private processQueuedCandidates(peerId: string) {
    const candidates = this.pendingCandidates.get(peerId);
    if (candidates && this.peerConnections.has(peerId)) {
      const pc = this.peerConnections.get(peerId)!;
      console.log(`📞 Processing ${candidates.length} queued ICE candidates for ${peerId}`);
      candidates.forEach(async (candidate) => {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          console.error('Error adding queued candidate:', e);
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
        this.sendSignal(parseInt(peerId), 'ice-candidate', {
          candidate: event.candidate,
        });
      }
    };

    peerConnection.ontrack = (event: any) => {
      const stream = event.streams && event.streams[0];
      console.log(`📞 [ontrack] Received remote stream from ${peerId}. Tracks:`, stream?.getTracks().map((t: any) => `${t.kind}:${t.enabled}`));
      if (this.onRemoteStreamCallback && stream) {
        this.onRemoteStreamCallback(peerId, stream);
      }
    };

    // ✅ Add onaddstream for better legacy/native compatibility
    (peerConnection as any).onaddstream = (event: any) => {
      const stream = event.stream;
      console.log(`📞 [onaddstream] Received remote stream from ${peerId}. Tracks:`, stream?.getTracks().map((t: any) => `${t.kind}:${t.enabled}`));
      if (this.onRemoteStreamCallback && stream) {
        this.onRemoteStreamCallback(peerId, stream);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`📞 Connection state with ${peerId}:`, peerConnection.connectionState);

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
        if (iceCheckingTimeout) { clearTimeout(iceCheckingTimeout); iceCheckingTimeout = null; }
        console.log(`✅ ICE connected for ${peerId} - media should flow`);
      }

      if (state === 'checking') {
        // ✅ 30s timeout for mobile data — TURN relay candidates can take longer
        // than WiFi direct candidates. 15s was too short for 5G/4G TURN negotiation.
        iceCheckingTimeout = setTimeout(() => {
          console.warn(`⚠️ ICE checking timeout for ${peerId} — attempting forced restart`);
          peerConnection.createOffer({ iceRestart: true })
            .then((offer: any) => peerConnection.setLocalDescription(offer))
            .then(() => {
              const desc = peerConnection.localDescription;
              if (desc) this.sendSignal(parseInt(peerId), 'offer', { offer: desc });
            })
            .catch((e: any) => console.warn('ICE forced restart failed:', e));
        }, 30000); // 30s — safe for both WiFi and mobile data
      }

      if (state === 'failed' || state === 'disconnected') {
        if (iceCheckingTimeout) { clearTimeout(iceCheckingTimeout); iceCheckingTimeout = null; }
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
      const payload = {
        type,
        target_user_id: targetUserId || 0, // ✅ Use 0 for broadcast to satisfy backend 'required|integer' validation
        call_id: this.callId,
        ...data,
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
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      
      if (videoTrack) {
        this.peerConnections.forEach((connection) => {
          const sender = (connection as any).getSenders().find((s: any) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack).catch((e: any) => console.error('Error restoring track:', e));
          }
        });
      }
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

    await this.endCall();
  }

  async endCall() {
    // ✅ Proactively notify backend that this user is leaving
    if (this.spaceId && this.callId && this.spaceId !== 'null' && this.callId !== 'null') {
      try {
        await CollaborationService.getInstance().endCall(this.spaceId, this.callId);
      } catch (error) {
        console.error('Error notifying backend of call end:', error);
      }
    }

    this.peerConnections.forEach((connection) => {
      if (connection.close) {
        connection.close();
      }
    });
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    if (this.spaceId) {
      CollaborationService.getInstance().unsubscribeFromSpace(this.spaceId, 'webrtc-service');
      this.isSubscribed = false;
    }

    this.spaceId = null;
    this.callId = null;
    this.knownParticipants.clear();
  }

  private async retryWithFallbackServers(peerId: string) {
    console.log(`🔄 Retrying connection with fallback ICE servers for ${peerId}...`);

    const fallbackIceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Force TURN relay
        { 
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
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
                this.onRemoteStreamCallback(peerId, event.streams[0]);
            }
        };

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => newConnection.addTrack(track, this.localStream!));
        }

        const offer = await newConnection.createOffer();
        await newConnection.setLocalDescription(offer);
        await this.sendSignal(targetUserId, 'offer', { offer });
    }
  }

  private normalizeSDP(sdp: string): string {
    if (!sdp) return '';
    // Standardize to CRLF and remove redundant empty lines
    return sdp.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\r\n') + '\r\n';
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

  onHandRaised(callback: (userId: string, isRaised: boolean) => void) {
    this.onHandRaisedCallback = callback;
  }

}


export default WebRTCService;