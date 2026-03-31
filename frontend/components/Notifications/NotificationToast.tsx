// components/Notifications/NotificationToast.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createShadow } from '@/utils/styles';
import { Notification } from '@/types/Notification';
import { getNotificationIcon, getNotificationColor, NOTIFICATION_TYPES, isChatNotification } from '@/stores/notificationStore';
import getApiBaseImage from '@/services/getApiBaseImage';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { usePostStore } from '@/stores/postStore';
import { useProfileView } from '@/context/ProfileViewContext';
import { fetchPostById } from '@/services/PostService';
import { fetchProfile } from '@/services/UserService';

interface NotificationToastProps {
  notification: Notification | null;
  onPress: () => void;
  onHide: () => void;
  visible: boolean;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onPress,
  onHide,
  visible
}) => {
  const [slideAnim] = useState(new Animated.Value(-150));
  const [opacityAnim] = useState(new Animated.Value(0));
  const { width } = useWindowDimensions();
  
  const { addPost } = usePostStore();
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();

  useEffect(() => {
    if (visible && notification) {
      // RESET animation values FIRST to ensure bounce effect even if already visible
      slideAnim.setValue(-150);
      opacityAnim.setValue(0);

      // Slide in animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 10
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();

      // Increased readability duration dynamically or at least 8 seconds
      const timer = setTimeout(() => {
        hideToast();
      }, 8000);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible, notification]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      onHide();
    });
  };

  if (!visible || !notification) return null;

  // Re-use routing logic from NotificationPanel
  const handleToastPress = async () => {
    try {
      const item = notification;
      const resolveSpaceId = (): string | undefined =>
        item.spaceId || item.data?.spaceId || item.data?.space_id || item.data?.space?.id || undefined;

      const resolveMessageId = (): string | undefined =>
        item.messageId || item.data?.messageId || item.data?.message_id || item.data?.message?.id || item.data?.replyId || undefined;

      const navigateToSpaceMessage = (spaceId: string, messageId?: string) => {
        router.push({
          pathname: '/(spaces)/[id]',
          params: { id: spaceId, tab: 'chat', ...(messageId ? { highlightMessageId: messageId } : {}) }
        } as any);
      };

      if (item.type === NOTIFICATION_TYPES.SPACE_INVITATION) {
        const spaceId = resolveSpaceId();
        if (spaceId) router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, justInvited: 'true' } } as any);
      } else if (item.type === NOTIFICATION_TYPES.CALL_STARTED) {
        const spaceId = resolveSpaceId();
        if (spaceId) router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'meeting' } } as any);
      } else if ([NOTIFICATION_TYPES.NEW_MESSAGE, NOTIFICATION_TYPES.MESSAGE_REACTION, NOTIFICATION_TYPES.MESSAGE_REPLY, NOTIFICATION_TYPES.MESSAGE_DELETED].includes(item.type)) {
        const spaceId = resolveSpaceId();
        const messageId = resolveMessageId();
        if (spaceId) {
          navigateToSpaceMessage(spaceId, messageId);
        } else {
          const userId = item.userId || item.data?.user?.id || item.data?.userId;
          if (userId) router.push({ pathname: '/(tabs)/chats/[id]', params: { id: userId.toString() } } as any);
        }
      } else if (item.type === NOTIFICATION_TYPES.PARTICIPANT_JOINED) {
        const spaceId = resolveSpaceId();
        if (spaceId) router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'chat' } } as any);
      } else if (item.type === NOTIFICATION_TYPES.MAGIC_EVENT) {
        const spaceId = resolveSpaceId();
        const eventId = item.data?.event?.id || item.data?.eventId;
        if (spaceId) router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, highlightMagic: eventId ? eventId.toString() : 'true' } } as any);
      } else if (item.type === NOTIFICATION_TYPES.SCREEN_SHARE) {
        const spaceId = resolveSpaceId();
        if (spaceId) router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'meeting' } } as any);
      } else if (item.type === NOTIFICATION_TYPES.ACTIVITY_CREATED) {
        const spaceId = resolveSpaceId();
        if (spaceId) router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId, tab: 'calendar' } } as any);
      } else if (item.type === NOTIFICATION_TYPES.SPACE_UPDATED) {
        const spaceId = resolveSpaceId();
        if (spaceId) router.push({ pathname: '/(spaces)/[id]', params: { id: spaceId } } as any);
      } else if (item.type === NOTIFICATION_TYPES.VIOLATION_REPORTED) {
        router.push('/moderation');
      } else if (item.type === NOTIFICATION_TYPES.MODERATION_ACTION) {
        router.push('/moderation/admin-channel');
      } else if (item.type === 'post_deleted' || item.type === NOTIFICATION_TYPES.CALL_ENDED) {
        // Do nothing on toast click
      } else if (['training_needed', NOTIFICATION_TYPES.CHATBOT_TRAINING].includes(item.type)) {
        router.replace({ pathname: '/chatbotTraining', params: { highlightChatbotTraining: 'true' } });
      } else if (['post', NOTIFICATION_TYPES.POST_UPDATED, 'reaction'].includes(item.type) && item.postId) {
        const postData = await fetchPostById(Number(item.postId));
        if (postData?.data) addPost(postData.data);
        router.push(`/post/${item.postId}` as any);
      } else if ((item.type === NOTIFICATION_TYPES.COMMENT || item.type === NOTIFICATION_TYPES.COMMENT_REACTION) && item.postId && item.commentId) {
        const postData = await fetchPostById(Number(item.postId));
        if (postData?.data) addPost(postData.data);
        router.push({ pathname: `/post/${item.postId}` as any, params: { highlightCommentId: item.commentId.toString() } });
      } else if (item.type === 'comment-deleted' && item.postId) {
        const postData = await fetchPostById(Number(item.postId));
        if (postData?.data) addPost(postData.data);
        router.push(`/post/${item.postId}` as any);
      } else if (item.userId && !isChatNotification(item.type) && !['new_follower', 'user_unfollowed', 'new-follower', 'user-unfollowed'].includes(item.type)) {
        try { await fetchProfile(item.userId.toString()); } catch (err) {}
        setProfileViewUserId(item.userId.toString());
        setProfilePreviewVisible(true);
      } else {
        // Fallback to the default onPress passed down (which opens panel)
        onPress();
        return;
      }
      hideToast();
    } catch (error) {
      console.error('Error handling toast press:', error);
      hideToast();
    }
  };

  const getAvatarSource = () => {
    if (!notification.avatar) return require('@/assets/images/favicon.png');
    const avatarString = String(notification.avatar).trim();
    if (!avatarString) return require('@/assets/images/favicon.png');
    return { uri: `${getApiBaseImage()}/storage/${avatarString}` };
  };

  const iconName = getNotificationIcon(notification.type);
  const iconColor = getNotificationColor(notification.type);

  return (
    <Animated.View style={[
      styles.toastContainer,
      {
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim,
        width: width * 0.94,
        marginLeft: width * 0.03,
      }
    ]}>
      {Platform.OS === 'web' ? (
        <View style={styles.blurFallback}>
           <TouchableOpacity style={styles.toastContent} onPress={handleToastPress} activeOpacity={0.8}>
             <Image source={getAvatarSource()} style={styles.avatar} defaultSource={require('@/assets/images/favicon.png')} />
             <View style={[styles.iconBadge, { backgroundColor: iconColor }]}>
               <Ionicons name={iconName as any} size={11} color="#fff" />
             </View>
             
             <View style={styles.textContainer}>
               <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
               <Text style={styles.message} numberOfLines={2}>
                 {typeof notification.message === 'object' ? JSON.stringify(notification.message) : notification.message}
               </Text>
             </View>
             <TouchableOpacity style={styles.closeButton} onPress={(e) => { e.stopPropagation(); hideToast(); }}>
                <Ionicons name="chevron-up" size={18} color="#999" />
             </TouchableOpacity>
           </TouchableOpacity>
        </View>
      ) : (
        <BlurView intensity={80} tint="light" style={styles.blurView}>
           <TouchableOpacity style={styles.toastContent} onPress={handleToastPress} activeOpacity={0.8}>
             <Image source={getAvatarSource()} style={styles.avatar} defaultSource={require('@/assets/images/favicon.png')} />
             <View style={[styles.iconBadge, { backgroundColor: iconColor }]}>
               <Ionicons name={iconName as any} size={11} color="#fff" />
             </View>

             <View style={styles.textContainer}>
               <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
               <Text style={styles.message} numberOfLines={2}>
                 {typeof notification.message === 'object' ? JSON.stringify(notification.message) : notification.message}
               </Text>
             </View>
             <TouchableOpacity style={styles.closeButton} onPress={(e) => { e.stopPropagation(); hideToast(); }}>
                <Ionicons name="chevron-up" size={18} color="#666" />
             </TouchableOpacity>
           </TouchableOpacity>
        </BlurView>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 45,
    zIndex: 9999,
    borderRadius: 20,
    ...createShadow({ width: 0, height: 8, opacity: 0.15, radius: 12, elevation: 12 }),
  },
  blurView: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.70)', // Light glass effect
  },
  blurFallback: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 30, 30, 0.98)',   // Dark mode web
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    minHeight: 70,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eee',
  },
  iconBadge: {
    position: 'absolute',
    bottom: 8,
    left: 40,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Platform.OS === 'web' ? '#1e1e1e' : '#fff',
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '700',
    fontSize: 14,
    color: Platform.OS === 'web' ? '#fff' : '#1a1a1a',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: Platform.OS === 'web' ? '#bbb' : '#555',
    lineHeight: 18,
  },
  closeButton: {
    padding: 8,
    opacity: 0.7,
  }
});