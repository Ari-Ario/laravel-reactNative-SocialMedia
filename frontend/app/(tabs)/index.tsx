import { View, Text, Pressable, StyleSheet, Button, ActivityIndicator, ScrollView, FlatList, TextInput, TouchableOpacity } from "react-native";
import { Link, router, Stack } from 'expo-router';
import { useState, useEffect } from "react";
import AuthContext from "@/context/AuthContext";
import { logout } from "@/services/AuthService";
import { useContext } from "react";
import LoginScreen from "../LoginScreen";
import PostListItem from '@/components/PostListItem';
import { Alert } from 'react-native';
import EmojiPicker from 'rn-emoji-keyboard';
import FloatingActionButton from '@/components/FloatingActionButton';
import getApiBase from "@/services/getApiBase";
import { getToken } from "@/services/TokenService";
import { fetchPosts, bookmarkPost, repostPost, sharePost, commentOnPost, reactToPost } from "@/services/PostService";
import CreatePost from "@/components/CreatePost";
const HomePage = () => {
    const { user, setUser } = useContext(AuthContext);
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPost, setSelectedPost] = useState<any>(null);
    const [commentText, setCommentText] = useState('');
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [currentReactingPost, setCurrentReactingPost] = useState<any>(null);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

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
    };

    useEffect(() => {
        if (user) {
            fetchPostsAndHandleState();
        }
    }, [user]);


    useEffect(() => {
        if (!user || (user === null)) {
          router.replace('/LoginScreen');
        } else { 
          console.log("asking for Authentication from Index");
        }
    }, [user]);

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

    return (
      <AuthContext.Provider value={{ user, setUser }}>
        <View style={styles.container}>
          {/* Header with welcome message and logout button */}
          <View style={styles.header}>
            <Text style={styles.welcomeText}>Welcome, {user.name}</Text>
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
            router.setParams({}); // Clear any edit params
            setIsCreateModalVisible(true);
          }} />

        </View>
          <CreatePost
            visible={isCreateModalVisible}
            onClose={() => setIsCreateModalVisible(false)}
            onPostCreated={fetchPostsAndHandleState}
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
      padding: 15,
      backgroundColor: '#f8f8f8',
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
    },
    welcomeText: {
      fontSize: 16,
      fontWeight: '500',
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
});

export default HomePage;