// components/ChatScreen/EnhancedChatRow.tsx
import { View, Text, StyleSheet, Pressable, Alert, TouchableOpacity, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
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
import { calculateAnchor, AnchorPosition } from '@/utils/layout';
import GenericMenu, { MenuItem } from '@/components/GenericMenu';
import EnhancedInviteModal, { InviteRecipient } from '@/components/ChatScreen/EnhancedInviteModal';
import { useRef } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useProfileView } from '@/context/ProfileViewContext';
import { blockUser, unblockUser } from '@/services/UserService';

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
  onLeave?: (id: string) => void;
  onDelete?: (id: string) => void;
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
  onLeave,
  onDelete,
}) => {
  const [showCollaborationMenu, setShowCollaborationMenu] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<AnchorPosition>();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { setProfilePreviewVisible, setProfileViewUserId } = useProfileView();

  // Optimistic UI state
  const [localIsMuted, setLocalIsMuted] = useState(spaceData?.my_permissions?.is_muted || false);
  const [localIsPinned, setLocalIsPinned] = useState(isPinned || spaceData?.my_permissions?.is_pinned || false);
  const [localIsArchived, setLocalIsArchived] = useState(spaceData?.my_permissions?.is_archived || false);
  const [localIsUnread, setLocalIsUnread] = useState(unreadCount > 0 || spaceData?.my_permissions?.is_unread || false);
  const [localIsFavorite, setLocalIsFavorite] = useState(spaceData?.my_permissions?.is_favorite || false);

  const containerRef = useRef<View>(null);
  const collaborationService = CollaborationService.getInstance();
  const { user } = useContext(AuthContext);
  const API_BASE = getApiBase();
  const token = getToken();

  // ✅ Web-compatible alert/confirm helpers
  const simpleAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const confirmAction = (title: string, message: string, confirmText: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmText, onPress: onConfirm, style: 'destructive' }
      ]);
    }
  };
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
      router.push(`/(spaces)/${spaceRes.space.id}`);
      setShowContactMenu(false);
    } catch (error) {
      console.error('Error starting chat:', error);
      simpleAlert('Error', 'Failed to start chat');
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
      router.push(`/(spaces)/${spaceId}?call=${callData.call?.id || 'active'}&type=video`);
      setShowContactMenu(false);
    } catch (error: any) {
      console.error('Error starting video call:', error);
      let errorMessage = 'Failed to start video call.';
      simpleAlert('Error', errorMessage);
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
      router.push(`/(spaces)/${spaceId}?call=${callData.call?.id || 'active'}&type=audio`);
      setShowContactMenu(false);
    } catch (error) {
      console.error('Error starting voice call:', error);
      simpleAlert('Error', 'Failed to start voice call');
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
      simpleAlert('Error', 'Failed to start whiteboard');
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

  const handleLongPress = (event: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        // We use the touch coordinates for more precise anchoring if available,
        // but default to row center for better consistency with WhatsApp/Telegram
        const { pageX: touchX, pageY: touchY } = event.nativeEvent;
        const anchor = calculateAnchor(touchX || pageX, pageY, width, height, 220);
        setMenuPosition(anchor);

        if (type === 'contact') {
          setShowContactMenu(true);
        } else {
          setShowCollaborationMenu(true);
        }
      });
    }
  };

  const handleMuteSpace = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Optimistic update
    const previousState = localIsMuted;
    setLocalIsMuted(!previousState);
    setShowCollaborationMenu(false);

    try {
      if (type === 'space' || type === 'chat') {
        await collaborationService.muteSpace(id);
      }
    } catch (error) {
      console.error('Error muting space:', error);
      // Revert if failed
      setLocalIsMuted(previousState);
      simpleAlert('Error', 'Failed to toggle mute status');
    }
  };

  const handleDeleteSpace = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    
    const warningMessage = type === 'space' 
      ? 'The space will be deleted forever for all participants with all messages and belongings. Proceed?'
      : 'Are you sure you want to delete this chat?';

    confirmAction('Delete Chat', warningMessage, 'Delete', async () => {
      try {
        if (type === 'space') {
          await collaborationService.deleteSpace(id);
          simpleAlert('Success', 'Space deleted forever.');
          if (onDelete) onDelete(id);
        }
        setShowCollaborationMenu(false);
      } catch (error) {
        console.error('Error deleting space:', error);
        simpleAlert('Error', 'Failed to delete space');
      }
    });
  };

  const handleLeaveSpace = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    
    confirmAction('Leave Space', 'Are you sure you want to leave this space?', 'Leave', async () => {
      try {
        await collaborationService.leaveSpace(id);
        simpleAlert('Success', 'You have left the space.');
        setShowCollaborationMenu(false);
        if (onLeave) onLeave(id);
      } catch (error: any) {
        console.error('Error leaving space:', error);
        // Handle sole owner warning from backend
        if (error.response?.status === 403 && error.response?.data?.message) {
          simpleAlert('Cannot Leave', error.response.data.message);
        } else {
          simpleAlert('Error', 'Failed to leave space');
        }
      }
    });
  };

  const handleInviteUsers = async (recipients: InviteRecipient[]) => {
    const userIds = recipients
      .filter(r => r.type !== 'space' && r.userData?.id)
      .map(r => r.userData.id);

    try {
      if (userIds.length > 0) {
        await collaborationService.inviteToSpace(id, userIds, 'participant');
      }
      Alert.alert('Success', `Invited ${userIds.length} user(s) successfully!`);
      setShowInviteModal(false);
    } catch (error) {
      console.error('Error inviting users:', error);
      simpleAlert('Error', 'Failed to send invites.');
    }
  };

  const handlePinSpace = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const previousState = localIsPinned;
    setLocalIsPinned(!previousState);
    if (type === 'space') {
      useCollaborationStore.getState().updateSpacePermissions(id, { is_pinned: !previousState });
    }
    setShowCollaborationMenu(false);

    try {
      if (type === 'space' || type === 'chat') {
        await collaborationService.pinSpace(id);
      }
    } catch (error) {
      console.error('Error pinning space:', error);
      setLocalIsPinned(previousState);
      if (type === 'space') {
        useCollaborationStore.getState().updateSpacePermissions(id, { is_pinned: previousState });
      }
      simpleAlert('Error', 'Failed to toggle pin status');
    }
  };

  const handleArchiveSpace = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const previousState = localIsArchived;
    setLocalIsArchived(!previousState);
    if (type === 'space') {
      useCollaborationStore.getState().updateSpacePermissions(id, { is_archived: !previousState });
    }
    setShowCollaborationMenu(false);

    try {
      if (type === 'space' || type === 'chat') {
        await collaborationService.archiveSpace(id);
      }
    } catch (error) {
      console.error('Error archiving space:', error);
      setLocalIsArchived(previousState);
      if (type === 'space') {
        useCollaborationStore.getState().updateSpacePermissions(id, { is_archived: previousState });
      }
      simpleAlert('Error', 'Failed to toggle archive status');
    }
  };

  const handleMarkUnread = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const previousState = localIsUnread;
    setLocalIsUnread(!previousState);
    if (type === 'space') {
      useCollaborationStore.getState().updateSpacePermissions(id, { is_unread: !previousState });
    }
    setShowCollaborationMenu(false);

    try {
      if (type === 'space' || type === 'chat') {
        await collaborationService.markAsUnread(id);
      }
    } catch (error) {
      console.error('Error marking unread space:', error);
      setLocalIsUnread(previousState);
      if (type === 'space') {
        useCollaborationStore.getState().updateSpacePermissions(id, { is_unread: previousState });
      }
      simpleAlert('Error', 'Failed to toggle read status');
    }
  };

  const handleFavoriteSpace = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const previousState = localIsFavorite;
    setLocalIsFavorite(!previousState);
    if (type === 'space') {
      useCollaborationStore.getState().updateSpacePermissions(id, { is_favorite: !previousState });
    }
    setShowCollaborationMenu(false);

    try {
      if (type === 'space' || type === 'chat') {
        await collaborationService.favoriteSpace(id);
      }
    } catch (error) {
      console.error('Error favoriting space:', error);
      setLocalIsFavorite(previousState);
      if (type === 'space') {
        useCollaborationStore.getState().updateSpacePermissions(id, { is_favorite: previousState });
      }
      simpleAlert('Error', 'Failed to toggle favorite status');
    }
  };

  const handleClearChat = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    
    confirmAction(
      'Clear Chat', 
      'Are you sure you want to clear all messages in this chat for you? This cannot be undone.', 
      'Clear',
      async () => {
        try {
          await collaborationService.clearChat(id);
          setShowCollaborationMenu(false);
          simpleAlert('Success', 'Chat history cleared for you.');
        } catch (error) {
          console.error('Error clearing chat:', error);
          simpleAlert('Error', 'Failed to clear chat');
        }
      }
    );
  };

  const handleViewProfile = () => {
    // Navigate to user profile
    setProfileViewUserId(user_id);
    setProfilePreviewVisible(true);
    setShowContactMenu(false);
  };

  const handleBlockUser = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    confirmAction(
      'Block User',
      `Are you sure you want to block ${name}? They will not be able to message you or call you.`,
      'Block',
      async () => {
        try {
          // Real-time: ideally we would remove them from list or mark them
          await blockUser(user_id);
          simpleAlert('Success', `${name} has been blocked.`);
          setShowContactMenu(false);
          // If we want to remove them from contacts list immediately:
          // onDelete && onDelete(id);
        } catch (error) {
          console.error('Error blocking user:', error);
          simpleAlert('Error', 'Failed to block user');
        }
      }
    );
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
      ref={containerRef}
      style={styles.container}
      onPress={handlePress}
      onLongPress={handleLongPress}
    >
      <Pressable style={styles.avatarContainer} onPress={handleViewProfile}>
        <Avatar
          source={avatar || null}
          name={name}
          size={50}
          isOnline={isOnline}
          showStatus={true}
        />
      </Pressable>

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
      const isDirect = (spaceData.settings?.is_direct || spaceType === 'direct' || spaceType === 'chat') && !!spaceData.other_participant;
      if (isDirect && spaceData.other_participant) {
        isDirectSpace = true;
        displayTitle = spaceData.other_participant.name || spaceData.other_participant.username || displayTitle;
        displayAvatar = spaceData.other_participant.profile_photo || displayAvatar;
      }
    }

    return (
      <Pressable
        ref={containerRef}
        style={styles.container}
        onPress={handlePress}
        onLongPress={handleLongPress}
      >
        <View style={styles.avatarContainer}>
          {(type === 'space' || type === 'chat') && !isDirectSpace && !spaceData?.image_url ? (
            <View style={[styles.spaceAvatar, { backgroundColor: spaceBgColor }]}>
              <Ionicons name={getSpaceIcon() as any} size={24} color="#fff" />
            </View>
          ) : (
            <Avatar
              source={spaceData?.image_url || displayAvatar || null}
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

            <View style={styles.indicatorRow}>
              {localIsMuted && (
                <Ionicons name="volume-mute" size={14} color="#999" style={styles.indicatorIcon} />
              )}
              {(localIsPinned || isPinned) && (
                <Ionicons name="pin" size={16} color="#b1b1b1" style={styles.pinIcon} />
              )}
              {localIsFavorite && (
                <Ionicons name="heart" size={16} color="#FF3B30" style={styles.indicatorIcon} />
              )}

              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: '#25D366' }]}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : (
                <Ionicons 
                  name={type === 'space' && !isDirectSpace ? getSpaceIcon() as any : "chatbubble-outline"} 
                  size={20} 
                  color="#007AFF" 
                />
              )}
            </View>
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
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {type === 'contact' ? renderContactContent() : renderContent()}

      <GenericMenu
        visible={showCollaborationMenu}
        onClose={() => setShowCollaborationMenu(false)}
        anchorPosition={menuPosition}
        items={type === 'space' ? (
          (() => {
            const spaceType = spaceData?.space_type || 'chat';
            const isDirectSpace = (spaceData?.settings?.is_direct || spaceType === 'direct' || spaceType === 'chat') && !!spaceData?.other_participant;
            
            const menuItems: MenuItem[] = [
              {
                icon: (localIsPinned ? "pin-outline" : "pin") as any,
                label: localIsPinned ? "Unpin Chat" : "Pin Chat",
                onPress: handlePinSpace,
              },
              {
                icon: (localIsUnread ? "mail-open-outline" : "mail-unread-outline") as any,
                label: localIsUnread ? "Mark as Read" : "Mark as Unread",
                onPress: handleMarkUnread,
              },
              {
                icon: (localIsArchived ? "archive" : "archive-outline") as any,
                label: localIsArchived ? "Unarchive Chat" : "Archive Chat",
                onPress: handleArchiveSpace,
              },
              {
                icon: (localIsMuted ? "volume-high-outline" : "volume-mute-outline") as any,
                label: localIsMuted ? "Unmute Notifications" : "Mute Notifications",
                onPress: handleMuteSpace,
              },
              {
                icon: (localIsFavorite ? "heart-dislike-outline" : "heart-outline") as any,
                label: localIsFavorite ? "Remove from Favorites" : "Add to Favorites",
                onPress: handleFavoriteSpace,
              }
            ];

            if (!isDirectSpace) {
              if (spaceData?.my_role === 'owner' || spaceData?.my_role === 'moderator') {
                menuItems.push({
                  icon: "person-add-outline" as any,
                  label: "Invite People",
                  onPress: () => {
                    setShowInviteModal(true);
                    setShowCollaborationMenu(false);
                  },
                });
              }

              menuItems.push({
                icon: "exit-outline" as any,
                label: "Leave Space",
                onPress: handleLeaveSpace,
                destructive: true,
              });
            }

            menuItems.push({
              icon: "remove-circle-outline" as any,
              label: "Clear Chat",
              onPress: handleClearChat,
            });

            if (spaceData?.my_role === 'owner' || isDirectSpace) {
              menuItems.push({
                icon: "trash-outline" as any,
                label: "Delete Chat",
                onPress: handleDeleteSpace,
                destructive: true,
              });
            }

            return menuItems;
          })()
        ) : []}
      />

      <GenericMenu
        visible={showContactMenu}
        onClose={() => setShowContactMenu(false)}
        anchorPosition={menuPosition}
        items={[
          {
            icon: 'chatbubble-ellipses-outline',
            label: 'Message',
            onPress: handleStartChat,
          },
          {
            icon: 'ban-outline',
            label: 'Block User',
            onPress: handleBlockUser,
            destructive: true,
          },
        ]}
      />

      <EnhancedInviteModal
        visible={showInviteModal}
        spaceId={id}
        spaceTitle={name}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInviteUsers}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    position: 'relative',
    height: 72,
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
    fontSize: 17,
    fontWeight: '600',
    color: '#111B21',
    flex: 1,
    marginRight: 8,
  },
  aiIcon: {
    marginRight: 4,
  },
  pinIcon: {
    marginLeft: 0,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  indicatorIcon: {
    marginLeft: 0,
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
    color: '#667781',
    flex: 1,
    marginRight: 8,
  },
  contactMessage: {
    color: '#007AFF',
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#25D366',
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