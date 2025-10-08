// components/PostListItem.tsx
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
  NativeSyntheticEvent,
  Alert,
  Dimensions,
  Platform,
  Pressable
} from 'react-native';
import { Ionicons, Feather, AntDesign } from '@expo/vector-icons';
import { useContext, useState, useMemo } from 'react';
import EmojiPicker from 'rn-emoji-keyboard';
import PostMenu from './PostMenu';
import ReportPost from './ReportPost';
import AuthContext from '@/context/AuthContext';
import { router } from 'expo-router';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useProfileView } from '@/context/ProfileViewContext';
import { useModal } from '@/context/ModalContext';
import { usePostStore } from '@/stores/postStore';
import { Video } from 'expo-av';
import { MediaViewer } from './MediaViewer';
import React from 'react';
import { PostActionButtons } from './PostActionButtons';
import { usePostListService } from '@/services/PostListService';
import RenderComments from './RenderComments';
import PusherService from '@/services/PusherService';

interface PostListItemProps {
  post: any;
  onReact: (postId: number, emoji: string, commentId?: number) => void;
  onReactComment: (postId: number, emoji: string, commentId?: number) => void;
  onCommentSubmit: (postId: number, content: string, parentId?: number) => void;
  onRepost: (postId: number) => void;
  onShare: (postId: number) => void;
  onBookmark: (postId: number) => void;
}

