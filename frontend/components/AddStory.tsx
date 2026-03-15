import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  Dimensions,
  SafeAreaView,
  KeyboardAvoidingView,
  StatusBar,
  PanResponder,
  ScrollView,
  FlatList,
  Keyboard
} from 'react-native';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';
import PlatformCameraView from './PlatformCameraView';
import { VideoView, useVideoPlayer } from 'expo-video';
import { BlurView } from 'expo-blur';
import { MotiView, AnimatePresence } from 'moti';
import EmojiPicker from 'rn-emoji-keyboard';
import { createStory } from '@/services/StoryService';
import getApiBaseImage from '@/services/getApiBaseImage';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import ShareLocation from '@/components/ChatScreen/ShareLocation';
import { GestureHandlerRootView, Gesture, GestureDetector, PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  useAnimatedReaction,
  withSequence,
  withDelay,
  interpolate,
  Extrapolate,
  cancelAnimation
} from 'react-native-reanimated';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import VideoTrimmer from './Shared/VideoTrimmer';

const { width, height } = Dimensions.get('window');
const RECORDING_LIMIT_MS = 10000;
const MAX_VIDEO_DURATION = 10; // seconds
const COLORS = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00',
  '#34C759', '#00C7BE', '#007AFF', '#5856D6', '#AF52DE',
  '#FF2D55', '#A2845E'
];
const FONTS = [
  'System',
  'Helvetica',
  'Courier',
  'Georgia',
  'Times New Roman',
  'Arial',
  'Verdana',
  'Roboto'
];

interface Sticker {
  id: string;
  type: 'text';
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontFamily: string;
  rotation: number;
  scale: number;
  isDragging?: boolean;
  location?: LocationData;
  feeling?: FeelingData;
}

interface LocationData {
  name: string;
  latitude: number;
  longitude: number;
  id?: string;
  address?: string;
}

interface FeelingData {
  emoji: string;
  text: string;
}

interface AddStoryProps {
  visible: boolean;
  onClose: () => void;
  onStoryCreated: () => void;
}

