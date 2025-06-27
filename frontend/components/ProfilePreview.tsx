import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Modal, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { fetchProfile, followUser, updateProfile } from '@/services/UserService';
import { Ionicons } from '@expo/vector-icons';
import PostListItem from './PostListItem';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useProfileView } from '@/context/ProfileViewContext';
import { useModal } from '@/context/ModalContext';
import { usePostStore } from '@/stores/postStore';

const ProfilePreview = ({ userId, visible, onClose }) => {
  const { openModal } = useModal();
  const { profilePreviewVisible, setProfilePreviewVisible } = useProfileView();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const { posts } = usePostStore();
  const userPosts = posts.filter(p => p.user.id === userId);

  useEffect(() => {
    if (visible && userId) {
      handleFetchProfile();
    }
  }, [visible, userId]);

  const handleFetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetchProfile(userId);
      
      // Assuming the API returns data in a 'data' property
      // Adjust according to your actual API response structure
      const profileData = response.data || response;
      
      setProfile(profileData);
      setIsFollowing(profileData.is_following);
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Optionally show error to user
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    try {
      setFollowLoading(true);
      const action = isFollowing ? 'unfollow' : 'follow';
      const response = await followUser(userId, action);
      
      // Assuming the API returns updated data
      const updatedData = response.data || response;
      console.log(updatedData);
      
      setIsFollowing(!isFollowing); // Toggle the follow state
      setProfile(prev => ({
        ...prev,
        followers_count: isFollowing 
          ? prev.followers_count - 1 
          : prev.followers_count + 1,
      }));
      
      // Optional: Show success feedback
      // Toast.show(isFollowing ? 'Unfollowed successfully' : 'Followed successfully');
    } catch (error) {
      console.error('Error following user:', error);
      // Optionally show error to user
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  

  const renderProfilePhoto = () => {
    if (profile?.profile_photo) {
      return (
        <Image 
          source={{ uri: `${getApiBaseImage()}/storage/${profile.profile_photo}` }}
          style={styles.profilePhoto}
        />
      );
    } else {
      const initials = `${profile?.name?.charAt(0) || ''}${profile?.last_name?.charAt(0) || ''}`;
      return (
        <View style={[styles.profilePhoto, styles.initialsContainer]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      );
    }
  };

  if (!visible || !profile) return null;

  return (
    <Modal onDismiss={onClose} 
      visible={profilePreviewVisible}
      onRequestClose={() => setProfilePreviewVisible(false)}
      contentContainerStyle={styles.modal}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="black" />
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : (
          <>
            <View style={styles.profileHeader}>
              {renderProfilePhoto()}
              
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{profile.posts_count}</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{profile.followers_count}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{profile.following_count}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
              </View>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.name}>{profile.name} {profile.last_name}</Text>
              {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
            </View>

            <TouchableOpacity 
              style={[
                styles.followButton,
                isFollowing && styles.followingButton
              ]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? 'black' : 'white'} />
              ) : (
                <Text style={[
                  styles.followButtonText,
                  isFollowing && styles.followingButtonText
                ]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>

            <FlatList
              data={userPosts}
              renderItem={({ item }) => (
                <PostListItem 
                  post={item} 
                  onReact={() => {}} 
                  onCommentSubmit={() => {}} 
                  onRepost={() => {}} 
                  onShare={() => {}} 
                  onBookmark={() => {}} 
                />
              )}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.postsList}
            />
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    backgroundColor: 'white',
    padding: 0,
    margin: 20,
    borderRadius: 10,
    maxHeight: '90%',
  },
  container: {
    flex: 1,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 20,
  },
  initialsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e1e1e1',
  },
  initials: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#555',
  },
  statsContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  profileInfo: {
    marginBottom: 20,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 5,
  },
  bio: {
    fontSize: 14,
    color: '#333',
  },
  followButton: {
    backgroundColor: '#3897f0',
    paddingVertical: 8,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  followingButton: {
    backgroundColor: '#efefef',
  },
  followButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  followingButtonText: {
    color: 'black',
  },
  postsList: {
    paddingBottom: 20,
  },
});

export default ProfilePreview;