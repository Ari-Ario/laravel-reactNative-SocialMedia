// app/(tabs)/index.tsx
import { View, Text, Pressable, StyleSheet, Button, ActivityIndicator, ScrollView, FlatList, Image, TouchableOpacity, Alert } from "react-native";
import { Link, router, Stack, useRouter } from 'expo-router';
import { useState, useEffect, useContext } from "react";
import AuthContext from "@/context/AuthContext";
import LoginScreen from "../LoginScreen";
import PostListItem from '@/components/PostListItem';
import FloatingActionButton from '@/components/FloatingActionButton';
import getApiBaseImage from "@/services/getApiBaseImage";
import { fetchPosts, bookmarkPost, repostPost, sharePost, commentOnPost, reactToPost, updatePost } from "@/services/PostService";
import CreatePost from "@/components/CreatePost";
import { Ionicons } from "@expo/vector-icons";
import ProfilePreview from "@/components/ProfilePreview";
import AddStory from "@/components/AddStory";
import { fetchStories } from "@/services/StoryService";
import { useProfileView } from "@/context/ProfileViewContext";
import { usePostStore } from "@/stores/postStore"; // ✅ Zustand store
import { useNotificationStore } from '@/stores/notificationStore'; // NEW
import { usePostListService } from "@/services/PostListService";
import { getToken } from "@/services/TokenService";
import PusherService from "@/services/PusherService";
import { NotificationPanel } from "@/components/Notifications/NotificationPanel";
import FollowersPanel from "@/components/Notifications/FollowersPanel";

type StoryGroup = {
  user: {
    id: number;
    name: string;
    profile_photo: string;
  };
  stories: Array<{ id: number; media_path: string; viewed: boolean }>;
  all_viewed: boolean;
  latest_story: { id: number; media_path: string };
};

