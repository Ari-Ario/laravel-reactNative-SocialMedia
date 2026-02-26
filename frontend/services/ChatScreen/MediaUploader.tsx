// services/ChatScreen/MediaUploader.tsx
// Clean, working implementation — pick-and-upload immediately, no broken deps.
// Supports: Camera · Photo Library · Video · Any file (web only via <input>)
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { getToken } from '@/services/TokenService';
import getApiBase from '@/services/getApiBase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadedMedia {
  id: number;
  url: string;
  type: string;
  file_name: string;
  mime_type: string;
  file_size: number;
}

export interface MediaUploaderProps {
  spaceId: string;
  isVisible: boolean;
  onClose: () => void;
  onUploadComplete?: (media: UploadedMedia) => void;
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadToSpace(
  spaceId: string,
  payload: {
    uri: string;
    name: string;
    mimeType: string;
    webFile?: File;
  },
  mediaType: 'image' | 'video' | 'document',
  onProgress?: (pct: number) => void,
): Promise<UploadedMedia> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const formData = new FormData();

  if (Platform.OS === 'web' && payload.webFile) {
    formData.append('file', payload.webFile);
  } else {
    formData.append('file', {
      uri: payload.uri,
      type: payload.mimeType,
      name: payload.name,
    } as any);
  }
  formData.append('type', mediaType);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiBase()}/spaces/${spaceId}/upload-media`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // Do NOT set Content-Type — browser must set multipart boundary

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
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Request timed out'));
    xhr.timeout = 120_000; // 2 min max

    xhr.send(formData);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

const MediaUploader: React.FC<MediaUploaderProps> = ({
  spaceId,
  isVisible,
  onClose,
  onUploadComplete,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const doUpload = useCallback(async (
    uri: string,
    name: string,
    mimeType: string,
    mediaType: 'image' | 'video' | 'document',
    webFile?: File,
  ) => {
    setUploading(true);
    setProgress(0);
    setPreview(mediaType === 'image' ? uri : null);
    setStatusLabel(`Uploading ${name}…`);

    try {
      const media = await uploadToSpace(
        spaceId,
        { uri, name, mimeType, webFile },
        mediaType,
        (pct) => setProgress(pct),
      );

      setProgress(100);
      setStatusLabel('Done!');

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      onUploadComplete?.(media);

      // Short delay so user sees "Done!" before closing
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        setPreview(null);
        setStatusLabel('');
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('[MediaUploader] Upload error:', err);
      setUploading(false);
      setProgress(0);
      setPreview(null);
      setStatusLabel('');
      Alert.alert('Upload Failed', err?.message ?? 'Something went wrong. Please try again.');
    }
  }, [spaceId, onUploadComplete, onClose]);

  // ─── Pickers ──────────────────────────────────────────────────────────────

  const openCamera = useCallback(async () => {
    if (Platform.OS === 'web') {
      // On web, use a file input with capture attribute
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.setAttribute('capture', 'environment');
      input.onchange = async (e: any) => {
        const file: File = e.target?.files?.[0];
        if (!file) return;
        const uri = URL.createObjectURL(file);
        await doUpload(uri, file.name, file.type || 'image/jpeg', 'image', file);
      };
      input.click();
      return;
    }

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow camera access in your device settings to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.9,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      await doUpload(
        asset.uri,
        `photo_${Date.now()}.jpg`,
        asset.mimeType ?? 'image/jpeg',
        'image',
      );
    }
  }, [doUpload]);

  const openGallery = useCallback(async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.multiple = true;
      input.onchange = async (e: any) => {
        const files: File[] = Array.from(e.target?.files ?? []);
        for (const file of files) {
          const uri = URL.createObjectURL(file);
          const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
          await doUpload(uri, file.name, file.type, mediaType, file);
        }
      };
      input.click();
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow photo library access in your device settings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      // Use new non-deprecated API
      mediaTypes: ['images', 'videos'] as any,
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video' || (asset.mimeType ?? '').startsWith('video/');
      await doUpload(
        asset.uri,
        asset.fileName || `media_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
        isVideo ? 'video' : 'image',
      );
    }
  }, [doUpload]);

  const openFilePicker = useCallback(async () => {
    // On web: open full file picker
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*';
      input.multiple = true;
      input.onchange = async (e: any) => {
        const files: File[] = Array.from(e.target?.files ?? []);
        for (const file of files) {
          const uri = URL.createObjectURL(file);
          const mediaType = file.type.startsWith('image/') ? 'image'
            : file.type.startsWith('video/') ? 'video'
              : 'document';
          await doUpload(uri, file.name, file.type || 'application/octet-stream', mediaType, file);
        }
      };
      input.click();
      return;
    }

    // On native: only ImagePicker is reliably available. Offer images+videos.
    // Explain to user that document picking requires expo-document-picker package.
    Alert.alert(
      'Pick a File',
      'Select what you want to upload:',
      [
        { text: 'Photo', onPress: openGallery },
        { text: 'Video', onPress: () => openGalleryVideos() },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [doUpload, openGallery]);

  const openGalleryVideos = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'] as any,
      allowsMultipleSelection: false,
      videoMaxDuration: 300,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      await doUpload(
        asset.uri,
        asset.fileName || `video_${Date.now()}.mp4`,
        asset.mimeType ?? 'video/mp4',
        'video',
      );
    }
  }, [doUpload]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={() => { if (!uploading) onClose(); }}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {uploading ? (
            /* ── Upload progress UI ── */
            <View style={styles.uploadingBox}>
              {preview ? (
                <Image source={{ uri: preview }} style={styles.previewThumb} resizeMode="cover" />
              ) : (
                <View style={styles.previewIcon}>
                  <Ionicons name="cloud-upload" size={40} color="#007AFF" />
                </View>
              )}
              <Text style={styles.uploadingLabel}>{statusLabel}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
              </View>
              <Text style={styles.progressPct}>{progress}%</Text>
            </View>
          ) : (
            /* ── Source buttons ── */
            <>
              <Text style={styles.title}>Add to Space</Text>
              <Text style={styles.subtitle}>Files appear in the Media tab of Space Settings after uploading.</Text>

              <View style={styles.grid}>
                <SourceBtn icon="camera" label="Camera" color="#007AFF" onPress={openCamera} />
                <SourceBtn icon="images" label="Gallery" color="#34C759" onPress={openGallery} />
                <SourceBtn icon="videocam" label="Video" color="#AF52DE" onPress={openGalleryVideos} />
                <SourceBtn icon="document-attach" label="File" color="#FF9500" onPress={openFilePicker} />
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── Small sub-component ──────────────────────────────────────────────────────

const SourceBtn: React.FC<{ icon: string; label: string; color: string; onPress: () => void }> = ({
  icon, label, color, onPress,
}) => (
  <TouchableOpacity style={styles.srcBtn} onPress={onPress} activeOpacity={0.75}>
    <View style={[styles.srcIcon, { backgroundColor: color }]}>
      <Ionicons name={icon as any} size={28} color="#fff" />
    </View>
    <Text style={styles.srcLabel}>{label}</Text>
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  srcBtn: {
    alignItems: 'center',
    gap: 8,
  },
  srcIcon: {
    width: 68,
    height: 68,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  srcLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
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
  // Upload progress
  uploadingBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 14,
  },
  previewThumb: {
    width: 96,
    height: 96,
    borderRadius: 16,
  },
  previewIcon: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: '#EAF3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    maxWidth: '90%',
    textAlign: 'center',
  },
  progressTrack: {
    width: '80%',
    height: 6,
    backgroundColor: '#e8e8e8',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  progressPct: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '700',
  },
});

export default MediaUploader;