import React, { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { MotiView, AnimatePresence } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import PlatformCameraView from '@/components/PlatformCameraView';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { MediaCompressor } from '@/utils/mediaCompressor';
import { getToken } from '@/services/TokenService';
import getApiBase from '@/services/getApiBase';
import { createShadow } from '@/utils/styles';

export interface UploadedMedia {
  id: number;
  url: string;
  type: string;
  file_name: string;
  mime_type: string;
  file_size: number;
}

export interface AdvancedMediaUploaderProps {
  spaceId: string;
  isVisible: boolean;
  onClose: () => void;
  onUploadComplete?: (media: UploadedMedia[], caption?: string) => void;
}

export interface AdvancedMediaUploaderRef {
  openCamera: () => void;
  openGallery: () => void;
  openFilePicker: () => void;
}

interface SelectedAsset {
  uri: string;
  type: 'image' | 'video' | 'document';
  name: string;
  mimeType: string;
  file?: File;
}

// ─── Upload Helper ────────────────────────────────────────────────────────────

async function uploadToSpaceAPI(
  spaceId: string,
  asset: SelectedAsset,
  onProgress?: (pct: number) => void
): Promise<UploadedMedia> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const formData = new FormData();

  if (Platform.OS === 'web') {
    if (asset.file) {
      formData.append('file', asset.file);
    } else {
      // Vital for CameraView recordings captured on web as Blob URIs
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const file = new File([blob], asset.name, { type: asset.mimeType });
      formData.append('file', file);
    }
  } else {
    formData.append('file', {
      uri: asset.uri,
      type: asset.mimeType,
      name: asset.name,
    } as any);
  }
  formData.append('type', asset.type);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiBase()}/spaces/${spaceId}/upload-media`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json.media ?? json);
        } catch {
          reject(new Error('Invalid server response'));
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Request timed out'));
    xhr.timeout = 120_000;

    xhr.send(formData);
  });
}

const { width, height } = Dimensions.get('window');
const RECORDING_LIMIT_MS = 120000; // 120 seconds

// ─── Main Component ────────────────────────────────────────────────────────────

const AdvancedMediaUploader = forwardRef<AdvancedMediaUploaderRef, AdvancedMediaUploaderProps>(({
  spaceId,
  isVisible,
  onClose,
  onUploadComplete,
}, ref) => {
  const insets = useSafeAreaInsets();
  // Navigation State
  const [viewState, setViewState] = useState<'preview' | 'grid'>('preview');
  const [cameraVisible, setCameraVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    openCamera,
    openGallery,
    openFilePicker,
  }));

  // Data State
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [caption, setCaption] = useState('');

  // Upload State
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Camera & Recording State
  const [cameraType, setCameraType] = useState<'back' | 'front'>('back');
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [zoom, setZoom] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<any>(null);
  const longPressTimeout = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  // Video Preview Player (SDK 52)
  const videoPlayer = useVideoPlayer(
    viewState === 'preview' && selectedAssets[focusedIndex]?.type === 'video' ? selectedAssets[focusedIndex].uri : '',
    player => {
      player.loop = true;
      if (viewState === 'preview') player.play();
    }
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
    };
  }, []);

  // ─── Picker Actions ─────────────────────────────────────────────────────────

  const handleAssetPicked = async (
    uri: string,
    type: 'image' | 'video' | 'document',
    name: string,
    mimeType: string,
    file?: File
  ) => {
    // ─── Size Limit Check (20MB) ───
    try {
      let size = 0;
      if (Platform.OS === 'web' && file) {
        size = file.size;
      } else if (Platform.OS !== 'web') {
        const info = await FileSystem.getInfoAsync(uri) as any;
        if (info.exists) size = info.size || 0;
      }

      if (size > 20 * 1024 * 1024) {
        Alert.alert(
          'File Too Large',
          'Files must be less than 20 MB. Please choose a smaller file.',
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (err) {
      console.warn('Size check failed:', err);
    }

    setSelectedAssets(prev => [...prev, { uri, type, name, mimeType, file }]);
    setFocusedIndex(selectedAssets.length);
    setViewState('preview');
    setCameraVisible(false);
  };

  const openCamera = useCallback(async () => {
    try {
      setCameraVisible(true);
    } catch (err) {
      console.error('Camera err:', err);
      Alert.alert('Error', 'Failed to launch camera.');
    }
  }, []);

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });

        if (photo) {
          handleAssetPicked(
            photo.uri,
            'image',
            `photo-${Date.now()}.jpg`,
            'image/jpeg'
          );
        }
      } catch (error) {
        console.error('Error taking photo:', error);
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
          handleAssetPicked(
            video.uri,
            'video',
            `video-${Date.now()}.mp4`,
            'video/mp4'
          );
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
      if (cameraMode === 'picture') {
        takePhoto();
      }
    }
  };

  const toggleFacing = () => {
    setCameraType(prev => (prev === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(prev => (prev === 'off' ? 'on' : prev === 'on' ? 'auto' : 'off'));
  };

  const formatRecordingTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };


  const openGallery = useCallback(async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.multiple = true;
      input.onchange = async (e: any) => {
        const files = Array.from(e.target?.files || []) as File[];
        if (files.length > 0) {
          const newAssets: SelectedAsset[] = files.map(file => {
            const type = file.type.startsWith('video/') ? 'video' : 'image';
            return {
              uri: URL.createObjectURL(file),
              type,
              name: file.name,
              mimeType: file.type,
              file
            };
          });
          setSelectedAssets(prev => {
            const next = [...prev, ...newAssets];
            setFocusedIndex(prev.length);
            setViewState(next.length > 1 ? 'grid' : 'preview');
            return next;
          });
        }
      };
      input.click();
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow photo library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as any,
      allowsMultipleSelection: true,
      selectionLimit: 0, // 0 means unlimited
      quality: 0.8,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const newAssets: SelectedAsset[] = result.assets.map(asset => {
        const isVideo = asset.type === 'video' || (asset.mimeType ?? '').startsWith('video/');
        return {
          uri: asset.uri,
          type: isVideo ? 'video' : 'image',
          name: asset.fileName || `media_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
          mimeType: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg')
        };
      });

      setSelectedAssets(prev => {
        const next = [...prev, ...newAssets];
        setFocusedIndex(prev.length);
        setViewState(next.length > 1 ? 'grid' : 'preview');
        return next;
      });
    }
  }, [selectedAssets.length]);

  const openFilePicker = useCallback(async () => {
    // Currently relying on web input for files, fallback to Gallery for native
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*';
      input.multiple = true;
      input.onchange = async (e: any) => {
        const files = Array.from(e.target?.files || []) as File[];
        if (files.length > 0) {
          const newAssets: SelectedAsset[] = files.map(file => {
            const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document';
            return {
              uri: URL.createObjectURL(file),
              type,
              name: file.name,
              mimeType: file.type || 'application/octet-stream',
              file
            };
          });
          setSelectedAssets(prev => {
            const next = [...prev, ...newAssets];
            setFocusedIndex(prev.length);
            setViewState(next.length > 1 ? 'grid' : 'preview');
            return next;
          });
        }
      };
      input.click();
      return;
    }
    Alert.alert('File Picker', 'Native file document picking requires a specialized library. Proceeding to Gallery instead.', [
      { text: 'OK', onPress: openGallery }
    ]);
  }, [openGallery]);

  // ─── Upload Action ──────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (selectedAssets.length === 0) return;

    setUploading(true);
    setProgress(0);
    Keyboard.dismiss();

    try {
      const uploadedItems: UploadedMedia[] = [];

      for (let i = 0; i < selectedAssets.length; i++) {
        const asset = selectedAssets[i];
        setFocusedIndex(i);

        // 1. Prepare and Compress Media
        const compressedData = await MediaCompressor.prepareMediaForUpload(
          asset.uri,
          asset.name
        );

        const finalAsset: SelectedAsset = {
          ...asset,
          uri: compressedData.uri,
          mimeType: compressedData.type,
        };

        // 2. Upload to Server
        const media = await uploadToSpaceAPI(
          spaceId,
          finalAsset,
          (pct) => setProgress(Math.round(((i * 100) + pct) / selectedAssets.length))
        );

        uploadedItems.push(media);
      }

      // 3. Finalize batch
      onUploadComplete?.(uploadedItems, caption.trim());

      setProgress(100);
      safeHaptics.success();

      // 4. Reset State
      setTimeout(() => {
        resetAndClose();
      }, 500);

    } catch (err: any) {
      console.error('Upload error:', err);
      Alert.alert('Upload Failed', err?.message ?? 'Please try again.');
      setUploading(false);
      setProgress(0);
    }
  };

  const resetAndClose = () => {
    setUploading(false);
    setProgress(0);
    setSelectedAssets([]);
    setFocusedIndex(0);
    setCaption('');
    onClose();
  };

  const removeAsset = (index: number) => {
    const newAssets = [...selectedAssets];
    newAssets.splice(index, 1);
    setSelectedAssets(newAssets);
    if (newAssets.length === 0) {
      resetAndClose();
    } else if (focusedIndex >= newAssets.length) {
      setFocusedIndex(newAssets.length - 1);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const renderCameraView = () => (
    <Modal visible={cameraVisible} animationType="slide" transparent={false}>
      <View style={styles.cameraContainer}>
        <PlatformCameraView
          cameraRef={cameraRef}
          style={styles.camera}
          facing={cameraType}
          flash={flash}
          zoom={zoom}
        >
          <SafeAreaView style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity onPress={() => setCameraVisible(false)} style={styles.cameraClose}>
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>

              <View style={styles.cameraTopRight}>
                <TouchableOpacity onPress={toggleFlash} style={styles.cameraIconBtn}>
                  <Ionicons
                    name={flash === 'off' ? 'flash-off' : flash === 'on' ? 'flash' : 'flash-outline'}
                    size={24}
                    color="white"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.cameraBottomWrapper}>
              <View style={styles.cameraControlsMain}>
                <View style={{ width: 44 }} />

                <View style={styles.captureCenter}>
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
                      style={styles.captureInnerCircle}
                    />
                    {isRecording && (
                      <MotiView
                        from={{ opacity: 0, scale: 1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={styles.progressRingLayer}
                      >
                        <View
                          style={[
                            styles.progressFillBar,
                            { width: `${recordingProgress * 100}%` }
                          ]}
                        />
                      </MotiView>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.cameraHint}>
                    {cameraMode === 'video'
                      ? isRecording ? `Recording ${Math.floor(recordingProgress * RECORDING_LIMIT_MS / 1000)}s` : 'Hold for Video'
                      : 'Tap for Photo'}
                  </Text>
                </View>

                <TouchableOpacity style={styles.cameraFlipBtn} onPress={toggleFacing}>
                  <Ionicons name="camera-reverse-outline" size={32} color="white" />
                </TouchableOpacity>
              </View>

              <View style={styles.cameraModeSelector}>
                <TouchableOpacity
                  onPress={() => setCameraMode('picture')}
                  style={[styles.cameraModeBtn, cameraMode === 'picture' && styles.activeCameraModeBtn]}
                >
                  <Text style={[styles.cameraModeTxt, cameraMode === 'picture' && styles.activeCameraModeTxt]}>PHOTO</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCameraMode('video')}
                  style={[styles.cameraModeBtn, cameraMode === 'video' && styles.activeCameraModeBtn]}
                >
                  <Text style={[styles.cameraModeTxt, cameraMode === 'video' && styles.activeCameraModeTxt]}>VIDEO</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </PlatformCameraView>
      </View>
    </Modal>
  );

  if (cameraVisible) return renderCameraView();

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={uploading ? () => { } : resetAndClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {viewState === 'grid' && (
          <View style={[styles.previewContainer, GlobalStyles.popupContainer, { backgroundColor: '#000' }]}>
            <View style={[styles.previewHeader, { paddingTop: insets.top || 16 }]}>
              <TouchableOpacity onPress={resetAndClose} disabled={uploading} style={styles.backBtn}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerIndicator}>
                <Text style={styles.headerTitle}>
                  {selectedAssets.length} Selected
                </Text>
              </View>
              <View style={{ width: 44 }} />
            </View>

            <ScrollView
              style={styles.flex1}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.gridContainer}>
                {selectedAssets.map((asset, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.gridItem}
                    onPress={() => {
                      setFocusedIndex(index);
                      setViewState('preview');
                    }}
                  >
                    {asset.type === 'image' ? (
                      <Image source={{ uri: asset.uri }} style={styles.gridMedia} />
                    ) : asset.type === 'video' ? (
                      <View style={styles.gridMedia}>
                        <Ionicons name="play-circle" size={32} color="#fff" style={styles.gridPlayIcon} />
                      </View>
                    ) : (
                      <View style={[styles.gridMedia, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' }]}>
                        <Ionicons name="document" size={32} color="#fff" />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeBadge}
                      onPress={() => removeAsset(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#ff3b30" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addItem} onPress={openGallery}>
                  <Ionicons name="add" size={40} color="#666" />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={[styles.captionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              {uploading ? (
                <View style={styles.uploadingState}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.uploadingText}>Sending... {progress}%</Text>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add a caption..."
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    maxLength={1000}
                  />
                  <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={uploading}>
                    <Ionicons name="send" size={20} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {viewState === 'preview' && selectedAssets[focusedIndex] && (
          <View style={[styles.previewContainer, GlobalStyles.popupContainer, { backgroundColor: '#000' }]}>
            {/* Main Media Viewer - Takes full screen */}
            <View style={styles.mediaViewerFull}>
              {selectedAssets[focusedIndex].type === 'image' ? (
                <Image
                  source={{ uri: selectedAssets[focusedIndex].uri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : selectedAssets[focusedIndex].type === 'video' ? (
                <VideoView
                  style={styles.previewVideo}
                  player={videoPlayer}
                  nativeControls={true}
                />
              ) : (
                <View style={styles.docPlaceholderContainer}>
                  <Ionicons name="document" size={64} color="#fff" />
                  <Text style={styles.videoPlaceholderText}>{selectedAssets[focusedIndex].name}</Text>
                </View>
              )}
            </View>

            {/* Immersive Header Overlay */}
            <View style={[styles.previewHeaderOverlay, { paddingTop: insets.top || 16 }]}>
              <TouchableOpacity
                onPress={() => selectedAssets.length > 1 ? setViewState('grid') : resetAndClose()}
                disabled={uploading}
                style={styles.backBtn}
              >
                <Ionicons
                  name={selectedAssets.length > 1 ? "arrow-back" : "close"}
                  size={28}
                  color="#fff"
                />
              </TouchableOpacity>
              {selectedAssets.length > 1 && (
                <View style={styles.headerIndicatorCompact}>
                  <Text style={styles.headerTitleSmall}>
                    {focusedIndex + 1} / {selectedAssets.length}
                  </Text>
                </View>
              )}
              <View style={{ width: 44 }} />
            </View>

            {/* Immersive Caption & Send Bar Overlay */}
            <View style={[styles.captionBarOverlay, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              {uploading ? (
                <View style={styles.uploadingState}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.uploadingText}>Sending... {progress}%</Text>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.captionInputImmersive}
                    placeholder="Add a caption..."
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    maxLength={1000}
                  />
                  <TouchableOpacity
                    style={styles.sendBtnImmersive}
                    onPress={handleSend}
                    disabled={uploading}
                  >
                    <Ionicons name="send" size={20} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
});

export default AdvancedMediaUploader;


// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
    ...createShadow({ width: 0, height: -4, opacity: 0.1, radius: 12, elevation: 12 }),
  },
  handle: {
    width: 38,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
  },
  actionBtn: {
    width: '25%', // 4 columns
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadow({
      width: 0,
      height: 3,
      opacity: 0.12,
      radius: 6,
      elevation: 3,
    }),
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B4B4B',
    textAlign: 'center',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewHeader: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
  },
  backBtn: {
    padding: 8,
  },
  mediaViewer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholderContainer: {
    alignItems: 'center',
    gap: 16,
  },
  docPlaceholderContainer: {
    alignItems: 'center',
    gap: 16,
  },
  videoPlaceholderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  gridItem: {
    width: (width - 40) / 3,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
  },
  gridMedia: {
    width: '100%',
    height: '100%',
  },
  gridPlayIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  removeBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 10,
  },
  addItem: {
    width: (width - 32) / 3,
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  captionInput: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 40,
  },
  sendBtn: {
    backgroundColor: '#007AFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginBottom: 0,
  },
  uploadingState: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 44,
  },
  uploadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Immersive Preview Styles
  mediaViewerFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewHeaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 100,
  },
  captionBarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 100,
  },
  captionInputImmersive: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    color: '#fff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendBtnImmersive: {
    backgroundColor: '#007AFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    ...createShadow({ width: 0, height: 2, opacity: 0.2, radius: 4, elevation: 4 }),
  },
  headerIndicator: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIndicatorCompact: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitleSmall: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  // Camera UI Styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  cameraHeader: {
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraClose: {
    padding: 8,
  },
  cameraTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraIconBtn: {
    padding: 8,
  },
  cameraBottomWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  cameraControlsMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
    marginBottom: 30,
  },
  captureCenter: {
    alignItems: 'center',
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  captureInnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  progressRingLayer: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressFillBar: {
    position: 'absolute',
    left: -5,
    top: -5,
    height: 80,
    borderWidth: 5,
    borderColor: '#FF3B30',
    borderRadius: 40,
    opacity: 0.5,
  },
  cameraHint: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cameraFlipBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraModeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
  },
  cameraModeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  activeCameraModeBtn: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  cameraModeTxt: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  activeCameraModeTxt: {
    color: 'white',
  },
  previewVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});

