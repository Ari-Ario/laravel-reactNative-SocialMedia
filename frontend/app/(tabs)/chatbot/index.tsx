import { useState, useEffect, useContext, useRef } from 'react';
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
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
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
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    Keyboard.dismiss();
    setIsTyping(true);

    try {
      const API_BASE = getApiBase();
      const { data } = await axios.post(`${API_BASE}/chatbot`, {
        message: input,
        conversation_id: conversationId.current,
      });

      conversationId.current = data.conversation_id;

      const botReply = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'bot',
        type: data.response.includes('*') ? 'ai' : 'text'
      };

      setMessages(prev => [...prev, botReply]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: 'Sorry, I\'m having trouble connecting.',
        sender: 'bot',
        type: 'error'
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
          isUser ? styles.userBubble : styles.botBubble,
          isAI && styles.aiBubble,
          isError && styles.errorBubble,
        ]}
      >
        {isAI && <Text style={styles.aiTag}>AI</Text>}
        <Text style={[styles.messageText, isError && { color: '#fff' }]}>{item.text}</Text>
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
        <View style={styles.typingContainer}>
          <ActivityIndicator size="small" color="#666" />
          <Text style={styles.typingText}>Bot is typing...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask me anything..."
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity onPress={handleSend} style={styles.sendButton} disabled={isTyping}>
          <Text style={styles.sendButtonText}>{isTyping ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  chatContainer: { padding: 16, paddingBottom: 100 },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    marginVertical: 6,
    borderRadius: 18,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
  },
  botBubble: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#eee',
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
    borderColor: '#ddd',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    padding: 12,
    borderRadius: 25,
    fontSize: 16,
    maxHeight: 100,
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