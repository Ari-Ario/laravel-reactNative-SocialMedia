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
  ScrollView,
} from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import PlatformCameraView from '@/components/PlatformCameraView';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system';
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

// ─── Main Component ────────────────────────────────────────────────────────────

const AdvancedMediaUploader = forwardRef<AdvancedMediaUploaderRef, AdvancedMediaUploaderProps>(({
  spaceId,
  isVisible,
  onClose,
  onUploadComplete,
}, ref) => {
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
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
      if (recordingTimer) clearInterval(recordingTimer);
    };
  }, [recordingTimer]);

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

  const startRecording = async () => {
    if (cameraRef.current && !isRecording) {
      try {
        setIsRecording(true);
        setRecordingTime(0);
        const timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        setRecordingTimer(timer);

        const video = await cameraRef.current.recordAsync({
          maxDuration: 60,
        });

        if (video) {
          handleAssetPicked(
            video.uri,
            'video',
            `video_${Date.now()}.mp4`,
            'video/mp4'
          );
        }
      } catch (err) {
        console.error('Recording error:', err);
        stopRecording();
      }
    }
  };

  const stopRecording = async () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      if (recordingTimer) clearInterval(recordingTimer);
      setRecordingTimer(null);
      setIsRecording(false);
    }
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        if (photo) {
          handleAssetPicked(
            photo.uri,
            'image',
            `photo_${Date.now()}.jpg`,
            'image/jpeg'
          );
        }
      } catch (err) {
        console.error('Capture error:', err);
      }
    }
  };

  const toggleCameraType = () => {
    setCameraType(prev => (prev === 'back' ? 'front' : 'back'));
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

  const renderCameraView = () => {
    const handleCapture = (uri: string) => {
      handleAssetPicked(uri, 'image', `photo_${Date.now()}.jpg`, 'image/jpeg');
    };

    return (
      <Modal visible={cameraVisible} animationType="fade" transparent={false}>
        <View style={styles.cameraContainer}>
          <PlatformCameraView
            style={{ flex: 1 } as any}
            facing={cameraType}
            showControls
            onCapture={handleCapture}
            cameraRef={cameraRef}
          />
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, left: 20, padding: 8 }}
            onPress={() => setCameraVisible(false)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    );
  };

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
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
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

            <View style={styles.captionBar}>
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
          <View style={styles.previewContainer}>
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
            <View style={styles.previewHeaderOverlay}>
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
            <View style={styles.captionBarOverlay}>
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
    paddingTop: 50, // Safe area approx
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
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
    paddingTop: 50,
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  cameraClose: {
    padding: 8,
  },
  cameraFlip: {
    padding: 8,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  recordingText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  cameraBottom: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  captureContainer: {
    alignItems: 'center',
    gap: 12,
  },
  outerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  outerCircleRecording: {
    borderColor: '#ff3b30',
    transform: [{ scale: 1.2 }],
  },
  innerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  innerCircleRecording: {
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    width: 30,
    height: 30,
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    ...Platform.select({
      web: {
        textShadow: '0px 1px 4px rgba(0, 0, 0, 0.5)',
      },
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
      },
    }),
  },
  previewVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});

