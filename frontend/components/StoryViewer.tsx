import { Platform, View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Animated, ActivityIndicator, TextInput, ScrollView, Keyboard, Alert, Modal, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useCallback, useEffect, useRef, useState, useMemo, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { markStoryAsViewed, fetchUserStories, deleteStory, sendStoryReply } from '@/services/StoryService';
import getApiBaseImage from '@/services/getApiBaseImage';
import { deleteReportByTarget } from '@/services/ReportService';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useWindowDimensions } from 'react-native';
import PostShareModal from './PostShareModal';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { safeHaptics } from '@/utils/haptics';
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
import { AnimatePresence } from 'moti';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useModal } from '@/context/ModalContext';
import AuthContext from '@/context/AuthContext';
import { useStoryStore } from '@/stores/storyStore';
import { useCollaborationStore } from '@/stores/collaborationStore';
import ReportPost from './ReportPost';
import { useToastStore } from '@/stores/toastStore';
import { useReportedContentStore } from '@/stores/reportedContentStore';
import { createTextShadow } from '@/utils/styles';
import { useTranslation } from '@/constants/i18n';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 10000; // 10 seconds
const LONG_PRESS_DURATION = 300;

// Local Story interface removed in favor of import from storyStore

interface StoryViewerProps {
  userId: number;
  initialStoryId: number;
  onClose: () => void;
  onNextUser: (currentIndex?: number) => void;
  onPrevUser: (currentIndex?: number) => void;
}

// Module-level stylesheet for StoryVideoContent.
// Cannot use the theme-dependent `styles` from inside StoryViewer (different scope).
const storyVideoStyles = StyleSheet.create({
  mediaContainer: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
});

const StoryVideoContent = ({
  uri,
  paused,
  isMuted,
  volume,
  onVolumeChange,   // received but handled by parent; kept in props for forward-compatibility
}: {
  uri: string;
  paused: boolean;
  isMuted: boolean;
  volume: number;
  onVolumeChange?: (v: number) => void;
}) => {

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    // Sync audio state with user preference
    p.muted = isMuted;
    p.volume = volume;
    if (!paused) {
      p.play();
    }
  });

  useEffect(() => {
    player.muted = isMuted;
  }, [player, isMuted]);

  useEffect(() => {
    player.volume = volume;
  }, [player, volume]);

  useEffect(() => {
    if (paused) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, paused]);

  return (
    <View style={storyVideoStyles.mediaContainer}>
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, { maxWidth: '100%', maxHeight: '100%' }]}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        allowsVideoFrameAnalysis={false}
      />
    </View>
  );
};

