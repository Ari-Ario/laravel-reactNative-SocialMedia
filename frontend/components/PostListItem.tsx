// components/PostListItem.tsx
import { 
  View, 
  Image, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  TextInput,
  ScrollView
} from 'react-native';
import { Ionicons, Feather, AntDesign } from '@expo/vector-icons';
import { useState, useContext } from 'react';
import EmojiPicker from 'rn-emoji-keyboard';
import PostMenu from './PostMenu';
import ReportPost from './ReportPost';
import { deletePost, fetchPosts } from '@/services/PostService';
import AuthContext from '@/context/AuthContext';
import { router } from 'expo-router';
import { Platform, Alert } from 'react-native';
import getApiBaseImage from '@/services/getApiBaseImage';
interface Comment {
  id: number;
  content: string;
  user: {
    id: number;
    name: string;
    avatar_url: string | null;
  };
  replies?: Comment[];
  reaction_counts?: Array<{
    emoji: string;
    count: number;
  }>;
}

interface Repost {
  id: number;
  user: {
    id: number;
    name: string;
    avatar_url: string | null;
  };
  created_at: string;
}

interface Post {
  id: number;
  caption: string;
  user: {
    id: number;
    name: string;
    avatar_url: string | null;
  };
  media: Array<{
    id: number;
    file_path: string;
    type: string;
  }>;
  reaction_counts: Array<{
    emoji: string;
    count: number;
  }>;
  comments: Comment[];
  comments_count: number;
  created_at: string;

  reposts?: Repost[];
  reposts_count?: number;
  is_reposted?: boolean;
}

interface PostListItemProps {
  post: Post;
  onReact: (postId: number, emoji: string, commentId?: number) => void;
  onCommentSubmit: (postId: number, content: string, parentId?: number) => void;
  onRepost: (postId: number) => void;
  onShare: (postId: number) => void;
  onBookmark: (postId: number) => void;
  onEditPost: () => void; 
  setIsCreateModalVisible: (visible: boolean) => void;
}

