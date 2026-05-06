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
  FlatList,
  useColorScheme
} from 'react-native';
import { useTranslation } from '@/constants/i18n';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';
import PlatformCameraView from '@/components/PlatformCameraView';
import { createShadow, createTextShadow } from '@/utils/styles';
import { fetchPostById, updatePost, createPost } from '@/services/PostService';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, router } from 'expo-router';
import getApiBaseImage from '@/services/getApiBaseImage';
import { deletePostMedia, fetchPosts } from '@/services/PostService';
import { usePostStore } from '@/stores/postStore';
import { useToastStore } from '@/stores/toastStore';
import { useModeration } from '@/hooks/useModeration';
import { MediaCompressor } from '@/utils/mediaCompressor';
import VideoTrimmer from './Shared/VideoTrimmer';
import { Post } from '@/services/PostListService';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import ShareLocation from '@/components/ChatScreen/ShareLocation';

interface LocationData {
  name: string;
  latitude: number;
  longitude: number;
  id?: string;
  address?: string;
}

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
    location?: string;
  };
}

export default function CreatePost({ visible, onClose, onPostCreated, initialParams }: CreatePostProps) {
  const { t } = useTranslation();
  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, activeScheme);
  const insets = useSafeAreaInsets();
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
  const [location, setLocation] = useState<LocationData | null>(null);
  const [showLocationSearch, setShowLocationSearch] = useState(false);

  // Use the new platform camera ref
  const cameraRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const longPressTimeout = useRef<any>(null);

  const { showToast } = useToastStore();
  const [trimmerVisible, setTrimmerVisible] = useState(false);
  const [videoToTrimIndex, setVideoToTrimIndex] = useState<number | null>(null);
  const [longVideosDetected, setLongVideosDetected] = useState<boolean>(false);

  const postStore = usePostStore();
  const { analysis, isChecking, factScore, maliciousScore, moralityScore, isSafe } = useModeration(caption, 'post');
  const isInitialized = useRef(false);

  // Initialize with edit data and hydrate from server
  useEffect(() => {
    const initializeData = async () => {
      if (visible && !isInitialized.current) {
        isInitialized.current = true;

        // Prioritize props over router params for live store sync
        const activePostId = params.postId || initialParams?.postId;
        const activeCaption = params.caption || initialParams?.caption;
        const activeMedia = params.media || initialParams?.media;
        const activeLocation = (params as any).location || initialParams?.location;

        const isActualEditing = !!(activePostId && activePostId !== 'null');

        if (isActualEditing) {
          console.log('🔄 Editor: Initializing edit for post', activePostId);

          // 1. Initial sync from provided data
          setCaption(activeCaption && activeCaption !== 'null' ? String(activeCaption) : '');
          try {
            if (activeMedia) {
              const parsedMedia = typeof activeMedia === 'string' ? JSON.parse(activeMedia) : activeMedia;
              setMedia(Array.isArray(parsedMedia) ? parsedMedia : []);
            }
          } catch (e) { console.error('Error parsing initial media:', e); }

          try {
            if (activeLocation) {
              const parsedLoc = typeof activeLocation === 'string' ? JSON.parse(activeLocation) : activeLocation;
              setLocation(parsedLoc);
            }
          } catch (e) { console.error('Error parsing initial location:', e); }

          // 2. Fetch ground truth from server/store
          try {
            const numericId = Number(activePostId);
            if (!isNaN(numericId) && numericId > 0) {
              const fullPost = await postStore.hydratePost(numericId);
              if (fullPost) {
                setCaption(fullPost.caption && fullPost.caption !== 'null' ? String(fullPost.caption) : '');
                
                // Hydrate media with thumbnails for videos
                const hydratedMedia = await Promise.all((fullPost.media || []).map(async (item: any) => {
                  if (item.type === 'video' && !item.thumbnailUri) {
                    const videoUrl = `${getApiBaseImage()}/storage/${item.file_path}`;
                    const thumbnailUri = await generateVideoThumbnail(videoUrl);
                    return { ...item, thumbnailUri };
                  }
                  return item;
                }));
                
                setMedia(hydratedMedia);
                if (fullPost.location) {
                  const loc = typeof fullPost.location === 'string' ? JSON.parse(fullPost.location) : fullPost.location;
                  setLocation(loc);
                }
              }
            }
          } catch (error) {
            console.error('Failed to hydrate post in editor:', error);
          }
        } else {
          // New post reset
          setCaption(activeCaption && activeCaption !== 'null' ? String(activeCaption) : '');
          setMedia([]);
          setLocation(null);
        }
      }
    };

    initializeData();

    if (!visible) {
      // Reset when closed
      isInitialized.current = false;
      setCaption('');
      setMedia([]);
      setLocation(null);
      setLongVideosDetected(false);
      // Clean router params to prevent stale data on next open
      router.setParams({ postId: null, caption: null, media: null, location: null });
    }
  }, [visible, isEditing, params.postId, initialParams?.postId]);

  // Check for long videos whenever media changes
  useEffect(() => {
    const untrimmedLongVideos = media.filter(item =>
      item.type === 'video' &&
      item.duration &&
      item.duration > 120000 &&
      !item.startTime
    );
    setLongVideosDetected(untrimmedLongVideos.length > 0);
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

  const handleLocationSelect = (locData: any) => {
    const mappedLoc: LocationData = {
      name: locData.name || 'Selected Location',
      latitude: locData.latitude,
      longitude: locData.longitude,
      address: locData.address,
    };
    setLocation(mappedLoc);
    setShowLocationSearch(false);
  };

  const removeLocation = () => {
    setLocation(null);
  };

  const getVideoDuration = (uri: string): Promise<number> => {
    return new Promise((resolve) => {
      if (Platform.OS !== 'web') {
        // Native duration is usually provided by picker, fallback to 0
        resolve(0);
        return;
      }
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve(video.duration * 1000); // convert to ms
      };
      video.onerror = () => resolve(0);
      video.src = uri;
    });
  };

  const generateVideoThumbnail = (uri: string): Promise<string | null> => {
    return new Promise(async (resolve) => {
      if (Platform.OS !== 'web') {
        resolve(null);
        return;
      }

      let sourceUri = uri;
      let blobUrl: string | null = null;

      // For remote URLs, try to use proxy to avoid tainted canvas if CORS is restricted
      if (uri.startsWith('http') && uri.includes('/storage/')) {
        try {
          const baseUrl = uri.split('/storage/')[0];
          const filePath = uri.split('/storage/')[1];
          const proxyUrl = `${baseUrl}/media-proxy?path=${filePath}`;
          
          const response = await fetch(proxyUrl, { mode: 'cors' });
          if (response.ok) {
            const blob = await response.blob();
            blobUrl = URL.createObjectURL(blob);
            sourceUri = blobUrl;
          }
        } catch (e) {
          console.warn('Proxy fetch failed for thumbnail generation, falling back to direct URI:', uri);
        }
      } else if (uri.startsWith('http')) {
        // Fallback for non-storage http URLs
        try {
          const response = await fetch(uri, { mode: 'cors' });
          if (response.ok) {
            const blob = await response.blob();
            blobUrl = URL.createObjectURL(blob);
            sourceUri = blobUrl;
          }
        } catch (e) {}
      }

      const video = document.createElement('video');
      video.src = sourceUri;
      video.crossOrigin = 'anonymous';
      video.currentTime = 0.5; // Seek a bit in to avoid black frames
      video.muted = true;
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        } catch (e) {
          console.warn('Canvas capture failed (likely CORS):', e);
          resolve(null);
        } finally {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          video.src = '';
          video.load();
        }
      };
      video.onerror = (e) => {
        console.warn('Thumbnail generation failed for', uri, e);
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        resolve(null);
      };
    });
  };

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.7, // Reduced quality for compression
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });

    if (!result.canceled) {
      // Process each asset
      const processedAssets = [];
      let longVideosCount = 0;

      for (const asset of result.assets) {
        let duration = asset.duration || 0;
        
        // Robust check for web duration if picker returns 0 or small value
        if (Platform.OS === 'web' && duration < 2000) {
          try {
            const probedDuration = await getVideoDuration(asset.uri);
            if (probedDuration > 0) duration = probedDuration;
          } catch (e) {
            console.warn('Failed to probe duration for', asset.uri);
          }
        }

        const isLong = asset.type === 'video' && duration > 120000;
        
        if (isLong) {
          longVideosCount++;
          // For long videos, add with needsTrimming flag
          processedAssets.push({
            ...asset,
            uri: asset.uri,
            type: asset.type,
            needsTrimming: true,
            isLong: true,
            duration: duration
          });
        } else {
          // Compress normal media
          try {
            const compressed = await MediaCompressor.prepareMediaForUpload(
              asset.uri,
              asset.fileName || undefined,
              asset.type === 'video' ? 'video' : 'photo'
            );
            processedAssets.push({
              ...asset,
              uri: compressed.uri,
              type: asset.type || MediaCompressor.getMediaTypeFromUri(asset.uri),
              duration: duration
            });
          } catch (error) {
            console.error('Failed to compress media:', error);
            processedAssets.push({
              ...asset,
              duration: duration
            });
          }
        }
      }

      if (processedAssets.length > 0) {
        // Generate thumbnails for new videos
        const assetsWithThumbnails = await Promise.all(processedAssets.map(async (asset) => {
          if (asset.type === 'video') {
            const thumbnailUri = await generateVideoThumbnail(asset.uri);
            return { ...asset, thumbnailUri };
          }
          return asset;
        }));

        const updatedMedia = [...media, ...assetsWithThumbnails];
        setMedia(updatedMedia);

        // Find the first untrimmed long video in the ENTIRE media array
        const firstUntrimmedIndex = updatedMedia.findIndex(
          item => item.type === 'video' && item.isLong && !item.startTime
        );

        if (firstUntrimmedIndex !== -1) {
          // Auto-open trimmer for the first long video
          setTimeout(() => {
            setVideoToTrimIndex(firstUntrimmedIndex);
            setTrimmerVisible(true);
          }, 500);
          
          if (longVideosCount > 0) {
            showToast(t('long_videos_detected'), 'info');
          }
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
        Alert.alert(t('error'), t('failed_capture_photo'));
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
          const videoUri = video.uri;
          const thumbnailUri = await generateVideoThumbnail(videoUri);
          
          const videoAsset = {
            uri: videoUri,
            thumbnailUri,
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
    longPressTimeout.current = setTimeout(() => {
      if (cameraMode === 'picture') {
        setCameraMode('video');
      }
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
        currentAsset.fileName || `video-${Date.now()}.mp4`,
        'video'
      );

      // Generate new thumbnail for trimmed video
      const thumbnailUri = await generateVideoThumbnail(compressed.uri);

      // Update the asset with trim data and compressed URI
      const newMedia = [...media];
      newMedia[videoToTrimIndex] = {
        ...currentAsset,
        uri: compressed.uri,
        thumbnailUri,
        startTime: trimmedData.startTime,
        endTime: trimmedData.endTime,
        duration: trimmedData.duration * 1000, // convert back to ms for consistency
        needsTrimming: false,
      };

      setMedia(newMedia);
      setTrimmerVisible(false);
      setVideoToTrimIndex(null);

      // Show completion toast
      const hasMoreLongVideos = newMedia.some(
        (item) => item.type === 'video' && item.isLong && !item.startTime
      );
      
      if (hasMoreLongVideos) {
        showToast(t('trim_one_more'), 'info');
      } else {
        showToast(t('trim_completed'), 'success');
      }
    } catch (err) {
      console.error('Trim save error:', err);
      Alert.alert(t('error'), t('failed_save_trimmed_video'));
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
            `photo-${Date.now()}.jpg`,
            'photo'
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
        Alert.alert(t('error'), t('failed_capture_photo_retry'));
      }
    }
  };

  const handleCameraCapture = (uri: string) => {
    setMedia([...media, { uri, type: 'image', fileName: `photo-${Date.now()}.jpg` }]);
    setCameraVisible(false);
  };

  const removeMedia = (index: number) => {
    const newMedia = [...media];
    const item = newMedia[index];

    if (item.id && isEditing) {
      // Mark for deletion instead of immediate server call
      newMedia[index] = { ...item, _deleted: true };
      setMedia(newMedia);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      // For new uploads, just remove from array
      newMedia.splice(index, 1);
      setMedia(newMedia);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSubmit = async () => {
    if (!caption.trim() && media.length === 0) {
      Alert.alert(t('error'), t('add_caption_or_media_error'));
      return;
    }

    // Strict Check: Block if there are still untrimmed long videos
    const untrimmedLongVideos = media.filter(
      item => item.type === 'video' && item.duration > 120000 && !item.startTime
    );

    if (untrimmedLongVideos.length > 0) {
      showToast(t('trim_videos_warning'), 'error');
      Alert.alert(
        t('long_videos_detected'),
        t('trim_videos_warning'),
        [{ 
          text: t('trim_now'), 
          onPress: () => {
            const firstIdx = media.findIndex(item => item.type === 'video' && item.duration > 120000 && !item.startTime);
            if (firstIdx !== -1) {
              setVideoToTrimIndex(firstIdx);
              setTrimmerVisible(true);
            }
          }
        },
        { text: t('cancel'), style: 'cancel' }]
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
        // ✅ Track deleted media IDs
        const deletedIds = media.filter(item => item._deleted && item.id).map(item => item.id.toString());
        deletedIds.forEach(id => {
          formData.append('delete_media[]', id);
        });
      }

      // Filter for new media to upload
      const newMediaToUpload = media.filter(item => !item.id && !item._deleted);

      for (let i = 0; i < newMediaToUpload.length; i++) {
        const item = newMediaToUpload[i];

        // Safety check: Block any long video that somehow bypassed the gatekeeper
        if (item.type === 'video' && (item.duration || 0) > 120000 && item.startTime === undefined) {
          console.warn('Blocking untrimmed long video at upload stage:', item.uri);
          continue; // "Return nothing" for this segment
        }

        // Determine the correct MIME type from the actual file content on web,
        // not from a hardcoded map (which was wrong for .webm files picked from disk).
        const mimeExt: Record<string, string> = {
          'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
          'video/x-msvideo': 'avi', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
        };

        if (Platform.OS === 'web') {
          if ((item as any).file) {
            formData.append('media[]', (item as any).file);
          } else {
            const response = await fetch(item.uri);
            const blob = await response.blob();
            // Use actual MIME from blob (browser detects this correctly for webm/mp4/etc.)
            const actualMime = blob.type || (item.type === 'video' ? 'video/webm' : 'image/jpeg');
            const ext = mimeExt[actualMime] || (item.type === 'video' ? 'webm' : 'jpg');
            const fileName = item.fileName || `media-${Date.now()}.${ext}`;
            const file = new File([blob], fileName, { type: actualMime });
            formData.append('media[]', file);
          }
        } else {
          const fileData = {
            uri: item.uri,
            type: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
            name: item.fileName || `media-${Date.now()}.${item.type === 'video' ? 'mp4' : 'jpg'}`,
          } as any;
          formData.append('media[]', fileData);
        }

        // Add trim metadata
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
                <Text style={[styles.modeText, { marginBottom: 15 }]}>
                  {cameraMode === 'video'
                    ? isRecording ? `${t('recording_label')} ${Math.floor(recordingProgress * RECORDING_LIMIT_MS / 1000)}s` : t('hold_for_video')
                    : t('tap_for_photo')}
                </Text>
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
                <Text style={[styles.modeItem, cameraMode === 'picture' && styles.activeMode]}>{t('photo_label').toUpperCase()}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCameraMode('video')}
                style={[styles.modeButton, cameraMode === 'video' && styles.activeModeButton]}
              >
                <Text style={[styles.modeItem, cameraMode === 'video' && styles.activeMode]}>{t('video_label').toUpperCase()}</Text>
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
        <View style={[GlobalStyles.popupContainer, { paddingTop: insets.top, backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_post') : t('new_post')}</Text>
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
                  {isEditing ? t('update') : t('post')}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <TextInput
              style={[styles.captionInput, { color: colors.text }]}
              placeholder={t('whats_happening_placeholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
              value={caption}
              onChangeText={setCaption}
            />

            {/* AI Shield Feedback */}
            {caption.length > 5 && (
              <View style={[styles.aiShieldContainer, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <View style={styles.aiShieldHeader}>
                  <Ionicons
                    name={isSafe ? "shield-checkmark-outline" : "alert-circle-outline"}
                    size={16}
                    color={isSafe ? colors.success : colors.error}
                  />
                  <Text style={[styles.aiShieldTitle, { color: isSafe ? colors.success : colors.error }]}>
                    {t('ai_shield')}: {isChecking ? t('analyzing') : isSafe ? t('safe_content') : t('potential_violation')}
                  </Text>
                </View>

                <View style={styles.aiMetricsRow}>
                  <View style={styles.aiMetric}>
                    <Text style={[styles.aiMetricLabel, { color: colors.textSecondary }]}>{t('factual_score')}</Text>
                    <Text style={[styles.aiMetricValue, { color: factScore > 0.8 ? colors.success : colors.text }]}>
                      {(factScore * 100).toFixed(0)}%
                    </Text>
                  </View>
                  <View style={styles.aiMetric}>
                    <Text style={[styles.aiMetricLabel, { color: colors.textSecondary }]}>{t('morality_score')}</Text>
                    <Text style={[styles.aiMetricValue, { color: moralityScore > 0.8 ? colors.success : colors.text }]}>
                      {(moralityScore * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>

                {analysis?.flags && analysis.flags.length > 0 && (
                  <View style={styles.aiFlagsRow}>
                    {analysis.flags.map(flag => (
                      <View key={flag} style={[styles.aiFlagBadge, { backgroundColor: colors.background }]}>
                        <Text style={[styles.aiFlagText, { color: colors.textSecondary }]}>{flag.replace('_', ' ')}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Location Picker */}
            <View style={styles.locationContainer}>
              {location ? (
                <View style={styles.locationTag}>
                  <BlurView intensity={80} tint={activeScheme === 'dark' ? 'dark' : 'light'} style={styles.locationTagContent}>
                    <Ionicons name="location" size={16} color={colors.tint} />
                    <Text style={[styles.locationTagText, { color: colors.text }]}>{location.name}</Text>
                    <TouchableOpacity onPress={removeLocation} style={styles.removeLocationButton}>
                      <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </BlurView>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.addLocationButton, { backgroundColor: colors.muted }]}
                  onPress={() => setShowLocationSearch(true)}
                >
                  <Ionicons name="location-outline" size={20} color={colors.tint} />
                  <Text style={[styles.addLocationText, { color: colors.tint }]}>{t('add_location')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Long Video Warning */}
            {longVideosDetected && !isEditing && (
              <View style={styles.warningContainer}>
                <Ionicons name="alert-circle" size={20} color="#FF9500" />
                <Text style={styles.warningText}>
                  {t('long_video_warning')}
                </Text>
              </View>
            )}

            {media.some(item => !item._deleted) && (
              <View style={styles.mediaContainer}>
                {media.map((item, index) => {
                  if (item._deleted) return null;
                  return (
                    <View key={`media-${item.id || index}`} style={styles.mediaItem}>
                      {item.type === 'video' ? (
                        <View style={styles.videoThumbnail}>
                          <Image
                            source={{ uri: item.thumbnailUri || (item.file_path ? `${getApiBaseImage()}/storage/${item.file_path}` : item.uri) }}
                            style={styles.mediaPreview}
                            resizeMode="cover"
                          />
                          <View style={[styles.videoOverlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                            <Ionicons name="videocam" size={32} color="#fff" />
                          </View>
                          {item.duration && (
                            <View style={styles.durationContainer}>
                              <Text style={styles.durationLabel}>
                                {item.startTime !== undefined
                                  ? `${Math.floor((item.endTime - item.startTime) / 60)}:${Math.floor((item.endTime - item.startTime) % 60).toString().padStart(2, '0')}`
                                  : `${Math.floor(item.duration / 60000)}:${Math.floor((item.duration % 60000) / 1000).toString().padStart(2, '0')}`}
                              </Text>
                              {item.startTime !== undefined && (
                                <View style={styles.trimmedBadgeTiny}>
                                  <Text style={styles.trimmedTextTiny}>{t('trimmed')}</Text>
                                </View>
                              )}
                            </View>
                          )}

                          {item.duration && item.duration > 120000 && !item.startTime && !item.file_path && (
                            <TouchableOpacity
                              style={styles.trimOverlay}
                              onPress={() => handleTrim(index)}
                            >
                              <View style={styles.trimBadge}>
                                <Ionicons name="cut" size={16} color="#fff" />
                                <Text style={styles.trimText}>{t('cut_to_2m')}</Text>
                              </View>
                            </TouchableOpacity>
                          )}

                          {item.startTime !== undefined && !item.file_path && (
                            <TouchableOpacity
                              style={styles.trimOverlayActive}
                              onPress={() => handleTrim(index)}
                            >
                              <View style={styles.trimBadgeActive}>
                                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                <Text style={styles.trimText}>{t('trimmed')}</Text>
                              </View>
                            </TouchableOpacity>
                          )}

                          {(!item.duration || item.duration <= 120000) && item.startTime === undefined && !item.file_path && (
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
                  );
                })}
              </View>
            )}

            <View style={styles.mediaButtons}>
              <TouchableOpacity
                style={[styles.mediaButton, { backgroundColor: colors.muted }]}
                onPress={pickMedia}
              >
                <Ionicons name="image" size={24} color={colors.tint} />
                <Text style={[styles.mediaButtonText, { color: colors.tint }]}>{t('library')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mediaButton, { backgroundColor: colors.muted }]}
                onPress={() => setCameraVisible(true)}
              >
                <Ionicons name="camera" size={24} color={colors.tint} />
                <Text style={[styles.mediaButtonText, { color: colors.tint }]}>{t('camera')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {videoToTrimIndex !== null && media[videoToTrimIndex] && (
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

      <ShareLocation
        visible={showLocationSearch}
        onClose={() => setShowLocationSearch(false)}
        onShareLocation={handleLocationSelect}
      />
    </Modal>
  );
}

const getStyles = (colors: any, activeScheme: string) => StyleSheet.create({
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
    opacity: 0.5,
  },
  content: {
    padding: 16,
    paddingBottom: 80,
  },
  captionInput: {
    fontSize: 18,
    minHeight: 100,
  },
  locationContainer: {
    marginVertical: 10,
  },
  addLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  addLocationText: {
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
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
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
    width: '45%',
  },
  mediaButtonText: {
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
    ...createTextShadow({ color: 'black', width: 0, height: 1, radius: 2 }),
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
  aiShieldContainer: {
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
  },
  aiShieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiShieldTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  aiMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  aiMetric: {
    flex: 1,
  },
  aiMetricLabel: {
    fontSize: 10,
  },
  aiMetricValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  aiFlagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  aiFlagBadge: {
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiFlagText: {
    fontSize: 10,
    color: '#0288D1',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});