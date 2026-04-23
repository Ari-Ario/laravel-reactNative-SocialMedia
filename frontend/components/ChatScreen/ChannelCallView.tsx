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
  useWindowDimensions,
  Share,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { MotiView, AnimatePresence } from 'moti';

import CollaborationService from '@/services/ChatScreen/CollaborationService';
import WebRTCService from '@/services/ChatScreen/WebRTCService';
import { useCollaborationStore } from '@/stores/collaborationStore';
import Avatar from '@/components/Image/Avatar';
import AuthContext from '@/context/AuthContext';
import { useCall } from '@/context/CallContext';
import { createShadow } from '@/utils/styles';
import { useTranslation } from '@/constants/i18n';

let RTCView: any;
if (Platform.OS !== 'web') {
  RTCView = require('react-native-webrtc').RTCView;
}

const { width: SCREEN_WIDTH_STATIC } = Dimensions.get('window');
const width = SCREEN_WIDTH_STATIC;

// Orientation-aware grid calculation
const getGridConfig = (participantCount: number, width: number, height: number, isWeb: boolean) => {
  const isLandscape = width > height;
  const isMobileSize = width <= 768;

  if (isMobileSize) {
    if (isLandscape) {
      if (participantCount === 1) return { cols: 1, itemWidth: '100%', itemHeight: '100%' };
      if (participantCount === 2) return { cols: 2, itemWidth: '50%', itemHeight: '100%' };
      if (participantCount <= 4) return { cols: 2, itemWidth: '50%', itemHeight: '50%' };
      if (participantCount <= 6) return { cols: 3, itemWidth: '33.33%', itemHeight: '50%' };
      return { cols: 4, itemWidth: '25%', itemHeight: '50%' };
    } else {
      if (participantCount === 1) return { cols: 1, itemWidth: '100%', itemHeight: '100%' };
      if (participantCount === 2) return { cols: 1, itemWidth: '100%', itemHeight: '50%' };
      if (participantCount <= 4) return { cols: 2, itemWidth: '50%', itemHeight: '50%' };
      if (participantCount <= 6) return { cols: 2, itemWidth: '50%', itemHeight: '33.33%' };
      return { cols: 2, itemWidth: '50%', itemHeight: '25%' };
    }
  }

  if (isWeb) {
    if (isLandscape) {
      if (participantCount === 1) return { cols: 1, itemWidth: '96%', itemHeight: '96%' };
      if (participantCount === 2) return { cols: 2, itemWidth: '48%', itemHeight: '85%' };
      if (participantCount <= 4) return { cols: 2, itemWidth: '48%', itemHeight: '44%' };
      if (participantCount <= 6) return { cols: 3, itemWidth: '31%', itemHeight: '44%' };
      return { cols: 4, itemWidth: '23%', itemHeight: '23%' };
    } else {
      return { cols: 1, itemWidth: '96%', itemHeight: `${90 / participantCount}%` };
    }
  } else {
    if (participantCount === 1) return { cols: 1, itemWidth: '100%', itemHeight: '100%' };
    if (participantCount === 2) return { cols: 1, itemWidth: '100%', itemHeight: '50%' };
    if (participantCount <= 4) return { cols: 2, itemWidth: '50%', itemHeight: '50%' };
    return { cols: 2, itemWidth: '50%', itemHeight: '33.33%' };
  }
};
const isWeb = Platform.OS === 'web';

// Participant Interface
interface Participant {
  id: string;
  user_id: number;
  name: string;
  avatar?: string;
  role: string;
  stream?: MediaStream;
  isLocal?: boolean;
  isMuted: boolean;
  hasVideo: boolean;
  isSharingScreen: boolean;
  handRaised?: boolean;
  isSpeaking?: boolean;
  joinedAt?: number;
}

