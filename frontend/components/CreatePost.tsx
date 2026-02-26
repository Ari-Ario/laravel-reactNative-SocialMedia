// components/CreatePost.tsx
import { useState, useEffect, useRef } from 'react';
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
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { createPost, updatePost } from '@/services/PostService';
import { useLocalSearchParams, router } from 'expo-router';
import getApiBaseImage from '@/services/getApiBaseImage';
import { deletePostMedia, fetchPosts } from '@/services/PostService';
import { usePostStore } from '@/stores/postStore';
import { MediaCompressor } from '@/utils/mediaCompressor';
import { CameraType } from 'expo-image-picker';
import { Post } from '@/services/PostListService';

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
  const [cameraType, setCameraType] = useState<CameraType>(CameraType.back);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);

  // Use CameraView ref for web, Camera ref for mobile
  const cameraRef = useRef<any>(null);

  const [deleteStatus, setDeleteStatus] = useState<{ visible: boolean, message: string }>({ visible: false, message: '' });
  const postStore = usePostStore();

  // Use the modern camera permissions hook for web
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  // Initialize with edit data if available
  useEffect(() => {
    if (visible) {
      if (isEditing) {
        setCaption(params.caption || '');

        try {
          const parsedMedia = params.media ? JSON.parse(params.media as string) : [];
          setMedia(Array.isArray(parsedMedia) ? parsedMedia : []);
        } catch (e) {
          console.error('Error parsing media:', e);
          setMedia([]);
        }
      } else {
        // New post: check if we have initial caption (e.g., sharing a poll)
        setCaption(params.caption || '');
        setMedia([]);
      }
    } else {
      // Reset when closed
      setCaption('');
      setMedia([]);
    }
  }, [visible, isEditing, params.caption, params.media]);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
    };
  }, [recordingTimer]);

  const pickMedia = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.7, // Reduced quality for compression
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });

    if (!result.canceled) {
      // Compress selected media before adding to state
      const compressedMedia = await Promise.all(
        result.assets.map(async (asset) => {
          try {
            const compressed = await MediaCompressor.prepareMediaForUpload(
              asset.uri,
              asset.fileName
            );
            return {
              ...asset,
              uri: compressed.uri,
              type: asset.type || MediaCompressor.getMediaTypeFromUri(asset.uri),
            };
          } catch (error) {
            console.error('Failed to compress media:', error);
            return asset; // Return original if compression fails
          }
        })
      );
      setMedia([...media, ...compressedMedia]);
    }
  };

  const takePhoto = async () => {
    // For web: use CameraView with permission handling
    if (Platform.OS === 'web') {
      if (!permission) {
        // Permissions are still loading
        Alert.alert('Camera', 'Camera permissions are loading...');
        return;
      }

      if (!permission.granted) {
        // Request permission
        const response = await requestPermission();
        if (!response.granted) {
          Alert.alert('Permission required', 'Camera permission is needed to take photos');
          return;
        }
      }

      setCameraVisible(true);
      return;
    }

    // For mobile: use traditional Camera permission
    if (Platform.OS !== 'web') {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is needed to take photos');
        return;
      }
      setCameraVisible(true);
    }
  };

  const startRecording = async () => {
    if (cameraRef.current && !isRecording) {
      try {
        setIsRecording(true);
        setRecordingTime(0);

        // Start recording timer
        const timer = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        setRecordingTimer(timer);

        // Start recording
        await cameraRef.current.recordAsync({
          // quality: Camera.Constants.VideoQuality['480p'], // Lower quality for smaller size
          maxDuration: 60, // Maximum 60 seconds
          mute: false,
        });
      } catch (error) {
        console.error('Error starting recording:', error);
        Alert.alert('Error', 'Failed to start recording');
        stopRecording();
      }
    }
  };

  const stopRecording = async () => {
    if (cameraRef.current && isRecording) {
      try {
        const video = await cameraRef.current.stopRecording();  // ← note: returns Promise<CameraCapturedPicture | void> in some versions, but usually { uri }

        if (recordingTimer) {
          clearInterval(recordingTimer);
          setRecordingTimer(null);
        }

        setIsRecording(false);
        setRecordingTime(0);

        // ── Guard: check if we actually got a valid video object ──
        if (!video || !video.uri) {
          console.warn("Recording finished but no valid video object returned");
          Alert.alert("Recording failed", "No video was captured. Try again.");
          setCameraVisible(false);
          return;
        }

        // Compress only if we have a uri
        try {
          const compressed = await MediaCompressor.prepareMediaForUpload(
            video.uri,
            `video-${Date.now()}.mp4`
          );

          setMedia([...media, {
            uri: compressed.uri,
            type: 'video',
            fileName: compressed.fileName
          }]);
        } catch (compressError) {
          console.error('Failed to compress video:', compressError);
          // Fallback: add original if compression fails
          setMedia([...media, {
            uri: video.uri,
            type: 'video',
            fileName: `video-${Date.now()}.mp4`
          }]);
        }

        setCameraVisible(false);
      } catch (error) {
        console.error('Error stopping recording:', error);
        Alert.alert('Error', 'Failed to stop recording: ' + (error.message || 'Unknown error'));
        setIsRecording(false);
        setRecordingTime(0);
        if (recordingTimer) {
          clearInterval(recordingTimer);
          setRecordingTimer(null);
        }
      }
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

  const toggleCameraType = () => {
    setCameraType(current => (
      current === CameraType.back ? CameraType.front : CameraType.back
    ));
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
    if (!caption.trim()) {
      Alert.alert('Error', 'Please add a caption or media');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption);

      if (isEditing) {
        formData.append('_method', 'PUT');
        media.forEach(item => {
          if (item._deleted && item.id) {
            formData.append('delete_media[]', item.id.toString());
          }
        });
      }

      // Handle media uploads
      const newMedia = media.filter(item => !item.id && !item._deleted);

      for (let i = 0; i < newMedia.length; i++) {
        const item = newMedia[i];

        if (Platform.OS === 'web') {
          // Web: Convert to File object
          const response = await fetch(item.uri);
          const blob = await response.blob();
          const file = new File([blob], item.fileName || `media-${i}.${item.uri.split('.').pop()}`, {
            type: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
          });
          formData.append(`media[${i}]`, file);
        } else {
          // Android/iOS: Use the correct React Native file structure
          const file = {
            uri: item.uri,
            name: item.fileName || `media-${Date.now()}.${item.type === 'video' ? 'mp4' : 'jpg'}`,
            type: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
          };

          // Append to FormData - use bracket notation for array
          formData.append(`media[${i}]`, file);
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
    } catch (error) {
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
    router.setParams({
      postId: null,
      caption: '',
      media: null
    });
    onClose(); // Call the original onClose prop
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderCameraView = () => {
    if (Platform.OS === 'web') {
      // Web camera view with permission handling
      if (!permission) {
        return (
          <View style={styles.cameraContainer}>
            <View style={[styles.camera, { justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: 'white' }}>Checking camera permissions...</Text>
            </View>
          </View>
        );
      }

      if (!permission.granted) {
        return (
          <View style={styles.cameraContainer}>
            <View style={[styles.camera, { justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: 'white', marginBottom: 20 }}>Camera permission is required</Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestPermission}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Grant Permission</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.permissionButton, { backgroundColor: '#666', marginTop: 10 }]}
                onPress={() => setCameraVisible(false)}
              >
                <Text style={{ color: 'white' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing={cameraType}
            ref={cameraRef}
            videoQuality="480p"
            mode="video"
            mute={false}
          >
            <View style={styles.cameraButtons}>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => setCameraVisible(false)}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>

              <View style={styles.captureButtonsContainer}>
                {isRecording ? (
                  <>
                    <View style={styles.recordingTimer}>
                      <Text style={styles.recordingTimerText}>{formatRecordingTime(recordingTime)}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.captureButton, styles.recordingButton]}
                      onPress={stopRecording}
                    >
                      <View style={styles.stopRecordingButton} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.captureButton}
                      onPress={capturePhoto}
                    >
                      <View style={styles.captureButtonInner} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.videoButton, { marginLeft: 20 }]}
                      onPress={startRecording}
                    >
                      <Ionicons name="videocam" size={30} color="white" />
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <TouchableOpacity
                style={styles.cameraButton}
                onPress={toggleCameraType}
              >
                <Ionicons name="camera-reverse" size={30} color="white" />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      );
    } else {
      // Mobile camera view
      return (
        <View style={[styles.cameraContainer, StyleSheet.absoluteFill]}>
          <CameraView
            style={styles.camera}
            facing={cameraType}
            ref={cameraRef}
            videoQuality="480p"
            mode="video"
            mute={false}
          >
            <View style={styles.cameraButtons}>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => setCameraVisible(false)}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>

              <View style={styles.captureButtonsContainer}>
                {isRecording ? (
                  <>
                    <View style={styles.recordingTimer}>
                      <Text style={styles.recordingTimerText}>{formatRecordingTime(recordingTime)}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.captureButton, styles.recordingButton]}
                      onPress={stopRecording}
                    >
                      <View style={styles.stopRecordingButton} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.captureButton}
                      onPress={capturePhoto}
                    >
                      <View style={styles.captureButtonInner} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.videoButton, { marginLeft: 20 }]}
                      onPress={startRecording}
                    >
                      <Ionicons name="videocam" size={30} color="white" />
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <TouchableOpacity
                style={styles.cameraButton}
                onPress={toggleCameraType}
              >
                <Ionicons name="camera-reverse" size={30} color="white" />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      );
    }
  };

  if (cameraVisible) {
    return renderCameraView();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
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
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#1DA1F2" />
            ) : (
              <Text style={styles.postButton}>
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

          {media.length > 0 && (
            <View style={styles.mediaContainer}>
              {media.map((item, index) => (
                <View key={index} style={styles.mediaItem}>
                  {item.type === 'video' ? (
                    <View style={styles.videoThumbnail}>
                      <Ionicons name="videocam" size={40} color="#fff" />
                      <Text style={styles.videoLabel}>Video</Text>
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
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={24} color="#1DA1F2" />
              <Text style={styles.mediaButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 500,
    width: "100%",
    alignSelf: 'center'
  },
  cameraContainer: {
    flex: 1,
    zIndex: 9999,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
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
  content: {
    padding: 16,
    paddingBottom: 80,
  },
  captionInput: {
    fontSize: 18,
    color: 'black',
    minHeight: 100,
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
});