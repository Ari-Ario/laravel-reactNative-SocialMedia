import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Modal,
  Image,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  withSpring,
} from 'react-native-reanimated';
import getApiBaseImage from '@/services/getApiBaseImage';
import { PostActionButtons } from './PostActionButtons';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Alert, Share as RNShare } from 'react-native';
import AuthContext from '@/context/AuthContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { LinearGradient } from 'expo-linear-gradient';

// Static constants removed - now using reactive hooks in components
const SWIPE_THRESHOLD = 50;
const ANIMATION_CONFIG = { duration: 300 };

type Media = {
  id: string;
  type: 'image' | 'video';
  file_path: string;
};

// components/MediaViewer.tsx
interface MediaViewerProps {
  visible: boolean;
  mediaItems: Array<{
    id: number;
    file_path: string;
    type: string;
  }>;
  startIndex: number;
  onClose: () => void;
  post: {
    id: number;
    user: {
      id: number | string;
      name: string;
      profile_photo: string | null;
    };
    caption: string;
    comments_count: number;
    comments: Array<{
      id: number;
      content: string;
      user_id: string | number;
      user: {
        id: number;
        name: string;
        profile_photo: string | null;
      };
      replies?: Array<any>;
      reaction_counts?: Array<any>;
    }>;
    reposts_count?: number;
    is_reposted?: boolean;
    reactions: any;
    reaction_counts: Array<{ emoji: string; count: number }>;
  } | null;
  getApiBaseImage: () => string;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  // Action button handlers
  onReact: (emoji: string) => void;
  onDeleteReaction: () => void;
  onRepost: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onCommentPress: () => void;
  onDoubleTap: () => void;
  // Reaction state
  currentReactingItem: {
    postId: number;
    commentId?: number;
  } | null;
  setCurrentReactingItem: (item: { postId: number; commentId?: number } | null) => void;
  setIsEmojiPickerOpen: (open: boolean) => void;
  // Comment functions
  onCommentSubmit: (content: string, parentId?: number) => Promise<any>;
  getGroupedReactions: (post: any, userId?: number) => Array<{
    emoji: string;
    count: number;
    user_ids: number[];
  }>;
  // For comment reactions
  handleReactComment: (emoji: string) => void;
  deleteCommentReaction: (emoji: string) => void;
  isBookmarked?: boolean;
}
// isMobileWeb replaced by reactive isMobileWebVal in components

// Internal component to handle individual media rendering and its hooks correctly
const MediaItemDisplay: React.FC<{
  media: any;
  index: number;
  currentIndex: number;
  getApiBaseImage: () => string;
  width: number;
  height: number;
}> = ({ media, index, currentIndex, getApiBaseImage, width, height }) => {
  const rawPath = media.file_path || media.url || '';
  const isFullUrl = rawPath.startsWith('http') || rawPath.startsWith('data:') || rawPath.startsWith('file:');

  const uri = isFullUrl
    ? rawPath
    : (rawPath.startsWith('storage/') || rawPath.startsWith('/storage/')
      ? `${getApiBaseImage()}/${rawPath.replace(/^\//, '')}`
      : `${getApiBaseImage()}/storage/${rawPath}`);

  const posterUri = media.thumbnail_path
    ? (media.thumbnail_path.startsWith('http') ? media.thumbnail_path : `${getApiBaseImage()}/storage/${media.thumbnail_path}`)
    : undefined;

  const isFocused = currentIndex === index;

  // useVideoPlayer MUST be called always if this component is rendered for a video
  const player = useVideoPlayer(
    media.type === 'video' ? uri : '',
    (p) => {
      p.loop = true;
      // On mobile web, default to muted for the 'photo-like' experience
      const isMobileWebVal = Platform.OS === 'web' && width < 768;
      p.muted = isMobileWebVal ? true : false;
      if (isFocused) p.play();
    }
  );

  const [isPlaying, setIsPlaying] = useState(isFocused);

  // Sync state with player
  useEffect(() => {
    const subscription = player.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
    });
    return () => subscription.remove();
  }, [player]);

  // Sync play/pause with focus state
  useEffect(() => {
    if (media.type === 'video') {
      if (isFocused) {
        player.play();
      } else {
        player.pause();
      }
    }
  }, [isFocused, media.type, player]);

  const isWhiteboard = media.metadata?.is_whiteboard_snapshot === true;

  if (media.type === 'video') {
    return (
      <View style={[styles.mediaContent, { width, height }, isWhiteboard && { backgroundColor: '#fff' }]}>
        <VideoView
          player={player}
          style={styles.innerMedia}
          contentFit="contain"
          nativeControls={false} 
          allowsVideoFrameAnalysis={false}
          // @ts-ignore
          posterSource={posterUri ? { uri: posterUri } : undefined}
        />
        {/* Interaction Overlay for Video */}
        <TouchableOpacity 
          style={styles.videoOverlay} 
          activeOpacity={1}
          onPress={() => {
            if (player.playing) {
              player.pause();
            } else {
              player.play();
            }
          }}
        >
          {!isPlaying && (
            <View style={styles.playIconOverlay}>
              <Ionicons name="play" size={50} color="white" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.innerMedia, { width, height }, isWhiteboard && { backgroundColor: '#fff' }]}
      resizeMode="contain"
    />
  );
};

