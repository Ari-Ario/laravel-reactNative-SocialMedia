import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Modal, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useContext } from 'react';
import { fetchProfile, followUser, updateProfile } from '@/services/UserService';
import { Ionicons } from '@expo/vector-icons';
import PostListItem from './PostListItem';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useProfileView } from '@/context/ProfileViewContext';
import { useModal } from '@/context/ModalContext';
import { usePostStore } from '@/stores/postStore';
import AuthContext from '@/context/AuthContext';
import { usePostListService } from '@/services/PostListService';
import { commentOnPost } from '@/services/PostService';
import { useToastStore } from '@/stores/toastStore';
import ReportPost from './ReportPost';

interface ProfilePreviewProps {
  userId: string;
  visible: boolean;
  onClose: () => void;
}

const ProfilePreview = ({ userId, visible, onClose }: ProfilePreviewProps) => {
  const { openModal } = useModal();
  const { profilePreviewVisible, setProfilePreviewVisible } = useProfileView();
  const { showToast } = useToastStore();
  const { user } = useContext(AuthContext);
  const service = usePostListService(user);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const { posts, setPosts } = usePostStore();
  const originalPostsRef = useRef(posts);

  const userPosts = posts;

  useEffect(() => {
    if (visible && userId) {
      // Save current posts
      originalPostsRef.current = posts;
      // Fetch the profile and replace posts
      handleFetchProfile();
    }

    // When visible becomes false, restore original posts
    if (!visible && originalPostsRef.current) {
      setPosts(originalPostsRef.current);
    }
  }, [visible, userId]);

  const handleFetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetchProfile(userId);

      // Assuming the API returns data in a 'data' property
      // Adjust according to your actual API response structure
      const profileData = response.data || response;

      setProfile(profileData.user);
      setIsFollowing(profileData.user.is_following);
      // console.log(profileData);

      // Put profile posts into usePostStore
      setPosts(profileData.posts?.data || []);

    } catch (error) {
      console.error('Error fetching profile:', error);
      // Optionally show error to user
      showToast('Failed to load profile', 'error');
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
      // console.log(updatedData);

      setIsFollowing(!isFollowing); // Toggle the follow state
      setProfile((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          followers_count: isFollowing
            ? (prev.followers_count || 0) - 1
            : (prev.followers_count || 0) + 1,
        };
      });

      showToast(isFollowing ? 'Unfollowed successfully' : 'Followed successfully', 'success');
    } catch (error) {
      console.error('Error following user:', error);
      showToast('Failed to update follow status', 'error');
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
    >
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.topHeader}>
          {user?.id !== String(userId) && (
            <TouchableOpacity style={styles.reportButton} onPress={() => setShowReportModal(true)}>
              <Ionicons name="flag-outline" size={22} color="#FF3B30" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="black" />
          </TouchableOpacity>
        </View>

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
                  onReact={() => { }}
                  onCommentSubmit={commentOnPost}
                  onRepost={() => { }}
                  onShare={() => { }}
                  onBookmark={() => { }}
                  onReactComment={() => { }}
                />
              )}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.postsList}
            />
          </>
        )}
      </SafeAreaView>

      <ReportPost
        visible={showReportModal}
        userId={Number(userId)}
        type="user"
        onClose={() => setShowReportModal(false)}
        onReportSubmitted={(reportId) => {
          showToast('Report submitted for AI review.', 'success');
          setShowReportModal(false);
        }}
      />
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
    maxWidth: 1024,
    alignSelf: 'center',
  },
  closeButton: {
    padding: 4,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportButton: {
    padding: 4,
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