const AddStory: React.FC<AddStoryProps> = ({ visible, onClose, onStoryCreated }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [media, setMedia] = useState<{
    uri: string;
    type: 'photo' | 'video';
    startTime?: number;
    endTime?: number;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [zoom, setZoom] = useState(0);

  // Stickers and Metadata
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFeelingInput, setShowFeelingInput] = useState(false);
  const [tempEmoji, setTempEmoji] = useState('');
  const [feelingText, setFeelingText] = useState('');
  const [currentText, setCurrentText] = useState('');
  const [currentColor, setCurrentColor] = useState('#FFFFFF');
  const [currentFont, setCurrentFont] = useState('System');
  const [currentFontSize, setCurrentFontSize] = useState(32);
  const [needsTrimming, setNeedsTrimming] = useState(false);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);

  const cameraRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const longPressTimeout = useRef<any>(null);
  const textInputRef = useRef<TextInput>(null);

  // Animation values for stickers - store refs to shared values
  const stickerAnimations = useRef<Map<string, {
    translateX: SharedValue<number>;
    translateY: SharedValue<number>;
    scale: SharedValue<number>;
    rotation: SharedValue<number>;
  }>>(new Map()).current;

  const updateStickerPosition = useCallback((id: string, x: number, y: number) => {
    setStickers(prev => {
      // Check if the sticker exists
      const existingSticker = prev.find(s => s.id === id);
      if (!existingSticker) return prev;

      // Only update if position actually changed
      if (existingSticker.x === x && existingSticker.y === y) {
        return prev;
      }

      // Update the specific sticker
      return prev.map(s =>
        s.id === id ? { ...s, x, y } : s
      );
    });
  }, []);

  const deleteSticker = useCallback((id: string) => {
    setStickers(prev => prev.filter(s => s.id !== id));
    setSelectedSticker(prev => prev === id ? null : prev);
    // Clean up animation values
    stickerAnimations.delete(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Video Player for preview
  const videoPlayer = useVideoPlayer(media?.type === 'video' ? media.uri : null, (p) => {
    p.loop = true;
    p.play();
  });

  // Check video duration when media is selected
  useEffect(() => {
    if (media?.type === 'video' && media.uri) {
      getVideoDuration(media.uri);

      // Auto-seek to startTime if provided (mostly for web)
      if (media.startTime !== undefined && videoPlayer) {
        videoPlayer.currentTime = media.startTime * 1000;
        videoPlayer.play();
      }
    }
  }, [media?.uri, media?.startTime]);

  const getVideoDuration = async (uri: string) => {
    if (Platform.OS !== 'web') return; // For native, duration is usually handled by picker or player events

    try {
      const video = document.createElement('video');
      video.src = uri;
      video.onloadedmetadata = () => {
        const duration = video.duration;
        setVideoDuration(duration);
        if (duration > MAX_VIDEO_DURATION) {
          setNeedsTrimming(true);
          setShowTrimmer(true);
        }
      };
    } catch (error) {
      console.error('Error getting video duration:', error);
    }
  };

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible]);

  // Handle Recording Progress
  useEffect(() => {
    if (isRecording) {
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / RECORDING_LIMIT_MS, 1);
        setRecordingProgress(progress);

        if (elapsed >= RECORDING_LIMIT_MS) {
          stopRecording();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingProgress(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
    };
  }, [isRecording]);

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.9,
          base64: false,
          skipProcessing: false,
        });

        // Optional: Enhance image quality
        const manipulatedImage = await manipulateAsync(
          photo.uri,
          [{ resize: { width: 1080 } }],
          { compress: 0.9, format: SaveFormat.JPEG }
        );

        setMedia({ uri: manipulatedImage.uri, type: 'photo' });
      } catch (e) {
        console.error('Photo error:', e);
        Alert.alert('Error', 'Failed to take photo');
      }
    }
  };

  const startRecording = async () => {
    if (cameraRef.current) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setIsRecording(true);
        setRecordingProgress(0);

        // Small delay to ensure haptic feedback is felt
        await new Promise(resolve => setTimeout(resolve, 100));

        const video = await cameraRef.current.recordAsync({
          maxDuration: 10,
          quality: '720p',
        });

        if (video) {
          setMedia({ uri: video.uri, type: 'video' });
        }
      } catch (e) {
        console.error('Recording error:', e);
        setIsRecording(false);
        Alert.alert('Error', 'Failed to record video');
      }
    }
  };

  const handleLongPress = useCallback(() => {
    // Hold capture for video even if in picture mode (Instagram feel)
    longPressTimeout.current = setTimeout(() => {
      startRecording();
    }, 200);
  }, []);

  const handlePressOut = useCallback(() => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }
    if (isRecording) {
      stopRecording();
    } else if (cameraMode === 'picture') {
      takePhoto();
    }
  }, [isRecording, cameraMode]);

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
        videoMaxDuration: 10,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        setMedia({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'photo'
        });
      }
    } catch (error) {
      console.error('Gallery pick error:', error);
      Alert.alert('Error', 'Failed to pick from gallery');
    }
  };

  const handleLocationSelect = (locData: any) => {
    const mappedLoc: LocationData = {
      name: locData.name || 'Selected Location',
      latitude: locData.latitude,
      longitude: locData.longitude,
      address: locData.address,
    };

    if (selectedSticker) {
      setStickers(prev => prev.map(s =>
        s.id === selectedSticker ? { ...s, location: mappedLoc } : s
      ));
    } else if (stickers.length > 0) {
      setStickers(prev => {
        const next = [...prev];
        next[0] = { ...next[0], location: mappedLoc };
        return next;
      });
      setSelectedSticker(stickers[0].id);
    } else {
      const newSticker: Sticker = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'text',
        text: '',
        x: width / 2 - 75,
        y: height / 2 - 50,
        color: '#FFFFFF',
        fontSize: 24,
        fontFamily: 'System',
        rotation: 0,
        scale: 1,
        location: mappedLoc
      };
      setStickers(prev => [...prev, newSticker]);
      setSelectedSticker(newSticker.id);
    }

    setLocation(mappedLoc);
    setShowLocationSearch(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleEmojiSelect = (emojiObject: any) => {
    setTempEmoji(emojiObject.emoji);
    setShowEmojiPicker(false);
    // Auto-focus the feeling input after a small delay
    setTimeout(() => setShowFeelingInput(true), 300);
  };

  const handleFinishFeeling = () => {
    if (!tempEmoji) return;

    const feeling: FeelingData = {
      emoji: tempEmoji,
      text: feelingText.trim()
    };

    if (selectedSticker) {
      setStickers(prev => prev.map(s =>
        s.id === selectedSticker ? { ...s, feeling } : s
      ));
    } else if (stickers.length > 0) {
      setStickers(prev => {
        const next = [...prev];
        next[0] = { ...next[0], feeling };
        return next;
      });
      setSelectedSticker(stickers[0].id);
    } else {
      const newSticker: Sticker = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'text',
        text: '',
        x: width / 2 - 75,
        y: height / 2 - 50,
        color: '#FFFFFF',
        fontSize: 24,
        fontFamily: 'System',
        rotation: 0,
        scale: 1,
        feeling
      };
      setStickers(prev => [...prev, newSticker]);
      setSelectedSticker(newSticker.id);
    }

    setShowFeelingInput(false);
    setTempEmoji('');
    setFeelingText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddText = () => {
    if (currentText.trim()) {
      const newStickerId = Math.random().toString(36).substr(2, 9);
      const newSticker: Sticker = {
        id: newStickerId,
        type: 'text',
        text: currentText.trim(),
        x: width / 2 - 75,
        y: height / 2 - 50,
        color: currentColor,
        fontSize: currentFontSize,
        fontFamily: currentFont,
        rotation: 0,
        scale: 1,
      };

      setStickers(prev => {
        // Prevent accidental double-add if called rapidly with same text content in same position
        const isDuplicate = prev.some(s => s.text === newSticker.text && Math.abs(s.x - newSticker.x) < 1 && Math.abs(s.y - newSticker.y) < 1);
        if (isDuplicate) return prev;
        return [...prev, newSticker];
      });

      setCurrentText('');
      setShowTextEditor(false);
      setSelectedSticker(newStickerId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };


  const handleTrimComplete = (trimmedData: { uri: string; duration: number; startTime?: number; endTime?: number }) => {
    // Only add cache buster if it's not a blob URL, as blobs don't support query params
    const finalUri = (Platform.OS === 'web' && !trimmedData.uri.startsWith('blob:'))
      ? `${trimmedData.uri}${trimmedData.uri.includes('?') ? '&' : '?'}t=${Date.now()}`
      : trimmedData.uri;

    setMedia({
      uri: finalUri,
      type: 'video',
      startTime: trimmedData.startTime,
      endTime: trimmedData.endTime
    });
    setNeedsTrimming(false);
    setShowTrimmer(false);
  };

  const handleSave = async () => {
    if (!media?.uri) return;

    if (Platform.OS === 'web') {
      // For web, open in new tab to allow download
      window.open(media.uri, '_blank');
      return;
    }

    // For native, save to gallery
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow gallery access to save media.');
        return;
      }

      await MediaLibrary.saveToLibraryAsync(media.uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Media saved to gallery!');
    } catch (error) {
      console.error('Error saving media:', error);
      Alert.alert('Error', 'Failed to save media.');
    }
  };

  const handleShare = async () => {
    if (!media) return;

    try {
      setUploading(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const formData = new FormData();

      const filename = media.uri.split('/').pop() || (media.type === 'video' ? 'story.mp4' : 'story.jpg');
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : (media.type === 'video' ? 'mp4' : 'jpg');

      // Strict mime type assignment based on media type
      let type = '';
      if (media.type === 'video') {
        type = 'video/mp4';
      } else {
        type = ext === 'png' ? 'image/png' : 'image/jpeg';
      }

      if (Platform.OS === 'web') {
        const response = await fetch(media.uri);
        const blob = await response.blob();

        // Ensure web recorded videos have extension and correct type for Laravel validation
        let finalFilename = filename;
        if (!finalFilename.includes('.')) {
          finalFilename = media.type === 'video' ? 'story.webm' : 'story.jpg';
        }

        const blobType = blob.type;
        if (media.type === 'video') {
          if (blobType.includes('webm')) {
            finalFilename = finalFilename.replace(/\.\w+$/, '.webm');
            type = 'video/webm';
          } else if (blobType.includes('mp4')) {
            finalFilename = finalFilename.replace(/\.\w+$/, '.mp4');
            type = 'video/mp4';
          }
        }

        formData.append('media', blob, finalFilename);
      } else {
        formData.append('media', {
          uri: media.uri,
          name: filename,
          type,
        } as any);
      }

      formData.append('type', media.type);

      // Process stickers with their positions and styles
      // Guard: deduplicate by ID just in case to avoid any potential UI race conditions
      const uniqueStickers = Array.from(new Map(stickers.map(s => [s.id, s])).values());
      const stickersData = uniqueStickers.map(s => ({
        ...s,
        // Normalize positions to percentages
        x: s.x / width,
        y: s.y / height,
      }));
      formData.append('stickers', JSON.stringify(stickersData));

      if (location) formData.append('location', JSON.stringify(location));

      await createStory(formData);
      onStoryCreated();
      handleClose();
    } catch (error: any) {
      console.error('Error creating story:', error);
      if (error.response?.data) {
        console.error('Validation errors:', error.response.data.errors);
        Alert.alert('Upload Error', error.response.data.message || 'Validation failed');
      } else {
        Alert.alert('Error', 'Failed to share story. Please check your connection.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setMedia(null);
    setStickers([]);
    setLocation(null);
    setTempEmoji('');
    setFeelingText('');
    setIsRecording(false);
    setSelectedSticker(null);
    setNeedsTrimming(false);
    setShowTrimmer(false);
    // Clear animation map
    stickerAnimations.clear();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const toggleFacing = () => {
    setFacing(prev => (prev === 'front' ? 'back' : 'front'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleFlash = () => {
    setFlash(prev => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!visible) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={styles.container}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

          {showTrimmer && media && (
            <VideoTrimmer
              visible={showTrimmer}
              videoUri={media.uri}
              maxDuration={MAX_VIDEO_DURATION}
              isStory={true}
              onSave={handleTrimComplete}
              onClose={() => {
                setShowTrimmer(false);
                setNeedsTrimming(false);
                setMedia(null);
              }}
            />
          )}

          {!media && !showTrimmer ? (
            // CAMERA VIEW
            <View style={styles.cameraContainer}>
              <PlatformCameraView
                cameraRef={cameraRef}
                style={styles.camera}
                facing={facing}
              >
                <SafeAreaView style={styles.cameraOverlay}>
                  <View style={styles.topControls}>
                    <TouchableOpacity onPress={handleClose} style={styles.iconButton}>
                      <Ionicons name="close" size={30} color="white" />
                    </TouchableOpacity>

                    <View style={styles.topRightControls}>
                      <TouchableOpacity onPress={toggleFlash} style={styles.iconButton}>
                        <Ionicons
                          name={flash === 'off' ? 'flash-off' : 'flash'}
                          size={24}
                          color="white"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { }} style={styles.iconButton}>
                        <Ionicons name="settings-outline" size={24} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.bottomWrapper}>
                    <View style={styles.bottomControls}>
                      <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
                        <Ionicons name="images-outline" size={28} color="white" />
                      </TouchableOpacity>

                      <View style={styles.captureContainer}>
                        <TouchableOpacity
                          onPressIn={handleLongPress}
                          onPressOut={handlePressOut}
                          style={styles.captureOuter}
                          activeOpacity={0.8}
                        >
                          <MotiView
                            animate={{
                              scale: isRecording ? 1.2 : 1,
                              backgroundColor: isRecording ? '#FF3B30' : 'white'
                            }}
                            transition={{ type: 'timing', duration: 150 }}
                            style={styles.captureInner}
                          />
                          {isRecording && (
                            <MotiView
                              from={{ opacity: 0, scale: 1 }}
                              animate={{ opacity: 1, scale: 1 }}
                              style={[
                                styles.progressRing,
                                {
                                  borderWidth: 5,
                                  borderColor: '#FF3B30',
                                  borderRadius: 40,
                                }
                              ]}
                            >
                              <View
                                style={[
                                  styles.progressFill,
                                  { width: `${recordingProgress * 100}%` }
                                ]}
                              />
                            </MotiView>
                          )}
                        </TouchableOpacity>
                        <Text style={styles.modeText}>
                          {cameraMode === 'video'
                            ? isRecording ? `Recording ${Math.floor(recordingProgress * 10)}s` : 'Hold for Video'
                            : 'Tap for Photo'}
                        </Text>
                      </View>

                      <TouchableOpacity style={styles.flipButton} onPress={toggleFacing}>
                        <Ionicons name="camera-reverse-outline" size={32} color="white" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.modeSelector}>
                      <TouchableOpacity
                        onPress={() => setCameraMode('picture')}
                        style={[styles.modeButton, cameraMode === 'picture' && styles.activeModeButton]}
                      >
                        <Text style={[styles.modeItem, cameraMode === 'picture' && styles.activeMode]}>PHOTO</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setCameraMode('video')}
                        style={[styles.modeButton, cameraMode === 'video' && styles.activeModeButton]}
                      >
                        <Text style={[styles.modeItem, cameraMode === 'video' && styles.activeMode]}>VIDEO</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </SafeAreaView>
              </PlatformCameraView>
            </View>
          ) : !showTrimmer && (
            // PREVIEW VIEW
            <View style={styles.previewContainer}>
              {media?.type === 'video' ? (
                <VideoView
                  player={videoPlayer}
                  style={styles.previewMedia}
                  contentFit="cover"
                  nativeControls
                />
              ) : (
                <Image source={{ uri: media?.uri }} style={styles.previewMedia} resizeMode="cover" />
              )}

              <SafeAreaView style={styles.previewOverlay} pointerEvents="box-none">
                <View style={styles.topControls}>
                  <TouchableOpacity onPress={() => setMedia(null)} style={styles.iconButton}>
                    <Ionicons name="chevron-back" size={30} color="white" />
                  </TouchableOpacity>

                  <View style={styles.topTools}>
                    <TouchableOpacity onPress={() => setShowTextEditor(true)} style={styles.iconButton}>
                      <MaterialIcons name="text-fields" size={24} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowLocationSearch(true)} style={styles.iconButton}>
                      <Ionicons name="location-sharp" size={22} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowEmojiPicker(true)} style={styles.iconButton}>
                      <Ionicons name="happy-outline" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* RENDER STICKERS - Use unique key that doesn't change on position update */}
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  <AnimatePresence>
                    {stickers.map((sticker) => (
                      <MotiView
                        key={sticker.id}
                        from={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ type: 'spring', damping: 15 }}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="box-none"
                      >
                        <DraggableSticker
                          sticker={sticker}
                          isSelected={selectedSticker === sticker.id}
                          stickerAnimations={stickerAnimations}
                          onSelect={setSelectedSticker}
                          onUpdatePosition={updateStickerPosition}
                          onSetStickers={setStickers}
                          onDelete={deleteSticker}
                        />
                      </MotiView>
                    ))}
                  </AnimatePresence>
                </View>


                {needsTrimming && (
                  <MotiView
                    from={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={styles.trimWarning}
                  >
                    <BlurView intensity={80} tint="dark" style={styles.trimWarningContent}>
                      <Ionicons name="alert-circle" size={20} color="#FFB340" />
                      <Text style={styles.trimWarningText}>Video longer than 10s needs trimming</Text>
                      <TouchableOpacity
                        style={styles.trimNowButton}
                        onPress={() => setShowTrimmer(true)}
                      >
                        <Text style={styles.trimNowText}>Trim Now</Text>
                      </TouchableOpacity>
                    </BlurView>
                  </MotiView>
                )}

                <View style={styles.previewBottom}>
                  <TouchableOpacity style={styles.saveDraft} onPress={handleSave}>
                    <Ionicons name="download-outline" size={24} color="white" />
                    <Text style={styles.previewBottomText}>Save</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shareButton, uploading && styles.shareButtonDisabled]}
                    onPress={handleShare}
                    disabled={uploading || needsTrimming}
                  >
                    {uploading ? (
                      <ActivityIndicator color="black" size="small" />
                    ) : (
                      <>
                        <Text style={styles.shareButtonText}>Share Story</Text>
                        <Ionicons name="chevron-forward" size={20} color="black" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </SafeAreaView>

              {/* TEXT EDITOR MODAL */}
              <Modal visible={showTextEditor} transparent animationType="fade">
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={styles.editorContainer}
                >
                  <BlurView intensity={40} style={StyleSheet.absoluteFill} />

                  <TouchableOpacity
                    style={styles.editorClose}
                    onPress={() => setShowTextEditor(false)}
                  >
                    <Ionicons name="close" size={24} color="white" />
                  </TouchableOpacity>

                  <View style={styles.editorContent}>
                    <TextInput
                      ref={textInputRef}
                      style={[
                        styles.editorInput,
                        {
                          color: currentColor,
                          fontSize: currentFontSize,
                          fontFamily: currentFont,
                        }
                      ]}
                      value={currentText}
                      onChangeText={setCurrentText}
                      placeholder="Type something..."
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      selectionColor="white"
                      multiline
                      autoFocus
                    />

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.colorPicker}
                    >
                      {COLORS.map((color) => (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.colorOption,
                            { backgroundColor: color },
                            currentColor === color && styles.colorOptionSelected
                          ]}
                          onPress={() => setCurrentColor(color)}
                        />
                      ))}
                    </ScrollView>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.fontPicker}
                    >
                      {FONTS.map((font) => (
                        <TouchableOpacity
                          key={font}
                          style={[
                            styles.fontOption,
                            currentFont === font && styles.fontOptionSelected
                          ]}
                          onPress={() => setCurrentFont(font)}
                        >
                          <Text style={[styles.fontOptionText, { fontFamily: font }]}>
                            {font}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <View style={styles.fontSizePicker}>
                      <TouchableOpacity
                        onPress={() => setCurrentFontSize(Math.max(12, currentFontSize - 4))}
                        style={styles.fontSizeButton}
                      >
                        <Ionicons name="remove-circle-outline" size={24} color="white" />
                      </TouchableOpacity>
                      <Text style={styles.fontSizeText}>{currentFontSize}px</Text>
                      <TouchableOpacity
                        onPress={() => setCurrentFontSize(Math.min(72, currentFontSize + 4))}
                        style={styles.fontSizeButton}
                      >
                        <Ionicons name="add-circle-outline" size={24} color="white" />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.editorDoneBottom,
                        !currentText.trim() && styles.editorDoneDisabled
                      ]}
                      onPress={handleAddText}
                      disabled={!currentText.trim()}
                    >
                      <Text style={styles.editorDoneText}>Add Text</Text>
                    </TouchableOpacity>
                  </View>
                </KeyboardAvoidingView>
              </Modal>

              {/* EMOJI PICKER */}
              <EmojiPicker
                open={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onEmojiSelected={handleEmojiSelect}
                theme={{
                  backdrop: 'rgba(0,0,0,0.8)',
                  knob: '#0084ff',
                  container: '#1a1a1a',
                  header: '#ffffff',
                  skinTonesContainer: '#252525',
                  category: {
                    icon: '#0084ff',
                    iconActive: '#ffffff',
                    container: '#252525',
                    containerActive: '#0084ff',
                  },
                  search: {
                    background: '#252525',
                    text: '#ffffff',
                    placeholder: '#888888',
                    icon: '#888888',
                  },
                }}
              />

              {/* FEELING TEXT INPUT MODAL */}
              <Modal visible={showFeelingInput} transparent animationType="slide">
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={styles.feelingInputContainer}
                >
                  <BlurView intensity={90} tint="dark" style={styles.feelingInputContent}>
                    <Text style={styles.feelingInputTitle}>How are you feeling?</Text>
                    <View style={styles.feelingInputRow}>
                      <Text style={styles.feelingEmojiPreview}>{tempEmoji}</Text>
                      <TextInput
                        style={styles.feelingTextInput}
                        placeholder="e.g. happy, thinking, eating..."
                        placeholderTextColor="#666"
                        value={feelingText}
                        onChangeText={setFeelingText}
                        autoFocus
                        onSubmitEditing={handleFinishFeeling}
                        maxLength={20}
                      />
                    </View>
                    <View style={styles.feelingInputButtons}>
                      <TouchableOpacity
                        style={styles.feelingCancelButton}
                        onPress={() => {
                          setShowFeelingInput(false);
                          setFeelingText('');
                        }}
                      >
                        <Text style={styles.feelingCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.feelingDoneButton}
                        onPress={handleFinishFeeling}
                      >
                        <Text style={styles.feelingDoneText}>Add Feeling</Text>
                      </TouchableOpacity>
                    </View>
                  </BlurView>
                </KeyboardAvoidingView>
              </Modal>

              {/* SHARE LOCATION NEW COMPONENT */}
              <ShareLocation
                visible={showLocationSearch}
                onClose={() => setShowLocationSearch(false)}
                onShareLocation={handleLocationSelect}
              />
            </View>
          )}
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    width: Platform.OS === 'web' ? '100%' : undefined,
    height: Platform.OS === 'web' ? '100%' : undefined,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    padding: 20,
    position: Platform.OS === 'web' ? 'absolute' : 'relative',
    top: 0,
    left: 0,
  },
  previewContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewMedia: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    width: '100%',
    height: '100%',
    position: Platform.OS === 'web' ? 'absolute' : 'relative',
    top: 0,
    left: 0,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 30 : 0,
  },
  topRightControls: {
    flexDirection: 'row',
    gap: 10,
  },
  topTools: {
    flexDirection: 'row',
    gap: 15,
  },
  bottomWrapper: {
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 30,
  },
  iconButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captureContainer: {
    alignItems: 'center',
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  captureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'white',
  },
  progressRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: {
    position: 'absolute',
    top: -5,
    left: -5,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
    width: '0%',
  },
  modeText: {
    color: 'white',
    marginTop: 10,
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginBottom: 40, // More space
  },
  modeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeModeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modeItem: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeMode: {
    color: 'white',
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 80, // Moved up to reveal video controls
  },
  saveDraft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  previewBottomText: {
    color: 'white',
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 5,
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  shareButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sticker: {
    position: 'absolute',
    padding: 10,
    minWidth: 50,
  },
  stickerText: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  stickerControls: {
    position: 'absolute',
    top: -30,
    right: 0,
    flexDirection: 'row',
    gap: 5,
  },
  stickerControl: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerDelete: {
    backgroundColor: '#FF3B30',
  },
  locationStickerContainer: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
  },
  locationSticker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    overflow: 'hidden',
  },
  locationStickerText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  trimWarning: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  trimWarningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 10,
    overflow: 'hidden',
  },
  trimWarningText: {
    color: 'white',
    fontSize: 14,
  },
  trimNowButton: {
    backgroundColor: '#FFB340',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  trimNowText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 12,
  },
  editorContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  editorClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
    zIndex: 10,
  },
  editorContent: {
    width: '100%',
    alignItems: 'center',
  },
  editorInput: {
    color: 'white',
    fontSize: 40,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
    marginBottom: 30,
    maxHeight: 200,
  },
  colorPicker: {
    flexGrow: 0,
    marginBottom: 20,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: 'white',
    transform: [{ scale: 1.1 }],
  },
  fontPicker: {
    flexGrow: 0,
    marginBottom: 20,
  },
  fontOption: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  fontOptionSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  fontOptionText: {
    color: 'white',
    fontSize: 14,
  },
  fontSizePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 30,
  },
  fontSizeButton: {
    padding: 5,
  },
  fontSizeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editorDoneBottom: {
    backgroundColor: 'white',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  editorDoneDisabled: {
    opacity: 0.5,
  },
  editorDoneText: {
    color: 'black',
    fontWeight: 'bold',
  },
  locationSearchContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  locationSearchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  locationSearchClose: {
    padding: 5,
  },
  locationSearchTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  locationSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    gap: 10,
  },
  locationSearchField: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    padding: 0,
  },
  locationSearchLoading: {
    marginTop: 20,
  },
  locationResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  locationResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,132,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  locationResultInfo: {
    flex: 1,
  },
  locationResultName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationResultAddress: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  locationEmpty: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 50,
  },
  stickerContent: {
    alignItems: 'center',
    gap: 10,
  },
  integratedLocationSticker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 6,
    overflow: 'hidden',
  },
  integratedLocationStickerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  integratedFeelingSticker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 6,
    overflow: 'hidden',
  },
  integratedFeelingEmoji: {
    fontSize: 16,
  },
  integratedFeelingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'lowercase',
  },
  feelingInputContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  feelingInputContent: {
    padding: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    alignItems: 'center',
  },
  feelingInputTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 25,
  },
  feelingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    width: '100%',
    gap: 15,
    marginBottom: 30,
  },
  feelingEmojiPreview: {
    fontSize: 40,
  },
  feelingTextInput: {
    flex: 1,
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  feelingInputButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
  },
  feelingCancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  feelingCancelText: {
    color: 'white',
    fontWeight: '600',
  },
  feelingDoneButton: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: 15,
    backgroundColor: '#0084ff',
    alignItems: 'center',
  },
  feelingDoneText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

