// components/ImmersiveCallView.tsx
import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
  Animated,
  StatusBar,
  VirtualizedList,
  PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import ReAnimated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

import CollaborationService from '@/services/ChatScreen/CollaborationService';
import WebRTCService from '@/services/ChatScreen/WebRTCService';
import { useSpaceStore } from '@/stores/spaceStore';
import Avatar from '@/components/Image/Avatar';
import AuthContext from '@/context/AuthContext';
import { useCall } from '@/context/CallContext';
import { createShadow } from '@/utils/styles';

let RTCView: any;
if (Platform.OS !== 'web') {
  RTCView = require('react-native-webrtc').RTCView;
}

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isMobileWeb = isWeb && 
  typeof window !== 'undefined' && 
  window.innerWidth <= 768;

// Optimized grid calculation - reflects Teams (Web) and WhatsApp (Mobile) styles
const getGridConfig = (participantCount: number) => {
  if (isMobileWeb) {
    // Mobile-first layout (WhatsApp style)
    if (participantCount === 1) return { cols: 1, itemWidth: '100%', itemHeight: '100%' };
    if (participantCount === 2) return { cols: 1, itemWidth: '100%', itemHeight: '50%' };
    if (participantCount <= 4) return { cols: 2, itemWidth: '50%', itemHeight: '50%' };
    if (participantCount <= 6) return { cols: 2, itemWidth: '50%', itemHeight: '33.33%' };
    return { cols: 2, itemWidth: '50%', itemHeight: '25%' }; // Max 2 columns on mobile
  }

  if (isWeb) {
    // Teams-like Hub: Balanced rectangles
    if (participantCount === 1) return { cols: 1, itemWidth: '100%', itemHeight: '100%' };
    if (participantCount === 2) return { cols: 2, itemWidth: '50%', itemHeight: '100%' };
    if (participantCount <= 4) return { cols: 2, itemWidth: '50%', itemHeight: '50%' };
    if (participantCount <= 6) return { cols: 3, itemWidth: '33.33%', itemHeight: '50%' };
    if (participantCount <= 9) return { cols: 3, itemWidth: '33.33%', itemHeight: '33.33%' };
    return { cols: 4, itemWidth: '25%', itemHeight: '25%' };
  } else {
    // WhatsApp-like: Priority on portrait
    if (participantCount === 1) return { cols: 1, itemWidth: '100%', itemHeight: '100%' };
    if (participantCount === 2) return { cols: 1, itemWidth: '100%', itemHeight: '50%' };
    if (participantCount <= 4) return { cols: 2, itemWidth: '50%', itemHeight: '50%' };
    if (participantCount <= 6) return { cols: 2, itemWidth: '50%', itemHeight: '33.33%' };
    return { cols: 3, itemWidth: '33.33%', itemHeight: '25%' };
  }
};

interface Participant {
  id: string;
  user_id: number;
  name: string;
  avatar?: string;
  role: string;
  stream?: MediaStream;
  isMuted: boolean;
  hasVideo: boolean;
  isSharingScreen: boolean;
  isSpeaking?: boolean;
  volumeLevel?: number;
  joinedAt: number; // Timestamp for pruning
  handRaised?: boolean;
}


interface ImmersiveCallViewProps {
  spaceId: string;
  spaceType?: 'direct' | 'group' | 'protected' | 'channel';
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

// ─── Stable video elements for PiP (prevents re-render flicker) ─────────────
// These are defined OUTSIDE the component so their identity never changes.
// They hold their own refs, so srcObject is only set when the stream actually changes.
const PiPRemoteVideo = React.memo(({ stream, participantId, videoRefs }: {
  stream: MediaStream;
  participantId: string;
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
}) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
    if (ref.current) videoRefs.current.set(participantId, ref.current);
  }, [stream, participantId, videoRefs]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={false}
      style={{ width: '100%', height: '100%', objectFit: 'cover' } as any}
    />
  );
});

const PiPLocalVideo = React.memo(({ stream }: { stream: MediaStream }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
      ref.current.muted = true;
    }
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover' } as any}
    />
  );
});

