import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
// import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import CollaborationService from '@/services/ChatScreen/CollaborationService';

interface MediaUploaderProps {
  spaceId: string;
  isVisible: boolean;
  onClose: () => void;
  onUploadComplete?: (media: any) => void;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({
  spaceId,
  isVisible,
  onClose,
  onUploadComplete,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const collaborationService = CollaborationService.getInstance();

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Need camera roll access to upload images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        await uploadFile(result.assets[0].uri, 'image', result.assets[0].mimeType);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Need camera access to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        await uploadFile(result.assets[0].uri, 'image', result.assets[0].mimeType);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await uploadFile(asset.uri, 'document', asset.mimeType, asset.name);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadFile = async (uri: string, type: string, mimeType?: string, fileName?: string) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Create FormData
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: mimeType || 'image/jpeg',
        name: fileName || `upload-${Date.now()}.jpg`,
      } as any);
      formData.append('type', type);
      
      // Upload to backend
      const response = await fetch(`${collaborationService.baseURL}/spaces/${spaceId}/upload-media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${collaborationService.userToken}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'File uploaded successfully');
      
      if (onUploadComplete) {
        onUploadComplete(data.media);
      }
      
      onClose();
      
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload file');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const uploadOptions = [
    {
      id: 'photo',
      icon: 'images',
      title: 'Photo from Library',
      color: '#4CAF50',
      onPress: pickImage,
    },
    {
      id: 'camera',
      icon: 'camera',
      title: 'Take Photo',
      color: '#2196F3',
      onPress: takePhoto,
    },
    {
      id: 'document',
      icon: 'document',
      title: 'Document',
      color: '#FF9800',
      onPress: pickDocument,
    },
    {
      id: 'video',
      icon: 'videocam',
      title: 'Video',
      color: '#9C27B0',
      onPress: () => Alert.alert('Coming Soon', 'Video upload coming soon'),
    },
    {
      id: 'audio',
      icon: 'mic',
      title: 'Audio Recording',
      color: '#3F51B5',
      onPress: () => Alert.alert('Coming Soon', 'Audio recording coming soon'),
    },
    {
      id: 'link',
      icon: 'link',
      title: 'Share Link',
      color: '#00BCD4',
      onPress: () => Alert.alert('Coming Soon', 'Link sharing coming soon'),
    },
  ];

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Upload Media</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.optionsContainer}>
            {uploading ? (
              <View style={styles.uploadingContainer}>
                <Ionicons name="cloud-upload" size={48} color="#007AFF" />
                <Text style={styles.uploadingText}>Uploading... {Math.round(uploadProgress)}%</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      { width: `${uploadProgress}%` }
                    ]} 
                  />
                </View>
              </View>
            ) : (
              uploadOptions.map(option => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.optionButton}
                  onPress={option.onPress}
                >
                  <View style={[styles.optionIcon, { backgroundColor: option.color }]}>
                    <Ionicons name={option.icon as any} size={24} color="#fff" />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.optionDescription}>
                      {option.id === 'photo' && 'Select from your photo library'}
                      {option.id === 'camera' && 'Take a new photo'}
                      {option.id === 'document' && 'Upload PDF, Word, etc.'}
                      {option.id === 'video' && 'Upload video file'}
                      {option.id === 'audio' && 'Record or upload audio'}
                      {option.id === 'link' && 'Share web link'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  contentContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  optionsContainer: {
    padding: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
  },
  uploadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  uploadingText: {
    fontSize: 16,
    color: '#333',
    marginTop: 16,
    marginBottom: 24,
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
});

export default MediaUploader;