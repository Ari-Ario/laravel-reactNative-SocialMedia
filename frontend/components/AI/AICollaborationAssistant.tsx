// components/AI/AICollaborationAssistant.tsx
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Dimensions,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import axios from '@/services/axios';
import * as Haptics from 'expo-haptics';
import getApiBase from '@/services/getApiBase';
import { useTranslation } from '@/constants/i18n';
import { useAppTheme } from '@/hooks/useAppTheme';
import { createShadow } from '@/utils/styles';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

interface AIAssistantProps {
  spaceId: string;
  spaceType: string;
  spaceData: any;
  participants: any[];
  currentContent: any;
  visible: boolean;
  onClose: () => void;
  embedded?: boolean;
}

interface Message {
  type: 'user' | 'ai';
  text: string;
  timestamp: Date;
  metadata?: {
    confidence?: number;
    source?: string;
    suggested_actions?: string[];
    meta?: {
      sentiment: number;
      synergy: {
        score: number;
      };
    };
  };
}

export const AICollaborationAssistant: React.FC<AIAssistantProps> = ({
  spaceId,
  spaceType,
  spaceData,
  participants,
  currentContent,
  visible,
  onClose
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const { t, isRTL } = useTranslation();
  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, isRTL);

  const [aiThinking, setAiThinking] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    suggestions: true,
    quickActions: true,
    chat: true
  });
  const API_BASE = getApiBase();
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load AI capabilities from space settings
  const aiCapabilities = spaceData?.ai_capabilities || ['summarize', 'suggest'];
  const aiPersonality = spaceData?.ai_personality || 'helpful';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatHistory.length > 0 || aiThinking) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatHistory, aiThinking]);

  // Animate panel when visibility changes
  useEffect(() => {
    if (visible) {
      showAssistant();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      hideAssistant();
    }
  }, [visible]);

  const showAssistant = () => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();
  };

  const hideAssistant = () => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: height,
        useNativeDriver: true,
        tension: 65,
        friction: 11
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();
  };

  const streamResponse = async (text: string, messageIndex: number) => {
    const words = text.split(' ');
    let currentText = '';
    
    for (let i = 0; i < words.length; i++) {
      currentText += (i === 0 ? '' : ' ') + words[i];
      setChatHistory(prev => {
        const newHistory = [...prev];
        if (newHistory[messageIndex]) {
          newHistory[messageIndex] = { ...newHistory[messageIndex], text: currentText };
        }
        return newHistory;
      });
      
      // Variable speed for a more natural feel
      const delay = Math.random() * 30 + 20; 
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    setStreamingMessageId(null);
  };

  const queryAI = async (query: string, context: any = {}) => {
    setAiThinking(true);

    try {
      const trainingResponse = await axios.post(`${API_BASE}/ai/query-training`, {
        query,
        context: {
          space_id: spaceId,
          space_type: spaceType,
          space_data: {
            ...spaceData,
            participants_count: participants.length,
            current_idea: spaceData?.content_state?.current_idea,
            last_activity: spaceData?.updated_at
          },
          participants: participants.map(p => ({ id: p.id, role: p.role, name: p.name })),
          current_content: currentContent,
          ...context
        }
      });

      let aiResponse = {
        text: trainingResponse.data.response || "I'm still learning!",
        source: trainingResponse.data.source || (trainingResponse.data.confidence > 0.5 ? 'pure_logic' : 'inductive_fallback'),
        confidence: trainingResponse.data.confidence,
        suggested_actions: trainingResponse.data.suggested_actions || []
      };

      console.log('AI Response:', { query, response: aiResponse });

      const newMessageIndex = chatHistory.length + 1; // +1 because user message was already added
      setStreamingMessageId(newMessageIndex);

      setChatHistory(prev => [...prev, {
        type: 'ai',
        text: '', // Start empty for streaming
        timestamp: new Date(),
        metadata: aiResponse
      }]);

      // Start the streaming effect
      streamResponse(aiResponse.text, newMessageIndex);

      return aiResponse;

    } catch (error) {
      console.error('AI query failed:', error);
      const errorText = "I encountered a logical disruption while analyzing your request. Please try rephrasing or provide more context.";
      
      setChatHistory(prev => [...prev, {
        type: 'ai',
        text: errorText,
        timestamp: new Date(),
        metadata: { confidence: 0, source: 'error' }
      }]);
      return null;
    } finally {
      setAiThinking(false);
    }
  };

  const generateSummary = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    await queryAI("Summarize the current discussion", {
      action: 'summarize',
      content: currentContent
    });
  };

  const suggestAlternatives = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    await queryAI("Suggest alternative approaches", {
      action: 'brainstorm',
      current_approach: spaceData?.content_state?.current_idea
    });
  };

  const generateIcebreaker = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    await queryAI("Generate a creative icebreaker question", {
      action: 'icebreaker',
      participant_count: participants.length,
      space_type: spaceType
    });
  };

  const checkConsensus = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    await queryAI("Check for consensus among participants", {
      action: 'consensus',
      participants: participants.map(p => ({ id: p.id, role: p.role }))
    });
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || aiThinking) return;

    const userMessage = userInput.trim();
    setUserInput('');

    setChatHistory(prev => [...prev, {
      type: 'user',
      text: userMessage,
      timestamp: new Date()
    }]);

    await queryAI(userMessage);

    // Auto-focus on web
    if (isWeb && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getPersonalityIcon = () => {
    switch (aiPersonality) {
      case 'creative': return 'color-wand';
      case 'analytical': return 'stats-chart';
      case 'brainstormer': return 'bulb';
      default: return 'happy';
    }
  };

  const getPersonalityColor = () => {
    switch (aiPersonality) {
      case 'creative': return '#9C27B0';
      case 'analytical': return '#2196F3';
      case 'brainstormer': return '#FF9800';
      default: return '#4CAF50';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          { opacity: fadeAnim }
        ]}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.aiPanel,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            {/* Header */}
            <LinearGradient
              colors={[colors.primary + '15', colors.background]}
              style={styles.header}
            >
              <View style={styles.headerLeft}>
                <View style={[styles.aiIcon, { backgroundColor: getPersonalityColor() + '20' }]}>
                  <Ionicons name="sparkles" size={22} color={getPersonalityColor()} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>{t('ai_collaboration_assistant')}</Text>
                  <View style={styles.headerBadges}>
                    <View style={[styles.personalityBadge, { backgroundColor: getPersonalityColor() + '15' }]}>
                      <Ionicons name={getPersonalityIcon()} size={12} color={getPersonalityColor()} />
                      <Text style={[styles.personalityText, { color: getPersonalityColor() }]}>
                        {t(`personality_${aiPersonality}`) || aiPersonality}
                      </Text>
                    </View>
                    <View style={styles.capabilityBadge}>
                      <Text style={styles.capabilityBadgeText}>
                        {t('capabilities_count', { count: aiCapabilities.length })}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </LinearGradient>

            {/* Quick Actions Section */}
            <View style={styles.quickActionsSection}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('quickActions')}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="flash" size={18} color={colors.primary} />
                  <Text style={styles.sectionTitle}>{t('quick_actions')}</Text>
                </View>
                <Ionicons
                  name={expandedSections.quickActions ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {expandedSections.quickActions && (
                <View style={styles.actionGrid}>
                  {aiCapabilities.includes('summarize') && (
                    <TouchableOpacity style={styles.actionCard} onPress={generateSummary}>
                      <LinearGradient
                        colors={['#667EEA', '#764BA2']}
                        style={styles.actionCardGradient}
                      >
                        <Ionicons name="document-text" size={20} color="#fff" />
                        <Text style={styles.actionCardText}>{t('summarize')}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                  {aiCapabilities.includes('suggest') && (
                    <TouchableOpacity style={styles.actionCard} onPress={suggestAlternatives}>
                      <LinearGradient
                        colors={['#F093FB', '#F5576C']}
                        style={styles.actionCardGradient}
                      >
                        <Ionicons name="bulb" size={20} color="#fff" />
                        <Text style={styles.actionCardText}>{t('brainstorm')}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                  {aiCapabilities.includes('moderate') && (
                    <TouchableOpacity style={styles.actionCard} onPress={checkConsensus}>
                      <LinearGradient
                        colors={['#4FACFE', '#00F2FE']}
                        style={styles.actionCardGradient}
                      >
                        <Ionicons name="people" size={20} color="#fff" />
                        <Text style={styles.actionCardText}>{t('consensus')}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                  {aiCapabilities.includes('inspire') && (
                    <TouchableOpacity style={styles.actionCard} onPress={generateIcebreaker}>
                      <LinearGradient
                        colors={['#FA709A', '#FEE140']}
                        style={styles.actionCardGradient}
                      >
                        <Ionicons name="color-wand" size={20} color="#fff" />
                        <Text style={styles.actionCardText}>{t('icebreaker')}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Chat Section */}
            <View style={styles.chatSection}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('chat')}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="chatbubbles" size={18} color={colors.primary} />
                  <Text style={styles.sectionTitle}>{t('conversation')}</Text>
                </View>
                <Text style={styles.messageCount}>{t('messages_count', { count: chatHistory.length })}</Text>
              </TouchableOpacity>

              {expandedSections.chat && (
                <>
                  <ScrollView
                    ref={scrollRef}
                    style={styles.chatContainer}
                    contentContainerStyle={styles.chatContentContainer}
                    showsVerticalScrollIndicator={false}
                  >
                    {chatHistory.length === 0 && (
                      <View style={styles.emptyChat}>
                        <View style={styles.emptyChatIcon}>
                          <Ionicons name="chatbubble-ellipses" size={48} color={colors.textSecondary + '40'} />
                        </View>
                        <Text style={styles.emptyChatTitle}>{t('start_conversation')}</Text>
                        <Text style={styles.emptyChatText}>
                          {t('ask_space_hint')}
                        </Text>
                      </View>
                    )}

                    {chatHistory.map((msg, index) => (
                      <View
                        key={`chat-${index}`}
                        style={[
                          styles.messageRow,
                          msg.type === 'user' ? styles.userRow : styles.aiRow
                        ]}
                      >
                        <View style={[
                          styles.messageAvatar,
                          msg.type === 'ai' && styles.aiAvatar
                        ]}>
                          {msg.type === 'ai' ? (
                            <Ionicons name="sparkles" size={16} color="#fff" />
                          ) : (
                            <Ionicons name="person" size={14} color="#fff" />
                          )}
                        </View>
                        <View style={[
                          styles.messageBubble,
                          msg.type === 'user' ? styles.userBubble : styles.aiBubble
                        ]}>
                          <Text style={[
                            styles.messageText,
                            msg.type === 'user' && styles.userMessageText
                          ]}>
                            {msg.text}
                            {streamingMessageId === index && (
                              <View style={styles.cursor} />
                            )}
                          </Text>

                          {msg.metadata?.confidence !== undefined && (
                            <View style={styles.metadataRow}>
                              <View style={styles.confidenceBar}>
                                <View
                                  style={[
                                    styles.confidenceFill,
                                    { width: `${(msg.metadata.confidence || 0) * 100}%` }
                                  ]}
                                />
                              </View>
                              <Text style={styles.confidenceText}>
                                {Math.round((msg.metadata.confidence || 0) * 100)}% {t('logic_confidence')}
                              </Text>
                            </View>
                          )}

                          {msg.metadata?.meta && (
                            <View style={styles.aiAnalytics}>
                              <View style={styles.analyticBadge}>
                                <Ionicons 
                                  name={msg.metadata.meta.sentiment >= 0 ? "happy" : "sad"} 
                                  size={10} 
                                  color={msg.metadata.meta.sentiment >= 0 ? "#4CAF50" : "#F44336"} 
                                />
                                <Text style={styles.analyticText}>
                                  {t('sentiment')}: {msg.metadata.meta.sentiment > 0 ? '+' : ''}{msg.metadata.meta.sentiment}
                                </Text>
                              </View>
                              <View style={styles.analyticBadge}>
                                <Ionicons name="people" size={10} color={colors.primary} />
                                <Text style={styles.analyticText}>
                                  {t('synergy')}: {Math.round(msg.metadata.meta.synergy.score * 100)}%
                                </Text>
                              </View>
                            </View>
                          )}

                          {msg.metadata?.suggested_actions && msg.metadata.suggested_actions.length > 0 && (
                            <View style={styles.suggestedActions}>
                              {msg.metadata.suggested_actions.map((action: string, idx: number) => (
                                <TouchableOpacity
                                  key={`action-${index}-${idx}`}
                                  style={styles.suggestedActionChip}
                                  onPress={() => {
                                    setUserInput(action);
                                    inputRef.current?.focus();
                                  }}
                                >
                                  <Text style={styles.suggestedActionText}>{action}</Text>
                                  <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}

                          <Text style={styles.messageTime}>
                            {formatTimestamp(msg.timestamp)}
                          </Text>
                        </View>
                      </View>
                    ))}

                    {aiThinking && (
                      <View style={[styles.messageRow, styles.aiRow]}>
                        <View style={[styles.messageAvatar, styles.aiAvatar]}>
                          <Ionicons name="sparkles" size={16} color="#fff" />
                        </View>
                        <View style={[styles.messageBubble, styles.aiBubble, styles.thinkingBubble]}>
                          <View style={styles.thinkingContainer}>
                            <Text style={styles.thinkingText}>{t('ai_thinking')}</Text>
                            <View style={styles.thinkingDots}>
                              <View style={styles.thinkingDot} />
                              <View style={[styles.thinkingDot, { animationDelay: '0.2s' }]} />
                              <View style={[styles.thinkingDot, { animationDelay: '0.4s' }]} />
                            </View>
                          </View>
                        </View>
                      </View>
                    )}
                  </ScrollView>

                  {/* Input Area */}
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputContainer}>
                      <TextInput
                        ref={inputRef}
                        style={styles.input}
                        placeholder={t('ask_assistant_placeholder') || "Ask me anything..."}
                        placeholderTextColor={colors.textSecondary + '60'}
                        value={userInput}
                        onChangeText={setUserInput}
                        onSubmitEditing={handleSendMessage}
                        editable={!aiThinking}
                        multiline
                        maxLength={500}
                      />
                      <TouchableOpacity
                        style={[
                          styles.sendButton,
                          (!userInput.trim() || aiThinking) && styles.sendButtonDisabled
                        ]}
                        onPress={handleSendMessage}
                        disabled={!userInput.trim() || aiThinking}
                      >
                        <LinearGradient
                          colors={['#667EEA', '#764BA2']}
                          style={styles.sendButtonGradient}
                        >
                          <Ionicons
                            name="send"
                            size={18}
                            color="#fff"
                            style={isRTL ? styles.sendIconRTL : styles.sendIconLTR}
                          />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.inputHint}>
                      {t('characters_limit_hint', { count: userInput.length })}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const getStyles = (colors: any, isRTL: boolean) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  aiPanel: {
    position: 'absolute',
    bottom: 0,
    left: isWeb ? '50%' : 0,
    right: isWeb ? 'auto' : 0,
    width: isWeb ? Math.min(width, 1440) : width,
    marginLeft: isWeb ? Math.min(width, 1440) / -2 : 0,
    height: height * 0.85,
    backgroundColor: colors.background,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    ...createShadow({ opacity: 0.2, radius: 20, offset: { width: 0, height: -5 } }),
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  personalityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  personalityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  capabilityBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  capabilityBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  messageCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  actionCard: {
    flex: 1,
    minWidth: (width - 64) / 2 - 12,
    borderRadius: 14,
    overflow: 'hidden',
    ...createShadow({ opacity: 0.1, radius: 4 }),
  },
  actionCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  actionCardText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  chatSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  chatContainer: {
    flex: 1,
  },
  chatContentContainer: {
    paddingBottom: 20,
  },
  emptyChat: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyChatIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptyChatText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiAvatar: {
    backgroundColor: '#667EEA',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    ...createShadow({ opacity: 0.05, radius: 2 }),
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.muted,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  userMessageText: {
    color: '#fff',
  },
  cursor: {
    width: 2,
    height: 14,
    backgroundColor: colors.primary,
    marginLeft: 2,
    ...Platform.select({
      web: {
        display: 'inline-block' as any,
        verticalAlign: 'middle' as any,
      },
      default: {
        display: 'flex',
      }
    })
  },
  aiAnalytics: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  analyticBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  analyticText: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metadataRow: {
    marginTop: 8,
    gap: 4,
  },
  confidenceBar: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 1.5,
  },
  confidenceText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  suggestedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  suggestedActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestedActionText: {
    fontSize: 12,
    color: colors.primary,
  },
  messageTime: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 6,
  },
  thinkingBubble: {
    backgroundColor: colors.muted,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  thinkingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textSecondary,
    opacity: 0.6,
  },
  inputWrapper: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    paddingRight: 16,
    fontSize: 14,
    color: colors.text,
    maxHeight: 100,
    textAlignVertical: 'top',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIconLTR: {
    transform: [{ rotate: '-15deg' }],
  },
  sendIconRTL: {
    transform: [{ rotate: '165deg' }],
  },
  inputHint: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 6,
    marginLeft: 16,
  },
});

export default AICollaborationAssistant;