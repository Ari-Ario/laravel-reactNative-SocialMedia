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
  private originalCameraTrack: MediaStreamTrack | null = null;
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
  private isMobileNetwork: boolean = false;
  private connectionHealthTimers: Map<string, any> = new Map();
  private retryCount: Map<string, number> = new Map();

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
      { urls: 'stun:stun.l.google.com:19302' },
      // Private Dedicated Coturn Server (Unlimited Bandwidth via DigitalOcean)
      { urls: 'turn:159.89.101.120:3478', username: 'ari_admin', credential: 'zmzir_secure_relay_2026' },
      { urls: 'turn:159.89.101.120:3478?transport=tcp', username: 'ari_admin', credential: 'zmzir_secure_relay_2026' },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all' as RTCIceTransportPolicy,
  };

  private constructor() { }

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
      WebRTCService.instance.detectNetworkType();
    }
    return WebRTCService.instance;
  }

  async detectNetworkType(): Promise<void> {
    if (Platform.OS === 'web') {
      const nav = navigator as any;
      if (nav.connection) {
        const conn = nav.connection;
        this.isMobileNetwork = ['cellular', '4g', '3g', '2g'].includes(conn.effectiveType) || conn.saveData === true;

        if (typeof conn.addEventListener === 'function') {
          conn.addEventListener('change', () => {
            const oldType = this.isMobileNetwork;
            const newIsMobile = ['cellular', '4g', '3g', '2g'].includes(conn.effectiveType);

            if (oldType !== newIsMobile) {
              console.log(`🔄 Network handover detected: ${oldType ? 'Mobile' : 'WiFi'} → ${newIsMobile ? 'Mobile' : 'WiFi'}`);
              this.isMobileNetwork = newIsMobile;

              // Restart all peer connections to negotiate optimized paths for the new interface
              this.peerConnections.forEach((_, peerId) => {
                this.retryWithFallbackServers(peerId);
              });
            } else {
              this.applyBitrateToAllPeers();
            }
          });
        }
      } else if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        // Safari / iOS Fallback
        this.isMobileNetwork = true;
      }
    } else {
      // Native (iOS/Android) — assume potentially mobile if not on WiFi would be ideal
      // but react-native-netinfo would be needed. For now assume conservative.
      this.isMobileNetwork = true;
    }
    console.log(`📞 Mobile network detection completed: ${this.isMobileNetwork}`);
  }

  private applyBitrateToAllPeers() {
    this.peerConnections.forEach((pc, peerId) => {
      this.applyBitrateLimit(pc, peerId);
    });
  }

  async initialize(userId: number) {
    this.userId = userId;
    console.log('📞 WebRTCService initialized for user:', userId, 'Platform:', Platform.OS);
  }

  // ─── Adaptive Quality ────────────────────────────────────────────────────────
  // Mobile data (4G/5G) cannot sustain 1280×720 ≈ 1.5–3 Mbps reliably.
  // Default to 640×480 which encodes at ~300–600 kbps — negotiates faster,
  // drops fewer packets, and still looks good in a call tile.
  // The encoder is also capped post-ICE via applyBitrateLimit() so bursts
  // don't saturate the link even on WiFi.
  private static readonly VIDEO_CONSTRAINTS = {
    // Used for initial getUserMedia — low fr minimizes encoding load
    medium: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
    // Used on ICE restart retry — minimal to maximise reconnect success
    low: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 } },
  };

  // Max encoder bitrate applied via RTCRtpSender.setParameters() after ICE connects.
  // This is a soft ceiling — the encoder stays below this under normal conditions.
  private static readonly BITRATE_CAPS = {
    video: { web: 1200_000, native: 300_000 }, // bps — native/mobile down to 300k for 4G stability
    audio: { web: 64_000, native: 32_000 }, // bps — Opus is very efficient
  };

  async getLocalStream(
    videoEnabled: boolean = true,
    audioEnabled: boolean = true,
    qualityProfile: 'medium' | 'low' | 'auto' = 'auto'
  ): Promise<MediaStream | null> {
    // Determine profile if 'auto'
    const actualProfile = qualityProfile === 'auto'
      ? (this.isMobileNetwork ? 'low' : 'medium')
      : qualityProfile;

    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => { track.enabled = videoEnabled; });
      this.localStream.getAudioTracks().forEach(track => { track.enabled = audioEnabled; });
      return this.localStream;
    }

    const videoConstraints = WebRTCService.VIDEO_CONSTRAINTS[actualProfile as 'medium' | 'low'];

    try {
      console.log(`📞 Acquiring MediaStream — platform: ${Platform.OS}, quality: ${qualityProfile}`);

      if (Platform.OS !== 'web') {
        // Native (iOS / Android)
        const sourceInfos: any = await media_Devices.enumerateDevices();
        let videoSourceId: string | undefined;
        for (const info of sourceInfos) {
          if (info.kind === 'videoinput' && info.facing === 'front') {
            videoSourceId = info.deviceId;
            break;
          }
        }
        try {
          this.localStream = await media_Devices.getUserMedia({
            video: videoEnabled ? {
              ...videoConstraints,
              facingMode: 'user',
              ...(videoSourceId ? { optional: [{ sourceId: videoSourceId }] } : {}),
            } : false,
            audio: audioEnabled,
          });
        } catch {
          // Camera failed — audio-only fallback
          console.warn('⚠️ Camera unavailable, falling back to audio-only');
          this.localStream = await media_Devices.getUserMedia({ video: false, audio: audioEnabled });
        }
      } else {
        // Web browser
        try {
          this.localStream = await media_Devices.getUserMedia({
            video: videoEnabled ? { ...videoConstraints, facingMode: 'user' } : false,
            audio: audioEnabled,
          });
        } catch {
          console.warn('⚠️ Web camera unavailable, falling back to audio-only');
          this.localStream = await media_Devices.getUserMedia({ video: false, audio: audioEnabled });
        }
      }

      return this.localStream;
    } catch (error) {
      console.error('CRITICAL: Media acquisition failed entirely:', error);
      throw error;
    }
  }

  /**
   * Cap the encoder bitrate for all senders on a given peer connection.
   * Uses the standard W3C RTCRtpSender.setParameters() API — supported on
   * modern browsers and react-native-webrtc ≥ 106.
   * Called immediately after ICE reaches 'connected' so the stream never
   * bursts above the cap even before the encoder self-regulates.
   */
  private async applyBitrateLimit(peerConnection: any, peerId: string): Promise<void> {
    try {
      const isMobile = this.isMobileNetwork || (Platform.OS === 'web' && /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase()));
      const isDesktopWeb = Platform.OS === 'web' && !isMobile;

      const senders: any[] = peerConnection.getSenders ? peerConnection.getSenders() : [];
      for (const sender of senders) {
        if (!sender.track || !sender.getParameters) continue;
        const kind = sender.track.kind as 'video' | 'audio';

        // Mesh Scaling: Divide upload bandwidth by number of peers
        const activePeersCount = Math.max(1, this.peerConnections.size);
        const baselineCap = kind === 'video'
          ? (isDesktopWeb ? WebRTCService.BITRATE_CAPS.video.web : WebRTCService.BITRATE_CAPS.video.native)
          : (isDesktopWeb ? WebRTCService.BITRATE_CAPS.audio.web : WebRTCService.BITRATE_CAPS.audio.native);

        // Scale down directly to save weak Wi-Fi upload links
        const capBps = kind === 'video' ? Math.floor(baselineCap / activePeersCount) : baselineCap;

        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings.forEach((enc: any) => {
          enc.maxBitrate = capBps;
        });

        if (this.isMobileNetwork || isMobile) {
          if (kind === 'audio') {
            (params as any).degradationPreference = 'maintain-framerate';
          } else {
            (params as any).degradationPreference = 'maintain-resolution';
          }
        }

        await sender.setParameters(params);
        console.log(`📞 Bitrate cap applied for peer ${peerId} (type: ${kind}, cap: ${Math.floor(capBps / 1000)}kbps scaled by 1/${activePeersCount})`);
      }
    } catch (e) {
      // Non-fatal: if setParameters is unsupported (old react-native-webrtc), call continues
      console.warn(`⚠️ Could not apply bitrate caps for peer ${peerId}:`, e);
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
      },
      onScreenShareStarted: (userId: string) => {
        console.log(`📡 Signal: Screen share started by ${userId}`);
        if (this.onScreenShareStartedCallback) this.onScreenShareStartedCallback(userId);
      },
      onScreenShareEnded: (userId: string) => {
        console.log(`📡 Signal: Screen share ended by ${userId}`);
        if (this.onScreenShareEndedCallback) this.onScreenShareEndedCallback(userId);
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

      // IMPORTANT: Fire and forget the answer so we don't stall ICE candidate processing!
      this.sendSignal(parseInt(fromId), 'answer', { answer });

      // Process any queued candidates that arrived before the offer was fully resolved
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

    const pcConfig = {
      ...this.iceServers,
      iceTransportPolicy: this.isMobileNetwork ? 'relay' : 'all',
      sdpSemantics: 'unified-plan',
    };

    const peerConnection = new RTC_PeerConnection(pcConfig);
    this.peerConnections.set(peerId, peerConnection);

    // Removed 10s ICE watchdog to let native webRTC naturally recover on slow mobile data 

    peerConnection.onicecandidate = (event: any) => {
      if (event.candidate && this.spaceId && this.callId) {
        this.sendSignal(parseInt(peerId), 'ice-candidate', {
          candidate: event.candidate,
        });
      }
    };

    peerConnection.ontrack = (event: any) => {
      const stream = event.streams && event.streams[0];
      if (this.onRemoteStreamCallback && stream) {
        this.onRemoteStreamCallback(peerId, stream);
      }
    };

    // ✅ Add onaddstream for better legacy/native compatibility
    (peerConnection as any).onaddstream = (event: any) => {
      const stream = event.stream;
      if (this.onRemoteStreamCallback && stream) {
        this.onRemoteStreamCallback(peerId, stream);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`📞 Connection state with ${peerId}:`, peerConnection.connectionState);

      // Only clean up automatically on 'closed'.
      // DO NOT clean up on 'disconnected' or 'failed' here, because the
      // oniceconnectionstatechange handler handles ICE restarts for those states,
      // and will intelligently call handleParticipantLeft if all retries are exhausted.
      if (peerConnection.connectionState === 'closed') {
        this.handleParticipantLeft(parseInt(peerId));
      }
    };

    // ICE connection state monitoring with diagnostics
    let iceFailRetryCount = 0;
    const MAX_ICE_RETRIES = 2;

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log(`📞 ICE connection state with ${peerId}:`, state);

      if (state === 'connected' || state === 'completed') {
        iceFailRetryCount = 0;
        console.log(`✅ ICE connected for ${peerId} - media should flow`);
        // Apply bitrate caps immediately after ICE connects.
        this.applyBitrateLimit(peerConnection, peerId);
      }

      // Restart on 'failed' or 'disconnected' because mobile networks
      // often stay in 'disconnected' for a long time when dropping connections.
      if (state === 'failed' || state === 'disconnected') {
        if (iceFailRetryCount >= MAX_ICE_RETRIES) {
          console.warn(`⚠️ ICE permanently failed for ${peerId} after ${MAX_ICE_RETRIES} retries — giving up`);
          this.handleParticipantLeft(parseInt(peerId));
          return;
        }
        iceFailRetryCount++;
        const retryAttempt = iceFailRetryCount;
        console.warn(`⚠️ ICE ${state} for ${peerId} (attempt ${retryAttempt}/${MAX_ICE_RETRIES}) — restarting ICE...`);

        // Wrap in an immediately-invoked async arrow so we can use await.
        // The outer oniceconnectionstatechange handler must remain synchronous.
        (async () => {
          // We removed the destructive track stopping logic here because reacquiring MediaStream
          // in the background on mobile browsers often fails silently or triggers permission
          // prompts, resulting in permanent black screens. We rely on the existing stream and 
          // allow applyBitrateLimit() to cap bandwidth.

          peerConnection.createOffer({ iceRestart: true })
            .then((offer: any) => peerConnection.setLocalDescription(offer))
            .then(() => {
              const description = peerConnection.localDescription;
              if (description) this.sendSignal(parseInt(peerId), 'offer', { offer: description });
            })
            .catch((e: any) => console.warn(`⚠️ ICE restart for ${peerId} failed:`, e));
        })();
      }
    };

    let iceErrorLogged = false;
    (peerConnection as any).onicecandidateerror = (error: any) => {
      // Ignore insignificant local local-address-gathering errors
      if (error.errorCode === undefined || error.errorCode === null) return;
      if (iceErrorLogged && error.errorCode === 701) return; // Only log timeouts once
      if (error.errorCode === 701) {
        iceErrorLogged = true;
      }

      const isStun = error.url?.startsWith('stun:');
      const serverType = isStun ? 'STUN' : 'TURN';

      console.warn(
        `⚠️ ${serverType} server error ${error.errorCode} for peer ${peerId}:`,
        error.errorText || 'Unknown error. Check TURN credentials if using 4G/5G.'
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

    // Clear locks so this peer can re-join later
    this.knownParticipants.delete(userId);
    this.scheduledOfferPeers.delete(userId);
    this.offerInProgress.delete(userId);
    this.pendingCandidates.delete(peerId);

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
        const isMobileWeb = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          navigator.userAgent.toLowerCase()
        );
        if (isMobileWeb) {
          throw new Error('Screen sharing is not supported by mobile web browsers. Please use a desktop browser or our native app.');
        }

        screenStream = await (media_Devices as any).getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
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

      // Important: Swap the track in our local UI stream so the sharer sees what they are sharing!
      if (this.localStream) {
        const currentLocalTrack = this.localStream.getVideoTracks()[0];
        if (currentLocalTrack) {
          this.originalCameraTrack = currentLocalTrack;
          this.localStream.removeTrack(currentLocalTrack);
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

    } catch (error: any) {
      console.error('Error starting screen share:', error);

      // Provide user-friendly error messages
      if (Platform.OS === 'android') {
        const { Alert } = require('react-native');
        Alert.alert(
          'Screen Share Error',
          'To share your screen on Android, ensure you grant the required system recording permissions if prompted. Restart the call if the issue persists.',
          [{ text: 'OK' }]
        );
      } else if (Platform.OS === 'ios') {
        const { Alert } = require('react-native');
        Alert.alert(
          'Screen Share',
          'Screen sharing on iOS requires a broadcast extension. This feature is coming soon.',
          [{ text: 'OK' }]
        );
      } else if (Platform.OS === 'web') {
        alert(error.message || 'Screen sharing failed.');
      }

      throw error;
    }
  }

  async stopScreenShare(): Promise<void> {
    console.log('📞 Stopping screen share');

    // Stop and clean up screen stream first
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => {
        track.stop();
      });
      this.screenStream = null;
    }

    // Restore original video track to the UI and PeerConnections
    if (this.localStream && this.originalCameraTrack) {
      // Pop the screen share track from our UI component
      const currentVideoTrack = this.localStream.getVideoTracks()[0];
      if (currentVideoTrack) {
        this.localStream.removeTrack(currentVideoTrack);
      }

      // Push the camera back to our UI
      this.localStream.addTrack(this.originalCameraTrack);

      // Push the camera back to network streams
      this.peerConnections.forEach((connection) => {
        const sender = (connection as any).getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(this.originalCameraTrack).catch((e: any) => console.error('Error restoring track:', e));
        }
      });

      this.originalCameraTrack = null;
    }

    // Notify backend
    if (this.spaceId && this.spaceId !== 'null' && this.callId && this.callId !== 'null') {
      try {
        await CollaborationService.getInstance().toggleCallScreenShare(this.spaceId, this.callId, false);
      } catch (error) {
        console.error('Error stopping screen share:', error);
      }
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

    // Clear health timers
    this.connectionHealthTimers.forEach(timer => clearInterval(timer));
    this.connectionHealthTimers.clear();
    this.retryCount.clear();
  }

  private startConnectionHealthCheck(peerId: string, peerConnection: any) {
    // Removed to allow native browser engine to handle stalling via RTCP NACKs seamlessly instead of constantly destroying the connection.
  }

  private async retryWithFallbackServers(peerId: string) {
    const attempts = (this.retryCount.get(peerId) || 0) + 1;
    this.retryCount.set(peerId, attempts);

    if (attempts > 4) {
      console.error(`❌ Max retries (4) exceeded for ${peerId} — giving up`);
      this.handleParticipantLeft(parseInt(peerId));
      return;
    }

    // Exponential backoff: 1s, 2s, 4s...
    const backoff = Math.pow(2, attempts - 1) * 1000;
    console.log(`🔄 Retrying connection for ${peerId} (Attempt ${attempts}/4) in ${backoff}ms...`);

    await new Promise(resolve => setTimeout(resolve, backoff));

    // Use standard parallel ICE gathering instead of forcing single protocols
    let currentIceConfig = { ...this.iceServers };


    const oldConnection = this.peerConnections.get(peerId);
    if (oldConnection) {
      oldConnection.close();
      this.peerConnections.delete(peerId);
    }

    // Recreate 
    const targetUserId = parseInt(peerId, 10);
    if (targetUserId) {
      const newConnection = new RTC_PeerConnection(currentIceConfig);
      this.peerConnections.set(peerId, newConnection);

      newConnection.onicecandidate = (event: any) => {
        if (event.candidate && this.spaceId && this.callId) {
          this.sendSignal(targetUserId, 'ice-candidate', { candidate: event.candidate });
        }
      };

      newConnection.ontrack = (event: any) => {
        const stream = event.streams && event.streams[0];
        if (this.onRemoteStreamCallback && stream) {
          this.onRemoteStreamCallback(peerId, stream);
        }
      };

      // Native compatibility
      (newConnection as any).onaddstream = (event: any) => {
        if (this.onRemoteStreamCallback && event.stream) {
          this.onRemoteStreamCallback(peerId, event.stream);
        }
      };

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (newConnection && newConnection.addTrack) {
            newConnection.addTrack(track, this.localStream!);
          }
        });
      }

      try {
        // Native bridge check: ensures the PC still exists in native before calling
        if (!newConnection) return;

        const offer = await newConnection.createOffer();
        if (!offer) throw new Error('Failed to create offer');

        await newConnection.setLocalDescription(offer);
        this.sendSignal(targetUserId, 'offer', { offer });

        // Restart health tracking for new connection
        this.startConnectionHealthCheck(peerId, newConnection);
      } catch (e) {
        console.error(`❌ Fallback offer creation failed for ${peerId}:`, e);
        // If offer fails, wait and try one last time with simple STUN
        if (attempts < 4) {
          setTimeout(() => this.retryWithFallbackServers(peerId), 5000);
        }
      }
    }
  }

  public reconnectAll() {
    console.log('🔄 Manual reconnect requested for all peers...');
    this.peerConnections.forEach((_, peerId) => {
      this.retryWithFallbackServers(peerId);
    });
  }

  private async fallbackToAudioOnly(peerId: string): Promise<void> {
    console.log(`🎙️ Bandwidth CRITICAL: Falling back to audio-only for ${peerId}`);

    const pc = this.peerConnections.get(peerId);
    if (!pc) return;

    const videoSender = pc.getSenders?.().find((s: any) => s.track?.kind === 'video');
    if (videoSender) {
      // We "disable" video by removing the track but keeping the sender active 
      // to avoid renegotiation if possible, or we can just disable the local track.
      if (this.localStream) {
        const track = this.localStream.getVideoTracks()[0];
        if (track) track.enabled = false;
      }
    }

    if (this.onVideoStateChangedCallback) {
      this.onVideoStateChangedCallback(peerId, false);
    }

    // Alert the user via CollaborationService/UI if needed (handled in UI via callback)
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