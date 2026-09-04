// app/chatbot/index.tsx
import { useState, useEffect, useContext, useRef, useCallback, useMemo, Fragment } from 'react';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  Alert,
  Share,
  Clipboard,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import AuthContext from '@/context/AuthContext';
import getApiBase from '@/services/getApiBase';
import axios from '@/services/axios';
import { createShadow } from '@/utils/styles';
import { useChatbotStore, Message, Conversation } from '@/stores/chatbotStore';
import { useDialecticalUIStore } from '@/stores/dialecticalUIStore';
import { useModal } from '@/context/ModalContext';
import ConversationAxiomPanel from '@/components/ConversationAxiomPanel';
import { MessageItem } from '@/components/chatbot/MessageItem';
import { useToastStore } from '@/stores/toastStore';


const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Suggested prompts — 12 prompts across all 6 dialectical phases
const SUGGESTED_PROMPTS = [
  // Phase 2: Logic
  { icon: 'shield-checkmark', text: 'prompt_modus_ponens', color: '#10B981', query: 'prove: Modus Ponens formal logic' },
  { icon: 'git-merge', text: 'prompt_de_morgan', color: '#059669', query: "prove: De Morgan's Laws via truth table" },
  // Phase 3: Mathematics
  { icon: 'calculator', text: 'prompt_prove_divisibility', color: '#E53935', query: 'prove: 6 divides n^3 - n' },
  { icon: 'analytics', text: 'prompt_binomial', color: '#FF9800', query: 'prove: Sum(i=1..n) i^2 = n*(n+1)*(2*n+1)/6' },
  { icon: 'apps', text: 'prompt_riemann', color: '#F59E0B', query: 'prove: Riemann Hypothesis (unsolved)' },
  // Phase 4: Physics & Chemistry
  { icon: 'timer', text: 'prompt_explain_relativity', color: '#1565C0', query: 'prove: General Relativity & Speed of Light Limit' },
  { icon: 'nuclear', text: 'prompt_quantum', color: '#3B82F6', query: "prove: Heisenberg's Uncertainty Principle" },
  // Phase 5: Life Sciences
  { icon: 'leaf', text: 'prompt_hardy_weinberg', color: '#2E7D32', query: 'calculate: Hardy-Weinberg Genetic Equilibrium where p=0.6, q=0.4' },
  { icon: 'body', text: 'prompt_neuron', color: '#84CC16', query: 'prove: Hodgkin-Huxley model of action potential' },
  // Phase 6: Applied
  { icon: 'bar-chart', text: 'prompt_nash', color: '#9C27B0', query: 'prove: Nash Equilibrium (Game Theory)' },
  { icon: 'people', text: 'prompt_social', color: '#06B6D4', query: 'prove: Dunbar number limit of social group size' },
  { icon: 'mail', text: 'prompt_email_promotion', color: '#667EEA', query: 'Write an email for a promotion' },
];


const formatTimestamp = (dateInput: Date | string) => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};



