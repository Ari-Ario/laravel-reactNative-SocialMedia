// components/PostListItem.tsx
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useContext, useState, useMemo } from 'react';
import EmojiPicker from 'rn-emoji-keyboard';
import PostMenu from './PostMenu';
import ReportPost from './ReportPost';
import AuthContext from '@/context/AuthContext';
import { router } from 'expo-router';
import getApiBaseImage from '@/services/getApiBaseImage';
import Avatar from './Image/Avatar';
import { useProfileView } from '@/context/ProfileViewContext';
import { useModal } from '@/context/ModalContext';
import { usePostStore } from '@/stores/postStore';
import { MediaViewer } from './MediaViewer';
import React from 'react';
import { PostActionButtons } from './PostActionButtons';
import { PostVideoPlayer } from './PostVideoPlayer';
import { usePostListService } from '@/services/PostListService';
import { LinkPreviewCard } from './LinkPreviewCard';
import RenderComments from './RenderComments';
import { CuratorFrame } from './CuratorFrame';
import { CuratorCircle } from './CuratorCircle';
import { ContextTagSelector } from './ContextTagSelector';
import { repostPost } from '@/services/PostService';
import { useToastStore } from '@/stores/toastStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { BookmarkGallery } from './BookmarkGallery';
import { Bookmark } from '@/services/BookmarkService';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';
import { createShadow } from '@/utils/styles';


interface PostListItemProps {
  post: any;
  onReact: (postId: number, emoji: string, commentId?: number) => void;
  onReactComment: (postId: number, emoji: string, commentId?: number) => void;
  onCommentSubmit: (postId: number, content: string, parentId?: number) => void;
  onRepost: (postId: number) => void;
  onShare: (postId: number) => void;
  onBookmark: (postId: number) => void;
  shouldPlay?: boolean;
}

