// components/ChatScreen/ChatRow.tsx
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import getApiBaseImage from '@/services/getApiBaseImage';

interface ChatRowProps {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp: string;
  unreadCount?: number;
  avatar?: string;
  isOnline?: boolean;
  isPinned?: boolean;
  user_id: string;
  type: 'chat' | 'contact';
}

const ChatRow = ({ 
  id, 
  name, 
  lastMessage, 
  timestamp, 
  unreadCount = 0, 
  avatar, 
  isOnline = false,
  isPinned = false,
  type = 'chat'
}: ChatRowProps) => {
  
  const renderContent = () => (
    <Pressable style={styles.container}>
      <View style={styles.avatarContainer}>
        <Image 
          source={{ uri: avatar ? `${getApiBaseImage()}/storage/${avatar}` : 'https://via.placeholder.com/50' }} 
          style={styles.avatar}
        />
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {type === 'chat' && (
            <Text style={styles.timestamp}>{timestamp}</Text>
          )}
        </View>
        
        <View style={styles.footer}>
          <Text style={[styles.lastMessage, type === 'contact' && styles.contactMessage]} numberOfLines={1}>
            {lastMessage || (type === 'contact' ? 'Available for chat' : 'Start a conversation...')}
          </Text>
          
          {type === 'chat' ? (
            unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )
          ) : (
            <Ionicons name="chatbubble-outline" size={20} color="#007AFF" />
          )}
        </View>
      </View>

      {type === 'chat' && isPinned && (
        <Ionicons name="pin" size={16} color="#666" style={styles.pinIcon} />
      )}
    </Pressable>
  );

  if (type === 'chat') {
    return (
      <Link href={`/(tabs)/chats/${id}`} asChild>
        {renderContent()}
      </Link>
    );
  }

  return renderContent();
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    position: 'relative',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    marginRight: 8,
  },
  contactMessage: {
    color: '#007AFF',
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pinIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});

export default ChatRow;