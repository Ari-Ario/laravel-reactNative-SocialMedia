import React, { useState, useCallback, useRef, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { VideoView, useVideoPlayer } from 'expo-video';
import { safeHaptics } from '@/utils/haptics';
import { MediaCompressor } from '@/utils/mediaCompressor';
import { getToken } from '@/services/TokenService';
import getApiBase from '@/services/getApiBase';

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
  onUploadComplete?: (media: UploadedMedia, caption?: string) => void;
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

// ─── Main Component ────────────────────────────────────────────────────────────

const AdvancedMediaUploader: React.FC<AdvancedMediaUploaderProps> = ({
  spaceId,
  isVisible,
  onClose,
  onUploadComplete,
}) => {
  // Navigation State
  const [viewState, setViewState] = useState<'picker' | 'preview'>('picker');
  const [cameraVisible, setCameraVisible] = useState(false);

  // Data State
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const [caption, setCaption] = useState('');

  // Upload State
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Camera & Recording State
  const [cameraType, setCameraType] = useState<'back' | 'front'>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // Permission Hooks
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // Video Preview Player (SDK 52)
  const videoPlayer = useVideoPlayer(
    viewState === 'preview' && selectedAsset?.type === 'video' ? selectedAsset.uri : '',
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
    setSelectedAsset({ uri, type, name, mimeType, file });
    setViewState('preview'); // Instantly transition to preview screen
    setCameraVisible(false);
  };

  const openCamera = useCallback(async () => {
    try {
      const camReq = await requestPermission();
      const micReq = await requestMicPermission();

      if (!camReq.granted || !micReq.granted) {
        Alert.alert('Permission Required', 'Please allow camera and microphone access to use this feature.');
        return;
      }

      setCameraVisible(true);
    } catch (err) {
      console.error('Camera permissions err:', err);
      Alert.alert('Error', 'Failed to launch camera.');
    }
  }, [requestPermission, requestMicPermission]);

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
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const type = file.type.startsWith('video/') ? 'video' : 'image';
          handleAssetPicked(URL.createObjectURL(file), type, file.name, file.type, file);
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
      allowsMultipleSelection: false,
      quality: 0.8,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080, // Enforce 1080p limit
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video' || (asset.mimeType ?? '').startsWith('video/');
      handleAssetPicked(
        asset.uri,
        isVideo ? 'video' : 'image',
        asset.fileName || `media_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg')
      );
    }
  }, []);

  const openFilePicker = useCallback(async () => {
    // Currently relying on web input for files, fallback to Gallery for native
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document';
          handleAssetPicked(URL.createObjectURL(file), type, file.name, file.type || 'application/octet-stream', file);
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
    if (!selectedAsset) return;

    setUploading(true);
    setProgress(0);
    Keyboard.dismiss();

    try {
      // 1. Prepare and Compress Media via mediaCompressor Utils (<1.9MB logic)
      const compressedData = await MediaCompressor.prepareMediaForUpload(
        selectedAsset.uri,
        selectedAsset.name
      );

      const finalAsset: SelectedAsset = {
        ...selectedAsset,
        uri: compressedData.uri,
        mimeType: compressedData.type,
      };

      // 2. Upload to Server
      const media = await uploadToSpaceAPI(
        spaceId,
        finalAsset,
        (pct) => setProgress(pct)
      );

      setProgress(100);
      safeHaptics.success();

      // 3. Complete and Reset State
      setTimeout(() => {
        onUploadComplete?.(media, caption.trim());
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
    setViewState('picker');
    setSelectedAsset(null);
    setCaption('');
    onClose();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const renderCameraView = () => {
    return (
      <Modal visible={cameraVisible} animationType="fade" transparent={false}>
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing={cameraType}
            ref={cameraRef}
            mode="video"
            mute={false}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraHeader}>
                <TouchableOpacity style={styles.cameraClose} onPress={() => setCameraVisible(false)}>
                  <Ionicons name="close" size={32} color="#fff" />
                </TouchableOpacity>
                {isRecording && (
                  <View style={styles.recordingIndicator}>
                    <View style={styles.redDot} />
                    <Text style={styles.recordingText}>{formatRecordingTime(recordingTime)}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.cameraFlip} onPress={toggleCameraType}>
                  <Ionicons name="camera-reverse-outline" size={32} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.cameraBottom}>
                <View style={styles.captureContainer}>
                  <TouchableOpacity
                    onLongPress={startRecording}
                    onPressOut={stopRecording}
                    onPress={capturePhoto}
                    activeOpacity={0.7}
                    style={[styles.outerCircle, isRecording && styles.outerCircleRecording]}
                  >
                    <View style={[styles.innerCircle, isRecording && styles.innerCircleRecording]} />
                  </TouchableOpacity>
                  <Text style={styles.hintText}>
                    {isRecording ? 'Release to stop' : 'Tap for photo, hold for video'}
                  </Text>
                </View>
              </View>
            </View>
          </CameraView>
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
      <Pressable onPress={() => Keyboard.dismiss()} style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {viewState === 'picker' && (
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.grid}>
                <ActionBtn icon="camera" label="Camera" color="#007AFF" onPress={openCamera} />
                <ActionBtn icon="images" label="Gallery" color="#34C759" onPress={openGallery} />
                <ActionBtn icon="document-text" label="File" color="#FF9500" onPress={openFilePicker} />
              </View>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetAndClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {viewState === 'preview' && selectedAsset && (
            <View style={styles.previewContainer}>
              {/* Header */}
              <View style={styles.previewHeader}>
                <TouchableOpacity onPress={() => setViewState('picker')} disabled={uploading} style={styles.backBtn}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Main Media Viewer */}
              <View style={styles.mediaViewer}>
                {selectedAsset.type === 'image' ? (
                  <Image source={{ uri: selectedAsset.uri }} style={styles.previewImage} resizeMode="contain" />
                ) : selectedAsset.type === 'video' ? (
                  <VideoView
                    style={styles.previewVideo}
                    player={videoPlayer}
                    allowsFullscreen
                    allowsPictureInPicture
                  />
                ) : (
                  <View style={styles.docPlaceholderContainer}>
                    <Ionicons name="document" size={64} color="#fff" />
                    <Text style={styles.videoPlaceholderText}>{selectedAsset.name}</Text>
                  </View>
                )}
              </View>

              {/* Caption & Send Bar */}
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
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

// ─── Small UI sub-component ───────────────────────────────────────────────────

const ActionBtn: React.FC<{ icon: string; label: string; color: string; onPress: () => void }> = ({
  icon, label, color, onPress,
}) => (
  <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.75}>
    <View style={[styles.actionIcon, { backgroundColor: color }]}>
      <Ionicons name={icon as any} size={30} color="#fff" />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 28,
    marginTop: 10,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  cancelBtn: {
    paddingVertical: 14,
    backgroundColor: '#f4f4f6',
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
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
  captionBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, // Safe area approx
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
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  previewVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});

export default AdvancedMediaUploader;
