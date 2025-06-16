import { View, Text, Pressable, StyleSheet, Button, ActivityIndicator, ScrollView, FlatList, Image, TouchableOpacity } from "react-native";
import { Link, router, Stack } from 'expo-router';
import { useState, useEffect } from "react";
import AuthContext from "@/context/AuthContext";
import { logout } from "@/services/AuthService";
import { useContext } from "react";
import LoginScreen from "../LoginScreen";
import PostListItem from '@/components/PostListItem';
import { Alert } from 'react-native';
import FloatingActionButton from '@/components/FloatingActionButton';
import getApiBaseImage from "@/services/getApiBaseImage";
import { fetchPosts, bookmarkPost, repostPost, sharePost, commentOnPost, reactToPost } from "@/services/PostService";
import CreatePost from "@/components/CreatePost";
import { Ionicons } from "@expo/vector-icons";
import ProfilePreview from "@/components/ProfilePreview";
import AddStory from "@/components/AddStory";
import { fetchStories, createStory } from "@/services/StoryService";
import { useRouter } from 'expo-router';
import { useProfileView } from "@/context/ProfileViewContext";

type StoryGroup = {
  user: {
    id: number;
    name: string;
    profile_photo: string;
  };
  stories: Array<{
    id: number;
    media_path: string;
    viewed: boolean;
  }>;
  all_viewed: boolean;
  latest_story: {
    id: number;
    media_path: string;
  };
};

