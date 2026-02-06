// components/Calls/ImmersiveCallView.tsx
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { Camera, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Audio, Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useParticipantsStore } from '@/stores/participantsStore';

export const ImmersiveCallView: React.FC<{ spaceId: string }> = ({ spaceId }) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  
  const { participants: storeParticipants } = useParticipantsStore();
  const audioPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    initSpatialAudio();
    initVirtualPositions();
  }, []);

  const initSpatialAudio = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });

    // Create 3D audio context
    const soundObject = new Audio.Sound();
    
    // Set up spatial audio based on participant positions
    setInterval(() => updateAudioSpatialization(), 100);
  };

  const initVirtualPositions = () => {
    const positions = {};
    storeParticipants.forEach((participant, index) => {
      const angle = (index / storeParticipants.length) * Math.PI * 2;
      positions[participant.id] = {
        x: Math.cos(angle) * 200 + 200,
        y: Math.sin(angle) * 200 + 200,
      };
    });
    audioPositions.current = new Map(Object.entries(positions));
  };

  const updateAudioSpatialization = () => {
    storeParticipants.forEach(participant => {
      const pos = audioPositions.current.get(participant.id);
      if (pos) {
        const distance = Math.sqrt(pos.x ** 2 + pos.y ** 2);
        const volume = Math.max(0.1, 1 - distance / 400);
        console.log(`Adjusting volume for ${participant.name}: ${volume}`);
      }
    });
  };

  const startScreenShare = async () => {
    setIsSharingScreen(true);
    setInterval(async () => {
      // Capture screen frames
      // Broadcast via Pusher
    }, 200);
  };

  const addARFilter = async (filter: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log(`Applying ${filter} filter`);
  };

  const startVoiceTranscription = async () => {
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
    );
    await recording.startAsync();
    
    // Process audio chunks for transcription
  };

  return (
    <View style={styles.container}>
      {/* Main video grid */}
      <View style={styles.videoGrid}>
        {storeParticipants.map((participant, index) => (
          <Animated.View 
            key={participant.id}
            style={[
              styles.videoTile,
              {
                left: audioPositions.current.get(participant.id)?.x || 0,
                top: audioPositions.current.get(participant.id)?.y || 0,
              }
            ]}
          >
            <Video
              source={{ uri: participant.videoStream }}
              style={styles.video}
              resizeMode="cover"
            />
            <View style={styles.participantInfo}>
              <Text style={styles.participantName}>{participant.name}</Text>
              <View style={styles.audioIndicator}>
                <View
                  style={[
                    styles.audioLevel,
                    { width: Math.random() * 30 + 10 }
                  ]}
                />
              </View>
            </View>

            {participant.arFilter && (
              <View style={styles.arBadge}>
                <Ionicons name={getFilterIcon(participant.arFilter)} size={12} />
              </View>
            )}
          </Animated.View>
        ))}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, !isCameraOn && styles.controlButtonOff]}
          onPress={() => setIsCameraOn(!isCameraOn)}
        >
          <Ionicons name={isCameraOn ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isMicOn && styles.controlButtonOff]}
          onPress={() => setIsMicOn(!isMicOn)}
        >
          <Ionicons name={isMicOn ? 'mic' : 'mic-off'} size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isSharingScreen && styles.controlButtonActive]}
          onPress={startScreenShare}
        >
          <Ionicons name="share" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => addARFilter('sparkles')}
        >
          <Ionicons name="sparkles" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={startVoiceTranscription}
        >
          <Ionicons name="text" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* AI Meeting Assistant Overlay */}
      <View style={styles.aiOverlay}>
        <Text style={styles.aiText}>
          🎙️ Meeting Summary: Discussing project timeline...
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181818',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoGrid: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  videoTile: {
    position: 'absolute',
    width: 120,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#222',
    borderWidth: 2,
    borderColor: '#444',
  },
  video: {
    width: '100%',
    height: '70%',
    backgroundColor: '#000',
  },
  participantInfo: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  audioIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioLevel: {
    height: 8,
    backgroundColor: '#4caf50',
    borderRadius: 4,
  },
  arBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(20,20,20,0.8)',
    borderRadius: 16,
    marginBottom: 16,
  },
  controlButton: {
    marginHorizontal: 8,
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 24,
  },
  controlButtonOff: {
    backgroundColor: '#b71c1c',
  },
  controlButtonActive: {
    backgroundColor: '#1976d2',
  },
  aiOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(40,40,40,0.95)',
    alignItems: 'center',
  },
  aiText: {
    color: '#fff',
    fontSize: 15,
    fontStyle: 'italic',
  },
});