const HomePage = () => {
  const { user, setUser } = useContext(AuthContext);
  const router = useRouter();
  const { profileViewUserId, setProfileViewUserId, profilePreviewVisible, setProfilePreviewVisible } = useProfileView();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [addStoryVisible, setAddStoryVisible] = useState(false);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const { posts, setPosts } = usePostStore();
  const [isTokenReady, setIsTokenReady] = useState(false);
  const { 
    isNotificationPanelVisible, 
    setNotificationPanelVisible,
    isFollowersPanelVisible,
    setIsFollowersPanelVisible,
    unreadCount,
    unreadFollowerCount ,
    initializeRealtime,
    disconnectRealtime,
    addNotification,
    setCurrentUserId
  } = useNotificationStore();

  // ✅ FIX: Simplified real-time initialization
  useEffect(() => {
    let isMounted = true;

    const initializeRealTimeSystems = async () => {
      try {
        const token = await getToken();
        if (token && user?.id && isMounted) {
          setIsTokenReady(true);
          
          console.log('🔐 Initializing real-time systems for user:', user.id);
          
          // Set user ID first
          setCurrentUserId(user.id);
          
          // Initialize notification real-time
          const success = initializeRealtime(token, user.id);
          
          if (success) {
            console.log('✅ Notification real-time initialized successfully');
          } else {
            console.warn('⚠️ Notification real-time initialization failed');
          }
        } else {
          console.warn('⚠️ No token or user ID available for real-time updates');
          setIsTokenReady(true);
        }
      } catch (error) {
        console.error('❌ Real-time initialization error:', error);
        setIsTokenReady(true);
      }
    };

    // ✅ FIX: Add delay to avoid conflicts with TabLayout initialization
    const timer = setTimeout(() => {
      initializeRealTimeSystems();
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      console.log('🧹 Cleaning up real-time systems');
      disconnectRealtime();
    };
  }, [user?.id]);

  // Subscribe to posts only when token is ready and posts exist
  useEffect(() => {
    if (isTokenReady && posts.length > 0) {
      console.log('🏠 Setting up real-time subscriptions for', posts.length, 'posts');
      
      const postIds = posts.map(post => post.id);
      usePostStore.getState().subscribeToPosts(postIds);
      
      return () => {
        console.log('🏠 Cleaning up post subscriptions');
        usePostStore.getState().unsubscribeFromAllPosts();
      };
    }
  }, [posts.length, isTokenReady]);

  // Make sure your handlers are properly connected:


  // Load posts when component mounts
  useEffect(() => {
    const loadPosts = async () => {
      try {
        const postsData = await fetchPosts();
        setPosts(postsData);
      } catch (error) {
        console.error('Error loading posts:', error);
      }
    };

    if (user) {
      loadPosts();
    }
  }, [user]);


  //////////////////////////////////

  const fetchPostsAndHandleState = async () => {
    try {
      setLoading(true);
      const postsData = await fetchPosts();
      setPosts(postsData); // ✅ Zustand
      
      console.log(posts);
    } catch (error) {
      Alert.alert('Error', 'Something went wrong while fetching posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRepost = async (postId: number) => {
    try {
      const response = await repostPost(postId);
      updatePost((prev) => {
        if (prev.id !== postId) return prev;
        const updated = {
          ...prev,
          is_reposted: response.reposted,
          reposts_count: response.reposts_count,
          reposts: response.reposted
            ? [{ id: Date.now(), user: response.repost_user, created_at: new Date().toISOString() }, ...(prev.reposts || [])]
            : (prev.reposts || []).filter(r => r.user.id !== user?.id)
        };
        return updated;
      });
    } catch (error) {
      console.error('Error handling repost:', error);
      Alert.alert('Error', 'Could not complete repost action');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPostsAndHandleState();
    fetchStoriesAndHandleState();
  };

  // In parent component (FeedScreen/ProfileScreen)
const handleCommentSubmit = async (postId: number, content: string, parentId?: number) => {
  try {
    // Directly return the comment from your PostService
    return await commentOnPost(postId, content, parentId);
  } catch (error) {
    console.error('Comment submission failed:', error);
    throw error;
  }
};

  useEffect(() => {
    if (user) {
      fetchPostsAndHandleState();
      fetchStoriesAndHandleState();
    }
  }, [user]);

  const fetchStoriesAndHandleState = async () => {
    try {
      const data = await fetchStories();
      setStoryGroups(data);
      // console.log('storyGroups is: ' ,storyGroups);
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  // useEffect(() => {
  //   if (user === undefined) return;
  //   if (user === null) router.replace('/LoginScreen');
  // }, [user]);

  const handleProfilePress = (userId: string) => {
    setProfileViewUserId(userId);
    setProfilePreviewVisible(true);
  };

  const renderProfilePhoto = () => (
    <TouchableOpacity onPress={() => handleProfilePress(user.id)}>
      {user?.profile_photo ? (
        <Image source={{ uri: `${getApiBaseImage()}/storage/${user.profile_photo}` }} style={styles.profilePhoto} />
      ) : (
        <View style={styles.initialsContainer}>
          <Text style={styles.initials}>{user?.name?.charAt(0)}{user?.last_name?.charAt(0)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (!user) return <><Stack.Screen name="Login" component={LoginScreen} /></>;
  if (loading && !refreshing) return <View style={styles.loadingContainer}><ActivityIndicator size="large" /></View>;

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <View style={styles.container}>
        {/* ADD NOTIFICATION PANEL */}
        <NotificationPanel
          visible={isNotificationPanelVisible}
          onClose={() => setNotificationPanelVisible(false)}
        />
        <FollowersPanel
          visible={isFollowersPanelVisible}
          onClose={() => setIsFollowersPanelVisible(false)}
        />

        {/* Your existing header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Home</Text>

            <View style={styles.headerIcons}>
              {/* Regular Notifications Icon */}
              <TouchableOpacity 
                style={styles.notificationBell}
                onPress={() => {
                  console.log('🔔 Opening notification panel, unread count:', unreadCount);
                  setNotificationPanelVisible(true);
                }}
              >
                <Ionicons name="notifications-outline" size={24} color="#000" />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Followers Icon */}
              <TouchableOpacity 
                style={styles.notificationBell}
                onPress={() => {
                  console.log('👥 Opening followers panel, unread count:', unreadFollowerCount);
                  setIsFollowersPanelVisible(true);
                }}
              >
                <Ionicons name="people-outline" size={24} color="#000" />
                {unreadFollowerCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadFollowerCount > 99 ? '99+' : unreadFollowerCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Other icons... */}
            </View>

          </View>
        </View>

        <View style={styles.headerScrollContainer}>
          <View style={styles.header}>
            {storyGroups.length >= 0 && (
              <View style={styles.storiesContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }} snapToAlignment="start" decelerationRate="fast" snapToInterval={80}>
                  <TouchableOpacity style={styles.storyItem} onPress={() => handleProfilePress(user.id)}>
                    <View style={styles.myStoryCircle}>
                      {renderProfilePhoto()}
                      <View style={styles.addStoryIcon}>
                        <Ionicons name="add" size={16} color="white" onPress={(e) => { e.stopPropagation(); setAddStoryVisible(true); }} />
                      </View>
                    </View>
                    <Text style={styles.storyUsername} onPress={() => setAddStoryVisible(true)}>Your Story</Text>
                  </TouchableOpacity>
                  {storyGroups.map(group => (
                    <TouchableOpacity key={group.user.id} style={styles.storyItem} onPress={() => router.push({ pathname: '/story/[id]', params: { id: group.latest_story.id } })}>
                      <View style={[styles.storyBorder, group.all_viewed && styles.viewedStoryBorder]}>
                        <Image source={{ uri: `${getApiBaseImage()}/storage/${group.user.profile_photo}` }} style={styles.storyImage} />
                        {!group.all_viewed && <View style={styles.unseenBadge} />}
                      </View>
                      <Text style={styles.storyUsername}>{group.user.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {/* <Button title="Logout" onPress={handleLogout} /> */}
          </View>

        </View>
        
          <FlatList
            data={posts}
            renderItem={({ item }) => (
              <View style={styles.postContainer}>
                <PostListItem
                  post={item}
                  onReact={reactToPost}
                  onCommentSubmit={handleCommentSubmit}
                  onRepost={handleRepost}
                  onShare={sharePost}
                  onBookmark={bookmarkPost}
                  setIsCreateModalVisible={setIsCreateModalVisible}
                />
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            keyExtractor={(item) => item.id.toString()}
          />

        <FloatingActionButton onPress={() => {
          router.setParams({ postId: null });
          setIsCreateModalVisible(true);
        }} />
      </View>

      {/* Your existing modals */}
      <CreatePost
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onPostCreated={(post) => {
          if (post?.id) {
            // Handle post creation
          } else {
            fetchPostsAndHandleState();
          }
        }}
      />

      <ProfilePreview
        userId={profileViewUserId}
        visible={profilePreviewVisible}
        onClose={() => setProfilePreviewVisible(false)}
      />

      <AddStory
        visible={addStoryVisible}
        onClose={() => setAddStoryVisible(false)}
        onStoryCreated={fetchStoriesAndHandleState}
      />
    </AuthContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 1024,
    alignSelf: 'center',
  },
  headerScrollContainer: {
    position: 'sticky',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  header: {
    width: '100%',
    // maxWidth: 500,
    alignSelf: 'center',
    padding: 5,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 0,
    display: 'flex',
  },
  profilePhoto: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: 60,
    height: 60,
    borderRadius: 60,
    backgroundColor: '#e1e1e1',
  },
  userName: {
    paddingLeft: 10,
  },
  initials: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#555',
  },
  initialsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#25D366',
    borderRadius: 20,
    padding: 5,
  },
  listContent: {
    gap: 10,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  postContainer: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
storiesContainer: {
    // paddingVertical: 10,
    // borderBottomWidth: 1,
    // borderBottomColor: '#eee',
  },
  myStoryCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  storyBorder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#3897f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  viewedStoryBorder: {
    borderColor: '#999',
  },
  storyImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  storyUsername: {
    marginTop: 5,
    fontSize: 12,
    maxWidth: 70,
    textAlign: 'center',
  },
  addStoryIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3897f0',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  unseenBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3897f0',
    borderWidth: 2,
    borderColor: 'white',
  },
  viewedStoryBorder: {
    borderColor: '#999',
  },


  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationBell: {
    marginLeft: 15,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Add to your styles
testButton: {
  backgroundColor: '#007AFF',
  padding: 10,
  borderRadius: 5,
  margin: 10,
  alignItems: 'center'
},
testButtonText: {
  color: 'white',
  fontWeight: 'bold'
}
});

export default HomePage;
