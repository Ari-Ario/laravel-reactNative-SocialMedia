// app/(tabs)/index.tsx
import { View, Text, Pressable, StyleSheet, Button, ActivityIndicator, ScrollView, FlatList, Image, TouchableOpacity, Alert, Platform, Dimensions } from "react-native";
import { Link, router, Stack, useRouter } from 'expo-router';
import { useState, useEffect, useContext, useRef, useMemo } from "react";
import AuthContext from "@/context/AuthContext";
import LoginScreen from "../LoginScreen";
import VerificationScreen from "../VerificationScreen";
import PostListItem from '@/components/PostListItem';
import FloatingActionButton from '@/components/FloatingActionButton';
import getApiBaseImage from "@/services/getApiBaseImage";
import { fetchPosts, bookmarkPost, repostPost, sharePost, commentOnPost, reactToPost, updatePost } from "@/services/PostService";
import CreatePost from "@/components/CreatePost";
import { Ionicons } from "@expo/vector-icons";
import FontAwesome from '@expo/vector-icons/FontAwesome';
import ProfilePreview from "@/components/ProfilePreview";
import AddStory from "@/components/AddStory";
import { fetchStories } from "@/services/StoryService";
import { useStoryStore } from "@/stores/storyStore";
import { useProfileView } from "@/context/ProfileViewContext";
import { usePostStore } from "@/stores/postStore"; // ✅ Zustand store
import { useCollaborationStore } from "@/stores/collaborationStore";
import { useNotificationStore } from '@/stores/notificationStore'; // NEW
import { usePostListService } from "@/services/PostListService";
import { getToken } from "@/services/TokenService";
import PusherService from "@/services/PusherService";
import { NotificationPanel } from "@/components/Notifications/NotificationPanel";
import FollowersPanel from "@/components/Notifications/FollowersPanel";
import RealTimeService from '@/services/ChatScreen/RealTimeServiceChat';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { Avatar } from '@/components/ui/Avatar';
import CallsPanel from '@/components/Notifications/CallsPanel';
import MessagesPanel from '@/components/Notifications/MessagesPanel';
import SpacesPanel from '@/components/Notifications/SpacesPanel';
import ActivitiesPanel from '@/components/Notifications/ActivitiesPanel';

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

  // Stores
  const { storyGroups, fetchStories: fetchStoriesFromStore, initializeRealtime: initStoryRealtime } = useStoryStore();
  const { posts, setPosts, updatePost: updatePostInStore } = usePostStore();
  const {
    isNotificationPanelVisible,
    setNotificationPanelVisible,
    isFollowersPanelVisible,
    setIsFollowersPanelVisible,
    unreadCount,
    unreadFollowerCount,
    unreadCallCount,
    unreadMessageCount,
    unreadSpaceCount,
    unreadActivityCount,
    unreadChatbotTrainingCount,
    addNotification,
    setCurrentUserId,
    isRealtimeReady
  } = useNotificationStore();

  const [isTokenReady, setIsTokenReady] = useState(false);

  // ✅ Token ready state management
  useEffect(() => {
    if (user?.id) {
      setIsTokenReady(true);
      setCurrentUserId(Number(user.id));
    }
  }, [user?.id]);

  const [activeNotificationType, setActiveNotificationType] = useState<"all" | "regular" | "spaces" | "calls" | "messages" | "activities" | null>(null);

  // Refs for notification icons
  const callsIconRef = useRef<any>(null);
  const messagesIconRef = useRef<any>(null);
  const spacesIconRef = useRef<any>(null);
  const activitiesIconRef = useRef<any>(null);
  const followersIconRef = useRef<any>(null);
  const chatbotIconRef = useRef<any>(null);
  const regularIconRef = useRef<any>(null);

  const [notificationAnchor, setNotificationAnchor] = useState<{ top: number; left?: number; right?: number; arrowOffset?: number }>();
  const [followersAnchor, setFollowersAnchor] = useState<{ top: number; left?: number; right?: number; arrowOffset?: number }>();

  const calculateAnchor = (pageX: number, width: number, pageY: number, height: number) => {
    const windowWidth = Dimensions.get('window').width;
    const iconCenter = pageX + width / 2;
    const dropdownWidth = Platform.OS === 'web' ? 400 : 320;

    let left = iconCenter - (dropdownWidth / 2);
    if (left < 10) left = 10;
    if (left + dropdownWidth > windowWidth - 10) {
      left = windowWidth - dropdownWidth - 10;
    }

    const arrowOffset = iconCenter - left - 10;
    return {
      top: pageY + height,
      left: left,
      arrowOffset: arrowOffset,
    };
  };

  const handleIconPress = (
    ref: React.RefObject<any>,
    type: "all" | "regular" | "spaces" | "calls" | "messages" | "activities",
    visibleSetter: (v: boolean) => void
  ) => {
    if (ref.current) {
      ref.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        const anchor = calculateAnchor(pageX, width, pageY, height);
        setNotificationAnchor(anchor);

        if (isNotificationPanelVisible && activeNotificationType === type) {
          setNotificationPanelVisible(false);
          setActiveNotificationType(null);
        } else {
          setIsFollowersPanelVisible(false);
          setActiveNotificationType(type);
          setNotificationPanelVisible(true);
        }
      });
    }
  };

  const handleFollowersPress = () => {
    if (followersIconRef.current) {
      followersIconRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        const anchor = calculateAnchor(pageX, width, pageY, height);
        setFollowersAnchor(anchor);

        if (isNotificationPanelVisible) {
          setNotificationPanelVisible(false);
          setActiveNotificationType(null);
        }
        setIsFollowersPanelVisible(!isFollowersPanelVisible);
      });
    }
  };

  // ✅ Real-time initialization
  useEffect(() => {
    if (isRealtimeReady && isTokenReady) {
      initStoryRealtime();
      
      // ✅ Ensure user notifications are also initialized from index.tsx
      if (user?.id) {
        getToken().then(token => {
          if (token) useNotificationStore.getState().initializeRealtime(token, Number(user.id));
        });
      }
    }
  }, [isRealtimeReady, isTokenReady]);

  // Subscribe to posts
  useEffect(() => {
    if (isRealtimeReady && isTokenReady) {
      const postIds = posts.map(post => post.id);
      usePostStore.getState().subscribeToPosts(postIds);
    }
    return () => {
      usePostStore.getState().unsubscribeFromAllPosts();
    };
  }, [posts.length, isTokenReady, isRealtimeReady]);

  const fetchUserSpacesFromStore = useCollaborationStore(state => state.fetchUserSpaces);

  // Global space initialization
  useEffect(() => {
    if (!isRealtimeReady || !isTokenReady || !user?.id) return;

    const initializeSpaces = async () => {
      try {
        await fetchUserSpacesFromStore(Number(user.id));
        PusherService.subscribeToAllSpaces((data: any) => {
          if (data?.space && data.space.creator_id != user.id) {
            addNotification({
              type: 'space_updated',
              title: 'New Space Available',
              message: `"${data.space.title}" space was created`,
              userId: Number(data.space.creator_id),
              spaceId: data.space.id,
              data: { ...data },
              createdAt: new Date(),
            });
          }
        });
      } catch (error) {
        console.error('❌ Error initializing spaces:', error);
      }
    };

    initializeSpaces();
    return () => {
      PusherService.unsubscribeFromChannel('spaces');
    };
  }, [isTokenReady, user?.id, isRealtimeReady, fetchUserSpacesFromStore]);

  // Initial data load
  useEffect(() => {
    if (user && isTokenReady) {
      fetchPostsAndHandleState();
      fetchStoriesFromStore();
    }
  }, [user, isTokenReady]);

  const fetchPostsAndHandleState = async () => {
    try {
      setLoading(true);
      const postsData = await fetchPosts();
      setPosts(postsData);
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
      updatePostInStore({
        id: postId,
        is_reposted: response.reposted,
        reposts_count: response.reposts_count,
        reposts: response.reposted
          ? [{ id: Date.now(), user: response.repost_user, created_at: new Date().toISOString() }, ...(posts.find(p => p.id === postId)?.reposts || [])]
          : (posts.find(p => p.id === postId)?.reposts || []).filter((r: any) => user?.id && r.user.id !== user.id)
      });
    } catch (error) {
      console.error('Error handling repost:', error);
      Alert.alert('Error', 'Could not complete repost action');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPostsAndHandleState();
    fetchStoriesFromStore();
  };

  const handleCommentSubmit = async (postId: number, content: string, parentId?: number) => {
    try {
      return await commentOnPost(postId, content, parentId);
    } catch (error) {
      console.error('Comment submission failed:', error);
      throw error;
    }
  };

  const handleProfilePress = (userId: string) => {
    setProfileViewUserId(userId);
    setProfilePreviewVisible(true);
  };

  // Instagram-style Story Separation
  const { myStoryGroup, otherStoryGroups } = useMemo(() => {
    if (!user?.id) return { myStoryGroup: null, otherStoryGroups: storyGroups };
    const myGroup = storyGroups.find(g => g.user.id === Number(user.id));
    const otherGroups = storyGroups.filter(g => g.user.id !== Number(user.id));
    return { myStoryGroup: myGroup, otherStoryGroups: otherGroups };
  }, [storyGroups, user?.id]);

  const renderProfilePhoto = () => {
    if (!user) return null;
    return (
      <TouchableOpacity onPress={() => handleProfilePress(user.id)}>
        <Avatar user={user} size={60} />
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    // Auth routing is strictly handled by _layout.tsx now. 
    // This prevents deep links from being hijacked by background tab mounts.
  }, [user]);

  if ((loading && !refreshing) || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Modals and Panels */}
      {activeNotificationType === 'regular' || activeNotificationType === 'all' ? (
        <NotificationPanel
          visible={isNotificationPanelVisible}
          onClose={() => {
            setNotificationPanelVisible(false);
            setActiveNotificationType(null);
          }}
          initialType={activeNotificationType || 'all'}
          anchorPosition={notificationAnchor}
        />
      ) : activeNotificationType === 'calls' ? (
        <CallsPanel
          visible={isNotificationPanelVisible}
          onClose={() => {
            setNotificationPanelVisible(false);
            setActiveNotificationType(null);
          }}
          anchorPosition={notificationAnchor}
        />
      ) : activeNotificationType === 'messages' ? (
        <MessagesPanel
          visible={isNotificationPanelVisible}
          onClose={() => {
            setNotificationPanelVisible(false);
            setActiveNotificationType(null);
          }}
          anchorPosition={notificationAnchor}
        />
      ) : activeNotificationType === 'spaces' ? (
        <SpacesPanel
          visible={isNotificationPanelVisible}
          onClose={() => {
            setNotificationPanelVisible(false);
            setActiveNotificationType(null);
          }}
          anchorPosition={notificationAnchor}
        />
      ) : activeNotificationType === 'activities' ? (
        <ActivitiesPanel
          visible={isNotificationPanelVisible}
          onClose={() => {
            setNotificationPanelVisible(false);
            setActiveNotificationType(null);
          }}
          anchorPosition={notificationAnchor}
        />
      ) : null}

      <FollowersPanel
        visible={isFollowersPanelVisible}
        onClose={() => setIsFollowersPanelVisible(false)}
        anchorPosition={followersAnchor}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Home</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              ref={callsIconRef}
              style={styles.notificationIconContainer}
              onPress={() => handleIconPress(callsIconRef, 'calls', setNotificationPanelVisible)}
            >
              <Ionicons name="call-outline" size={24} color="#4CD964" />
              {unreadCallCount > 0 && (
                <View style={[styles.badge, styles.callBadge]}>
                  <Text style={styles.badgeText}>{unreadCallCount > 99 ? '99+' : unreadCallCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              ref={messagesIconRef}
              style={styles.notificationIconContainer}
              onPress={() => handleIconPress(messagesIconRef, 'messages', setNotificationPanelVisible)}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#007AFF" />
              {unreadMessageCount > 0 && (
                <View style={[styles.badge, styles.messageBadge]}>
                  <Text style={styles.badgeText}>{unreadMessageCount > 99 ? '99+' : unreadMessageCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              ref={spacesIconRef}
              style={styles.notificationIconContainer}
              onPress={() => handleIconPress(spacesIconRef, 'spaces', setNotificationPanelVisible)}
            >
              <Ionicons name="cube-outline" size={24} color="#5856D6" />
              {unreadSpaceCount > 0 && (
                <View style={[styles.badge, styles.spaceBadge]}>
                  <Text style={styles.badgeText}>{unreadSpaceCount > 99 ? '99+' : unreadSpaceCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              ref={activitiesIconRef}
              style={styles.notificationIconContainer}
              onPress={() => handleIconPress(activitiesIconRef, 'activities', setNotificationPanelVisible)}
            >
              <Ionicons name="sparkles-outline" size={24} color="#FF2D55" />
              {unreadActivityCount > 0 && (
                <View style={[styles.badge, styles.activityBadge]}>
                  <Text style={styles.badgeText}>{unreadActivityCount > 99 ? '99+' : unreadActivityCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              ref={followersIconRef}
              style={styles.notificationIconContainer}
              onPress={handleFollowersPress}
            >
              <Ionicons name="people-outline" size={24} color="#000" />
              {unreadFollowerCount > 0 && (
                <View style={[styles.badge, styles.followerBadge]}>
                  <Text style={styles.badgeText}>{unreadFollowerCount > 99 ? '99+' : unreadFollowerCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {!!user?.ai_admin && (
              <TouchableOpacity
                ref={chatbotIconRef}
                style={styles.notificationIconContainer}
                onPress={() => router.push('/chatbotTraining')}
              >
                <FontAwesome name="server" size={24} color="#000" />
                {unreadChatbotTrainingCount > 0 && (
                  <View style={[styles.badge, styles.regularBadge]}>
                    <Text style={styles.badgeText}>{unreadChatbotTrainingCount > 99 ? '99+' : unreadChatbotTrainingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              ref={regularIconRef}
              style={styles.notificationIconContainer}
              onPress={() => handleIconPress(regularIconRef, 'regular', setNotificationPanelVisible)}
            >
              <Ionicons name="notifications-outline" size={24} color="#000" />
              {unreadCount > 0 && (
                <View style={[styles.badge, styles.regularBadge]}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.headerScrollContainer}>
        <View style={styles.header}>
          <View style={styles.storiesContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
              <View style={styles.storyItem}>
                <View style={{ position: 'relative' }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      if (myStoryGroup) {
                        router.push({ pathname: '/story/[id]', params: { id: myStoryGroup.latest_story.id } });
                      } else {
                        handleProfilePress(user.id);
                      }
                    }}
                  >
                    <View style={[
                      styles.storyBorder,
                      !myStoryGroup && { borderColor: 'transparent' },
                      myStoryGroup?.all_viewed && styles.viewedStoryBorder
                    ]}>
                      <Avatar user={user} size={60} style={styles.storyImage} />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addStoryIcon}
                    onPress={() => setAddStoryVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={16} color="white" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.storyUsername} numberOfLines={1}>Your Story</Text>
              </View>

              {otherStoryGroups.map(group => (
                <TouchableOpacity
                  key={group.user.id}
                  style={styles.storyItem}
                  onPress={() => router.push({ pathname: '/story/[id]', params: { id: group.latest_story.id } })}
                >
                  <View style={[styles.storyBorder, group.all_viewed && styles.viewedStoryBorder]}>
                    <Avatar user={group.user} size={60} style={styles.storyImage} />
                    {!group.all_viewed && <View style={styles.unseenBadge} />}
                  </View>
                  <Text style={styles.storyUsername} numberOfLines={1}>{group.user.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      <FlatList
        data={posts}
        renderItem={({ item }) => (
          <View style={styles.postContainer}>
            <PostListItem
              post={item}
              onReact={reactToPost}
              onReactComment={(postId, emoji, commentId) => reactToPost(postId, emoji, commentId)}
              onCommentSubmit={handleCommentSubmit}
              onRepost={handleRepost}
              onShare={sharePost}
              onBookmark={bookmarkPost}
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

      <CreatePost
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onPostCreated={(post) => {
          if (!post?.id) fetchPostsAndHandleState();
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
        onStoryCreated={fetchStoriesFromStore}
      />
    </View>
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
