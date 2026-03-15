import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Animated, ActivityIndicator, TextInput, ScrollView, Platform, Vibration, Keyboard } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { markStoryAsViewed, fetchUserStories, sendStoryReply } from '@/services/StoryService';
import getApiBaseImage from '@/services/getApiBaseImage';
import { PostVideoPlayer } from './PostVideoPlayer';
import PostShareModal from './PostShareModal';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AnimatedComponent, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { GestureHandlerRootView, Gesture, GestureDetector, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useModal } from '@/context/ModalContext';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 10000; // 10 seconds
const LONG_PRESS_DURATION = 300;

interface Story {
  id: number;
  userId: number;
  media_path: string;
  type: 'photo' | 'video';
  caption?: string;
  stickers?: any;
  location?: any;
  viewed: boolean;
  user: {
    id: number;
    name: string;
    profile_photo: string;
  };
}

interface LocationData {
  name: string;
  lat?: number;
  lng?: number;
  id?: string;
}

interface FeelingData {
  emoji: string;
  text: string;
}

interface StoryViewerProps {
  userId: number;
  initialStoryId: number;
  onClose: () => void;
  onNextUser: (currentIndex?: number) => void;
  onPrevUser: (currentIndex?: number) => void;
}

const StoryViewer = ({ userId, initialStoryId, onClose, onNextUser, onPrevUser }: StoryViewerProps) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [locationData, setLocationData] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<any>(null);
  const replyInputRef = useRef<TextInput>(null);
  const router = useRouter();
  const { openModal } = useModal();

  // Animation values
  const replyButtonScale = useSharedValue(1);
  const locationPopupScale = useSharedValue(0);
  const reactionPanelY = useSharedValue(height);
  const volumeSliderOpacity = useSharedValue(0);

  // Load all stories for this user
  useEffect(() => {
    const loadStories = async () => {
      try {
        setLoading(true);
        const data = await fetchUserStories(userId);
        setStories(data);

        // Find the index of the initial story
        const initialIndex = data.findIndex((story: Story) => story.id === initialStoryId);
        const firstUnviewedIndex = data.findIndex((story: Story) => !story.viewed);
        setCurrentStoryIndex(
          firstUnviewedIndex !== -1 ? firstUnviewedIndex :
            initialIndex !== -1 ? initialIndex : 0
        );
      } catch (error) {
        console.error('Error loading stories:', error);
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadStories();
  }, [userId, initialStoryId]);

  // Mark story as viewed when it's displayed
  useEffect(() => {
    if (!loading && stories.length > 0 && currentStoryIndex >= 0) {
      const currentStory = stories[currentStoryIndex];
      if (currentStory && !currentStory.viewed) {
        markStoryAsViewed(currentStory.id)
          .then(() => {
            setStories(prevStories =>
              prevStories.map((story, idx) =>
                idx === currentStoryIndex ? { ...story, viewed: true } : story
              )
            );
          })
          .catch(error => {
            console.error('Error marking story as viewed:', error);
          });
      }
    }
  }, [currentStoryIndex, loading, stories]);

  // Handle story progression with pause support
  useEffect(() => {
    // Determine if we should be paused
    const shouldBePaused = loading || 
      stories.length === 0 || 
      paused || 
      showLocationPopup || 
      showShareModal || 
      showReactions || 
      isLongPressing ||
      showInfo;

    if (shouldBePaused) {
      progressAnim.stopAnimation();
      return;
    }

    // Reset animation
    progressAnim.setValue(0);

    // Start progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        handleNext();
      }
    });

    return () => {
      progressAnim.stopAnimation();
    };
  }, [currentStoryIndex, stories, paused, showLocationPopup, showShareModal, showReactions, isLongPressing, showInfo, loading]);

  const currentStory = useMemo(() => stories[currentStoryIndex], [stories, currentStoryIndex]);

  const handleNext = useCallback(() => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      onNextUser(currentStoryIndex);
    }
  }, [currentStoryIndex, stories.length, onNextUser]);

  const handlePrev = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else {
      onPrevUser(currentStoryIndex);
    }
  }, [currentStoryIndex, onPrevUser]);

  const togglePause = useCallback(() => {
    setPaused(prev => !prev);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleLongPress = useCallback(() => {
    setIsLongPressing(true);
    setPaused(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    // Show reactions after long press
    setShowReactions(true);
    reactionPanelY.value = withSpring(0, { damping: 20 });
  }, []);

  const handleLongPressRelease = useCallback(() => {
    setIsLongPressing(false);
    if (!showReactions) {
      setPaused(false);
    }
  }, [showReactions]);

  const handleTap = useCallback((evt: any) => {
    const { pageX } = evt.nativeEvent;
    const screenThird = width / 3;

    if (pageX < screenThird) {
      handlePrev();
    } else if (pageX > screenThird * 2) {
      handleNext();
    } else {
      togglePause();
    }
  }, [handlePrev, handleNext, togglePause]);

  const handleDoubleTap = useCallback(() => {
    // Like story
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // Show heart animation
    setShowReactions(true);
    setTimeout(() => setShowReactions(false), 1500);
  }, []);

  const handleSwipeDown = useCallback(() => {
    onClose();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [onClose]);

  const handleLocationPress = useCallback((location: any) => {
    openModal('location', { location });
    setPaused(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [openModal]);

  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() || !currentStory) return;

    setIsSendingReply(true);
    replyButtonScale.value = withSequence(
      withSpring(0.8),
      withSpring(1)
    );

    try {
      await sendStoryReply(currentStory.id, replyText);
      setReplyText('');
      Keyboard.dismiss();

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsSendingReply(false);
    }
  }, [replyText, currentStory]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    setShowVolumeSlider(true);
    volumeSliderOpacity.value = withTiming(1);

    // Auto hide after 2 seconds
    setTimeout(() => {
      volumeSliderOpacity.value = withTiming(0);
      setTimeout(() => setShowVolumeSlider(false), 200);
    }, 2000);
  }, []);

  // Gesture for swipe down to close
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 80) { // Increased threshold for better feel
        runOnJS(handleSwipeDown)();
      }
    });

  // Parse stickers safely
  const storyStickers = useMemo(() => {
    if (!currentStory?.stickers) return [];
    try {
      return typeof currentStory.stickers === 'string'
        ? JSON.parse(currentStory.stickers)
        : currentStory.stickers;
    } catch {
      return [];
    }
  }, [currentStory?.stickers]);

  // Parse location safely
  const storyLocation = useMemo(() => {
    if (!currentStory?.location) return null;
    try {
      return typeof currentStory.location === 'string'
        ? JSON.parse(currentStory.location)
        : currentStory.location;
    } catch {
      return null;
    }
  }, [currentStory?.location]);

  if (loading || !currentStory) {
    return (
      <View style={styles.container}>
        <BlurView intensity={90} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#FF9F0A" />
      </View>
    );
  }


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.container}>
          <BlurView intensity={100} style={StyleSheet.absoluteFill} />

          {/* Progress bars for all stories */}
          <View style={styles.progressBarsContainer}>
            {stories.map((story, index) => (
              <View key={story.id} style={styles.progressBarBackground}>
                {index === currentStoryIndex ? (
                  <Animated.View
                    style={[
                      styles.progressBar,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%']
                        })
                      }
                    ]}
                  />
                ) : (
                  <View style={[
                    styles.progressBar,
                    {
                      width: `${index < currentStoryIndex ? 100 : 0}%`,
                      backgroundColor: index < currentStoryIndex ? '#FF9F0A' : 'rgba(255,255,255,0.3)'
                    }
                  ]} />
                )}
              </View>
            ))}
          </View>

          {/* Premium Header with Glassmorphism */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent']}
            style={styles.headerGradient}
          >
            <View style={styles.header}>
              <View style={styles.userInfo}>
                <Image
                  source={{ uri: `${getApiBaseImage()}/storage/${currentStory.user.profile_photo}` }}
                  style={styles.userImage}
                />
                <View>
                  <Text style={styles.username}>{currentStory.user.name}</Text>
                  <Text style={styles.timeAgo}>Just now</Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity onPress={toggleMute} style={styles.headerButton}>
                  <Ionicons
                    name={isMuted ? 'volume-mute' : 'volume-high'}
                    size={22}
                    color="white"
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.headerButton}>
                  <Ionicons name="information-circle-outline" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>

          {/* Story content with gesture handling */}
          <View style={styles.contentWrapper}>
            <GestureDetector gesture={panGesture}>
              <TouchableOpacity
                style={styles.contentContainer}
                activeOpacity={1}
                onPress={handleTap}
                onLongPress={handleLongPress}
                onPressOut={handleLongPressRelease}
                delayLongPress={LONG_PRESS_DURATION}
              >
                {currentStory.type === 'video' ? (
                  <PostVideoPlayer
                    ref={videoRef}
                    uri={currentStory.media_path.startsWith('http') ? currentStory.media_path : `${getApiBaseImage()}/storage/${currentStory.media_path}`}
                    style={styles.storyMedia}
                    contentFit="contain"
                    shouldPlay={!paused && !showLocationPopup && !showShareModal && !showReactions && !showInfo}
                    isMuted={isMuted}
                    volume={volume}
                    onVolumeChange={handleVolumeChange}
                  />
                ) : (
                  <Image
                    source={{ uri: currentStory.media_path.startsWith('http') ? currentStory.media_path : `${getApiBaseImage()}/storage/${currentStory.media_path}` }}
                    style={styles.storyMedia}
                    resizeMode="contain"
                  />
                )}

                {/* Sticker Overlays with animations */}
                {storyStickers.map((sticker: any, index: number) => (
                  <AnimatedComponent.View
                    key={sticker.id || index}
                    entering={FadeIn.delay(index * 100).springify()}
                    style={[
                      styles.stickerWrapper,
                      {
                        left: sticker.x * width,
                        top: sticker.y * height,
                        transform: [
                          { scale: sticker.scale || 1 },
                          { rotate: `${sticker.rotation || 0}rad` }
                        ]
                      }
                    ]}
                  >
                    <View style={styles.stickerContent}>
                      {sticker.text !== '' && (
                        <Text
                          style={[
                            styles.stickerText,
                            {
                              color: sticker.color || 'white',
                              fontSize: sticker.fontSize || 32,
                              fontFamily: sticker.fontFamily || 'System',
                            }
                          ]}
                        >
                          {sticker.text}
                        </Text>
                      )}
                      
                      {sticker.location && (
                        <BlurView intensity={80} tint="dark" style={styles.integratedLocationSticker}>
                          <Ionicons name="location" size={14} color="#0084ff" />
                          <Text style={styles.integratedLocationStickerText}>{sticker.location.name}</Text>
                        </BlurView>
                      )}

                      {sticker.feeling && (
                        <BlurView intensity={80} tint="dark" style={styles.integratedFeelingSticker}>
                          <Text style={styles.integratedFeelingEmoji}>{sticker.feeling.emoji}</Text>
                          <Text style={styles.integratedFeelingText}>{sticker.feeling.text}</Text>
                        </BlurView>
                      )}
                    </View>
                  </AnimatedComponent.View>
                ))}


                {/* Caption with blur background */}
                {currentStory.caption && (
                  <BlurView intensity={60} style={styles.captionContainer}>
                    <Text style={styles.caption}>{currentStory.caption}</Text>
                  </BlurView>
                )}

                {/* Double tap heart animation placeholder */}
                {showReactions && (
                  <AnimatedComponent.View
                    entering={FadeIn.springify()}
                    exiting={FadeOut.springify()}
                    style={styles.heartOverlay}
                  >
                    <Ionicons name="heart" size={80} color="white" />
                  </AnimatedComponent.View>
                )}

                {/* Volume Slider Overlay */}
                {showVolumeSlider && (
                  <AnimatedComponent.View 
                    style={[styles.volumeSliderContainer, { opacity: volumeSliderOpacity }]}
                  >
                    <BlurView intensity={80} style={styles.volumeSlider}>
                      <Ionicons name={volume === 0 ? 'volume-mute' : 'volume-medium'} size={18} color="white" />
                      <View style={styles.volumeBar}>
                        <View style={[styles.volumeFill, { width: `${volume * 100}%` }]} />
                      </View>
                    </BlurView>
                  </AnimatedComponent.View>
                )}
              </TouchableOpacity>
            </GestureDetector>
          </View>

          {/* Premium Footer with Reply */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)']}
            style={styles.footerGradient}
          >
            <View style={styles.footer}>
              <View style={styles.replyContainer}>
                <TextInput
                  ref={replyInputRef}
                  style={styles.replyInput}
                  placeholder="Send message..."
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={replyText}
                  onChangeText={setReplyText}
                  editable={!isSendingReply}
                />
                <AnimatedComponent.View style={{ transform: [{ scale: replyButtonScale }] }}>
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      !replyText.trim() && styles.sendButtonDisabled
                    ]}
                    onPress={handleSendReply}
                    disabled={!replyText.trim() || isSendingReply}
                  >
                    {isSendingReply ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="send" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                </AnimatedComponent.View>
              </View>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => setShowShareModal(true)}
              >
                <Ionicons name="paper-plane-outline" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </LinearGradient>


          {/* Reactions Panel */}
          <Modal visible={showReactions} transparent animationType="none">
            <BlurView intensity={90} style={styles.modalOverlay}>
              <AnimatedComponent.View
                style={[
                  styles.reactionsPanel,
                  { transform: [{ translateY: reactionPanelY }] }
                ]}
              >
                <View style={styles.reactionsHeader}>
                  <Text style={styles.reactionsTitle}>React to story</Text>
                  <TouchableOpacity onPress={() => {
                    reactionPanelY.value = withSpring(height);
                    setTimeout(() => setShowReactions(false), 200);
                  }}>
                    <Ionicons name="close" size={24} color="white" />
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['❤️', '😂', '😮', '😢', '👏', '🔥'].map((emoji, index) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.reactionEmoji}
                      onPress={() => {
                        // Handle reaction
                        reactionPanelY.value = withSpring(height);
                        setTimeout(() => setShowReactions(false), 200);
                        if (Platform.OS !== 'web') {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                      }}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </AnimatedComponent.View>
            </BlurView>
          </Modal>

          {/* Info Modal */}
          <Modal visible={showInfo} transparent animationType="fade">
            <BlurView intensity={90} style={styles.modalOverlay}>
              <AnimatedComponent.View
                entering={SlideInDown.springify()}
                exiting={SlideOutDown.springify()}
                style={styles.infoModal}
              >
                <LinearGradient
                  colors={['#1a1a1a', '#2a2a2a']}
                  style={styles.infoContent}
                >
                  <View style={styles.infoHeader}>
                    <Text style={styles.infoTitle}>Story Info</Text>
                    <TouchableOpacity onPress={() => setShowInfo(false)}>
                      <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.infoItem}>
                    <Ionicons name="calendar-outline" size={20} color="#FF9F0A" />
                    <Text style={styles.infoLabel}>Posted:</Text>
                    <Text style={styles.infoValue}>Just now</Text>
                  </View>

                  <View style={styles.infoItem}>
                    <Ionicons name="eye-outline" size={20} color="#FF9F0A" />
                    <Text style={styles.infoLabel}>Views:</Text>
                    <Text style={styles.infoValue}>0</Text>
                  </View>

                  {storyLocation && (
                    <View style={styles.infoItem}>
                      <Ionicons name="location-outline" size={20} color="#FF9F0A" />
                      <Text style={styles.infoLabel}>Location:</Text>
                      <Text style={styles.infoValue}>{storyLocation.name}</Text>
                    </View>
                  )}
                </LinearGradient>
              </AnimatedComponent.View>
            </BlurView>
          </Modal>

          {/* Share Modal */}
          <PostShareModal
            visible={showShareModal}
            onClose={() => setShowShareModal(false)}
            story={currentStory}
          />
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FF9F0A',
  },
  username: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  timeAgo: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  progressBarsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    gap: 4,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF9F0A',
    borderRadius: 2,
  },
  storyMedia: {
    width: '100%',
    height: '100%',
  },
  stickerWrapper: {
    position: 'absolute',
    padding: 10,
  },
  stickerText: {
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  locationWrapper: {
    position: 'absolute',
    alignSelf: 'center',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
    overflow: 'hidden',
  },
  locationText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  caption: {
    color: 'white',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
  heartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 10,
  },
  replyContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 25,
    paddingLeft: 15,
    paddingRight: 5,
    paddingVertical: 5,
  },
  replyInput: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    paddingVertical: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF9F0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationPopup: {
    width: width * 0.8,
    borderRadius: 24,
    overflow: 'hidden',
  },
  locationPopupContent: {
    padding: 20,
  },
  locationPopupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationPopupTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 10,
  },
  locationMap: {
    height: 150,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationCoordinates: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    marginTop: 10,
  },
  volumeSliderContainer: {
    position: 'absolute',
    left: 20,
    top: height / 2 - 100,
    height: 200,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  volumeSlider: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  volumeBar: {
    width: 4,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    justifyContent: 'flex-end',
  },
  volumeFill: {
    backgroundColor: 'white',
    borderRadius: 2,
  },
  locationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,159,10,0.2)',
    borderRadius: 25,
  },
  locationActionText: {
    color: '#FF9F0A',
    fontSize: 16,
    fontWeight: '600',
  },
  reactionsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  reactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  reactionsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reactionEmoji: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  emojiText: {
    fontSize: 30,
  },
  infoModal: {
    width: width * 0.8,
    borderRadius: 24,
    overflow: 'hidden',
  },
  infoContent: {
    padding: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginLeft: 12,
    width: 80,
  },
  infoValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  stickerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  integratedLocationSticker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginTop: 8,
    gap: 6,
    overflow: 'hidden',
  },
  integratedLocationStickerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  integratedFeelingSticker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginTop: 6,
    gap: 6,
    overflow: 'hidden',
  },
  integratedFeelingEmoji: {
    fontSize: 14,
  },
  integratedFeelingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

// Add missing Modal import
import { Modal } from 'react-native';

export default StoryViewer;