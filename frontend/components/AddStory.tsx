import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Alert, Modal, ActivityIndicator, Platform } from 'react-native';
import { useState, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createStory } from '@/services/StoryService';
import getApiBaseImage from '@/services/getApiBaseImage';

const AddStory = ({ visible, onClose, onStoryCreated }) => {
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'We need access to your photos');
      return;
    }

    let result;

    if (Platform.OS === 'web') {
      // Web implementation
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setImage(event.target.result);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
      return;
    } else {
      // Mobile implementation
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 1,
      });
    }

    if (!result?.canceled) {
      setImage(Platform.OS === 'web' ? result : result.assets[0].uri);
    }
  };

  const handleCreateStory = async () => {
    if (!image) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();

      // Handle file differently for web vs native
      if (Platform.OS === 'web') {
        // For web platform
        const response = await fetch(image);
        const blob = await response.blob();
        const file = new File([blob], 'story.jpg', {
          type: 'image/jpeg',
        });
        formData.append('media', file);
      } else {
        // For mobile platforms
        formData.append('media', {
          uri: image,
          name: 'story.jpg',
          type: 'image/jpeg',
        });
      }

      formData.append('caption', caption);

      await createStory(formData);
      onStoryCreated();
      onClose();
      setImage(null);
      setCaption('');
    } catch (error) {
      console.error('Error creating story:', error);
      Alert.alert('Error', 'Failed to create story');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} onDismiss={onClose} contentContainerStyle={styles.modal}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="black" />
          </TouchableOpacity>
          <Text style={styles.title}>New Story</Text>
          <TouchableOpacity onPress={handleCreateStory} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color="#0084ff" />
            ) : (
              <Text style={styles.shareText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="camera" size={50} color="#ccc" />
              <Text style={styles.placeholderText}>Select an image</Text>
            </View>
          )}
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.captionInput}
          placeholder="Add a caption..."
          placeholderTextColor="#999"
          value={caption}
          onChangeText={setCaption}
          multiline
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    backgroundColor: 'white',
    padding: 0,
    margin: 0,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 1024,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  shareText: {
    color: '#0084ff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  imagePicker: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  placeholder: {
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 10,
    color: '#999',
    fontSize: 16,
  },
  captionInput: {
    padding: 15,
    fontSize: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
});

export default AddStory;