interface ChannelCallViewProps {
  spaceId: string;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

const VideoTile = React.memo(({ 
  participant, 
  stream, 
  name, 
  avatar, 
  hasVideo, 
  isMuted, 
  isSpeaking, 
  isLocal = false,
  isMaximized = false,
  isSharingScreen = false,
  onMaximize,
  isAdmin = false,
  onPromote
}: any) => {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const isHandRaised = participant.handRaised;
  const role = participant.role?.toLowerCase() || 'participant';
  const isHost = role === 'owner';
  const isMod = role === 'moderator' || role === 'admin';

  useEffect(() => {
    if (isWeb && stream && videoElementRef.current && videoElementRef.current.srcObject !== stream) {
      videoElementRef.current.srcObject = stream;
      // Web: Mute if local
      videoElementRef.current.muted = isLocal;
      videoElementRef.current.play().catch(e => {
        if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
          console.warn("AutoPlay blocked in VideoTile:", e);
        }
      });
    }
  }, [stream, isLocal, isSharingScreen]);

  return (
    <View style={styles.videoTile}>
      {/* Video Content */}
      <View style={styles.videoContainer}>
        {stream && hasVideo ? (
          <>
            {isWeb ? (
              <video
                ref={videoElementRef}
                autoPlay
                playsInline
                muted={isLocal}
                style={StyleSheet.flatten([
                  styles.videoElement as any,
                  isSharingScreen && { objectFit: 'contain' }
                ])}
              />
            ) : RTCView ? (
              <RTCView
                streamURL={stream.toURL()}
                style={styles.videoElement}
                objectFit={isSharingScreen ? "contain" : "cover"}
                mirror={isLocal && !isSharingScreen}
              />
            ) : null}
          </>
        ) : (
          <View style={styles.avatarContainer}>
            <Avatar source={avatar} size={isMaximized ? 120 : 80} name={name} />
            {!stream && isHandRaised && (
              <MotiView
                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ loop: true, duration: 2000 }}
                style={styles.waitingIndicator}
              >
                <Ionicons name="hand-left" size={24} color="#FFD700" />
                <Text style={styles.waitingText}>{t('awaiting_stage')}</Text>
              </MotiView>
            )}
          </View>
        )}

        {/* Glossy Overlay for Name and Status */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.tileOverlay}
        >
          <View style={styles.tileHeader}>
            <View style={styles.nameBadge}>
              {isHost && <Ionicons name="ribbon" size={14} color="#FFD700" style={{ marginRight: 4 }} />}
              <Text style={styles.tileName} numberOfLines={1}>{name}</Text>
              {isLocal && <Text style={styles.youBadge}>{t('you_label')}</Text>}
            </View>
            
            <View style={styles.statusIcons}>
              {isMuted && (
                <View style={styles.tileStatusBadge}>
                  <Ionicons name="mic-off" size={12} color="#FF6B6B" />
                </View>
              )}
              {isHandRaised && (
                <View style={[styles.tileStatusBadge, { backgroundColor: '#FFD700' }]}>
                  <Ionicons name="hand-left" size={12} color="#000" />
                </View>
              )}
            </View>
          </View>

          {/* Role Badge */}
          {(isHost || isMod) && (
            <View style={[styles.roleBadge, isHost ? styles.hostBadge : styles.modBadge]}>
              <Text style={styles.roleText}>{isHost ? t('host_role') : t('moderator_role')}</Text>
            </View>
          )}
        </LinearGradient>

        {/* Promote Button (For Admins viewing pending requests) */}
        {isAdmin && isHandRaised && !stream && (
          <TouchableOpacity style={styles.gridPromoteBtn} onPress={onPromote}>
            <LinearGradient
              colors={['#4f46e5', '#7c3aed']}
              style={styles.gridPromoteGradient}
            >
              <Ionicons name="mic" size={16} color="#fff" />
              <Text style={styles.gridPromoteText}>{t('bring_to_stage')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Speaking Indicator */}
      {isSpeaking && <View style={styles.speakingBorder} />}
    </View>
  );
});

