import { useState, useEffect, useContext, useRef } from 'react';
import { useAppTheme } from '@/hooks/useAppTheme';
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
} from 'react-native';
import AuthContext from '@/context/AuthContext';
import getApiBase from '@/services/getApiBase';
import axios from '@/services/axios';

export default function ChatbotScreen() {
  const { colors, activeScheme } = useAppTheme();
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [inputHeight, setInputHeight] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const conversationId = useRef(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    setMessages([
      {
        id: Date.now(),
        text: 'Hello! How can I help you today?',
        sender: 'bot',
        type: 'text'
      },
    ]);
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: input,
      sender: 'user',
      type: 'text' as const,
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

      const botReply = {
        id: Date.now() + 1,
        text: data.response || "No response",
        sender: 'bot' as const,
        type: data.response?.includes('powered by AI') || data.response?.includes('*') ? 'ai' : 'text',
      };

      setMessages(prev => [...prev, botReply]);

    } catch (error: any) {
      console.error("Chatbot error:", error.message);

      let errorText = "Sorry, I'm having trouble connecting.";

      if (error.code === 'ECONNABORTED') {
        errorText = "The AI is thinking deeply... this can take up to 45 seconds.";
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

  const renderItem = ({ item }) => {
    const isUser = item.sender === 'user';
    const isAI = item.type === 'ai';
    const isError = item.type === 'error';

    return (
      <Animated.View
        style={[
          styles.messageBubble,
          isUser ? [styles.userBubble, { backgroundColor: colors.tint }] : [styles.botBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
          isAI && [styles.aiBubble, { backgroundColor: activeScheme === 'dark' ? colors.muted : '#E6F7FF', borderColor: colors.tint }],
          isError && styles.errorBubble,
        ]}
      >
        {isAI && <Text style={[styles.aiTag, { color: colors.tint }]}>AI</Text>}
        <Text style={[styles.messageText, { color: isUser || isError ? '#fff' : colors.text }]}>{item.text}</Text>
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
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.chatContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {isTyping && (
        <View style={{ padding: 15, alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, padding: 12, borderRadius: 18 }}>
            <ActivityIndicator size="small" color={colors.tint} />
            <Text style={{ marginLeft: 10, color: colors.textSecondary }}>AI is thinking...</Text>
          </View>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask me anything..."
          placeholderTextColor={colors.textSecondary + '80'}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          multiline
          numberOfLines={1}
          textAlignVertical="top"
          blurOnSubmit={false}
          keyboardAppearance={activeScheme}
          onContentSizeChange={(e) => {
            setInputHeight(e.nativeEvent.contentSize.height);
            // keep the list scrolled to end when typing
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
          }}
        />
        <TouchableOpacity onPress={handleSend} style={[styles.sendButton, { backgroundColor: colors.tint }]} disabled={isTyping}>
          <Text style={styles.sendButtonText}>{isTyping ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chatContainer: { padding: 16, paddingBottom: 100 },
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
    ...(Platform.OS === 'ios' && {
      bottom: 80
    }),
    ...(Platform.OS === 'web' && {
      bottom: 60,
    }),
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