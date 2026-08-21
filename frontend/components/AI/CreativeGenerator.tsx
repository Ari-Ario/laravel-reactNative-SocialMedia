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
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import * as Clipboard from 'expo-clipboard';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { useTranslation } from '@/constants/i18n';
import { useAppTheme } from '@/hooks/useAppTheme';
import axios from '@/services/axios';
import getApiBase from '@/services/getApiBase';
import { useCreativeGeneratorStore, Idea } from '@/stores/creativeGeneratorStore';
import { createShadow } from '@/utils/styles';
import { useToastStore } from '@/stores/toastStore';
import { useModal } from '@/context/ModalContext';
import GenericMenu, { MenuItem } from '../GenericMenu';
import { calculateAnchorPositionFromEvent, AnchorPosition } from '@/utils/layout';

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

interface CreativeMode {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  promptPrefix: string;
}

const CreativeGenerator: React.FC<CreativeGeneratorProps> = ({
  spaceId,
  context,
  onClose,
}) => {
  const router = useRouter();
  const { t, isRTL } = useTranslation();
  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, activeScheme, isRTL);

  const creativeModes: CreativeMode[] = [
    { id: 'brainstorm', name: t('brainstorm'), icon: 'flash', description: t('brainstorm_desc'), color: '#4ECDC4', promptPrefix: "Generate a disruptive brainstorm" },
    { id: 'story-continue', name: t('story_continue'), icon: 'book', description: t('story_continue_desc'), color: '#F38181', promptPrefix: "Continue this narrative logic" },
    { id: 'problem-solve', name: t('solve'), icon: 'bulb', description: t('solve_desc'), color: '#FFD166', promptPrefix: "Solve this mathematical/logical challenge" },
    { id: 'design-thinking', name: t('design'), icon: 'pencil', description: t('design_desc'), color: '#06D6A0', promptPrefix: "Apply human-centric design thinking" },
    { id: 'debate', name: t('debate'), icon: 'chatbubbles', description: t('debate_desc'), color: '#118AB2', promptPrefix: "Create a logical counter-argument" },
    { id: 'roleplay', name: t('roleplay'), icon: 'person', description: t('roleplay_desc'), color: '#EF476F', promptPrefix: "Simulate this persona's logical perspective" },
  ];

  const {
    generatedIdeas,
    activeModeId,
    isGenerating,
    logicMetrics,
    setMode,
    setGenerating,
    addIdea,
    clearIdeas,
    removeIdea,
    toggleSaveIdea,
    setLogicMetrics,
    submitFeedback
  } = useCreativeGeneratorStore();

  const [voiceInput, setVoiceInput] = useState('');

  const activeMode = creativeModes.find(m => m.id === activeModeId) || creativeModes[0];

  const {
    isRecording,
    startRecording,
    stopRecording,
    recordingDuration,
  } = useAudioRecording({
    onRecordingComplete: (uri, duration) => {
      generateIdeasFromVoice(uri, duration);
    }
  });

  const recordingTime = Math.floor(recordingDuration / 1000);

  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Web-safe state for action menus
  const [showHelpModal, setShowHelpModal] = useState(false);
  const { openModal } = useModal();

  const [useMenuVisible, setUseMenuVisible] = useState(false);
  const [useMenuPosition, setUseMenuPosition] = useState<AnchorPosition | undefined>(undefined);
  const [currentIdea, setCurrentIdea] = useState<Idea | null>(null);

  // Animation refs for each idea card
  const ideaAnimations = useRef<Map<string, Animated.Value>>(new Map());

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Animation for recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
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
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('permission_denied'), t('need_mic_permission'));
        return;
      }

      await setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      await startRecording();
      safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert(t('error'), t('failed_start_recording'));
    }
  };

  const stopVoiceIdeation = async () => {
    try {
      await stopRecording();
      safeHaptics.success();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const getEnrichedContext = () => {
    let spaceData = "";
    if (context.type === 'chat' && context.chats && context.chats.length > 0) {
      // Get last 5 messages for induction
      const recentMsgs = context.chats.slice(0, 5).map(m => `${m.user?.name || 'User'}: ${m.content}`).join('\n');
      spaceData = `Recent Chat Context:\n${recentMsgs}`;
    } else if (context.spaces && context.spaces.length > 0) {
      const activeSpace = context.spaces.find(s => s.id === spaceId);
      if (activeSpace) {
        spaceData = `Space Description: ${activeSpace.description || activeSpace.title}`;
      }
    }
    return spaceData;
  };

  const generateIdeasFromVoice = async (audioUri: string, duration?: number) => {
    setGenerating(true);

    try {
      const enrichedContext = getEnrichedContext();
      const formData = new FormData();
      formData.append('audio', {
        uri: Platform.OS === 'ios' ? audioUri.replace('file://', '') : audioUri,
        type: 'audio/m4a',
        name: 'voice_induction.m4a',
      } as any);
      formData.append('mode', activeModeId);
      formData.append('context_data', enrichedContext);

      const API_BASE = getApiBase();
      const response = await axios.post(`${API_BASE}/ai/query-audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const pureIdea: Idea = {
        id: `voice_${Date.now()}`,
        content: response.data.response || "Audio transcribed and mathematically analyzed.",
        type: 'voice-idea',
        mood: response.data.confidence > 0.5 ? 'analytical' : 'creative',
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'voice',
          duration: `${duration ? Math.round(duration) : recordingTime}s`,
          confidence: response.data.confidence || 0.45
        }
      };

      addIdea(pureIdea);

      setLogicMetrics({
        confidence: response.data.confidence || 0.45,
        tier: (response.data.confidence || 0.45) > 0.8 ? 1 : ((response.data.confidence || 0.45) > 0.5 ? 2 : 3),
        synergy: Math.min(100, Math.round((response.data.confidence || 0.45) * 120)),
        activeNodes: Math.floor(Math.random() * 10) + 5
      });

      safeHaptics.success();

    } catch (error) {
      console.error('Error generating voice ideas:', error);
      Alert.alert(t('error'), t('failed_voice_induction'));
    } finally {
      setGenerating(false);
    }
  };

  const generateAlternateRealities = async (customPrompt?: string) => {
    setGenerating(true);

    try {
      const actualSpaceId = spaceId && spaceId !== 'global' ? spaceId : undefined;
      const enrichedContext = getEnrichedContext();
      const API_BASE = getApiBase();
      
      const query = customPrompt || `Generate alternate perspectives for this context: ${enrichedContext.substring(0, 200) || (context.type === 'chat' ? 'chat conversations' : 'collaboration')}`;

      const response = await axios.post(`${API_BASE}/ai/query-training`, {
        query: query,
        context: { 
          mode: activeModeId, 
          requestType: 'alternate_perspectives', 
          spaceId: actualSpaceId,
          enriched_data: enrichedContext 
        }
      });

      if (!actualSpaceId || response.data.confidence < 0.1) {
        const newIdea: Idea = {
          id: `realities_${Date.now()}`,
          content: response.data.response || "Alternate perspectives generated purely through trial and error.",
          type: 'alternate-realities',
          mood: 'analytical',
          timestamp: new Date().toISOString(),
          metadata: { generatedAt: new Date().toISOString(), confidence: response.data.confidence || 0.42 }
        };

        addIdea(newIdea);

      } else {
        const aiResponse = await axios.post(`${API_BASE}/ai/query-training`, {
          query: `Generate 3 alternate perspectives for: ${context.type === 'chat' ? 'chat conversations' : 'collaboration'}`,
          context: { mode: activeMode.id, requestType: 'alternate_perspectives', spaceId: actualSpaceId }
        });

        const newIdea: Idea = {
          id: `realities_${Date.now()}`,
          content: aiResponse.data.response || t('alternate_perspectives_generated'),
          type: 'alternate-realities',
          mood: 'analytical',
          timestamp: new Date().toISOString(),
          metadata: { confidence: aiResponse.data.confidence || 0.5, generatedAt: new Date().toISOString() }
        };

        addIdea(newIdea);

        setLogicMetrics({
          confidence: aiResponse.data.confidence || 0.52,
          tier: (aiResponse.data.confidence || 0.52) > 0.8 ? 1 : ((aiResponse.data.confidence || 0.52) > 0.5 ? 2 : 3),
          synergy: Math.min(100, Math.round((aiResponse.data.confidence || 0.52) * 110)),
          activeNodes: Math.floor(Math.random() * 15) + 8
        });
        safeHaptics.success();
      }

    } catch (error: any) {
      console.error('Error generating alternate realities:', error);

      const fallbackIdea: Idea = {
        id: `fallback_${Date.now()}`,
        content: "Try looking at this from different angles:\n\n1. The Optimist: Everything works perfectly\n2. The Realist: Practical considerations\n3. The Innovator: Radical new approaches",
        type: 'alternate-realities',
        mood: 'analytical',
        timestamp: new Date().toISOString(),
      };

      addIdea(fallbackIdea);

    } finally {
      setGenerating(false);
    }
  };

  const startCollaborativeStory = async () => {
    setGenerating(true);

    try {
      const actualSpaceId = spaceId && spaceId !== 'global' ? spaceId : undefined;
      const API_BASE = getApiBase();
      const response = await axios.post(`${API_BASE}/ai/query-training`, {
        query: "Start a collaborative story. First sentence should be engaging and open-ended.",
        context: { mode: 'story-continue', storyType: 'collaborative' }
      });

      if (!actualSpaceId || response.data.confidence < 0.1) {
        // Use the pure mathematical fallback if no spaceId
        const storyStart = response.data.response || "Logic dictates the beginning of our story...";

        const storyIdea: Idea = {
          id: `story_${Date.now()}`,
          content: storyStart,
          type: 'story-start',
          mood: 'creative',
          timestamp: new Date().toISOString(),
          contributors: [t('ai')],
          metadata: { nextPrompt: 'What happens next?', confidence: response.data.confidence }
        };

        addIdea(storyIdea);

      } else {
        // Use actual AI query
        const aiResponse = await axios.post(`${API_BASE}/ai/query-training`, {
          query: "Start a collaborative story. First sentence should be engaging and open-ended, suitable for multiple people to continue.",
          context: { mode: 'story-continue', storyType: 'collaborative', spaceId: actualSpaceId }
        });

        const storyIdea: Idea = {
          id: `story_${Date.now()}`,
          content: aiResponse.data.response || "Once upon a time in a pure logical realm...",
          type: 'story-start',
          mood: 'creative',
          timestamp: new Date().toISOString(),
          contributors: ['AI'],
          metadata: { nextPrompt: 'Continue the logic...', confidence: aiResponse.data.confidence }
        };

        addIdea(storyIdea);
      }

      safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);

    } catch (error) {
      console.error('Error starting story:', error);
      Alert.alert(t('error'), t('failed_start_story'));
    } finally {
      setGenerating(false);
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

  const handleShareIdea = async (idea: Idea) => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    
    // Reinforce logic on share (+0.05)
    await submitFeedback(
      context.type === 'chat' ? 'shared_from_chat' : activeModeId,
      idea.content,
      'save',
      activeModeId
    );

    // Use the global share modal which now supports 'idea'
    openModal('share', { idea: idea });
  };

  const handleUseIdea = async (idea: Idea, event?: any) => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentIdea(idea);

    if (Platform.OS === 'web' && event) {
      const position = calculateAnchorPositionFromEvent(event, 220);
      setUseMenuPosition(position);
      setUseMenuVisible(true);
      return;
    }

    // Native Alert fallback for mobile
    Alert.alert(
      t('use_insight'),
      t('use_insight_desc'),
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('send_to_chat'), 
          onPress: () => performUseAction(idea, 'chat')
        },
        {
          text: t('create_post'),
          onPress: () => performUseAction(idea, 'post')
        }
      ]
    );
  };

  const performUseAction = async (idea: Idea, type: 'chat' | 'post') => {
    try {
      if (type === 'chat') {
        if (spaceId && spaceId !== 'global') {
          await CollaborationService.getInstance().sendMessage(spaceId, idea.content);
          useToastStore.getState().showToast(t('idea_sent_to_chat'), 'success');
          onClose();
        } else {
          Alert.alert(t('error'), t('no_active_space_to_send'));
        }
      } else {
        router.push({
          pathname: '/(tabs)/spaces/create' as any,
          params: {
            title: idea.content.substring(0, 30),
            description: idea.content,
            type: 'post'
          }
        });
        onClose();
      }

      // Reinforce logic on Use (+0.1)
      await submitFeedback(
        context.type === 'chat' ? 'used_in_chat' : activeModeId,
        idea.content,
        'save',
        activeModeId
      );

    } catch (err) {
      console.error('Error performing use action:', err);
    } finally {
      setUseMenuVisible(false);
      setCurrentIdea(null);
    }
  };

  const handleFeedback = async (idea: Idea, type: 'save' | 'discard') => {
    // Optimistic UI for save
    if (type === 'save') {
      toggleSaveIdea(idea.id, true);
    }

    const newWeight = await submitFeedback(
      context.type === 'chat' ? 'chat context' : activeModeId,
      idea.content,
      type,
      activeModeId
    );

    if (newWeight !== null) {
      if (type === 'save') {
        safeHaptics.success();
      } else {
        Alert.alert(
          t('logical_pruning'),
          t('idea_weight_reduced').replace('{weight}', '-0.2') + ` (Weight: ${newWeight})`
        );
        removeIdea(idea.id);
      }
    } else if (type === 'save') {
      // Revert if error
      toggleSaveIdea(idea.id, false);
      Alert.alert(t('error'), t('feedback_sync_error'));
    }
  };

  const renderLogicDashboard = () => {
    return (
      <View style={styles.logicDashboard}>
        <View style={styles.logicMetric}>
          <Text style={styles.metricLabel}>{t('tier')}</Text>
          <Text style={[styles.metricValue, { color: getTierColor(logicMetrics.tier) }]}>
            {logicMetrics.tier}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.logicMetric}>
          <Text style={styles.metricLabel}>{t('confidence')}</Text>
          <Text style={styles.metricValue}>{Math.round(logicMetrics.confidence * 100)}%</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.logicMetric}>
          <Text style={styles.metricLabel}>{t('knowledge_depth')}</Text>
          <Text style={[styles.metricValue, { color: colors.success }]}>
            {context.chats?.length ? 'High' : 'Pure Logic'}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.logicMetric}>
          <Text style={styles.metricLabel}>{t('synergy')}</Text>
          <Text style={styles.metricValue}>{logicMetrics.synergy}%</Text>
        </View>
      </View>
    );
  };

  const getTierColor = (tier: number) => {
    switch (tier) {
      case 1: return '#06D6A0'; // High confidence
      case 2: return '#FFD166'; // Medium
      case 3: return '#EF476F'; // Low
      default: return colors.text;
    }
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

        {idea.metadata?.confidence !== undefined && (
          <View style={styles.synergyContainer}>
            <View style={styles.synergyInfo}>
              <Ionicons name="analytics" size={14} color={colors.textSecondary} />
              <Text style={styles.synergyLabel}>
                {t('confidence_label').replace('{value}', Math.round(idea.metadata.confidence * 100).toString())}
              </Text>
            </View>
            <View style={styles.synergyBarWrapper}>
              <View
                style={[
                  styles.synergyBar,
                  {
                    width: `${Math.round(idea.metadata.confidence * 100)}%`,
                    backgroundColor: getTierColor(idea.metadata.confidence > 0.8 ? 1 : (idea.metadata.confidence > 0.5 ? 2 : 3))
                  }
                ]}
              />
            </View>
          </View>
        )}

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
            onPress={async () => {
              if (idea.isSaved) return;
              safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
              await handleFeedback(idea, 'save');
            }}
          >
            <Ionicons 
              name={idea.isSaved ? "heart" : "heart-outline"} 
              size={18} 
              color={idea.isSaved ? "#FF3B30" : colors.text} 
            />
            <Text style={[styles.actionButtonText, idea.isSaved && { color: "#FF3B30" }]}>{t('save')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShareIdea(idea)}
          >
            <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.actionButtonText}>{t('share')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => handleUseIdea(idea, e)}
          >
            <Ionicons name="rocket-outline" size={18} color={colors.success} />
            <Text style={styles.actionButtonText}>{t('use')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={async () => {
              safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
              await handleFeedback(idea, 'discard');
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#999" />
            <Text style={styles.actionButtonText}>{t('discard_btn')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const useMenuItems: MenuItem[] = [
    { 
      icon: 'chatbubble-outline', 
      label: t('send_to_chat'), 
      onPress: () => currentIdea && performUseAction(currentIdea, 'chat') 
    },
    { 
      icon: 'create-outline', 
      label: t('create_post'), 
      onPress: () => currentIdea && performUseAction(currentIdea, 'post') 
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity onPress={onClose} style={[styles.backButton, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={28} color={colors.text} />
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('creative_generator')}</Text>
        </View>

        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => {
            safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
            if (Platform.OS === 'web') {
              setShowHelpModal(true);
            } else {
              Alert.alert(t('creative_help_title'), t('creative_help_desc'), [{ text: t('ok') }], { cancelable: true });
            }
          }}
        >
          <Ionicons name="help-circle-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Web Help Modal */}
      {showHelpModal && (
        <View style={styles.webHelpOverlay}>
          <View style={styles.webHelpModal}>
            <View style={styles.webHelpHeader}>
              <Text style={styles.webHelpTitle}>{t('creative_help_title')}</Text>
              <TouchableOpacity onPress={() => setShowHelpModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.webHelpContent}>
              <Text style={styles.webHelpText}>{t('creative_help_desc')}</Text>
            </ScrollView>
            <TouchableOpacity 
              style={styles.webHelpCloseBtn}
              onPress={() => setShowHelpModal(false)}
            >
              <Text style={styles.webHelpCloseText}>{t('ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {useMenuVisible && (
        <GenericMenu
          visible={useMenuVisible}
          onClose={() => setUseMenuVisible(false)}
          items={useMenuItems}
          anchorPosition={useMenuPosition}
        />
      )}

      <View style={styles.modesHeader}>
        <Text style={styles.modesTitle}>{t('observation_layer')}</Text>
        <Text style={styles.modesSubtitle}>{t('observation_layer_desc')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.modesContainer}
        contentContainerStyle={styles.modesContent}
      >
        {creativeModes.map((mode) => (
          <TouchableOpacity
            key={mode.id}
            style={[
              styles.modeCard,
              activeModeId === mode.id && { borderColor: mode.color, backgroundColor: mode.color + '15' }
            ]}
            onPress={() => {
              safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
              setMode(mode.id);
              // Proactive induction: analyze context with this framework specifically
              generateAlternateRealities(`${mode.promptPrefix}: ${getEnrichedContext().substring(0, 150)}`);
            }}
          >
            <View style={[styles.modeIconContainer, { backgroundColor: mode.color }]}>
              <Ionicons name={mode.icon as any} size={24} color="#FFF" />
            </View>
            <Text style={[styles.modeName, activeModeId === mode.id && { color: mode.color }]}>
              {mode.name}
            </Text>
            <Text style={styles.modeDescription} numberOfLines={2}>
              {mode.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {renderLogicDashboard()}

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={generatedIdeas.length === 0 ? styles.emptyContent : styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {isGenerating && (
          <View style={styles.generatingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={styles.generatingText}>{t('ai_thinking')}</Text>
          </View>
        )}

        {generatedIdeas.length === 0 && !isGenerating ? (
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={80} color={colors.border} />
            <Text style={styles.emptyTitle}>{t('start_creating')}</Text>
            <Text style={styles.emptyDescription}>{t('start_creating_desc')}</Text>
            <View style={styles.emptyTips}>
              <Text style={styles.emptyTipsTitle}>{t('quick_tips')}</Text>
              <Text style={styles.emptyTip}>• {t('tip_voice_induction')}</Text>
              <Text style={styles.emptyTip}>• {t('tip_deductive_depth')}</Text>
            </View>
          </View>
        ) : (
          generatedIdeas.map((idea, index) => renderIdeaCard(idea, index))
        )}
      </ScrollView>

      <View style={styles.actionControls}>
        <View style={styles.mainControls}>
          <TouchableOpacity
            style={[styles.opButton, styles.voiceButton, isRecording && styles.activeVoice]}
            onPress={isRecording ? stopVoiceIdeation : startVoiceIdeation}
          >
            <Ionicons name={isRecording ? "stop" : "mic"} size={28} color="#FFF" />
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <Text style={styles.recordingTimeText}>{recordingTime}s</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.opButton, styles.inductButton]}
            onPress={generateAlternateRealities}
            disabled={isGenerating}
          >
            <Ionicons name="sparkles" size={24} color={colors.tint} />
            <Text style={styles.opLabel}>{t('induct_insight')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.opButton, styles.deepenButton]}
            onPress={startCollaborativeStory}
            disabled={isGenerating}
          >
            <Ionicons name="infinite" size={24} color={colors.tint} />
            <Text style={styles.opLabel}>{t('deepen_logic')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.opButton, styles.clearButton]}
            onPress={() => {
              clearIdeas();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
          >
            <Ionicons name="trash" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const getStyles = (colors: any, activeScheme: string, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  backButton: {
    alignItems: 'center',
  },
  backText: {
    color: colors.text,
    fontSize: 16,
    [isRTL ? 'marginRight' : 'marginLeft']: 8,
  },
  helpButton: {
    padding: 12,
    marginRight: -8, // Compensate for padding to align with edge
  },
  modesHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modesSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modesContainer: {
    maxHeight: 160,
  },
  modesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modeCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    [isRTL ? 'marginLeft' : 'marginRight']: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.1,
      radius: 4,
      elevation: 2,
    }),
  },
  modeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
  logicDashboard: {
    flexDirection: 'row',
    backgroundColor: activeScheme === 'dark' ? '#1A1A1A' : '#F0F0F0',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logicMetric: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  metricDivider: {
    width: 1,
    height: '60%',
    backgroundColor: colors.border,
  },
  content: {
    flex: 1,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 120,
  },
  synergyContainer: {
    marginTop: 12,
  },
  synergyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  synergyLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  synergyBarWrapper: {
    height: 4,
    backgroundColor: activeScheme === 'dark' ? '#333' : '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  synergyBar: {
    height: '100%',
    borderRadius: 2,
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  generatingText: {
    color: colors.text,
    fontSize: 16,
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyDescription: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  emptyTips: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    width: '80%',
  },
  emptyTipsTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyTip: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
    [isRTL ? 'marginRight' : 'marginLeft']: 8,
  },
  ideaCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.1,
      radius: 4,
      elevation: 3,
    }),
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
    [isRTL ? 'marginLeft' : 'marginRight']: 8,
  },
  ideaType: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  ideaTime: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  ideaText: {
    color: colors.text,
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
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 6,
  },
  ideaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    [isRTL ? 'marginLeft' : 'marginRight']: 16,
  },
  actionButtonText: {
    color: colors.text,
    fontSize: 12,
    [isRTL ? 'marginRight' : 'marginLeft']: 4,
    fontWeight: '500',
  },
  actionControls: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    borderRadius: 30,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border,
    ...createShadow({
      width: 0,
      height: 4,
      opacity: 0.2,
      radius: 8,
      elevation: 10,
    }),
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opButton: {
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  voiceButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.tint,
  },
  activeVoice: {
    backgroundColor: '#FF3B30',
  },
  inductButton: {
    flex: 1,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.tint,
    backgroundColor: colors.tint + '10',
  },
  deepenButton: {
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.tint,
    backgroundColor: colors.tint + '10',
  },
  clearButton: {
    width: 48,
    backgroundColor: '#8E8E93',
  },
  opLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.tint,
    marginLeft: 6,
  },
  recordingIndicator: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recordingTimeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  webActionMenu: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    ...createShadow({ width: 0, height: 2, opacity: 0.1, radius: 4 }),
  },
  webActionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  webActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.tint,
    marginLeft: 6,
  },
  webActionDivider: {
    width: 1,
    height: '60%',
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  webHelpOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webHelpModal: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 20,
    ...createShadow({ width: 0, height: 4, opacity: 0.3, radius: 10 }),
  },
  webHelpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  webHelpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  webHelpContent: {
    maxHeight: 400,
  },
  webHelpText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    whiteSpace: 'pre-wrap' as any,
  },
  webHelpCloseBtn: {
    backgroundColor: colors.tint,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  webHelpCloseText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});

export default CreativeGenerator;