import React, { useState, useRef, useEffect } from 'react';
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
  Switch,
  Dimensions,
  StatusBar
} from 'react-native';
import { useTranslation } from '@/constants/i18n';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';
import * as ImagePicker from 'expo-image-picker';
import { MediaCompressor } from '@/utils/mediaCompressor';
import { useMarketStore } from '@/stores/marketStore';
import * as Haptics from 'expo-haptics';
import ShareLocation from '@/components/ChatScreen/ShareLocation';
import { useToastStore } from '@/stores/toastStore';
import getApiBaseImage from '@/services/getApiBaseImage';
import { MARKET_CATEGORIES } from '@/constants/MarketCategories';
import VideoTrimmer from '../Shared/VideoTrimmer';
import PlatformCameraView from '@/components/PlatformCameraView';
import { AnimatePresence, MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const RECORDING_LIMIT_MS = 120000; // 120 seconds
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CreateMarketItemModalProps {
  visible: boolean;
  onClose: () => void;
  editItem?: any;
}

export default function CreateMarketItemModal({ visible, onClose, editItem }: CreateMarketItemModalProps) {
  const { t } = useTranslation();
  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, activeScheme);
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('$');
  const [description, setDescription] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [condition, setCondition] = useState('new');
  const [media, setMedia] = useState<any[]>([]);
  const [deletedMediaIds, setDeletedMediaIds] = useState<number[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const { showToast } = useToastStore();

  // Video and Camera State
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [videoToTrimIndex, setVideoToTrimIndex] = useState<number | null>(null);
  const [trimmerVisible, setTrimmerVisible] = useState(false);
  const [longVideosDetected, setLongVideosDetected] = useState(false);

  const cameraRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const longPressTimeout = useRef<any>(null);

  const { addItem, updateItem } = useMarketStore();

  const getMediaUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('file://') || path.startsWith('data:')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    if (cleanPath.startsWith('storage/')) {
      return `${getApiBaseImage()}/${cleanPath}`;
    }
    return `${getApiBaseImage()}/storage/${cleanPath}`;
  };

  const getVideoDuration = async (uri: string): Promise<number> => {
    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => resolve(video.duration * 1000);
        video.onerror = () => resolve(0);
        video.src = uri;
      });
    }
    // For native, we'd use expo-av or similar, but for now fallback to 0 or use the Picker result
    return 0;
  };

  const generateVideoThumbnail = async (uri: string): Promise<string | null> => {
    if (Platform.OS !== 'web') return null;

    try {
      let sourceUri = uri;
      let blobUrl: string | null = null;

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
          console.warn('Proxy fetch failed for market thumbnail:', uri);
        }
      } else if (uri.startsWith('http')) {
        try {
          const response = await fetch(uri, { mode: 'cors' });
          if (response.ok) {
            const blob = await response.blob();
            blobUrl = URL.createObjectURL(blob);
            sourceUri = blobUrl;
          }
        } catch (e) { }
      }

      const video = document.createElement('video');
      video.src = sourceUri;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;

      return new Promise((resolve) => {
        video.onloadeddata = () => {
          video.currentTime = 0.5;
        };

        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            resolve(dataUrl);
          } else {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            resolve(null);
          }
        };

        video.onerror = () => {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      return null;
    }
  };

  useEffect(() => {
    if (visible && editItem) {
      setTitle(editItem.title || '');
      setPrice(editItem.price?.toString() || '');
      setCurrency(editItem.currency || '$');
      setDescription(editItem.description || '');
      setDeliveryAvailable(!!editItem.delivery_available);
      setCondition(editItem.condition || 'new');

      // Hydrate media with thumbnails
      const hydrateMedia = async () => {
        const items = [...(editItem.media || [])];
        const hydrated = await Promise.all(items.map(async (item) => {
          if (item.type === 'video' && !item.thumbnailUri) {
            const thumb = await generateVideoThumbnail(getMediaUrl(item.file_path));
            return { ...item, thumbnailUri: thumb };
          }
          return item;
        }));
        setMedia(hydrated);
      };
      hydrateMedia();

      setLocation(editItem.location || null);
      setCategory(editItem.category || null);
      setDeletedMediaIds([]);
    } else if (!visible) {
      setTitle('');
      setPrice('');
      setCurrency('$');
      setDescription('');
      setDeliveryAvailable(false);
      setCondition('new');
      setMedia([]);
      setLocation(null);
      setCategory(null);
      setDeletedMediaIds([]);
    }
  }, [visible, editItem]);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.7,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });

    if (!result.canceled) {
      const processedAssets = [];
      let longVideosCount = 0;

      for (const asset of result.assets) {
        try {
          const type = asset.type === 'video' ? 'video' : 'image';
          let duration = asset.duration || 0;

          if (type === 'video' && (duration === 0 || duration < 2000)) {
            duration = await getVideoDuration(asset.uri);
          }

          const isLong = type === 'video' && duration > 120000;

          if (isLong) {
            longVideosCount++;
            processedAssets.push({
              uri: asset.uri,
              type,
              duration,
              isLong: true,
              needsTrimming: true,
              fileName: asset.fileName || `market-${Date.now()}.mp4`,
              isNew: true
            });
          } else {
            // Compress normal media
            try {
              const compressed = await MediaCompressor.prepareMediaForUpload(
                asset.uri,
                asset.fileName || undefined
              );
              processedAssets.push({
                uri: compressed.uri,
                type,
                duration,
                fileName: compressed.fileName,
                isNew: true
              });
            } catch (error) {
              processedAssets.push({
                uri: asset.uri,
                type,
                duration,
                fileName: asset.fileName || `market-${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`,
                isNew: true
              });
            }
          }
        } catch (error) {
          processedAssets.push({ ...asset, isNew: true });
        }
      }

      if (processedAssets.length > 0) {
        // Generate thumbnails
        const assetsWithThumbs = await Promise.all(processedAssets.map(async (asset) => {
          if (asset.type === 'video') {
            const thumb = await generateVideoThumbnail(asset.uri);
            return { ...asset, thumbnailUri: thumb };
          }
          return asset;
        }));

        const updatedMedia = [...media, ...assetsWithThumbs];
        setMedia(updatedMedia);

        // Auto-open trimmer for first long video
        const firstUntrimmedIndex = updatedMedia.findIndex(
          item => item.type === 'video' && item.isLong && !item.startTime
        );

        if (firstUntrimmedIndex !== -1) {
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

  const onTrimSave = async (trimmedData: { uri: string; startTime: number; endTime: number; duration: number }) => {
    if (videoToTrimIndex === null) return;

    setIsUploading(true);
    try {
      const currentAsset = media[videoToTrimIndex];

      // Compress trimmed video
      const compressed = await MediaCompressor.prepareMediaForUpload(
        trimmedData.uri,
        currentAsset.fileName || `video-${Date.now()}.mp4`
      );

      const thumb = await generateVideoThumbnail(compressed.uri);

      const newMedia = [...media];
      newMedia[videoToTrimIndex] = {
        ...currentAsset,
        uri: compressed.uri,
        thumbnailUri: thumb,
        startTime: trimmedData.startTime,
        endTime: trimmedData.endTime,
        duration: trimmedData.duration * 1000,
        is_trimmed: true,
        needsTrimming: false,
      };

      setMedia(newMedia);
      setTrimmerVisible(false);
      setVideoToTrimIndex(null);

      const hasMoreLong = newMedia.some(item => item.type === 'video' && item.isLong && !item.startTime);
      if (hasMoreLong) {
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

  const removeMedia = (index: number) => {
    const itemToRemove = media[index];
    if (!itemToRemove.isNew && itemToRemove.id) {
      setDeletedMediaIds([...deletedMediaIds, itemToRemove.id]);
    }

    const newMedia = [...media];
    newMedia.splice(index, 1);
    setMedia(newMedia);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !price.trim() || (media.length === 0 && !editItem)) {
      Alert.alert(t('error'), t('market_missing_fields_error', { defaultValue: 'Title, price, and at least one image are required.' }));
      return;
    }

    // Strict Check: Block if there are still untrimmed long videos
    const untrimmedLongVideos = media.filter(
      item => item.type === 'video' && (item.duration || 0) > 120000 && !item.startTime
    );

    if (untrimmedLongVideos.length > 0) {
      showToast(t('trim_videos_warning'), 'error');
      Alert.alert(
        t('long_videos_detected'),
        t('trim_videos_warning'),
        [{ 
          text: t('trim_now'), 
          onPress: () => {
            const firstIdx = media.findIndex(item => item.type === 'video' && (item.duration || 0) > 120000 && !item.startTime);
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
      formData.append('title', title);
      formData.append('price', price);
      formData.append('currency', currency);
      formData.append('description', description);
      formData.append('delivery_available', deliveryAvailable ? '1' : '0');
      formData.append('condition', condition);

      if (location) {
        formData.append('location', JSON.stringify(location));
      }

      if (category) {
        formData.append('category', category);
      }

      // Add new media
      const newMedia = media.filter(item => item.isNew);
      for (let i = 0; i < newMedia.length; i++) {
        const item = newMedia[i];

        // Size Check (60MB limit)
        if (item.size && item.size > 60 * 1024 * 1024) {
          Alert.alert(t('error'), t('file_too_large_error', { defaultValue: 'File is too large (max 60MB)' }));
          setIsUploading(false);
          return;
        }

        if (Platform.OS === 'web') {
          const response = await fetch(item.uri);
          const blob = await response.blob();
          
          // Use blob's actual type or fallback
          const actualMime = blob.type || (item.type === 'video' ? 'video/webm' : 'image/jpeg');
          const ext = actualMime.split('/')[1]?.replace('jpeg', 'jpg') || (item.type === 'video' ? 'webm' : 'jpg');
          let finalFilename = item.fileName || `media-${Date.now()}-${i}.${ext}`;
          if (!finalFilename.includes('.')) finalFilename += `.${ext}`;

          formData.append('media[]', blob, finalFilename);
        } else {
          // Native multipart object
          const type = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
          const ext = item.type === 'video' ? 'mp4' : 'jpg';
          const name = item.fileName || `media-${Date.now()}-${i}.${ext}`;
          formData.append('media[]', {
            uri: item.uri,
            type,
            name,
          } as any);
        }
        
        // Add trim metadata - Units are in seconds (from VideoTrimmer)
        if (item.type === 'video') {
          if (item.startTime !== undefined) {
            formData.append('trim_start[]', item.startTime.toString());
            formData.append('trim_end[]', item.endTime.toString());
          } else {
            formData.append('trim_start[]', '0');
            formData.append('trim_end[]', '0');
          }
        } else {
          // Keep arrays in sync
          formData.append('trim_start[]', '0');
          formData.append('trim_end[]', '0');
        }
      }

      if (editItem) {
        // Add deleted media IDs
        deletedMediaIds.forEach(id => {
          formData.append('delete_media[]', id.toString());
        });

        await updateItem(editItem.id, formData);
        showToast(t('market_item_updated'), 'success');
      } else {
        await addItem(formData);
        showToast(t('market_item_created'), 'success');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error: any) {
      console.error('Error handling market item:', error);
      Alert.alert(t('error'), editItem ? t('market_failed_update') : t('market_failed_create'));
    } finally {
      setIsUploading(false);
    }
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });

        const compressed = await MediaCompressor.prepareMediaForUpload(photo.uri, `photo-${Date.now()}.jpg`);

        setMedia(prev => [...prev, {
          uri: compressed.uri,
          type: 'image',
          fileName: compressed.fileName,
          isNew: true
        }]);
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

        const startTime = Date.now();
        timerRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = elapsed / RECORDING_LIMIT_MS;
          if (progress >= 1) stopRecording();
          else setRecordingProgress(progress);
        }, 50);

        const video = await cameraRef.current.recordAsync({ maxDuration: 120, quality: '1080p' });
        if (video && video.uri) {
          const thumb = await generateVideoThumbnail(video.uri);
          const duration = recordingProgress * RECORDING_LIMIT_MS;

          setMedia(prev => [...prev, {
            uri: video.uri,
            thumbnailUri: thumb,
            type: 'video',
            fileName: `video-${Date.now()}.mp4`,
            duration,
            isNew: true
          }]);
          setCameraVisible(false);
        }
      } catch (error) {
        console.error('Error recording:', error);
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
  };

  const stopRecording = async () => {
    if (cameraRef.current && isRecording) {
      setIsRecording(false);
      setRecordingProgress(0);
      if (timerRef.current) clearInterval(timerRef.current);
      await cameraRef.current.stopRecording();
    }
  };

  const handleLongPress = () => {
    longPressTimeout.current = setTimeout(() => {
      if (cameraMode === 'picture') setCameraMode('video');
      startRecording();
    }, 200);
  };

  const handlePressOut = () => {
    if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
    if (isRecording) stopRecording();
    else if (cameraMode === 'picture') takePhoto();
  };

  const toggleFacing = () => {
    setCameraType(prev => (prev === 'back' ? 'front' : 'back'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleFlash = () => {
    setFlash(prev => (prev === 'off' ? 'on' : prev === 'on' ? 'auto' : 'off'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCapture = async (assets: any[]) => {
    // This is from gallery pick inside camera if implemented, 
    // but PlatformCameraView mostly returns one uri
    const processed = await Promise.all(assets.map(async (asset) => {
      const type = asset.type === 'video' ? 'video' : 'image';
      let thumb = null;
      if (type === 'video') thumb = await generateVideoThumbnail(asset.uri);
      return { ...asset, type, thumbnailUri: thumb, isNew: true, fileName: `camera-${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}` };
    }));
    setMedia([...media, ...processed]);
    setCameraVisible(false);
  };

  const convertDigits = (text: string) => {
    const digitsMap: { [key: string]: string } = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
      '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    };
    return text.replace(/[٠-٩۰-۹]/g, (d) => digitsMap[d] || d);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('market_quick_sell')}</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isUploading || !title || !price || media.length === 0} style={[styles.postBtn, (!title || !price || media.length === 0) && styles.postBtnDisabled]}>
            {isUploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>{t('post')}</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.inputSection}>
            <TextInput
              style={[styles.titleInput, { color: colors.text }]}
              placeholder={t('market_what_selling_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            <View style={[styles.priceContainer, { borderBottomColor: colors.border }]}>
              <TextInput
                style={[styles.currencyInput, { color: colors.text }]}
                placeholder="$"
                placeholderTextColor={colors.textSecondary}
                value={currency}
                onChangeText={(text) => setCurrency(convertDigits(text))}
                maxLength={5}
              />
              <TextInput
                style={[styles.priceInput, { color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                value={price}
                onChangeText={(text) => setPrice(convertDigits(text))}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
            {media.map((item, index) => {
              const imageUri = item.thumbnailUri || item.uri || getMediaUrl(item.file_path);
              const isLongVideo = item.type === 'video' && item.duration > 120000 && !item.startTime;
              const isBackend = !!item.file_path;

              return (
                <View key={index} style={styles.mediaContainer}>
                  <Image source={{ uri: imageUri }} style={styles.mediaImage} />

                  {item.type === 'video' && (
                    <View style={styles.videoOverlay}>
                      <Ionicons name="videocam" size={20} color="#fff" />
                      {item.duration > 0 && (
                        <Text style={styles.durationText}>
                          {Math.floor(item.duration / 1000)}s
                        </Text>
                      )}
                    </View>
                  )}

                  {isLongVideo && (
                    <View style={styles.trimWarning}>
                      <Ionicons name="warning" size={16} color="#FFF" />
                    </View>
                  )}

                  <View style={styles.mediaActions}>
                    <TouchableOpacity style={[styles.mediaActionBtn, { backgroundColor: '#FF3B30' }]} onPress={() => removeMedia(index)}>
                      <Ionicons name="trash" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {!isBackend && item.type === 'video' && (
                    <TouchableOpacity
                      style={[styles.miniTrimButton, isLongVideo && { backgroundColor: '#FF9500' }]}
                      onPress={() => {
                        setVideoToTrimIndex(index);
                        setTrimmerVisible(true);
                      }}
                    >
                      <Ionicons name="cut" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {media.length < 10 && (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={[styles.addMediaBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={pickMedia}>
                  <Ionicons name="images-outline" size={32} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 12 }}>{t('gallery')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.addMediaBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setCameraVisible(true)}>
                  <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 12 }}>{t('camera')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View style={styles.categorySection}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('market_condition')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {['new', 'like_new', 'used', 'refurbished'].map((cond) => (
                <TouchableOpacity
                  key={cond}
                  style={[
                    styles.categoryChip,
                    condition === cond ? styles.categoryChipActive : { backgroundColor: colors.surface, borderColor: colors.border }
                  ]}
                  onPress={() => setCondition(cond)}
                >
                  <Text style={[
                    styles.categoryText,
                    condition === cond ? styles.categoryTextActive : { color: colors.text }
                  ]}>
                    {t('market_condition_' + cond)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.categorySection}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('market_category')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {MARKET_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    category === cat.id ? styles.categoryChipActive : { backgroundColor: colors.surface, borderColor: colors.border }
                  ]}
                  onPress={() => setCategory(cat.id === category ? null : cat.id)}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={16}
                    color={category === cat.id ? '#fff' : colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[
                    styles.categoryText,
                    category === cat.id ? styles.categoryTextActive : { color: colors.text }
                  ]}>
                    {t(cat.name)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.optionsSection, { borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.descriptionInput, { color: colors.text, backgroundColor: colors.surface }]}
              placeholder={t('market_add_description_optional')}
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
              <View style={styles.toggleText}>
                <Ionicons name="cube-outline" size={20} color={colors.text} />
                <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('market_delivery_available')}</Text>
              </View>
              <Switch
                value={deliveryAvailable}
                onValueChange={setDeliveryAvailable}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <TouchableOpacity
              style={[styles.toggleRow, { borderBottomColor: colors.border }]}
              onPress={() => setShowLocationSearch(true)}
            >
              <View style={styles.toggleText}>
                <Ionicons name="location-outline" size={20} color={colors.text} />
                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                  {location ? location.name : t('market_add_location')}
                </Text>
              </View>
              {location ? (
                <TouchableOpacity onPress={() => setLocation(null)}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showLocationSearch} animationType="slide">
        <ShareLocation
          onClose={() => setShowLocationSearch(false)}
          onShareLocation={(loc) => { setLocation(loc); setShowLocationSearch(false); }}
        />
      </Modal>

      <Modal visible={cameraVisible} animationType="slide" transparent={false}>
        <View style={styles.cameraContainer}>
          <PlatformCameraView
            cameraRef={cameraRef}
            style={styles.camera}
            facing={cameraType}
            flash={flash}
          // zoom={zoom}
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
                        ? isRecording ? `${t('recording_label')} ${Math.floor(recordingProgress * RECORDING_LIMIT_MS / 1000)}s` : t('hold_for_video')
                        : t('tap_for_photo')}
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
      </Modal>

      {videoToTrimIndex !== null && (
        <VideoTrimmer
          visible={trimmerVisible}
          videoUri={media[videoToTrimIndex].uri}
          onClose={() => {
            setTrimmerVisible(false);
            setVideoToTrimIndex(null);
          }}
          onSave={onTrimSave}
          maxDuration={120}
        />
      )}
    </Modal>
  );
}

const getStyles = (colors: any, scheme: string) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  postBtn: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnDisabled: { backgroundColor: '#1DA1F280' },
  postBtnText: { color: '#fff', fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  inputSection: { marginBottom: 20 },
  titleInput: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  priceContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 8 },
  currencyInput: { fontSize: 28, fontWeight: '600', marginRight: 8, minWidth: 40 },
  priceInput: { fontSize: 28, fontWeight: '600', flex: 1 },
  mediaScroll: { flexDirection: 'row', marginBottom: 24, paddingVertical: 8 },
  mediaContainer: { marginRight: 12, position: 'relative', width: 110, height: 110 },
  mediaImage: { width: 110, height: 110, borderRadius: 16 },
  mediaActions: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    gap: 6
  },
  mediaActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4
  },
  durationText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  trimWarning: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FF9500',
    padding: 4,
    borderRadius: 10,
  },
  miniTrimButton: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  addMediaBtn: {
    width: 100, height: 100, borderRadius: 16,
    borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center'
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
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'transparent',
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
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsSection: { borderTopWidth: 1, paddingTop: 16 },
  descriptionInput: {
    minHeight: 100, borderRadius: 12, padding: 12,
    fontSize: 16, textAlignVertical: 'top', marginBottom: 16
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth
  },
  toggleText: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 16, fontWeight: '500' },
  categorySection: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  categoryScroll: { flexDirection: 'row' },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#1DA1F2',
    borderColor: '#1DA1F2',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#fff',
  },
});
