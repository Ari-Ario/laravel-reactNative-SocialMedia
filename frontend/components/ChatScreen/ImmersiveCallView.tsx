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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { createShadow } from '@/utils/styles';

let RTCView: any;
if (Platform.OS !== 'web') {
  RTCView = require('react-native-webrtc').RTCView;
}

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Optimized grid calculation - reflects Teams (Web) and WhatsApp (Mobile) styles
const getGridConfig = (participantCount: number) => {
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
}

interface ImmersiveCallViewProps {
  spaceId: string;
  spaceType?: 'direct' | 'group' | 'protected' | 'channel';
}

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
  avatar
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
      {isWeb && stream ? (
        <video
          ref={(el) => {
            videoElementRef.current = el;
            if (el && videoRefs) videoRefs.current.set(participant.id, el);
          }}
          autoPlay
          playsInline
          muted={isLocal}
          style={styles.videoElement}
        />
      ) : stream && !isWeb && RTCView ? (
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

const ImmersiveCallView: React.FC<ImmersiveCallViewProps> = ({ spaceId, spaceType = 'group' }) => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialCallType = (params.type as string) || 'video';
  const collaborationService = CollaborationService.getInstance();
  const webRTCService = WebRTCService.getInstance();
  const { currentSpace } = useSpaceStore();
  const { user } = useContext(AuthContext);

  // State with useMemo for derived values
  const [participants, setParticipants] = useState<Participant[]>([]);
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

  // Animations - optimized with useRef
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const spinValue = useSharedValue(0);
  const pulseValue = useSharedValue(1);

  // Refs for performance
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

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
  }, [currentSpace]);

  const initializeCall = useCallback(async (forceStart = false) => {
    try {
      // If direct space OR force start OR already live, try to join/start the call
      if (spaceType === 'direct' || forceStart || currentSpace?.is_live) {
        setCallStatus('connecting');
        const response = await collaborationService.startCall(spaceId, (initialCallType as any) || 'video');
        const callData = response.call || response;
        if (!callData?.id) throw new Error('Failed to get call information');

        const currentUserId = parseInt(user?.id?.toString() || '0', 10);
        if (callData) {
          setCallId(callData.id);
          const initiatorId = callData.initiator_id || callData.initiator?.id;
          const currentIsInitiator = parseInt(initiatorId?.toString() || '0', 10) === currentUserId;

          console.log(`📞 Call Initiator ID: ${initiatorId}, Current User ID: ${currentUserId}, isInitiator: ${currentIsInitiator}`);
          setIsInitiator(currentIsInitiator);

          // ✅ NEW: Join the call via API to track active state and get active users
          const joinResponse = await collaborationService.joinWebRTCCall(spaceId);
          const activeUsers = joinResponse.call?.users || [];

          // ✅ Populate participants list with ACTIVE users from the backend
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

          // ✅ Proactively sync handshakes with existing participants
          webRTCService.syncParticipants(activeUsers.map((u: any) => u.id.toString()));

          await webRTCService.notifyCallActive();
        }

        const stream = await webRTCService.getLocalStream(hasVideo, true);
        setLocalStream(stream);
        setCallStatus('connected');

        durationInterval.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);

        setupCallbacks();
      } else {
        setCallStatus('waiting');
        setParticipants([]);
      }
    } catch (error) {
      console.error('Error initializing call:', error);
      Alert.alert('Error', 'Failed to start call. Please try again.');
      router.back();
    }
  }, [spaceId, spaceType, initialCallType, user, hasVideo, currentSpace, isInitiator, setupCallbacks, webRTCService, collaborationService, router]);

  useEffect(() => {
    initializeCall();
    return () => cleanup();
  }, [spaceId, initializeCall, cleanup]);

  useEffect(() => {
    if (callStatus === 'waiting') {
      // Use the official service subscription to ensure correct presence-channel binding
      collaborationService.subscribeToSpace(spaceId, 'immersive-call-lobby', {
        onCallStarted: (data: any) => {
          console.log('📡 Call started event received in lobby:', data);
          if (data.call?.id) {
            setCallId(data.call.id);
            initializeCall(true); // Re-run initialization to join the now-active call
          }
        },
        onCallEnded: () => {
          setCallStatus('ended');
          cleanup();
        },
        onParticipantUpdate: (data: any) => {
          // Refresh participant previews if they join/leave while in waiting room
          if (currentSpace?.participants) {
            const participantList = currentSpace.participants.map((p: any) => ({
              id: p.user_id?.toString() || p.id?.toString(),
              user_id: p.user_id || p.id,
              name: p.user?.name || p.name || 'Participant',
              avatar: p.user?.profile_photo || p.profile_photo,
              role: p.role || 'participant',
              isMuted: false,
              hasVideo: false,
              isSharingScreen: false,
              joinedAt: Date.now()
            }));
            setParticipants(participantList);
          }
        }
      });

      return () => {
        collaborationService.unsubscribeFromSpace(spaceId, 'immersive-call-lobby');
      };
    }
  }, [callStatus, spaceId, initializeCall, currentSpace, collaborationService, cleanup]);

  // ✅ Ghost Participant Pruning
  // Periodically check for participants who were pre-populated but never connected
  useEffect(() => {
    if (callStatus !== 'connected') return;

    const PRUNING_INTERVAL = 5000;
    const STALE_TIMEOUT = 15000;

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
    if (Platform.OS !== 'web') {
      Alert.alert('Screen Sharing', 'Only available on web');
      return;
    }
    try {
      if (!isSharingScreen) {
        await webRTCService.startScreenShare();
        setIsSharingScreen(true);
      } else {
        await webRTCService.stopScreenShare();
        setIsSharingScreen(false);
      }
    } catch (error) {
      console.error('Screen share error:', error);
    }
  }, [isSharingScreen]);

  const flipCamera = useCallback(async () => {
    if (isWeb) {
      Alert.alert('Flip Camera', 'Not available on web');
      return;
    }
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack && typeof (videoTrack as any)._switchCamera === 'function') {
        (videoTrack as any)._switchCamera();
        try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
      }
    }
  }, [localStream]);

  const endCall = useCallback(async () => {
    setCallStatus('ended');
    cleanup();
    if (callId && spaceType === 'direct') {
      await collaborationService.endCall(spaceId, callId);
    }
    router.replace({ pathname: '/(spaces)/[id]', params: { id: spaceId } });
  }, [callId, spaceId, spaceType, cleanup]);

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
          isMuted={item.isMuted}
          hasVideo={item.hasVideo}
          stream={item.stream}
          videoRefs={videoRefs}
          name={item.name}
          avatar={item.avatar}
        />
      </View>
    );
  }, [gridConfig, activeSpeaker]);

  const waitingRoom = useMemo(() => (
    <View style={styles.waitingContainer}>
      <ReAnimated.View style={[styles.waitingIcon, pulseAnimation]}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.iconGradient}>
          <Ionicons name="videocam" size={48} color="#fff" />
        </LinearGradient>
      </ReAnimated.View>
      <Text style={styles.waitingTitle}>Ready to Connect</Text>
      <Text style={styles.waitingText}>
        {spaceType === 'direct' ? 'Connecting...' : 'No active call. Start one!'}
      </Text>
      {spaceType !== 'direct' && (
        <TouchableOpacity style={styles.startCallButton} onPress={() => initializeCall(true)}>
          <LinearGradient colors={['#4CAF50', '#45a049']} style={styles.startCallGradient}>
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.startCallText}>Start Call</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
      <View style={styles.participantsPreview}>
        <Text style={styles.previewTitle}>In this space ({participants.length})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {participants.slice(0, 10).map((p, i) => (
            <View key={p.id} style={styles.previewParticipant}>
              <Avatar source={p.avatar} size={50} name={p.name} />
              <Text style={styles.previewName} numberOfLines={1}>{p.name}</Text>
            </View>
          ))}
          {participants.length > 10 && (
            <View style={styles.previewMore}>
              <Text style={styles.previewMoreText}>+{participants.length - 10}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  ), [callStatus, spaceType, participants, pulseAnimation, initializeCall]);

  return (
    <SafeAreaView style={styles.container} onTouchStart={handleUserInteraction}>
      <StatusBar barStyle="light-content" />

      <Animated.View style={[styles.header, { opacity: controlsOpacity }]}>
        <TouchableOpacity onPress={endCall} style={styles.backButton}>
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

        <TouchableOpacity style={styles.moreButton}>
          <BlurView intensity={80} style={styles.blurButton}>
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
          </BlurView>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.content}>
        {callStatus === 'waiting' ? waitingRoom : (
          <ScrollView
            contentContainerStyle={[
              styles.gridContainer,
              {
                flexDirection: 'row',
                flexWrap: 'wrap',
                flex: 1,
                alignContent: 'stretch'
              }
            ]}
            showsVerticalScrollIndicator={false}
          >
            {allParticipants.map((p, index) => renderParticipantTile(p, index))}
          </ScrollView>
        )}
      </View>

      <Animated.View style={[styles.controlsContainer, { opacity: controlsOpacity }]}>
        <BlurView intensity={90} tint="dark" style={styles.controlsBlur}>
          <View style={styles.viewSelector}>
            <TouchableOpacity
              style={[styles.viewButton, selectedView === 'grid' && styles.viewButtonActive]}
              onPress={() => setSelectedView('grid')}
            >
              <Ionicons name="grid" size={18} color={selectedView === 'grid' ? '#fff' : '#999'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewButton, selectedView === 'speaker' && styles.viewButtonActive]}
              onPress={() => setSelectedView('speaker')}
            >
              <Ionicons name="person" size={18} color={selectedView === 'speaker' ? '#fff' : '#999'} />
            </TouchableOpacity>
          </View>

          <View style={styles.controlsRow}>
            {[
              { icon: isMuted ? "mic-off" : "mic", active: isMuted, onPress: toggleMute, label: isMuted ? 'Unmute' : 'Mute' },
              { icon: hasVideo ? "videocam" : "videocam-off", active: !hasVideo, onPress: toggleVideo, label: hasVideo ? 'Video' : 'Off' },
              { icon: isSharingScreen ? "close-circle" : "share-social", active: isSharingScreen, onPress: toggleScreenShare, label: isSharingScreen ? 'Stop' : 'Share' },
            ].map((btn, idx) => (
              <TouchableOpacity key={idx} style={[styles.controlButton, btn.active && styles.controlButtonActive]} onPress={btn.onPress}>
                <LinearGradient colors={btn.active ? ['#FF6B6B', '#FF5252'] : ['#333', '#2a2a2a']} style={styles.controlGradient}>
                  <Ionicons name={btn.icon as any} size={22} color="#fff" />
                </LinearGradient>
                <Text style={styles.controlLabel}>{btn.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={endCall}>
              <LinearGradient colors={['#FF6B6B', '#FF5252']} style={styles.controlGradient}>
                <Ionicons name="call" size={22} color="#fff" />
              </LinearGradient>
              <Text style={[styles.controlLabel, styles.endCallLabel]}>Leave</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.additionalControls}>
            {[
              ...(!isWeb ? [{ icon: "camera-reverse", label: "Flip", onPress: flipCamera }] : []),
              { icon: "chatbubble", label: "Chat", onPress: () => Alert.alert('Chat', 'Coming soon') },
              { icon: "hand-left", label: "Raise", onPress: () => Alert.alert('Raise Hand', 'Hand raised!') },
              { icon: "people", label: "Invite", onPress: () => Alert.alert('Invite', 'Share link to invite') },
            ].map((btn, idx) => (
              <TouchableOpacity key={idx} style={styles.additionalButton} onPress={btn.onPress}>
                <Ionicons name={btn.icon as any} size={18} color="#fff" />
                <Text style={styles.additionalText}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>
      </Animated.View>
    </SafeAreaView>
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
  gridContainer: { padding: 8 },
  gridItem: { margin: 4, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1a1a1a' },
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
  controlsContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  controlsBlur: { paddingVertical: 16, paddingHorizontal: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  viewSelector: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 8 },
  viewButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  viewButtonActive: { backgroundColor: '#007AFF' },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  controlButton: { alignItems: 'center' },
  controlGradient: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', ...createShadow({ width: 0, height: 2, opacity: 0.3, radius: 4, elevation: 3 }) },
  controlButtonActive: { opacity: 0.9 },
  controlLabel: { color: '#fff', fontSize: 11, marginTop: 6 },
  endCallButton: { marginLeft: 8 },
  endCallLabel: { color: '#FF6B6B' },
  additionalControls: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16 },
  additionalButton: { alignItems: 'center', paddingVertical: 8 },
  additionalText: { color: '#fff', fontSize: 10, marginTop: 4 },
});

export default ImmersiveCallView;