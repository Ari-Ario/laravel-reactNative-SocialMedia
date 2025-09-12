// components/ContactRow.tsx
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ContactRowProps {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp: string;
  avatar?: string;
  isOnline?: boolean;
  user_id: string;
  type: 'chat' | 'contact';
}

const ContactRow = ({ 
  id, 
  name, 
  lastMessage, 
  timestamp, 
  avatar, 
  isOnline = false
}: ContactRowProps) => {
  return (
    <Pressable style={styles.container}>
      <View style={styles.avatarContainer}>
        <Image 
          source={{ uri: avatar || 'https://via.placeholder.com/50' }} 
          style={styles.avatar}
        />
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {lastMessage || 'Available for chat'}
          </Text>
          
          <Ionicons name="chatbubble-outline" size={20} color="#007AFF" />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
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
    fontWeight: '500',
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
    fontStyle: 'italic',
  },
});

export default ContactRow;