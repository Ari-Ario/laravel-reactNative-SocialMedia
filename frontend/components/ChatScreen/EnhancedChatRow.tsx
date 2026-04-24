// components/ChatScreen/EnhancedChatRow.tsx
import { View, Text, StyleSheet, Pressable, Alert, TouchableOpacity, Platform } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import * as Haptics from 'expo-haptics';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useContext, useMemo } from 'react';
import { useTranslation } from '@/constants/i18n';
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
import { useCall } from '@/context/CallContext';

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
  const { colors, activeScheme } = useAppTheme();
  const { t, isRTL } = useTranslation();
  const [showCollaborationMenu, setShowCollaborationMenu] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<AnchorPosition>();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { setProfilePreviewVisible, setProfileViewUserId } = useProfileView();
  const { startCall } = useCall();

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
  const styles = useMemo(() => getStyles(colors, activeScheme, isRTL), [colors, activeScheme, isRTL]);

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
      router.push({ pathname: '/(spaces)/[id]', params: { id: spaceRes.space.id } });
      setShowContactMenu(false);
    } catch (error) {
      console.error('Error starting chat:', error);
      simpleAlert(t('error'), t('failed_start_chat'));
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

      // Set global context so overlay pops open instantly
      startCall({
        spaceId: spaceId,
        spaceType: 'direct',
        type: 'video',
        callId: callData.call?.id
      });

      // Navigate to space with call active
      router.push({ 
        pathname: '/(spaces)/[id]', 
        params: { 
          id: spaceId, 
          call: callData.call?.id || 'active', 
          type: 'video', 
          tab: 'meeting' 
        } 
      });
      setShowContactMenu(false);
    } catch (error: any) {
      console.error('Error starting video call:', error);
      const errorMessage = t('failed_start_video');
      simpleAlert(t('error'), errorMessage);
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

      // Set global context so overlay pops open instantly
      startCall({
        spaceId: spaceId,
        spaceType: 'direct',
        type: 'audio',
        callId: callData.call?.id
      });

      // Navigate to the space
      router.push({ 
        pathname: '/(spaces)/[id]', 
        params: { 
          id: spaceId, 
          call: callData.call?.id || 'active', 
          type: 'audio', 
          tab: 'meeting' 
        } 
      });
      setShowContactMenu(false);
    } catch (error) {
      console.error('Error starting voice call:', error);
      simpleAlert(t('error'), t('failed_start_voice'));
    }
  };

  // Start collaborative whiteboard
  const handleStartWhiteboard = async () => {
    try {
      // Find or create the unified direct space
      const spaceRes = await collaborationService.getOrCreateDirectSpace(user_id);
      const spaceId = spaceRes.space.id;

      router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId } });
      setShowContactMenu(false);
    } catch (error) {
      console.error('Error starting whiteboard:', error);
      simpleAlert(t('error'), t('failed_start_whiteboard'));
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
            title: t('whiteboard_with_name').replace('{name}', name),
            space_type: 'whiteboard',
            linked_conversation_id: conversationId,
          });
          break;

        case 'meeting':
          space = await collaborationService.createSpace({
            title: t('meeting_with_name').replace('{name}', name),
            space_type: 'meeting',
            linked_conversation_id: conversationId,
          });
          break;

        case 'brainstorm':
          space = await collaborationService.createSpace({
            title: t('brainstorm_with_name').replace('{name}', name),
            space_type: 'brainstorm',
            linked_conversation_id: conversationId,
          });
          break;

        case 'document':
          space = await collaborationService.createSpace({
            title: t('document_with_name').replace('{name}', name),
            space_type: 'document',
            linked_post_id: postId,
          });
          break;

        case 'story':
          space = await collaborationService.createSpace({
            title: t('story_with_name').replace('{name}', name),
            space_type: 'story',
            linked_story_id: storyId,
          });
          break;

        case 'voice':
          space = await collaborationService.createSpace({
            title: t('voice_chat_with_name').replace('{name}', name),
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
        router.push({ pathname: '/(spaces)/[id]', params: { id: space.id } });
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
        router.push({ pathname: '/(tabs)/chats/[id]', params: { id } });
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
      simpleAlert(t('error'), t('failed_to_update'));
    }
  };

  const handleDeleteSpace = async () => {
    // Close menu first to ensure UI is clean before showing alerts
    setShowCollaborationMenu(false);
    
    const warningMessage = type === 'space' 
      ? t('space_delete_warning')
      : t('delete_chat_confirm');
 
    confirmAction(t('delete_chat'), warningMessage, t('delete'), async () => {
      try {
        await collaborationService.deleteSpace(id);
        
        // Update global store immediately
        useCollaborationStore.getState().removeSpace(id);
        
        simpleAlert(t('success'), t('success'));
        if (onDelete) onDelete(id);
      } catch (error) {
        console.error('Error deleting space:', error);
        simpleAlert(t('error'), t('error'));
      }
    });
  };

  const handleLeaveSpace = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    
    confirmAction(t('leave_space'), t('leave_space_confirm'), t('leave'), async () => {
      try {
        await collaborationService.leaveSpace(id);
        simpleAlert(t('success'), t('success'));
        setShowCollaborationMenu(false);
        if (onLeave) onLeave(id);
      } catch (error: any) {
        console.error('Error leaving space:', error);
        // Handle sole owner warning from backend
        if (error.response?.status === 403 && error.response?.data?.message) {
          simpleAlert(t('cannot_leave'), error.response.data.message);
        } else {
          simpleAlert(t('error'), t('error'));
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
      simpleAlert(t('success'), t('invited_success').replace('{count}', userIds.length.toString()));
      setShowInviteModal(false);
    } catch (error) {
      console.error('Error inviting users:', error);
      simpleAlert(t('error'), t('failed_start_chat'));
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
      simpleAlert(t('error'), t('failed_to_update'));
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
      simpleAlert(t('error'), t('failed_to_update'));
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
      simpleAlert(t('error'), t('failed_to_update'));
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
      simpleAlert(t('error'), t('failed_to_update'));
    }
  };

  const handleClearChat = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    
    confirmAction(
      t('clear_chat'), 
      t('clear_chat_confirm'), 
      t('clear'),
      async () => {
        try {
          await collaborationService.clearChat(id);
          setShowCollaborationMenu(false);
          simpleAlert(t('success'), t('success'));
        } catch (error) {
          console.error('Error clearing chat:', error);
          simpleAlert(t('error'), t('error'));
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
      t('block_user'),
      t('block_user_confirm').replace('{name}', name),
      t('block'),
      async () => {
        try {
          // Real-time: ideally we would remove them from list or mark them
          await blockUser(user_id);
          simpleAlert(t('success'), t('blocked_success').replace('{name}', name));
          setShowContactMenu(false);
          // If we want to remove them from contacts list immediately:
          // onDelete && onDelete(id);
        } catch (error) {
          console.error('Error blocking user:', error);
          simpleAlert(t('error'), t('error'));
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
      style={[styles.container, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
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
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.name, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
            {name}
            {username && (
              <Text style={[styles.username, { color: colors.textSecondary }]}> @{username}</Text>
            )}
          </Text>
          <Text style={[styles.timestamp, { color: colors.textSecondary, textAlign: isRTL ? 'left' : 'right' }]}>{timestamp}</Text>
        </View>

        <View style={[styles.footer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text
            style={[styles.lastMessage, styles.contactMessage, { color: colors.tint, textAlign: isRTL ? 'right' : 'left' }]}
            numberOfLines={1}
          >
            {lastMessage || t('available_chat')}
          </Text>

          <View style={[styles.contactActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity
              style={styles.contactActionButton}
              onPress={handleStartVideoCall}
            >
              <Ionicons name="videocam" size={18} color={colors.tint} />
            </TouchableOpacity>
 
            <TouchableOpacity
              style={styles.contactActionButton}
              onPress={handleStartVoiceCall}
            >
              <Ionicons name="call" size={18} color={colors.tint} />
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
      const isDirect = (spaceData.settings?.is_direct || spaceType === 'direct' || spaceType === 'chat');
      if (isDirect) {
        isDirectSpace = true;
        if (spaceData.other_participant) {
          displayTitle = spaceData.other_participant.name || spaceData.other_participant.username || displayTitle;
          displayAvatar = spaceData.other_participant.profile_photo || displayAvatar;
        }
      }
    }

    return (
      <Pressable
        ref={containerRef}
        style={[styles.container, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
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
            <View style={[styles.liveIndicator, { [isRTL ? 'left' : 'right']: -4 }]}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{t('live')}</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.name, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
              {type === 'space' && spaceData?.has_ai_assistant && (
                <Ionicons name="sparkles" size={14} color={colors.tint} style={styles.aiIcon} />
              )}
              {displayTitle}
            </Text>
            <Text style={[styles.timestamp, { color: colors.textSecondary, textAlign: isRTL ? 'left' : 'right' }]}>{timestamp}</Text>
          </View>

          <View style={[styles.footer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text
              style={[
                styles.lastMessage,
                { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                type === 'contact' && [styles.contactMessage, { color: colors.tint }]
              ]}
              numberOfLines={1}
            >
              {type === 'space' ? (
                <>
                  {spaceType === 'chat' && t('chat_space')}
                  {spaceType === 'whiteboard' && t('whiteboard_collab')}
                  {spaceType === 'meeting' && t('video_meeting_room')}
                  {spaceType === 'document' && t('document_collab')}
                  {spaceType === 'brainstorm' && t('brainstorm_session')}
                  {spaceType === 'story' && t('collaborative_story')}
                  {spaceType === 'voice_channel' && t('voice_channel')}
                  {spaceData?.participants_count && t('participants_count').replace('{count}', spaceData.participants_count.toString())}
                </>
              ) : (
                lastMessage || (type === 'contact' ? t('available_chat') : t('start_conversation'))
              )}
            </Text>

            <View style={[styles.indicatorRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {localIsMuted && (
                <Ionicons name="volume-mute" size={14} color="#999" style={[styles.indicatorIcon, { [isRTL ? 'marginRight' : 'marginLeft']: 4 }]} />
              )}
              {(localIsPinned || isPinned) && (
                <Ionicons name="pin" size={16} color="#b1b1b1" style={[styles.pinIcon, { [isRTL ? 'marginRight' : 'marginLeft']: 4 }]} />
              )}
              {localIsFavorite && (
                <Ionicons name="heart" size={16} color="#FF3B30" style={[styles.indicatorIcon, { [isRTL ? 'marginRight' : 'marginLeft']: 4 }]} />
              )}
 
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: '#25D366', [isRTL ? 'marginRight' : 'marginLeft']: 8 }]}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : (
                <Ionicons 
                  name={type === 'space' && !isDirectSpace ? getSpaceIcon() as any : "chatbubble-outline"} 
                  size={20} 
                  color={colors.tint}
                  style={{ [isRTL ? 'marginRight' : 'marginLeft']: 8 }}
                />
              )}
            </View>
          </View>

          {/* Evolution level indicator for spaces */}
          {type === 'space' && (spaceData?.evolution_level ?? 0) > 1 && (
            <View style={[styles.evolutionIndicator, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.evolutionText, { color: colors.textSecondary }]}>{t('level')} {spaceData?.evolution_level}</Text>
              {spaceData?.unlocked_features?.slice(0, 3).map((feature: string, index: number) => (
                <Ionicons key={index} name="checkmark-circle" size={12} color="#4CAF50" style={{ [isRTL ? 'marginRight' : 'marginLeft']: 4 }} />
              ))}
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View>
      {type === 'contact' ? renderContactContent() : renderContent()}
      {showCollaborationMenu && (
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
                  label: localIsPinned ? t("unpin_chat") : t("pin_chat"),
                  onPress: handlePinSpace,
                },
                {
                  icon: (localIsUnread ? "mail-open-outline" : "mail-unread-outline") as any,
                  label: localIsUnread ? t("mark_as_read") : t("mark_as_unread"),
                  onPress: handleMarkUnread,
                },
                {
                  icon: (localIsArchived ? "archive" : "archive-outline") as any,
                  label: localIsArchived ? t("unarchive_chat") : t("archive_chat"),
                  onPress: handleArchiveSpace,
                },
                {
                  icon: (localIsMuted ? "volume-high-outline" : "volume-mute-outline") as any,
                  label: localIsMuted ? t("unmute_notifications") : t("mute_notifications"),
                  onPress: handleMuteSpace,
                },
                {
                  icon: (localIsFavorite ? "heart-dislike-outline" : "heart-outline") as any,
                  label: localIsFavorite ? t("remove_from_favorites") : t("add_to_favorites"),
                  onPress: handleFavoriteSpace,
                }
              ];

              if (!isDirectSpace) {
                if (spaceData?.my_role === 'owner' || spaceData?.my_role === 'moderator') {
                  menuItems.push({
                    icon: "person-add-outline" as any,
                    label: t("invite_people"),
                    onPress: () => {
                      setShowInviteModal(true);
                      setShowCollaborationMenu(false);
                    },
                  });
                }

                if (spaceData?.my_role !== 'owner') {
                  menuItems.push({
                    icon: "exit-outline" as any,
                    label: t("leave_space"),
                    onPress: handleLeaveSpace,
                    destructive: true,
                  });
                }
              }

              menuItems.push({
                icon: "remove-circle-outline" as any,
                label: t("clear_chat"),
                onPress: handleClearChat,
              });

              if (spaceData?.my_role === 'owner' || isDirectSpace) {
                menuItems.push({
                  icon: "trash-outline" as any,
                  label: t("delete_chat"),
                  onPress: handleDeleteSpace,
                  destructive: true,
                });
              }

              return menuItems;
            })()
          ) : (
            [
              {
                icon: (localIsPinned ? "pin-outline" : "pin") as any,
                label: localIsPinned ? t("unpin_chat") : t("pin_chat"),
                onPress: handlePinSpace,
              },
              {
                icon: "trash-outline",
                label: t("delete_chat"),
                destructive: true,
                onPress: handleDeleteSpace,
              }
            ]
          )}
        />
      )}

      {showContactMenu && (
        <GenericMenu
          visible={showContactMenu}
          onClose={() => setShowContactMenu(false)}
          anchorPosition={menuPosition}
          items={[
            {
              icon: 'chatbubble-ellipses-outline',
              label: t('message'),
              onPress: handleStartChat,
            },
            {
              icon: 'ban-outline',
              label: t('block_user'),
              destructive: true,
              onPress: handleBlockUser,
            },
          ]}
        />
      )}

      {showInviteModal && (
        <EnhancedInviteModal
          visible={showInviteModal}
          spaceId={id}
          spaceTitle={name}
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInviteUsers}
        />
      )}
    </View>
  );
};

const getStyles = (colors: any, activeScheme: string, isRTL: boolean) => StyleSheet.create({
  container: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
    height: 72,
  },
  avatarContainer: {
    position: 'relative',
    [isRTL ? 'marginLeft' : 'marginRight']: 16,
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
    borderColor: colors.surface,
  },
  liveIndicator: {
    position: 'absolute',
    top: -4,
    [isRTL ? 'left' : 'right']: -4,
    flexDirection: isRTL ? 'row-reverse' : 'row',
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
    [isRTL ? 'marginLeft' : 'marginRight']: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    minWidth: 0,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    width: '100%',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    color: colors.text,
    textAlign: isRTL ? 'right' : 'left',
    [isRTL ? 'marginLeft' : 'marginRight']: 8,
  },
  aiIcon: {
    [isRTL ? 'marginLeft' : 'marginRight']: 4,
  },
  pinIcon: {
    [isRTL ? 'marginRight' : 'marginLeft']: 4,
  },
  indicatorRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
  },
  indicatorIcon: {
    [isRTL ? 'marginRight' : 'marginLeft']: 4,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: isRTL ? 'left' : 'right',
  },
  footer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
    color: colors.textSecondary,
    textAlign: isRTL ? 'right' : 'left',
    [isRTL ? 'marginLeft' : 'marginRight']: 8,
  },
  contactMessage: {
    color: colors.tint,
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
    [isRTL ? 'marginRight' : 'marginLeft']: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  evolutionIndicator: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  evolutionText: {
    fontSize: 11,
    color: colors.textSecondary,
    [isRTL ? 'marginLeft' : 'marginRight']: 4,
  },
  collaborationMenu: {
    position: 'absolute',
    [isRTL ? 'left' : 'right']: 16,
    top: 60,
    backgroundColor: colors.surface,
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
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
  },
  collabMenuText: {
    [isRTL ? 'marginRight' : 'marginLeft']: 8,
    fontSize: 14,
    color: colors.text,
  },
  username: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  contactActions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  contactActionButton: {
    [isRTL ? 'marginRight' : 'marginLeft']: 8,
  },
  contactMenu: {
    position: 'absolute',
    top: 70,
    [isRTL ? 'left' : 'right']: 16,
    backgroundColor: colors.surface,
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
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  contactMenuText: {
    [isRTL ? 'marginRight' : 'marginLeft']: 10,
    fontSize: 14,
    color: colors.text,
  },
  contactMenuClose: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 4,
  },
});

export default EnhancedChatRow;