export default function PostListItem({ 
  post, 
  onReact,
  onReactComment,
  onCommentSubmit,
  onRepost,
  onShare,
  onBookmark,
}: PostListItemProps) {
  const { user } = useContext(AuthContext);
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const { openModal } = useModal();
  const { posts, updatePost: updatePostInStore, expandedPostId, toggleExpandedPostId } = usePostStore();
  const currentPost = posts.find(p => p.id === post.id) || post;

  // Use the PostListService
  const service = usePostListService(user);

  const isOwner = service.isOwner(post.user.id);

  const sortedMedia = useMemo(() => {
    return service.sortMedia(post.media);
  }, [post.media]);

  const reactionsToShow = service.getGroupedReactions(currentPost, user?.id);
  const totalReactions = reactionsToShow.reduce((acc, r) => acc + r.count, 0);
  const comments = currentPost.comments || [];

  const handleDoubleTap = service.useDoubleTap(
    () => {
      service.setCurrentReactingItem({ postId: post.id });
      service.handleReact("❤️", post.id);
    },
    () => {
      service.setCurrentReactingItem({ postId: post.id });
    }
  );

  const submitComment = async () => {
    await service.submitComment(post.id, onCommentSubmit);
  };


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
            <TouchableOpacity 
            style={styles.Foto}
            onPress={() => {
              service.setProfileViewUserId(post.user.id);
              service.setProfilePreviewVisible(true);
            }}
            >
              <Image
                source={{ uri: `${getApiBaseImage()}/storage/${post.user.profile_photo}` || '@/assets/favicon.png' }}
                style={styles.avatar}
              />
            </TouchableOpacity>

            <View style={styles.nameCaption}>
              <Text style={styles.username}>{post.user.name}</Text>
              <View style={styles.menuContainer}>
                {post.caption && (
                  <Pressable onPress={() => toggleExpandedPostId(post.id)}>
                    <Text style={styles.caption}>
                      {expandedPostId === post.id
                        ? post.caption
                        : post.caption.length > 60
                          ? `${post.caption.substring(0, 60)} ...`
                          : post.caption}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
            
          </View>

          <TouchableOpacity 
              style={styles.menuButton}
              onPress={service.handleMenuPress}
          >
              <Ionicons name="ellipsis-horizontal" size={20} />
          </TouchableOpacity>
        </View>

      </View>

      {/* Post media */}
      {post.media && post.media.length > 0 && (
        <View style={styles.mediaContainer}>
          {sortedMedia.length === 1 ? (
            <TouchableOpacity onPress={() => service.openMediaViewer(0)}>
              {sortedMedia[0].type === 'video' ? (
                <Video
                  source={{ uri: `${getApiBaseImage()}/storage/${sortedMedia[0].file_path}` }}
                  style={styles.singleMedia}
                  resizeMode="cover"
                  shouldPlay={false}
                  isMuted
                  useNativeControls={false}
                />
              ) : (
                <Image
                  source={{ uri: `${getApiBaseImage()}/storage/${sortedMedia[0].file_path}` }}
                  style={styles.singleMedia}
                  resizeMode="cover"
                />
              )}
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {sortedMedia.map((media, index) => (
                <TouchableOpacity 
                  key={`${media.id}-${index}`}
                  onPress={() => service.openMediaViewer(index)}
                  style={styles.multiMediaItem}
                >
                  {media.type === 'video' ? (
                    <Video
                      source={{ uri: `${getApiBaseImage()}/storage/${media.file_path}` }}
                      style={styles.multiMediaContent}
                      resizeMode="cover"
                      shouldPlay={false}
                      isMuted
                      useNativeControls={false}
                    />
                  ) : (
                    <Image
                      source={{ uri: `${getApiBaseImage()}/storage/${media.file_path}` }}
                      style={styles.multiMediaContent}
                      resizeMode="cover"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <MediaViewer
        visible={service.mediaViewerVisible}
        mediaItems={sortedMedia}
        startIndex={service.mediaViewerIndex}
        onClose={service.handleCloseViewer}
        post={currentPost}
        getApiBaseImage={getApiBaseImage}
        onNavigateNext={() => service.handleNavigateNextPost(posts, post.id)}
        onNavigatePrev={() => service.handleNavigatePrevPost(posts, post.id)}
        // Action button handlers
        onReact={(emoji) => {
          service.setCurrentReactingItem({ postId: post.id });
          service.handleReact(emoji, post.id);
        }}
        onDeleteReaction={() => service.deletePostReaction(post.id)}
        onRepost={() => onRepost(post.id)}
        onShare={() => onShare(post.id)}
        onBookmark={() => onBookmark(post.id)}
        onCommentPress={() => service.setShowComments(!service.showComments)}
        onDoubleTap={handleDoubleTap}
        // Reaction state
        currentReactingItem={service.currentReactingItem}
        setCurrentReactingItem={service.setCurrentReactingItem}
        setIsEmojiPickerOpen={service.setIsEmojiPickerOpen}
        // Comment functions
        onCommentSubmit={async (content, parentId) => {
          return onCommentSubmit(post.id, content, parentId);
        }}
        getGroupedReactions={service.getGroupedReactions}
        // For comment reactions
        handleReactComment={service.handleReactComment}
        deleteCommentReaction={(emoji) => {
          if (!service.currentReactingComment?.commentId) return;
          service.deleteCommentReaction(service.currentReactingComment.commentId, emoji);
        }}
      />

      {/* Action buttons */}
      <PostActionButtons
        post={currentPost}
        onReact={(emoji) => service.handleReact(emoji, post.id)}
        onDeleteReaction={() => service.deletePostReaction(post.id)}
        onRepost={() => onRepost(post.id)}
        onShare={() => onShare(post.id)}
        onBookmark={() => onBookmark(post.id)}
        onCommentPress={() => service.setShowComments(!service.showComments)}
        currentReactingItem={service.currentReactingItem}
        setCurrentReactingItem={service.setCurrentReactingItem}
        setIsEmojiPickerOpen={service.setIsEmojiPickerOpen}
        getGroupedReactions={service.getGroupedReactions}
      />

      {/* Comments section */}
      {service.showComments && (
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
              {comments.length > 0 ? (
                <RenderComments
                  comments={comments}
                  user={user}
                  service={service}
                  postId={post.id}
                  onProfilePress={(userId) => {
                    service.setProfileViewUserId(userId);
                    service.setProfilePreviewVisible(true);
                  }}
                  onReply={(comment) => {
                    service.setReplyingTo(comment.id);
                    service.setCommentText(`@${comment.user.name} `);
                  }}
                  onReactComment={(commentId) => {
                    service.setCurrentReactingComment({ postId: post.id, commentId });
                    service.setIsEmojiPickerOpen(true);
                  }}
                  onDeleteCommentReaction={(commentId, emoji) => {
                    service.deleteCommentReaction(commentId, emoji);
                  }}
                  onDeleteComment={(commentId) => {
                    service.handleDeleteComment(post.id, commentId);
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
                onPress={() => { submitComment(); }}
                disabled={!service.commentText.trim()}
              >
                <Text style={styles.commentSubmitText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Emoji Picker */}
      <EmojiPicker
        open={service.isEmojiPickerOpen}
        onClose={() => service.setIsEmojiPickerOpen(false)}
        onEmojiSelected={(emoji) => {
          if (service.currentReactingComment) {
            service.handleReactComment(emoji.emoji, post.id, service.currentReactingComment.commentId!);
          } else if (service.currentReactingItem) {
            service.handleReact(emoji.emoji, post.id);
          }
        }}
        emojiSize={28}
        containerStyle={styles.emojiPicker}
      />

      <PostMenu
          visible={service.menuVisible}
          onClose={() => service.setMenuVisible(false)}
          onDelete={() => service.handleDelete(post.id)}
          onEdit={() => service.handleEdit(post)}
          onReport={service.handleReport}
          isOwner={isOwner}
          anchorPosition={service.menuPosition}
      />

      <ReportPost
          visible={service.reportVisible}
          postId={post.id}
          onClose={() => service.setReportVisible(false)}
          onReportSubmitted={service.handleReportSubmitted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
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
  Foto: {
    alignSelf: 'flex-start',
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
    color: "#333",
    minWidth: "90%",
    flexShrink: 1,
    flexWrap: "wrap",
    ...Platform.select({
      web: {
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        maxWidth: 800,
      },
    }),
  },
  mediaContainer: {
    marginTop: 8,
    overflow: 'hidden',
  },
  singleMedia: {
    aspectRatio: 16/9,
    width: '100%',
  },
  singleMediaContent: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  multiMediaItem: {
    width: Dimensions.get('window').width * 0.5,
    aspectRatio: 1,
    marginHorizontal: 4,
    maxWidth: Platform.OS === 'web' ? 400 : Dimensions.get('window').width * 0.5,
  },
  multiMediaContent: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  reactionBarContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reactionScrollContainer: {
    flex: 1,
    marginHorizontal: 5,
    overflow: 'hidden',
  },
  reactionBar: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 15,
    borderColor: '#e8eaed',
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  reactionItemMine: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
    color: '#65676B',
  },
  reactionCountMine: {
    color: '#10b981',
    fontWeight: '600',
  },
  addReactionButton: {
    flex: 1,
    flexDirection: 'row',
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
    justifyContent: 'space-between',
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
  emojiPicker: {
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 999,
    position: 'absolute'
  },
  menuButton: {
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

});