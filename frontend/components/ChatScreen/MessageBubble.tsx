import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '@/components/Image/Avatar';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    type: string;
    user?: {
      id: number;
      name: string;
      profile_photo?: string;
    };
    created_at: string;
    reactions?: any[];
    metadata?: any;
  };
  isCurrentUser: boolean;
  showAvatar: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isCurrentUser,
  showAvatar,
  isSelected,
  onPress,
  onLongPress,
}) => {
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: message.metadata?.url || 'https://via.placeholder.com/300' }}
              style={styles.image}
              resizeMode="cover"
            />
            {message.content && (
              <Text style={styles.imageCaption}>{message.content}</Text>
            )}
          </View>
        );
        
      case 'voice':
        return (
          <View style={styles.voiceContainer}>
            <Ionicons name="mic" size={20} color="#007AFF" />
            <Text style={styles.voiceDuration}>
              {message.metadata?.duration || '0:30'}
            </Text>
            <View style={styles.waveform}>
              {Array.from({ length: 20 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveformBar,
                    { height: Math.random() * 20 + 4 }
                  ]}
                />
              ))}
            </View>
          </View>
        );
        
      default:
        return (
          <Text style={[
            styles.textContent,
            isCurrentUser ? styles.currentUserText : styles.otherUserText
          ]}>
            {message.content}
          </Text>
        );
    }
  };

  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;
    
    const reactionCounts: Record<string, number> = {};
    message.reactions.forEach(r => {
      reactionCounts[r.reaction] = (reactionCounts[r.reaction] || 0) + 1;
    });
    
    return (
      <View style={[
        styles.reactionsContainer,
        isCurrentUser ? styles.currentUserReactions : styles.otherUserReactions
      ]}>
        {Object.entries(reactionCounts).map(([reaction, count]) => (
          <View key={reaction} style={styles.reactionBadge}>
            <Text style={styles.reactionEmoji}>{reaction}</Text>
            {count > 1 && (
              <Text style={styles.reactionCount}>{count}</Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.container,
        isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer,
        isSelected && styles.selectedContainer
      ]}
    >
      {!isCurrentUser && showAvatar && (
        <View style={styles.avatarContainer}>
          <Avatar
            source={message.user?.profile_photo}
            size={32}
            name={message.user?.name}
            showStatus={false}
          />
        </View>
      )}
      
      <View style={[
        styles.bubbleContainer,
        isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
      ]}>
        {!isCurrentUser && showAvatar && (
          <Text style={styles.userName}>{message.user?.name}</Text>
        )}
        
        {renderContent()}
        
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>
            {formatTime(message.created_at)}
          </Text>
          {isCurrentUser && (
            <Ionicons 
              name="checkmark-done" 
              size={12} 
              color={message.metadata?.read ? "#007AFF" : "#999"} 
            />
          )}
        </View>
        
        {renderReactions()}
      </View>
      
      {isCurrentUser && showAvatar && (
        <View style={styles.avatarContainer}>
          <Avatar
            source={message.user?.profile_photo}
            size={32}
            name={message.user?.name}
            showStatus={false}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
    marginHorizontal: 8,
    paddingHorizontal: 8,
  },
  currentUserContainer: {
    justifyContent: 'flex-end',
  },
  otherUserContainer: {
    justifyContent: 'flex-start',
  },
  selectedContainer: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
  },
  avatarContainer: {
    marginHorizontal: 8,
    marginBottom: 4,
  },
  bubbleContainer: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 18,
  },
  currentUserBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  textContent: {
    fontSize: 16,
    lineHeight: 22,
  },
  currentUserText: {
    color: '#fff',
  },
  otherUserText: {
    color: '#333',
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  imageCaption: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  voiceDuration: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  waveformBar: {
    width: 2,
    backgroundColor: '#007AFF',
    marginHorizontal: 1,
    borderRadius: 1,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginRight: 4,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  currentUserReactions: {
    justifyContent: 'flex-end',
  },
  otherUserReactions: {
    justifyContent: 'flex-start',
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    color: '#666',
    marginLeft: 2,
  },
});

export default MessageBubble;