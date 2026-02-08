import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import CollaborationService from '@/services/ChatScreen/CollaborationService';

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

interface CreativeMode {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

const CreativeGenerator: React.FC<CreativeGeneratorProps> = ({
  spaceId,
  context,
  onClose,
}) => {
  const router = useRouter();
  
  const creativeModes: CreativeMode[] = [
    { id: 'brainstorm', name: 'Brainstorm', icon: 'flash', description: 'Generate creative ideas', color: '#4ECDC4' },
    { id: 'story-continue', name: 'Story', icon: 'book', description: 'Continue collaborative stories', color: '#F38181' },
    { id: 'problem-solve', name: 'Solve', icon: 'bulb', description: 'Find solutions to problems', color: '#FFD166' },
    { id: 'design-thinking', name: 'Design', icon: 'pencil', description: 'Design thinking exercises', color: '#06D6A0' },
    { id: 'debate', name: 'Debate', icon: 'chatbubbles', description: 'Constructive debate topics', color: '#118AB2' },
    { id: 'roleplay', name: 'Roleplay', icon: 'person', description: 'Role-playing scenarios', color: '#EF476F' },
  ];
  
  const [activeMode, setActiveMode] = useState<CreativeMode>(creativeModes[0]);
  const [generatedContent, setGeneratedContent] = useState<Idea[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceInput, setVoiceInput] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  
  const collaborationService = CollaborationService.getInstance();
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Animation refs for each idea card
  const ideaAnimations = useRef<Map<string, Animated.Value>>(new Map());

  // Initialize animations
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Animation for recording
  useEffect(() => {
    if (isRecording) {
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
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

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
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingTime(0);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 10) {
            stopVoiceIdeation();
            return 10;
          }
          return prev + 1;
        });
      }, 1000);
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        stopVoiceIdeation();
      }, 10000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopVoiceIdeation = async () => {
    if (!recording) return;
    
    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setIsRecording(false);
      setRecording(null);
      
      if (uri) {
        await generateIdeasFromVoice(uri);
      }
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to process recording');
    }
  };

  const generateIdeasFromVoice = async (audioUri: string) => {
    setIsGenerating(true);
    
    try {
      // Mock implementation - replace with actual AI service
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockIdeas: Idea[] = [
        {
          id: `voice_${Date.now()}`,
          content: "What if we created a visual mind map to organize all our conversation topics?",
          type: 'voice-idea',
          mood: 'creative' as const,
          timestamp: new Date().toISOString(),
          metadata: { source: 'voice', duration: `${recordingTime}s` }
        },
        {
          id: `voice_${Date.now() + 1}`,
          content: "We could schedule weekly brainstorming sessions every Friday at 3 PM",
          type: 'voice-idea',
          mood: 'positive' as const,
          timestamp: new Date().toISOString(),
          metadata: { source: 'voice', duration: `${recordingTime}s` }
        }
      ];
      
      // Initialize animation for each new idea
      mockIdeas.forEach(idea => {
        ideaAnimations.current.set(idea.id, new Animated.Value(0));
      });
      
      setGeneratedContent(prev => [...mockIdeas, ...prev]);
      
      // Animate new ideas in
      setTimeout(() => {
        mockIdeas.forEach(idea => {
          const anim = ideaAnimations.current.get(idea.id);
          if (anim) {
            Animated.spring(anim, {
              toValue: 1,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }).start();
          }
        });
      }, 100);
      
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
      // Use actual spaceId, not "global"
      const actualSpaceId = spaceId && spaceId !== 'global' ? spaceId : undefined;
      
      if (!actualSpaceId) {
        // Generate mock data if no spaceId
        const mockRealities = [
          "What if we approached this from an optimistic perspective where everything goes perfectly?",
          "Consider the pessimistic view - what are the potential challenges and how can we mitigate them?",
          "From a radically creative angle, what if we combined this with completely unrelated concepts?"
        ];
        
        const newIdea: Idea = {
          id: `realities_${Date.now()}`,
          content: "Alternate perspectives generated:\n\n• " + mockRealities.join("\n\n• "),
          type: 'alternate-realities',
          mood: 'analytical',
          timestamp: new Date().toISOString(),
          metadata: { 
            realities: mockRealities,
            generatedAt: new Date().toISOString()
          }
        };
        
        ideaAnimations.current.set(newIdea.id, new Animated.Value(0));
        setGeneratedContent(prev => [newIdea, ...prev]);
        
        setTimeout(() => {
          const anim = ideaAnimations.current.get(newIdea.id);
          if (anim) {
            Animated.spring(anim, {
              toValue: 1,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }).start();
          }
        }, 100);
        
      } else {
        // Use actual AI query
        const response = await collaborationService.queryAI(
          actualSpaceId,
          `Generate 3 alternate perspectives for: ${context.type === 'chat' ? 'chat conversations' : 'collaboration'}`,
          { 
            context, 
            mode: activeMode.id,
            requestType: 'alternate_perspectives'
          },
          'generate_perspectives'
        );
        
        const newIdea: Idea = {
          id: `realities_${Date.now()}`,
          content: response.ai_response || "Alternate perspectives generated",
          type: 'alternate-realities',
          mood: 'analytical',
          timestamp: new Date().toISOString(),
          metadata: { 
            response,
            generatedAt: new Date().toISOString()
          }
        };
        
        ideaAnimations.current.set(newIdea.id, new Animated.Value(0));
        setGeneratedContent(prev => [newIdea, ...prev]);
        
        setTimeout(() => {
          const anim = ideaAnimations.current.get(newIdea.id);
          if (anim) {
            Animated.spring(anim, {
              toValue: 1,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }).start();
          }
        }, 100);
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error: any) {
      console.error('Error generating alternate realities:', error);
      
      // Provide fallback content
      const fallbackIdea: Idea = {
        id: `fallback_${Date.now()}`,
        content: "Try looking at this from different angles:\n\n1. The Optimist: Everything works perfectly\n2. The Realist: Practical considerations\n3. The Innovator: Radical new approaches",
        type: 'alternate-realities',
        mood: 'analytical',
        timestamp: new Date().toISOString(),
      };
      
      ideaAnimations.current.set(fallbackIdea.id, new Animated.Value(0));
      setGeneratedContent(prev => [fallbackIdea, ...prev]);
      
      setTimeout(() => {
        const anim = ideaAnimations.current.get(fallbackIdea.id);
        if (anim) {
          Animated.spring(anim, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }).start();
        }
      }, 100);
      
    } finally {
      setIsGenerating(false);
    }
  };

  const startCollaborativeStory = async () => {
    setIsGenerating(true);
    
    try {
      // Use actual spaceId, not "global"
      const actualSpaceId = spaceId && spaceId !== 'global' ? spaceId : undefined;
      
      if (!actualSpaceId) {
        // Mock story start
        const storyStart = "In a world where ideas take physical form, a group of collaborators discovered a mysterious glowing artifact that responded to their collective creativity...";
        
        const storyIdea: Idea = {
          id: `story_${Date.now()}`,
          content: storyStart,
          type: 'story-start',
          mood: 'creative',
          timestamp: new Date().toISOString(),
          contributors: ['AI'],
          metadata: { 
            nextPrompt: 'What happens when they touch the artifact?',
            storySeed: 'mysterious_artifact'
          }
        };
        
        ideaAnimations.current.set(storyIdea.id, new Animated.Value(0));
        setGeneratedContent(prev => [storyIdea, ...prev]);
        
      } else {
        // Use actual AI query
        const response = await collaborationService.queryAI(
          actualSpaceId,
          "Start a collaborative story. First sentence should be engaging and open-ended, suitable for multiple people to continue.",
          { 
            context, 
            mode: 'story-continue',
            storyType: 'collaborative',
            maxLength: 100
          },
          'start_story'
        );
        
        const storyIdea: Idea = {
          id: `story_${Date.now()}`,
          content: response.ai_response || "Once upon a time in a collaborative digital realm...",
          type: 'story-start',
          mood: 'creative',
          timestamp: new Date().toISOString(),
          contributors: ['AI'],
          metadata: { 
            nextPrompt: 'Continue the story...',
            response
          }
        };
        
        ideaAnimations.current.set(storyIdea.id, new Animated.Value(0));
        setGeneratedContent(prev => [storyIdea, ...prev]);
      }
      
      // Animate the new story idea
      setTimeout(() => {
        const newIdeaId = `story_${Date.now()}`;
        const anim = ideaAnimations.current.get(newIdeaId);
        if (anim) {
          Animated.spring(anim, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }).start();
        }
      }, 100);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
    } catch (error) {
      console.error('Error starting story:', error);
      Alert.alert('Error', 'Failed to start collaborative story');
    } finally {
      setIsGenerating(false);
    }
  };

  const getMoodColor = (mood?: string): string => {
    const moodColors: Record<string, string> = {
      positive: '#4ECDC4',
      neutral: '#95E1D3',
      creative: '#F38181',
      analytical: '#AA96DA',
      energetic: '#FFD166',
      calm: '#118AB2',
    };
    return moodColors[mood || 'neutral'] || '#4ECDC4';
  };

  const getModeIcon = (modeId: string): string => {
    const mode = creativeModes.find(m => m.id === modeId);
    return mode?.icon || 'sparkles';
  };

  const renderIdeaCard = (idea: Idea, index: number) => {
    const anim = ideaAnimations.current.get(idea.id) || new Animated.Value(1);
    
    return (
      <Animated.View 
        key={idea.id}
        style={[
          styles.ideaCard,
          {
            opacity: anim,
            transform: [{
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0]
              })
            }]
          }
        ]}
      >
        <View style={styles.ideaHeader}>
          <View style={[styles.moodIndicator, { backgroundColor: getMoodColor(idea.mood) }]} />
          <Text style={styles.ideaType}>
            {idea.type.replace('-', ' ').toUpperCase()}
          </Text>
          <Text style={styles.ideaTime}>
            {new Date(idea.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        
        <Text style={styles.ideaText}>{idea.content}</Text>
        
        {idea.contributors && idea.contributors.length > 0 && (
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
            <Text style={styles.actionButtonText}>Save</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              // Share idea
              Alert.alert('Share Idea', 'Share this idea with others?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Share', onPress: () => {
                  // Implement sharing
                }}
              ]);
            }}
          >
            <Ionicons name="arrow-redo-outline" size={18} color="#45B7D1" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              Alert.alert(
                'Create Space',
                'Create a collaboration space from this idea?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Create', onPress: () => {
                    router.push({
                      pathname: '/(spaces)/create',
                      params: { 
                        idea: idea.content.substring(0, 100),
                        ideaType: idea.type 
                      }
                    });
                    onClose();
                  }}
                ]
              );
            }}
          >
            <Ionicons name="cube-outline" size={18} color="#4ECDC4" />
            <Text style={styles.actionButtonText}>Use</Text>
          </TouchableOpacity>
        </View>
        
        {idea.metadata?.source === 'voice' && (
          <View style={styles.voiceMetadata}>
            <Ionicons name="mic" size={12} color="#666" />
            <Text style={styles.voiceMetadataText}>
              Voice input • {idea.metadata.duration}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const handleModeSelect = (mode: CreativeMode) => {
    setActiveMode(mode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={styles.container}>
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
          onPress={() => Alert.alert(
            'Creative Generator Help',
            'Generate creative ideas using different modes:\n\n• Voice Ideas: Record your thoughts\n• Perspectives: Get alternate viewpoints\n• Story: Start collaborative narratives\n\nTap any idea to save, share, or create a space from it.'
          )}
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
              activeMode.id === mode.id && { backgroundColor: mode.color + '20' }
            ]}
            onPress={() => handleModeSelect(mode)}
          >
            <View style={[
              styles.modeIconContainer,
              activeMode.id === mode.id && { backgroundColor: mode.color }
            ]}>
              <Ionicons name={mode.icon as any} size={22} color="#fff" />
            </View>
            <Text style={[
              styles.modeText,
              activeMode.id === mode.id && { color: mode.color, fontWeight: '600' }
            ]}>
              {mode.name}
            </Text>
            <Text style={styles.modeDescription} numberOfLines={1}>
              {mode.description}
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
          <View style={styles.recordingInfo}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              Recording... {recordingTime}s
            </Text>
          </View>
          <TouchableOpacity 
            onPress={stopVoiceIdeation}
            style={styles.stopButton}
          >
            <Ionicons name="stop-circle" size={28} color="#FF6B6B" />
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Generated Content */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.contentArea}
        contentContainerStyle={[
          styles.contentAreaContent,
          generatedContent.length === 0 && styles.emptyContentArea
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isGenerating && (
          <View style={styles.generatingContainer}>
            <ActivityIndicator size="large" color={activeMode.color} />
            <Text style={styles.generatingText}>
              Generating {activeMode.name.toLowerCase()} ideas...
            </Text>
          </View>
        )}

        {generatedContent.length === 0 && !isGenerating ? (
          <View style={styles.emptyState}>
            <Ionicons name="bulb-outline" size={80} color="#333" />
            <Text style={styles.emptyTitle}>No ideas yet</Text>
            <Text style={styles.emptyDescription}>
              Tap a mode and generate ideas using voice or AI
            </Text>
            <View style={styles.emptyTips}>
              <Text style={styles.emptyTipsTitle}>Tips:</Text>
              <Text style={styles.emptyTip}>• Use voice for spontaneous ideas</Text>
              <Text style={styles.emptyTip}>• Try different modes for varied perspectives</Text>
              <Text style={styles.emptyTip}>• Save ideas you want to revisit</Text>
            </View>
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
            isRecording && { backgroundColor: '#FF6B6B20' }
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
          <Text style={[
            styles.controlText,
            isRecording && { color: '#FF6B6B' }
          ]}>
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
            if (generatedContent.length > 0) {
              Alert.alert(
                'Clear Ideas',
                'Are you sure you want to clear all generated ideas?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Clear', 
                    style: 'destructive',
                    onPress: () => {
                      setGeneratedContent([]);
                      ideaAnimations.current.clear();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                  }
                ]
              );
            }
          }}
          disabled={isGenerating || isRecording}
        >
          <Ionicons name="trash" size={24} color="#fff" />
          <Text style={styles.controlText}>Clear</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 100,
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
  modeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  modeDescription: {
    color: '#999',
    fontSize: 10,
    textAlign: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B6B',
    marginRight: 12,
  },
  recordingText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 2,
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
  emptyContentArea: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  generatingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  emptyTips: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    width: '80%',
  },
  emptyTipsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyTip: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
    marginLeft: 8,
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
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  ideaTime: {
    color: '#666',
    fontSize: 11,
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
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  voiceMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  voiceMetadataText: {
    color: '#666',
    fontSize: 11,
    marginLeft: 4,
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
  controlText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default CreativeGenerator;