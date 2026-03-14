// components/CreatePost.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  Dimensions,
  StatusBar,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import PlatformCameraView from '@/components/PlatformCameraView';
import * as ImagePicker from 'expo-image-picker';
import { createPost, updatePost } from '@/services/PostService';
import { useLocalSearchParams, router } from 'expo-router';
import getApiBaseImage from '@/services/getApiBaseImage';
import { deletePostMedia, fetchPosts } from '@/services/PostService';
import { usePostStore } from '@/stores/postStore';
import { MediaCompressor } from '@/utils/mediaCompressor';
import VideoTrimmer from './Shared/VideoTrimmer';
import { Post } from '@/services/PostListService';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const { width, height } = Dimensions.get('window');
const RECORDING_LIMIT_MS = 120000; // 120 seconds

interface CreatePostProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated?: (post: Post) => void;
  initialParams?: {
    postId?: string | null;
    caption?: string;
    media?: string;
  };
}

export default function CreatePost({ visible, onClose, onPostCreated, initialParams }: CreatePostProps) {
  const params = initialParams || useLocalSearchParams();
  const isEditing = !!(params.postId && params.postId !== 'null');

  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [zoom, setZoom] = useState(0);

  // Location state
  const [location, setLocation] = useState<{ name: string; lat: number; lng: number; id?: string } | null>(null);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);

  // Use the new platform camera ref
  const cameraRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const longPressTimeout = useRef<any>(null);

  const [deleteStatus, setDeleteStatus] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });
  const [trimmerVisible, setTrimmerVisible] = useState(false);
  const [videoToTrimIndex, setVideoToTrimIndex] = useState<number | null>(null);
  const [longVideosDetected, setLongVideosDetected] = useState<boolean>(false);

  const postStore = usePostStore();
  const isInitialized = useRef(false);

  // Initialize with edit data if available
  useEffect(() => {
    if (visible && !isInitialized.current) {
      isInitialized.current = true;
      if (isEditing) {
        setCaption((params.caption as string) || '');

        try {
          const parsedMedia = params.media ? JSON.parse(params.media as string) : [];
          setMedia(Array.isArray(parsedMedia) ? parsedMedia : []);
        } catch (e) {
          console.error('Error parsing media:', e);
          setMedia([]);
        }

        // Parse location if available in edit mode
        try {
          if (params.location) {
            const parsedLocation = JSON.parse(params.location as string);
            setLocation(parsedLocation);
          }
        } catch (e) {
          console.error('Error parsing location:', e);
        }
      } else {
        // New post: check if we have initial caption (e.g., sharing a poll)
        setCaption((params.caption as string) || '');
        setMedia([]);
        setLocation(null);
      }
    } else if (!visible) {
      // Reset when closed
      isInitialized.current = false;
      setCaption('');
      setMedia([]);
      setLocation(null);
      setLongVideosDetected(false);
    }
  }, [visible, isEditing, params.caption, params.media, params.location]);

  // Check for long videos whenever media changes
  useEffect(() => {
    const hasLongVideo = media.some(item =>
      item.type === 'video' &&
      item.duration &&
      item.duration > 120000 &&
      !item.startTime
    );
    setLongVideosDetected(hasLongVideo);
  }, [media]);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (longPressTimeout.current) {
        clearTimeout(longPressTimeout.current);
      }
    };
  }, []);

  const searchLocations = async (query: string) => {
    if (!query.trim()) {
      setLocationResults([]);
      return;
    }

    setSearchingLocation(true);
    try {
      // Use OpenStreetMap Nominatim for free location search
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      setLocationResults(data);
    } catch (error) {
      console.error('Location search error:', error);
    } finally {
      setSearchingLocation(false);
    }
  };

  const selectLocation = (item: any) => {
    const locData = {
      name: item.display_name.split(',')[0],
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      id: item.place_id,
    };
    setLocation(locData);
    setShowLocationSearch(false);
    setLocationSearch('');
    setLocationResults([]);
  };

  const removeLocation = () => {
    setLocation(null);
  };

  const pickMedia = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.7, // Reduced quality for compression
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });

    if (!result.canceled) {
      // Process each asset
      const processedAssets = [];
      let hasLongVideo = false;

      for (const asset of result.assets) {
        if (asset.type === 'video' && asset.duration && asset.duration > 120000) {
          console.log('Long video detected (ms):', asset.duration);
          hasLongVideo = true;

          // For long videos, we'll add them without compression first
          // They will be sent to trimmer
          processedAssets.push({
            ...asset,
            uri: asset.uri,
            type: asset.type,
            needsTrimming: true,
          });

          // If this is the first long video and we have multiple, show warning
          if (hasLongVideo && result.assets.length > 1) {
            Alert.alert(
              'Long Video Detected',
              'Only the first long video will be trimmed. Other media will be uploaded as is.',
              [{ text: 'OK' }]
            );
          }
        } else {
          // Compress normal media
          try {
            const compressed = await MediaCompressor.prepareMediaForUpload(
              asset.uri,
              asset.fileName || undefined
            );
            processedAssets.push({
              ...asset,
              uri: compressed.uri,
              type: asset.type || MediaCompressor.getMediaTypeFromUri(asset.uri),
            });
          } catch (error) {
            console.error('Failed to compress media:', error);
            processedAssets.push(asset);
          }
        }
      }

      if (processedAssets.length > 0) {
        setMedia([...media, ...processedAssets]);

        // Check if we need to auto-trim the first long video
        const firstLongVideoIndex = processedAssets.findIndex(
          item => item.type === 'video' && item.duration > 120000
        );

        if (firstLongVideoIndex !== -1) {
          // Calculate the actual index in the combined array
          const actualIndex = media.length + firstLongVideoIndex;

          // Auto-open trimmer for the first long video
          setTimeout(() => {
            setVideoToTrimIndex(actualIndex);
            setTrimmerVisible(true);
          }, 500);
        }
      }
    }
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });

        // Add to media
        const processedPhoto = {
          uri: photo.uri,
          type: 'image',
          fileName: `photo-${Date.now()}.jpg`,
        };

        setMedia(prev => [...prev, processedPhoto]);
        setCameraVisible(false);
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Error', 'Failed to capture photo');
      }
    }
  };

  const startRecording = async () => {
    if (cameraRef.current && !isRecording) {
      try {
        setIsRecording(true);
        setRecordingProgress(0);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Start progress timer
        const startTime = Date.now();
        timerRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = elapsed / RECORDING_LIMIT_MS;

          if (progress >= 1) {
            stopRecording();
          } else {
            setRecordingProgress(progress);
          }
        }, 50);

        const video = await cameraRef.current.recordAsync({
          maxDuration: 120,
          quality: '1080p',
        });

        if (video) {
          // Process video
          const videoAsset = {
            uri: video.uri,
            type: 'video',
            fileName: `video-${Date.now()}.mp4`,
            duration: recordingProgress * RECORDING_LIMIT_MS
          };

          setMedia(prev => [...prev, videoAsset]);
          setCameraVisible(false);
        }
      } catch (error) {
        console.error('Error starting recording:', error);
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
  };

  const stopRecording = async () => {
    if (cameraRef.current && isRecording) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsRecording(false);
        setRecordingProgress(0);
        if (timerRef.current) clearInterval(timerRef.current);

        await cameraRef.current.stopRecording();
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }
  };

  const handleLongPress = () => {
    if (cameraMode === 'picture') {
      setCameraMode('video');
    }
    longPressTimeout.current = setTimeout(() => {
      startRecording();
    }, 200);
  };

  const handlePressOut = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }

    if (isRecording) {
      stopRecording();
    } else {
      // If it was just a tap
      if (cameraMode === 'picture') {
        takePhoto();
      }
    }
  };

  const toggleFacing = () => {
    setCameraType(prev => (prev === 'back' ? 'front' : 'back'));
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

  const handleTrim = (index: number) => {
    setVideoToTrimIndex(index);
    setTrimmerVisible(true);
  };

  const onTrimSave = async (trimmedData: { uri: string; startTime: number; endTime: number; duration: number }) => {
    if (videoToTrimIndex === null) return;

    setIsUploading(true); // Show loader while processing
    try {
      const currentAsset = media[videoToTrimIndex];

      // Compress the trimmed video
      const compressed = await MediaCompressor.prepareMediaForUpload(
        trimmedData.uri,
        currentAsset.fileName || `video-${Date.now()}.mp4`
      );

      // Update the asset with trim data and compressed URI
      const newMedia = [...media];
      newMedia[videoToTrimIndex] = {
        ...currentAsset,
        uri: compressed.uri,
        startTime: trimmedData.startTime,
        endTime: trimmedData.endTime,
        duration: trimmedData.duration * 1000, // convert back to ms for consistency
        needsTrimming: false,
      };

      setMedia(newMedia);
      setTrimmerVisible(false);
      setVideoToTrimIndex(null);
    } catch (err) {
      console.error('Trim save error:', err);
      Alert.alert('Error', 'Failed to save trimmed video');
    } finally {
      setIsUploading(false);
    }
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7, // Reduced quality for compression
          skipProcessing: false,
        });

        // Compress photo before adding to media
        try {
          const compressed = await MediaCompressor.prepareMediaForUpload(
            photo.uri,
            `photo-${Date.now()}.jpg`
          );

          setMedia([...media, {
            uri: compressed.uri,
            type: 'image',
            fileName: compressed.fileName
          }]);
        } catch (compressError) {
          console.error('Failed to compress photo:', compressError);
          // Add uncompressed photo if compression fails
          setMedia([...media, {
            uri: photo.uri,
            type: 'image',
            fileName: `photo-${Date.now()}.jpg`
          }]);
        }

        setCameraVisible(false);
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Error', 'Failed to capture photo. Please try again.');
      }
    }
  };

  const handleCameraCapture = (uri: string) => {
    setMedia([...media, { uri, type: 'image', fileName: `photo-${Date.now()}.jpg` }]);
    setCameraVisible(false);
  };

  const removeMedia = async (index: number) => {
    const item = media[index];

    // If this is existing media (has an ID)
    if (item.id && isEditing) {
      try {
        await deletePostMedia(Number(params.postId), item.id);

        // Show success message
        setDeleteStatus({ visible: true, message: 'Media deleted successfully' });

        // Hide after 3 seconds
        setTimeout(() => setDeleteStatus({ visible: false, message: '' }), 3000);

        // Remove from local state
        const newMedia = [...media];
        newMedia.splice(index, 1);
        setMedia(newMedia);

      } catch (error) {
        Alert.alert('Error', 'Failed to delete media');
        console.error('Media deletion error:', error);
      }
    } else {
      // For new uploads, just remove from array
      const newMedia = [...media];
      newMedia.splice(index, 1);
      setMedia(newMedia);
    }
  };

  const handleSubmit = async () => {
    if (!caption.trim() && media.length === 0) {
      Alert.alert('Error', 'Please add a caption or media');
      return;
    }

    // Check if there are still untrimmed long videos
    const untrimmedLongVideos = media.filter(
      item => item.type === 'video' && item.duration > 120000 && !item.startTime
    );

    if (untrimmedLongVideos.length > 0) {
      Alert.alert(
        'Long Videos Detected',
        'Please trim videos longer than 2 minutes before posting.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption);

      // Add location if selected
      if (location) {
        formData.append('location', JSON.stringify(location));
      }

      if (isEditing) {
        formData.append('_method', 'PUT');
        media.forEach(item => {
          if (item._deleted && item.id) {
            formData.append('delete_media[]', item.id.toString());
          }
        });
      }

      // Filter for new media to upload
      const newMediaToUpload = media.filter(item => !item.id && !item._deleted);

      for (let i = 0; i < newMediaToUpload.length; i++) {
        const item = newMediaToUpload[i];
        const fileData = {
          uri: item.uri,
          type: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
          name: item.fileName || `media-${Date.now()}.${item.type === 'video' ? 'mp4' : 'jpg'}`,
        } as any;

        if (Platform.OS === 'web') {
          // Web: Convert to File object
          const response = await fetch(item.uri);
          const blob = await response.blob();
          const file = new File([blob], fileData.name, { type: fileData.type });
          formData.append('media[]', file);
        } else {
          formData.append('media[]', fileData);
        }

        // Add trim metadata for this specific new media
        if (item.startTime !== undefined) {
          formData.append('trim_start[]', item.startTime.toString());
          formData.append('trim_end[]', item.endTime.toString());
        } else {
          formData.append('trim_start[]', '0');
          formData.append('trim_end[]', '0');
        }
      }

      const post = isEditing && params.postId
        ? await updatePost(Number(params.postId), formData)
        : await createPost(formData);

      if (isEditing && params.postId) {
        postStore.updatePost(post);
      } else {
        console.log("arrived at create of PostStore")
        postStore.addPost(post);
      }

      if (onPostCreated) {
        onPostCreated(post);
      }

      handleClose();
    } catch (error: any) {
      console.error('Error creating/updating post:', error);
      console.error('Error details:', error.response?.data || error.message);
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'create'} post: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setCaption('');
    setMedia([]);
    setLocation(null);
    setLongVideosDetected(false);
    router.setParams({
      postId: null,
      caption: '',
      media: null,
      location: null
    });
    setCameraVisible(false);
    onClose(); // Call the original onClose prop
  };

  const renderCameraView = () => (
    <View style={styles.cameraContainer}>
      <PlatformCameraView
        cameraRef={cameraRef}
        style={styles.camera}
        facing={cameraType}
        flash={flash}
        zoom={zoom}
      >
        <SafeAreaView style={styles.cameraOverlay}>
          <StatusBar barStyle="light-content" />
          <View style={styles.topControls}>
            <TouchableOpacity onPress={() => setCameraVisible(false)} style={styles.iconButton}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>

            <View style={styles.topRightControls}>
              <TouchableOpacity onPress={toggleFlash} style={styles.iconButton}>
                <Ionicons
                  name={flash === 'off' ? 'flash-off' : flash === 'on' ? 'flash' : 'flash-outline'}
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomWrapper}>
            <View style={styles.bottomControls}>
              <TouchableOpacity style={styles.galleryButton} onPress={pickMedia}>
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
                    ? isRecording ? `Recording ${Math.floor(recordingProgress * RECORDING_LIMIT_MS / 1000)}s` : 'Hold for Video'
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
  );


  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      {cameraVisible ? (
        renderCameraView()
      ) : (
        <View style={styles.container}>
            {/* Status message */}
            {deleteStatus.visible && (
              <View style={styles.deleteStatus}>
                <Text style={styles.deleteStatusText}>{deleteStatus.message}</Text>
              </View>
            )}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
              <Text style={styles.title}>{isEditing ? 'Edit Post' : 'New Post'}</Text>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isUploading || (longVideosDetected && !isEditing)}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#1DA1F2" />
                ) : (
                  <Text style={[
                    styles.postButton,
                    (longVideosDetected && !isEditing) && styles.postButtonDisabled
                  ]}>
                    {isEditing ? 'Update' : 'Post'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              <TextInput
                style={styles.captionInput}
                placeholder="What's happening?"
            placeholderTextColor="#657786"
            multiline
            value={caption}
            onChangeText={setCaption}
          />

          {/* Location Picker */}
          <View style={styles.locationContainer}>
            {location ? (
              <View style={styles.locationTag}>
                <BlurView intensity={80} tint="light" style={styles.locationTagContent}>
                  <Ionicons name="location" size={16} color="#1DA1F2" />
                  <Text style={styles.locationTagText}>{location.name}</Text>
                  <TouchableOpacity onPress={removeLocation} style={styles.removeLocationButton}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                </BlurView>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addLocationButton}
                onPress={() => setShowLocationSearch(true)}
              >
                <Ionicons name="location-outline" size={20} color="#1DA1F2" />
                <Text style={styles.addLocationText}>Add location</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Long Video Warning */}
          {longVideosDetected && !isEditing && (
            <View style={styles.warningContainer}>
              <Ionicons name="alert-circle" size={20} color="#FF9500" />
              <Text style={styles.warningText}>
                Videos longer than 2 minutes need to be trimmed before posting
              </Text>
            </View>
          )}

          {media.length > 0 && (
            <View style={styles.mediaContainer}>
              {media.map((item, index) => (
                <View key={index} style={styles.mediaItem}>
                  {item.type === 'video' ? (
                    <View style={styles.videoThumbnail}>
                      <Ionicons name="videocam" size={40} color="#fff" />
                      {item.duration && (
                        <View style={styles.durationContainer}>
                          <Text style={styles.durationLabel}>
                            {item.startTime !== undefined
                              ? `${Math.floor((item.endTime - item.startTime) / 60)}:${Math.floor((item.endTime - item.startTime) % 60).toString().padStart(2, '0')}`
                              : `${Math.floor(item.duration / 60000)}:${Math.floor((item.duration % 60000) / 1000).toString().padStart(2, '0')}`}
                          </Text>
                          {item.startTime !== undefined && (
                            <View style={styles.trimmedBadgeTiny}>
                              <Text style={styles.trimmedTextTiny}>Trimmed</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {item.duration && item.duration > 120000 && !item.startTime && (
                        <TouchableOpacity
                          style={styles.trimOverlay}
                          onPress={() => handleTrim(index)}
                        >
                          <View style={styles.trimBadge}>
                            <Ionicons name="cut" size={16} color="#fff" />
                            <Text style={styles.trimText}>Cut to 2m</Text>
                          </View>
                        </TouchableOpacity>
                      )}

                      {item.startTime !== undefined && (
                        <TouchableOpacity
                          style={styles.trimOverlayActive}
                          onPress={() => handleTrim(index)}
                        >
                          <View style={styles.trimBadgeActive}>
                            <Ionicons name="checkmark-circle" size={16} color="#fff" />
                            <Text style={styles.trimText}>Trimmed</Text>
                          </View>
                        </TouchableOpacity>
                      )}

                      {(!item.duration || item.duration <= 120000) && item.startTime === undefined && (
                        <TouchableOpacity
                          style={styles.miniTrimButton}
                          onPress={() => handleTrim(index)}
                        >
                          <Ionicons name="cut" size={14} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <Image
                      source={{ uri: item.file_path ? `${getApiBaseImage()}/storage/${item.file_path}` : item.uri }}
                      style={styles.mediaPreview}
                      resizeMode="cover"
                    />
                  )}
                  <TouchableOpacity
                    style={styles.removeMediaButton}
                    onPress={() => removeMedia(index)}
                  >
                    <Ionicons name="trash" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.mediaButtons}>
            <TouchableOpacity
              style={styles.mediaButton}
              onPress={pickMedia}
            >
              <Ionicons name="image" size={24} color="#1DA1F2" />
              <Text style={styles.mediaButtonText}>Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mediaButton}
              onPress={() => setCameraVisible(true)}
            >
              <Ionicons name="camera" size={24} color="#1DA1F2" />
              <Text style={styles.mediaButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    )}

        {videoToTrimIndex !== null && (
          <VideoTrimmer
            visible={trimmerVisible}
            videoUri={media[videoToTrimIndex].uri}
            onClose={() => {
              setTrimmerVisible(false);
              setVideoToTrimIndex(null);
            }}
            onSave={onTrimSave}
          />
        )}

        {/* Location Search Modal */}
        <Modal visible={showLocationSearch} transparent animationType="fade">
          <BlurView intensity={40} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.locationSearchContainer}>
            <View style={styles.locationSearchHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowLocationSearch(false);
                  setLocationSearch('');
                  setLocationResults([]);
                }}
                style={styles.locationSearchClose}
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.locationSearchTitle}>Add Location</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.locationSearchInput}>
              <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.locationSearchField}
                placeholder="Search for a place..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={locationSearch}
                onChangeText={(text) => {
                  setLocationSearch(text);
                  searchLocations(text);
                }}
                autoFocus
              />
            </View>

            {searchingLocation && (
              <ActivityIndicator style={styles.locationSearchLoading} color="white" />
            )}

            <FlatList
              data={locationResults}
              keyExtractor={(item) => item.place_id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.locationResult}
                  onPress={() => selectLocation(item)}
                >
                  <View style={styles.locationResultIcon}>
                    <Ionicons name="location" size={20} color="#0084ff" />
                  </View>
                  <View style={styles.locationResultInfo}>
                    <Text style={styles.locationResultName}>
                      {item.display_name.split(',')[0]}
                    </Text>
                    <Text style={styles.locationResultAddress} numberOfLines={1}>
                      {item.display_name.split(',').slice(1).join(',').trim()}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                locationSearch.trim() !== '' && !searchingLocation ? (
                  <Text style={styles.locationEmpty}>No locations found</Text>
                ) : null
              }
            />
          </SafeAreaView>
        </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 500,
    width: "100%",
    alignSelf: 'center',
    top: 60,
  },
  cameraContainer: {
    flex: 1,
    zIndex: 9999,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cameraButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  captureButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  cameraButton: {
    padding: 10,
  },
  videoButton: {
    padding: 15,
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    borderRadius: 35,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  recordingButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  stopRecordingButton: {
    width: 30,
    height: 30,
    backgroundColor: 'red',
    borderRadius: 5,
  },
  recordingTimer: {
    position: 'absolute',
    top: -40,
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  recordingTimerText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  permissionButton: {
    backgroundColor: '#1DA1F2',
    padding: 12,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  postButton: {
    color: '#1DA1F2',
    fontWeight: 'bold',
    fontSize: 16,
  },
  postButtonDisabled: {
    color: '#999',
  },
  content: {
    padding: 16,
    paddingBottom: 80,
  },
  captionInput: {
    fontSize: 18,
    color: 'black',
    minHeight: 100,
  },
  locationContainer: {
    marginVertical: 10,
  },
  addLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  addLocationText: {
    color: '#1DA1F2',
    marginLeft: 5,
    fontSize: 14,
  },
  locationTag: {
    alignSelf: 'flex-start',
  },
  locationTagContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  locationTagText: {
    color: '#1DA1F2',
    marginLeft: 4,
    marginRight: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  removeLocationButton: {
    marginLeft: 4,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
  },
  warningText: {
    color: '#FF9500',
    flex: 1,
    fontSize: 12,
  },
  mediaContainer: {
    marginTop: 16,
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mediaItem: {
    position: 'relative',
    width: '48%',
    marginBottom: 8,
  },
  mediaPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
  },
  videoThumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: {
    color: 'white',
    marginTop: 8,
    fontWeight: 'bold',
  },
  durationContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationLabel: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: 'white',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  trimmedBadgeTiny: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trimmedTextTiny: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
  },
  trimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trimOverlayActive: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trimBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  trimBadgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  trimText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  miniTrimButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 6,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,0,0,0.7)',
    borderRadius: 15,
    padding: 6,
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  mediaButton: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
    width: '45%',
  },
  mediaButtonText: {
    color: '#1DA1F2',
    marginTop: 5,
  },
  deleteStatus: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    zIndex: 100,
    alignItems: 'center'
  },
  deleteStatusText: {
    color: 'white',
    fontWeight: 'bold'
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
  iconButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  },
  progressFill: {
    position: 'absolute',
    top: -5,
    left: -5,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
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
    marginBottom: 40,
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
});