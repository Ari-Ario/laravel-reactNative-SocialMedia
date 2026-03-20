import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Animated, ActivityIndicator, TextInput, ScrollView, Platform, Keyboard, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useMemo, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { markStoryAsViewed, fetchUserStories, deleteStory } from '@/services/StoryService';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import PusherService from '@/services/PusherService';
import getApiBaseImage from '@/services/getApiBaseImage';
import { PostVideoPlayer } from './PostVideoPlayer';
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
} from 'react-native-reanimated';
import { AnimatePresence } from 'moti';
import { GestureHandlerRootView, GestureDetector, Gesture, TapGestureHandlerEventPayload } from 'react-native-gesture-handler';
import { useModal } from '@/context/ModalContext';
import AuthContext from '@/context/AuthContext';
import { useStoryStore } from '@/stores/storyStore';
import { useCollaborationStore } from '@/stores/collaborationStore';
import ReportPost from './ReportPost';
import { useToastStore } from '@/stores/toastStore';

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

interface StoryViewerProps {
  userId: number;
  initialStoryId: number;
  onClose: () => void;
  onNextUser: (currentIndex?: number) => void;
  onPrevUser: (currentIndex?: number) => void;
}

const StoryViewer = ({ userId, initialStoryId, onClose, onNextUser, onPrevUser }: StoryViewerProps) => {
  const { showToast } = useToastStore();
  const insets = useSafeAreaInsets();
  const { storyGroups, setStoriesForUser } = useStoryStore();
  const stories = useMemo(() => {
    const group = storyGroups.find(g => g.user.id === userId);
    return group ? group.stories : [];
  }, [storyGroups, userId]);

  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  // Ensure loading state is handled correctly since stories come from store
  useEffect(() => {
    if (stories.length > 0) {
      setLoading(false);
    }
  }, [stories.length]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [isTyping, setIsTyping] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<any>(null);
  const replyInputRef = useRef<TextInput>(null);
  const { openModal } = useModal();
  const { user } = useContext(AuthContext);

  // Animation values
  const replyButtonScale = useSharedValue(1);
  const reactionPanelY = useSharedValue(height);
  const volumeSliderOpacity = useSharedValue(0);

  // Initialize current index based on initialStoryId
  useEffect(() => {
    if (stories.length > 0) {
      const initialIndex = stories.findIndex((story: any) => story.id === initialStoryId);
      const firstUnviewedIndex = stories.findIndex((story: any) => !story.viewed);
      
      setCurrentStoryIndex(prev => {
        // If we already have an index and it's valid for new array, keep it or adjust
        if (prev >= stories.length) return Math.max(0, stories.length - 1);
        
        // Initial load
        if (prev === 0) {
          return firstUnviewedIndex !== -1 ? firstUnviewedIndex :
                 initialIndex !== -1 ? initialIndex : 0;
        }
        return prev;
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
  }, [currentStoryIndex, stories, paused, showLocationPopup, showShareModal, showReactions, isLongPressing, showInfo, loading, progressAnim, handleNext]);

  // Handle remote deletion by observing store changes
  useEffect(() => {
    if (!loading) {
      if (stories.length === 0) {
        onClose();
      } else if (currentStoryIndex >= stories.length) {
        setCurrentStoryIndex(stories.length - 1);
      }
    }
  }, [stories.length, loading, currentStoryIndex, onClose]);

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

  const handleTap = useCallback((event: any) => {
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

  const handleLocationPress = useCallback((location: any) => {
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
      // Direct sharing to owner via CollaborationService
      const collaborationService = CollaborationService.getInstance();
      const directSpace = await collaborationService.getOrCreateDirectSpace(currentStory.user.id);
      const spaceId = directSpace?.space?.id || directSpace?.id;

      if (spaceId) {
        const baseUrl = getApiBaseImage();
        const shareUrl = `${baseUrl}/story/${currentStory.id}`;
        
        const metadata = {
          story_id: currentStory.id,
          creator_name: currentStory.user.name || 'Anonymous',
          creator_avatar: currentStory.user.profile_photo,
          media_url: currentStory.media_path,
          media_type: currentStory.type || 'image',
          media: [], // Consistent with PostShareModal
          caption: currentStory.caption,
          is_internal_share: true,
          post_url: shareUrl,
          appended_message: replyText.trim()
        };

        await collaborationService.sendMessage(spaceId, {
          content: currentStory.caption || 'Shared a story',
          type: 'story_share' as any,
          metadata
        });

        // ✅ Ensure the sender's chat list is updated immediately
        if (user?.id) {
          useCollaborationStore.getState().fetchUserSpaces(Number(user.id));
        }
      }

      setReplyText('');
      Keyboard.dismiss();

      if (Platform.OS !== 'web') {
        safeHaptics.success();
      }
    } catch (error) {
      console.error('Error sending reply/share:', error);
      showToast('Failed to send reply. Please try again.', 'error');
      safeHaptics.error();
    } finally {
      setIsSendingReply(false);
    }
  }, [replyText, currentStory, replyButtonScale]);

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
        showToast('Story deleted successfully', 'success');
        safeHaptics.success();

        // Note: We don't need to manually update state here anymore because Pusher 
        // will broadcast 'story-deleted' and storyStore will handle it globally!
        // But if we want it to be instant for the owner, we can call it:
        // useStoryStore.getState().handleStoryDeleted({ storyId, userId: user!.id });
        
        setTimeout(() => {
          if (stories.length > 1) {
            if (currentStoryIndex < stories.length - 1) {
              handleNext();
            } else {
              handlePrev();
            }
          } else {
            onClose();
          }
        }, 1500);
      } catch (error) {
        console.error('❌ Failed to delete story:', error);
        showToast('Could not delete story. Please try again.', 'error');
      } finally {
        setIsSendingReply(false);
      }
    };

    if (Platform.OS === 'web') {
      console.log('🖥️ Web: Showing browser confirmation');
      if (window.confirm('Are you sure you want to delete this story?')) {
        await performDelete();
      } else {
        console.log('❌ Web: Deletion cancelled');
      }
    } else {
      Alert.alert(
        'Delete Story',
        'Are you sure you want to delete this story?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: performDelete
          }
        ]
      );
    }
  }, [currentStory, stories, currentStoryIndex, onClose]);

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
    const bgMetadata = storyStickers.find((s: any) => s.type === 'background');
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
      <View style={styles.container}>
        <BlurView intensity={90} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#FF9F0A" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={panGesture}>
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
                <BlurView intensity={80} tint="dark" style={styles.deleteStatusContent}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CD964" />
                  <Text style={styles.deleteStatusText}>{deleteStatus.message}</Text>
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
                      backgroundColor: index < currentStoryIndex ? '#FF9F0A' : 'rgba(255,255,255,0.3)'
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
                {storyLocation ? (
                  <TouchableOpacity onPress={() => handleLocationPress(storyLocation)} style={styles.headerButton}>
                    <Ionicons name="location" size={24} color="#0084ff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.headerButton}>
                    <Ionicons name="information-circle-outline" size={24} color="white" />
                  </TouchableOpacity>
                )}
                {Number(currentStory.user.id) !== Number(user?.id) && (
                  <TouchableOpacity onPress={() => setShowReportModal(true)} style={styles.headerButton}>
                    <Ionicons name="flag-outline" size={22} color="white" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>

          {/* Story content */}
          <View style={styles.contentWrapper}>
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
              ) : backgroundColors ? (
                backgroundColors.length > 1 ? (
                  <LinearGradient
                    colors={backgroundColors}
                    style={styles.storyMedia}
                  />
                ) : (
                  <View style={[styles.storyMedia, { backgroundColor: backgroundColors[0] }]} />
                )
              ) : (
                <Image
                  source={{ uri: currentStory.media_path.startsWith('http') ? currentStory.media_path : `${getApiBaseImage()}/storage/${currentStory.media_path}` }}
                  style={styles.storyMedia}
                  resizeMode="contain"
                />
              )}

              {/* Stickers */}
              {storyStickers.filter((s: any) => s.type !== 'background').map((sticker: any, index: number) => (
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
                            // Scale normalized font size back to current screen width
                            fontSize: sticker.fontSize ? (sticker.fontSize / 375) * width : 32,
                            fontFamily: sticker.fontFamily || 'System',
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
                          <Ionicons name="location" size={14} color="#0084ff" />
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
                    style={styles.replyInput}
                    placeholder="Send message..."
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
            <BlurView intensity={90} style={styles.modalOverlay}>
              <AnimatedComponent.View
                style={[
                  styles.reactionsPanel,
                  { paddingBottom: Math.max(insets.bottom, 20) + 10 },
                  animatedReactionPanelStyle
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
                  {['❤️', '😂', '😮', '😢', '👏', '🔥'].map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.reactionEmoji}
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
            onReportSubmitted={(reportId) => {
              useToastStore.getState().showToast('Report Submitted: Our AI is reviewing this story.', 'success');
              setShowReportModal(false);
            }}
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
    backgroundColor: 'rgba(30,30,30,0.95)',
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