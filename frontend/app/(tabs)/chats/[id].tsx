// app/(tabs)/chats/[id].tsx
import { 
  View, 
  Image, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  TextInput,
  ScrollView,
  Modal,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useContext, useState, useEffect } from 'react';
import EmojiPicker from 'rn-emoji-keyboard';
import AuthContext from '@/context/AuthContext';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useProfileView } from '@/context/ProfileViewContext';
import { usePostStore } from '@/stores/postStore';
import { Video } from 'expo-av';
import { MediaViewer } from '@/components/MediaViewer';
import { usePostListService } from '@/services/PostListService';
import { PostActionButtons } from '@/components/PostActionButtons';
import ChatMessage from '@/components/ChatScreen/ChatMessage';
import PostMenu from '@/components/PostMenu';
import ReportPost from '@/components/ReportPost';
import RenderComments from '@/components/RenderComments';
import { commentOnPost, reactToComment, deleteReactionFromComment } from '@/services/PostService';

const ChatDetailScreen = () => {
  const { id } = useLocalSearchParams();
  const { user } = useContext(AuthContext);
  const service = usePostListService(user);
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const { posts, updateCommentReactions, removeCommentReaction } = usePostStore();
  
  const [inputText, setInputText] = useState('');
  const [chatUser, setChatUser] = useState<any>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);

  // Get chat posts directly from Zustand store
  const chatPosts = posts.filter(post => post.user.id.toString() === id);

  useEffect(() => {
    // Find the chat user from the first post
    if (chatPosts.length > 0) {
      setChatUser(chatPosts[0].user);
    }
  }, [chatPosts]);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    
    // Create a new post/message
    
    // For now, we'll just add to local state since it's a chat message
    // In a real app, you'd send this to your backend and update Zustand
    setInputText('');
  };

