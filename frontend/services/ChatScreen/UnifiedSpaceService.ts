// services/UnifiedSpaceService.ts

import axios from 'axios';
import { requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
// import { pusher } from '@/services/PusherService';
// pusher-js not imported here - use PusherService singleton instead
// import { currentUser } from '@/stores/auth';
import AuthContext from '@/context/AuthContext';
import { useContext } from 'react';

export class UnifiedSpaceService {
  // Using ONLY your existing packages:
  // @pusher/pusher-websocket-react-native - Real-time
  // expo-av - Audio/Video
  // expo-haptics - Tactile feedback
  // axios - API calls
  // zustand - State management
  // react-native-gifted-chat - Chat UI

  // Fetch all spaces (globally)
  static async fetchAllSpaces() {
    const response = await axios.get('/api/spaces');
    return response.data.spaces;
  }

  static async createSpace(type: string, options: any) {
    const currentUser = useContext(AuthContext);

    // Create any type of collaboration space
    const response = await axios.post('/api/spaces', {
      space_type: type,
      title: options.title,
      settings: this.getDefaultSettings(type),
      creator_id: currentUser.id,
      linked_conversation_id: options.conversationId,
      linked_post_id: options.postId,
      linked_story_id: options.storyId,
    });

    // Subscribe to real-time channel
    const channel = pusher.subscribe(`presence-space.${response.data.id}`);

    // Setup event handlers based on type
    this.setupSpaceHandlers(type, channel, response.data.id);

    return response.data;
  }

  private static getDefaultSettings(type: string) {
    const settings = {
      // Common settings
      allow_guests: true,
      max_participants: type === 'meeting' ? 10 : 50,
      recording_enabled: false,
      web_access_link: null,

      // Type-specific
      chat: { reactions: true, threads: false },
      meeting: { video_on_join: false, raise_hand: true },
      whiteboard: { tools: ['pen', 'shape', 'text'], grid: true },
      document: { editing_mode: 'collaborative', versioning: true },
      brainstorm: { anonymous_ideas: false, voting: true },
      voice_channel: { spatial_audio: true, noise_suppression: true },
    };

    return settings[type] || {};
  }

  // Real-time voice handling with expo-av
  static async setupVoiceChannel(spaceId: string) {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) return;

    // Create audio session
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    // Subscribe to voice activity
    const channel = pusher.subscribe(`presence-space.${spaceId}`);

    // Handle incoming voice
    channel.bind('voice-data', async (data) => {
      if (data.userId !== currentUser.id) {
        const player = useAudioPlayer(data.audioUrl);
        player.play();
      }
    });

    // Send voice data
    return {
      startSpeaking: async () => {
        const { AudioRecorder, RecordingPresets } = await import('expo-audio');
        const recording = new AudioRecorder(RecordingPresets.HIGH_QUALITY);
        await recording.record();

        // Stream via Pusher (simplified)
        setInterval(async () => {
          const uri = recording.getURI();
          if (uri) {
            pusher.trigger(`voice-${spaceId}`, 'voice-data', {
              userId: currentUser.id,
              audioUrl: uri,
              timestamp: Date.now(),
            });
          }
        }, 1000);
      },
      stopSpeaking: async () => {
        // recording is accessed via closure
      }
    };
  }
}

export default UnifiedSpaceService;