export const MediaViewer: React.FC<MediaViewerProps> = ({
  visible,
  mediaItems,
  startIndex,
  onClose,
  post,
  getApiBaseImage,
  onNavigateNext,
  onNavigatePrev,
  // Action button handlers
  onReact,
  onDeleteReaction,
  onRepost,
  onShare,
  onBookmark,
  onCommentPress,
  // Reaction state
  currentReactingItem,
  setCurrentReactingItem,
  setIsEmojiPickerOpen,
  // Comment functions
  onCommentSubmit,
  getGroupedReactions,
  // For comment reactions
  handleReactComment,
  deleteCommentReaction,
  onDoubleTap,
  isBookmarked,
}) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const translateX = useSharedValue(-width * startIndex);
  const translateY = useSharedValue(0);
  const currentIndexShared = useSharedValue(startIndex); // Shared value for gestures
  const overlayOpacity = useSharedValue(0.7);
  const bgOpacity = useSharedValue(1);

  // Handle Dimension changes
  useEffect(() => {
    translateX.value = -width * currentIndex;
  }, [width, currentIndex]);

  const { colors } = useAppTheme();
  const { user } = React.useContext(AuthContext);
  const reactionsToShow = getGroupedReactions(post, Number(user?.id) || undefined);

  // Reset state when visibility or post changes
  useEffect(() => {
    if (visible) {
      setCurrentIndex(startIndex);
      currentIndexShared.value = startIndex;
      translateX.value = -width * startIndex;
      translateY.value = 0;
      overlayOpacity.value = 0.7;
      bgOpacity.value = 1;
    }
  }, [visible, startIndex, post?.id]);

  const handleNavigate = useCallback((index: number) => {
    if (index >= 0 && index < mediaItems.length) {
      setCurrentIndex(index);
      currentIndexShared.value = index;
      translateX.value = withTiming(-width * index, ANIMATION_CONFIG);
    }
  }, [mediaItems.length]); // Minimize dependencies

  const handleSwipeHorizontal = useCallback((direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? currentIndex + 1 : currentIndex - 1;
    handleNavigate(newIndex);
  }, [currentIndex, handleNavigate]);

  const handleClose = useCallback(() => {
    translateX.value = withTiming(-width * currentIndex, ANIMATION_CONFIG);
    translateY.value = withTiming(0, ANIMATION_CONFIG);
    overlayOpacity.value = withTiming(0.7, ANIMATION_CONFIG);
    bgOpacity.value = withTiming(0, ANIMATION_CONFIG, () => {
      runOnJS(onClose)();
    });
  }, [currentIndex, onClose]);

  const handleNavigateNextPost = useCallback(() => {
    translateY.value = withSpring(-height, {
      damping: 20,
      stiffness: 90,
    }, () => {
      runOnJS(onNavigateNext)();
    });
  }, [onNavigateNext]);

  const handleNavigatePrevPost = useCallback(() => {
    translateY.value = withSpring(height, {
      damping: 20,
      stiffness: 90,
    }, () => {
      runOnJS(onNavigatePrev)();
    });
  }, [onNavigatePrev]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      translateY.value = 0;
    })
    .onUpdate((event) => {
      // Priority 1: Vertical swipe (Close or Vertical Nav)
      if (Math.abs(event.translationY) > Math.abs(event.translationX)) {
        translateY.value = event.translationY;
        overlayOpacity.value = 0.7 - Math.abs(event.translationY) / 500;
        bgOpacity.value = 1 - Math.abs(event.translationY) / height;
      }
      // Priority 2: Horizontal swipe (Navigation)
      else if (mediaItems.length > 1) {
        translateX.value = -width * currentIndexShared.value + event.translationX;
      }
    })
    .onEnd((event) => {
      // Threshold for closing
      if (event.translationY > 50) {
        runOnJS(handleClose)();
        return;
      }

      // Vertical navigation thresholds
      if (event.translationY < -SWIPE_THRESHOLD * 2) {
        runOnJS(handleNavigateNextPost)();
        return;
      }
      if (event.translationY > SWIPE_THRESHOLD * 2 && event.translationX < -SWIPE_THRESHOLD) {
        runOnJS(handleNavigatePrevPost)();
        return;
      }

      // Horizontal navigation logic
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD && mediaItems.length > 1) {
        const direction = event.translationX > 0 ? 'right' : 'left';
        runOnJS(handleSwipeHorizontal)(direction);
      } else {
        // Snap back
        translateX.value = withTiming(-width * currentIndexShared.value, ANIMATION_CONFIG);
        translateY.value = withTiming(0, ANIMATION_CONFIG);
        overlayOpacity.value = withTiming(0.7, ANIMATION_CONFIG);
        bgOpacity.value = withTiming(1, ANIMATION_CONFIG);
      }
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
    backgroundColor: 'black',
  }));

  if (!visible || mediaItems.length === 0) return null;

  return (
    <GestureHandlerRootView style={[
      StyleSheet.absoluteFill,
      Platform.OS === 'web' && {
        position: 'fixed' as any,
        width: '100vw' as any,
        height: '100vh' as any,
        zIndex: 999999,
      }
    ]}>
      <Modal
        visible={visible}
        transparent
        animated
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <Animated.View style={[
          StyleSheet.absoluteFill, 
          bgStyle, 
          { backgroundColor: '#000', zIndex: 1000 },
          Platform.OS === 'web' && {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw' as any,
            height: '100vh' as any,
            minWidth: '100vw' as any,
            minHeight: '100vh' as any,
          }
        ]}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.modalContainer, containerStyle]}>
              {mediaItems.map((media, index) => (
                <View key={`${post?.id}-${media.id}-${index}`} style={[styles.mediaItem, { width, height, left: width * index }]}>
                  <MediaItemDisplay
                    media={media}
                    index={index}
                    currentIndex={currentIndex}
                    getApiBaseImage={getApiBaseImage}
                    width={width}
                    height={height}
                  />
                </View>
              ))}
            </Animated.View>
          </GestureDetector>


          {/* Media counter */}
          {mediaItems.length > 1 && (
            <Text style={[styles.counterText, { top: Math.max(insets.top, 20) + 10 }]}>
              {currentIndex + 1} / {mediaItems.length}
            </Text>
          )}

          {/* Consolidated Bottom Overlay: Caption + Actions */}
          {post && (
            <Animated.View style={[
              styles.bottomActions, 
              overlayStyle,
              { paddingBottom: Math.max(insets.bottom, 16) }
            ]}>
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.bottomContent}>
                {post.caption && (
                  <TouchableOpacity
                    onPress={() => setShowFullCaption(!showFullCaption)}
                    activeOpacity={0.8}
                    style={styles.captionWrapper}
                  >
                    <Text
                      style={styles.captionText}
                      numberOfLines={showFullCaption ? undefined : 2}
                    >
                      {post.caption}
                    </Text>
                  </TouchableOpacity>
                )}

                <PostActionButtons
                  post={post}
                  onReact={onReact}
                  onDeleteReaction={onDeleteReaction}
                  onRepost={onRepost}
                  onShare={onShare}
                  onBookmark={onBookmark}
                  onCommentPress={onCommentPress}
                  currentReactingItem={currentReactingItem}
                  setCurrentReactingItem={setCurrentReactingItem}
                  setIsEmojiPickerOpen={setIsEmojiPickerOpen}
                  getGroupedReactions={getGroupedReactions}
                  compact={true}
                  isDark={true}
                  isBookmarked={isBookmarked}
                />
              </View>
            </Animated.View>
          )}

          {/* Close button (now on the left) */}
          <TouchableOpacity style={[styles.closeButton, { top: Math.max(insets.top, 20) }]} onPress={handleClose}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Navigation Arrows */}
          {mediaItems.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.navButton, styles.leftNav]}
                onPress={() => {
                  if (currentIndex > 0) handleNavigate(currentIndex - 1);
                }}
              >
                <Ionicons name="chevron-back" size={32} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navButton, styles.rightNav]}
                onPress={() => {
                  if (currentIndex < mediaItems.length - 1) handleNavigate(currentIndex + 1);
                }}
              >
                <Ionicons name="chevron-forward" size={32} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </>
          )}

          {/* Download button */}
          <TouchableOpacity
            style={[styles.downloadButton, { top: Math.max(insets.top, 20) }]}
            onPress={async () => {
              try {
                const media = mediaItems[currentIndex];
                const uri = `${getApiBaseImage()}/storage/${media.file_path}`;

                if (Platform.OS === 'web') {
                  try {
                    const response = await fetch(uri);
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = media.file_path.split('/').pop() || 'media';
                      a.target = '_blank';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                    } else {
                      window.open(uri, '_blank');
                    }
                  } catch (fetchErr) {
                    console.warn('Fetch download failed, falling back to window.open:', fetchErr);
                    window.open(uri, '_blank');
                  }
                  return;
                }

                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission needed', 'Please allow access to save media.');
                  return;
                }

                const fileUri = ((FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '') + (media.file_path.split('/').pop() || 'media');
                const downloadResumable = FileSystem.createDownloadResumable(uri, fileUri);
                const result = await downloadResumable.downloadAsync();
                if (result) {
                  await MediaLibrary.saveToLibraryAsync(result.uri);
                  Alert.alert('Success', 'Media saved to library.');
                }
              } catch (err) {
                console.error('Download error:', err);
                Alert.alert('Error', 'Failed to download media.');
              }
            }}
          >
            <Ionicons name="download-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  mediaItem: {
    height: '100%',
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaContent: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerMedia: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  captionText: {
    color: 'white',
    fontSize: 16,
  },
  counterText: {
    position: 'absolute',
    alignSelf: 'center',
    color: 'white',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24,
    lineHeight: 30,
  },
  downloadButton: {
    position: 'absolute',
    right: 20,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 25,
    zIndex: 90,
  },
  leftNav: {
    left: 10,
  },
  rightNav: {
    right: 10,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 2000,
  },
  bottomContent: {
    padding: 16,
    zIndex: 2001,
  },
  captionWrapper: {
    marginBottom: 12,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  playIconOverlay: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});