const ChannelCallView: React.FC<ChannelCallViewProps> = ({ 
  spaceId,
  isMinimized = false,
  onToggleMinimize
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const isMobileSize = windowWidth <= 768;

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
    const p = currentSpace.participations?.find((part: any) => {
      const pId = part.user_id || part.user?.id;
      return String(pId) === String(currentUserId);
    });
    if (p) return p;

    // 2. Fallback to space-level my_role (direct and reliable for moderators/admins)
    if (currentSpace.my_role) {
      return { role: currentSpace.my_role };
    }

    // 3. Fallback to space-level my_participation if ID matches
    if (currentSpace.my_participation && (String(currentSpace.creator_id) === String(currentUserId) || (currentSpace.my_participation as any).user_id === currentUserId)) {
      return currentSpace.my_participation;
    }
    
    // 4. Last resort fallback for creator
    if (String(currentSpace.creator_id) === String(currentUserId)) return { role: 'owner' };
    
  }, [currentSpace, currentUserId]);

  const creatorId = currentSpace?.creator_id?.toString();

  // State
  const [isJoined, setIsJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<'waiting' | 'connected' | 'ended'>('waiting');
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [activeCallId, _setActiveCallId] = useState<string | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const setActiveCallId = useCallback((id: string | null) => {
    activeCallIdRef.current = id;
    _setActiveCallId(id);
  }, []);

  const [showParticipantList, setShowParticipantList] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const [localModeratorOverride, setLocalModeratorOverride] = useState(false);
  
  const isViewer = useMemo(() => {
    return !!(myParticipation?.permissions?.is_viewer);
  }, [myParticipation]);
  const [joinRequests, setJoinRequests] = useState<{ id: string, name: string, avatar?: string }[]>([]);

  const handleShare = async () => {
    const baseUrl = Platform.OS === 'web' ? window.location.origin : 'https://zmzir.com';
    const shareUrl = `${baseUrl}/spaces/${spaceId}`;
    const message = t('watch_broadcast_msg')
      .replace('{title}', currentSpace?.title || t('untitled'))
      .replace('{url}', shareUrl);

    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: currentSpace?.title || 'Live Broadcast',
            text: message,
            url: shareUrl,
          });
        } else {
          await Clipboard.setStringAsync(message);
          Alert.alert(t('link_copied_title'), t('link_copied_msg'));
        }
      } else {
        await Share.share({
          message,
          url: shareUrl,
          title: t('join_broadcast_title')
        });
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };


  const isAdmin = useMemo(() => {
    if (!currentUserId || !currentSpace) return false;
    // Include 'admin' as a fallback role
    return localModeratorOverride || ['owner', 'moderator', 'admin'].includes(myParticipation?.role?.toLowerCase() || '');
  }, [myParticipation, currentUserId, currentSpace, localModeratorOverride]);

  // ─── BROADCASTER ORDERING LOGIC ───
  const sortedBroadcasters = useMemo(() => {
    const broadcasterList: Participant[] = [];
    
    if (isJoined) {
      broadcasterList.push({
        id: 'local',
        user_id: currentUserId || 0,
        name: user?.name || t('you'),
        avatar: user?.profile_photo,
        role: isAdmin ? 'moderator' : 'participant',
        stream: localStream || undefined,
        hasVideo: hasVideo,
        isMuted: isMuted,
        isSpeaking: false,
        isSharingScreen: isSharingScreen,
        joinedAt: Date.now()
      });
    }

    participants.forEach(p => {
      if (p.id === 'local' || String(p.id) === String(currentUserId)) return;
      const isBroadcaster = !!p.stream;
      const isRequesting = p.handRaised;
      if (isBroadcaster || isRequesting) {
        broadcasterList.push(p);
      }
    });

    return broadcasterList.sort((a, b) => {
      const aId = String(a.id === 'local' ? currentUserId : a.id);
      const bId = String(b.id === 'local' ? currentUserId : b.id);
      
      const aIsHost = aId === creatorId;
      const bIsHost = bId === creatorId;
      if (aIsHost) return -1;
      if (bIsHost) return 1;

      const aIsMod = ['owner', 'moderator', 'admin'].includes(a.role?.toLowerCase() || '');
      const bIsMod = ['owner', 'moderator', 'admin'].includes(b.role?.toLowerCase() || '');
      if (aIsMod && !bIsMod) return -1;
      if (!aIsMod && bIsMod) return 1;

      if (a.stream && !b.stream) return -1;
      if (!a.stream && b.stream) return 1;

      return 0;
    });
  }, [participants, isJoined, localStream, currentUserId, creatorId, isAdmin, isMuted, hasVideo, isSharingScreen, user]);

  const screenSharer = useMemo(() => {
    if (isSharingScreen) return sortedBroadcasters.find(p => p.id === 'local');
    return sortedBroadcasters.find(p => p.isSharingScreen);
  }, [sortedBroadcasters, isSharingScreen]);

  const gridConfig = useMemo(() => {
    return getGridConfig(sortedBroadcasters.length, windowWidth, windowHeight, Platform.OS === 'web');
  }, [sortedBroadcasters.length, windowWidth, windowHeight]);

  const { activeCall: contextActiveCall } = useCall();
  const hasAutoStarted = useRef(false);


  // ✅ Lifecycle and Resource Management
  useEffect(() => {
    const init = async () => {
      if (spaceId && currentUserId) {
        // 1. Clean up previous session if any (Only if space actually changed)
        if (webRTCService.getSpaceId() !== spaceId) {
          console.log(`🔌 Resetting WebRTCService for new space: ${spaceId}`);
          await webRTCService.terminate();
          await webRTCService.initialize(currentUserId);
        }
        
        // 2. Fetch space details if missing to ensure isAdmin is correct
        if (!currentSpace?.participations) {
           try {
             await collaborationService.fetchSpaceDetails(spaceId);
           } catch (err) {
             console.error('Error fetching space details:', err);
           }
        }

        // 3. Pre-populate participants list
        if (currentSpace?.participations) {
          const initialParticipants = currentSpace.participations
            .filter((p: any) => {
               const pId = p.user_id || p.user?.id;
               return pId && String(pId) !== String(currentUserId);
            })
            .map((p: any) => ({
              id: (p.user_id || p.user?.id).toString(),
              user_id: p.user_id || p.user?.id,
              name: p.user?.name || t('broadcaster_fallback'),
              avatar: p.user?.profile_photo,
              role: p.role || 'moderator',
              hasVideo: false,
              isMuted: true,
              isSharingScreen: false
            }));
          setParticipants(initialParticipants);
        }

        // 4. Automated Entry - WAIT for metadata to be ready
        if (currentSpace && !hasAutoStarted.current) {
          const call = await findActiveCall();
          if (call) {
            console.log(`📡 [ChannelCallView] Autostarting (IsAdmin: ${isAdmin})`);
            if (isAdmin) {
              handleStartBroadcast();
            } else {
              handleTuneIn();
            }
            hasAutoStarted.current = true;
          }
        }
      }
    };
    init();

    return () => {
      webRTCService.terminate();
    };
  }, [spaceId, currentUserId, currentSpace?.id]); // Removed isAdmin to prevent re-initialization loops during promotion

  // Discovery logic
  const findActiveCall = useCallback(async () => {
    try {
      const response = await collaborationService.joinWebRTCCall(spaceId);
      if (response.call) {
        setActiveCallId(response.call.id);
        
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
      Alert.alert(t('broadcast_ended_title'), t('owner_not_live_msg'));
      setCallStatus('waiting');
      return;
    }

    await webRTCService.initialize(currentUserId);
    setupSignaling(); // Attach listeners FIRST
    await webRTCService.joinCall(spaceId, call.id, false, true);
    
    // ✅ Sync participants AFTER joinCall and listener setup
    if (call.participants) {
      webRTCService.syncParticipants(call.participants);
    }

    setIsJoined(true);
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
      setupSignaling(); // Attach listeners FIRST
      await webRTCService.joinCall(spaceId, call.id, true, false);

      // ✅ Sync participants AFTER joinCall
      if (call.participants) {
        webRTCService.syncParticipants(call.participants);
      }

      const stream = await webRTCService.getLocalStream(true, true);
      setLocalStream(stream);
      setIsJoined(true);
      await webRTCService.notifyCallActive();
    } catch (e) {
      console.error('Failed to start broadcast:', e);
      Alert.alert(t('error'), t('failed_start_broadcast'));
      setCallStatus('waiting');
    }
  };

  const setupSignaling = useCallback(() => {
    webRTCService.onRemoteStream((userId, stream) => {
      // ✅ Resolve actual name, avatar, and role from space metadata or participations
      const isCreator = String(userId) === String(currentSpace?.creator_id);
      
      const participation = currentSpace?.participations?.find((p: any) => 
        (p.user_id?.toString() === userId) || (p.user?.id?.toString() === userId)
      );

      const userName = (participation?.user?.name || (isCreator ? currentSpace?.creator?.name : t('broadcaster_fallback'))) || t('unknown_user');
      const userAvatar = participation?.user?.profile_photo || (isCreator ? currentSpace?.creator?.profile_photo : null);
      const userRole = isCreator ? 'owner' : (participation?.role || 'moderator');

      console.log(`📞 Received stream from ${userId}. Role: ${userRole}, IsCreator: ${isCreator}`);

      setParticipants(prev => {
        const existing = prev.find(p => String(p.id) === String(userId));
        if (existing) {
          return prev.map(p => String(p.id) === String(userId) ? { 
            ...p, 
            stream, 
            hasVideo: true, 
            name: userName || 'Unknown',
            avatar: userAvatar || undefined,
            role: userRole
          } : p);
        }

        return [...prev, {
          id: userId,
          user_id: parseInt(userId, 10),
          name: userName || 'Unknown',
          avatar: userAvatar || undefined,
          role: userRole,
          stream,
          isMuted: false,
          hasVideo: true,
          isSharingScreen: false,
          joinedAt: Date.now()
        } as Participant];
      });
    });

    webRTCService.onParticipantJoined((userId, isViewer) => {
      // ✅ Resolve actual name, avatar, and role from space metadata or participations
      const participation = currentSpace?.participations?.find((p: any) => 
        (p.user_id?.toString() === userId) || (p.user?.id?.toString() === userId)
      );
      const userName = participation?.user?.name || `User ${userId}`;
      const forcedRole = isViewer ? 'participant' : (participation?.role || 'moderator');

      setParticipants(prev => {
        if (prev.find(p => p.id === userId)) return prev;
        return [...prev, {
          id: userId,
          user_id: parseInt(userId, 10),
          name: userName,
          avatar: participation?.user?.profile_photo || undefined,
          role: forcedRole,
          isMuted: true,
          hasVideo: false,
          isSharingScreen: false,
          handRaised: false,
          isSpeaking: false,
          joinedAt: Date.now()
        }];
      });
    });

    webRTCService.onParticipantLeft((userId) => {
      setParticipants(prev => prev.filter(p => p.id !== userId));
      setJoinRequests(prev => prev.filter(req => req.id !== userId));
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
          avatar: participation?.user?.profile_photo || undefined,
          role: participation?.role || 'participant',
          isMuted: true,
          hasVideo: false,
          isSharingScreen: false,
          handRaised: isRaised
        }];
      });

      // ✅ MODERATOR ALERT: Show floating join request
      if (isRaised && isAdmin) {
        setJoinRequests(prev => {
          if (prev.find(r => r.id === userId)) return prev;
          return [...prev, { id: userId, name: userName, avatar: participation?.user?.profile_photo }];
        });
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
        }
      } else {
        setJoinRequests(prev => prev.filter(req => req.id !== userId));
      }
    });

    webRTCService.onPromoted(async (incomingCallId?: string) => {
      console.log(t('promoted_to_speaker_msg'));
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      }
      
      const cid = incomingCallId || activeCallIdRef.current;
      if (!cid) {
        console.error('❌ Cannot promote: No active call ID available');
        return;
      }

      // Immediate switch to broadcaster role
      await webRTCService.endCall(true); // silent = true
      setIsJoined(false);
      setCallStatus('connected');
      await webRTCService.initialize(currentUserId);
      setupSignaling(); // Attach listeners FIRST
      await webRTCService.joinCall(spaceId, cid, true, false); // true = initiator
      
      // Fetch current participants to establish handshakes with existing broadcasters
      try {
        const response = await collaborationService.joinWebRTCCall(spaceId);
        if (response && response.call && response.call.participants) {
          webRTCService.syncParticipants(response.call.participants);
        }
      } catch (err) {
        console.warn('Failed to sync participants after promotion:', err);
      }

      // Small delay to allow browser to release hardware from previous viewer session
      // Increased to 800ms to resolve NotReadableError on some browsers
      await new Promise(resolve => setTimeout(resolve, 800));

      // Fetch local stream
      const stream = await webRTCService.getLocalStream(true, true);
      setLocalStream(stream);
      setLocalModeratorOverride(true); // Ensure local tile is visible
      setIsJoined(true);

      // Notify others to trigger handshakes
      await webRTCService.notifyCallActive();
    });

    webRTCService.onDemoted(async () => {
      console.log(t('demoted_to_listener_msg'));
      await webRTCService.endCall();
      setIsJoined(false);
      setLocalStream(null);
      handleTuneIn(); // Re-join as listener
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

    webRTCService.onSpeakingUpdate((userId: string, level: number) => {
      const isSpeaking = level > 0.05; // Threshold for speaking
      if (userId === 'local') {
        setAudioLevel(prev => {
          if (Math.abs(prev - level) > 0.01) return level;
          return prev;
        });
      } else {
        setParticipants(prev => {
          const participant = prev.find(p => p.id === userId);
          if (participant && participant.isSpeaking === isSpeaking) return prev;
          return prev.map(p =>
            p.id === userId ? { ...p, isSpeaking } : p
          );
        });
      }
    });
  }, [isAdmin, webRTCService, currentSpace]);

  const handleRequestSpeak = async () => {
    const newState = !handRaised;
    setHandRaised(newState);
    await webRTCService.toggleHandRaise(newState);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
  };

  const handlePromote = async (userId: string) => {
    try {
      await webRTCService.promoteParticipant(Number(userId));
      setJoinRequests(prev => prev.filter(req => req.id !== userId));
      setParticipants(prev => prev.map(p => p.id === userId ? { ...p, role: 'moderator', handRaised: false } : p));
    } catch (e) {
      console.error('Promotion failed:', e);
    }
  };

  const handleDemote = async (userId: string) => {
    try {
      await webRTCService.demoteParticipant(Number(userId));
      setParticipants(prev => prev.map(p => p.id === userId ? { ...p, role: 'participant', stream: undefined } : p));
    } catch (e) {
      console.error('Demotion failed:', e);
    }
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

  const renderMinimizedUI = () => {
    const mainParticipant = sortedBroadcasters[0] || {
      id: 'none',
      name: 'Live Broadcast',
      avatar: undefined,
      stream: undefined,
      hasVideo: false,
      isMuted: true
    };

    return (
      <View style={styles.minimizedContent}>
        <VideoTile
          participant={mainParticipant}
          isLocal={mainParticipant.id === 'local'}
          stream={mainParticipant.stream}
          name={mainParticipant.name}
          avatar={mainParticipant.avatar}
          hasVideo={mainParticipant.hasVideo}
          isMuted={mainParticipant.isMuted}
          isSpeaking={mainParticipant.isSpeaking}
          isSharingScreen={mainParticipant.id === 'local' ? isSharingScreen : mainParticipant.isSharingScreen}
          isAdmin={isAdmin}
        />

        <View style={styles.minimizedOverlay}>
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.minimizedGradient}>
            <View style={styles.minimizedHeader}>
              <Ionicons name="expand" size={16} color="#fff" />
              {participants.length > 0 && (
                <Text style={styles.minimizedCount}>+{participants.length}</Text>
              )}
            </View>
          </LinearGradient>
        </View>
      </View>
    );
  };

  if (isMinimized) return renderMinimizedUI();

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
          <TouchableOpacity onPress={() => onToggleMinimize ? onToggleMinimize() : handleLeaveCall()} style={styles.backButton}>
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
            style={[styles.participantsButton, { marginRight: 10 }]}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={22} color="#fff" />
          </TouchableOpacity>

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
        {isAdmin && joinRequests.length > 0 && (
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
                  <Text style={{ fontWeight: '800' }}>{joinRequests[0].name}</Text>
                  {joinRequests.length > 1 ? ` & ${joinRequests.length - 1} more` : ' wants to join'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.promoteActionBtn}
                onPress={() => handlePromote(joinRequests[0].id)}
              >
                <Text style={styles.promoteActionText}>Promote</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.dismissBtn} 
                onPress={() => setJoinRequests(prev => prev.slice(1))}
              >
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
                  <Text style={styles.lobbyTitle}>{t('studio_setup')}</Text>
                  <Text style={styles.lobbyText}>Prepare your broadcast and go live to your channel.</Text>
                  <TouchableOpacity style={styles.actionButton} onPress={handleStartBroadcast}>
                    <LinearGradient colors={['#fff', '#f0f0f0']} style={styles.actionButtonGradient}>
                      <Text style={[styles.actionButtonText, { color: '#4f46e5' }]}>{t('start_broadcasting')}</Text>
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
                      <Text style={styles.actionButtonText}>{t('tune_in_now')}</Text>
                      <Ionicons name="play-circle" size={20} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </LinearGradient>
          </MotiView>
        ) : screenSharer ? (
          <View style={styles.speakerView}>
            <View style={styles.largeSpeakerContainer}>
              <VideoTile
                participant={screenSharer}
                stream={screenSharer.stream}
                name={screenSharer.name}
                avatar={screenSharer.avatar}
                hasVideo={screenSharer.hasVideo}
                isMuted={screenSharer.isMuted}
                isSpeaking={screenSharer.isSpeaking}
                isLocal={screenSharer.id === 'local'}
                isSharingScreen={true}
                isMaximized={true}
                onMaximize={() => setMaximizedId(null)}
              />
            </View>
            <View style={styles.smallParticipantsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
                {sortedBroadcasters
                  .filter(p => p.id !== screenSharer.id)
                  .map((p, index) => (
                    <View key={p.id} style={styles.smallParticipantTile}>
                      <VideoTile
                        participant={p}
                        stream={p.stream}
                        name={p.name}
                        avatar={p.avatar}
                        hasVideo={p.hasVideo}
                        isMuted={p.isMuted}
                        isSpeaking={p.isSpeaking}
                        isLocal={p.id === 'local'}
                        isSharingScreen={p.id === 'local' ? isSharingScreen : p.isSharingScreen}
                        isAdmin={isAdmin}
                        onPromote={() => handlePromote(p.id)}
                      />
                    </View>
                  ))}
              </ScrollView>
            </View>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollArea} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[
              styles.dynamicGrid, 
              { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }
            ]}>
              {sortedBroadcasters.map((p, index) => (
                <MotiView
                  key={p.id}
                  from={{ opacity: 0, scale: 0.9, translateY: 20 }}
                  animate={{ opacity: 1, scale: 1, translateY: 0 }}
                  transition={{ delay: index * 50 }}
                  style={{
                    width: gridConfig.itemWidth as any,
                    height: gridConfig.itemHeight as any,
                    padding: 4,
                  }}
                >
                  <VideoTile
                    participant={p}
                    stream={p.stream}
                    name={p.name}
                    avatar={p.avatar}
                    hasVideo={p.hasVideo}
                    isMuted={p.isMuted}
                    isSpeaking={p.isSpeaking}
                    isLocal={p.id === 'local'}
                    isSharingScreen={p.id === 'local' ? isSharingScreen : p.isSharingScreen}
                    isAdmin={isAdmin}
                    onPromote={() => handlePromote(p.id)}
                  />
                </MotiView>
              ))}
            </View>

            {sortedBroadcasters.length === 0 && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.emptyView}
              >
                <View style={styles.emptyIcon}>
                  <Ionicons name="tv-outline" size={56} color="rgba(255,255,255,0.2)" />
                </View>
                <Text style={styles.emptyTitle}>{t('broadcasting_studio')}</Text>
                <Text style={styles.emptyText}>
                  {isAdmin 
                    ? "You are the stage manager. Wait for speakers to join or start broadcasting yourself!"
                    : "The stage is currently empty. The broadcast will begin shortly."}
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
                ) : !isViewer ? (
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
                          <Text style={styles.participateText}>{t('request_to_speak')}</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.participateButton, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                    <View style={styles.participateButtonGradient}>
                      <Ionicons name="eye" size={20} color="rgba(255,255,255,0.6)" />
                      <Text style={[styles.participateText, { color: 'rgba(255,255,255,0.6)' }]}>Watching Live</Text>
                    </View>
                  </View>
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
                      <Text style={styles.participantRole}>
                        {String(currentUserId) === String(currentSpace?.creator_id) ? 'Host' : 'Moderator'}
                      </Text>
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
                      {isAdmin && (p.role === 'moderator' || p.role === 'admin') && String(p.user_id || p.id) !== String(currentSpace?.creator_id) ? (
                        <TouchableOpacity 
                          style={[styles.sidebarPromoteBtn, { backgroundColor: '#FF3B30' }]}
                          onPress={() => handleDemote(p.id)}
                        >
                          <Text style={styles.sidebarPromoteText}>Demote</Text>
                        </TouchableOpacity>
                      ) : isAdmin && p.handRaised ? (
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

      {/* Maximized Overlay */}
      <AnimatePresence>
        {maximizedId && (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={[StyleSheet.absoluteFill, { zIndex: 1000, backgroundColor: '#000' }]}
          >
            {(() => {
              if (maximizedId === 'local') {
                return (
                  <VideoTile
                    isLocal
                    stream={localStream}
                    name={user?.name}
                    avatar={user?.profile_photo}
                    hasVideo={hasVideo}
                    isMuted={isMuted}
                    isSharingScreen={isSharingScreen}
                    isMaximized
                    onMaximize={() => setMaximizedId(null)}
                  />
                );
              }
              const p = participants.find(part => String(part.id) === String(maximizedId));
              if (p) {
                return (
                  <VideoTile
                    participant={p}
                    stream={p.stream}
                    name={p.name}
                    avatar={p.avatar}
                    hasVideo={p.hasVideo}
                    isMuted={p.isMuted}
                    isSharingScreen={p.id === 'local' ? isSharingScreen : p.isSharingScreen}
                    isMaximized
                    onMaximize={() => setMaximizedId(null)}
                  />
                );
              }
              return null;
            })()}
          </MotiView>
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
  broadcastLayout: {
    marginBottom: 20,
    width: '100%',
  },
  hugeCardContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
    ...createShadow({ opacity: 0.4, radius: 15, height: 8 }),
  },
  smallOverlayCard: {
    position: 'absolute',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    ...createShadow({ opacity: 0.5, radius: 12, height: 6 }),
    backgroundColor: '#1a1a2e',
    zIndex: 100,
  },
  featuredTile: {
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    ...createShadow({ opacity: 0.3, radius: 12, height: 6 }),
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

  videoTile: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  videoContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoElement: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  avatarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  tileOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingTop: 30,
    justifyContent: 'flex-end',
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    maxWidth: '70%',
  },
  tileName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  youBadge: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginLeft: 4,
  },
  statusIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  tileStatusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hostBadge: {
    backgroundColor: '#FFD700',
  },
  modBadge: {
    backgroundColor: '#4f46e5',
  },
  roleText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  gridPromoteBtn: {
    position: 'absolute',
    top: '50%',
    left: '15%',
    right: '15%',
    marginTop: 30,
    borderRadius: 12,
    overflow: 'hidden',
    ...createShadow({ opacity: 0.3, radius: 8 }),
  },
  gridPromoteGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  gridPromoteText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  speakingBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#34C759',
    borderRadius: 16,
    ...createShadow({ color: '#34C759', opacity: 0.5, radius: 10 }),
  },
  waitingIndicator: {
    marginTop: 15,
    alignItems: 'center',
    gap: 4,
  },
  waitingText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
  },
  dynamicGrid: {
    padding: 4,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 150,
  },
  speakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 16,
    marginTop: 8,
  },
  speakingBar: {
    width: 3,
    backgroundColor: '#34C759',
    borderRadius: 1.5,
  },
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
    width: SCREEN_WIDTH_STATIC * 0.8,
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
    width: SCREEN_WIDTH_STATIC * 0.85,
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
  minimizedContent: {
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
  speakerView: {
    flex: 1,
    backgroundColor: '#000',
  },
  largeSpeakerContainer: {
    flex: 1,
    padding: 8,
  },
  smallParticipantsContainer: {
    height: 160,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  smallParticipantTile: {
    width: 140,
    height: 140,
    marginHorizontal: 6,
    borderRadius: 16,
    overflow: 'hidden',
    ...createShadow({ opacity: 0.3, radius: 8, height: 4 }),
  },
});

export default ChannelCallView;