// Draggable Sticker Component defined outside to prevent re-mounting during parent renders
const DraggableSticker = ({
  sticker,
  isSelected,
  stickerAnimations,
  onSelect,
  onUpdatePosition,
  onSetStickers,
  onDelete,
}: {
  sticker: Sticker;
  isSelected: boolean;
  stickerAnimations: Map<string, any>;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onSetStickers: React.Dispatch<React.SetStateAction<Sticker[]>>;
  onDelete: (id: string) => void;
}) => {
  // Create shared values that persist for the lifetime of this component
  const translateX = useSharedValue(sticker.x);
  const translateY = useSharedValue(sticker.y);
  const scale = useSharedValue(sticker.scale || 1);
  const rotation = useSharedValue(sticker.rotation || 0);

  // Update shared values when sticker props change
  useEffect(() => {
    translateX.value = sticker.x;
    translateY.value = sticker.y;
    scale.value = sticker.scale || 1;
    rotation.value = sticker.rotation || 0;
  }, [sticker.x, sticker.y, sticker.scale, sticker.rotation]);

  // Register animation values in map (only once)
  useEffect(() => {
    if (!stickerAnimations.has(sticker.id)) {
      stickerAnimations.set(sticker.id, { translateX, translateY, scale, rotation });
    }

    return () => {
      // Cleanup on unmount
      stickerAnimations.delete(sticker.id);
    };
  }, []); // Empty dependency array - only run once on mount

  const panGesture = Gesture.Pan()
    .onStart(() => {
      runOnJS(onSelect)(sticker.id);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((event) => {
      translateX.value = sticker.x + event.translationX;
      translateY.value = sticker.y + event.translationY;
    })
    .onEnd((event) => {
      const finalX = sticker.x + event.translationX;
      const finalY = sticker.y + event.translationY;
      runOnJS(onUpdatePosition)(sticker.id, finalX, finalY);
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = (sticker.scale || 1) * event.scale;
    })
    .onEnd(() => {
      runOnJS(onSetStickers)(prev => prev.map(s =>
        s.id === sticker.id ? { ...s, scale: scale.value } : s
      ));
    });

  const rotateGesture = Gesture.Rotation()
    .onUpdate((event) => {
      rotation.value = (sticker.rotation || 0) + event.rotation;
    })
    .onEnd(() => {
      runOnJS(onSetStickers)(prev => prev.map(s =>
        s.id === sticker.id ? { ...s, rotation: rotation.value } : s
      ));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(onDelete)(sticker.id);
    });

  const composed = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    rotateGesture,
    doubleTap
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.sticker, animatedStyle]}>
        <View style={styles.stickerContent}>
          {sticker.text !== '' && (
            <Text
              style={[
                styles.stickerText,
                {
                  color: sticker.color,
                  fontSize: sticker.fontSize,
                  fontFamily: sticker.fontFamily,
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
        {isSelected && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.stickerControls}
          >
            <TouchableOpacity
              style={[styles.stickerControl, styles.stickerDelete]}
              onPress={() => onDelete(sticker.id)}
            >
              <Ionicons name="close" size={16} color="white" />
            </TouchableOpacity>
          </MotiView>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

export default AddStory;