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
import { MediaViewer } from './MediaViewer';
import React from 'react';
import { PostActionButtons } from './PostActionButtons';
import { PostVideoPlayer } from './PostVideoPlayer';
import { usePostListService } from '@/services/PostListService';
import RenderComments from './RenderComments';
import { createShadow } from '@/utils/styles';
import PusherService from '@/services/PusherService';
import { CuratorFrame } from './CuratorFrame';
import { CuratorCircle } from './CuratorCircle';
import { ContextTagSelector } from './ContextTagSelector';
import { repostPost } from '@/services/PostService';
import { useToastStore } from '@/stores/toastStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { BookmarkGallery } from './BookmarkGallery';
import { Bookmark } from '@/services/BookmarkService';


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
}: PostListItemProps) {
  const { user } = useContext(AuthContext);
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const { openModal } = useModal();
  const { posts, updatePost: updatePostInStore, expandedPostId, toggleExpandedPostId } = usePostStore();
  const { showToast } = useToastStore();
  const [tagSelectorVisible, setTagSelectorVisible] = useState(false);
  const [bookmarkGalleryVisible, setBookmarkGalleryVisible] = useState(false);
  const [newBookmark, setNewBookmark] = useState<Bookmark | null>(null);
  const currentPost = posts.find(p => p.id === post.id) || post;

  const { addBookmark, bookmarks } = useBookmarkStore();
  const isBookmarked = bookmarks.some(b => b && b.post_id === post.id);

  // Use the PostListService
  const service = usePostListService(user);

  const isOwner = service.isOwner(post.user.id);

  const sortedMedia = useMemo(() => {
    return service.sortMedia(post.media);
  }, [post.media]);

  const reactionsToShow = service.getGroupedReactions(currentPost, user?.id ? Number(user.id) : undefined);
  const totalReactions = reactionsToShow.reduce((acc, r) => acc + r.count, 0);
  const comments = currentPost.comments || [];

  // Parse location safely
  const postLocation = useMemo(() => {
    if (!post.location) return null;
    try {
      return typeof post.location === 'string'
        ? JSON.parse(post.location)
        : post.location;
    } catch {
      return null;
    }
  }, [post.location]);

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

  const handleRepostWithContext = async (tag?: string, note?: string) => {
    try {
      const response = await repostPost(post.id, tag, note);
      
      // Update store with new repost count and potentially the new repost data
      const currentPost = posts.find(p => p.id === post.id);
      if (currentPost) {
        const isCurrentlyReposted = response.reposted;
        const currentUserId = user?.id ? Number(user.id) : null;

        updatePostInStore({
          ...currentPost,
          reposts_count: response.reposts_count,
          is_reposted: isCurrentlyReposted,
          reposts: isCurrentlyReposted
            ? (response.repost ? [response.repost, ...(currentPost.reposts || [])] : currentPost.reposts)
            : (currentPost.reposts || []).filter((r: any) => {
                const reposterId = r.user?.id || r.user_id;
                return Number(reposterId) !== Number(currentUserId);
              })
        });
      }
      
      showToast(response.message, 'success');
    } catch (error) {
      console.error("Repost failed:", error);
      showToast("Failed to process request", 'error');
    }
  };

  const onRepostPress = () => {
    if (currentPost.is_reposted) {
      // If already reposted, clicking undoes it
      handleRepostWithContext();
    } else {
      setTagSelectorVisible(true);
    }
  };

  const handleBookmark = async () => {
    try {
      const result = await addBookmark(post.id);
      if (result.bookmarked && result.bookmark) {
        showToast('Post bookmarked!', 'success');
        router.push({
          pathname: '/settings/bookmarks',
          params: { initialPostId: post.id, returnTo: '/' }
        });
      } else {
        showToast('Bookmark removed', 'info');
      }
    } catch (error) {
      console.error("Bookmark failed:", error);
      showToast("Failed to bookmark post", 'error');
    }
  };


  const renderMainContent = () => (
    <>
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
              <View style={styles.usernameRow}>
                <Text style={styles.username}>{post.user.name}</Text>
                {postLocation && (
                  <TouchableOpacity 
                    onPress={() => openModal('location', { location: postLocation })}
                    style={styles.locationPill}
                  >
                    <Ionicons name="location" size={10} color="#0084ff" />
                    <Text style={styles.locationName} numberOfLines={1}>{postLocation.name}</Text>
                  </TouchableOpacity>
                )}
                {currentPost.moderation_check?.fact_score > 0.8 && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="flask" size={10} color="#4CAF50" />
                    <Text style={styles.verifiedText}>Scientific Context</Text>
                  </View>
                )}
              </View>
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
                <PostVideoPlayer
                  uri={`${getApiBaseImage()}/storage/${sortedMedia[0].file_path}`}
                  style={styles.singleMedia}
                  contentFit="cover"
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
              {sortedMedia.map((media: any, index: number) => (
                <TouchableOpacity
                  key={`${media.id}-${index}`}
                  onPress={() => service.openMediaViewer(index)}
                  style={styles.multiMediaItem}
                >
                  {media.type === 'video' ? (
                    <PostVideoPlayer
                      uri={`${getApiBaseImage()}/storage/${media.file_path}`}
                      style={styles.multiMediaContent}
                      contentFit="cover"
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
    </>
  );

  return (
    <Pressable 
      style={styles.container}
      onLongPress={service.handleMenuPress}
      delayLongPress={300}
    >

      {/* Show Grouped Reposts if multiple people shared it */}
      {currentPost.reposts && currentPost.reposts.length > 1 && (
        <CuratorCircle 
          reposters={currentPost.reposts.map((r: any) => ({
            ...r.user,
            context_tag: r.context_tag,
            personal_note: r.personal_note,
            created_at: r.created_at
          }))} 
          postId={currentPost.id}
          postContent={currentPost.caption}
          post={currentPost}
        />
      )}

      {/* If it's a single repost - wrap in CuratorFrame */}
      {currentPost.reposts && currentPost.reposts.length === 1 ? (
        <CuratorFrame 
          reposter={{
            ...currentPost.reposts[0].user,
            context_tag: currentPost.reposts[0].context_tag,
            personal_note: currentPost.reposts[0].personal_note,
            created_at: currentPost.reposts[0].created_at,
          }}
        >
          {renderMainContent()}
        </CuratorFrame>
      ) : (
        renderMainContent()
      )}

      <ContextTagSelector
        visible={tagSelectorVisible}
        onClose={() => setTagSelectorVisible(false)}
        onConfirm={handleRepostWithContext}
      />

      {/* Action buttons */}
      <PostActionButtons
        post={currentPost}
        onReact={(emoji) => service.handleReact(emoji, post.id)}
        onDeleteReaction={() => service.deletePostReaction(post.id)}
        onRepost={onRepostPress}
        onShare={() => openModal('share', { post: currentPost })}
        onBookmark={handleBookmark}
        isBookmarked={isBookmarked}
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

      {service.mediaViewerVisible && (
        <MediaViewer
          visible={service.mediaViewerVisible}
          mediaItems={sortedMedia}
          startIndex={service.mediaViewerIndex}
          onClose={service.handleCloseViewer}
          post={currentPost}
          getApiBaseImage={getApiBaseImage}
          onNavigateNext={() => service.handleNavigateNextPost(posts, post.id)}
          onNavigatePrev={() => service.handleNavigatePrevPost(posts, post.id)}
          onReact={(emoji) => service.handleReact(emoji, post.id)}
          onDeleteReaction={() => service.deletePostReaction(post.id)}
          onRepost={onRepostPress}
          onShare={() => openModal('share', { post: currentPost })}
          onBookmark={handleBookmark}
          onCommentPress={() => {
            service.handleCloseViewer();
            service.setShowComments(true);
          }}
          onDoubleTap={() => service.handleReact("❤️", post.id)}
          currentReactingItem={service.currentReactingItem}
          setCurrentReactingItem={service.setCurrentReactingItem}
          setIsEmojiPickerOpen={service.setIsEmojiPickerOpen}
          onCommentSubmit={async (content) => onCommentSubmit(post.id, content)}
          getGroupedReactions={(p) => service.getGroupedReactions(p as any)}
          handleReactComment={(emoji) => {
            if (service.currentReactingComment) {
              service.handleReactComment(emoji, post.id, service.currentReactingComment.commentId!);
            }
          }}
          deleteCommentReaction={(emoji) => {
            if (service.currentReactingComment) {
              service.deleteCommentReaction(service.currentReactingComment.commentId!, emoji);
            }
          }}
        />
      )}

    </Pressable>
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
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 132, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    maxWidth: 150,
  },
  locationName: {
    fontSize: 11,
    color: '#0084ff',
    fontWeight: '600',
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
    aspectRatio: 16 / 9,
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
    ...createShadow({
      width: 0,
      height: -3,
      opacity: 0.2,
      radius: 6,
      elevation: 20,
    }),
  },
  fullScreenSheet: {
    height: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    ...(Platform.OS === 'ios' && {
      height: '94%',
    }),
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
    alignSelf: "center",
    paddingLeft: 10,
    paddingRight: 10,
    backgroundColor: 'white',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...(Platform.OS === 'ios' && {
      bottom: 20,
    }),
  },
  commentInput: {
    flex: 1,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    padding: 6,
    paddingHorizontal: 10,
    marginRight: 10,
    marginBottom: 10,
  },
  commentSubmitButton: {
    backgroundColor: '#3498db',
    padding: 6,
    borderRadius: 20,
    paddingHorizontal: 15,
  },
  commentSubmitText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emojiPicker: {
    borderRadius: 10,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.25,
      radius: 3.84,
      elevation: 5,
    }),
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
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  verifiedText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});