const StoryViewer = ({ userId, initialStoryId, onClose, onNextUser, onPrevUser }: StoryViewerProps) => {
  const { t, isRTL } = useTranslation();
  const { showToast } = useToastStore();
  const { colors, activeScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors, activeScheme, isRTL);
  const { storyGroups, setStoriesForUser } = useStoryStore();
  const stories = useMemo(() => {
    const group = storyGroups.find(g => g.user.id === userId);
    // stories are now kept Oldest-first in the store
    return group ? group.stories : [];
  }, [storyGroups, userId]);

  const { width: windowWidth } = useWindowDimensions();
  const isMobileWeb = Platform.OS === 'web' && windowWidth < 768;

  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  // Ensure loading state is handled correctly since stories come from store
  useEffect(() => {
    if (stories.length > 0) {
      setLoading(false);
    }
  }, [stories.length]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(isMobileWeb); // Default to muted on mobile web for autoplay
  const [showLocationPopup] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [deleteStatus] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [isTyping, setIsTyping] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const replyInputRef = useRef<TextInput>(null);
  const hasInitialized = useRef(false);
  const { openModal } = useModal();
  const { user } = useContext(AuthContext);

  const formatTimeAgo = (timestamp: string) => {
    if (!timestamp) return t('time_just_now');
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (seconds < 60) return t('time_just_now');
      if (seconds < 3600) return `${Math.floor(seconds / 60)}${t('m_short')}`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}${t('h_short')}`;
      if (seconds < 2592000) return `${Math.floor(seconds / 86400)}${t('d_short')}`;
      return date.toLocaleDateString();
    } catch {
      return t('time_just_now');
    }
  };

  // Animation values
  const replyButtonScale = useSharedValue(1);
  const reactionPanelY = useSharedValue(height);
  const volumeSliderOpacity = useSharedValue(0);

  // Initialize current index based on initialStoryId
  useEffect(() => {
    if (stories.length > 0 && !hasInitialized.current) {
      const initialIndex = stories.findIndex((story) => story.id === initialStoryId);
      const firstUnviewedIndex = stories.findIndex((story) => !story.viewed);

      setCurrentStoryIndex(() => {
        // 1. Resume from the first story they haven't seen (highest priority for "Resume" behavior)
        if (firstUnviewedIndex !== -1) {
          hasInitialized.current = true;
          return firstUnviewedIndex;
        }

        // 2. If all viewed or no unviewed found, go to the specific story clicked
        if (initialIndex !== -1) {
          hasInitialized.current = true;
          return initialIndex;
        }

        // 3. Fallback: start at the oldest
        hasInitialized.current = true;
        return 0;
      });
    }
  }, [initialStoryId, stories.length, stories]); // Run once when stories loaded

  // Load all stories for this user
  useEffect(() => {
    const loadStories = async () => {
      try {
        setLoading(true);
        const data = await fetchUserStories(userId);
        setStoriesForUser(userId, data); // Update the store
      } catch (error) {
        console.error('Error loading stories:', error);
        onClose();
      } finally {
        // Loading state is now managed by the stories.length check
      }
    };

    // Only load if stories for this user are not already in the store or are empty
    const group = storyGroups.find(g => g.user.id === userId);
    if (!group || group.stories.length === 0) {
      loadStories();
    } else {
      setLoading(false); // If stories are already there, we're not loading
    }
  }, [userId, onClose, setStoriesForUser, storyGroups]);

  // Mark story as viewed when it's displayed
  useEffect(() => {
    if (!loading && stories.length > 0 && currentStoryIndex >= 0) {
      const currentStory = stories[currentStoryIndex];
      if (currentStory && !currentStory.viewed) {
        markStoryAsViewed(currentStory.id)
          .then(() => {
            // Update the story in the store
            setStoriesForUser(userId, stories.map((story, idx) =>
              idx === currentStoryIndex ? { ...story, viewed: true } : story
            ));
          })
          .catch(error => {
            console.error('Error marking story as viewed:', error);
          });
      }
    }
  }, [currentStoryIndex, loading, stories, userId, setStoriesForUser]);

  const currentStory = useMemo(() => stories[currentStoryIndex], [stories, currentStoryIndex]);

  const handleNext = useCallback(() => {
    // Validate current story and index before proceeding
    if (stories.length === 0) {
      onClose();
      return;
    }

    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      // Pass the index only if it points to a valid story
      const safeIndex = (currentStoryIndex < stories.length) ? currentStoryIndex : undefined;
      onNextUser(safeIndex);
    }
  }, [currentStoryIndex, stories.length, onNextUser, onClose]);

  const handlePrev = useCallback(() => {
    if (currentStoryIndex > 0 && stories.length > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else {
      const safeIndex = (currentStoryIndex < stories.length) ? currentStoryIndex : undefined;
      onPrevUser(safeIndex);
    }
  }, [currentStoryIndex, stories.length, onPrevUser]);

  const togglePause = useCallback(() => {
    setPaused(prev => !prev);
    safeHaptics.impact();
  }, []);

  const handleLongPress = useCallback(() => {
    setIsLongPressing(true);
    setPaused(true);
    safeHaptics.impact();

    // Show reactions after long press
    setShowReactions(true);
    reactionPanelY.value = withSpring(0, { damping: 20 });
  }, [reactionPanelY]);

  const handleLongPressRelease = useCallback(() => {
    setIsLongPressing(false);
    if (!showReactions) {
      setPaused(false);
    }
  }, [showReactions]);

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
      showInfo ||
      isTyping;

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
  }, [currentStoryIndex, stories, paused, showLocationPopup, showShareModal, showReactions, isLongPressing, showInfo, loading, progressAnim, handleNext, isTyping]);

  // Handle remote deletion and index integrity
  const lastViewedStoryId = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && stories.length > 0) {
      const storyExists = stories.some(s => s.id === currentStory?.id);

      if (!storyExists && currentStory) {
        console.log('⚠️ Current story was deleted remotely, re-syncing index');
        // If current story is gone, try to stay at the same index or go to the end
        if (currentStoryIndex >= stories.length) {
          setCurrentStoryIndex(stories.length - 1);
        } else {
          // Stay at same index (which now points to the next story)
          // but we might need to force a re-render
          setCurrentStoryIndex(prev => prev);
        }
      } else if (stories.length === 0) {
        // Spring to next user instead of closing
        onNextUser();
      }
    } else if (!loading && stories.length === 0) {
      onNextUser();
    }
  }, [stories.length, loading, currentStory?.id, currentStoryIndex, onNextUser]);

  // Animated Styles
  const animatedVolumeStyle = useAnimatedStyle(() => ({
    opacity: volumeSliderOpacity.value,
  }));

  const animatedReplyButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: replyButtonScale.value }],
  }));

  const animatedReactionPanelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reactionPanelY.value }],
  }));

  const handleTap = useCallback((event: { nativeEvent: { pageX: number } }) => {
    const { pageX } = event.nativeEvent;
    const screenThird = width / 3;

    if (pageX < screenThird) {
      handlePrev();
    } else if (pageX > screenThird * 2) {
      handleNext();
    } else {
      togglePause();
    }
  }, [handlePrev, handleNext, togglePause]);

  const handleSwipeDown = useCallback(() => {
    onClose();
    safeHaptics.impact();
  }, [onClose]);

  const handleLocationPress = useCallback((location: { latitude: number; longitude: number; name: string }) => {
    openModal('location', { location });
    setPaused(true);
    safeHaptics.impact();
  }, [openModal]);

  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() || !currentStory) return;

    setIsSendingReply(true);
    replyButtonScale.value = withSequence(
      withSpring(0.8),
      withSpring(1)
    );

    try {
      // Use the dedicated story reply service which handles space creation on backend
      await sendStoryReply(currentStory.id, replyText.trim());

      // ✅ Update chat store to reflect the new message/space immediately
      if (user?.id) {
        useCollaborationStore.getState().fetchUserSpaces(Number(user.id));
      }

      setReplyText('');
      Keyboard.dismiss();

      if (Platform.OS !== 'web') {
        safeHaptics.success();
      }

      showToast(t('reply_sent'), 'success');
    } catch (error) {
      console.error('Error sending reply:', error);
      showToast(t('failed_send_reply'), 'error');
      safeHaptics.error();
    } finally {
      setIsSendingReply(false);
    }
  }, [replyText, currentStory, replyButtonScale, user?.id, showToast]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    safeHaptics.impact();
  }, []);

  const handleDeleteStory = useCallback(async () => {
    console.log('🗑️ Delete icon pressed');
    if (!currentStory) return;

    const performDelete = async () => {
      try {
        setIsSendingReply(true);
        console.log('🗑️ Deleting story via API:', currentStory.id);
        await deleteStory(currentStory.id);

        console.log('✅ Story deleted successfully');
        safeHaptics.success();

        // Show success message
        showToast(t('story_deleted_success'), 'success');

        // INSTANT LOCAL UPDATE: Update the store immediately for the owner
        // This makes the transition "spring" instantly without waiting for Pusher
        useStoryStore.getState().handleStoryDeleted({
          storyId: currentStory.id,
          userId: Number(currentStory.user.id)
        });

      } catch (error) {
        console.error('❌ Failed to delete story:', error);
        showToast(t('could_not_delete_story'), 'error');
      } finally {
        setIsSendingReply(false);
      }
    };

    if (Platform.OS === 'web') {
      console.log('🖥️ Web: Showing browser confirmation');
      if (window.confirm(t('delete_story_confirm'))) {
        await performDelete();
      } else {
        console.log('❌ Web: Deletion cancelled');
      }
    } else {
      Alert.alert(
        t('delete_story_title'),
        t('delete_story_confirm'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: performDelete
          }
        ]
      );
    }
  }, [currentStory, stories, currentStoryIndex, onClose, handleNext, handlePrev, showToast]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    setShowVolumeSlider(true);
    volumeSliderOpacity.value = withTiming(1);

    setTimeout(() => {
      volumeSliderOpacity.value = withTiming(0);
      setTimeout(() => setShowVolumeSlider(false), 200);
    }, 2000);
  }, [volumeSliderOpacity]);

  // Gesture for swipe down to close
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 80) {
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

  const backgroundColors = useMemo(() => {
    const bgMetadata = storyStickers.find((s: { type: string; colors?: string[]; gradient?: string[] }) => s.type === 'background');
    return bgMetadata ? (bgMetadata.colors || bgMetadata.gradient) : null;
  }, [storyStickers]);

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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BlurView intensity={90} tint={activeScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={panGesture}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.container, GlobalStyles.popupContainer, { backgroundColor: '#000' }]}>
            <BlurView intensity={100} style={StyleSheet.absoluteFill} />

            {/* Delete Status Message */}
            <AnimatePresence>
              {deleteStatus.visible && (
                <AnimatedComponent.View
                  entering={FadeIn.duration(300)}
                  exiting={FadeOut.duration(300)}
                  style={styles.deleteStatus}
                >
                  <BlurView intensity={80} tint={activeScheme === 'dark' ? 'dark' : 'light'} style={styles.deleteStatusContent}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CD964" />
                    <Text style={[styles.deleteStatusText, { color: colors.text }]}>{deleteStatus.message}</Text>
                  </BlurView>
                </AnimatedComponent.View>
              )}
            </AnimatePresence>

            {/* Progress bars for all stories */}
            <View style={[styles.progressBarsContainer, { paddingTop: Math.max(insets.top, 15) }]}>
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
                        backgroundColor: index < currentStoryIndex ? colors.tint : (activeScheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)')
                      }
                    ]} />
                  )}
                </View>
              ))}
            </View>

            {/* Header */}
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'transparent']}
              style={styles.headerGradient}
            >
              <View style={[styles.header, { paddingTop: Math.max(insets.top, 15) + 10 }]}>
                <View style={styles.userInfo}>
                  <Image
                    source={{ uri: `${getApiBaseImage()}/storage/${currentStory.user.profile_photo}` }}
                    style={styles.userImage}
                  />
                  <View>
                    <Text style={styles.username}>{currentStory.user.name}</Text>
                    <Text style={styles.timeAgo}>{formatTimeAgo(currentStory.created_at)}</Text>
                  </View>
                </View>

                <View style={styles.headerActions}>
                  {currentStory?.type === 'video' && (
                    <TouchableOpacity onPress={toggleMute} style={styles.headerButton}>
                      <Ionicons
                        name={isMuted ? 'volume-mute' : 'volume-high'}
                        size={22}
                        color="white"
                      />
                    </TouchableOpacity>
                  )}
                  {storyLocation && (
                    <TouchableOpacity onPress={() => handleLocationPress(storyLocation)} style={styles.headerButton}>
                      <Ionicons name="location" size={24} color="#0084ff" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.headerButton}>
                    <Ionicons name="information-circle-outline" size={24} color="white" />
                  </TouchableOpacity>
                  {Number(currentStory.user.id) !== Number(user?.id) && (
                    <TouchableOpacity onPress={async () => {
                      const reported = useReportedContentStore.getState().isReported('story', currentStory.id);
                      if (reported) {
                        try {
                          await deleteReportByTarget('story', currentStory.id);
                          useReportedContentStore.getState().removeReportedItem('story', currentStory.id);
                          showToast(t('report_removed_msg'), 'success');
                        } catch {
                          showToast(t('failed_remove_report_msg'), 'error');
                        }
                      } else {
                        setShowReportModal(true);
                      }
                    }} style={styles.headerButton}>
                      <Ionicons
                        name={useReportedContentStore.getState().isReported('story', currentStory.id) ? "flag" : "flag-outline"}
                        size={22}
                        color={useReportedContentStore.getState().isReported('story', currentStory.id) ? "#ff4444" : "white"}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                    <Ionicons name="close" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>

            {/* Story content */}
            <View key={`story-content-${currentStory.id}`} style={styles.contentWrapper}>
              <TouchableOpacity
                style={styles.contentContainer}
                activeOpacity={1}
                onPress={handleTap}
                onLongPress={handleLongPress}
                onPressOut={handleLongPressRelease}
                delayLongPress={LONG_PRESS_DURATION}
              >
                {/* Main Media or Background Color */}
                {currentStory.type === 'video' ? (
                  <StoryVideoContent
                    key={`video-${currentStory.id}`}
                    uri={currentStory.media_path.startsWith('http') ? currentStory.media_path : `${getApiBaseImage()}/storage/${currentStory.media_path}`}
                    paused={paused || showLocationPopup || showShareModal || showReactions || showInfo}
                    isMuted={isMuted}
                    volume={volume}
                    onVolumeChange={handleVolumeChange}
                  />
                ) : backgroundColors ? (
                  backgroundColors.length > 1 ? (
                    <LinearGradient
                      key={`gradient-${currentStory.id}`}
                      colors={backgroundColors}
                      style={styles.storyMedia}
                    />
                  ) : (
                    <View key={`bg-${currentStory.id}`} style={[styles.storyMedia, { backgroundColor: backgroundColors[0] }]} />
                  )
                ) : (
                  <Image
                    key={`image-${currentStory.id}`}
                    source={{ uri: currentStory.media_path.startsWith('http') ? currentStory.media_path : `${getApiBaseImage()}/storage/${currentStory.media_path}` }}
                    style={styles.storyMedia}
                    resizeMode="contain"
                  />
                )}

                {/* Stickers */}
                {storyStickers.filter((s: { type: string }) => s.type !== 'background').map((sticker: { id: string | number; type: string; x: number; y: number; scale?: number; rotation?: number; text?: string; color?: string; fontSize?: number; fontFamily?: string; location?: { name: string; latitude: number; longitude: number }; feeling?: { emoji: string; text: string } }, index: number) => (
                  <AnimatedComponent.View
                    key={sticker.id || index}
                    entering={FadeIn.delay(index * 100).springify()}
                    style={[
                      styles.stickerWrapper,
                      {
                        left: sticker.type === 'text' ? 0 : sticker.x * width,
                        right: sticker.type === 'text' ? 0 : undefined,
                        top: sticker.y * height,
                        transform: [
                          { scale: sticker.scale || 1 },
                          { rotate: `${sticker.rotation || 0}rad` }
                        ],
                        zIndex: 10,
                        alignItems: 'center',
                      }
                    ]}
                  >
                    <View style={[styles.stickerContent, sticker.type === 'text' && { width: '100%' }]}>
                      {sticker.text !== '' && (
                        <Text
                          style={[
                            styles.stickerText,
                            {
                              color: sticker.color || 'white',
                              // Scale normalized font size back to current screen width
                              fontSize: sticker.fontSize ? (sticker.fontSize / 375) * width : 32,
                              lineHeight: sticker.fontSize ? (sticker.fontSize / 375) * width * 1.2 : 32 * 1.2,
                              fontFamily: sticker.fontFamily || 'System',
                              textAlign: 'center',
                              width: '100%',
                            }
                          ]}
                        >
                          {sticker.text}
                        </Text>
                      )}

                      {sticker.location && (
                        <TouchableOpacity
                          onPress={() => handleLocationPress(sticker.location)}
                          activeOpacity={0.7}
                        >
                          <BlurView intensity={80} tint="dark" style={styles.integratedLocationSticker}>
                            <Ionicons name="location" size={14} color={colors.tint} />
                            <Text style={styles.integratedLocationStickerText}>{sticker.location.name}</Text>
                          </BlurView>
                        </TouchableOpacity>
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

                {currentStory.caption && (
                  <BlurView intensity={60} style={styles.captionContainer}>
                    <Text style={styles.caption}>{currentStory.caption}</Text>
                  </BlurView>
                )}

                {showReactions && (
                  <AnimatedComponent.View
                    entering={FadeIn.springify()}
                    exiting={FadeOut.springify()}
                    style={styles.heartOverlay}
                  >
                    <Ionicons name="heart" size={80} color="white" />
                  </AnimatedComponent.View>
                )}

                {showVolumeSlider && (
                  <AnimatedComponent.View
                    style={[styles.volumeSliderContainer, animatedVolumeStyle]}
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
            </View>

            {/* Footer */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)']}
              style={styles.footerGradient}
            >
              <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                {Number(currentStory.user.id) === Number(user?.id) ? (
                  <View style={styles.ownerFooterActions}>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={handleDeleteStory}
                      disabled={isSendingReply}
                    >
                      <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.shareButton}
                      onPress={() => setShowShareModal(true)}
                    >
                      <Ionicons name="paper-plane-outline" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.replyContainer}>
                    <TextInput
                      ref={replyInputRef}
                      style={[styles.replyInput, { color: '#fff' }]}
                      placeholder={t('send_message_placeholder')}
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={replyText}
                      onChangeText={setReplyText}
                      editable={!isSendingReply}
                      onFocus={() => {
                        setIsTyping(true);
                        setPaused(true);
                      }}
                      onBlur={() => {
                        setIsTyping(false);
                        setPaused(false);
                      }}
                    />
                    <AnimatedComponent.View style={animatedReplyButtonStyle}>
                      <TouchableOpacity
                        style={[
                          styles.sendButton,
                          { backgroundColor: colors.tint },
                          !replyText.trim() && styles.sendButtonDisabled
                        ]}
                        onPress={handleSendReply}
                        disabled={!replyText.trim() || isSendingReply}
                      >
                        {isSendingReply ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="send" size={20} color="#fff" style={styles.sendIcon} />
                        )}
                      </TouchableOpacity>
                    </AnimatedComponent.View>
                  </View>
                )}

                {Number(currentStory.user.id) !== Number(user?.id) && (
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => setShowShareModal(true)}
                  >
                    <Ionicons name="paper-plane-outline" size={24} color="white" />
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>

            {/* Reactions Panel */}
            <Modal visible={showReactions} transparent animationType="none">
              <BlurView intensity={90} tint={activeScheme === 'dark' ? 'dark' : 'light'} style={styles.modalOverlay}>
                <AnimatedComponent.View
                  style={[
                    styles.reactionsPanel,
                    { paddingBottom: Math.max(insets.bottom, 20) + 10 },
                    animatedReactionPanelStyle
                  ]}
                >
                  <View style={styles.reactionsHeader}>
                    <Text style={[styles.reactionsTitle, { color: colors.text }]}>{t('react_to_story')}</Text>
                    <TouchableOpacity onPress={() => {
                      reactionPanelY.value = withSpring(height);
                      setTimeout(() => setShowReactions(false), 200);
                    }}>
                      <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['❤️', '😂', '😮', '😢', '👏', '🔥'].map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={[styles.reactionEmoji, { backgroundColor: colors.muted }]}
                        onPress={() => {
                          reactionPanelY.value = withSpring(height);
                          setTimeout(() => setShowReactions(false), 200);
                          safeHaptics.success();
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
              <BlurView intensity={90} tint={activeScheme === 'dark' ? 'dark' : 'light'} style={styles.modalOverlay}>
                <AnimatedComponent.View
                  entering={SlideInDown.springify()}
                  exiting={SlideOutDown.springify()}
                  style={styles.infoModal}
                >
                  <View
                    style={[styles.infoContent, { backgroundColor: colors.surface }]}
                  >
                    <View style={[styles.infoHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.infoTitle, { color: colors.text }, isRTL && { textAlign: 'right' }]}>{t('story_info')}</Text>
                      <TouchableOpacity onPress={() => setShowInfo(false)}>
                        <Ionicons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.infoItem, { borderBottomColor: colors.border }, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Ionicons name="calendar-outline" size={20} color={colors.tint} />
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }, isRTL && { marginLeft: 0, marginRight: 12, textAlign: 'right' }]}>{t('posted_label')}</Text>
                      <Text style={[styles.infoValue, { color: colors.text }, isRTL && { textAlign: 'right' }]}>{new Date(currentStory.created_at).toLocaleString()}</Text>
                    </View>

                    <View style={[styles.infoItem, { borderBottomColor: colors.border }, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Ionicons name="eye-outline" size={20} color={colors.tint} />
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }, isRTL && { marginLeft: 0, marginRight: 12, textAlign: 'right' }]}>{t('views_label')}</Text>
                      <Text style={[styles.infoValue, { color: colors.text }, isRTL && { textAlign: 'right' }]}>{currentStory.views_count || 0}</Text>
                    </View>

                    <View style={[styles.infoItem, { borderBottomColor: colors.border }, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Ionicons name={currentStory.type === 'video' ? "videocam-outline" : "image-outline"} size={20} color={colors.tint} />
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }, isRTL && { marginLeft: 0, marginRight: 12, textAlign: 'right' }]}>{t('type_label')}</Text>
                      <Text style={[styles.infoValue, { color: colors.text }, isRTL && { textAlign: 'right' }]}>{currentStory.type === 'video' ? t('video_label') : t('photo_label')}</Text>
                    </View>

                    {currentStory.caption && (
                      <View style={[styles.infoItem, { borderBottomColor: colors.border }, isRTL && { flexDirection: 'row-reverse' }]}>
                        <Ionicons name="chatbubble-outline" size={20} color={colors.tint} />
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }, isRTL && { marginLeft: 0, marginRight: 12, textAlign: 'right' }]}>{t('caption_label')}</Text>
                        <Text style={[styles.infoValue, { color: colors.text }, isRTL && { textAlign: 'right' }]} numberOfLines={2}>{currentStory.caption}</Text>
                      </View>
                    )}

                    {storyLocation && (
                      <View style={[styles.infoItem, { borderBottomWidth: 0 }, isRTL && { flexDirection: 'row-reverse' }]}>
                        <Ionicons name="location-outline" size={20} color={colors.tint} />
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }, isRTL && { marginLeft: 0, marginRight: 12, textAlign: 'right' }]}>{t('location_label')}</Text>
                        <Text style={[styles.infoValue, { color: colors.text }, isRTL && { textAlign: 'right' }]}>{storyLocation.name}</Text>
                      </View>
                    )}
                  </View>
                </AnimatedComponent.View>
              </BlurView>
            </Modal>

            <PostShareModal
              visible={showShareModal}
              onClose={() => setShowShareModal(false)}
              story={currentStory}
            />
            <ReportPost
              visible={showReportModal}
              targetId={currentStory.id}
              type="story"
              onClose={() => setShowReportModal(false)}
              onReportSubmitted={() => {
                useToastStore.getState().showToast(t('report_story_ai_review'), 'success');
                setShowReportModal(false);
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const getStyles = (colors: any, activeScheme: string, isRTL: boolean) => StyleSheet.create({
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
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  progressBarsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 4,
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
    borderRadius: 2,
  },
  storyMedia: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  stickerWrapper: {
    position: 'absolute',
    padding: 10,
  },
  stickerText: {
    fontWeight: '700',
    ...createTextShadow({ color: 'rgba(0,0,0,0.5)', width: 1, height: 1, radius: 5 }),
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
    gap: 12,
  },
  ownerFooterActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  replyContainer: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 25,
    [isRTL ? 'paddingRight' : 'paddingLeft']: 15,
    [isRTL ? 'paddingLeft' : 'paddingRight']: 5,
    paddingVertical: 5,
  },
  replyInput: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    paddingVertical: 10,
    textAlign: isRTL ? 'right' : 'left',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    [isRTL ? 'paddingRight' : 'paddingLeft']: 2,
  },
  sendIcon: {
    transform: [{ rotate: isRTL ? '165deg' : '-15deg' }],
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
  reactionsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
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
  },
  infoLabel: {
    fontSize: 14,
    marginLeft: 12,
    width: 100,
  },
  infoValue: {
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
  deleteStatus: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    zIndex: 1000,
    alignItems: 'center',
  },
  deleteStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(76, 217, 100, 0.3)',
  },
  deleteStatusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default StoryViewer;