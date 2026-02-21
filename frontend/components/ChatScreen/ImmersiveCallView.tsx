import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import CollaborationService from '@/services/ChatScreen/CollaborationService';
import WebRTCService from '@/services/ChatScreen/WebRTCService';
import { useSpaceStore } from '@/stores/spaceStore';
import Avatar from '@/components/Image/Avatar';
import AuthContext from '@/context/AuthContext';
import { Camera } from 'expo-camera';

const { width } = Dimensions.get('window');

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
}

interface CallResponse {
  call?: {
    id: string;
    initiator_id: number;
    type: string;
    status: string;
  };
  space?: {
    id: string;
    title: string;
    participants: any[];
  };
  message?: string;
}

const ImmersiveCallView: React.FC<{ spaceId: string }> = ({ spaceId }) => {
  const router = useRouter();
  const collaborationService = CollaborationService.getInstance();
  const webRTCService = WebRTCService.getInstance();
  const { currentSpace } = useSpaceStore();
  const { user } = useContext(AuthContext);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');

  // Camera related state (native only)
  const cameraRef = useRef<any>(null);
  const [cameraType, setCameraType] = useState<string>('front');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasAudioPermission, setHasAudioPermission] = useState<boolean | null>(null);

  const durationInterval = useRef<NodeJS.Timeout>();
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Animation for spinning icon
  const spinValue = useSharedValue(0);

  const spinAnimation = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${spinValue.value}deg` }],
    };
  });

  // Effect for spinning icon
  useEffect(() => {
    if (callStatus === 'connecting') {
      spinValue.value = withRepeat(
        withTiming(360, {
          duration: 1000,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      spinValue.value = 0;
    }
  }, [callStatus]);

  // Request permissions on native
  useEffect(() => {
    if (Platform.OS !== 'web') {
      requestPermissions();
    }
  }, []);

  const requestPermissions = async () => {
    try {
      // Camera permission
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(cameraStatus === 'granted');

      // Audio permission
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      setHasAudioPermission(audioStatus === 'granted');

      // Set audio mode for calls
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  useEffect(() => {
    initializeCall();
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      webRTCService.cleanup();
    };
  }, [spaceId]);


  // Add this helper function:
  const safeHaptics = {
    success: async () => {
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.warn('Haptics success not available');
        }
      }
    },
    warning: async () => {
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch (error) {
          console.warn('Haptics warning not available');
        }
      }
    },
    impact: async (style = Haptics.ImpactFeedbackStyle.Light) => {
      if (Platform.OS !== 'web') {
        try {
          await Haptics.impactAsync(style);
        } catch (error) {
          console.warn('Haptics impact not available');
        }
      }
    },
  };

  const initializeCall = async () => {
    try {
      // Check permissions on native
      if (Platform.OS !== 'web') {
        if (hasCameraPermission === false || hasAudioPermission === false) {
          Alert.alert(
            'Permissions Required',
            'Camera and microphone permissions are needed for video calls.',
            [
              { text: 'Continue with Audio Only', onPress: () => setHasVideo(false) },
              { text: 'Settings', onPress: () => requestPermissions() },
              { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
            ]
          );
        }
      }

      // Initialize WebRTC service
      await webRTCService.initialize(user?.id || 0);

      console.log('Starting call for space:', spaceId);

      // Start call or join existing
      const response = await collaborationService.startCall(spaceId, 'video') as CallResponse;

      // Handle response structure
      let callData;
      let spaceData;

      if (response.call) {
        callData = response.call;
        spaceData = response.space;
      } else {
        callData = response;
        spaceData = response.space || currentSpace;
      }

      if (!callData || !callData.id) {
        console.error('Invalid call response:', response);
        throw new Error('Failed to get call information');
      }

      setCallId(callData.id);
      setCallStatus('connecting');

      // Check if this user is the initiator
      setIsInitiator(callData.initiator_id === user?.id);

      // Set up participants from space data
      if (spaceData?.participants) {
        const participantList: Participant[] = spaceData.participants.map((p: any) => ({
          id: p.user_id?.toString() || p.id?.toString() || Math.random().toString(),
          user_id: p.user_id || p.id || 0,
          name: p.user?.name || p.name || 'Participant',
          avatar: p.user?.profile_photo || p.profile_photo,
          role: p.role || 'participant',
          isMuted: false,
          hasVideo: true,
          isSharingScreen: false,
        }));
        setParticipants(participantList);
      } else if (currentSpace?.participants) {
        const participantList: Participant[] = currentSpace.participants.map((p: any) => ({
          id: p.user_id?.toString() || p.id?.toString(),
          user_id: p.user_id || p.id,
          name: p.user?.name || p.name || 'Participant',
          avatar: p.user?.profile_photo || p.profile_photo,
          role: p.role || 'participant',
          isMuted: false,
          hasVideo: true,
          isSharingScreen: false,
        }));
        setParticipants(participantList);
      }

      // Join the call
      await webRTCService.joinCall(spaceId, callData.id, isInitiator);

      // Get local stream
      const stream = await webRTCService.getLocalStream(hasVideo, true);
      setLocalStream(stream);
      setCallStatus('connected');

      // Set up local video if available (web only)
      if (Platform.OS === 'web') {
        const localVideo = videoRefs.current.get('local');
        if (localVideo) {
          localVideo.srcObject = stream;
        }
      }

      // Start duration timer
      durationInterval.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // Set up WebRTC callbacks (web only)
      // if (Platform.OS === 'web') {
      webRTCService.onRemoteStream((userId: string, stream: MediaStream) => {
        console.log(`📞 Remote stream received from ${userId} on ${Platform.OS}`);
        setParticipants(prev => prev.map(p =>
          p.id === userId
            ? { ...p, stream, hasVideo: true }
            : p
        ));

        // For web, attach to video element
        if (Platform.OS === 'web') {
          const video = videoRefs.current.get(userId);
          if (video) {
            video.srcObject = stream;
          }
        }
        // For native, we just update state - the video will be handled by the native UI
      });

      webRTCService.onParticipantLeft((userId: string) => {
        console.log(`📞 Participant left: ${userId}`);
        setParticipants(prev => prev.filter(p => p.id !== userId));
        if (Platform.OS === 'web') {
          videoRefs.current.delete(userId);
        }
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

      webRTCService.onCallEnded(() => {
        endCall();
      });

      // If this is the initiator, create offers for all other participants
      if (isInitiator) {
        setTimeout(() => {
          participants.forEach(p => {
            if (p.user_id !== user?.id) {
              webRTCService.createOffer(p.user_id);
            }
          });
        }, 2000);
      }
      // }

      await safeHaptics.success();
    } catch (error) {
      console.error('Error initializing call:', error);
      Alert.alert('Error', 'Failed to start call. Please try again.');
    }
  };

  // 📱 Renders video differently for web vs native
  const renderVideoElement = (participant: Participant, isLocal: boolean = false) => {
    if (Platform.OS === 'web') {
      // 🌐 WEB: Use HTML5 video element
      return (
        <video
          ref={(el) => {
            if (el) videoRefs.current.set(participant.id, el);
          }}
          autoPlay
          playsInline
          muted={isLocal}
          style={isLocal ? styles.localVideo : styles.remoteVideo}
        />
      );
    } else {
      // 📱 REACT NATIVE: Use RTCView from react-native-webrtc
      // This is a simplified version - you'll need to implement proper RTCView
      return (
        <View style={isLocal ? styles.localVideoPlaceholder : styles.remoteVideoPlaceholder}>
          {participant.stream ? (
            // If you have a real stream, use RTCView
            // <RTCView streamURL={participant.stream.toURL()} style={styles.rtcView} />
            <View style={styles.videoPlaceholder}>
              <Ionicons name="videocam" size={40} color="#666" />
              <Text style={styles.placeholderText}>
                {participant.name} {isLocal ? '(You)' : ''}
              </Text>
            </View>
          ) : (
            <View style={styles.avatarContainer}>
              <Avatar
                source={participant.avatar}
                size={isLocal ? 60 : 120}
                name={participant.name}
              />
              <Text style={styles.participantName}>
                {participant.name} {isLocal ? '(You)' : ''}
              </Text>
            </View>
          )}
          {participant.isMuted && (
            <View style={styles.mutedBadge}>
              <Ionicons name="mic-off" size={16} color="#fff" />
            </View>
          )}
        </View>
      );
    }
  };

  const flipCamera = async () => {
    if (Platform.OS !== 'web') {
      setCameraType(prev => prev === 'front' ? 'back' : 'front');
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.warn('Haptics error:', error);
      }
    }
  };

  const toggleMute = async () => {
    try {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      await webRTCService.toggleMute(newMuteState);

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.warn('Haptics error:', error);
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const toggleVideo = async () => {
    try {
      const newVideoState = !hasVideo;
      setHasVideo(newVideoState);
      await webRTCService.toggleVideo(newVideoState);

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        console.warn('Haptics error:', error);
      }
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  };

  const toggleScreenShare = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Screen Sharing', 'Screen sharing is only available on web platform.');
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

      try {
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.warn('Haptics error:', error);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      setIsSharingScreen(false);
    }
  };

  const endCall = async () => {
    try {
      setCallStatus('ended');

      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }

      await webRTCService.endCall();

      if (callId) {
        await collaborationService.endCall(spaceId, callId);
      }

      await safeHaptics.success();

      router.replace({
        pathname: '/(spaces)/[id]',
        params: { id: spaceId }
      });

    } catch (error) {
      console.error('Error ending call:', error);
      router.replace({
        pathname: '/(spaces)/[id]',
        params: { id: spaceId }
      });
    }
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderVideoGrid = () => {
    if (callStatus === 'connecting') {
      return (
        <View style={styles.waitingContainer}>
          <Animated.View style={[styles.spinningIcon, spinAnimation]}>
            <Ionicons name="sync" size={64} color="#666" />
          </Animated.View>
          <Text style={styles.waitingText}>Connecting to call...</Text>
          <Text style={styles.waitingSubtext}>
            Please wait while we establish the connection
          </Text>
        </View>
      );
    }

    if (participants.length === 0) {
      return (
        <View style={styles.waitingContainer}>
          <Ionicons name="videocam" size={64} color="#666" />
          <Text style={styles.waitingText}>Waiting for participants...</Text>
          <Text style={styles.waitingSubtext}>
            Share the invitation link to invite others
          </Text>
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => Alert.alert('Invite', 'Share this space link with others')}
          >
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={styles.inviteButtonText}>Invite Participants</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // For 1:1 call, show large view with picture-in-picture
    if (participants.length === 2) {
      const otherParticipant = participants.find(p =>
        p.user_id.toString() !== user?.id?.toString()
      );

      return (
        <View style={styles.oneOnOneContainer}>
          {/* Remote participant - full screen */}
          {otherParticipant && (
            <View style={styles.remoteVideoContainer}>
              {Platform.OS === 'web' && otherParticipant.stream ? (
                renderVideoElement(otherParticipant, false)
              ) : (
                <View style={styles.remoteAvatarContainer}>
                  <Avatar
                    source={otherParticipant.avatar}
                    size={120}
                    name={otherParticipant.name}
                  />
                  <View style={styles.remoteInfoContainer}>
                    <Text style={styles.remoteName}>{otherParticipant.name}</Text>
                    <View style={styles.remoteStatus}>
                      <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                      <Text style={styles.statusText}>Connected</Text>
                    </View>
                  </View>
                </View>
              )}

              {otherParticipant?.isMuted && (
                <View style={styles.remoteMutedBadge}>
                  <Ionicons name="mic-off" size={16} color="#fff" />
                  <Text style={styles.mutedText}>Muted</Text>
                </View>
              )}

              {otherParticipant?.isSharingScreen && Platform.OS === 'web' && (
                <View style={styles.remoteScreenShareBadge}>
                  <Ionicons name="desktop" size={16} color="#fff" />
                  <Text style={styles.screenShareText}>Sharing Screen</Text>
                </View>
              )}
            </View>
          )}

          {/* Local participant - picture in picture */}
          <View style={styles.localVideoContainer}>
            {Platform.OS === 'web' && localStream ? (
              renderVideoElement({ id: 'local', user_id: user?.id || 0 } as Participant, true)
            ) : (
              <>
                {renderVideoElement({ id: 'local', user_id: user?.id || 0 } as Participant, true)}
                {!isCameraReady && Platform.OS !== 'web' && (
                  <View style={styles.cameraLoadingOverlay}>
                    <Ionicons name="camera" size={24} color="#fff" />
                    <Text style={styles.cameraLoadingText}>Camera loading...</Text>
                  </View>
                )}
              </>
            )}
            <View style={styles.localVideoOverlay}>
              <Text style={styles.localVideoText}>You</Text>
              <View style={styles.localBadges}>
                {isMuted && (
                  <View style={styles.localMutedBadge}>
                    <Ionicons name="mic-off" size={12} color="#fff" />
                  </View>
                )}
                {!hasVideo && (
                  <View style={styles.localVideoOffBadge}>
                    <Ionicons name="videocam-off" size={12} color="#fff" />
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      );
    }

    // Group call - grid layout
    return (
      <ScrollView contentContainerStyle={styles.gridContainer}>
        {participants.map((participant) => (
          <View key={participant.id} style={styles.gridItem}>
            {Platform.OS === 'web' && participant.stream ? (
              <>
                {renderVideoElement(participant, false)}
                <View style={styles.gridOverlay}>
                  <Text style={styles.gridName}>{participant.name}</Text>
                  {participant.isMuted && (
                    <Ionicons name="mic-off" size={14} color="#FF6B6B" />
                  )}
                </View>
              </>
            ) : (
              <View style={styles.gridAvatarContainer}>
                <Avatar
                  source={participant.avatar}
                  size={60}
                  name={participant.name}
                />
                <Text style={styles.gridName}>{participant.name}</Text>
                {participant.isMuted && (
                  <View style={styles.gridMutedBadge}>
                    <Ionicons name="mic-off" size={12} color="#fff" />
                  </View>
                )}
                {!participant.hasVideo && Platform.OS !== 'web' && (
                  <View style={styles.gridVideoOffBadge}>
                    <Ionicons name="videocam-off" size={12} color="#fff" />
                  </View>
                )}
              </View>
            )}
            {participant.isSharingScreen && Platform.OS === 'web' && (
              <View style={styles.gridShareBadge}>
                <Ionicons name="desktop" size={12} color="#fff" />
                <Text style={styles.gridShareText}>Screen</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  const localParticipant = participants.find(p =>
    p.user_id === user?.id
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={endCall} style={styles.backButton}>
          <Ionicons name="chevron-down" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.spaceTitle} numberOfLines={1}>
            {currentSpace?.title || 'Call'}
          </Text>
          <View style={styles.callInfo}>
            <View
              style={[
                styles.callStatusDot,
                callStatus === 'connected'
                  ? styles.callStatusConnected
                  : styles.callStatusConnecting
              ]}
            />
            <Text style={styles.callDuration}>
              {formatDuration(callDuration)}
            </Text>
            <Text style={styles.participantCount}>
              • {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => Alert.alert(
            'Call Options',
            'View participants, recording, or settings',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Participants',
                onPress: () => Alert.alert(
                  'Participants',
                  participants.map(p => `• ${p.name}${p.user_id === user?.id ? ' (You)' : ''}`).join('\n')
                )
              },
              { text: 'Record', onPress: () => Alert.alert('Recording', 'Call recording coming soon!') },
              { text: 'Settings', onPress: () => Alert.alert('Settings', 'Call settings coming soon!') },
            ]
          )}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Video Grid */}
      <View style={styles.videoContainer}>
        {renderVideoGrid()}
      </View>

      {/* Call Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={toggleMute}
          >
            <Ionicons
              name={isMuted ? "mic-off" : "mic"}
              size={24}
              color={isMuted ? "#FF6B6B" : "#fff"}
            />
            <Text style={styles.controlLabel}>
              {isMuted ? 'Unmute' : 'Mute'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, !hasVideo && styles.controlButtonActive]}
            onPress={toggleVideo}
          >
            <Ionicons
              name={hasVideo ? "videocam" : "videocam-off"}
              size={24}
              color={hasVideo ? "#fff" : "#FF6B6B"}
            />
            <Text style={styles.controlLabel}>
              {hasVideo ? 'Video' : 'No Video'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isSharingScreen && styles.controlButtonActive]}
            onPress={toggleScreenShare}
          >
            <Ionicons
              name={isSharingScreen ? "close-circle" : "share-social"}
              size={24}
              color={isSharingScreen ? "#FF6B6B" : "#fff"}
            />
            <Text style={styles.controlLabel}>
              {isSharingScreen ? 'Stop Share' : 'Share'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={endCall}
          >
            <Ionicons name="call" size={24} color="#fff" />
            <Text style={[styles.controlLabel, styles.endCallLabel]}>
              End
            </Text>
          </TouchableOpacity>
        </View>

        {/* Additional Controls */}
        <View style={styles.additionalControls}>
          <TouchableOpacity
            style={styles.additionalButton}
            onPress={Platform.OS === 'web'
              ? () => Alert.alert('Flip Camera', 'Camera flip coming soon for web!')
              : flipCamera
            }
          >
            <Ionicons name="camera-reverse" size={20} color="#fff" />
            <Text style={styles.additionalButtonText}>Flip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.additionalButton}
            onPress={() => Alert.alert('Chat', 'Open chat during call')}
          >
            <Ionicons name="chatbubble" size={20} color="#fff" />
            <Text style={styles.additionalButtonText}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.additionalButton}
            onPress={() => Alert.alert('Raise Hand', 'Hand raised!')}
          >
            <Ionicons name="hand-left" size={20} color="#fff" />
            <Text style={styles.additionalButtonText}>Raise</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.additionalButton}
            onPress={() => Alert.alert('Invite', 'Share this space link with others')}
          >
            <Ionicons name="people" size={20} color="#fff" />
            <Text style={styles.additionalButtonText}>Invite</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.additionalButton}
            onPress={() => Alert.alert('Record', 'Call recording coming soon!')}
          >
            <Ionicons name="recording" size={20} color="#fff" />
            <Text style={styles.additionalButtonText}>Record</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.additionalButton}
            onPress={() => Alert.alert('More', 'More options coming soon!')}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
            <Text style={styles.additionalButtonText}>More</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  spaceTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  callInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  callStatusConnected: {
    backgroundColor: '#4CAF50',
  },
  callStatusConnecting: {
    backgroundColor: '#FFA726',
  },
  callDuration: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  participantCount: {
    color: '#999',
    fontSize: 14,
    marginLeft: 8,
  },
  moreButton: {
    padding: 8,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  spinningIcon: {
    transform: [{ rotate: '0deg' }],
  },
  waitingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  waitingSubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  oneOnOneContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  remoteAvatarContainer: {
    alignItems: 'center',
  },
  remoteName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  remoteStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    color: '#4CAF50',
    fontSize: 14,
  },
  remoteMutedBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mutedText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  remoteScreenShareBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  screenShareText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  localVideoContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  localVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  localVideoOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  localVideoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  localMutedBadge: {
    marginLeft: 4,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  localVideoOffBadge: {
    marginLeft: 4,
    backgroundColor: '#666',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  gridItem: {
    width: width / 2 - 16,
    height: 200,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  gridVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridAvatarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  gridMutedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridShareBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gridShareText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 4,
    fontWeight: '500',
  },
  controlsContainer: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  controlButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#333',
    minWidth: 80,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  controlLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  endCallButton: {
    backgroundColor: '#FF6B6B',
  },
  endCallLabel: {
    color: '#fff',
  },
  additionalControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  additionalButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  additionalButtonText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
  },
  // 📱 ADD THESE STYLES for React Native camera
  cameraPreview: {
    width: '100%',
    height: '100%',
  },
  cameraLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraLoadingText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
  },
  remoteAvatarLarge: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  remoteNameContainer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  remoteNameLarge: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  remoteStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  remoteStatusText: {
    color: '#4CAF50',
    fontSize: 16,
    marginLeft: 6,
  },
  remoteInfoContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  localBadges: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  gridVideoOffBadge: {
    position: 'absolute',
    top: 40,
    right: 8,
    backgroundColor: '#666',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  cameraFallbackText: {
    color: '#666',
    marginTop: 8,
    fontSize: 14,
  },
  localVideoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  localStatus: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  localNameText: {
    color: '#fff',
    fontSize: 12,
    marginRight: 4,
  },

  remoteVideoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    alignItems: 'center',
  },
  rtcView: {
    width: '100%',
    height: '100%',
  },
  avatarContainer: {
    alignItems: 'center',
  },
  participantName: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
  },
  mutedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF6B6B',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ImmersiveCallView;