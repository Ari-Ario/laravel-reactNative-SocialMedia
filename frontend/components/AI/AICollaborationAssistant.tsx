// components/AI/AICollaborationAssistant.tsx
import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Haptics from 'expo-haptics';

interface AIAssistantProps {
  spaceId: string;
  spaceType: string;
  spaceData: any;
  participants: any[];
  currentContent: any;
}

export const AICollaborationAssistant: React.FC<AIAssistantProps> = ({
  spaceId,
  spaceType,
  spaceData,
  participants,
  currentContent
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [userInput, setUserInput] = useState('');
  
  const slideAnim = useRef(new Animated.Value(300)).current;

  // Load AI capabilities from space settings
  const aiCapabilities = spaceData?.ai_capabilities || ['summarize', 'suggest'];
  const aiPersonality = spaceData?.ai_personality || 'helpful';

  // Watch for collaboration patterns to offer proactive help
  useEffect(() => {
    const patterns = detectCollaborationPatterns();
    
    if (patterns.needsHelp && !isVisible) {
      offerProactiveHelp(patterns);
    }
  }, [spaceData, participants]);

  const detectCollaborationPatterns = () => {
    const patterns = {
      needsHelp: false,
      stuck: false,
      needsInspiration: false,
      needsSummary: false,
    };

    // Check for collaboration stagnation
    const lastActivity = new Date(spaceData?.last_interaction_at);
    const minutesSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60);
    
    if (minutesSinceActivity > 5 && participants.length > 1) {
      patterns.needsHelp = true;
      patterns.stuck = true;
    }

    // Check for repetitive patterns
    if (spaceData?.activity_metrics?.similar_edits > 3) {
      patterns.needsHelp = true;
      patterns.needsInspiration = true;
    }

    // Check for information density
    if (spaceData?.content_state?.message_count > 50) {
      patterns.needsSummary = true;
    }

    return patterns;
  };

  const offerProactiveHelp = async (patterns: any) => {
    const suggestions = [];
    
    if (patterns.stuck) {
      suggestions.push({
        type: 'icebreaker',
        text: "Looks like the conversation slowed down. Want a creative prompt?",
        action: () => generateIcebreaker()
      });
    }
    
    if (patterns.needsInspiration) {
      suggestions.push({
        type: 'inspiration',
        text: "I notice you're exploring similar ideas. Want alternative perspectives?",
        action: () => suggestAlternatives()
      });
    }
    
    if (patterns.needsSummary) {
      suggestions.push({
        type: 'summary',
        text: "There's a lot of great discussion! Want me to summarize key points?",
        action: () => generateSummary()
      });
    }
    
    if (suggestions.length > 0) {
      setAiSuggestions(suggestions);
      showAssistant();
    }
  };

  // Main AI query function
  const queryAI = async (query: string, context: any = {}) => {
    setAiThinking(true);
    
    try {
      // First, check your existing chatbot_training for direct matches
      const trainingResponse = await axios.post('/api/ai/query-training', {
        query,
        context: {
          space_type: spaceType,
          space_data: spaceData,
          participants_count: participants.length,
          ...context
        }
      });

      // If no good match, use more advanced AI (you can integrate GPT later)
      let aiResponse;
      if (trainingResponse.data.confidence > 0.7) {
        // Use your trained response
        aiResponse = {
          text: trainingResponse.data.response,
          source: 'trained',
          confidence: trainingResponse.data.confidence,
          suggested_actions: trainingResponse.data.suggested_actions
        };
      } else {
        // Fallback to rule-based or external AI
        aiResponse = await generateAIResponse(query, context);
      }

      // Log the interaction for learning
      await logAIInteraction(query, aiResponse);
      
      // Add to chat history
      setChatHistory(prev => [...prev, {
        type: 'ai',
        text: aiResponse.text,
        timestamp: new Date(),
        metadata: aiResponse
      }]);

      return aiResponse;
      
    } catch (error) {
      console.error('AI query failed:', error);
      return {
        text: "I'm having trouble thinking right now. Try again in a moment!",
        source: 'error'
      };
    } finally {
      setAiThinking(false);
    }
  };

  // Specific AI functions for collaboration
  const generateSummary = async () => {
    const summary = await queryAI("Summarize the current discussion", {
      action: 'summarize',
      content: currentContent
    });
    
    // Also add to space as a summary card
    await axios.post(`/api/spaces/${spaceId}/add-summary`, {
      summary: summary.text,
      generated_by: 'ai'
    });
  };

  const suggestAlternatives = async () => {
    const alternatives = await queryAI("Suggest alternative approaches", {
      action: 'brainstorm',
      current_approach: spaceData?.content_state?.current_idea
    });
    
    // Add as brainstorm cards
    if (alternatives.suggested_actions) {
      alternatives.suggested_actions.forEach((alt: string) => {
        addBrainstormCard(alt, 'ai_suggestion');
      });
    }
  };

  const generateIcebreaker = async () => {
    const icebreaker = await queryAI("Generate a creative icebreaker question", {
      action: 'icebreaker',
      participant_count: participants.length,
      space_type: spaceType
    });
    
    // Add to chat
    addAIMessageToChat(icebreaker.text);
  };

  // UI Components
  const showAssistant = () => {
    setIsVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 10
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const hideAssistant = () => {
    Animated.spring(slideAnim, {
      toValue: 300,
      useNativeDriver: true,
      tension: 50,
      friction: 10
    }).start(() => setIsVisible(false));
  };

  return (
    <>
      {/* Floating AI Button */}
      {!isVisible && (
        <Pressable 
          style={styles.floatingAIButton}
          onPress={showAssistant}
        >
          <Ionicons name="sparkles" size={24} color="#fff" />
        </Pressable>
      )}

      {/* AI Assistant Panel */}
      {isVisible && (
        <Animated.View 
          style={[
            styles.aiPanel,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Header */}
          <View style={styles.aiHeader}>
            <View style={styles.aiTitle}>
              <Ionicons name="sparkles" size={20} color="#667EEA" />
              <Text style={styles.aiTitleText}>Collaboration Assistant</Text>
              <View style={[styles.personalityBadge, styles[aiPersonality]]}>
                <Text style={styles.personalityText}>{aiPersonality}</Text>
              </View>
            </View>
            <Pressable onPress={hideAssistant}>
              <Ionicons name="close" size={24} color="#666" />
            </Pressable>
          </View>

          {/* Proactive Suggestions */}
          {aiSuggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <Text style={styles.sectionTitle}>Suggestions</Text>
              {aiSuggestions.map((suggestion, index) => (
                <Pressable 
                  key={index}
                  style={styles.suggestionCard}
                  onPress={suggestion.action}
                >
                  <Text style={styles.suggestionText}>{suggestion.text}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#667EEA" />
                </Pressable>
              ))}
            </View>
          )}

          {/* Quick Actions based on space type */}
          <View style={styles.quickActions}>
            <Text style={styles.sectionTitle}>Quick Help</Text>
            <View style={styles.actionGrid}>
              {aiCapabilities.includes('summarize') && (
                <Pressable style={styles.actionButton} onPress={generateSummary}>
                  <Ionicons name="document-text" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Summarize</Text>
                </Pressable>
              )}
              {aiCapabilities.includes('suggest') && (
                <Pressable style={styles.actionButton} onPress={suggestAlternatives}>
                  <Ionicons name="bulb" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Suggest Ideas</Text>
                </Pressable>
              )}
              {aiCapabilities.includes('moderate') && (
                <Pressable style={styles.actionButton} onPress={() => queryAI("Check for consensus")}>
                  <Ionicons name="people" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Check Consensus</Text>
                </Pressable>
              )}
              {aiCapabilities.includes('inspire') && (
                <Pressable style={styles.actionButton} onPress={generateIcebreaker}>
                  <Ionicons name="color-wand" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Inspire</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Chat with AI */}
          <View style={styles.chatSection}>
            <Text style={styles.sectionTitle}>Ask Assistant</Text>
            <View style={styles.chatContainer}>
              {chatHistory.map((msg, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.chatBubble,
                    msg.type === 'ai' ? styles.aiBubble : styles.userBubble
                  ]}
                >
                  <Text style={styles.chatText}>{msg.text}</Text>
                  {msg.metadata?.confidence && (
                    <Text style={styles.confidenceText}>
                      Confidence: {Math.round(msg.metadata.confidence * 100)}%
                    </Text>
                  )}
                </View>
              ))}
              
              {aiThinking && (
                <View style={styles.thinkingBubble}>
                  <Text style={styles.thinkingText}>Thinking</Text>
                  <View style={styles.thinkingDots}>
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                  </View>
                </View>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ask about collaboration, ideas, or help..."
                value={userInput}
                onChangeText={setUserInput}
                onSubmitEditing={async () => {
                  if (userInput.trim()) {
                    const userMessage = userInput;
                    setUserInput('');
                    
                    // Add user message to history
                    setChatHistory(prev => [...prev, {
                      type: 'user',
                      text: userMessage,
                      timestamp: new Date()
                    }]);
                    
                    // Get AI response
                    await queryAI(userMessage);
                  }
                }}
              />
              <Pressable 
                style={styles.sendButton}
                onPress={async () => {
                  if (userInput.trim()) {
                    const userMessage = userInput;
                    setUserInput('');
                    setChatHistory(prev => [...prev, {
                      type: 'user',
                      text: userMessage,
                      timestamp: new Date()
                    }]);
                    await queryAI(userMessage);
                  }
                }}
              >
                <Ionicons name="send" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  floatingAIButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667EEA',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },

  aiPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },

  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  aiTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  aiTitleText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 16,
  },
});
