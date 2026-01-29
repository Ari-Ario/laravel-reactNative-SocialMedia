import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Animated, Alert,
  ActivityIndicator, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import CollaborationService from '@/services/CollaborationService';

const { width } = Dimensions.get('window');

interface CreativeGeneratorProps {
  spaceId: string;
  context: {
    type: string;
    chats?: any[];
    contacts?: any[];
    spaces?: any[];
  };
  onClose: () => void;
}

interface Idea {
  id: string;
  content: string;
  type: string;
  mood?: 'positive' | 'neutral' | 'creative' | 'analytical';
  timestamp: string;
  contributors?: string[];
  metadata?: any;
}

export const CreativeGenerator: React.FC<CreativeGeneratorProps> = ({
  spaceId,
  context,
  onClose
}) => {
  const router = useRouter();
  const [creativeModes] = useState([
    { id: 'brainstorm', name: 'Brainstorm', icon: 'flash' },
    { id: 'story-continue', name: 'Story', icon: 'book' },
    { id: 'problem-solve', name: 'Solve', icon: 'bulb' },
    { id: 'design-thinking', name: 'Design', icon: 'pencil' },
    { id: 'debate', name: 'Debate', icon: 'chatbubbles' },
    { id: 'roleplay', name: 'Roleplay', icon: 'person' },
  ]);
  
  const [activeMode, setActiveMode] = useState('brainstorm');
  const [generatedContent, setGeneratedContent] = useState<Idea[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceInput, setVoiceInput] = useState('');
  
  const collaborationService = CollaborationService.getInstance();
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize animations
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    
    // Pulse animation for recording
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const startVoiceIdeation = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Need microphone access for voice input');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await newRecording.startAsync();
      
      setRecording(newRecording);
      setIsRecording(true);
      
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        stopVoiceIdeation();
      }, 10000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopVoiceIdeation = async () => {
    if (!recording) return;
    
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setIsRecording(false);
      setRecording(null);
      
      // Generate ideas from voice
      await generateIdeasFromVoice(uri!);
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to process recording');
    }
  };

  const generateIdeasFromVoice = async (audioUri: string) => {
    setIsGenerating(true);
    
    try {
      // In a real app, you'd send the audio to your backend
      // For now, we'll simulate AI response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockIdeas = [
        {
          id: Date.now().toString(),
          content: "What if we created a visual mind map of all our conversations?",
          type: 'voice-idea',
          mood: 'creative' as const,
          timestamp: new Date().toISOString(),
          metadata: { source: 'voice', length: '5s' }
        },
        {
          id: (Date.now() + 1).toString(),
          content: "We could organize a weekly brainstorming session every Friday",
          type: 'voice-idea',
          mood: 'positive' as const,
          timestamp: new Date().toISOString(),
          metadata: { source: 'voice', length: '5s' }
        }
      ];
      
      setGeneratedContent(prev => [...mockIdeas, ...prev]);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error) {
      console.error('Error generating ideas:', error);
      Alert.alert('Error', 'Failed to generate ideas from voice');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAlternateRealities = async () => {
    setIsGenerating(true);
    
    try {
      // Query AI for alternate perspectives
      const response = await collaborationService.queryAI(
        spaceId,
        `Generate 3 alternate perspectives for: ${context.type === 'chat' ? 'chat conversations' : 'collaboration'}`,
        { context, mode: activeMode }
      );
      
      const newIdea: Idea = {
        id: Date.now().toString(),
        content: "Alternate perspectives generated:",
        type: 'alternate-realities',
        mood: 'analytical',
        timestamp: new Date().toISOString(),
        metadata: { realities: response.ai_response }
      };
      
      setGeneratedContent(prev => [newIdea, ...prev]);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error) {
      console.error('Error generating alternate realities:', error);
      Alert.alert('Error', 'Failed to generate alternate perspectives');
    } finally {
      setIsGenerating(false);
    }
  };

  const startCollaborativeStory = async () => {
    try {
      const response = await collaborationService.queryAI(
        spaceId,
        "Start a collaborative story. First sentence should be engaging and open-ended.",
        { context, mode: 'story-continue' }
      );
      
      const storyIdea: Idea = {
        id: Date.now().toString(),
        content: response.ai_response || "Once upon a time in a digital realm...",
        type: 'story-start',
        mood: 'creative',
        timestamp: new Date().toISOString(),
        contributors: ['AI'],
        metadata: { nextPrompt: 'Continue the story...' }
      };
      
      setGeneratedContent(prev => [storyIdea, ...prev]);
      
    } catch (error) {
      console.error('Error starting story:', error);
      Alert.alert('Error', 'Failed to start collaborative story');
    }
  };

  const getMoodColor = (mood?: string): string => {
    const moodColors: Record<string, string> = {
      positive: '#4ECDC4',
      neutral: '#95E1D3',
      creative: '#F38181',
      analytical: '#AA96DA',
    };
    return moodColors[mood || 'neutral'] || '#4ECDC4';
  };

  const renderIdeaCard = (idea: Idea, index: number) => {
    const cardAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
      Animated.spring(cardAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: index * 100,
        useNativeDriver: true,
      }).start();
    }, []);
    
    return (
      <Animated.View 
        key={idea.id}
        style={[
          styles.ideaCard,
          {
            opacity: cardAnim,
            transform: [{
              translateY: cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0]
              })
            }]
          }
        ]}
      >
        <View style={styles.ideaHeader}>
          <View style={[styles.moodIndicator, { backgroundColor: getMoodColor(idea.mood) }]} />
          <Text style={styles.ideaType}>{idea.type.replace('-', ' ')}</Text>
          <Text style={styles.ideaTime}>
            {new Date(idea.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        
        <Text style={styles.ideaText}>{idea.content}</Text>
        
        {idea.contributors && (
          <View style={styles.contributors}>
            <Ionicons name="people" size={14} color="#666" />
            <Text style={styles.contributorText}>
              {idea.contributors.join(', ')}
            </Text>
          </View>
        )}
        
        <View style={styles.ideaActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Idea Saved', 'Added to your ideas collection');
            }}
          >
            <Ionicons name="heart-outline" size={18} color="#FF6B6B" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              // Share idea
            }}
          >
            <Ionicons name="arrow-redo-outline" size={18} color="#45B7D1" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              // Create space from idea
              Alert.alert(
                'Create Space',
                'Create a collaboration space from this idea?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Create', onPress: () => {
                    router.push({
                      pathname: '/(spaces)/create',
                      params: { idea: idea.content }
                    });
                    onClose();
                  }}
                ]
              );
            }}
          >
            <Ionicons name="cube-outline" size={18} color="#4ECDC4" />
            <Text style={styles.actionText}>Create Space</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Ionicons name="sparkles" size={24} color="#FFD700" />
          <Text style={styles.headerTitle}>Creative Generator</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.helpButton}
          onPress={() => Alert.alert('Help', 'Generate creative ideas using different modes. Try voice input for spontaneous ideas!')}
        >
          <Ionicons name="help-circle" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Mode Selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.modeSelector}
        contentContainerStyle={styles.modeSelectorContent}
      >
        {creativeModes.map(mode => (
          <TouchableOpacity
            key={mode.id}
            style={[
              styles.modeButton,
              activeMode === mode.id && styles.activeModeButton
            ]}
            onPress={() => setActiveMode(mode.id)}
          >
            <View style={[
              styles.modeIconContainer,
              activeMode === mode.id && styles.activeModeIcon
            ]}>
              <Ionicons name={mode.icon as any} size={22} color="#fff" />
            </View>
            <Text style={[
              styles.modeText,
              activeMode === mode.id && styles.activeModeText
            ]}>
              {mode.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Voice Recording Indicator */}
      {isRecording && (
        <Animated.View 
          style={[
            styles.recordingIndicator,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording... Speak your ideas</Text>
          <TouchableOpacity onPress={stopVoiceIdeation}>
            <Ionicons name="stop-circle" size={28} color="#FF6B6B" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Generated Content */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.contentArea}
        contentContainerStyle={styles.contentAreaContent}
        showsVerticalScrollIndicator={false}
      >
        {isGenerating && (
          <View style={styles.generatingContainer}>
            <ActivityIndicator size="large" color="#45B7D1" />
            <Text style={styles.generatingText}>Generating creative ideas...</Text>
          </View>
        )}

        {generatedContent.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bulb-outline" size={80} color="#333" />
            <Text style={styles.emptyTitle}>No ideas yet</Text>
            <Text style={styles.emptyDescription}>
              Tap on a mode and generate ideas using voice or AI
            </Text>
          </View>
        ) : (
          generatedContent.map((idea, index) => renderIdeaCard(idea, index))
        )}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={[
            styles.controlButton,
            isRecording && styles.controlButtonActive
          ]}
          onPress={isRecording ? stopVoiceIdeation : startVoiceIdeation}
          disabled={isGenerating}
        >
          <Animated.View style={isRecording && { transform: [{ scale: pulseAnim }] }}>
            <Ionicons 
              name={isRecording ? "stop" : "mic"} 
              size={24} 
              color={isRecording ? "#FF6B6B" : "#fff"} 
            />
          </Animated.View>
          <Text style={styles.controlText}>
            {isRecording ? 'Stop' : 'Voice'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={generateAlternateRealities}
          disabled={isGenerating || isRecording}
        >
          <Ionicons name="git-branch" size={24} color="#fff" />
          <Text style={styles.controlText}>Perspectives</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={startCollaborativeStory}
          disabled={isGenerating || isRecording}
        >
          <Ionicons name="book" size={24} color="#fff" />
          <Text style={styles.controlText}>Story</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => {
            setGeneratedContent([]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <Ionicons name="refresh" size={24} color="#fff" />
          <Text style={styles.controlText}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 4,
    fontWeight: '500',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  helpButton: {
    padding: 4,
  },
  modeSelector: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
  },
  modeSelectorContent: {
    paddingHorizontal: 12,
  },
  modeButton: {
    alignItems: 'center',
    marginHorizontal: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  activeModeButton: {
    backgroundColor: '#333',
  },
  modeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeModeIcon: {
    backgroundColor: '#45B7D1',
  },
  modeText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  activeModeText: {
    color: '#fff',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B6B',
    marginRight: 8,
  },
  recordingText: {
    flex: 1,
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
  },
  contentArea: {
    flex: 1,
  },
  contentAreaContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  generatingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyDescription: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  ideaCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  ideaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  moodIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  ideaType: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ideaTime: {
    color: '#666',
    fontSize: 12,
  },
  ideaText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  contributors: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contributorText: {
    color: '#666',
    fontSize: 12,
    marginLeft: 6,
  },
  ideaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    color: '#4ECDC4',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  controlButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#333',
    minWidth: 70,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  controlText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default CreativeGenerator;