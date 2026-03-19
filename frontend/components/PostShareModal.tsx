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
  Image,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useCollaborationStore } from '@/stores/collaborationStore';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import getApiBaseImage from '@/services/getApiBaseImage';
import Avatar from '@/components/Image/Avatar';
import * as Haptics from 'expo-haptics';
import { createShadow } from '@/utils/styles';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useToastStore } from '@/stores/toastStore';
import AuthContext from '@/context/AuthContext';
import { useContext } from 'react';

interface PostShareModalProps {
  visible: boolean;
  onClose: () => void;
  post?: any;
  story?: any;
  location?: any;
  initialRecipient?: {
    id: number;
    name: string;
    profile_photo: string | null;
    is_private?: boolean;
    is_following?: boolean;
    context_tag?: string;
    personal_note?: string;
  };
}

export default function PostShareModal({ visible, onClose, post, story, location, initialRecipient }: PostShareModalProps) {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useContext(AuthContext);
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

  // Merge spaces with initialRecipient suggestion
  const displaySpaces = useMemo(() => {
    let result: any[] = [...filteredSpaces];
    
    if (initialRecipient && !searchQuery) {
      // Check if space already exists for this recipient
      const existingSpace = spaces.find(s => 
        (s.space_type === 'direct' || s.space_type === 'chat') && 
        s.other_participant?.id === initialRecipient.id
      );

      if (existingSpace) {
        // Move to top
        result = [existingSpace, ...result.filter(s => s.id !== existingSpace.id)];
      } else {
        // Add a virtual space representative for this recipient
        const virtualSpace = {
          id: `virtual-${initialRecipient.id}`,
          title: initialRecipient.name,
          space_type: 'direct',
          other_participant: {
             id: initialRecipient.id,
             name: initialRecipient.name,
             profile_photo: initialRecipient.profile_photo,
             is_private: initialRecipient.is_private,
             is_following: initialRecipient.is_following
          },
          is_virtual: true
        } as any;
        result = [virtualSpace, ...result];
      }
    }
    return result;
  }, [filteredSpaces, initialRecipient, spaces, searchQuery]);

  const handleSendInternal = useCallback(async (spaceId: string) => {
    if (loading) return;
    
    let targetSpaceId = spaceId;

    // Handle virtual space creation
    if (targetSpaceId.startsWith('virtual-')) {
      const realUserId = Number(targetSpaceId.replace('virtual-', ''));
      setLoading(spaceId);

      // Final privacy check before creating space
      if (initialRecipient && initialRecipient.is_private && !initialRecipient.is_following) {
         useToastStore.getState().showToast("This profile is private", "error");
         setLoading(null);
         return;
      }

      try {
        const collaborationService = CollaborationService.getInstance();
        const directSpace = await collaborationService.getOrCreateDirectSpace(realUserId);
        const newSpaceId = directSpace?.space?.id || directSpace?.id;
        
        if (!newSpaceId) throw new Error("Could not create space");
        
        targetSpaceId = newSpaceId.toString();
        // Refresh store to include new space
        if (currentUser) {
           useCollaborationStore.getState().fetchUserSpaces(Number(currentUser.id));
        }
      } catch (err) {
        console.error("Space creation failed", err);
        useToastStore.getState().showToast("Failed to start conversation", "error");
        setLoading(null);
        return;
      }
    }

    setLoading(spaceId);

    try {
      const collaborationService = CollaborationService.getInstance();
      const baseUrl = getApiBaseImage();
      const itemToShare = post || story || location;
      const isStory = !!story;
      const isLocation = !!location;
      
      let shareUrl = '';
      let content = '';
      let type = '';
      let metadata: any = {};

      if (isLocation) {
        shareUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
        content = `Shared a location: ${location.name || 'Location Pin'}`;
        type = 'location';
        metadata = {
          location_name: location.name,
          location_address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          is_internal_share: true,
          location_url: shareUrl,
          appended_message: additionalMessage.trim() || undefined
        };
      } else {
        shareUrl = isStory 
          ? `${baseUrl}/story/${story.id}`
          : `${baseUrl}/post/${post.id}`;
        
        const mediaPreview = isStory 
          ? story.media_path 
          : (post.media?.length > 0 ? (post.media[0].file_path || post.media[0].url) : null);
          
        const mediaType = isStory 
          ? (story.type || 'image') 
          : (post.media?.length > 0 ? post.media[0].type : 'text');

        content = (isStory ? story.caption : post.caption) || (isStory ? 'Shared a story' : 'Shared a post');
        type = isStory ? 'story_share' : 'post_share';
        metadata = {
          ...metadata,
          post_id: !isStory && !isLocation ? post.id : undefined,
          story_id: isStory ? story.id : undefined,
          creator_name: isLocation ? undefined : ((isStory ? story.user?.name : post.user?.name) || 'Anonymous'),
          creator_avatar: isLocation ? undefined : (isStory ? story.user?.profile_photo : post.user?.profile_photo),
          media_url: mediaPreview,
          media_type: mediaType,
          media: isStory || isLocation ? [] : (post.media || []),
          caption: isLocation ? undefined : (isStory ? story.caption : post.caption),
          is_internal_share: true,
          post_url: shareUrl,
          appended_message: additionalMessage.trim() || undefined,
          curator_context: initialRecipient?.context_tag,
          curator_note: initialRecipient?.personal_note,
        };
      }

      // 1. Send the bundled share message
      await collaborationService.sendMessage(targetSpaceId, {
        content,
        type: type as any,
        metadata
      });

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      // Track that we've shared to this space in this session
      setSharedSpaces(prev => new Set(prev).add(spaceId).add(targetSpaceId));
      // Modal stays open for more shares
    } catch (error) {
      console.error('Error sharing to space:', error);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(null);
    }
  }, [post, story, location, loading, additionalMessage, initialRecipient]);

  const handleExternalShare = async () => {
    try {
      const baseUrl = getApiBaseImage();
      const isStory = !!story;
      const isLocation = !!location;
      
      let shareUrl = '';
      let message = '';
      let title = '';

      if (isLocation) {
        shareUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
        message = `📍 *${location.name || 'Location'}*\n${location.address || ''}\n\n🗺️ ${shareUrl}`;
        title = 'Share Location';
      } else {
        shareUrl = isStory 
          ? `${baseUrl}/story/${story.id}`
          : `${baseUrl}/post/${post.id}`;
        
        const caption = isStory ? story.caption : post.caption;
        message = `${caption ? caption + '\n\n' : ''}Check out this ${isStory ? 'story' : 'post'}: ${shareUrl}`;
        title = `Share ${isStory ? 'Story' : 'Post'}`;
      }

      if (Platform.OS === 'web' && !navigator.share) {
        // Web fallback: Copy to clipboard
        Clipboard.setString(message);
        alert('Link copied to clipboard!');
        onClose();
        return;
      }

      const result = await Share.share({
        message,
        url: shareUrl, // iOS
        title
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

  const renderPreview = () => {
    if (!post && !story && !location) return null;

    const isStory = !!story;
    const isLocation = !!location;
    const baseUrl = getApiBaseImage();

    let title = '';
    let subtitle = '';
    let imageUri = '';
    let typeIcon = '';

    if (isLocation) {
      title = location.name || 'Location Pin';
      subtitle = location.address || `${location.latitude?.toFixed(4)}, ${location.longitude?.toFixed(4)}`;
      typeIcon = 'location';
    } else if (isStory) {
      title = story.user?.name || 'Story';
      subtitle = story.caption || 'Shared a story';
      imageUri = story.media_path?.startsWith('http') ? story.media_path : `${baseUrl}/storage/${story.media_path}`;
      typeIcon = 'play-circle';
    } else {
      title = post.user?.name || 'Post';
      subtitle = post.caption || 'Shared a post';
      const firstMedia = post.media?.[0];
      if (firstMedia) {
        imageUri = (firstMedia.file_path || firstMedia.url)?.startsWith('http') 
          ? (firstMedia.file_path || firstMedia.url) 
          : `${baseUrl}/storage/${firstMedia.file_path || firstMedia.url}`;
      }
      typeIcon = 'image';
    }

    return (
      <View style={styles.previewContainer}>
        <View style={styles.previewContent}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.previewIconBackground}>
              <Ionicons name={typeIcon as any} size={24} color="#007AFF" />
            </View>
          )}
          <View style={styles.previewTextContainer}>
            <Text style={styles.previewTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.previewSubtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
        </View>
      </View>
    );
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
        
        <View style={[styles.sheet, GlobalStyles.popupContainer]}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <Text style={styles.title}>Share {location ? 'Location' : story ? 'Story' : 'Post'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {renderPreview()}

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
            data={displaySpaces}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No spaces or contacts found</Text>
              </View>
            }
          />

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
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
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    ...(createShadow({
      width: 0,
      height: -3,
      opacity: 0.1,
      radius: 10,
      elevation: 24,
    }) as any),
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
  previewContainer: {
    padding: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#F9F9F9',
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 12,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.05,
      radius: 4,
      elevation: 2,
    }),
  },
  previewImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  previewIconBackground: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  previewSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
});
