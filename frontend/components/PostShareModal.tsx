import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Share,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Clipboard,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useCollaborationStore } from '@/stores/collaborationStore';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import getApiBaseImage from '@/services/getApiBaseImage';
import Avatar from '@/components/Image/Avatar';
import * as Haptics from 'expo-haptics';
import { createShadow } from '@/utils/styles';
import { BlurView } from 'expo-blur';

interface PostShareModalProps {
  visible: boolean;
  onClose: () => void;
  post?: any;
  story?: any;
}

export default function PostShareModal({ visible, onClose, post, story }: PostShareModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState<string | null>(null); // spaceId if sending
  const [additionalMessage, setAdditionalMessage] = useState('');
  const [sharedSpaces, setSharedSpaces] = useState<Set<string>>(new Set());
  const { spaces } = useCollaborationStore();

  // Filter out channels (unless owner/mod) and apply search
  const filteredSpaces = useMemo(() => {
    return spaces.filter(space => {
      const isChannel = space.space_type === 'channel';
      const isAuthorized = space.my_role === 'owner' || space.my_role === 'moderator';
      
      const matchesSearch = space.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (isChannel) {
        return isAuthorized && matchesSearch;
      }
      return matchesSearch;
    });
  }, [spaces, searchQuery]);

  const handleSendInternal = useCallback(async (spaceId: string) => {
    if (loading) return;
    setLoading(spaceId);

    try {
      const collaborationService = CollaborationService.getInstance();
      const baseUrl = getApiBaseImage();
      const itemToShare = post || story;
      const isStory = !!story;
      
      const shareUrl = isStory 
        ? `${baseUrl}/story/${story.id}`
        : `${baseUrl}/post/${post.id}`;
      
      const mediaPreview = isStory 
        ? story.media_path 
        : (post.media?.length > 0 ? (post.media[0].file_path || post.media[0].url) : null);
        
      const mediaType = isStory 
        ? (story.type || 'image') 
        : (post.media?.length > 0 ? post.media[0].type : 'text');

      // 1. Send the share message
      await collaborationService.sendMessage(spaceId, {
        content: (isStory ? story.caption : post.caption) || (isStory ? 'Shared a story' : 'Shared a post'),
        type: isStory ? 'story_share' : 'post_share',
        metadata: {
          post_id: !isStory ? post.id : undefined,
          story_id: isStory ? story.id : undefined,
          creator_name: (isStory ? story.user?.name : post.user?.name) || 'Anonymous',
          creator_avatar: isStory ? story.user?.profile_photo : post.user?.profile_photo,
          media_url: mediaPreview,
          media_type: mediaType,
          media: isStory ? [] : (post.media || []),
          caption: isStory ? story.caption : post.caption,
          is_internal_share: true,
          post_url: shareUrl
        }
      });

      // 2. Send additional message separately if it exists
      if (additionalMessage.trim()) {
        await collaborationService.sendMessage(spaceId, {
          content: additionalMessage.trim(),
          type: 'text'
        });
      }

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      // Track that we've shared to this space in this session
      setSharedSpaces(prev => new Set(prev).add(spaceId));
      // Modal stays open for more shares
    } catch (error) {
      console.error('Error sharing post to space:', error);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(null);
    }
  }, [post, loading, additionalMessage]);

  const handleExternalShare = async () => {
    try {
      const baseUrl = getApiBaseImage();
      const isStory = !!story;
      const shareUrl = isStory 
        ? `${baseUrl}/story/${story.id}`
        : `${baseUrl}/post/${post.id}`;
      
      const caption = isStory ? story.caption : post.caption;
      const message = `${caption ? caption + '\n\n' : ''}Check out this ${isStory ? 'story' : 'post'}: ${shareUrl}`;

      if (Platform.OS === 'web' && !navigator.share) {
        // Web fallback: Copy to clipboard
        Clipboard.setString(message);
        alert('Post link copied to clipboard!');
        onClose();
        return;
      }

      const result = await Share.share({
        message: message,
        url: shareUrl, // iOS
        title: `Share ${isStory ? 'Story' : 'Post'}`
      });
      
      if (result.action === Share.sharedAction) {
        if (Platform.OS !== 'web') {
           await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        onClose();
      }
    } catch (error: any) {
      console.error('Error sharing externally:', error.message);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSending = loading === item.id;
    const hasShared = sharedSpaces.has(item.id.toString());
    const isDirect = item.space_type === 'direct' || item.space_type === 'chat';
    const displayName = isDirect ? (item.other_participant?.name || item.title) : item.title;
    
    // Use raw paths for Avatar component to handle
    const displayImage = isDirect 
      ? item.other_participant?.profile_photo 
      : (item.image_path || item.image_url);

    return (
      <TouchableOpacity 
        style={[styles.spaceItem, hasShared && styles.sharedSpaceItem]} 
        onPress={() => !hasShared && handleSendInternal(item.id.toString())}
        activeOpacity={hasShared ? 1 : 0.7}
        disabled={hasShared}
      >
        <View style={styles.imageContainer}>
          <Avatar 
            source={displayImage} 
            size={50} 
            name={displayName}
            showStatus={item.is_live}
            isOnline={item.is_live}
          />
        </View>
        
        <View style={styles.spaceInfo}>
          <Text style={[styles.spaceName, hasShared && styles.sharedText]} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.spaceType}>{item.space_type.toUpperCase()}</Text>
        </View>
 
        {isSending ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : hasShared ? (
          <View style={styles.sentBadge}>
            <Ionicons name="checkmark-circle" size={24} color="#4CD964" />
          </View>
        ) : (
          <View style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Send</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose} 
        />
        
        <View style={styles.sheet}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <Text style={styles.title}>Share {story ? 'Story' : 'Post'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search spaces or contacts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#888"
            />
          </View>

          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Add a message..."
              value={additionalMessage}
              onChangeText={setAdditionalMessage}
              multiline
              placeholderTextColor="#888"
            />
          </View>

          <FlatList
            data={filteredSpaces}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No spaces or contacts found</Text>
              </View>
            }
          />

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.externalButton} 
              onPress={handleExternalShare}
              activeOpacity={0.8}
            >
              <View style={styles.externalIconBackground}>
                <Feather name="share" size={20} color="white" />
              </View>
              <Text style={styles.externalButtonText}>Other Messaging Apps</Text>
              <Ionicons name="chevron-forward" size={18} color="#888" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingBottom: 20,
    ...createShadow({
      width: 0,
      height: -3,
      opacity: 0.1,
      radius: 10,
      elevation: 24,
    }),
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    position: 'relative',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    margin: 15,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  imageContainer: {
    position: 'relative',
  },
  spaceImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F2F2F7',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CD964',
    borderWidth: 2,
    borderColor: 'white',
  },
  spaceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  spaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  spaceType: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  sendButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  sendButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    paddingTop: 50,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  footer: {
    padding: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  externalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 12,
  },
  externalIconBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  externalButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  messageInputContainer: {
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  messageInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    maxHeight: 100,
    color: '#000',
  },
  sharedSpaceItem: {
    opacity: 0.8,
  },
  sharedText: {
    color: '#8E8E93',
  },
  sentBadge: {
    width: 60,
    alignItems: 'center',
  },
});
