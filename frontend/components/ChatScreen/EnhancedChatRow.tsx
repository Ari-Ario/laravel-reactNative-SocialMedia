// components/ChatScreen/EnhancedChatRow.tsx
import { View, Text, StyleSheet, Pressable, Alert, TouchableOpacity, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useContext } from 'react';
import getApiBaseImage from '@/services/getApiBaseImage';
import CollaborationService, { CollaborationSpace } from '@/services/ChatScreen/CollaborationService';
import AuthContext from '@/context/AuthContext';
import Avatar from '@/components/Image/Avatar';
import axios from '@/services/axios';
import { getToken } from '@/services/TokenService';
import getApiBase from '@/services/getApiBase';
import { createShadow } from '@/utils/styles';

interface EnhancedChatRowProps {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp: string;
  unreadCount?: number;
  avatar?: string;
  isOnline?: boolean;
  isPinned?: boolean;
  user_id: string;
  type: 'chat' | 'contact' | 'space';
  spaceData?: CollaborationSpace;
  conversationId?: number;
  postId?: number;
  storyId?: number;
  email?: string;
  username?: string;
}

export const EnhancedChatRow: React.FC<EnhancedChatRowProps> = ({
  id,
  name,
  lastMessage,
  timestamp,
  unreadCount = 0,
  avatar,
  isOnline = false,
  isPinned = false,
  user_id,
  type = 'chat',
  spaceData,
  conversationId,
  postId,
  storyId,
  email,
  username,
}) => {
  const [showCollaborationMenu, setShowCollaborationMenu] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const collaborationService = CollaborationService.getInstance();
  const { user } = useContext(AuthContext);
  const API_BASE = getApiBase();
  const token = getToken();
  // Handle contact press - open collaboration menu
  const handleContactPress = () => {
    if (type === 'contact') {
      setShowContactMenu(true);
    }
  };

  // Start a chat with contact
  const handleStartChat = async () => {
    try {
      const spaceRes = await collaborationService.getOrCreateDirectSpace(user_id);
      router.push(`/spaces/${spaceRes.space.id}`);
      setShowContactMenu(false);
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat');
    }
  };

  // Start a video call with contact
  const handleStartVideoCall = async () => {
    try {
      // Find or create the unified direct space
      const spaceRes = await collaborationService.getOrCreateDirectSpace(user_id);
      const spaceId = spaceRes.space.id;

      // Start the call in the space
      const callData = await collaborationService.startCall(spaceId, 'video');

      // Navigate to space with call active
      router.push(`/(spaces)/${spaceId}?call=${callData.call?.id || 'active'}`);
      setShowContactMenu(false);
    } catch (error: any) {
      console.error('Error starting video call:', error);
      let errorMessage = 'Failed to start video call.';
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    }
  };

  // Start a voice call with contact
  const handleStartVoiceCall = async () => {
    try {
      // Find or create the unified direct space
      const spaceRes = await collaborationService.getOrCreateDirectSpace(user_id);
      const spaceId = spaceRes.space.id;

      // Start audio call in the space
      const callData = await collaborationService.startCall(spaceId, 'audio');

      // Navigate to the space
      router.push(`/(spaces)/${spaceId}?call=${callData.call?.id || 'active'}`);
      setShowContactMenu(false);
    } catch (error) {
      console.error('Error starting voice call:', error);
      Alert.alert('Error', 'Failed to start voice call');
    }
  };

  // Start collaborative whiteboard
  const handleStartWhiteboard = async () => {
    try {
      // Find or create the unified direct space
      const spaceRes = await collaborationService.getOrCreateDirectSpace(user_id);
      const spaceId = spaceRes.space.id;

      router.push(`/(spaces)/${spaceId}`);
      setShowContactMenu(false);
    } catch (error) {
      console.error('Error starting whiteboard:', error);
      Alert.alert('Error', 'Failed to start whiteboard');
    }
  };


  const getSpaceIcon = () => {
    if (!spaceData) return 'chatbubble-outline';

    const icons: Record<string, string> = {
      chat: 'chatbubble-outline',
      whiteboard: 'easel-outline',
      meeting: 'videocam-outline',
      document: 'document-text-outline',
      brainstorm: 'bulb-outline',
      story: 'book-outline',
      voice_channel: 'mic-outline',
    };

    return icons[spaceData.space_type] || 'chatbubble-outline';
  };

  const handleStartCollaboration = async (collabType: string) => {
    try {
      let space;

      switch (collabType) {
        case 'whiteboard':
          space = await collaborationService.createSpace({
            title: `Whiteboard with ${name}`,
            space_type: 'whiteboard',
            linked_conversation_id: conversationId,
          });
          break;

        case 'meeting':
          space = await collaborationService.createSpace({
            title: `Meeting with ${name}`,
            space_type: 'meeting',
            linked_conversation_id: conversationId,
          });
          break;

        case 'brainstorm':
          space = await collaborationService.createSpace({
            title: `Brainstorm with ${name}`,
            space_type: 'brainstorm',
            linked_conversation_id: conversationId,
          });
          break;

        case 'document':
          space = await collaborationService.createSpace({
            title: `Document: ${name}`,
            space_type: 'document',
            linked_post_id: postId,
          });
          break;

        case 'story':
          space = await collaborationService.createSpace({
            title: `Story: ${name}`,
            space_type: 'story',
            linked_story_id: storyId,
          });
          break;

        case 'voice':
          space = await collaborationService.createSpace({
            title: `Voice chat with ${name}`,
            space_type: 'voice_channel',
            linked_conversation_id: conversationId,
          });
          break;

        default:
          console.warn('Unknown collaboration type:', collabType);
          return;
      }

      if (space) {
        console.log('Space created, navigating to:', `/spaces/${space.id}`);
        router.push(`/(spaces)/${space.id}`);
      }

      setShowCollaborationMenu(false);
    } catch (error) {
      console.error('Error starting collaboration:', error);
    }
  };

  const handlePress = (e: any) => {
    // Prevent default behavior if this is a Link
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    console.log('EnhancedChatRow pressed:', { type, id, name });

    switch (type) {
      case 'space':
        console.log('Navigating to space:', `/spaces/${id}`);
        router.push({ pathname: '/(spaces)/[id]', params: { id, tab: 'chat' } });
        break;

      case 'chat':
        console.log('Navigating to chat:', `/(tabs)/chats/${id}`);
        router.push(`/(tabs)/chats/${id}`);
        break;

      case 'contact':
        console.log('Opening chat with contact:', id);
        handleStartChat();
        break;
    }
  };

  const handleLongPress = () => {
    console.log('Long press on:', { type, id });
    if (type === 'chat') {
      setShowCollaborationMenu(true);
    }
  };

  const getSpaceBackgroundColor = (spaceType?: string) => {
    const colors: Record<string, string> = {
      chat: '#667EEA',
      whiteboard: '#4CAF50',
      meeting: '#FF6B6B',
      document: '#FFA726',
      brainstorm: '#9C27B0',
      story: '#00BCD4',
      voice_channel: '#3F51B5',
    };
    return colors[spaceType || 'chat'] || '#667EEA';
  };


  // Render contact-specific content
  const renderContactContent = () => (
    <Pressable
      style={styles.container}
      onPress={handleContactPress}
      onLongPress={() => setShowContactMenu(true)}
    >
      <View style={styles.avatarContainer}>
        <Avatar
          source={avatar || null}
          name={name}
          size={50}
          isOnline={isOnline}
          showStatus={true}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
            {username && (
              <Text style={styles.username}> @{username}</Text>
            )}
          </Text>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>

        <View style={styles.footer}>
          <Text
            style={[styles.lastMessage, styles.contactMessage]}
            numberOfLines={1}
          >
            {lastMessage || 'Available for chat'}
          </Text>

          <View style={styles.contactActions}>
            <TouchableOpacity
              style={styles.contactActionButton}
              onPress={handleStartVideoCall}
            >
              <Ionicons name="videocam" size={18} color="#007AFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactActionButton}
              onPress={handleStartVoiceCall}
            >
              <Ionicons name="call" size={18} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Contact Action Menu */}
      {showContactMenu && (
        <View style={styles.contactMenu}>
          <TouchableOpacity
            style={styles.contactMenuItem}
            onPress={handleStartChat}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#007AFF" />
            <Text style={styles.contactMenuText}>Start Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactMenuItem}
            onPress={handleStartVideoCall}
          >
            <Ionicons name="videocam-outline" size={20} color="#007AFF" />
            <Text style={styles.contactMenuText}>Video Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactMenuItem}
            onPress={handleStartVoiceCall}
          >
            <Ionicons name="call-outline" size={20} color="#007AFF" />
            <Text style={styles.contactMenuText}>Voice Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactMenuItem}
            onPress={handleStartWhiteboard}
          >
            <Ionicons name="easel-outline" size={20} color="#007AFF" />
            <Text style={styles.contactMenuText}>Whiteboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.contactMenuItem, styles.contactMenuClose]}
            onPress={() => setShowContactMenu(false)}
          >
            <Ionicons name="close" size={20} color="#666" />
            <Text style={styles.contactMenuText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </Pressable>
  );

  // Render content based on type
  const renderContent = () => {
    const spaceType = spaceData?.space_type || 'chat';
    const spaceBgColor = getSpaceBackgroundColor(spaceType);

    // Determine dynamic name and avatar for direct spaces
    let displayTitle = name;
    let displayAvatar = avatar;
    let isDirectSpace = false;

    if (type === 'space' && spaceData) {
      const isDirect = spaceData.settings?.is_direct || spaceType === 'direct';
      if (isDirect && spaceData.other_participant) {
        isDirectSpace = true;
        displayTitle = spaceData.other_participant.name || spaceData.other_participant.username || displayTitle;
        displayAvatar = spaceData.other_participant.profile_photo || displayAvatar;
      }
    }

    return (
      <Pressable
        style={styles.container}
        onPress={handlePress}
        onLongPress={handleLongPress}
      >
        <View style={styles.avatarContainer}>
          {type === 'space' && !isDirectSpace ? (
            <View style={[styles.spaceAvatar, { backgroundColor: spaceBgColor }]}>
              <Ionicons name={getSpaceIcon() as any} size={24} color="#fff" />
            </View>
          ) : (
            <Avatar
              source={displayAvatar || null}
              name={displayTitle}
              size={50}
              isOnline={isOnline}
              showStatus={true}
            />
          )}

          {type === 'space' && spaceData?.is_live && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {type === 'space' && spaceData?.has_ai_assistant && (
                <Ionicons name="sparkles" size={14} color="#667EEA" style={styles.aiIcon} />
              )}
              {displayTitle}
            </Text>
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>

          <View style={styles.footer}>
            <Text
              style={[
                styles.lastMessage,
                type === 'contact' && styles.contactMessage
              ]}
              numberOfLines={1}
            >
              {type === 'space' ? (
                <>
                  {spaceType === 'chat' && 'Chat space'}
                  {spaceType === 'whiteboard' && 'Whiteboard collaboration'}
                  {spaceType === 'meeting' && 'Video meeting room'}
                  {spaceType === 'document' && 'Document collaboration'}
                  {spaceType === 'brainstorm' && 'Brainstorming session'}
                  {spaceType === 'story' && 'Collaborative story'}
                  {spaceType === 'voice_channel' && 'Voice channel'}
                  {spaceData?.participants_count && ` • ${spaceData.participants_count} participants`}
                </>
              ) : (
                lastMessage || (type === 'contact' ? 'Available for chat' : 'Start a conversation...')
              )}
            </Text>

            {type === 'chat' ? (
              unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )
            ) : type === 'space' && !isDirectSpace ? (
              <Ionicons name={getSpaceIcon() as any} size={20} color="#007AFF" />
            ) : (
              <Ionicons name="chatbubble-outline" size={20} color="#007AFF" />
            )}
          </View>

          {/* Evolution level indicator for spaces */}
          {type === 'space' && (spaceData?.evolution_level ?? 0) > 1 && (
            <View style={styles.evolutionIndicator}>
              <Text style={styles.evolutionText}>Level {spaceData?.evolution_level}</Text>
              {spaceData?.unlocked_features?.slice(0, 3).map((feature: string, index: number) => (
                <Ionicons key={index} name="checkmark-circle" size={12} color="#4CAF50" />
              ))}
            </View>
          )}
        </View>

        {type === 'chat' && isPinned && (
          <Ionicons name="pin" size={16} color="#666" style={styles.pinIcon} />
        )}

        {/* Collaboration quick menu */}
        {showCollaborationMenu && (
          <View style={styles.collaborationMenu}>
            <Pressable
              style={styles.collabMenuItem}
              onPress={() => handleStartCollaboration('whiteboard')}
            >
              <Ionicons name="easel-outline" size={20} color="#007AFF" />
              <Text style={styles.collabMenuText}>Whiteboard</Text>
            </Pressable>

            <Pressable
              style={styles.collabMenuItem}
              onPress={() => handleStartCollaboration('meeting')}
            >
              <Ionicons name="videocam-outline" size={20} color="#007AFF" />
              <Text style={styles.collabMenuText}>Meeting</Text>
            </Pressable>

            <Pressable
              style={styles.collabMenuItem}
              onPress={() => handleStartCollaboration('brainstorm')}
            >
              <Ionicons name="bulb-outline" size={20} color="#007AFF" />
              <Text style={styles.collabMenuText}>Brainstorm</Text>
            </Pressable>

            <Pressable
              style={styles.collabMenuItem}
              onPress={() => handleStartCollaboration('voice')}
            >
              <Ionicons name="mic-outline" size={20} color="#007AFF" />
              <Text style={styles.collabMenuText}>Voice Chat</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  };

  // 🚨 CRITICAL FIX: Remove ALL Link wrappers - they cause navigation conflicts
  // Just return the Pressable component directly
  if (type === 'contact') {
    return renderContactContent();
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
  spaceAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
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
  liveIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
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
  aiIcon: {
    marginRight: 4,
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
  evolutionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  evolutionText: {
    fontSize: 11,
    color: '#666',
    marginRight: 4,
  },
  collaborationMenu: {
    position: 'absolute',
    right: 16,
    top: 60,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.25,
      radius: 3.84,
      elevation: 5,
    }),
    zIndex: 1000,
    minWidth: 150,
  },
  collabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
  },
  collabMenuText: {
    marginLeft: 8,
    fontSize: 14,
  },

  username: {
    fontSize: 13,
    color: '#666',
    fontWeight: '400',
  },

  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  contactActionButton: {
    marginLeft: 8,
  },

  contactMenu: {
    position: 'absolute',
    top: 70,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.25,
      radius: 4,
      elevation: 6,
    }),
    zIndex: 2000,
    minWidth: 180,
  },

  contactMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  contactMenuText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },

  contactMenuClose: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    marginTop: 4,
  },

});

export default EnhancedChatRow;