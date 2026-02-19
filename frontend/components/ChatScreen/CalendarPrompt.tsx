import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  Animated,
  Easing,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText } from 'moti';

const { width, height } = Dimensions.get('window');

interface CalendarPromptProps {
  visible: boolean;
  onClose: () => void;
  onScheduleNow: () => void;
  spaceTitle?: string;
  spaceType?: string;
  participantCount?: number;
}

const CalendarPrompt: React.FC<CalendarPromptProps> = ({
  visible,
  onClose,
  onScheduleNow,
  spaceTitle = 'this space',
  spaceType = 'collaboration',
  participantCount = 0,
}) => {
  const [neverShowAgain, setNeverShowAgain] = useState(false);
  const [slideAnim] = useState(new Animated.Value(height));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [rippleAnim] = useState(new Animated.Value(0));
  const [buttonScaleAnim] = useState(new Animated.Value(1));

  // Animation sequences
  useEffect(() => {
    if (visible) {
      // Save user preference
      AsyncStorage.getItem('calendar_prompt_disabled').then(disabled => {
        if (disabled === 'true') {
          onClose();
          return;
        }
      });

      // Start animations
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse animation for calendar icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Ripple effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(rippleAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(rippleAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Haptic feedback
      if (Platform.OS !== 'web') {
        setTimeout(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 400);
      }
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleScheduleNow = () => {
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Save preference if needed
    if (neverShowAgain) {
      AsyncStorage.setItem('calendar_prompt_disabled', 'true');
    }

    onScheduleNow();
  };

  const handleMaybeLater = () => {
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (neverShowAgain) {
      AsyncStorage.setItem('calendar_prompt_disabled', 'true');
      Alert.alert(
        'Preferences Saved',
        'You won\'t see this prompt again. You can re-enable it in settings.',
        [{ text: 'OK' }]
      );
    }

    onClose();
  };

  const getSpaceIcon = (type: string) => {
    const icons: Record<string, string> = {
      meeting: 'videocam',
      brainstorm: 'bulb',
      workshop: 'school',
      document: 'document-text',
      whiteboard: 'easel',
      chat: 'chatbubbles',
      voice_channel: 'mic',
    };
    return icons[type] || 'cube';
  };

  const getSpaceColor = (type: string) => {
    const colors: Record<string, string> = {
      meeting: '#007AFF',
      brainstorm: '#4CAF50',
      workshop: '#FF9800',
      document: '#9C27B0',
      whiteboard: '#00BCD4',
      chat: '#2196F3',
      voice_channel: '#FF5722',
    };
    return colors[type] || '#007AFF';
  };

  const getRecommendationText = () => {
    if (participantCount > 5) {
      return 'With your team size, scheduling helps coordinate everyone\'s availability.';
    } else if (participantCount >= 2) {
      return 'Scheduling ensures all participants can join at a convenient time.';
    } else {
      return 'Schedule sessions to build momentum and maintain progress.';
    }
  };

  const getQuickSuggestions = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0); // 10 AM tomorrow

    const friday = new Date(now);
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    friday.setDate(friday.getDate() + daysUntilFriday);
    friday.setHours(15, 0, 0, 0); // 3 PM Friday

    return [
      {
        label: 'Tomorrow 10 AM',
        time: tomorrow,
        icon: 'sunny',
        color: '#FFD700',
      },
      {
        label: 'Friday 3 PM',
        time: friday,
        icon: 'cafe',
        color: '#FF6B6B',
      },
      {
        label: 'Next Week',
        time: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        icon: 'calendar',
        color: '#4ECDC4',
      },
    ];
  };

  const renderRipple = () => {
    const rippleScale = rippleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1.5],
    });

    const rippleOpacity = rippleAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.5, 0.3, 0],
    });

    return (
      <Animated.View
        style={[
          styles.ripple,
          {
            transform: [{ scale: rippleScale }],
            opacity: rippleOpacity,
          },
        ]}
      />
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleMaybeLater}
    >
      <BlurView intensity={Platform.OS === 'ios' ? 30 : 90} style={styles.blurOverlay}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleMaybeLater}
        >
          <Animated.View
            style={[
              styles.container,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              },
            ]}
          >
            {/* Header with animated gradient */}
            <LinearGradient
              colors={['#007AFF', '#5D3FD3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <View style={styles.iconContainer}>
                {/* Ripple effects */}
                {renderRipple()}
                {renderRipple()}

                {/* Animated calendar icon */}
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Ionicons name="calendar" size={64} color="#fff" />
                </Animated.View>

                {/* Space icon overlay */}
                <View style={styles.spaceIconOverlay}>
                  <Ionicons
                    name={getSpaceIcon(spaceType) as any}
                    size={24}
                    color="#fff"
                  />
                </View>
              </View>
            </LinearGradient>

            {/* Content */}
            <View style={styles.content}>
              <MotiText
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 500, delay: 200 }}
                style={styles.title}
              >
                Schedule Your First Session?
              </MotiText>

              <MotiText
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 500, delay: 300 }}
                style={styles.subtitle}
              >
                <Text style={styles.highlight}>{spaceTitle}</Text> is ready for collaboration
              </MotiText>

              <MotiText
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 500, delay: 400 }}
                style={styles.description}
              >
                {getRecommendationText()}
              </MotiText>

              {/* Quick suggestions */}
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: 500 }}
                style={styles.suggestionsContainer}
              >
                <Text style={styles.suggestionsTitle}>Quick suggestions:</Text>
                <View style={styles.suggestionsGrid}>
                  {getQuickSuggestions().map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionCard}
                      onPress={() => {
                        // This would pre-fill the scheduling form
                        onClose();
                        onScheduleNow();
                      }}
                    >
                      <View style={[styles.suggestionIcon, { backgroundColor: suggestion.color }]}>
                        <Ionicons name={suggestion.icon as any} size={16} color="#fff" />
                      </View>
                      <Text style={styles.suggestionLabel}>{suggestion.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </MotiView>

              {/* Stats */}
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 500, delay: 600 }}
                style={styles.statsContainer}
              >
                <View style={styles.statItem}>
                  <Ionicons name="people" size={16} color="#007AFF" />
                  <Text style={styles.statText}>{participantCount} participants</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="time" size={16} color="#007AFF" />
                  <Text style={styles.statText}>45 min recommended</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="trending-up" size={16} color="#007AFF" />
                  <Text style={styles.statText}>+87% completion rate</Text>
                </View>
              </MotiView>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleMaybeLater}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={20} color="#666" />
                  <Text style={styles.secondaryButtonText}>Maybe Later</Text>
                </TouchableOpacity>

                <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleScheduleNow}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#007AFF', '#5D3FD3']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      <Ionicons name="add-circle" size={22} color="#fff" />
                      <Text style={styles.primaryButtonText}>Schedule Now</Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>✨</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Never show again toggle */}
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 500, delay: 700 }}
                style={styles.preferenceContainer}
              >
                <View style={styles.preferenceRow}>
                  <View style={styles.preferenceTextContainer}>
                    <Ionicons name="notifications-off" size={16} color="#666" />
                    <Text style={styles.preferenceText}>Don't show this again</Text>
                  </View>
                  <Switch
                    value={neverShowAgain}
                    onValueChange={setNeverShowAgain}
                    trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
                    thumbColor="#fff"
                    ios_backgroundColor="#e0e0e0"
                  />
                </View>
                {neverShowAgain && (
                  <Text style={styles.preferenceHint}>
                    You can re-enable this in space settings
                  </Text>
                )}
              </MotiView>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  blurOverlay: {
    flex: 1,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(0, 0, 0, 0.7)',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(0, 0, 0, 0.3)',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.85,
    elevation: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }
    }),
  },
  headerGradient: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
  },
  spaceIconOverlay: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#FF6B6B',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    elevation: 4,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  highlight: {
    color: '#007AFF',
    fontWeight: '700',
  },
  description: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  suggestionsContainer: {
    marginBottom: 24,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  suggestionCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  primaryButton: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,122,255,0.3)',
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFD700',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    fontSize: 12,
  },
  preferenceContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preferenceTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  preferenceText: {
    fontSize: 14,
    color: '#666',
  },
  preferenceHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default CalendarPrompt;