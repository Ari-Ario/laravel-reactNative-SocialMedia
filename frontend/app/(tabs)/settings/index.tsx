import { useState, useRef, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  Text, 
  TextInput,
  FlatList, 
  TouchableOpacity, 
  StyleSheet,
  Image,
  Modal,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BoxedIcon from '@/components/BoxedIcon';
import Colors from '@/constants/Colors';
import AuthContext from "@/context/AuthContext";
import { logout } from "@/services/AuthService";
import { useContext } from "react";
import { uploadProfilePhoto, deleteProfilePhoto, requestCameraPermission, updateUserName } from '@/services/SettingService';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CameraType } from 'expo-camera';
import getApiBaseImage from '@/services/getApiBaseImage';
import { loadUser } from '@/services/AuthService';
import { router } from 'expo-router';

const Page = () => {
  const { user, setUser } = useContext(AuthContext);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  // const [cameraType, setCameraType] = useState<CameraType>(CameraType.back);
  const [cameraType, setCameraType] = useState<CameraType>(CameraType?.back || CameraType?.front);
  const cameraRef = useRef<Camera>(null);
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);


  const devices = [
    { name: 'Broadcast Lists', icon: 'megaphone', backgroundColor: '#25D366' }, // WhatsApp Green
    { name: 'Starred Messages', icon: 'star', backgroundColor: '#FFD700' },     // Gold
    { name: 'Linked Devices', icon: 'laptop-outline', backgroundColor: '#25D366' },
  ];

  const items = [
    { name: 'Account', icon: 'key', backgroundColor: '#075E54' },               // WhatsApp Dark Green
    { name: 'Privacy', icon: 'lock-closed', backgroundColor: '#33A5D1' },
    { name: 'Chats', icon: 'logo-whatsapp', backgroundColor: '#25D366' },
    { name: 'Notifications', icon: 'notifications', backgroundColor: '#FF3B30' }, // iOS red
    { name: 'Storage and Data', icon: 'repeat', backgroundColor: '#25D366' },
  ];

  const support = [
    { name: 'Help', icon: 'information', backgroundColor: '#075E54' },
    { name: 'Tell a Friend', icon: 'heart', backgroundColor: '#FF3B30' },
  ];


  const handleLogout = async () => {
    try {
        await logout();
        setUser(null); // This will trigger the redirect in the effect below
        if (!user || (user === null)) {
          router.replace('/LoginScreen');
        }
    } catch (error) {
        console.error("Logout failed:", error);
        setUser(null); // Ensure logout even if API fails
    }
  };

  const renderListItem = ({ item }: any) => (
    <View style={styles.item}>
      <BoxedIcon name={item.icon} backgroundColor={item.backgroundColor} />
      <Text style={styles.itemText}>{item.name}</Text>
      <Ionicons name="chevron-forward" size={20} color={'grey'} />
    </View>
  );

  const handleChoosePhoto = async () => {
    setShowPhotoOptions(false);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'We need access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      try {
        await uploadProfilePhoto(result.assets[0].uri);
        // refresh user profile UI if needed
        const refreshedUser = await loadUser();
        setUser(refreshedUser);
      } catch (error) {
        console.error('Profile upload error:', error);
        Alert.alert('Upload Failed', 'Please try again.');
      }
    }
  };


  const handleTakePhoto = async () => {
    setShowPhotoOptions(false);
    const permission = await requestCameraPermission();
    
    if (!permission) {
      Alert.alert('Permission required', 'We need access to your camera');
      return;
    }

    setCameraVisible(true);
  };

  const handleCapturePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      setCameraVisible(false);
      await uploadProfilePhoto(photo.uri);
      // Update user context or refetch user data
    }
  };


  const handleDeletePhoto = async () => {
    setShowPhotoOptions(false);

    const confirmDelete = Platform.OS === 'web'
      ? window.confirm("Are you sure you want to delete your profile photo?")
      : await new Promise((resolve) => {
          Alert.alert(
            'Delete Photo',
            'Are you sure you want to delete your profile photo?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmDelete) return;

    try {
      await deleteProfilePhoto();

      if (Platform.OS === 'web') {
        alert('Profile photo deleted successfully');
      } else {
        Alert.alert('Success', 'Profile photo deleted successfully');
      }

      // Refresh user context or re-fetch user data if necessary
      const refreshedUser = await loadUser();
      if (refreshedUser && refreshedUser.id) {
        setTimeout(() => {
          setUser(refreshedUser);
        }, 100);
      }

    } catch (error) {
      console.error('Failed to delete profile photo:', error);
      const errorMessage = error.message || 'An error occurred. Please try again.';

      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  };


  const renderProfilePhoto = () => {
    if (user?.profile_photo) {
      return (
        <Image 
          source={{ uri: `${getApiBaseImage()}/storage/${user.profile_photo}` }}
          style={styles.profilePhoto}
        />
      );
    } else {
      const initials = `${user?.name?.charAt(0) || ''}${user?.last_name?.charAt(0) || ''}`;
      return (
        <View style={[styles.profilePhoto, styles.initialsContainer]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>

      {/* Profile Photo Section */}
      <View style={styles.profileSection}>
        <TouchableOpacity onPress={() => setShowPhotoOptions(true)}>
          <View style={styles.photoContainer}>
            {renderProfilePhoto()}
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={20} color="white" />
            </View>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => {
          setNewName(user?.name || '');
          setEditNameVisible(true);
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 10, }}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Ionicons name="create-outline" size={20} color="black" style={{ paddingLeft: 10, }} />
          </View>
        </TouchableOpacity>

      </View>

      {/* Photo Options Modal */}
      <Modal
        visible={showPhotoOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPhotoOptions(false)}
        >
          <View style={styles.photoOptions}>
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={handleChoosePhoto}
            >
              <Text style={styles.optionText}>Upload from device</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={handleTakePhoto}
            >
              <Text style={styles.optionText}>Take a photo</Text>
            </TouchableOpacity>
            {user?.profile_photo && (
              <TouchableOpacity 
                style={[styles.optionButton, styles.deleteOption]}
                onPress={handleDeletePhoto}
              >
                <Text style={styles.optionText}>Delete photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Change Name Modal */}
      <Modal
        visible={editNameVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setEditNameVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'white' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#ccc' }}>
            <TouchableOpacity onPress={() => setEditNameVisible(false)}>
              <Text style={{ color: '#1DA1F2', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontWeight: 'bold', fontSize: 18 }}>Name</Text>
            <TouchableOpacity
              onPress={async () => {
                setSaving(true);
                try {
                  const response = await updateUserName(newName); // See next step
                  const updated = await loadUser();
                  setUser(updated);
                  setEditNameVisible(false);
                } catch (e) {
                  console.error(e);
                  Alert.alert('Failed', 'Could not update name');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={newName === user?.name || saving}
            >
              <Text style={{
                color: newName === user?.name || saving ? '#ccc' : '#1DA1F2',
                fontWeight: 'bold',
                fontSize: 16
              }}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          {/* Text area */}
          <View style={{ padding: 16 }}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              style={{
                fontSize: 18,
                borderColor: '#ccc',
                borderWidth: 1,
                padding: 12,
                borderRadius: 8,
              }}
              placeholder="Enter your name"
              autoFocus
            />
          </View>
        </View>
      </Modal>


      {/* Camera Modal */}
      {cameraVisible && (
        <View style={StyleSheet.absoluteFill}>
          <Camera 
            style={StyleSheet.absoluteFill}
            type={cameraType}
            ref={cameraRef}
          >
            <View style={styles.cameraControls}>
              <TouchableOpacity 
                style={styles.cameraButton}
                onPress={() => setCameraVisible(false)}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.captureButton}
                onPress={handleCapturePhoto}
              >
                <View style={styles.captureInner} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cameraButton}
                onPress={() => setCameraType(
                  cameraType === CameraType.back ? CameraType.front : CameraType.back
                )}
              >
                <Ionicons name="camera-reverse" size={30} color="white" />
              </TouchableOpacity>
            </View>
          </Camera>
        </View>
      )}

      
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scrollContainer}>
        <View style={styles.block}>
          <FlatList
            data={devices}
            keyExtractor={(item) => item.name}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={renderListItem}
          />
        </View>

        <View style={styles.block}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.name}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={renderListItem}
          />
        </View>

        <View style={styles.block}>
          <FlatList
            data={support}
            keyExtractor={(item) => item.name}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={renderListItem}
          />
        </View>

        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',    
      width: '100%'
      // backgroundColor: Colors.background,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e1e1e1',
  },
  initialsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#555',
  },
  cameraIconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#25D366',
    borderRadius: 20,
    padding: 5,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoOptions: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '80%',
    overflow: 'hidden',
  },
  optionButton: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  deleteOption: {
    borderBottomWidth: 0,
  },
  cameraControls: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    alignItems: 'flex-end',
  },
  cameraButton: {
    alignSelf: 'flex-end',
  },
  captureButton: {
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  scrollContainer: {
    // paddingVertical: 20,
    minWidth: 350,
    width: 500,
    ...(Platform.OS === 'ios' && {
      minWidth: '100%',
      width: 'auto'
    }),
  },
  block: {
    backgroundColor: '#fff',
    marginBottom: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemText: {
    fontSize: 17,
    flex: 1,
    marginLeft: 12,
  },
  logout: {
    color: 'red',
    fontSize: 24,
    textAlign: 'center',
    paddingVertical: 14,
  },
});

export default Page;
