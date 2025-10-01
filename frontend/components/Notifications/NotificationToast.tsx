// components/Notifications/NotificationToast.tsx
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Notification } from '@/types/Notification';

interface NotificationToastProps {
  notification: Notification;
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
  const slideAnim = new Animated.Value(-100);
  const opacityAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      console.log('🔔 NotificationToast: Showing notification', notification);
      
      // Slide in animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();

      // Auto hide after 3 seconds
      const timer = setTimeout(() => {
        hideToast();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  const getIconName = () => {
    switch (notification.type) {
      case 'comment': return 'chatbubble-outline';
      case 'reaction': return 'heart-outline';
      case 'comment_reaction': return 'heart-outline';
      case 'post': return 'image-outline';
      case 'new_post': return 'image-outline';
      case 'mention': return 'at-outline';
      case 'follow': return 'person-add-outline';
      case 'new_follower': return 'person-add-outline';
      case 'chatbot_training': return 'school-outline';
      case 'post_updated': return 'create-outline';
      case 'post_deleted': return 'trash-outline';
      default: return 'notifications-outline';
    }
  };

  const getIconColor = () => {
    switch (notification.type) {
      case 'comment': return '#007AFF';
      case 'reaction': return '#FF3B30';
      case 'comment_reaction': return '#FF3B30';
      case 'post': return '#4CD964';
      case 'new_post': return '#4CD964';
      case 'mention': return '#FF9500';
      case 'follow': return '#5856D6';
      case 'new_follower': return '#5856D6';
      case 'chatbot_training': return '#FF2D55';
      case 'post_updated': return '#FF9500';
      case 'post_deleted': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  return (
    <Animated.View style={[
      styles.toastContainer,
      {
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim
      }
    ]}>
      <TouchableOpacity style={styles.toastContent} onPress={onPress}>
        <Ionicons name={getIconName()} size={20} color={getIconColor()} />
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
          <Text style={styles.message} numberOfLines={2}>{notification.message}</Text>
        </View>
        <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
          <Ionicons name="close" size={16} color="#666" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    zIndex: 1000,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  textContainer: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    color: '#666',
  },
  closeButton: {
    padding: 4,
  },
});