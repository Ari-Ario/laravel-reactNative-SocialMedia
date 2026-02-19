// app/(tabs)/index.tsx
import { View, Text, Pressable, StyleSheet, Button, ActivityIndicator, ScrollView, FlatList, Image, TouchableOpacity, Alert, Platform } from "react-native";
import { Link, router, Stack, useRouter } from 'expo-router';
import { useState, useEffect, useContext } from "react";
import AuthContext from "@/context/AuthContext";
import LoginScreen from "../LoginScreen";
import VerificationScreen from "../VerificationScreen";
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
import CallsPanel from '@/components/Notifications/CallsPanel';
import MessagesPanel from '@/components/Notifications/MessagesPanel';
import SpacesPanel from '@/components/Notifications/SpacesPanel';
import ActivitiesPanel from '@/components/Notifications/ActivitiesPanel';
import RealTimeService from '@/services/ChatScreen/RealTimeServiceChat';
import CollaborationService from '@/services/ChatScreen/CollaborationService';

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
    unreadFollowerCount,
    // Add these new selectors from your store
    unreadCallCount,
    unreadMessageCount,
    unreadSpaceCount,
    unreadActivityCount,
    initializeRealtime,
    disconnectRealtime,
    addNotification,
    setCurrentUserId
  } = useNotificationStore();
  const [activeNotificationType, setActiveNotificationType] = useState<"all" | "regular" | "spaces" | "calls" | "messages" | "activities" | null>(null);
  const realTimeService = RealTimeService.getInstance();
  const collaborationService = CollaborationService.getInstance();

  const [isCallsPanelVisible, setCallsPanelVisible] = useState(false);
  const [isMessagesPanelVisible, setMessagesPanelVisible] = useState(false);
  const [isSpacesPanelVisible, setSpacesPanelVisible] = useState(false);
  const [isActivitiesPanelVisible, setActivitiesPanelVisible] = useState(false);

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

  // ✅ Global space fetch + per-space real-time subscriptions
  useEffect(() => {
    if (!isTokenReady || !user?.id) return;

    let subscribedSpaceIds: string[] = [];

    const setupSpaceSubscriptions = async () => {
      try {
        // ✅ Ensure CollaborationService has the auth token (critical on Android)
        const token = await getToken();
        if (token) {
          await collaborationService.setToken(token);
        }

        console.log('🌐 Fetching all spaces for global subscription...');
        const userSpaces = await collaborationService.fetchUserSpaces(user.id);
        console.log(`🌐 Found ${userSpaces.length} spaces to subscribe to`);

        subscribedSpaceIds = userSpaces.map(s => s.id);

        userSpaces.forEach(space => {
          // ✅ Use collaborationService (not PusherService directly) so callbacks
          // are properly added even when the channel already exists from chats/index.tsx
          collaborationService.subscribeToSpace(space.id, {
            onMessage: (data: any) => {
              // The backend sends the message as an object under data.message or directly
              const msgObj = data?.message || data;

              // Check sender ID from multiple possible locations
              // Use loose equality (==) to handle string vs number ID mismatch
              const senderId = msgObj?.sender_id ?? msgObj?.user_id ?? data?.sender_id ?? data?.user_id;

              if (senderId == user.id) return;

              console.log(`💬 New message in space "${space.title}":`, data);

              // Extract content safely
              const msgText: string =
                typeof msgObj?.content === 'string' ? msgObj.content :
                  typeof data?.content === 'string' ? data.content :
                    typeof msgObj?.text === 'string' ? msgObj.text :
                      'New message received';

              addNotification({
                type: 'new_message',
                title: `New message in ${space.title}`,
                message: msgText,
                userId: senderId, // ✅ Pass at top level for global filtering
                spaceId: space.id, // ✅ Pass at top level
                data: { messageId: msgObj?.id },
                createdAt: new Date(),
              });
            },
            onCallStarted: (data: any) => {
              const callerId = data.caller_id || data.user_id;
              if (callerId == user.id) return;

              console.log(`📞 Call started in space "${space.title}":`, data);
              addNotification({
                type: 'call_started',
                title: `Call started in ${space.title}`,
                message: data.caller_name ? `${data.caller_name} started a call` : 'A call has started',
                userId: Number(callerId), // Ensure number
                spaceId: space.id,
                data: { ...data },
                createdAt: new Date(),
              });
            },
            onCallEnded: (data: any) => {
              console.log(`📵 Call ended in space "${space.title}":`, data);
              addNotification({
                type: 'call_ended',
                title: `Call ended in ${space.title}`,
                message: 'The call has ended',
                userId: data.user_id || data.caller_id, // ✅ Pass at top level
                spaceId: space.id,
                data: { ...data },
                createdAt: new Date(),
              });
            },
            onParticipantUpdate: (data: any) => {
              const participantId = data.user_id || data.id;
              if (participantId == user.id) return;
              // Only notify for join events (not leave/update)
              if (data?.type === 'left') return;

              console.log(`👋 Participant joined space "${space.title}":`, data);
              addNotification({
                type: 'participant_joined',
                title: `Someone joined ${space.title}`,
                message: data.user_name ? `${data.user_name} joined the space` : 'A new participant joined',
                userId: Number(participantId),
                spaceId: space.id,
                data: { ...data },
                createdAt: new Date(),
              });
            },
            onMagicEvent: (data: any) => {
              const triggerId = data.triggered_by || data.user_id;
              if (triggerId == user.id) return;

              console.log(`✨ Magic event in space "${space.title}":`, data);
              addNotification({
                type: 'magic_event',
                title: `Magic event in ${space.title}`,
                message: data.description || 'A magic event occurred',
                userId: Number(triggerId),
                spaceId: space.id,
                data: { ...data },
                createdAt: new Date(),
              });
            },
            onScreenShareStarted: (data: any) => {
              const sharerId = data.user_id || data.id;
              if (sharerId == user.id) return;

              console.log(`🖥️ Screen share started in space "${space.title}":`, data);
              addNotification({
                type: 'screen_share',
                title: `Screen share in ${space.title}`,
                message: data.user_name ? `${data.user_name} is sharing their screen` : 'Screen sharing started',
                userId: Number(sharerId),
                spaceId: space.id,
                data: { ...data },
                createdAt: new Date(),
              });
            },
          });
        });

        // Also subscribe to the global 'spaces' channel for newly created spaces
        PusherService.subscribeToAllSpaces((data: any) => {
          console.log('🌐 New space created globally:', data);
          if (data?.space) {
            const creatorId = data.space.creator_id;
            if (creatorId == user.id) return;

            addNotification({
              type: 'space_updated',
              title: 'New Space Available',
              message: `"${data.space.title}" space was created`,
              userId: Number(creatorId),
              spaceId: data.space.id,
              data: { ...data },
              createdAt: new Date(),
            });
          }
        });

        console.log('✅ Global space subscriptions set up successfully');
      } catch (error) {
        console.error('❌ Error setting up global space subscriptions:', error);
      }
    };

    setupSpaceSubscriptions();

    return () => {
      console.log('🧹 Cleaning up space subscriptions');
      subscribedSpaceIds.forEach(spaceId => {
        collaborationService.unsubscribeFromSpace(spaceId);
      });
      PusherService.unsubscribeFromChannel('spaces');
    };
  }, [isTokenReady, user?.id]);

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

      console.log('Posts loaded at Home index:', postsData);
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

  useEffect(() => {
    if (!user) {
      router.replace('/LoginScreen');
      return;
    }

    if (!user.email_verified_at) {
      router.replace('/VerificationScreen');
      return;
    }
  }, [user]);

  if (loading && !refreshing) return <View style={styles.loadingContainer}><ActivityIndicator size="large" /></View>;

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <View style={styles.container}>
        {/* Notification Panels */}
        <NotificationPanel
          visible={isNotificationPanelVisible}
          onClose={() => {
            setNotificationPanelVisible(false);
            setActiveNotificationType(null);
          }}
          initialType={activeNotificationType || 'all'}
        />

        <FollowersPanel
          visible={isFollowersPanelVisible}
          onClose={() => setIsFollowersPanelVisible(false)}
        />

        <CallsPanel
          visible={isCallsPanelVisible}
          onClose={() => setCallsPanelVisible(false)}
        />
        <MessagesPanel
          visible={isMessagesPanelVisible}
          onClose={() => setMessagesPanelVisible(false)}
        />
        <SpacesPanel
          visible={isSpacesPanelVisible}
          onClose={() => setSpacesPanelVisible(false)}
        />
        <ActivitiesPanel
          visible={isActivitiesPanelVisible}
          onClose={() => setActivitiesPanelVisible(false)}
        />
        {/* Enhanced Header with Multiple Notification Icons */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Home</Text>
            <View style={styles.headerIcons}>
              {/* Calls Icon */}
              <TouchableOpacity
                style={styles.notificationIconContainer}
                onPress={() => setCallsPanelVisible(true)}
              >
                <Ionicons name="call-outline" size={24} color="#4CD964" />
                {unreadCallCount > 0 && (
                  <View style={[styles.badge, styles.callBadge]}>
                    <Text style={styles.badgeText}>
                      {unreadCallCount > 99 ? '99+' : unreadCallCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Messages Icon */}
              <TouchableOpacity
                style={styles.notificationIconContainer}
                onPress={() => setMessagesPanelVisible(true)}
              >
                <Ionicons name="chatbubble-outline" size={24} color="#007AFF" />
                {unreadMessageCount > 0 && (
                  <View style={[styles.badge, styles.messageBadge]}>
                    <Text style={styles.badgeText}>
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Spaces Icon */}
              <TouchableOpacity
                style={styles.notificationIconContainer}
                onPress={() => setSpacesPanelVisible(true)}
              >
                <Ionicons name="cube-outline" size={24} color="#5856D6" />
                {unreadSpaceCount > 0 && (
                  <View style={[styles.badge, styles.spaceBadge]}>
                    <Text style={styles.badgeText}>
                      {unreadSpaceCount > 99 ? '99+' : unreadSpaceCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Activities Icon */}
              <TouchableOpacity
                style={styles.notificationIconContainer}
                onPress={() => setActivitiesPanelVisible(true)}
              >
                <Ionicons name="sparkles-outline" size={24} color="#FF2D55" />
                {unreadActivityCount > 0 && (
                  <View style={[styles.badge, styles.activityBadge]}>
                    <Text style={styles.badgeText}>
                      {unreadActivityCount > 99 ? '99+' : unreadActivityCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Followers Icon */}
              <TouchableOpacity
                style={styles.notificationIconContainer}
                onPress={() => setIsFollowersPanelVisible(true)}
              >
                <Ionicons name="people-outline" size={24} color="#000" />
                {unreadFollowerCount > 0 && (
                  <View style={[styles.badge, styles.followerBadge]}>
                    <Text style={styles.badgeText}>
                      {unreadFollowerCount > 99 ? '99+' : unreadFollowerCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Regular Notifications Icon */}
              <TouchableOpacity
                style={styles.notificationIconContainer}
                onPress={() => setNotificationPanelVisible(true)}
              >
                <Ionicons name="notifications-outline" size={24} color="#000" />
                {unreadCount > 0 && (
                  <View style={[styles.badge, styles.regularBadge]}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

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
  notificationIconContainer: {
    position: 'relative',
    marginLeft: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  callBadge: {
    backgroundColor: '#4CD964',
  },
  messageBadge: {
    backgroundColor: '#007AFF',
  },
  spaceBadge: {
    backgroundColor: '#5856D6',
  },
  activityBadge: {
    backgroundColor: '#FF2D55',
  },
  regularBadge: {
    backgroundColor: '#FF9500',
  },
  followerBadge: {
    backgroundColor: '#FF3B30',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
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