// app/(tabs)/chats/[id].tsx
const submitComment = async () => {
  if (!service.commentText.trim() || !selectedPost) return;
  
  try {
    // Call the service's submitComment method with the correct parameters
    await service.submitComment(selectedPost.id, commentOnPost);
    
  } catch (error: any) {
    console.error('Comment error:', error);
    Alert.alert("Error", error.message || "Failed to post comment");
  }
};

  // Add these functions to handle comment reactions properly
  const handleReactComment = async (emoji: string, commentId: number) => {
    if (!selectedPost || !user?.id) return;

    try {
      const response = await reactToComment(selectedPost.id, commentId, emoji);
      
      if (response?.reaction) {
        // Update Zustand store with the server response
        updateCommentReactions(
          selectedPost.id,
          commentId,
          response.reaction,
          response.reaction_counts ?? null
        );
      }
    } catch (error) {
      console.error('Comment reaction error:', error);
      Alert.alert("Error", "Failed to save reaction");
    }
  };

  const handleDeleteCommentReaction = async (commentId: number) => {
    if (!selectedPost || !user?.id) return;

    try {
      const response = await deleteReactionFromComment(commentId);
      
      // Update Zustand store
      removeCommentReaction(
        selectedPost.id,
        commentId,
        user.id,
        response.reaction_counts,
        response.reaction_comments_count
      );
    } catch (error) {
      console.error('Delete comment reaction error:', error);
      Alert.alert("Error", "Failed to delete reaction");
    }
  };

  if (!chatUser) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const isOwner = (postUserId: number | string) => {
    return user?.id === postUserId;
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => {
            setProfileViewUserId(chatUser.id.toString());
            setProfilePreviewVisible(true);
          }}
        >
          <Image 
            source={{ uri: `${getApiBaseImage()}/storage/${chatUser.profile_photo}` || 'https://via.placeholder.com/50' }} 
            style={styles.headerAvatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{chatUser.name}</Text>
            <Text style={styles.userStatus}>online</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Messages List - Now using Zustand posts directly */}
      <FlatList
        data={chatPosts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ChatMessage 
            item={item} 
            user={user} 
            service={service} 
            onMenuPress={() => {
              setSelectedPost(item);
              service.handleMenuPress();
            }}
            onCommentPress={(post) => {
              setSelectedPost(post);
              service.setShowComments(!service.showComments);
            }}
          />
        )}
        contentContainerStyle={styles.messagesList}
        inverted={false}
      />

      {/* Media Viewer */}
      <MediaViewer
        visible={service.mediaViewerVisible}
        mediaItems={service.sortMedia(chatPosts.flatMap((post: any) => post.media || []))}
        startIndex={service.mediaViewerIndex}
        onClose={service.handleCloseViewer}
        post={chatPosts[0]}
        getApiBaseImage={getApiBaseImage}
        onNavigateNext={() => service.handleNavigateNextPost(posts, chatPosts[0]?.id)}
        onNavigatePrev={() => service.handleNavigatePrevPost(posts, chatPosts[0]?.id)}
        onReact={(emoji) => {
          service.setCurrentReactingItem({ postId: chatPosts[0]?.id });
          service.handleReact(emoji, chatPosts[0]?.id);
        }}
        onDeleteReaction={() => service.deletePostReaction(chatPosts[0]?.id)}
        onRepost={() => {}}
        onShare={() => {}}
        onBookmark={() => {}}
        onCommentPress={() => {
          setSelectedPost(chatPosts[0]);
          // console.log(selectedPost);
          service.setShowComments(!service.showComments);
        }}
        onDoubleTap={() => {}}
        currentReactingItem={service.currentReactingItem}
        setCurrentReactingItem={service.setCurrentReactingItem}
        setIsEmojiPickerOpen={service.setIsEmojiPickerOpen}
        onCommentSubmit={async (content, parentId) => {
          return commentOnPost(selectedPost.id, content, parentId);
        }}
        getGroupedReactions={service.getGroupedReactions}
        handleReactComment={handleReactComment}
        deleteCommentReaction={handleDeleteCommentReaction}
      />

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachmentButton}>
          <Ionicons name="attach" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Message..."
          placeholderTextColor="#999"
          multiline
        />
        
        {inputText.trim() ? (
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Ionicons name="send" size={24} color="#007AFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.emojiButton}>
            <Ionicons name="happy-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Emoji Picker */}
      <EmojiPicker
        open={service.isEmojiPickerOpen}
        onClose={() => service.setIsEmojiPickerOpen(false)}
        onEmojiSelected={(emoji) => {
          if (service.currentReactingItem) {
            service.handleReact(emoji.emoji, service.currentReactingItem.postId);
          } else if (service.currentReactingComment) {
            handleReactComment(emoji.emoji, service.currentReactingComment.commentId!);
          }
        }}
        emojiSize={28}
        containerStyle={styles.emojiPicker}
      />

      {/* Comments section */}
      {service.showComments && selectedPost && (
        <Modal
          visible={service.showComments}
          animationType="slide"
          transparent
          onRequestClose={() => {
            service.setIsFullScreen(false)
            service.setShowComments(false)
          }}
        >
          <TouchableOpacity
            style={styles.commentsBackdrop}
            activeOpacity={1}
            onPress={() => service.setShowComments(false)}
          />

          <View style={[
            styles.commentsSheet,
            service.isFullScreen && styles.fullScreenSheet
          ]}>
            <TouchableOpacity 
              style={styles.sheetHandleContainer}
              onPress={() => service.setIsFullScreen(!service.isFullScreen)}
            >
              <View style={styles.sheetHandle} />
            </TouchableOpacity>

            {/* Comments List */}
            <ScrollView
              style={styles.commentsList}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {selectedPost.comments?.length > 0 ? (
                <RenderComments
                  comments={selectedPost.comments}
                  user={user}
                  service={service}
                  postId={selectedPost.id}
                  onProfilePress={(userId) => {
                    service.setProfileViewUserId(userId);
                    service.setProfilePreviewVisible(true);
                  }}
                  onReply={(comment) => {
                    service.setReplyingTo(comment.id);
                    service.setCommentText(`@${comment.user.name} `);
                  }}
                  onReactComment={(commentId) => {
                    service.setCurrentReactingComment({ postId: selectedPost.id, commentId });
                    service.setIsEmojiPickerOpen(true);
                  }}
                  onDeleteCommentReaction={handleDeleteCommentReaction}
                  onDeleteComment={(commentId) => {
                    service.handleDeleteComment(selectedPost.id, commentId);
                  }}
                />
              ) : (
                <Text style={styles.noCommentsText}>No comments yet</Text>
              )}
            </ScrollView>

            {/* Comment input */}
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder={
                  service.replyingTo ? "Replying to comment..." : "Write a comment..."
                }
                value={service.commentText}
                onChangeText={service.setCommentText}
                multiline
              />
              <TouchableOpacity
                style={styles.commentSubmitButton}
                onPress={submitComment}
                disabled={!service.commentText.trim()}
              >
                <Text style={styles.commentSubmitText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <PostMenu
        visible={service.menuVisible}
        onClose={() => service.setMenuVisible(false)}
        onDelete={() => selectedPost && service.handleDelete(selectedPost.id)}
        onEdit={() => selectedPost && service.handleEdit(selectedPost)}
        onReport={service.handleReport}
        isOwner={selectedPost ? isOwner(selectedPost.user.id) : false}
        anchorPosition={service.menuPosition}
      />

      <ReportPost
        visible={service.reportVisible}
        postId={selectedPost?.id}
        onClose={() => service.setReportVisible(false)}
        onReportSubmitted={service.handleReportSubmitted}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: {
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userStatus: {
    fontSize: 12,
    color: '#007AFF',
  },
  menuButton: {
    padding: 4,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 80,
    // Ensure proper content fitting
    flexGrow: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  attachmentButton: {
    padding: 8,
    marginRight: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    padding: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    padding: 8,
  },
  emojiButton: {
    padding: 8,
  },
  emojiPicker: {
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

    commentsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  commentsSheet: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    bottom: 0,
    height: '66%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 20,
  },
  fullScreenSheet: {
    height: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ccc',
  },
  commentsList: {
  },
  noCommentsText: {
    textAlign: 'center',
    padding: 10,
    color: '#888',
  },
  commentContainer: {
    padding: 0,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  commentUsername: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  commentContent: {
    fontSize: 14,
    marginLeft: 40,
  },
  commentButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 5,
  },
  commentReactionsScrollContainer: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 10,
    overflow: 'hidden',
  },
  commentReactionsScrollContent: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  replyButton: {
    marginLeft: 40,
    marginTop: 5,
  },
  replyButtonText: {
    color: '#3498db',
    fontSize: 12,
  },
  repliesContainer: {
    paddingLeft: 10,
    marginTop: 10,
    borderLeftColor: '#eee',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight:10,
    backgroundColor: 'white',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    padding: 5,
    paddingHorizontal: 10,
    marginRight: 10,
    marginBottom: 10,
  },
  commentSubmitButton: {
    backgroundColor: '#3498db',
    padding: 10,
    borderRadius: 20,
    paddingHorizontal: 15,
  },
  commentSubmitText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ChatDetailScreen;