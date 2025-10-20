import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePostStore } from '@/stores/postStore';
import { fetchPostById } from '@/services/PostService';
import RenderComments from '@/components/RenderComments';
import { useProfileView } from '@/context/ProfileViewContext';
import getApiBaseImage from '@/services/getApiBaseImage';
import { Ionicons } from '@expo/vector-icons';
import { commentOnPost, reactToPost, deleteCommentReaction, deleteComment } from '@/services/PostService';

const PostDetailScreen = () => {
  const { id, highlightCommentId } = useLocalSearchParams();
  const { posts, addPost } = usePostStore();
  const post = posts.find(p => p.id.toString() === id);
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const postId = parseInt(id as string);


  useEffect(() => {
      // If post not found in store, fetch it
      if (!post && postId) {
          const fetchPost = async () => {
              setLoading(true);
              try {
                  const postData = await fetchPostById(postId);
                  if (postData) {
                      addPost(postData); // Direct post data
                  }
              } catch (error) {
                  console.error('Error fetching post:', error);
              } finally {
                  setLoading(false);
              }
          };
          
          fetchPost();
      }
  }, [postId, post, addPost]);

  console.log('📱 PostDetailScreen opened with:', { 
    id: postId, 
    highlightCommentId,
    postFound: !!post,
    loading 
  });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Loading post...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Post not found</Text>
      </View>
    );
  }
  
  if (!post) {
    return <Text>Post not found</Text>;
  }

  const handleProfilePress = (userId: string) => {
    setProfileViewUserId(userId);
    setProfilePreviewVisible(true);
  };

  const handleReply = (comment: any) => {
    // Implement reply logic, e.g., open a reply input modal
    console.log('Reply to comment:', comment.id);
  };

  const handleReactComment = async (commentId: number) => {
    // Implement react logic, e.g., open emoji picker
    console.log('React to comment:', commentId);
  };

  const handleDeleteCommentReaction = async (commentId: number, emoji: string) => {
    try {
      await deleteCommentReaction(commentId, emoji);
      console.log('Deleted reaction:', commentId, emoji);
    } catch (error) {
      console.error('Error deleting reaction:', error);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteComment(commentId);
      console.log('Deleted comment:', commentId);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.postContainer}>
        <TouchableOpacity onPress={() => handleProfilePress(post.user.id.toString())}>
          <Image
            source={{ uri: `${getApiBaseImage()}/storage/${post.user.profile_photo}` }}
            style={styles.userAvatar}
          />
          <Text style={styles.userName}>{post.user.name}</Text>
        </TouchableOpacity>
        <Text style={styles.postContent}>{post.content}</Text>
        {post.media && (
          <Image
            source={{ uri: `${getApiBaseImage()}/storage/${post.media}` }}
            style={styles.postMedia}
          />
        )}
        <View style={styles.postActions}>
          <TouchableOpacity>
            <Ionicons name="heart-outline" size={24} color="#000" />
            <Text>{post.reactions_count || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="chatbubble-outline" size={24} color="#000" />
            <Text>{post.comments_count || 0}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <RenderComments
        user={post.user}
        service={{ setCurrentReactingComment: () => {}, setCurrentReactingItem: () => {}, setIsEmojiPickerOpen: () => {} }}
        postId={post.id}
        onProfilePress={handleProfilePress}
        onReply={handleReply}
        onReactComment={handleReactComment}
        onDeleteCommentReaction={handleDeleteCommentReaction}
        onDeleteComment={handleDeleteComment}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  postContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  postContent: {
    fontSize: 14,
    marginVertical: 8,
  },
  postMedia: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginVertical: 8,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
});

export default PostDetailScreen;