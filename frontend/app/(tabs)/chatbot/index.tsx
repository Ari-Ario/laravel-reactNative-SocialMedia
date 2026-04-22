import { useState, useEffect, useContext, useRef } from 'react';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';
import {
  View,
  Text,
  StyleSheet as RNStyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Animated,
} from 'react-native';
import AuthContext from '@/context/AuthContext';
import getApiBase from '@/services/getApiBase';
import axios from '@/services/axios';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  type: 'text' | 'ai' | 'error';
}

export default function ChatbotScreen() {
  const { colors, activeScheme } = useAppTheme();
  const { t, isRTL } = useTranslation();
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [inputHeight, setInputHeight] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const conversationId = useRef(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setMessages([
      {
        id: Date.now(),
        text: t('bot_welcome'),
        sender: 'bot',
        type: 'text'
      },
    ]);
  }, [t]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: 'user',
      type: 'text',
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    Keyboard.dismiss();
    setIsTyping(true);

    try {
      const API_BASE = getApiBase();

      const response = await axios.post(
        `${API_BASE}/chatbot`,
        {
          message: input,
          conversation_id: conversationId.current,
        },
        {
          timeout: 200000, // ← 200 seconds (Phi-3 on CPU needs this)
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = response.data;
      conversationId.current = data.conversation_id;

      const botReply: Message = {
        id: Date.now() + 1,
        text: data.response || t('error'),
        sender: 'bot',
        type: (data.response?.includes('powered by AI') || data.response?.includes('*')) ? 'ai' : 'text',
      };

      setMessages(prev => [...prev, botReply]);

    } catch (error: any) {
      console.error("Chatbot error:", error.message);

      let errorText = t('ai_error');

      if (error.code === 'ECONNABORTED') {
        errorText = t('ai_thinking_deeply');
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: errorText,
        sender: 'bot',
        type: 'error' as const,
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    const isAI = item.type === 'ai';
    const isError = item.type === 'error';

    return (
      <Animated.View
        style={[
          styles.messageBubble,
          isUser ? [styles.userBubble, { backgroundColor: colors.tint, alignSelf: isRTL ? 'flex-start' : 'flex-end' }] : [styles.botBubble, { backgroundColor: colors.surface, borderColor: colors.border, alignSelf: isRTL ? 'flex-end' : 'flex-start' }],
          isAI && [styles.aiBubble, { backgroundColor: activeScheme === 'dark' ? colors.muted : '#E6F7FF', borderColor: colors.tint }],
          isError && styles.errorBubble,
        ]}
      >
        {isAI && <Text style={[styles.aiTag, { color: colors.tint, textAlign: isRTL ? 'right' : 'left' }]}>AI</Text>}
        <Text style={[styles.messageText, { color: isUser || isError ? '#fff' : colors.text, textAlign: isRTL ? 'right' : 'left' }]}>{item.text}</Text>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef as any}
        data={messages}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.chatContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {isTyping && (
        <View style={{ padding: 15, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: colors.muted, padding: 12, borderRadius: 18 }}>
            <ActivityIndicator size="small" color={colors.tint} />
            <Text style={{ marginHorizontal: 10, color: colors.textSecondary }}>{t('ai_thinking')}</Text>
          </View>
        </View>
      )}

      <View style={[styles.inputContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t('ask_anything')}
          placeholderTextColor={colors.textSecondary + '80'}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          multiline
          numberOfLines={1}
          textAlignVertical="top"
          textAlign={isRTL ? 'right' : 'left'}
          blurOnSubmit={false}
          keyboardAppearance={activeScheme}
          onContentSizeChange={(e) => {
            setInputHeight(e.nativeEvent.contentSize.height);
            // keep the list scrolled to end when typing
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
          }}
        />
        <TouchableOpacity onPress={handleSend} style={[styles.sendButton, { backgroundColor: colors.tint }]} disabled={isTyping}>
          <Text style={styles.sendButtonText}>{isTyping ? '...' : t('send')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = RNStyleSheet.create({
  container: { flex: 1 },
  chatContainer: {
    padding: 16,
    paddingBottom: 100
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    marginVertical: 6,
    borderRadius: 18,
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  botBubble: {
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  aiBubble: {
    backgroundColor: '#E6F7FF',
    borderColor: '#91D5FF',
  },
  errorBubble: {
    backgroundColor: '#FF4D4F',
  },
  aiTag: {
    fontSize: 10,
    color: '#1890FF',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  messageText: { fontSize: 16, color: '#333' },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    alignSelf: 'flex-start',
  },
  typingText: { marginLeft: 8, color: '#666', fontStyle: 'italic' },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'center',
    // marginBottom: Platform.OS === 'ios' ? 80 : 70, // Offset for floating tab bar
    // backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    padding: 12,
    paddingHorizontal: 10,
    marginRight: 10,
    marginBottom: 10,
    ...(Platform.OS !== 'web' && {
      maxHeight: 220,
    }),
  },
  sendButton: {
    marginLeft: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1DA1F2',
    borderRadius: 25,
  },
  sendButtonText: { color: 'white', fontWeight: '600' },
});