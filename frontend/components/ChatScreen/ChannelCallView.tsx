// components/ChannelCallView.tsx
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MotiView, AnimatePresence } from 'moti';

import CollaborationService from '@/services/ChatScreen/CollaborationService';
import WebRTCService from '@/services/ChatScreen/WebRTCService';
import { useCollaborationStore } from '@/stores/collaborationStore';
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

// Participant Interface
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
  handRaised?: boolean;
}

interface ChannelCallViewProps {
  spaceId: string;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

const VideoTile = React.memo(({ participant, isLocal, stream, name, avatar, hasVideo, isMuted }: any) => {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [showControls, setShowControls] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isWeb && stream && videoElementRef.current) {
      videoElementRef.current.srcObject = stream;
      if (isLocal) videoElementRef.current.muted = true;
      videoElementRef.current.play().catch(e => console.warn("AutoPlay blocked in VideoTile:", e));
    }
  }, [stream, isLocal]);

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, friction: 5 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start();
    setShowControls(!showControls);
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={styles.videoTileContainer}>
      <Animated.View style={[styles.videoTile, { transform: [{ scale: scaleAnim }] }]}>
        {stream && hasVideo ? (
          <View style={StyleSheet.absoluteFill}>
            {isWeb ? (
              <video
                ref={videoElementRef}
                autoPlay
                playsInline
                muted={isLocal}
                style={styles.videoElement as any}
              />
            ) : RTCView ? (
              <RTCView
                streamURL={stream.toURL()}
                objectFit="cover"
                style={styles.videoElement}
                mirror={isLocal}
              />
            ) : null}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.videoGradient}
              pointerEvents="none"
            />
          </View>
        ) : (
          <LinearGradient
            colors={['#2a2a3e', '#1a1a2e']}
            style={[styles.avatarTile, StyleSheet.absoluteFill]}
          >
            <View style={styles.avatarWrapper}>
              <Avatar source={avatar} size={80} name={name} />
            </View>
            <Text style={styles.tileName}>{name}</Text>
            {isMuted && (
              <View style={styles.muteIndicator}>
                <Ionicons name="mic-off" size={14} color="#FF3B30" />
              </View>
            )}
          </LinearGradient>
        )}

        {showControls && (
          <View style={styles.videoControls}>
            <TouchableOpacity style={styles.videoControlBtn}>
              <Ionicons name="volume-high" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.videoControlBtn}>
              <Ionicons name="expand" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {!isLocal && participant?.role === 'moderator' && (
          <View style={styles.moderatorBadge}>
            <Ionicons name="mic" size={12} color="#fff" />
            <Text style={styles.moderatorText}>HOST</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

const ChannelCallView: React.FC<ChannelCallViewProps> = ({ spaceId }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const { endCall: globalEndCall } = useCall();
  const { spaces } = useCollaborationStore();
  const currentSpace = useMemo(() =>
    spaces.find(s => String(s.id) === String(spaceId)),
    [spaces, spaceId]
  );
  const webRTCService = WebRTCService.getInstance();
  const collaborationService = CollaborationService.getInstance();
  const scrollY = useRef(new Animated.Value(0)).current;

  const currentUserId = parseInt(user?.id?.toString() || '0', 10);
  const myParticipation = useMemo(() => {
    if (!currentUserId || !currentSpace) return null;

    // 1. Try explicit current user participation from list
    const p = currentSpace.participations?.find((part: any) => 
      (part.user_id === currentUserId) || (part.user?.id === currentUserId)
    );
    if (p) return p;

    // 2. Fallback to space-level my_participation if ID matches
    if (currentSpace.my_participation && currentSpace.creator_id === currentUserId) return currentSpace.my_participation;
    
    // 3. Last resort fallback for creator
    if (currentSpace.creator_id === currentUserId) return { role: 'owner' };
    
    return null;
  }, [currentSpace, currentUserId]);

  const isAdmin = useMemo(() => {
    if (!currentUserId || !currentSpace) return false;
    return ['owner', 'moderator'].includes(myParticipation?.role || '');
  }, [myParticipation, currentUserId, currentSpace]);

  // State
  const [isJoined, setIsJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<'waiting' | 'connected' | 'ended'>('waiting');
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [showPromotionInvite, setShowPromotionInvite] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [showParticipantList, setShowParticipantList] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [latestRequest, setLatestRequest] = useState<{ id: string, name: string } | null>(null);

  const { activeCall: contextActiveCall } = useCall();
  const hasAutoStarted = useRef(false);

  // Simulate audio levels for visualizer
  useEffect(() => {
    if (callStatus === 'connected') {
      const interval = setInterval(() => {
        setAudioLevel(Math.random());
      }, 100);
      return () => clearInterval(interval);
    }
  }, [callStatus]);

  // ✅ Lifecycle and Resource Management
  useEffect(() => {
    const init = async () => {
      if (spaceId && currentUserId) {
        // 1. Clean up previous session if any (Crucial for Singleton)
        await webRTCService.terminate();
        await webRTCService.initialize(currentUserId);
        
        // 2. Pre-populate participants list from space metadata for immediate UI feedback
        if (currentSpace?.participations) {
          const initialParticipants = currentSpace.participations
            .filter((p: any) => {
               const pId = p.user_id || p.user?.id;
               return pId && String(pId) !== String(currentUserId);
            })
            .map((p: any) => ({
              id: (p.user_id || p.user?.id).toString(),
              user_id: p.user_id || p.user?.id,
              name: p.user?.name || 'Broadcaster',
              avatar: p.user?.profile_photo,
              role: p.role || 'moderator',
              hasVideo: false,
              isMuted: true
            }));
          setParticipants(initialParticipants);
        }

        // 3. Automated Entry
        const call = await findActiveCall();
        if (call && !hasAutoStarted.current) {
          if (isAdmin) {
            handleStartBroadcast();
          } else {
            handleTuneIn();
          }
          hasAutoStarted.current = true;
        }
      }
    };
    init();

    return () => {
      // ✅ Terminate WebRTC and release hardware resources on unmount
      webRTCService.terminate();
    };
  }, [spaceId, currentUserId, currentSpace?.id]);

  // Discovery logic
  const findActiveCall = useCallback(async () => {
    try {
      const response = await collaborationService.joinWebRTCCall(spaceId);
      if (response.call) {
        setActiveCallId(response.call.id);
        
        // ✅ Sync existing participants to trigger initial signaling
        if (response.call.participants) {
          webRTCService.syncParticipants(response.call.participants);
        }
        
        return response.call;
      }
    } catch (e) {
      console.log('No active call found yet');
    }
    return null;
  }, [spaceId]);

  const handleTuneIn = async () => {
    console.log('📡 Audience Tuning In...');
    setCallStatus('connected');

    const call = await findActiveCall();
    if (!call) {
      Alert.alert('Broadcast Ended', 'The owner is no longer live.');
      setCallStatus('waiting');
      return;
    }

    await webRTCService.initialize(currentUserId);
    await webRTCService.joinCall(spaceId, call.id, false, true);
    setIsJoined(true);
    setupSignaling();
  };

  const handleStartBroadcast = async () => {
    if (!isAdmin) return;
    console.log('📡 Starting Broadcast...');
    setCallStatus('connected');

    try {
      const response = await collaborationService.startCall(spaceId, 'video');
      const call = response.call || response;
      setActiveCallId(call.id);

      await webRTCService.initialize(currentUserId);
      await webRTCService.joinCall(spaceId, call.id, true, false);

      const stream = await webRTCService.getLocalStream(true, true);
      setLocalStream(stream);
      setIsJoined(true);
      setupSignaling();
      await webRTCService.notifyCallActive();
    } catch (e) {
      console.error('Failed to start broadcast:', e);
      Alert.alert('Error', 'Failed to start broadcast.');
      setCallStatus('waiting');
    }
  };

  const setupSignaling = useCallback(() => {
    webRTCService.onRemoteStream((userId, stream) => {
      // ✅ Resolve actual name, avatar, and role from space participations
      const participation = currentSpace?.participations?.find((p: any) => 
        (p.user_id?.toString() === userId) || (p.user?.id?.toString() === userId)
      );
      const userName = participation?.user?.name || 'Broadcaster';
      const userAvatar = participation?.user?.profile_photo;
      const userRole = participation?.role || 'moderator';

      setParticipants(prev => {
        const existing = prev.find(p => p.id === userId);
        if (existing) return prev.map(p => p.id === userId ? { 
          ...p, 
          stream, 
          hasVideo: true, 
          name: userName,
          avatar: userAvatar,
          role: userRole
        } : p);

        return [...prev, {
          id: userId,
          user_id: parseInt(userId, 10),
          name: userName,
          avatar: userAvatar,
          role: userRole,
          stream,
          isMuted: false,
          hasVideo: true,
          isSharingScreen: false,
          joinedAt: Date.now()
        }];
      });
    });

    webRTCService.onParticipantLeft(userId => {
      setParticipants(prev => prev.filter(p => p.id !== userId));
    });

    webRTCService.onHandRaised((userId, isRaised) => {
      // ✅ Resolve actual name from space participations
      const participation = currentSpace?.participations?.find((p: any) => 
        (p.user_id?.toString() === userId) || (p.user?.id?.toString() === userId)
      );
      const userName = participation?.user?.name || `User ${userId}`;

      setParticipants(prev => {
        const existing = prev.find(p => p.id === userId);
        if (existing) return prev.map(p => p.id === userId ? { 
          ...p, 
          handRaised: isRaised, 
          name: userName,
          avatar: participation?.user?.profile_photo
        } : p);

        return [...prev, {
          id: userId,
          user_id: parseInt(userId, 10),
          name: userName,
          avatar: participation?.user?.profile_photo,
          role: participation?.role || 'participant',
          isMuted: true,
          hasVideo: false,
          isSharingScreen: false,
          handRaised: isRaised
        }];
      });

      // ✅ MODERATOR ALERT: Show floating join request
      if (isRaised && isAdmin) {
        setLatestRequest({ id: userId, name: userName });
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
        }
        // Auto-hide banner after 8 seconds
        setTimeout(() => setLatestRequest(prev => prev?.id === userId ? null : prev), 8000);
      } else {
        setLatestRequest(prev => prev?.id === userId ? null : prev);
      }
    });

    webRTCService.onPromoted(async () => {
      console.log('🎉 I have been promoted to speaker! Showing invitation.');
      setShowPromotionInvite(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      }
    });

    webRTCService.onCallEnded(() => {
      handleLeaveCall();
    });

    webRTCService.onMuteStateChanged((userId, isMuted) => {
      setParticipants(prev => prev.map(p => p.id === userId ? { ...p, isMuted } : p));
    });

    webRTCService.onVideoStateChanged((userId, hasVideo) => {
      setParticipants(prev => prev.map(p => p.id === userId ? { ...p, hasVideo } : p));
    });

    webRTCService.onScreenShareStarted((userId) => {
      setParticipants(prev => prev.map(p => p.id === userId ? { ...p, isSharingScreen: true } : p));
    });

    webRTCService.onScreenShareEnded((userId) => {
      setParticipants(prev => prev.map(p => p.id === userId ? { ...p, isSharingScreen: false } : p));
    });
  }, [isAdmin, webRTCService, currentSpace]);

  const handleRequestSpeak = async () => {
    const newState = !handRaised;
    setHandRaised(newState);
    await webRTCService.toggleHandRaise(newState);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
  };

  const handlePromote = async (userId: string) => {
    await webRTCService.promoteParticipant(Number(userId));
    setParticipants(prev => prev.map(p => p.id === userId ? { ...p, role: 'moderator', handRaised: false } : p));
  };

  const handleToggleScreenShare = async () => {
    try {
      if (isSharingScreen) {
        await webRTCService.stopScreenShare();
        setIsSharingScreen(false);
      } else {
        await webRTCService.startScreenShare();
        setIsSharingScreen(true);
      }
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    } catch (e) {
      console.error('Screen share error:', e);
      setIsSharingScreen(false);
    }
  };

  const handleFlipCamera = async () => {
    try {
      if (Platform.OS === 'web') {
        // Simple front/back toggle for web
        const stream = await webRTCService.getLocalStream(true, true);
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0];
          await webRTCService.replaceVideoTrack(videoTrack);
        }
      } else {
        // Native camera flip
        const webrtc = require('react-native-webrtc');
        const videoTrack = localStream?.getVideoTracks()[0];
        if (videoTrack && (videoTrack as any)._switchCamera) {
          (videoTrack as any)._switchCamera();
        }
      }
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    } catch (e) {
      console.error('Camera flip error:', e);
    }
  };

  const handleLeaveCall = async () => {
    await webRTCService.endCall();
    globalEndCall();
    router.back();
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Animated Background */}
      <LinearGradient
        colors={['#0a0a0a', '#1a1a2e', '#16213e']}
        style={StyleSheet.absoluteFill}
      />

      {/* Live Visualizer Background */}
      {callStatus === 'connected' && (
        <View style={styles.visualizerContainer}>
          {[...Array(30)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.visualizerBar,
                {
                  height: 20 + Math.sin(Date.now() / 200 + i) * 30 * audioLevel,
                  opacity: 0.3 + audioLevel * 0.7,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Header */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 10, opacity: headerOpacity }]}>
        <BlurView intensity={30} tint="dark" style={styles.headerBlur}>
          <TouchableOpacity onPress={handleLeaveCall} style={styles.backButton}>
            <Ionicons name="chevron-down" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.channelInfo}>
              <Text style={styles.channelTitle} numberOfLines={1}>{currentSpace?.title || 'Live Broadcast'}</Text>
              <View style={styles.statusBadge}>
                <Animated.View
                  style={[
                    styles.liveDot,
                    callStatus === 'connected' && {
                      opacity: 1,
                      transform: [{ scale: 1 }],
                    }
                  ]}
                />
                <Text style={styles.statusText}>{callStatus === 'connected' ? 'LIVE' : 'OFF AIR'}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.participantsButton}
            onPress={() => setShowParticipantList(!showParticipantList)}
          >
            <Ionicons name="people" size={22} color="#fff" />
            <View style={styles.participantCount}>
              <Text style={styles.participantCountText}>{participants.length + (isJoined && isAdmin ? 1 : 0)}</Text>
            </View>
          </TouchableOpacity>
        </BlurView>
      </Animated.View>

      {/* Floating Join Stage Request (Host only) */}
      <AnimatePresence>
        {isAdmin && latestRequest && (
          <MotiView
            from={{ opacity: 0, translateY: -50 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -50 }}
            style={[styles.requestBanner, { top: insets.top + 75 }]}
          >
            <BlurView intensity={90} tint="dark" style={styles.requestBannerBlur}>
              <Ionicons name="hand-left" size={20} color="#FFD700" />
              <View style={styles.requestInfo}>
                <Text style={styles.requestText} numberOfLines={1}>
                  <Text style={{ fontWeight: '800' }}>{latestRequest.name}</Text> wants to join
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.promoteActionBtn}
                onPress={() => {
                  handlePromote(latestRequest.id);
                  setLatestRequest(null);
                }}
              >
                <Text style={styles.promoteActionText}>Promote</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dismissBtn} onPress={() => setLatestRequest(null)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </BlurView>
          </MotiView>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <View style={styles.content}>
        {callStatus === 'waiting' ? (
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            style={styles.lobbyContainer}
          >
            <LinearGradient
              colors={isAdmin ? ['#4f46e5', '#7c3aed'] : ['#1a1a2e', '#16213e']}
              style={styles.lobbyCard}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              {isAdmin ? (
                <>
                  <View style={styles.lobbyIconContainer}>
                    <MotiView
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ loop: true, duration: 2000 }}
                      style={styles.lobbyIcon}
                    >
                      <Ionicons name="videocam" size={56} color="#fff" />
                    </MotiView>
                  </View>
                  <Text style={styles.lobbyTitle}>Studio Setup</Text>
                  <Text style={styles.lobbyText}>Prepare your broadcast and go live to your channel.</Text>
                  <TouchableOpacity style={styles.actionButton} onPress={handleStartBroadcast}>
                    <LinearGradient colors={['#fff', '#f0f0f0']} style={styles.actionButtonGradient}>
                      <Text style={[styles.actionButtonText, { color: '#4f46e5' }]}>Start Broadcasting</Text>
                      <Ionicons name="arrow-forward" size={20} color="#4f46e5" />
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.lobbyIconContainer}>
                    <View style={styles.cinemaIcon}>
                      <Ionicons name="play" size={40} color="#4f46e5" style={{ marginLeft: 5 }} />
                    </View>
                  </View>
                  <Text style={styles.lobbyTitle}>Live Channel</Text>
                  <Text style={styles.lobbyText}>A broadcast is starting soon or currently live. Tune in now to join the audience.</Text>
                  <TouchableOpacity style={styles.actionButton} onPress={handleTuneIn}>
                    <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.actionButtonGradient}>
                      <Text style={styles.actionButtonText}>Tune In Now</Text>
                      <Ionicons name="play-circle" size={20} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </LinearGradient>
          </MotiView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
          >
            {/* Featured Broadcaster Tile (Host or Self) */}
            {(isAdmin && isJoined) || participants.some(p => p.stream && p.role === 'moderator') ? (
              <MotiView
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 100 }}
                style={styles.featuredTile}
              >
                <View style={styles.featuredLabel}>
                  <LinearGradient
                    colors={['#FF3B30', '#FF6B6B']}
                    style={styles.featuredBadge}
                  >
                    <Ionicons name="star" size={12} color="#fff" />
                    <Text style={styles.featuredText}>HOST</Text>
                  </LinearGradient>
                </View>

                {isAdmin && isJoined ? (
                  <VideoTile
                    isLocal
                    stream={localStream}
                    name={user?.name}
                    avatar={user?.profile_photo}
                    hasVideo={hasVideo}
                    isMuted={isMuted}
                  />
                ) : (
                  (() => {
                    const host = participants.find(p => p.stream && p.role === 'moderator');
                    return host ? (
                      <VideoTile
                        participant={host}
                        stream={host.stream}
                        name={host.name}
                        avatar={host.avatar}
                        hasVideo={host.hasVideo}
                        isMuted={host.isMuted}
                      />
                    ) : null;
                  })()
                )}
              </MotiView>
            ) : null}

            {/* Remote Participants Grid */}
            <View style={styles.participantsGrid}>
              {participants
                .filter(p => {
                  // If we are showing someone in the featured tile, hide them from the grid
                  if (isAdmin && isJoined) return true; // Featured is local, so all remote are in grid
                  const featuredHostId = participants.find(p => p.stream && p.role === 'moderator')?.id;
                  return p.id !== featuredHostId;
                })
                .map((p, index) => (
                <MotiView
                  key={p.id}
                  from={{ opacity: 0, scale: 0.9, translateY: 20 }}
                  animate={{ opacity: 1, scale: 1, translateY: 0 }}
                  transition={{ delay: index * 50 }}
                  style={styles.participantTile}
                >
                  <VideoTile
                    participant={p}
                    stream={p.stream}
                    name={p.name}
                    avatar={p.avatar}
                    hasVideo={p.hasVideo}
                    isMuted={p.isMuted}
                  />
                  {isAdmin && p.handRaised && (
                    <Animated.View style={styles.promoteOverlay}>
                      <TouchableOpacity style={styles.promoteBtn} onPress={() => handlePromote(p.id)}>
                        <Ionicons name="mic" size={16} color="#fff" />
                        <Text style={styles.promoteBtnText}>Promote</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                  {p.handRaised && !isAdmin && (
                    <View style={styles.handRaisedIndicator}>
                      <Ionicons name="hand-left" size={14} color="#FFD700" />
                    </View>
                  )}
                </MotiView>
              ))}
            </View>

            {participants.length === 0 && !isAdmin && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.emptyView}
              >
                <View style={styles.emptyIcon}>
                  <Ionicons name="tv-outline" size={56} color="rgba(255,255,255,0.2)" />
                </View>
                <Text style={styles.emptyTitle}>No Active Broadcasters</Text>
                <Text style={styles.emptyText}>
                  The broadcast hasn't started yet. Check back soon!
                </Text>
              </MotiView>
            )}
          </ScrollView>
        )}
      </View>

      {/* Bottom Controls */}
      <AnimatePresence>
        {isJoined && (
          <MotiView
            from={{ opacity: 0, translateY: 100 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: 100 }}
            style={[styles.controlsContainer, { paddingBottom: insets.bottom + 20 }]}
          >
            <BlurView intensity={80} tint="dark" style={styles.controlsBlur}>
              <View style={styles.controls}>
                {isAdmin ? (
                  <View style={styles.broadcasterControls}>
                    <TouchableOpacity
                      style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                      onPress={() => {
                        const s = !isMuted;
                        setIsMuted(s);
                        webRTCService.toggleMute(s);
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.controlBtn, !hasVideo && styles.controlBtnActive]}
                      onPress={() => {
                        const s = !hasVideo;
                        setHasVideo(s);
                        webRTCService.toggleVideo(s);
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Ionicons name={hasVideo ? "videocam" : "videocam-off"} size={22} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.controlBtn, isSharingScreen && styles.controlBtnActive]}
                      onPress={handleToggleScreenShare}
                    >
                      <Ionicons name={isSharingScreen ? "stop-circle" : "desktop"} size={22} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.controlBtn} onPress={handleFlipCamera}>
                      <Ionicons name="camera-reverse" size={22} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.controlBtn} onPress={() => setShowParticipantList(true)}>
                      <Ionicons name="people-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.participateButton, handRaised && styles.participateButtonActive]}
                    onPress={handleRequestSpeak}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={handRaised ? ['#FFD700', '#FFA500'] : ['#4f46e5', '#7c3aed']}
                      style={styles.participateButtonGradient}
                    >
                      {handRaised ? (
                        <MotiView
                          animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                          transition={{ loop: true, duration: 2000 }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        >
                          <Ionicons name="hand-right" size={20} color="#fff" />
                          <Text style={styles.participateText}>Awaiting Stage...</Text>
                        </MotiView>
                      ) : (
                        <>
                          <Ionicons name="hand-left" size={20} color="#fff" />
                          <Text style={styles.participateText}>Request to Speak</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveCall}>
                  <LinearGradient
                    colors={['#FF3B30', '#CC2F26']}
                    style={styles.leaveButtonGradient}
                  >
                    <Ionicons name="call" size={22} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </BlurView>
          </MotiView>
        )}
      </AnimatePresence>

      {/* Participant List Sidebar */}
      <AnimatePresence>
        {showParticipantList && (
          <MotiView
            from={{ opacity: 0, translateX: 300 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: 300 }}
            style={styles.participantSidebar}
          >
            <BlurView intensity={90} tint="dark" style={styles.sidebarBlur}>
              <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>Participants</Text>
                <TouchableOpacity onPress={() => setShowParticipantList(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.participantList}>
                {isAdmin && isJoined && (
                  <View style={styles.participantItem}>
                    <View style={styles.participantAvatar}>
                      <Avatar source={user?.profile_photo} name={user?.name} size={36} />
                    </View>
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName}>{user?.name} (You)</Text>
                      <Text style={styles.participantRole}>Host</Text>
                    </View>
                    <View style={styles.participantStatus}>
                      <View style={styles.statusOnline} />
                    </View>
                  </View>
                )}

                {participants.map(p => (
                  <View key={p.id} style={styles.participantItem}>
                    <View style={styles.participantAvatar}>
                      <Avatar name={p.name} size={36} />
                    </View>
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName}>{p.name}</Text>
                      <Text style={styles.participantRole}>
                        {p.role === 'moderator' ? 'Speaker' : p.handRaised ? 'Requesting' : 'Listener'}
                      </Text>
                    </View>
                    <View style={styles.participantStatus}>
                      {isAdmin && p.handRaised ? (
                        <TouchableOpacity 
                          style={styles.sidebarPromoteBtn}
                          onPress={() => handlePromote(p.id)}
                        >
                          <Text style={styles.sidebarPromoteText}>Promote</Text>
                        </TouchableOpacity>
                      ) : p.isMuted ? (
                        <Ionicons name="mic-off" size={16} color="#FF3B30" />
                      ) : (
                        <View style={styles.statusSpeaking}>
                          <View style={styles.speakingWave} />
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </BlurView>
          </MotiView>
        )}
      </AnimatePresence>

      {/* Stage Invitation Modal */}
      <AnimatePresence>
        {showPromotionInvite && (
          <View style={StyleSheet.absoluteFill}>
            <BlurView intensity={95} tint="dark" style={styles.inviteContainer}>
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={styles.inviteCard}
              >
                <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.inviteGradient}>
                  <View style={styles.inviteIcon}>
                    <Ionicons name="mic" size={48} color="#fff" />
                  </View>
                  <Text style={styles.inviteTitle}>Join the Stage?</Text>
                  <Text style={styles.inviteText}>The Host has invited you to share your camera and microphone. You will be live for everyone.</Text>
                  
                  <View style={styles.inviteActions}>
                    <TouchableOpacity 
                      style={styles.inviteBtnAccept}
                      onPress={async () => {
                        setShowPromotionInvite(false);
                        const call = await findActiveCall();
                        if (call) {
                          await webRTCService.endCall();
                          setIsJoined(false);
                          setCallStatus('connected');
                          await webRTCService.initialize(currentUserId);
                          await webRTCService.joinCall(spaceId, call.id, false, false);
                          setIsJoined(true);
                          const stream = await webRTCService.getLocalStream(true, true);
                          setLocalStream(stream);
                        }
                      }}
                    >
                      <Text style={styles.inviteBtnText}>Accept & Go Live</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.inviteBtnDecline}
                      onPress={() => setShowPromotionInvite(false)}
                    >
                      <Text style={styles.inviteBtnTextDecline}>Not Now</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </MotiView>
            </BlurView>
          </View>
        )}
      </AnimatePresence>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  visualizerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.3,
  },
  visualizerBar: {
    width: 3,
    marginHorizontal: 2,
    backgroundColor: '#4f46e5',
    borderRadius: 1.5,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  headerBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 30,
    overflow: 'hidden',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  channelInfo: { alignItems: 'center' },
  channelTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30', marginRight: 6 },
  statusText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  participantsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  participantCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  participantCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  content: { flex: 1, marginTop: 80 },
  lobbyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  lobbyCard: {
    width: '100%',
    maxWidth: 400,
    padding: 32,
    borderRadius: 32,
    alignItems: 'center',
    ...createShadow({ opacity: 0.3, radius: 20, height: 10 }),
  },
  lobbyIconContainer: {
    marginBottom: 24,
  },
  lobbyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lobbyTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  lobbyText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 20 },
  actionButton: {
    marginTop: 32,
    borderRadius: 30,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    gap: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  gridContainer: { flexGrow: 1, padding: 16 },
  featuredTile: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
    ...createShadow({ opacity: 0.3, radius: 15, height: 5 }),
  },
  featuredLabel: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    gap: 4,
  },
  featuredText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  participantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  participantTile: {
    width: (width - 44) / 2,
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    ...createShadow({ opacity: 0.2, radius: 8, height: 2 }),
  },
  videoTileContainer: { flex: 1 },
  videoTile: { flex: 1, backgroundColor: '#1a1a2e', position: 'relative' },
  videoElement: { width: '100%', height: '100%' },
  videoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  avatarTile: { justifyContent: 'center', alignItems: 'center' },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 12,
  },
  tileName: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 8 },
  muteIndicator: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 12 },
  videoControls: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  videoControlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moderatorBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  moderatorText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  controlsBlur: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  broadcasterControls: { flexDirection: 'row', gap: 16, flex: 1, justifyContent: 'center' },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: { backgroundColor: '#FF3B30' },
  participateButton: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
  },
  participateButtonActive: {
    ...createShadow({ opacity: 0.3, radius: 8 }),
  },
  participateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  participateText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  leaveButton: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  leaveButtonGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400, paddingHorizontal: 40 },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  promoteOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  promoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  promoteBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  handRaisedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,215,0,0.9)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantSidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: width * 0.8,
    maxWidth: 320,
    zIndex: 30,
  },
  sidebarBlur: {
    flex: 1,
    paddingTop: 60,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sidebarTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  participantList: { flex: 1, paddingHorizontal: 16 },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  participantAvatar: {
    marginRight: 12,
  },
  participantInfo: { flex: 1 },
  participantName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  participantRole: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  participantStatus: { alignItems: 'center' },
  statusOnline: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  statusSpeaking: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4f46e5',
  },
  speakingWave: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4f46e5',
  },
  requestBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 100,
    ...createShadow({ opacity: 0.4, radius: 15, height: 8 }),
  },
  requestBannerBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(26,26,46,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  requestInfo: { flex: 1, marginLeft: 12 },
  requestText: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  promoteActionBtn: {
    backgroundColor: '#34C759',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  promoteActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  dismissBtn: { marginLeft: 12, padding: 4 },
  sidebarPromoteBtn: {
    backgroundColor: '#34C759',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  sidebarPromoteText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cinemaIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadow({ opacity: 0.3, radius: 10 }),
  },
  inviteContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  inviteCard: {
    width: '85%',
    borderRadius: 30,
    overflow: 'hidden',
    ...createShadow({ opacity: 0.5, radius: 20, height: 10 }),
  },
  inviteGradient: {
    padding: 30,
    alignItems: 'center',
  },
  inviteIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  inviteTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
  },
  inviteText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  inviteActions: {
    width: '100%',
    gap: 15,
  },
  inviteBtnAccept: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  inviteBtnText: {
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: '800',
  },
  inviteBtnDecline: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  inviteBtnTextDecline: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ChannelCallView;