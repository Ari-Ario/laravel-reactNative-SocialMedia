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
} from 'react-native';
import { Video } from 'expo-av';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  useAnimatedGestureHandler,
  withSpring,
} from 'react-native-reanimated';
import getApiBaseImage from '@/services/getApiBaseImage';

type Media = {
  id: string;
  type: 'image' | 'video';
  file_path: string;
};

type MediaViewerProps = {
  visible: boolean;
  mediaItems: Media[];
  startIndex: number;
  onClose: () => void;
  post: {
    id: number;
    caption?: string;
    [key: string]: any;
  };
  getApiBaseImage: () => string;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
};

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;
const ANIMATION_CONFIG = { duration: 300 };

export const MediaViewer: React.FC<MediaViewerProps> = ({
  visible,
  mediaItems,
  startIndex,
  onClose,
  post,
  getApiBaseImage,
  onNavigateNext,
  onNavigatePrev,
}) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const translateX = useSharedValue(-width * startIndex);
  const translateY = useSharedValue(0);
  const overlayOpacity = useSharedValue(0.7);
  const bgOpacity = useSharedValue(1);
  const videoRefs = useRef<(Video | null)[]>([]);

  // Initialize video refs array
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, mediaItems.length);
  }, [mediaItems]);

  // Reset state when visibility or post changes
  useEffect(() => {
    if (visible) {
      setCurrentIndex(startIndex);
      translateX.value = -width * startIndex;
      translateY.value = 0;
      overlayOpacity.value = 0.7;
      bgOpacity.value = 1;
    }
  }, [visible, startIndex, post.id]); // Add post.id to dependencies

  const handleSwipeHorizontal = useCallback((direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < mediaItems.length) {
      if (mediaItems[currentIndex].type === 'video' && videoRefs.current[currentIndex]) {
        videoRefs.current[currentIndex]?.pauseAsync();
      }
      setCurrentIndex(newIndex);
      translateX.value = withTiming(-width * newIndex, ANIMATION_CONFIG);
    }
  }, [currentIndex, mediaItems]);

  const handleClose = useCallback(() => {
    translateX.value = withTiming(-width * startIndex, ANIMATION_CONFIG);
    translateY.value = withTiming(0, ANIMATION_CONFIG);
    overlayOpacity.value = withTiming(0.7, ANIMATION_CONFIG);
    bgOpacity.value = withTiming(0, ANIMATION_CONFIG, () => {
      runOnJS(onClose)();
    });
  }, [startIndex, onClose]);

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

  const gestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      translateY.value = 0;
    },
    onActive: (event) => {
      if (Math.abs(event.translationY) > Math.abs(event.translationX)) {
        translateY.value = event.translationY;
        overlayOpacity.value = 0.7 - Math.abs(event.translationY) / 500;
        bgOpacity.value = 1 - Math.abs(event.translationY) / height;
      } 
      else if (mediaItems.length > 1) {
        translateX.value = -width * currentIndex + event.translationX;
      }
    },
    onEnd: (event) => {
      if (event.translationY > SWIPE_THRESHOLD) {
        runOnJS(handleClose)();
        return;
      }
      if (event.translationY < -SWIPE_THRESHOLD) {
        runOnJS(handleNavigateNextPost)();
        return;
      }
      if (event.translationY < -SWIPE_THRESHOLD / 2 && event.translationX < -SWIPE_THRESHOLD) {
        // Diagonal swipe up-left
        runOnJS(handleNavigatePrevPost)();
        return;
      }
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD && mediaItems.length > 1) {
        const direction = event.translationX > 0 ? 'right' : 'left';
        runOnJS(handleSwipeHorizontal)(direction);
      } else {
        translateX.value = withTiming(-width * currentIndex, ANIMATION_CONFIG);
        translateY.value = withTiming(0, ANIMATION_CONFIG);
        overlayOpacity.value = withTiming(0.7, ANIMATION_CONFIG);
        bgOpacity.value = withTiming(1, ANIMATION_CONFIG);
      }
    },
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
          <PanGestureHandler onGestureEvent={gestureHandler}>
            <Animated.View style={[styles.modalContainer, containerStyle]}>
              {mediaItems.map((media, index) => (
                <View key={`${post.id}-${media.id}-${index}`} style={[styles.mediaItem, { left: width * index }]}>
                  {media.type === 'video' ? (
                    <Video
                      ref={(ref) => {
                        if (ref) videoRefs.current[index] = ref;
                      }}
                      source={{ uri: `${getApiBaseImage()}/storage/${media.file_path}` }}
                      style={styles.mediaContent}
                      resizeMode="contain"
                      shouldPlay={index === currentIndex}
                      useNativeControls={false}
                      isLooping
                    />
                  ) : (
                    <Image
                      source={{ uri: `${getApiBaseImage()}/storage/${media.file_path}` }}
                      style={styles.mediaContent}
                      resizeMode="contain"
                    />
                  )}
                </View>
              ))}
            </Animated.View>
          </PanGestureHandler>

          {/* Caption overlay */}
          {post.caption && (
            <Animated.View style={[styles.captionContainer, overlayStyle]}>
              <TouchableOpacity 
                onPress={() => setShowFullCaption(!showFullCaption)}
                activeOpacity={0.8}
              >
                <Text 
                  style={styles.captionText}
                  numberOfLines={showFullCaption ? undefined : 1}
                >
                  {post.caption}
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

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>

          {/* Navigation arrows */}
          {currentIndex > 0 && (
            <TouchableOpacity 
              style={[styles.navButton, styles.leftNavButton]}
              onPress={() => handleSwipeHorizontal('right')}
            >
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>
          )}
          
          {currentIndex < mediaItems.length - 1 && (
            <TouchableOpacity 
              style={[styles.navButton, styles.rightNavButton]}
              onPress={() => handleSwipeHorizontal('left')}
            >
              <Text style={styles.navButtonText}>›</Text>
            </TouchableOpacity>
          )}
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
    bottom: 0,
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
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24,
    lineHeight: 30,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.31)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftNavButton: {
    left: 10,
  },
  rightNavButton: {
    right: 10,
  },
  navButtonText: {
    color: 'white',
    fontSize: 28,
    lineHeight: 30,
  },
});