function PostListItem({
  post,
  onReact,
  onReactComment,
  onCommentSubmit,
  onRepost,
  onShare,
  shouldPlay = false,
}: PostListItemProps) {
  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, activeScheme);
  const { user } = useContext(AuthContext);
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const { openModal } = useModal();
  const currentPost = usePostStore(state => state.posts.find(p => p.id === post.id) || post);
  const updatePostInStore = usePostStore(state => state.updatePost);
  const expandedPostId = usePostStore(state => state.expandedPostId);
  const toggleExpandedPostId = usePostStore(state => state.toggleExpandedPostId);
  const hydratePost = usePostStore(state => state.hydratePost);

  const handleToggleExpand = () => {
    if (expandedPostId !== post.id) {
      hydratePost(post.id);
    }
    toggleExpandedPostId(post.id);
  };
  const [tagSelectorVisible, setTagSelectorVisible] = useState(false);
  const [bookmarkGalleryVisible, setBookmarkGalleryVisible] = useState(false);
  const [newBookmark, setNewBookmark] = useState<Bookmark | null>(null);

  const { addBookmark, bookmarks } = useBookmarkStore();
  const isBookmarked = bookmarks.some(b => b && b.post_id === post.id);

  // Use the PostListService
  const service = usePostListService(user);

  const isOwner = service.isOwner(post.user.id);

  const { visualMedia, extraMedia } = useMemo(() => {
    return service.sortMedia(post.media);
  }, [post.media, service]);

  // Detect link in caption
  const detectedUrl = useMemo(() => {
    if (!post.caption) return null;
    // Enhanced regex to catch both http and www links
    const urlRegex = /((https?:\/\/|www\.)[^\s\n\r]+)/g;
    const matches = post.caption.match(urlRegex);
    if (!matches) return null;

    let url = matches[0];
    // Clean up trailing punctuation
    if (url.endsWith('.') || url.endsWith(',') || url.endsWith(')')) {
      url = url.slice(0, -1);
    }
    // Prefix www with https if missing for Linking to work
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }
    return url;
  }, [post.caption]);

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
            : (currentPost.reposts || []).filter((r: { user?: { id: number }; user_id?: number }) => {
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

  const getMediaUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('file://') || path.startsWith('data:')) return path;

    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    if (cleanPath.startsWith('storage/')) {
      return `${getApiBaseImage()}/${cleanPath}`;
    }
    return `${getApiBaseImage()}/storage/${cleanPath}`;
  };

  const getPosterUrl = (media: { thumbnail_path?: string; metadata?: { thumbnail?: string; poster?: string } }) => {
    if (media.thumbnail_path) return getMediaUrl(media.thumbnail_path);
    if (media.metadata?.thumbnail) return getMediaUrl(media.metadata.thumbnail);
    if (media.metadata?.poster) return getMediaUrl(media.metadata.poster);
    return undefined;
  };

  const isMobileWeb = Platform.OS === 'web' && Dimensions.get('window').width < 768;
  const isNativeMobile = Platform.OS !== 'web';
  const isMobilePlatform = isNativeMobile || isMobileWeb;

  const onMediaPress = (index: number) => {
    service.openMediaViewer(index);
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
        setNewBookmark(result.bookmark as any);
        setBookmarkGalleryVisible(true);
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
              <Avatar
                source={post.user.profile_photo}
                name={post.user.name}
                size={40}
                showStatus={false}
              />
            </TouchableOpacity>

            <View style={styles.nameCaption}>
              <View style={styles.usernameRow}>
                <Text style={[styles.username, { color: colors.text }]}>{post.user.name}</Text>
                {postLocation && (
                  <TouchableOpacity
                    onPress={() => openModal('location', { location: postLocation })}
                    style={[styles.locationPill, { backgroundColor: colors.tint + '10' }]}
                  >
                    <Ionicons name="location" size={10} color={colors.tint} />
                    <Text style={[styles.locationName, { color: colors.tint }]} numberOfLines={1}>{postLocation.name}</Text>
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
                    <Text style={[styles.caption, { color: colors.text }]}>
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
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

      </View>

      {/* Media Rendering */}
      {(visualMedia.length > 0 || extraMedia.length > 0 || detectedUrl) && (
        <View style={styles.mediaContainer}>
          {/* Visual Media Carousel */}
          {visualMedia.length > 0 && (
            <View>
              {visualMedia.length === 1 ? (
                <TouchableOpacity
                  onPress={() => onMediaPress(0)}
                >
                  {visualMedia[0].type === 'video' ? (
                    <PostVideoPlayer
                      uri={getMediaUrl(visualMedia[0].file_path)}
                      style={styles.singleMedia}
                      contentFit="cover"
                      shouldPlay={shouldPlay}
                      isMuted={true}
                      poster={getPosterUrl(visualMedia[0])}
                    />
                  ) : (
                    <ExpoImage
                      source={{ uri: `${getApiBaseImage()}/storage/${visualMedia[0].file_path}` }}
                      style={styles.singleMedia}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="disk"
                    />
                  )}
                </TouchableOpacity>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {visualMedia.map((media: { id: number | string; type: string; file_path: string }, index: number) => (
                    <TouchableOpacity
                      key={`${media.id}-${index}`}
                      onPress={() => onMediaPress(index)}
                      style={styles.multiMediaItem}
                    >
                      {media.type === 'video' ? (
                        <PostVideoPlayer
                          uri={getMediaUrl(media.file_path)}
                          style={styles.multiMediaContent}
                          contentFit="cover"
                          shouldPlay={shouldPlay}
                          isMuted={true}
                          poster={getPosterUrl(media)}
                        />
                      ) : (
                        <ExpoImage
                          source={{ uri: `${getApiBaseImage()}/storage/${media.file_path}` }}
                          style={styles.multiMediaContent}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="disk"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Interactive Media (Links) */}
          {detectedUrl && !extraMedia.some(m => m.file_path === detectedUrl) && (
            <LinkPreviewCard url={detectedUrl} />
          )}

          {extraMedia.map((media: { id?: number | string; type?: string; mime_type?: string; file_path: string }, index: number) => {
            if (media.type === 'link' || media.mime_type === 'text/url') {
              return <LinkPreviewCard key={media.id || index} url={media.file_path} />;
            }
            // Add other extra media types (PDF, etc.) here if needed
            return null;
          })}
        </View>
      )}
    </>
  );

  const reactions = currentPost.reactions || [];
  const reactionsByEmoji = reactions.reduce((acc: Record<string, number>, r: { reaction: string }) => {
    acc[r.reaction] = (acc[r.reaction] || 0) + 1;
    return acc;
  }, {});

  const myReactions = reactions.filter((r: { user_id: number | string }) => Number(r.user_id) === Number(user?.id)).map((r: { reaction: string }) => r.reaction);

  return (
    <Pressable
      style={styles.container}
      onLongPress={service.handleMenuPress}
      delayLongPress={300}
    >

      {/* Show Grouped Reposts if multiple people shared it */}
      {currentPost.reposts && currentPost.reposts.length > 1 && (
        <CuratorCircle
          reposters={currentPost.reposts.map((r: { user: any; context_tag?: string; personal_note?: string; created_at?: string }) => ({
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
      {service.mediaViewerVisible && (
        <MediaViewer
          visible={service.mediaViewerVisible}
          mediaItems={visualMedia}
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
            // Keep viewer open while comments are shown
            service.setShowComments(true);
          }}
          onDoubleTap={() => service.handleReact("❤️", post.id)}
          currentReactingItem={service.currentReactingItem}
          setCurrentReactingItem={service.setCurrentReactingItem}
          setIsEmojiPickerOpen={service.setIsEmojiPickerOpen}
          onCommentSubmit={async (content) => onCommentSubmit(post.id, content)}
          getGroupedReactions={(p) => service.getGroupedReactions(p as any)}
          isBookmarked={isBookmarked}
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
            { backgroundColor: colors.surface },
            service.isFullScreen && styles.fullScreenSheet,
            GlobalStyles.responsiveModal,
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
              indicatorStyle={activeScheme === 'dark' ? 'white' : 'black'}
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
                <Text style={[styles.noCommentsText, { color: colors.textSecondary }]}>No comments yet</Text>
              )}
            </ScrollView>

            {/* Comment input area with Keyboard Avoiding logic */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
              style={[styles.commentInputWrapper, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
            >
              <View style={[styles.commentInputContainer, { backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.commentInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  placeholder={
                    service.replyingTo ? "Replying to comment..." : "Write a comment..."
                  }
                  placeholderTextColor={colors.textSecondary + '80'}
                  value={service.commentText}
                  onChangeText={service.setCommentText}
                  multiline
                  editable={!service.isSubmittingComment}
                  keyboardAppearance={activeScheme}
                />
                <TouchableOpacity
                  style={[
                    styles.commentSubmitButton,
                    (!service.commentText.trim() || service.isSubmittingComment) && styles.commentSubmitButtonDisabled
                  ]}
                  onPress={() => { submitComment(); }}
                  disabled={!service.commentText.trim() || service.isSubmittingComment}
                >
                  {service.isSubmittingComment ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons
                      name="send"
                      size={20}
                      color="white"
                      style={styles.sendIcon}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      <Modal
        transparent
        visible={service.isEmojiPickerOpen && !service.currentReactingComment}
        animationType="fade"
        onRequestClose={() => service.setIsEmojiPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.commentsBackdrop}
          activeOpacity={1}
          onPress={() => service.setIsEmojiPickerOpen(false)}
        />
        <View style={[GlobalStyles.responsiveModal, { flex: 1, justifyContent: 'flex-end', zIndex: 6000 }]}>
          <EmojiPicker
            open={service.isEmojiPickerOpen && !service.currentReactingComment}
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
        </View>
      </Modal>

      {service.menuVisible && (
        <PostMenu
          visible={service.menuVisible}
          onClose={() => service.setMenuVisible(false)}
          onDelete={() => service.handleDelete(post.id)}
          onEdit={() => service.handleEdit(post)}
          onReport={service.handleReport}
          isOwner={isOwner}
          anchorPosition={service.menuPosition}
        />
      )}

      {service.reportVisible && (
        <ReportPost
          visible={service.reportVisible}
          postId={post.id}
          onClose={() => service.setReportVisible(false)}
          onReportSubmitted={service.handleReportSubmitted}
        />
      )}

      {tagSelectorVisible && (
        <ContextTagSelector
          visible={tagSelectorVisible}
          onClose={() => setTagSelectorVisible(false)}
          onConfirm={handleRepostWithContext}
        />
      )}

      {bookmarkGalleryVisible && (
        <BookmarkGallery
          visible={bookmarkGalleryVisible}
          onClose={() => setBookmarkGalleryVisible(false)}
          initialBookmark={newBookmark as any}
        />
      )}

    </Pressable>
  );
}

const getStyles = (colors: any, activeScheme: string): any => ({
  container: {
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
    alignSelf: 'flex-start',
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    maxWidth: 150,
  },
  locationName: {
    fontSize: 11,
    fontWeight: '600',
  },
  caption: {
    padding: 0,
    margin: 0,
    fontSize: 14,
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
  },
  singleMedia: {
    aspectRatio: 16 / 9,
    width: '100%',
    backgroundColor: '#000',
    minHeight: 200,
  },
  singleMediaContent: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#000',
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
    backgroundColor: '#000',
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
  },
  commentsList: {
  },
  noCommentsText: {
    textAlign: 'center',
    padding: 10,
    color: '#888',
  },

  commentInputWrapper: {
    width: '100%',
    borderTopWidth: 1,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    width: '100%',
  },
  commentInput: {
    flex: 1,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 20,
    padding: 6,
    paddingHorizontal: 10,
    marginRight: 10,
    marginBottom: 10,
  },
  commentSubmitButton: {
    backgroundColor: '#3498db',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3, // Slight offset to center the send icon
  },
  commentSubmitButtonDisabled: {
    backgroundColor: '#bedcf3',
  },
  sendIcon: {
    transform: [{ rotate: '-15deg' }], // Telegram-style slight tilt
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

const PostListItemMemo = React.memo(PostListItem, (prevProps, nextProps) => {
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.reactions_count === nextProps.post.reactions_count &&
    prevProps.post.comments_count === nextProps.post.comments_count &&
    prevProps.post.is_reposted === nextProps.post.is_reposted &&
    prevProps.shouldPlay === nextProps.shouldPlay
  );
});

export default PostListItemMemo;

