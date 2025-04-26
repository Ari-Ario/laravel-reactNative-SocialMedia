import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { View, StyleSheet, Button } from 'react-native';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import axios from '@/services/axios';
import AuthContext from '@/context/AuthContext';
import getApiBase from '@/services/getApiBase';

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const conversationId = useRef<string | null>(null);
  const { user } = useContext(AuthContext);
  const [isTyping, setIsTyping] = useState(false);


  // Add Message History
    // const loadHistory = useCallback(async () => {
    //     try {
    //     const { data } = await axios.get('/chat/history');
    //     setMessages(data.messages.map(convertToGiftedChatFormat));
    //     } catch (error) {
    //     console.error('Failed to load chat history', error);
    //     }
    // }, []);

    // useEffect(() => {
    //     loadHistory();
    // }, []);


  //  Chatbot Functions below:
  useEffect(() => {
    setMessages([
      {
        _id: 1,
        text: 'Hello! How can I help you today?',
        createdAt: new Date(),
        user: {
          _id: 2,
          name: 'Chatbot',
          avatar: 'https://placeimg.com/140/140/any',
        },
      },
    ]);
  }, []);

  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));
    setIsTyping(true);
    // ... existing send logic ...
    try {
        const API_BASE = getApiBase();
        const userMessage = newMessages[0].text;
        const { data } = await axios.post(`${API_BASE}/chat`, {
            message: userMessage,
            conversation_id: conversationId.current
        });
        console.log(data);
        conversationId.current = data.conversation_id;

        const botMessage: IMessage = {
            _id: Math.round(Math.random() * 1000000),
            text: data.response,
            createdAt: new Date(),
            user: {
            _id: 2,
            name: 'Chatbot',
            avatar: 'https://placeimg.com/140/140/any',
            },
        };

      setMessages(previousMessages => GiftedChat.append(previousMessages, [botMessage]));
        } catch (error) {
        const errorMessage: IMessage = {
            _id: Math.round(Math.random() * 1000000),
            text: 'Sorry, I encountered an error. Please try again.',
            createdAt: new Date(),
            user: {
            _id: 2,
            name: 'Chatbot',
            avatar: 'https://placeimg.com/140/140/any',
            },
        };
        
        setMessages(previousMessages => GiftedChat.append(previousMessages, [errorMessage]));
        }

        setIsTyping(false);
    }, []);

  return (
    <View style={styles.container}>
      <GiftedChat
        messages={messages}
        onSend={messages => onSend(messages)}
        user={{
          _id: user?.id || 1,
          name: user?.name || 'User',
          avatar: user?.avatar || 'https://placeimg.com/140/140/any',
        }}
        placeholder="Type your message here..."
        showUserAvatar
        alwaysShowSend
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',  
},
});