const HomePage = () => {
    const { user, setUser } = useContext(AuthContext);
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    // const [profilePreviewVisible, setProfilePreviewVisible] = useState(false);
    const { profileViewUserId, setProfileViewUserId, profilePreviewVisible, setProfilePreviewVisible } = useProfileView();

    const [addStoryVisible, setAddStoryVisible] = useState(false);
    const [stories, setStories] = useState([]);
    const router = useRouter();
    const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
    // const [profileViewUserId, setProfileViewUserId] = useState(null);

    const handleLogout = async () => {
      try {
          await logout();
          setUser(null);
          if (!user || (user === null)) {
            router.replace('/LoginScreen');
          }
      } catch (error) {
          console.error("Logout failed:", error);
          setUser(null);
      }
    };

    const fetchPostsAndHandleState = async () => {
        try {
            setLoading(true);
            const postsData = await fetchPosts();
            setPosts(postsData);
            console.log(postsData);
        } catch (error) {
            Alert.alert('Error', 'Something went wrong while fetching posts');
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRepost = async (postId: number) => {
      try {
        const response = await repostPost(postId);
        
        setPosts(prevPosts => 
          prevPosts.map(post => {
            if (post.id === postId) {
              // Update repost status and count
              const updatedPost = {
                ...post,
                is_reposted: response.reposted,
                reposts_count: response.reposts_count
              };
              
              // If this was a new repost, add to reposts array
              if (response.reposted && response.repost_user) {
                updatedPost.reposts = [
                  {
                    id: Date.now(), // temporary ID
                    user: response.repost_user,
                    created_at: new Date().toISOString()
                  },
                  ...(post.reposts || [])
                ];
              } else if (!response.reposted) {
                // If repost was removed, filter out current user's repost
                updatedPost.reposts = (post.reposts || []).filter(
                  repost => repost.user.id !== user?.id
                );
              }
              
              return updatedPost;
            }
            return post;
          })
        );
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

    useEffect(() => {
        if (user) {
            fetchPostsAndHandleState();
            fetchStoriesAndHandleState();
        }
    }, [user]);

    //ProfilePreview and Stories
    const handleProfilePreview = () => {
      setProfilePreviewVisible(true);
    };

    const handleAddStory = () => {
      setAddStoryVisible(true);
    };

    const fetchStoriesAndHandleState = async () => {
      try {
        const data = await fetchStories();
        setStoryGroups(data);
        console.log( 'all stories: ',data);

      } catch (error) {
        console.error('Error fetching stories:', error);
      }
    };

    //END ProfilePreview and Stories

    useEffect(() => {
      if (user === undefined) return; // still loading, don't redirect
      if (user === null) {
        router.replace('/LoginScreen');
      }
    }, [user]);


  useEffect(() => {
    const loadStories = async () => {
      try {
        const data = await fetchStories();
        setStories(data);
      } catch (error) {
        console.error('Error loading stories:', error);
      }
    };

    loadStories();
  }, []);

  const handleProfilePress = (userId: string) => {
    setProfileViewUserId(userId);
    setProfilePreviewVisible(true);
  };

    if (!user) {
      return (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      );
    }

    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    const renderProfilePhoto = () => {
      return (
        <TouchableOpacity onPress={() => handleProfilePress(user.id)}>
          {user?.profile_photo ? (
            <Image 
              source={{ uri: `${getApiBaseImage()}/storage/${user.profile_photo}` }}
              style={styles.profilePhoto}
            />
          ) : (
            <View style={styles.initialsContainer}>
              <Text style={styles.initials}>
                {user?.name?.charAt(0)}{user?.last_name?.charAt(0)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    };

    return (
      <AuthContext.Provider value={{ user, setUser }}>
        <View style={styles.container}>
          {/* Header with welcome message and logout button */}
          <View style={styles.header}>

            {/* <View style={styles.profilePhoto}>
              <TouchableOpacity onPress={() => handleProfilePreview()}>
                <View style={styles.photoContainer}>
                  {renderProfilePhoto()}
                  <View style={styles.addIconContainer}>
                    <Ionicons name="add" size={10} color="white" onPress={() => handleAddStory()} />
                  </View>
                </View>
              </TouchableOpacity>
            </View> */}

            {storyGroups.length >= 0 && (
              <View style={styles.storiesContainer}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 10 }}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    snapToInterval={80} // Or width of story item including margin
                    overScrollMode="never"
                >
                  {/* My Story (Add new) */}
                  <TouchableOpacity 
                    style={styles.storyItem}
                    onPress={() => handleProfilePress(user.id)}
                  >
                    <View style={styles.myStoryCircle}>
                      {renderProfilePhoto()}
                      <View style={styles.addStoryIcon}>
                        <Ionicons name="add" size={16} color="white" 
                            onPress={(e) => {
                              e.stopPropagation(); // Prevent triggering both handlers
                              handleAddStory();
                            }} 
                        />
                      </View>
                    </View>
                    <Text style={styles.storyUsername} onPress={handleAddStory}>Your Story</Text>
                  </TouchableOpacity>
                  
                  {/* Other users' stories */}
                  {storyGroups.map((group) => (
                    <TouchableOpacity 
                      key={group.user.id}
                      style={styles.storyItem}
                      onPress={() => router.push({
                        pathname: '/story/[id]',
                        params: { id: group.latest_story.id }
                      })}
                    >
                      <View style={[
                        styles.storyBorder,
                        group.all_viewed && styles.viewedStoryBorder
                      ]}>
                        <Image 
                          source={{ uri: `${getApiBaseImage()}/storage/${group.user.profile_photo}` }}
                          style={styles.storyImage}
                        />
                        {!group.all_viewed && (
                          <View style={styles.unseenBadge} />
                        )}
                      </View>
                      <Text style={styles.storyUsername}>
                        {group.user.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Button title="Logout" onPress={handleLogout} />
          </View>

          {/* Feed content */}
          <FlatList
            data={posts}
            renderItem={({ item }) => (
              <View style={styles.postContainer}>
                <PostListItem 
                  post={item} 
                  onReact={reactToPost} 
                  onCommentSubmit={commentOnPost}
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
            router.setParams({ postId: null }); // Clear any edit params
            setIsCreateModalVisible(true);
          }} />

        {/* Pop-Ups below */}
        </View>
          <CreatePost
            visible={isCreateModalVisible}
            onClose={() => setIsCreateModalVisible(false)}
            onPostCreated={fetchPostsAndHandleState}
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 5,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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

});

export default HomePage;