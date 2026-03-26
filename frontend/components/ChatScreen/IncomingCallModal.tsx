// components/ChatScreen/IncomingCallModal.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCall } from '@/context/CallContext';
import Avatar from '@/components/Image/Avatar';
import { createShadow } from '@/utils/styles';

const { width, height } = Dimensions.get('window');

/**
 * Global incoming call overlay — renders above all screens when isRinging=true.
 * Works like WhatsApp / Telegram:
 *  - Slides up from bottom
 *  - Pulsing green rings around the avatar
 *  - Accept / Decline buttons
 *  - Auto-dismissed after 60 s (missed call) via CallContext
 */
export const IncomingCallModal: React.FC = () => {
  const { incomingCall, isRinging, acceptIncomingCall, rejectIncomingCall, messageIncomingCall } = useCall();

  // ─── Animations ────────────────────────────────────────────────────────────
  const slideAnim  = useRef(new Animated.Value(height)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Alpha = useRef(new Animated.Value(0.6)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Alpha = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (incomingCall && isRinging) {
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        mass: 0.9,
        stiffness: 120,
      }).start();

      // Pulsing accept-button scale
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 550, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 550, useNativeDriver: true }),
        ])
      );
      pulseLoop.start();

      // Ripple rings around avatar
      const ringLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(ring1Scale, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
            Animated.timing(ring1Scale, { toValue: 1,   duration: 0,    useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(ring1Alpha, { toValue: 0, duration: 1000, useNativeDriver: true }),
            Animated.timing(ring1Alpha, { toValue: 0.6, duration: 0,  useNativeDriver: true }),
          ]),
        ])
      );

      const ring2Loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(ring2Scale, { toValue: 1.8, duration: 1400, useNativeDriver: true }),
            Animated.timing(ring2Scale, { toValue: 1,   duration: 0,    useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(ring2Alpha, { toValue: 0, duration: 1400, useNativeDriver: true }),
            Animated.timing(ring2Alpha, { toValue: 0.4, duration: 0,  useNativeDriver: true }),
          ]),
        ])
      );

      ringLoop.start();
      ring2Loop.start();

      return () => {
        pulseLoop.stop();
        ringLoop.stop();
        ring2Loop.stop();
      };
    } else {
      // Slide out
      Animated.spring(slideAnim, {
        toValue: height + 200,
        useNativeDriver: true,
        damping: 20,
        mass: 1,
      }).start();
    }
  }, [incomingCall, isRinging]);

  // Don't render at all if no call
  if (!incomingCall || !isRinging) return null;

  const isVideo = incomingCall.callType === 'video';

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="box-none"
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 100 : 85}
        tint="dark"
        style={styles.blurContainer}
      >
        {/* Top drag handle */}
        <View style={styles.dragHandle}>
          <View style={styles.dragBar} />
        </View>

        {/* Caller Info */}
        <View style={styles.callerSection}>
          {/* Ripple rings */}
          <View style={styles.avatarWrapper}>
            <Animated.View
              style={[
                styles.ring,
                styles.ring2,
                {
                  transform: [{ scale: ring2Scale }],
                  opacity: ring2Alpha,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                styles.ring1,
                {
                  transform: [{ scale: ring1Scale }],
                  opacity: ring1Alpha,
                },
              ]}
            />
            <Avatar
              source={incomingCall.callerAvatar}
              name={incomingCall.callerName}
              size={90}
            />
          </View>

          <Text style={styles.callerName} numberOfLines={1}>
            {incomingCall.callerName}
          </Text>
          <View style={styles.callTypeBadge}>
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={13}
              color="#4CD964"
            />
            <Text style={styles.callTypeText}>
              {isVideo ? 'Video call' : 'Voice call'} · Incoming
            </Text>
          </View>
        </View>

        {/* Action Row */}
        <View style={styles.actionsRow}>
          {/* Decline */}
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.actionTouchable}
              onPress={rejectIncomingCall}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#FF453A', '#C0392B']}
                style={styles.actionCircle}
              >
                <Ionicons name="call" size={32} color="#fff" style={styles.declineIcon} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>

          {/* Message (rejects call + opens chat) */}
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.actionTouchable}
              onPress={messageIncomingCall}
              activeOpacity={0.85}
            >
              <View style={styles.messageCircle}>
                <Ionicons name="chatbubble" size={26} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Message</Text>
          </View>

          {/* Accept */}
          <View style={styles.actionItem}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={styles.actionTouchable}
                onPress={acceptIncomingCall}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#30D158', '#25A244']}
                  style={styles.actionCircle}
                >
                  <Ionicons
                    name={isVideo ? 'videocam' : 'call'}
                    size={32}
                    color="#fff"
                  />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>

        {/* Swipe hint */}
        {Platform.OS !== 'web' && (
          <Text style={styles.swipeHint}>Slide up to answer</Text>
        )}
      </BlurView>
    </Animated.View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 90;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    // Ensure we sit above every other overlay
    elevation: 999,
  },
  blurContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingTop: 8,
    // Dark border for glass feel
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...createShadow({ width: 0, height: -4, opacity: 0.5, radius: 20, elevation: 30 }),
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // ─── Caller section ──────────────────────────────────────────────────────
  callerSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    width: AVATAR_SIZE + 40,
    height: AVATAR_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  ring1: {
    width: AVATAR_SIZE + 22,
    height: AVATAR_SIZE + 22,
    borderColor: '#30D158',
  },
  ring2: {
    width: AVATAR_SIZE + 40,
    height: AVATAR_SIZE + 40,
    borderColor: '#30D158',
  },
  callerName: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(48,209,88,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  callTypeText: {
    color: '#4CD964',
    fontSize: 13,
    fontWeight: '500',
  },

  // ─── Actions ─────────────────────────────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: Platform.OS === 'web' ? 56 : 44,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionItem: {
    alignItems: 'center',
    gap: 10,
  },
  actionTouchable: {
    borderRadius: 100,
  },
  actionCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadow({ width: 0, height: 6, opacity: 0.4, radius: 12, elevation: 10 }),
  },
  messageCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
  },
  swipeHint: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginTop: 4,
  },
});