export default function ChatbotScreen() {
  const router = useRouter();
  const { openModal } = useModal();
  const { colors, activeScheme } = useAppTheme();
  const { t, isRTL } = useTranslation();
  const { user } = useContext(AuthContext);
  const { showToast } = useToastStore();

  const {
    conversations,
    currentConversationId,
    isTyping,
    addConversation,
    deleteConversation,
    addMessage,
    updateLastMessage,
    updateConversationTitle,
    togglePin,
    setMessageFeedback,
    setIsTyping,
    clearConversation,
    setCurrentConversationId,
    currentModel,
    setCurrentModel,
    truncateMessagesAfter,
    pruneConversation,
  } = useChatbotStore();

  const [input, setInput] = useState('');
  const [inputHeight, setInputHeight] = useState(44);
  const [showSidebar, setShowSidebar] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // ── Expansion states — live in dialecticalUIStore for per-item targeted re-renders ──
  const toggleMessage = useDialecticalUIStore((s) => s.toggleMessage);
  const toggleUserMessage = useDialecticalUIStore((s) => s.toggleUserMessage);
  const toggleAxiomTree = useDialecticalUIStore((s) => s.toggleAxiomTree);
  const setExpandedUserMessageId = useDialecticalUIStore((s) => s.setExpandedUserMessageId);

  // Model selection animation
  const selectorAnim = useRef(new Animated.Value(0)).current;

  const messages = useMemo(() => {
    const conv = conversations.find(c => c.id === currentConversationId);
    return conv ? conv.messages : [];
  }, [conversations, currentConversationId]);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // Available models
  const availableModels = [
    { id: 'phi-3', name: t('model_trial_name'), description: t('model_trial_desc'), icon: '🔍', color: '#FF9800' },
    { id: 'mistral', name: t('model_deductive_name'), description: t('model_deductive_desc'), icon: '⚙️', color: '#2196F3' },
    { id: 'llama-3', name: t('model_inductive_name'), description: t('model_inductive_desc'), icon: '⚖️', color: '#4CAF50' },
  ];

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0 || isTyping) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isTyping, currentConversationId]);

  // Model selection animation — useNativeDriver: false to avoid web warnings
  useEffect(() => {
    const index = availableModels.findIndex(m => m.id === currentModel);
    if (index !== -1) {
      Animated.spring(selectorAnim, {
        toValue: index,
        useNativeDriver: Platform.OS !== 'web',
        tension: 50,
        friction: 8,
      }).start();
    }
  }, [currentModel]);

  /**
   * Chunked RAF-based streamer — batches 4 words per animation frame
   * to prevent main-thread blockage on long responses (PerformanceReport.md: FlatList optimization)
   */
  const streamResponse = useCallback(async (text: string, messageId: string, convId: string) => {
    const words = text.split(' ');
    let idx = 0;
    setStreamingMessageId(messageId);

    await new Promise<void>((resolve) => {
      const CHUNK = isWeb ? 5 : 3;
      function step() {
        if (idx >= words.length) {
          setStreamingMessageId(null);
          resolve();
          return;
        }
        const slice = words.slice(0, idx + CHUNK).join(' ');
        idx += CHUNK;
        updateLastMessage(convId, slice);
        if (isWeb) {
          requestAnimationFrame(step);
        } else {
          setTimeout(step, 12);
        }
      }
      step();
    });
  }, [updateLastMessage]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    await submitMessage(input.trim());
  };

  const submitMessage = async (messageText: string) => {
    if (isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      type: 'text',
      timestamp: new Date().toISOString(),
    };

    const isNewConversation = !currentConversationId;
    let convId = currentConversationId;
    if (isNewConversation) {
      convId = Date.now().toString();
      const newConv: Conversation = {
        id: convId,
        title: messageText.slice(0, 30) + (messageText.length > 30 ? '...' : ''),
        messages: [userMessage],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        model: currentModel,
        isPinned: false
      };
      addConversation(newConv);
      setCurrentConversationId(convId);
    } else {
      if (editingMessageId) {
        truncateMessagesAfter(convId!, editingMessageId);
      }
      addMessage(convId!, userMessage);
    }
    setInput('');
    setEditingMessageId(null);
    setInputHeight(44);
    Keyboard.dismiss();
    setIsTyping(true);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const API_BASE = getApiBase();

      // Extract the last 3 messages from the current conversation for context
      const currentConv = useChatbotStore.getState().conversations.find(c => c.id === convId);
      const history = currentConv
        ? currentConv.messages.slice(-3).map(m => ({ sender: m.sender, text: m.text }))
        : [];

      const response = await axios.post(
        `${API_BASE}/chatbot`,
        {
          message: messageText,
          conversation_id: convId,
          model: currentModel,
          history: history // Passing the fades of the conversation statelessly
        },
        {
          timeout: 200000,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = response.data;
      const botReplyId = (Date.now() + 1).toString();
      
      // Dynamic Enhancement: Detect malformed backend responses to prevent "Cannot read properties of undefined (reading 'includes')"
      if (!data || typeof data.response !== 'string') {
        console.error("[DIALECTICAL ENGINE ERROR] Backend Payload Missing 'response'. Received:", data);
        const debugInfo = typeof data === 'object' ? JSON.stringify(data) : String(data);
        throw new Error(`Server returned invalid payload: ${debugInfo}`);
      }
      
      const hasCodeBlock = (data?.response || '').includes('```');

      const botReply: Message = {
        id: botReplyId,
        text: '',
        sender: 'bot',
        type: hasCodeBlock ? 'code' : 'ai',
        timestamp: new Date().toISOString(),
        tokens: data?.tokens_used,
        model: currentModel,
        reasoning: data?.reasoning,
        sources: data?.sources,
        isAxiom: data?.is_axiom,
        status: data?.status,
        confidenceScore: data?.confidence_score,
        axiomId: data?.axiom_id,
        // ── New dialectical fields from engine ─────────────────────────
        parentAxioms: data?.parent_axioms ?? [],
        branch: data?.branch,
        domainPartition: data?.domain_partition,
        isNewFallback: data?.is_fallback === true,
        trainingTicketId: data?.training_ticket_id ?? undefined,
      };

      addMessage(convId!, botReply);
      await streamResponse(data?.response || t('error'), botReplyId, convId!);

      // ── Anti-Lazy Memory Guard: prune when over 100 messages ──
      const liveConv = useChatbotStore.getState().conversations.find(c => c.id === convId);
      if (liveConv && liveConv.messages.length > 100) {
        pruneConversation(convId!, 80);
      }

    } catch (error: any) {
      console.error("Chatbot error:", error?.message || String(error));
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: t('ai_error'),
        sender: 'bot',
        type: 'error',
        timestamp: new Date().toISOString(),
      };
      const fallbackConvId = convId || 'default';
      addMessage(fallbackConvId, errorMsg);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAxiomClick = (id: string, thesis: string) => {
    // Generate the localized query or fallback
    const query = t('please_explain_axiom', { id, thesis }) !== 'please_explain_axiom'
      ? t('please_explain_axiom', { id, thesis })
      : `Please explain the logical foundation of Axiom #${id}: ${thesis}`;

    submitMessage(query);
  };

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setInput('');
    setShowSidebar(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCopyMessage = async (text: string) => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
        window.alert(t('copied_to_clipboard'));
      } else {
        Clipboard.setString(text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('copy'), t('copied_to_clipboard'));
      }
    } catch {
      // Fallback for browsers that block clipboard access
      if (Platform.OS === 'web') {
        window.alert(t('copied_to_clipboard'));
      }
    }
  };

  const handleEditMessage = useCallback((item: Message) => {
    setInput(item.text);
    setEditingMessageId(item.id);
    setExpandedUserMessageId(null);
    setTimeout(() => inputRef.current?.focus(), 100);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setInput('');
    setEditingMessageId(null);
    setInputHeight(44);
  }, []);

  const handleShareMessage = (item: Message) => {
    openModal('share', {
      idea: {
        id: item.id,
        content: item.text,
        type: 'ai_response',
        metadata: {
          confidence: 0.95, // Default for shared bot responses
        }
      }
    });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFeedback = async (message: Message, feedback: 'up' | 'down' | 'expert_review' | null) => {
    if (!currentConversationId) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Expert review is an escalation — keep local feedback as 'down', just send to backend
    if (feedback === 'expert_review') {
      try {
        const conv = conversations.find(c => c.id === currentConversationId);
        const msgIndex = conv?.messages.findIndex(m => m.id === message.id) ?? -1;
        const userQuery = msgIndex > 0 ? conv?.messages[msgIndex - 1]?.text : '';
        await axios.post('/ai/submit-feedback', {
          query: userQuery || message.text,
          response: message.text,
          type: 'expert_review',
          mode: currentModel,
          axiom_id: (message as any).axiomId,
          branch: message.branch,
          domain_partition: message.domainPartition,
          training_ticket_id: message.trainingTicketId,
        });
        showToast('🔬 Escalated to Expert Pancracy Review.', 'success');
      } catch (error) {
        console.error('Error submitting expert review:', error);
        showToast('Failed to escalate for expert review.', 'error');
      }
      return;
    }

    // 1. Update local state immediately for UI responsiveness
    setMessageFeedback(currentConversationId, message.id, feedback as 'up' | 'down' | null);

    // 2. Sync to backend to reinforce Inductive Logic
    if (feedback) {
      try {
        const conv = conversations.find(c => c.id === currentConversationId);
        const msgIndex = conv?.messages.findIndex(m => m.id === message.id) ?? -1;
        const userQuery = msgIndex > 0 ? conv?.messages[msgIndex - 1]?.text : '';

        const payload = {
          query: userQuery || message.text,
          response: message.text,
          type: feedback === 'up' ? 'save' : 'discard',
          mode: currentModel,
          axiom_id: (message as any).axiomId,
          branch: message.branch,
          domain_partition: message.domainPartition,
          training_ticket_id: message.trainingTicketId,
        };

        await axios.post('/ai/submit-feedback', payload);
        
        if (feedback === 'up') {
          showToast('✅ Engine learned from your vote. Logic reinforced.', 'success');
        } else {
          showToast('⚠️ Contradiction logged. Queued for Expert Review.', 'error');
        }
      } catch (error) {
        console.error("Error submitting feedback to backend:", error);
        showToast('Failed to submit feedback.', 'error');
      }
    }
  };

  const handleUseMessage = (text: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Native Alert for choice
    if (Platform.OS !== 'web') {
      Alert.alert(
        t('use_insight'),
        t('use_insight_desc'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('create_post'),
            onPress: () => {
              router.push({
                pathname: '/(tabs)/spaces/create' as any,
                params: {
                  title: text.substring(0, 30),
                  description: text,
                  type: 'post'
                }
              });
            }
          }
        ]
      );
    } else {
      // Web confirm
      if (window.confirm(t('create_post_from_ai'))) {
        router.push({
          pathname: '/(tabs)/spaces/create' as any,
          params: {
            title: text.substring(0, 30),
            description: text,
            type: 'post'
          }
        });
      }
    }
  };

  const handleLoadConversation = (conv: Conversation) => {
    setCurrentConversationId(conv.id);
    setShowSidebar(false);
  };

  const handleDeleteConversation = (id: string) => {
    const performDelete = () => deleteConversation(id);

    if (Platform.OS === 'web') {
      if (window.confirm(t('delete_chat_warning'))) {
        performDelete();
      }
      return;
    }

    Alert.alert(
      t('delete_chat'),
      t('delete_chat_warning'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: performDelete
        }
      ]
    );
  };

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => (
    <MessageItem 
      item={item} 
      index={index} 
      isStreaming={streamingMessageId === item.id}
      onEdit={handleEditMessage}
      onCopy={handleCopyMessage}
      onFeedback={handleFeedback}
      onUse={handleUseMessage}
      onAxiomClick={handleAxiomClick}
      onShare={handleShareMessage}
      user={user}
      colors={colors}
      activeScheme={activeScheme}
      t={t}
      styles={styles}
    />
  ), [streamingMessageId, handleEditMessage, handleCopyMessage, handleFeedback, handleUseMessage, handleShareMessage, user, colors, activeScheme, t]);

  const SuggestedPrompts = () => (
    <View style={styles.suggestedContainer}>
      <Text style={styles.suggestedTitle}>{t('suggested')}</Text>
      <View style={styles.suggestedGrid}>
        {SUGGESTED_PROMPTS.map((prompt, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.suggestedCard, { borderColor: prompt.color + '30', backgroundColor: colors.muted + '50' }]}
            onPress={() => {
              setInput(prompt.query);
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={[styles.suggestedIcon, { backgroundColor: prompt.color + '15' }]}>
              <Ionicons name={prompt.icon as any} size={20} color={prompt.color} />
            </View>
            <Text style={[styles.suggestedText, { color: colors.text }]}>{t(prompt.text)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const activeStrategy = useMemo(() => {
    if (currentModel === 'phi-3') {
      return {
        phase: 'Phase 1: Empirical Observation',
        desc: 'Trial & Error Base Verification',
        icon: 'eye-outline',
        color: '#FF9800'
      };
    }
    if (currentModel === 'mistral') {
      return {
        phase: 'Phase 2: Deductive Purification',
        desc: 'Socratic Sieve & Propositional AST Logic',
        icon: 'git-commit-outline',
        color: '#2196F3'
      };
    }
    return {
      phase: 'Phase 3: Inductive Parity Scaling',
      desc: 'n ➔ n+1 Algebraic Proof & Global Axiom Promotion',
      icon: 'trending-up-outline',
      color: '#4CAF50'
    };
  }, [currentModel]);

  // Model Switcher — uses onLayout for dynamic width (fixed hardcoded 220 bug)
  const [segmentWidth, setSegmentWidth] = useState(220);
  const ModelSwitcher = () => {
    const selectorX = selectorAnim.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [
        2,
        (segmentWidth - 4) / 3 + 2,
        ((segmentWidth - 4) / 3) * 2 + 2
      ],
    });

    // Short labels for the 3 phases in the segmented control
    const segLabels: Record<string, string> = {
      'phi-3':    '🔬 P1',
      'mistral':  '⚙️ P2',
      'llama-3':  '⚖️ P3',
    };

    return (
      <View
        style={[styles.segmentedControl, { backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
        onLayout={(e) => setSegmentWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            styles.segmentIndicator,
            {
              width: Math.max(1, (segmentWidth - 4) / 3),
              transform: [{ translateX: selectorX }],
              backgroundColor: activeScheme === 'dark' ? '#333' : '#fff'
            }
          ]}
        />
        {availableModels.map((model) => (
          <TouchableOpacity
            key={model.id}
            style={styles.segment}
            onPress={() => {
              setCurrentModel(model.id);
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: currentModel === model.id ? colors.text : colors.textSecondary,
                  opacity: currentModel === model.id ? 1 : 0.7
                }
              ]}
              numberOfLines={1}
            >
              {segLabels[model.id] ?? model.name.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior='padding'
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : Platform.OS === 'android' ? 60 : 0}
    >
      <Sidebar
        visible={showSidebar}
        onClose={() => setShowSidebar(false)}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onLoadConversation={handleLoadConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onTogglePin={togglePin}
        colors={colors}
        t={t}
        activeScheme={activeScheme}
        isTyping={isTyping}
      />
      {/* Header */}
      <LinearGradient
        colors={[colors.background, colors.background + 'f0']}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => setShowSidebar(true)} style={styles.headerButton}>
            <Ionicons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ModelSwitcher />

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleNewChat} style={styles.headerButton}>
            <Ionicons name="add" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Model Strategy Legend Banner */}
      <View style={[styles.strategyStrip, { backgroundColor: activeScheme === 'dark' ? '#1c1c1e' : '#f2f2f7', borderBottomColor: colors.border }]}>
        <Ionicons name={activeStrategy.icon as any} size={13} color={activeStrategy.color} />
        <Text style={[styles.strategyPhase, { color: activeStrategy.color }]}>{activeStrategy.phase}:</Text>
        <Text style={[styles.strategyDesc, { color: colors.textSecondary }]} numberOfLines={1}>{activeStrategy.desc}</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        style={styles.flatListStyle}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        // PerformanceReport.md: FlatList virtualization tuning
        maxToRenderPerBatch={5}
        windowSize={3}
        initialNumToRender={12}
        removeClippedSubviews={Platform.OS !== 'web'}
        updateCellsBatchingPeriod={100}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        ListFooterComponent={
          isTyping ? (
            <View style={styles.typingContainer}>
              <View style={styles.typingAvatar}>
                <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.avatarGradient}>
                  <Ionicons name="sparkles" size={16} color="#fff" />
                </LinearGradient>
              </View>
              <View style={[styles.typingBubble, { backgroundColor: activeScheme === 'dark' ? '#1E1E2E' : '#F5F5F5' }]}>
                <View style={styles.typingDots}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </View>
                <Text style={[styles.typingText, { color: colors.textSecondary }]}>
                  {availableModels.find(m => m.id === currentModel)?.name ?? 'Zmzir AI'} · {t('ai_thinking') || 'Thinking...'}
                </Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeHeader}>
              {/* Layered halo gradient icon */}
              <View style={styles.welcomeIconHalo}>
                <LinearGradient colors={['rgba(102,126,234,0.15)', 'rgba(118,75,162,0.05)']} style={styles.welcomeHaloRing} />
                <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.welcomeIcon}>
                  <Ionicons name="sparkles" size={38} color="#fff" />
                </LinearGradient>
              </View>

              {/* Title */}
              <Text style={[styles.welcomeTitle, { color: colors.text }]}>{t('welcome_ai')}</Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
                {t('welcome_ai_desc')}
              </Text>

              {/* Phase badges */}
              <View style={styles.phaseBadges}>
                {[
                  { label: '1️⃣ ' + (t('phase_1_trial') || 'Trial'), color: '#E53935' },
                  { label: '2️⃣ ' + (t('phase_2_deductive') || 'Deductive'), color: '#1565C0' },
                  { label: '3️⃣ ' + (t('phase_3_inductive') || 'Inductive'), color: '#2E7D32' },
                ].map((phase) => (
                  <View key={phase.label} style={[styles.phaseBadge, { borderColor: phase.color + '40', backgroundColor: phase.color + '12' }]}>
                    <Text style={[styles.phaseBadgeText, { color: phase.color }]}>{phase.label}</Text>
                  </View>
                ))}
              </View>

              {/* Engine stats row */}
              <View style={styles.engineStats}>
                {[
                  { icon: 'shield-checkmark', val: '216+', label: t('axioms_label') || 'Axioms' },
                  { icon: 'flash', val: '348', label: t('chapters_label') || 'Chapters' },
                  { icon: 'checkmark-circle', val: '100%', label: t('accuracy_label') || 'Accuracy' },
                ].map((stat) => (
                  <View key={stat.label} style={styles.engineStat}>
                    <Ionicons name={stat.icon as any} size={16} color="#667EEA" />
                    <Text style={[styles.engineStatVal, { color: colors.text }]}>{stat.val}</Text>
                    <Text style={[styles.engineStatLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <SuggestedPrompts />
          </View>
        }
      />


      {/* ── Conversation Axiom Panel ── aggregates all axioms referenced in this chat */}
      <ConversationAxiomPanel
        messages={messages}
        colors={colors}
        activeScheme={activeScheme}
        onAxiomClick={handleAxiomClick}
      />

      {/* Input Area */}
      <View style={[styles.inputWrapper, { borderTopColor: colors.border }]}>
        {/* Editing mode notice */}
        {editingMessageId && (
          <View style={[styles.editingNotice, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="pencil-outline" size={13} color={colors.primary} />
            <Text style={[styles.editingNoticeText, { color: colors.primary }]}>{t('editing_message') || 'Editing message…'}</Text>
            <TouchableOpacity onPress={handleCancelEdit} style={styles.editingCancelBtn}>
              <Ionicons name="close-circle" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.muted,
                borderColor: colors.border,
                height: Math.max(44, inputHeight),
              }
            ]}
            placeholder={t('ask_anything')}
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            onContentSizeChange={(e) => {
              const newH = e.nativeEvent.contentSize.height;
              setInputHeight(Math.min(Math.max(newH, 44), 160));
            }}
            multiline
            onKeyPress={(e) => {
              if (e.nativeEvent.key === 'Enter' && !(e.nativeEvent as any).shiftKey) {
                handleSend();
              }
            }}
            maxLength={2000}
            editable={!isTyping}
            scrollEnabled={inputHeight >= 160}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!input.trim() || isTyping) && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={!input.trim() || isTyping}
          >
            <LinearGradient
              colors={['#667EEA', '#764BA2']}
              style={styles.sendButtonGradient}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
          {t('characters_limit_hint', { count: input.length })}
        </Text>
      </View>

      {/* Modals handled via context or sidebars */}
    </KeyboardAvoidingView>
  );
}

// Sidebar component moved outside to fix search focus loss
const Sidebar = ({
  visible,
  onClose,
  currentConversationId,
  onLoadConversation,
  onNewChat,
  onDeleteConversation,
  onTogglePin,
  colors,
  t,
  activeScheme,
  isTyping
}: any) => {
  const { searchQuery, setSearchQuery, getFilteredConversations } = useChatbotStore();
  const filteredConversations = getFilteredConversations();

  if (!visible) return null;

  return (
    <View style={styles.sidebarOverlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <BlurView intensity={95} tint={activeScheme === 'dark' ? 'dark' : 'light'} style={[styles.sidebarContainer, { backgroundColor: colors.background }]}>
        <View style={styles.sidebarHeader}>
          <Text style={[styles.sidebarTitle, { color: colors.text }]}>{t('chat_history')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('search_chats')}
            placeholderTextColor={colors.textSecondary + '80'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity style={styles.newChatButton} onPress={() => { onNewChat(); onClose(); }}>
          <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.newChatGradient}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.newChatText}>{t('start_new_chat')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <FlatList
          data={filteredConversations}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const lastMessage = item.messages[item.messages.length - 1]?.text || '';
            return (
              <TouchableOpacity
                style={[
                  styles.conversationItem,
                  currentConversationId === item.id && { backgroundColor: colors.primary + '15' }
                ]}
                onPress={() => { onLoadConversation(item); onClose(); }}
              >
                <View style={styles.conversationIcon}>
                  <Ionicons name={item.isPinned ? "pin" : "chatbubble"} size={16} color={item.isPinned ? colors.primary : colors.textSecondary} />
                </View>
                <View style={styles.conversationInfo}>
                  <View style={styles.conversationTitleRow}>
                    <Text style={[styles.conversationTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.conversationDate}>{formatTimestamp(item.updatedAt)}</Text>
                  </View>
                  <Text style={styles.conversationSnippet} numberOfLines={1}>
                    {lastMessage}
                  </Text>
                </View>
                <View style={styles.conversationActions}>
                  <TouchableOpacity onPress={() => onTogglePin(item.id)} style={styles.miniAction}>
                    <Ionicons
                      name={item.isPinned ? "pin" : "pin-outline"}
                      size={16}
                      color={item.isPinned ? colors.primary : colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDeleteConversation(item.id)} style={styles.miniAction}>
                    <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.conversationList}
        />
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: isWeb ? 'center' : 'stretch',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: isWeb ? 1440 : '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messagesContainer: {
    width: '100%',
    maxWidth: isWeb ? 1440 : undefined,
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 100,
  },
  inputWrapper: {
    width: '100%',
    maxWidth: isWeb ? 1440 : undefined,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  flatListStyle: {
    width: '100%',
    maxWidth: isWeb ? 1440 : undefined,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modelButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  modelButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderRadius: 20,
  },
  modelButtonText: {
    fontSize: 14,
  },
  modelButtonLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  botWrapper: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  avatarGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  messageContent: {
    flex: 1,
    maxWidth: '85%',
  },
  userContent: {
    alignItems: 'flex-end',
  },
  botContent: {
    alignItems: 'flex-start',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  messageSender: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  userSender: {
    color: '#667EEA',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  modelBadge: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  modelBadgeText: {
    fontSize: 9,
    color: '#2196F3',
    fontWeight: '600',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  botBubble: {
    // Dark mode handled dynamically via inline style above
    borderBottomLeftRadius: 4,
  },
  errorBubble: {
    backgroundColor: '#FF4D4F',
  },
  userMessageText: {
    color: '#fff',
  },
  codeBlock: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 12,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  codeHeaderText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
    flex: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    // Color handled inline via colors.text for full dark-mode support
  },
  codeText: {
    color: '#d4d4d4',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
  },
  streamingCursor: {
    width: 2,
    height: 15,
    backgroundColor: '#667EEA',
    marginLeft: 2,
    ...Platform.select({
      web: {
        display: 'inline-block' as any,
        verticalAlign: 'middle',
      },
      default: {
        display: 'flex',
      }
    })
  },
  codeCopy: {
    padding: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  tokenText: {
    fontSize: 10,
    color: '#999',
  },
  messageActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIcon: {
    padding: 4,
  },
  miniActionIcon: {
    padding: 4,
    marginLeft: 8,
  },
  ideaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.12)',
    gap: 4,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  actionButtonText: {
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '600',
  },
  reasoningContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(102,126,234,0.05)',
    borderRadius: 10,
  },
  reasoningTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#667EEA',
    marginBottom: 6,
  },
  reasoningText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  sourcesContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 10,
  },
  sourcesTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sourceText: {
    fontSize: 11,
    color: '#2196F3',
  },
  typingContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  typingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    // Background color handled dynamically via colors.card for dark mode
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    gap: 12,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#667EEA',
    opacity: 0.6,
  },
  typingText: {
    fontSize: 13,
    color: '#666',
  },
  suggestedContainer: {
    marginTop: 20,
    paddingVertical: 16,
  },
  suggestedTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  suggestedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  suggestedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestedText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  inputHint: {
    fontSize: 10,
    marginTop: 6,
    marginLeft: 16,
  },
  // Editing notice bar
  editingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  editingNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  editingCancelBtn: {
    padding: 2,
  },
  // User message action row
  userMessageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
    paddingRight: 2,
  },
  showMoreText: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  // Sidebar Styles
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: width * 0.8,
    maxWidth: 320,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  newChatButton: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  newChatGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  newChatText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  conversationList: {
    paddingHorizontal: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  conversationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(102,126,234,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  conversationSnippet: {
    fontSize: 10,
    color: '#999',
  },
  conversationActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  conversationDate: {
    fontSize: 10,
    color: '#999',
  },
  miniAction: {
    padding: 4,
  },
  emptyConversations: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  // Model Switcher Styles
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 2,
    position: 'relative',
    height: 36,
    width: 220,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: (220 - 4) / 3,
    borderRadius: 18,
    ...createShadow({ opacity: 0.1, radius: 4 }),
    elevation: 2,
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modelSelectorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelSelectorContainer: {
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 24,
    padding: 20,
    ...createShadow({ opacity: 0.2, radius: 20 }),
  },
  modelSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modelSelectorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modelIcon: {
    fontSize: 24,
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  modelDescription: {
    fontSize: 12,
    color: '#666',
  },
  welcomeContainer: {
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
    width: '100%',
  },
  welcomeHeader: {
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  welcomeIconHalo: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  welcomeHaloRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadow({ opacity: 0.35, radius: 14 }),
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  // Premium welcome screen additions
  phaseBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  phaseBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  phaseBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  engineStats: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 20,
    marginBottom: 4,
    justifyContent: 'center',
  },
  engineStat: {
    alignItems: 'center',
    gap: 3,
  },
  engineStatVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  engineStatLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Strategy Legend Banner Strip
  strategyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: isWeb ? 1440 : undefined,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 6,
  },
  strategyPhase: {
    fontSize: 12,
    fontWeight: '700',
  },
  strategyDesc: {
    fontSize: 12,
    flex: 1,
  },
  // Pedigree Tree
  pedigreeContainer: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pedigreeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  pedigreeTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  pedigreeContent: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  pedigreeTree: {
    gap: 4,
  },
  treeNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nodeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nodeInfo: {
    flex: 1,
  },
  nodeName: {
    fontSize: 12,
    fontWeight: '600',
  },
  nodeRole: {
    fontSize: 10,
    color: '#888',
  },
  treeConnector: {
    width: 1,
    height: 12,
    backgroundColor: '#ccc',
    marginLeft: 3,
  },
  pedigreeFootnote: {
    fontSize: 10,
    marginTop: 10,
    fontStyle: 'italic',
    lineHeight: 14,
  },
  // Sieve Warning Box
  sieveAlert: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  sieveAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sieveAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  sieveAlertText: {
    fontSize: 12,
    lineHeight: 18,
  },
  // Live streaming phase indicator
  livePhaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(102,126,234,0.1)',
  },
  livePhaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#667EEA',
    opacity: 0.8,
  },
  livePhaseText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});