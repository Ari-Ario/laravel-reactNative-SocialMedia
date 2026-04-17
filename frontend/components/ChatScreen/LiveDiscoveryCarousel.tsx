// components/LiveDiscoveryCarousel.tsx
import React, { useMemo, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { createShadow } from '@/utils/styles';
import Avatar from '@/components/Image/Avatar';
import AuthContext from '@/context/AuthContext';
import WebRTCService from '@/services/ChatScreen/WebRTCService';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = WINDOW_WIDTH * 0.75;
const CARD_HEIGHT = 65; // High-density thin design

/**
 * LiveDiscoveryCarousel
 * A thin, professional horizontal broadcast discovery bar.
 * Unique Features:
 *  - "Direct Listening": Toggle headset to hear in-place without navigating.
 *  - Synchronized Audio: Only one space plays at a time.
 *  - Glass-morphism aesthetic with high-density channel info.
 */
const LiveDiscoveryCarousel = () => {
  const { colors, activeScheme } = useAppTheme();
  const { user } = useContext(AuthContext);
  const { spaces, activeListeningSpaceId, setListeningSpaceId } = useCollaborationStore();
  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Filter for live channel spaces
  const liveChannels = useMemo(() => {
    return (spaces || []).filter(
      (s) => s.is_live && s.space_type === 'channel'
    );
  }, [spaces]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  if (liveChannels.length === 0) return null;

  const handleNavigate = (space: any) => {
    // Navigate to space with meeting tab + autostart flags
    // This triggers CallContext recovery and ChannelCallView auto-join
    router.push({
      pathname: `/(spaces)/${space.id}` as any,
      params: {
        tab: 'meeting',
        call: space.active_call_id || space.id,
        joining: '1',
        autostart: 'true',
        spaceType: 'channel'
      }
    });
  };

  const toggleListening = async (space: any) => {
    const rtc = WebRTCService.getInstance();
    
    // 1. If we are already listening to THIS space, stop it.
    if (activeListeningSpaceId === space.id) {
      await rtc.leaveCall();
      setListeningSpaceId(null);
      return;
    }

    // 2. If we are listening to another space, stop that one first.
    if (activeListeningSpaceId) {
      await rtc.leaveCall();
    }

    // 3. Join the new space in "silent listener" (isViewer) mode.
    try {
      if (!user) return;
      
      // Initialize if needed
      await rtc.initialize(Number(user.id));
      
      // Join as viewer (silent listener)
      const callId = space.active_call_id || space.id; 
      await rtc.joinCall(space.id, callId, false, true);
      
      setListeningSpaceId(space.id);
      console.log(`🎧 Direct Listen: Joined ${space.title} as listener`);
    } catch (e) {
      console.error('🎧 Direct Listen Failed:', e);
      setListeningSpaceId(null);
    }
  };

  const AnimatedCard = ({ space, index }: { space: any; index: number }) => {
    const isListening = activeListeningSpaceId === space.id;
    
    // ... animation logic ...
    const inputRange = [
      (index - 1) * (CARD_WIDTH + 12),
      index * (CARD_WIDTH + 12),
      (index + 1) * (CARD_WIDTH + 12),
    ];

    const animatedStyle = useAnimatedStyle(() => {
      const scale = interpolate(
        scrollX.value,
        inputRange,
        [0.96, 1, 0.96],
        Extrapolate.CLAMP
      );
      return { transform: [{ scale }] };
    });

    return (
      <Animated.View style={[styles.cardWrapper, animatedStyle]}>
        <View style={styles.card}>
          <BlurView
            intensity={activeScheme === 'dark' ? 15 : 45}
            tint={activeScheme === 'dark' ? 'dark' : 'light'}
            style={styles.blurContainer}
          >
            <View style={styles.cardContent}>
              {/* Tap anywhere to navigate */}
              <TouchableOpacity 
                style={styles.mainActionTouch}
                onPress={() => handleNavigate(space)}
                activeOpacity={0.7}
              >
                <View style={styles.liveBadge}>
                   <View style={styles.liveDot} />
                   <Text style={styles.liveText}>LIVE</Text>
                </View>

                <Avatar
                  source={space.creator?.profile_photo}
                  name={space.creator?.name}
                  size={32}
                  showStatus={false}
                />

                <View style={styles.infoContainer}>
                  <Text style={styles.channelName} numberOfLines={1}>
                    {space.title || 'Live Channel'}
                  </Text>
                  <View style={styles.participantsRow}>
                     <Ionicons name="people" size={10} color={colors.textSecondary} />
                     <Text style={styles.participantCount}>
                        {space.participants_count || 0}
                     </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Direct Listen Toggle Button */}
              <TouchableOpacity
                style={[
                    styles.headsetButton,
                    isListening && { backgroundColor: colors.tint + '30' }
                ]}
                onPress={() => toggleListening(space)}
              >
                <Ionicons
                  name={isListening ? "megaphone" : "headset"}
                  size={18}
                  color={isListening ? colors.error : colors.tint}
                />
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Animated.View>
    );
  };

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(300)}
      style={[
        styles.container,
        {
          backgroundColor: activeScheme === 'dark'
            ? 'rgba(0,0,0,0.85)'
            : 'rgba(255,255,255,0.9)',
          borderBottomColor: activeScheme === 'dark'
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.05)',
        }
      ]}
    >
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + 12}
        snapToAlignment="center"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {liveChannels.map((space, index) => (
          <AnimatedCard key={space.id} space={space} index={index} />
        ))}
      </Animated.ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: 35,
    overflow: 'hidden',
    ...createShadow({ opacity: 0.1, radius: 4, height: 2 }),
  },
  blurContainer: {
    flex: 1,
    borderRadius: 35,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  mainActionTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  channelName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  participantCount: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  headsetButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LiveDiscoveryCarousel;