// Memoized video component for performance
const VideoTile = React.memo(({
  participant,
  isLocal,
  isSpeaking,
  isMuted,
  hasVideo,
  stream,
  videoRefs,
  name,
  avatar,
  isHandRaised
}: any) => {



  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (isWeb && stream && videoElementRef.current) {
      videoElementRef.current.srcObject = stream;
      if (isLocal) videoElementRef.current.muted = true;
    }
  }, [stream, isLocal]);

  return (
    <View style={styles.videoTile}>
      {isWeb && stream && hasVideo ? (
        <video
          ref={(el) => {
            videoElementRef.current = el;
            if (el && stream) {
              el.srcObject = stream;
              if (isLocal) el.muted = true;
            }
            if (el && videoRefs) videoRefs.current.set(participant.id, el);
          }}
          autoPlay
          playsInline
          muted={isLocal}
          style={styles.videoElement}
        />
      ) : stream && !isWeb && RTCView && hasVideo ? (
        <RTCView
          key={stream.id || 'remote-stream'}
          streamURL={stream.toURL()}
          objectFit="cover"
          style={styles.videoElement}
          mirror={isLocal}
          zOrder={isLocal ? 1 : 0}
        />
      ) : (
        <View style={styles.avatarTile}>
          <Avatar source={avatar} size={60} name={name} />
          <Text style={styles.tileName} numberOfLines={1}>{name}</Text>
        </View>
      )}

      <View style={styles.tileOverlay}>
        <View style={styles.tileBadge}>
          <Text style={styles.tileBadgeText} numberOfLines={1}>{name}</Text>
          {isLocal && <Text style={styles.youBadge}>(You)</Text>}
        </View>
        <View style={styles.tileStatus}>
          {isHandRaised && (
            <View style={styles.handBadge}>
              <Ionicons name="hand-left" size={14} color="#FFCC00" />
            </View>
          )}
          {isMuted && <Ionicons name="mic-off" size={12} color="#FF6B6B" />}

          {!hasVideo && !isWeb && <Ionicons name="videocam-off" size={12} color="#fff" />}
          {isSpeaking && (
            <View style={styles.speakingDot}>
              <View style={styles.speakingPulse} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

const ImmersiveCallView: React.FC<ImmersiveCallViewProps> = ({ 
  spaceId, 
  spaceType = 'group',
  isMinimized = false,
  onToggleMinimize,
}) => {
  const insets = useSafeAreaInsets();
  const { endCall: globalEndCall } = useCall();
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialCallType = (params.type as string) || 'video';
  // ─── Callee joining: joining=1 means we're answering, not starting
  const isJoiningExisting = params.joining === '1';
  const existingCallId    = (params.call as string) || null;
  const collaborationService = CollaborationService.getInstance();
  const webRTCService = WebRTCService.getInstance();
  const { currentSpace } = useSpaceStore();
  const { user } = useContext(AuthContext);

  // State with useMemo for derived values
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(initialCallType === 'video');
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended' | 'waiting'>('waiting');
  const [showControls, setShowControls] = useState(true);
  const [selectedView, setSelectedView] = useState<'grid' | 'speaker'>('grid');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  // ── PiP State (Mobile Web only, 1-on-1 calls) ──
  const [isPipExpanded, setIsPipExpanded] = useState(false);

  // ── PiP Drag: use absolute top/left Animated values (avoids right/bottom conflict) ──
  // Initialized to bottom-right corner: will be set properly on first render
  const PIP_W_DEFAULT = 120;
  const PIP_H_DEFAULT = 160;
  const SCREEN_W = typeof window !== 'undefined' ? window.innerWidth : Dimensions.get('window').width;
  const SCREEN_H = typeof window !== 'undefined' ? window.innerHeight : Dimensions.get('window').height;
  const CONTROLS_H = 130; // height of bottom controls bar

  // Start at bottom-right corner
  const pipLeft = useRef(new Animated.Value(SCREEN_W - PIP_W_DEFAULT - 16)).current;
  const pipTop  = useRef(new Animated.Value(SCREEN_H - PIP_H_DEFAULT - CONTROLS_H - 16)).current;

  // Track last committed position for incremental dragging
  const pipLastPos = useRef({ x: SCREEN_W - PIP_W_DEFAULT - 16, y: SCREEN_H - PIP_H_DEFAULT - CONTROLS_H - 16 });

  const pipPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        // Anchor offset at current committed position
        pipLeft.setOffset(pipLastPos.current.x);
        pipTop.setOffset(pipLastPos.current.y);
        pipLeft.setValue(0);
        pipTop.setValue(0);
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pipLeft, dy: pipTop }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gs) => {
        pipLeft.flattenOffset();
        pipTop.flattenOffset();
        // Clamp within screen bounds
        const newX = Math.max(0, Math.min(pipLastPos.current.x + gs.dx, SCREEN_W - PIP_W_DEFAULT));
        const newY = Math.max(0, Math.min(pipLastPos.current.y + gs.dy, SCREEN_H - PIP_H_DEFAULT - CONTROLS_H));
        pipLastPos.current = { x: newX, y: newY };
        Animated.spring(pipLeft, { toValue: newX, useNativeDriver: false, friction: 7 }).start();
        Animated.spring(pipTop,  { toValue: newY, useNativeDriver: false, friction: 7 }).start();
      },
    })
  ).current;

  // Animations - optimized with useRef
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const spinValue = useSharedValue(0);
  const pulseValue = useSharedValue(1);

  // Refs for performance
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);

  // Memoized grid config
  const gridConfig = useMemo(() => {
    const totalParticipants = participants.length + 1; // +1 for local
    return getGridConfig(totalParticipants);
  }, [participants.length]);

  // Memoized participant list including local
  const allParticipants = useMemo(() => {
    const localParticipant: Participant = {
      id: 'local',
      user_id: parseInt(user?.id?.toString() || '0', 10),
      name: user?.name || 'You',
      avatar: user?.profile_photo,
      role: 'host',
      isMuted,
      hasVideo,
      isSharingScreen,
      stream: localStream || undefined,
      joinedAt: Date.now(),
    };
    return [localParticipant, ...participants];
  }, [participants, user, isMuted, hasVideo, isSharingScreen, localStream]);

  // Animations
  const spinAnimation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value}deg` }],
  }));

  const pulseAnimation = useAnimatedStyle(() => ({
    transform: [{ scale: pulseValue.value }],
  }));

  useEffect(() => {
    if (callStatus === 'connecting' || callStatus === 'waiting') {
      spinValue.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
        false
      );
      pulseValue.value = withRepeat(
        withTiming(1.2, { duration: 1000, easing: Easing.ease }),
        -1,
        true
      );
    } else {
      spinValue.value = 0;
      pulseValue.value = 1;
    }
  }, [callStatus]);

  // Auto-hide controls
  const handleUserInteraction = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, []);

  // Request permissions
  useEffect(() => {
    if (Platform.OS !== 'web') {
      requestPermissions();
    }
  }, []);

  const requestPermissions = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { Camera } = await import('expo-camera');
        await Camera.requestCameraPermissionsAsync();
        const { granted } = await requestRecordingPermissionsAsync();
        if (granted) {
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        }
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  // Initialize call
  const cleanup = useCallback(() => {
    if (durationInterval.current) clearInterval(durationInterval.current);
    webRTCService.cleanup();
    setLocalStream(null);
    setParticipants([]);
    setCallStatus('waiting');
    setCallId(null);
    if (activeSpeaker) setActiveSpeaker(null);
  }, [webRTCService, activeSpeaker]);

  const handleCallEnded = useCallback(() => {
    console.log('📞 Call ended (handleCallEnded)');
    Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
      setCallStatus('ended');
      cleanup();
      // ✔️ Clear global activeCall so RootCallOverlay unmounts
      globalEndCall();
      router.setParams({ tab: 'chat', type: undefined, call: undefined });
    });
  }, [cleanup, router, spaceId, fadeAnim, globalEndCall]);

  const setupCallbacks = useCallback(() => {
    webRTCService.onRemoteStream((userId: string, stream: MediaStream) => {
      console.log(`📡 UI: Received remote stream for user ${userId}`);
      setParticipants(prev => {
        const exists = prev.find(p => p.id === userId);
        if (exists) {
          return prev.map(p => p.id === userId ? { ...p, stream, hasVideo: true } : p);
        }

        // If participant doesn't exist yet, add them (proactive discovery)
        return [...prev, {
          id: userId,
          user_id: parseInt(userId, 10),
          name: 'Remote User',
          avatar: undefined,
          role: 'participant',
          isMuted: false,
          hasVideo: true,
          isSharingScreen: false,
          stream,
          joinedAt: Date.now()
        }];
      });
    });

    webRTCService.onParticipantLeft((userId: string) => {
      setParticipants(prev => prev.filter(p => p.id !== userId));
      if (isWeb) videoRefs.current.delete(userId);
    });

    webRTCService.onMuteStateChanged((userId: string, isMuted: boolean) => {
      setParticipants(prev => prev.map(p =>
        p.id === userId ? { ...p, isMuted } : p
      ));
    });

    webRTCService.onVideoStateChanged((userId: string, hasVideo: boolean) => {
      setParticipants(prev => prev.map(p =>
        p.id === userId ? { ...p, hasVideo } : p
      ));
    });

    webRTCService.onScreenShareStarted((userId: string) => {
      setParticipants(prev => prev.map(p =>
        p.id === userId ? { ...p, isSharingScreen: true } : p
      ));
    });

    webRTCService.onScreenShareEnded((userId: string) => {
      setParticipants(prev => prev.map(p =>
        p.id === userId ? { ...p, isSharingScreen: false } : p
      ));
    });

    webRTCService.onParticipantJoined((userId: string) => {
      console.log('👤 UI: Participant joined call:', userId);
      // check if already in list
      setParticipants(prev => {
        if (prev.find(p => p.id === userId)) return prev;

        // Find user info from space participations if possible
        const participation = currentSpace?.participations?.find((p: any) =>
          (p.user_id?.toString() === userId) || (p.user?.id?.toString() === userId)
        );

        return [...prev, {
          id: userId,
          user_id: parseInt(userId, 10),
          name: participation?.user?.name || 'Joining...',
          avatar: participation?.user?.profile_photo,
          role: participation?.role || 'participant',
          isMuted: false,
          hasVideo: false,
          isSharingScreen: false,
          joinedAt: Date.now()
        }];
      });
    });

    webRTCService.onCallEnded(() => {
      handleCallEnded();
    });

    webRTCService.onHandRaised((userId: string, isRaised: boolean) => {
      setParticipants(prev => prev.map(p =>
        p.id === userId ? { ...p, handRaised: isRaised } : p
      ));
    });
  }, [currentSpace, handleCallEnded]);


  const initializeCall = useCallback(async () => {
    if (isInitialized.current) return;
    try {
      isInitialized.current = true;
      setCallStatus('connecting');
      const currentUserId = parseInt(user?.id?.toString() || '0', 10);

      let callData: any;

      if (isJoiningExisting && existingCallId) {
        // ─── CALLEE PATH: join an existing call (do NOT call startCall again) ───
        console.log('📞 [ImmersiveCallView] Joining existing call:', existingCallId);
        const joinResponse = await collaborationService.joinWebRTCCall(spaceId);
        const activeUsers = joinResponse.call?.users || [];

        callData = { id: existingCallId, initiator_id: null };
        setCallId(existingCallId);
        setIsInitiator(false); // Callee is never the initiator

        const participantList = activeUsers
          .filter((u: any) => u.id !== currentUserId)
          .map((u: any) => ({
            id: u.id.toString(),
            user_id: u.id,
            name: u.name || 'Participant',
            avatar: u.profile_photo,
            role: 'participant',
            isMuted: false,
            hasVideo: false,
            isSharingScreen: false,
            joinedAt: Date.now()
          }));
        setParticipants(participantList);

        await webRTCService.initialize(currentUserId);
        await webRTCService.joinCall(spaceId, existingCallId, false);

        const stream = await webRTCService.getLocalStream(hasVideo, true);
        setLocalStream(stream);
        setCallStatus('connected');

        durationInterval.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);

        setupCallbacks();
        webRTCService.syncParticipants(activeUsers.map((u: any) => u.id.toString()));
        await webRTCService.notifyCallActive();

      } else {
        // ─── CALLER PATH: start a new call (original logic) ───
        const response = await collaborationService.startCall(spaceId, (initialCallType as any) || 'video');
        callData = response.call || response;
        if (!callData?.id) throw new Error('Failed to get call information');

        if (callData) {
          setCallId(callData.id);
          const initiatorId = callData.initiator_id || callData.initiator?.id;
          const currentIsInitiator = parseInt(initiatorId?.toString() || '0', 10) === currentUserId;

          console.log(`📞 Call Initiator ID: ${initiatorId}, Current User ID: ${currentUserId}, isInitiator: ${currentIsInitiator}`);
          setIsInitiator(currentIsInitiator);

          const joinResponse = await collaborationService.joinWebRTCCall(spaceId);
          const activeUsers = joinResponse.call?.users || [];

          const participantList = activeUsers
            .filter((u: any) => u.id !== currentUserId)
            .map((u: any) => ({
              id: u.id.toString(),
              user_id: u.id,
              name: u.name || 'Participant',
              avatar: u.profile_photo,
              role: 'participant',
              isMuted: false,
              hasVideo: false,
              isSharingScreen: false,
              joinedAt: Date.now()
          }));
          setParticipants(participantList);

          await webRTCService.initialize(currentUserId);
          await webRTCService.joinCall(spaceId, callData.id, currentIsInitiator);

          const stream = await webRTCService.getLocalStream(hasVideo, true);
          setLocalStream(stream);
          setCallStatus('connected');

          durationInterval.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);

          setupCallbacks();
          webRTCService.syncParticipants(activeUsers.map((u: any) => u.id.toString()));
          await webRTCService.notifyCallActive();
        }
      }
    } catch (error) {
      console.error('Error initializing call:', error);
      Alert.alert('Error', 'Failed to start call. Please try again.');
      router.back();
    }
  }, [spaceId, spaceType, initialCallType, isJoiningExisting, existingCallId, user, hasVideo, currentSpace, isInitiator, setupCallbacks, webRTCService, collaborationService, router]);

  // Only initialize once on mount or spaceId change
  useEffect(() => {
    if (spaceId) {
      initializeCall();
    }

    return () => {
      // Clear initialization flag only if call truly ended to allow discovery re-init if needed
      if (isInitialized.current && callStatus === 'ended') {
        isInitialized.current = false;
      }
    };
  }, [spaceId, callStatus, initializeCall]);

  // Lobby & Presence Subscription
  useEffect(() => {
    if (callStatus === 'waiting' || callStatus === 'connecting' || callStatus === 'connected') {
      console.log(`🔌 Subscribing to lobby presence for discovery: ${spaceId} (status: ${callStatus})`);
      
      collaborationService.subscribeToSpace(spaceId, 'immersive-call-lobby', {
        onCallStarted: (data: any) => {
          console.log('📡 Call started event received in lobby:', data);
          if (data.call?.id) {
            setCallId(data.call.id);
            initializeCall();
          }
        },
        onCallEnded: () => {
          console.log('📞 [Lobby] call.ended received — closing ImmersiveCallView');
          setCallStatus('ended');
          cleanup();
          // ✔️ Clear global activeCall so RootCallOverlay unmounts
          globalEndCall();
        },
        onParticipantUpdate: (data: any) => {
          if (data.participants) {
            const participantList = data.participants.map((p: any) => ({
              id: p.user_id?.toString() || p.id?.toString(),
              user_id: p.user_id || p.id,
              name: p.user?.name || p.name || `User ${p.id}`,
              avatar: p.user?.profile_photo || p.profile_photo,
              stream: null,
              isMuted: false,
              hasVideo: false,
              isSharingScreen: false,
              joinedAt: Date.now()
            }));
            
            // We'll filter in the render or a separate effect to keep this subscription stable
            setWaitingParticipants(participantList);
          }
        }
      });
    }

    return () => {
      console.log(`📡 Cleaning up lobby subscription for ${spaceId}`);
      collaborationService.unsubscribeFromSpace(spaceId, 'immersive-call-lobby');
    };
  }, [spaceId, initializeCall, cleanup]); // Removed unstable dependencies like participants/callStatus

  // ✅ Ghost Participant Pruning
  // Periodically check for participants who were pre-populated but never connected
  useEffect(() => {
    if (callStatus !== 'connected') return;

    const PRUNING_INTERVAL = 5000;
    const STALE_TIMEOUT = 30000; // Increased to 30s for stability

    const interval = setInterval(() => {
      const now = Date.now();
      setParticipants(prev => {
        const needsPruning = prev.some(p =>
          p.id !== 'local' &&
          !p.stream &&
          (now - p.joinedAt > STALE_TIMEOUT)
        );

        if (!needsPruning) return prev;

        console.log('🧹 Pruning stale "ghost" participants...');
        return prev.filter(p =>
          p.id === 'local' ||
          p.stream ||
          (now - p.joinedAt <= STALE_TIMEOUT)
        );
      });
    }, PRUNING_INTERVAL);

    return () => clearInterval(interval);
  }, [callStatus]);


  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const toggleMute = useCallback(async () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    await webRTCService.toggleMute(newMuteState);
    if (Platform.OS !== 'web') {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
    }
  }, [isMuted]);

  const toggleVideo = useCallback(async () => {
    const newVideoState = !hasVideo;
    setHasVideo(newVideoState);
    await webRTCService.toggleVideo(newVideoState);
    if (Platform.OS !== 'web') {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { }
    }
  }, [hasVideo]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isSharingScreen) {
        await webRTCService.startScreenShare();
        setIsSharingScreen(true);
        if (Platform.OS !== 'web') {
          try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
        }
      } else {
        await webRTCService.stopScreenShare();
        setIsSharingScreen(false);
      }
    } catch (error) {
      console.error('Screen share error:', error);
      // NOTE: Error alerts are handled internally by webRTCService for cross-platform consistency
    }
  }, [isSharingScreen, webRTCService]);

  const flipCamera = useCallback(async () => {
    if (isWeb) {
      // On web, re-acquire camera with toggled facing mode
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          const currentFacing = (videoTrack.getSettings() as any).facingMode || 'user';
          const newFacing = currentFacing === 'user' ? 'environment' : 'user';
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: newFacing },
              audio: false, // Audio only — do NOT touch the audio track
            });
            const newVideoTrack = newStream.getVideoTracks()[0];
            // Replace track in all peer connections via WebRTC service
            await webRTCService.replaceVideoTrack(newVideoTrack);
            // Swap the video track in the local stream UI (do NOT rebuild the stream object)
            localStream.removeTrack(videoTrack);
            localStream.addTrack(newVideoTrack);
            videoTrack.stop();
          } catch (e) {
            console.warn('Camera flip failed (device may not have front/back):', e);
          }
        }
      }
      return;
    }
    // Native: use _switchCamera from react-native-webrtc
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack && typeof (videoTrack as any)._switchCamera === 'function') {
        (videoTrack as any)._switchCamera();
        try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
      }
    }
  }, [localStream, webRTCService]);

  const endCall = useCallback(async () => {
    setCallStatus('ended');
    cleanup();
    if (callId && spaceType === 'direct') {
      await collaborationService.endCall(spaceId, callId);
    }
    // ✅ Signal to global context that the call has ended to unmount RootCallOverlay
    globalEndCall();
  }, [callId, spaceId, spaceType, cleanup, globalEndCall]);

  const toggleHandRaise = useCallback(async () => {
    const newState = !handRaised;
    setHandRaised(newState);
    await webRTCService.toggleHandRaise(newState);
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
    }
  }, [handRaised]);


  // Optimized renderer for participants
  const renderParticipantTile = useCallback((item: Participant, index: number) => {
    const isLocal = item.id === 'local';
    const isSpeaking = activeSpeaker === item.id;

    return (
      <View
        key={item.id}
        style={[
          styles.gridItem,
          {
            width: gridConfig.itemWidth as any,
            height: gridConfig.itemHeight as any,
            // Add spacing adjustment for flex-wrap
            margin: 0,
            borderWidth: 1,
            borderColor: '#000'
          }
        ]}
      >
        <VideoTile
        participant={item}
        isLocal={isLocal}
        isSpeaking={isSpeaking}
        isHandRaised={isLocal ? handRaised : item.handRaised}
        isMuted={item.isMuted}
        hasVideo={item.hasVideo}
        stream={item.stream}
        videoRefs={videoRefs}
        name={item.name}
        avatar={item.avatar}
      />
      </View>
    );
  }, [gridConfig, activeSpeaker, handRaised]);

  // ── WhatsApp-style PiP Layout ──────────────────────────────────────────────
  // Activated for: isMobileWeb (responsive browser) OR native mobile (!isWeb)
  // ONLY when exactly 1 remote participant exists (1-on-1 call).
  // Uses stable sub-components (PiPRemoteVideo, PiPLocalVideo) to prevent flicker.
  const renderPiPLayout = useCallback(() => {
    const remoteParticipant = participants[0];
    const localParticipant = allParticipants.find(p => p.id === 'local')!;
    if (!remoteParticipant || !localParticipant) return null;

    const PIP_W = isPipExpanded
      ? (typeof window !== 'undefined' ? window.innerWidth * 0.58 : 220)
      : 120;
    const PIP_H = isPipExpanded
      ? (typeof window !== 'undefined' ? window.innerHeight * 0.42 : 300)
      : 160;
    const PIP_BORDER = isPipExpanded ? 20 : 14;

    return (
      <View style={styles.pipContainer}>
        {/* ── REMOTE: fullscreen background ── */}
        <View style={StyleSheet.absoluteFill}>
          {isWeb && remoteParticipant.stream && remoteParticipant.hasVideo ? (
            <PiPRemoteVideo
              stream={remoteParticipant.stream}
              participantId={remoteParticipant.id}
              videoRefs={videoRefs}
            />
          ) : !isWeb && RTCView && remoteParticipant.stream && remoteParticipant.hasVideo ? (
            <RTCView
              key={(remoteParticipant.stream as any).id}
              streamURL={(remoteParticipant.stream as any).toURL()}
              objectFit="cover"
              style={{ flex: 1 }}
              zOrder={0}
            />
          ) : (
            <View style={styles.pipRemoteAvatar}>
              <Avatar source={remoteParticipant.avatar} size={90} name={remoteParticipant.name} />
              <Text style={styles.pipRemoteName}>{remoteParticipant.name}</Text>
            </View>
          )}
          {/* Bottom gradient for controls readability */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.65)']}
            style={styles.pipRemoteGradient}
            pointerEvents="none"
          />
          {/* Remote name tag + status badges */}
          <View style={styles.pipRemoteNameTag}>
            <Text style={styles.pipRemoteNameTagText}>{remoteParticipant.name}</Text>
            {remoteParticipant.isMuted && (
              <View style={styles.pipRemoteMuteTag}>
                <Ionicons name="mic-off" size={12} color="#fff" />
              </View>
            )}
          </View>
          {/* Hand raise indicator on remote's fullscreen video */}
          {remoteParticipant.handRaised && (
            <View style={styles.pipRemoteHandBadge}>
              <Ionicons name="hand-left" size={20} color="#FFCC00" />
              <Text style={styles.pipRemoteHandText}>Raised Hand</Text>
            </View>
          )}
          {/* Local hand raise indicator (so YOU know your hand is up) */}
          {handRaised && (
            <View style={styles.pipLocalHandBadge}>
              <Ionicons name="hand-left" size={14} color="#FFCC00" />
            </View>
          )}
        </View>

        {/* ── LOCAL: draggable PiP tile ── */}
        <Animated.View
          style={[
            styles.pipLocal,
            isPipExpanded
              ? {
                  // Centered when expanded
                  width: PIP_W,
                  height: PIP_H,
                  borderRadius: PIP_BORDER,
                  position: 'absolute',
                  left: (SCREEN_W - PIP_W) / 2,
                  top: (SCREEN_H - PIP_H) / 2,
                }
              : {
                  // Draggable position from top/left (no right/bottom conflict)
                  width: PIP_W,
                  height: PIP_H,
                  borderRadius: PIP_BORDER,
                  position: 'absolute',
                  left: pipLeft,
                  top: pipTop,
                },
          ]}
          {...(!isPipExpanded ? pipPanResponder.panHandlers : {})}
        >
          {/* Tap-to-expand — only on the video area itself, not the camera button */}
          <TouchableOpacity
            activeOpacity={0.95}
            style={{ flex: 1, borderRadius: PIP_BORDER, overflow: 'hidden' }}
            onPress={() => setIsPipExpanded(prev => !prev)}
          >
            {isWeb && localParticipant.stream && localParticipant.hasVideo ? (
              <PiPLocalVideo stream={localParticipant.stream} />
            ) : !isWeb && RTCView && localParticipant.stream && localParticipant.hasVideo ? (
              <RTCView
                key={(localParticipant.stream as any).id}
                streamURL={(localParticipant.stream as any).toURL()}
                objectFit="cover"
                style={{ flex: 1 }}
                mirror
                zOrder={1}
              />
            ) : (
              <View style={[styles.pipLocalAvatar, { borderRadius: PIP_BORDER }]}>
                <Avatar
                  source={localParticipant.avatar}
                  size={isPipExpanded ? 60 : 38}
                  name={localParticipant.name}
                />
              </View>
            )}

            {/* "You" label */}
            <View style={styles.pipLocalBadge}>
              <Text style={styles.pipLocalBadgeText}>You</Text>
            </View>

            {/* Expand / collapse indicator */}
            <View style={styles.pipExpandHint}>
              <Ionicons
                name={isPipExpanded ? 'contract' : 'expand'}
                size={11}
                color="rgba(255,255,255,0.8)"
              />
            </View>
          </TouchableOpacity>

          {/* ── Camera flip button (separate from tap-to-expand) ── */}
          <TouchableOpacity
            style={styles.pipCameraFlipBtn}
            onPress={(e) => {
              // Stop propagation so it doesn't trigger expand
              e.stopPropagation?.();
              flipCamera();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="camera-reverse" size={16} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }, [
    participants,
    allParticipants,
    isPipExpanded,
    pipLeft,
    pipTop,
    pipPanResponder,
    videoRefs,
    hasVideo,
    flipCamera,
    handRaised,
  ]);


  const waitingRoom = useMemo(() => (
    <View style={styles.waitingContainer}>
    <View style={styles.waitingIcon}>
      <Ionicons name="videocam" size={48} color="#999" />
    </View>
      <Text style={styles.waitingTitle}>Connecting...</Text>
      <Text style={styles.waitingText}>
        Please wait while we set up your secure connection
      </Text>
      <View style={styles.participantsPreview}>
        <Text style={styles.previewTitle}>In this space ({waitingParticipants?.filter(p => !participants.some(active => active.id === p.id)).length || 0})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {waitingParticipants
            ?.filter(p => !participants.some(active => active.id === p.id))
            .slice(0, 10).map((p) => (
              <View key={p.id} style={styles.previewParticipant}>
                <Avatar source={p.avatar} size={50} name={p.name} />
                <Text style={styles.previewName} numberOfLines={1}>{p.name}</Text>
              </View>
            ))}
          {(waitingParticipants?.filter(p => !participants.some(active => active.id === p.id)).length || 0) > 10 && (
            <View style={styles.previewMore}>
              <Text style={styles.previewMoreText}>+{(waitingParticipants?.filter(p => !participants.some(active => active.id === p.id)).length || 0) - 10}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  ), [callStatus, spaceType, participants, pulseAnimation, initializeCall, waitingParticipants]);

  const renderMinimizedUI = () => {
    const mainParticipant = activeSpeaker ? participants.find(p => p.id === activeSpeaker) || allParticipants[0] : allParticipants[0];

    return (
      <View style={styles.minimizedContent}>
        <VideoTile
          participant={mainParticipant}
          isLocal={mainParticipant.id === 'local'}
          isSpeaking={activeSpeaker === mainParticipant.id}
          isMuted={mainParticipant.isMuted}
          hasVideo={mainParticipant.hasVideo}
          stream={mainParticipant.stream}
          videoRefs={videoRefs}
          name={mainParticipant.name}
          avatar={mainParticipant.avatar}
        />
        <View style={styles.minimizedOverlay}>
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.minimizedGradient}>
            <View style={styles.minimizedHeader}>
              <Ionicons name="expand" size={16} color="#fff" />
              <Text style={styles.minimizedCount}>+{participants.length}</Text>
            </View>
          </LinearGradient>
        </View>
      </View>
    );
  };

  const renderParticipantsModal = () => (
    <View style={styles.modalOverlay}>
      <BlurView intensity={100} tint="dark" style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Participants ({allParticipants.length})</Text>
          <TouchableOpacity onPress={() => setShowParticipantsModal(false)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          {allParticipants.map(participant => (
            <View key={participant.id} style={styles.participantRow}>
              <View style={styles.participantInfo}>
                <Avatar source={participant.avatar} size={40} name={participant.name} />
                <View style={styles.participantText}>
                  <Text style={styles.participantName}>
                    {participant.name} {participant.id === 'local' ? '(You)' : ''}
                  </Text>
                  <Text style={styles.participantRole}>{participant.role}</Text>
                </View>
              </View>
              <View style={styles.participantActions}>
                <Ionicons 
                  name={participant.isMuted ? "mic-off" : "mic"} 
                  size={20} 
                  color={participant.isMuted ? "#FF6B6B" : "#4CD964"} 
                  style={styles.actionIcon}
                />
                <Ionicons 
                  name={participant.hasVideo ? "videocam" : "videocam-off"} 
                  size={20} 
                  color={participant.hasVideo ? "#4CD964" : "#999"} 
                />
              </View>
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity 
          style={styles.inviteButton}
          onPress={() => Alert.alert('Invite', 'Invitation feature coming soon')}
        >
          <Text style={styles.inviteButtonText}>Invite People</Text>
        </TouchableOpacity>
      </BlurView>
    </View>
  );

  const renderMoreMenu = () => (
    <TouchableOpacity 
      style={styles.moreMenuOverlay} 
      activeOpacity={1} 
      onPress={() => setShowMoreMenu(false)}
    >
      <BlurView intensity={100} tint="dark" style={styles.moreMenuContainer}>
        <View style={styles.moreMenuHeader}>
          <View style={styles.dragHandle} />
        </View>
        <ScrollView horizontal={false} showsVerticalScrollIndicator={false}>
          {[
            { icon: "share-social", label: "Share Screen", onPress: toggleScreenShare, color: isSharingScreen ? "#007AFF" : "#fff" },
            { icon: "hand-left", label: handRaised ? "Lower Hand" : "Raise Hand", onPress: toggleHandRaise, color: handRaised ? "#FFCC00" : "#fff" },
            ...(!isWeb ? [{ icon: "camera-reverse", label: "Flip Camera", onPress: flipCamera, color: "#fff" }] : []),
          ].map((item, idx) => (

            <TouchableOpacity key={idx} style={styles.moreMenuItem} onPress={() => { item.onPress(); setShowMoreMenu(false); }}>
              <View style={styles.moreMenuIconBox}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={[styles.moreMenuLabel, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BlurView>
    </TouchableOpacity>
  );

  if (isMinimized) return renderMinimizedUI();

  const controlSize = isMobileWeb ? 48 : 56;
  const buttonSize = isMobileWeb ? 52 : 64;

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity: fadeAnim,
          paddingTop: isMobileWeb ? insets.top : 0,
          paddingBottom: isMobileWeb ? insets.bottom : 0
        }
      ]} 
      onTouchStart={handleUserInteraction}
    >
      <StatusBar barStyle="light-content" />

      <Animated.View style={[styles.header, { opacity: controlsOpacity, top: isMobileWeb ? insets.top + 10 : 0 }]}>
        <TouchableOpacity 
          onPress={() => onToggleMinimize ? onToggleMinimize() : router.back()} 
          style={styles.backButton}
        >
          <BlurView intensity={80} style={styles.blurButton}>
            <Ionicons name="chevron-down" size={24} color="#fff" />
          </BlurView>
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.spaceTitle} numberOfLines={1}>{currentSpace?.title || 'Call'}</Text>
          <View style={styles.callInfo}>
            <View style={[styles.callStatusDot, callStatus === 'connected' ? styles.statusConnected : styles.statusConnecting]} />
            <Text style={styles.callDuration}>
              {callStatus === 'waiting' ? 'Waiting' : formatDuration(callDuration)}
            </Text>
            {callStatus === 'connected' && (
              <Text style={styles.participantCount}>• {allParticipants.length}</Text>
            )}
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => setSelectedView(prev => prev === 'grid' ? 'speaker' : 'grid')}
          >
            <BlurView intensity={80} style={styles.blurButtonSmall}>
              <Ionicons name={selectedView === 'grid' ? "person" : "grid"} size={18} color="#fff" />
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => setShowParticipantsModal(true)}
          >
            <BlurView intensity={80} style={styles.blurButtonSmall}>
              <Ionicons name="people" size={18} color="#fff" />
              {participants.length > 0 && (
                <View style={styles.participantBadge}>
                  <Text style={styles.participantBadgeText}>{participants.length + 1}</Text>
                </View>
              )}
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity style={styles.moreButton} onPress={() => setShowMoreMenu(true)}>
            <BlurView intensity={80} style={styles.blurButton}>
              <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
            </BlurView>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={styles.content}>
        {callStatus === 'ended' ? null : (callStatus === 'waiting' ? waitingRoom : (
          // ── PiP Mode: mobile web OR native mobile, exactly 1 remote participant ──
          (isMobileWeb || !isWeb) && participants.length === 1 ? (
            renderPiPLayout()
          ) : selectedView === 'grid' ? (
            <ScrollView
              contentContainerStyle={styles.gridContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.gridInner}>
                {allParticipants.map((p, index) => renderParticipantTile(p, index))}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.speakerView}>
              <View style={styles.largeSpeakerContainer}>
                {renderParticipantTile(
                  allParticipants.find(p => p.id === activeSpeaker) || 
                  allParticipants.find(p => p.id !== 'local') || 
                  allParticipants[0], 
                  0
                )}
              </View>
              <View style={styles.smallParticipantsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {allParticipants
                    .filter(p => p.id !== (activeSpeaker || allParticipants.find(p => p.id !== 'local')?.id || allParticipants[0].id))
                    .map((p, index) => (
                      <View key={p.id} style={styles.smallParticipantTile}>
                        <VideoTile
                          participant={p}
                          isLocal={p.id === 'local'}
                          isSpeaking={activeSpeaker === p.id}
                          isMuted={p.isMuted}
                          hasVideo={p.hasVideo}
                          stream={p.stream}
                          videoRefs={videoRefs}
                          name={p.name}
                          avatar={p.avatar}
                        />
                      </View>
                    ))}
                </ScrollView>
              </View>
            </View>
          )
        ))}
      </View>

      <Animated.View style={[styles.controlsContainer, { opacity: controlsOpacity, bottom: isMobileWeb ? insets.bottom + 10 : 0 }]}>
        <BlurView intensity={90} tint="dark" style={styles.controlsBlur}>
          <View style={styles.controlsRow}>
            <TouchableOpacity 
              style={[
                styles.controlButton, 
                isMuted && styles.controlButtonActive,
                { marginHorizontal: isMobileWeb ? 8 : 15 }
              ]} 
              onPress={toggleMute}
            >
              <LinearGradient 
                colors={isMuted ? ['#FF6B6B', '#FF5252'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} 
                style={[styles.controlGradient, { width: controlSize, height: controlSize, borderRadius: controlSize/2 }]}
              >
                <Ionicons name={isMuted ? "mic-off" : "mic"} size={isMobileWeb ? 22 : 24} color="#fff" />
              </LinearGradient>
              <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.controlButton, 
                !hasVideo && styles.controlButtonActive,
                { marginHorizontal: isMobileWeb ? 8 : 15 }
              ]} 
              onPress={toggleVideo}
            >
              <LinearGradient 
                colors={!hasVideo ? ['#FF6B6B', '#FF5252'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} 
                style={[styles.controlGradient, { width: controlSize, height: controlSize, borderRadius: controlSize/2 }]}
              >
                <Ionicons name={hasVideo ? "videocam" : "videocam-off"} size={isMobileWeb ? 22 : 24} color="#fff" />
              </LinearGradient>
              <Text style={styles.controlLabel}>{hasVideo ? 'Video' : 'Off'}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.controlButton, 
                styles.endCallButton,
                { marginHorizontal: isMobileWeb ? 12 : 25 }
              ]} 
              onPress={endCall}
            >
              <LinearGradient 
                colors={['#FF3B30', '#D0021B']} 
                style={[styles.controlGradientLarge, { width: buttonSize, height: buttonSize, borderRadius: buttonSize/2 }]}
              >
                <Ionicons name="call" size={isMobileWeb ? 26 : 28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </LinearGradient>
              <Text style={[styles.controlLabel, styles.endCallLabel]}>Leave</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      {showParticipantsModal && renderParticipantsModal()}
      {showMoreMenu && renderMoreMenu()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  backButton: { width: 40, height: 40 },
  blurButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerInfo: { flex: 1, alignItems: 'center' },
  spaceTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  callInfo: { flexDirection: 'row', alignItems: 'center' },
  callStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusConnected: { backgroundColor: '#4CAF50' },
  statusConnecting: { backgroundColor: '#FFA726' },
  callDuration: { color: '#4CAF50', fontSize: 12, fontWeight: '500' },
  participantCount: { color: '#999', fontSize: 12, marginLeft: 8 },
  moreButton: { width: 40, height: 40 },
  content: { flex: 1, backgroundColor: '#000' },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  waitingIcon: { marginBottom: 24 },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadow({ width: 0, height: 4, opacity: 0.3, radius: 12, elevation: 8 }),
  },
  waitingTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  waitingText: { color: '#999', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  startCallButton: { borderRadius: 30, overflow: 'hidden', marginBottom: 32 },
  startCallGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, gap: 8 },
  startCallText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  participantsPreview: { width: '100%' },
  previewTitle: { color: '#999', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  previewParticipant: { alignItems: 'center', marginRight: 20 },
  previewName: { color: '#fff', fontSize: 12, marginTop: 8, maxWidth: 70 },
  previewMore: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  previewMoreText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  gridContainer: { 
    flex: 1, 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    backgroundColor: '#000' 
  },
  gridItem: { 
    backgroundColor: '#1a1a1a',
    overflow: 'hidden'
  },

  videoTile: { flex: 1, position: 'relative', backgroundColor: '#2a2a2a' },
  videoElement: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarTile: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tileName: { color: '#fff', fontSize: 12, marginTop: 8, maxWidth: 100, textAlign: 'center' },
  tileOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileBadge: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  tileBadgeText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  youBadge: { color: '#4CAF50', fontSize: 10 },
  tileStatus: { flexDirection: 'row', gap: 6 },
  speakingDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  speakingPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  handBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#FFCC00',
  },

  gridInner: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    width: '100%', 
    height: '100%' 
  },
  speakerView: { flex: 1 },
  largeSpeakerContainer: { flex: 0.7, marginBottom: 8 },
  smallParticipantsContainer: { height: 120, paddingVertical: 8 },
  smallParticipantTile: { width: 140, height: 100, marginRight: 8, borderRadius: 12, overflow: 'hidden' },
  controlButtonActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  controlsContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },

  // ── PiP Styles (mobile web 1-on-1) ──
  pipContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  pipRemoteAvatar: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipRemoteName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  pipRemoteGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  pipRemoteMuteTag: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255,59,48,0.85)',
    borderRadius: 20,
    padding: 6,
  },
  pipLocal: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: '#2a2a2a',
    zIndex: 10,
    // iOS-style shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 12,
  },
  pipLocalAvatar: {
    flex: 1,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipLocalBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pipLocalBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  pipExpandHint: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    padding: 3,
  },

  pipRemoteNameTag: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pipRemoteNameTagText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // Hand raise badges inside PiP
  pipRemoteHandBadge: {
    position: 'absolute',
    top: 80,
    left: '50%' as any,
    transform: [{ translateX: -60 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pipRemoteHandText: {
    color: '#FFCC00',
    fontSize: 13,
    fontWeight: '600',
  },
  pipLocalHandBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    padding: 4,
    zIndex: 15,
  },
  pipCameraFlipBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    padding: 6,
    zIndex: 20,
  },
  controlsBlur: { paddingVertical: 16, paddingHorizontal: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  viewSelector: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 8 },
  viewButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  viewButtonActive: { backgroundColor: '#007AFF' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    marginRight: 8,
  },
  blurButtonSmall: {
    padding: 8,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 4,
    marginLeft: 4,
  },
  participantBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  controlButton: {
    alignItems: 'center',
    marginHorizontal: 15,
  },
  controlGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadow({ height: 4, radius: 10, opacity: 0.4 }),
  },
  controlGradientLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadow({ height: 6, radius: 15, opacity: 0.5 }),
  },
  controlLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  endCallButton: {
    marginLeft: 25,
  },
  endCallLabel: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalContainer: {
    height: '70%',
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantText: {
    marginLeft: 12,
  },
  participantName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  participantRole: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  participantActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    marginRight: 15,
  },
  inviteButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  moreMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    zIndex: 1001,
  },
  moreMenuContainer: {
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  moreMenuHeader: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  moreMenuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  moreMenuLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  additionalControls: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16 },
  additionalButton: { alignItems: 'center', paddingVertical: 8 },
  additionalText: { color: '#fff', fontSize: 10, marginTop: 4 },
  // Minimized PiP Styles
  minimizedContainer: {
    position: 'absolute',
    width: 150,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    zIndex: 9999,
    ...createShadow({
      width: 0,
      height: 4,
      opacity: 0.5,
      radius: 8,
      elevation: 10,
    }),
  },
  minimizedTouch: {
    flex: 1,
  },
  minimizedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  minimizedGradient: {
    height: '40%',
    padding: 8,
    justifyContent: 'flex-end',
  },
  minimizedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  minimizedCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  minimizedContent: {
    flex: 1,
  },
});

export default ImmersiveCallView;