export default function PostListItem({ 
  post, 
  onReact,
  onCommentSubmit,
  onRepost,
  onShare,
  onBookmark,
  setIsCreateModalVisible
}: PostListItemProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [currentReactingItem, setCurrentReactingItem] = useState<{
    postId: number;
    commentId?: number;
  } | null>(null);


const [menuVisible, setMenuVisible] = useState(false);
const [reportVisible, setReportVisible] = useState(false);
const { user, setUser } = useContext(AuthContext);

const isOwner = user?.id === post.user.id;

const handleDelete = async () => {
    try {
        const confirmMessage = Platform.OS === 'web' 
            ? window.confirm("Are you sure you want to delete this post?")
            : await new Promise((resolve) => {
                Alert.alert(
                    "Delete Post",
                    "Are you sure you want to delete this post?",
                    [
                        { text: "Cancel", onPress: () => resolve(false) },
                        { text: "Delete", onPress: () => resolve(true) }
                    ]
                );
            });

        if (!confirmMessage) {
            setMenuVisible(false);
            return;
        }

        await deletePost(post.id);
        setMenuVisible(false);
        
        if (Platform.OS === 'web') {
            alert("Post deleted successfully");
        } else {
            Alert.alert("Success", "Post deleted successfully");
        }
        
        // Refresh posts list
        // if (onPostDeleted) {
        //     onPostDeleted();
        // }
        fetchPosts();
        setMenuVisible(false);

    } catch (error) {
        console.error('Delete error:', error);
        const errorMessage = error.message || "Could not delete post. Please try again.";
        
        if (Platform.OS === 'web') {
            alert(errorMessage);
        } else {
            Alert.alert("Error", errorMessage);
        }
    }
};

const handleEdit = () => {
  setMenuVisible(false);
  router.push({
    pathname: '/',
    params: { 
      postId: post.id,
      caption: post.caption,
      media: JSON.stringify(post.media),
    }
  });
  setIsCreateModalVisible(true);
};

const handleReport = () => {
    setMenuVisible(false);
    setReportVisible(true);
};

const handleReportSubmitted = () => {
    Alert.alert("Report Submitted", "Thank you for your report. We'll review it shortly.");
};


  // Default emojis to show if no reactions exist
  const defaultEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  
  // Get reactions to display (from backend or default)
  const reactionsToShow = post.reactions?.length > 0 
    ? post.reactions 
    : defaultEmojis.map(emoji => ({ emoji, count: 0 }));

  const handleReact = (emoji: string) => {
    if (!currentReactingItem) return;
    
    if (currentReactingItem.commentId) {
      onReact(currentReactingItem.postId, emoji, currentReactingItem.commentId);
    } else {
      onReact(currentReactingItem.postId, emoji);
    }
    setIsEmojiPickerOpen(false);
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentContainer}>
      {/* Comment header */}
      <View style={styles.commentHeader}>
        <Image
          source={{ uri: item.user.avatar_url || 'https://via.placeholder.com/32' }}
          style={styles.commentAvatar}
        />
        <Text style={styles.commentUsername}>{item.user.name}</Text>
      {/* Comment content */}
      <Text style={styles.commentContent}>{item.content}</Text>
      </View>
      
      
        <View style={styles.commentButtons} >

        {/* Reply button - MOVED ABOVE REACTIONS */}
        <TouchableOpacity
          style={styles.replyButton}
          onPress={() => {
            setReplyingTo(item.id);
            setCommentText(`@${item.user.name} `);
          }}
        >
          <Text style={styles.replyButtonText}>Reply</Text>
        </TouchableOpacity>
        
        {/* Comment reactions - MOVED BELOW REPLY */}
        <View style={styles.commentReactions}>
          {item.reaction_counts?.length > 0 ? (
            <TouchableOpacity
              style={styles.reactionBar}
              onPress={() => {
                setCurrentReactingItem({ postId: post.id, commentId: item.id });
                setIsEmojiPickerOpen(true);
              }}
            >
              {item.reaction_counts.map((reaction, idx) => (
                <View key={idx} style={styles.reactionItem}>
                  <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                  <Text style={styles.reactionCount}>{reaction.count}</Text>
                </View>
              ))}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.addReactionButton}
              onPress={() => {
                setCurrentReactingItem({ postId: post.id, commentId: item.id });
                setIsEmojiPickerOpen(true);
              }}
            >
              <Text style={styles.addReactionText}>Add reaction</Text>
            </TouchableOpacity>
          )}
        </View>

      </View>
      
      {/* Nested replies */}
      {item.replies?.length > 0 && (
        <View style={styles.repliesContainer}>
          <FlatList
            data={item.replies}
            renderItem={renderComment}
            keyExtractor={(reply) => reply.id.toString()}
          />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>

      {/* Show repost header if this is a repost */}
      {(post.reposts?.length > 0 && (post.reposts[0].user.name !== user?.name)) && (
        <View style={styles.repostHeader}>
          <Feather name="repeat" size={16} color="#666" />
          <Text style={styles.repostText}>
            {post.reposts[0].user.name} reposted
          </Text>
        </View>
      )}

      <View style={styles.head}>
        {/* Post header */}
        <View style={styles.header}>

          <View style={styles.infoFoto}>
            <Image
              source={{ uri: `${getApiBaseImage()}/storage/${post.user.profile_photo}` || '@/assets/favicon.png' }}
              style={styles.avatar}
            />
            <View style={styles.nameCaption}>
              <Text style={styles.username}>{post.user.name}</Text>
              <View style={styles.menuContainer}>
              {/* Post caption */}
              {post.caption && <Text style={styles.caption}>{post.caption}</Text>}
              </View>
            </View>
            
          </View>

          <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => setMenuVisible(true)}
          >
              <Ionicons name="ellipsis-horizontal" size={20} />
          </TouchableOpacity>
        </View>

      </View>

      {/* Post media */}
      {post.media?.length > 0 && (
        <Image
          source={{ uri: `${getApiBaseImage()}/storage/${post.media[0].file_path}` }}
          style={styles.media}
          resizeMode="cover"
        />
      )}



      {/* Action buttons */}
      <View style={styles.actionBar}>
        {/* Comment button */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowComments(!showComments)}
        >
          <Ionicons name="chatbubble-outline" size={24} />
          {post.comments_count > 0 && (
            <Text style={styles.actionCount}>{post.comments_count}</Text>
          )}
        </TouchableOpacity>

        {/* Repost button */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onRepost(post.id)}
        >
          <Feather
            name="repeat"
            size={24}
            color={post.is_reposted ? '#10b981' : '#000'}
          />
          {post.reposts_count > 0 && (
            <Text style={[
              styles.actionCount,
              post.is_reposted && styles.activeActionCount
            ]}>
              {post.reposts_count}
            </Text>
          )}
        </TouchableOpacity>

        {/* Share button */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onShare(post.id)}
        >
          <Feather name="send" size={24} />
        </TouchableOpacity>
        
      {/* Post reaction bar */}
      <View style={styles.reactionBarContainer}>
        <TouchableOpacity
          style={styles.reactionBar}
          onPress={() => {
            setCurrentReactingItem({ postId: post.id });
            setIsEmojiPickerOpen(true);
          }}
        >
          {reactionsToShow.map((reaction, idx) => (
            <View key={idx} style={styles.reactionItem}>
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              {reaction.count > 0 && (
                <Text style={styles.reactionCount}>{reaction.count}</Text>
              )}
            </View>
          ))}
        </TouchableOpacity>
      </View>

        {/* Bookmark button */}
        <TouchableOpacity 
          style={[styles.actionButton, { marginLeft: 'auto' }]}
          onPress={() => onBookmark(post.id)}
        >
          <Feather name="bookmark" size={24} />
        </TouchableOpacity>
      </View>

      {/* Comments section */}
      {showComments && (
        <View style={styles.commentsSection}>
          {/* Comments list */}
          <ScrollView 
            style={styles.commentsList}
            contentContainerStyle={{ paddingBottom: 50 }}
          >
            {post.comments?.length > 0 ? (
              <FlatList
                data={post.comments}
                renderItem={renderComment}
                keyExtractor={(comment) => comment.id.toString()}
                scrollEnabled={false} // Let the parent ScrollView handle scrolling
              />
            ) : (
              <Text style={styles.noCommentsText}>No comments yet</Text>
            )}
          </ScrollView>

          {/* Comment input (fixed at bottom) */}
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder={replyingTo ? "Replying to comment..." : "Write a comment..."}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={styles.commentSubmitButton}
              onPress={() => {
                onCommentSubmit(post.id, commentText, replyingTo || undefined);
                setCommentText('');
                setReplyingTo(null);
              }}
              disabled={!commentText.trim()}
            >
              <Text style={styles.commentSubmitText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Emoji Picker */}
      <EmojiPicker
        open={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onEmojiSelected={(emoji) => handleReact(emoji.emoji)}
        emojiSize={28}
        containerStyle={styles.emojiPicker}
      />

      <PostMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onReport={handleReport}
          isOwner={isOwner}
      />

      <ReportPost
          visible={reportVisible}
          postId={post.id}
          onClose={() => setReportVisible(false)}
          onReportSubmitted={handleReportSubmitted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    // borderBottomWidth: 1,
    // borderBottomColor: '#eee',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 10,
  },
  infoFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '92%',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
      alignSelf: 'flex-start',

  },
  menuContainer: {
    flexDirection: 'row',
    width: '80%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  username: {
    fontWeight: 'bold',
    fontSize: 14,
    alignSelf: 'flex-start'
  },
  nameCaption: {
    width: '84%'
  },
  caption: {
    padding: 0,
    margin: 0,
    fontSize: 14,
    minWidth: '80%'
  },
  media: {
    width: '100%',
    aspectRatio: 16 / 9, // or 1 for square
  },
  reactionBarContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
    color: '#65676B',
  },
  addReactionButton: {
    padding: 5,
  },
  addReactionText: {
    fontSize: 12,
    color: '#65676B',
    fontStyle: 'italic',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionCount: {
    marginLeft: 5,
    fontSize: 12,
    color: '#65676B',
  },
  commentsSection: {
    maxHeight: 400, // Adjust as needed
  },
  commentsList: {
    // paddingHorizontal: 10,
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
    // marginBottom: 5,
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
    marginLeft: 40, // Align with text under avatar
  },
  commentButtons : {
    flex: 1,
    flexDirection: 'row',
  },
  commentReactions: {
    marginLeft: 40,
    marginTop: 0,
    marginBottom:5,
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
    // borderTopWidth: 1,
    // borderTopColor: '#eee',
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
  emojiPicker: {
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuButton: {
    // marginLeft: 'auto',
    paddingLeft: 8,
    alignSelf: 'flex-start'
},
  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingBottom: 0,
    backgroundColor: '#f9f9f9',
  },
  repostText: {
    marginLeft: 5,
    fontSize: 12,
    color: '#666',
  },
  activeActionCount: {
    color: '#10b981',
  },
});