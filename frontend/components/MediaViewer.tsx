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
} from 'react-native';
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
}
const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = 50; // More sensitive
const ANIMATION_CONFIG = { duration: 300 };

// Internal component to handle individual media rendering and its hooks correctly
const MediaItemDisplay: React.FC<{
  media: any;
  index: number;
  currentIndex: number;
  getApiBaseImage: () => string;
}> = ({ media, index, currentIndex, getApiBaseImage }) => {
  const uri = `${getApiBaseImage()}/storage/${media.file_path}`;
  const isFocused = currentIndex === index;

  // useVideoPlayer MUST be called always if this component is rendered for a video
  const player = useVideoPlayer(
    media.type === 'video' ? uri : '',
    (p) => {
      p.loop = true;
      if (isFocused) p.play();
    }
  );

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

  if (media.type === 'video') {
    return (
      <VideoView
        player={player}
        style={styles.mediaContent}
        contentFit="contain"
        nativeControls={false}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.mediaContent}
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
}) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const translateX = useSharedValue(-width * startIndex);
  const translateY = useSharedValue(0);
  const currentIndexShared = useSharedValue(startIndex); // Shared value for gestures
  const overlayOpacity = useSharedValue(0.7);
  const bgOpacity = useSharedValue(1);

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
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <Modal
        visible={visible}
        transparent
        animated
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.modalContainer, containerStyle]}>
              {mediaItems.map((media, index) => (
                <View key={`${post?.id}-${media.id}-${index}`} style={[styles.mediaItem, { left: width * index }]}>
                  <MediaItemDisplay
                    media={media}
                    index={index}
                    currentIndex={currentIndex}
                    getApiBaseImage={getApiBaseImage}
                  />
                </View>
              ))}
            </Animated.View>
          </GestureDetector>

          {/* Caption overlay */}
          {post?.caption && (
            <Animated.View style={[styles.captionContainer, overlayStyle]}>
              <TouchableOpacity
                onPress={() => setShowFullCaption(!showFullCaption)}
                activeOpacity={0.8}
              >
                <Text
                  style={styles.captionText}
                  numberOfLines={showFullCaption ? undefined : 1}
                >
                  {post.caption.substring(0, 30)}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Media counter */}
          {mediaItems.length > 1 && (
            <Text style={styles.counterText}>
              {currentIndex + 1} / {mediaItems.length}
            </Text>
          )}

          {/* Actions & Reactions */}
          {post && (
            <Animated.View style={[styles.bottomActions, overlayStyle]}>
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
              />
            </Animated.View>
          )}

          {/* Close button (now on the left) */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
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
            style={styles.downloadButton}
            onPress={async () => {
              try {
                const media = mediaItems[currentIndex];
                const uri = `${getApiBaseImage()}/storage/${media.file_path}`;

                if (Platform.OS === 'web') {
                  try {
                    const response = await fetch(uri);
                    if (!response.ok) throw new Error('CORS or network error');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = media.file_path.split('/').pop() || 'media';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
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
    width,
    height: '100%',
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaContent: {
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
  },
  captionText: {
    color: 'white',
    fontSize: 16,
  },
  counterText: {
    position: 'absolute',
    top: 50,
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
    top: 40,
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
    top: 40,
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
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});