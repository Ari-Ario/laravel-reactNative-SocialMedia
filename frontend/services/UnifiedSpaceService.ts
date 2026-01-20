// services/UnifiedSpaceService.ts
export class UnifiedSpaceService {
  // Using ONLY your existing packages:
  // @pusher/pusher-websocket-react-native - Real-time
  // expo-av - Audio/Video
  // expo-camera - Video capture
  // expo-video - Playback
  // expo-image-picker - Media selection
  // expo-haptics - Tactile feedback
  // axios - API calls
  // zustand - State management
  // react-native-gifted-chat - Chat UI

  static async createSpace(type: string, options: any) {
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
    const channel = pusher.subscribe(`space-${response.data.id}`);
    
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
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') return;
    
    // Create audio session
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });
    
    // Subscribe to voice activity
    const channel = pusher.subscribe(`voice-${spaceId}`);
    
    // Handle incoming voice
    channel.bind('voice-data', async (data) => {
      if (data.userId !== currentUser.id) {
        // Play remote audio
        const sound = new Audio.Sound();
        await sound.loadAsync({ uri: data.audioUrl });
        await sound.playAsync();
      }
    });
    
    // Send voice data
    return {
      startSpeaking: async () => {
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
        await recording.startAsync();
        
        // Stream via Pusher (simplified - in production, use proper streaming)
        setInterval(async () => {
          const uri = recording.getURI();
          if (uri) {
            // Send compressed audio chunk
            pusher.trigger(`voice-${spaceId}`, 'voice-data', {
              userId: currentUser.id,
              audioUrl: uri,
              timestamp: Date.now(),
            });
          }
        }, 1000);
      }
    };
  }
}