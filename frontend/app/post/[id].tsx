// app/post/[id].tsx
import React, { useEffect, useState, useRef, useContext } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  FlatList,
  Modal,
  Pressable,
  Dimensions,
  Alert,
  I18nManager
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePostStore } from '@/stores/postStore';
import { fetchPostById, commentOnPost, deleteReactionFromPost, deleteComment, reactToPost, reactToComment, deleteReactionFromComment } from '@/services/PostService';
import { fetchMarketItemById, bookmarkMarketItem, addMarketItemComment, deleteMarketItemComment, reactToComment as reactToMarketComment, deleteCommentReaction as deleteMarketCommentReaction, startItemChat } from '@/services/MarketService';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import RenderComments from '@/components/RenderComments';
import { useProfileView } from '@/context/ProfileViewContext';
import { useModal } from '@/context/ModalContext';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import getApiBaseImage from '@/services/getApiBaseImage';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '@/components/ui/IconButton';
import AuthContext from '@/context/AuthContext';
import EmojiPicker from 'rn-emoji-keyboard';
import { VideoView, useVideoPlayer } from 'expo-video';
import { usePostListService } from '@/services/PostListService';
import { createShadow } from '@/utils/styles';
import PostMenu from '@/components/PostMenu';
import { MediaViewer } from '@/components/MediaViewer';
import ReportPost from '@/components/ReportPost';
import { useReportedContentStore } from '@/stores/reportedContentStore';
import { deleteReportByTarget } from '@/services/ReportService';
import { useToastStore } from '@/stores/toastStore';
import { useMarketStore } from '@/stores/marketStore';
import MarketCard from '@/components/Market/MarketCard';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';
import { LinkPreviewCard } from '@/components/LinkPreviewCard';
import Avatar from '@/components/Image/Avatar';
import { useMemo } from 'react';
const isWeb = Platform.OS === 'web';
const isMobileWeb = isWeb && (
  (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) ||
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent : ''
  )
);
const isDesktopWeb = isWeb && !isMobileWeb;

const VideoCarouselItem = ({ uri, index, service, styles }: { uri: string, index: number, service: any, styles: any }) => {
  const player = useVideoPlayer(uri);
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.carouselItem}
      onPress={() => service.openMediaViewer(index)}
    >
      <View style={styles.videoWrapper}>
        <VideoView
          player={player}
          style={styles.carouselMedia}
          contentFit="cover"
          nativeControls={false}
        />
        <View style={styles.videoPlayOverlay}>
          <Ionicons name="play" size={48} color="white" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ImageCarouselItem = ({ uri, index, service, styles }: { uri: string, index: number, service: any, styles: any }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.carouselItem}
      onPress={() => service.openMediaViewer(index)}
    >
      <Image
        source={{ uri }}
        style={styles.carouselMedia}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
};

const PostDetailScreen = () => {
  const { colors, activeScheme } = useAppTheme();
  const { t, isRTL } = useTranslation();
  const styles = getStyles(colors, activeScheme as string, isRTL);
  const { id, highlightCommentId, returnTo, isMarket } = useLocalSearchParams();
  const { posts, addPost, updatePost } = usePostStore();
  const { addOrUpdateItem, items: marketItems } = useMarketStore();
  const { bookmarks, addBookmark, removeBookmark } = useBookmarkStore();
  const isBookmarked = bookmarks.some(b => 
    b && (isMarket === 'true' ? b.market_item_id === Number(id) : b.post_id === Number(id))
  );
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const { openModal } = useModal();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentReactingItem, setCurrentReactingItem] = useState<{ postId: number; commentId?: number } | null>(null);
  const [currentReactingComment, setCurrentReactingComment] = useState<{ postId: number; commentId: number } | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  const { user } = useContext(AuthContext);
  const postId = parseInt(id as string);

  // Use market store if it's a market item
  const marketItem = marketItems.find(i => i.id === postId);
  const post = isMarket === 'true' ? (marketItem as any) : posts.find(p => p.id === postId);
  const service = usePostListService(user);

  // Detect link in caption
  const detectedUrl = useMemo(() => {
    if (!post?.caption) return null;
    const urlRegex = /((https?:\/\/|www\.)[^\s\n\r]+)/g;
    const matches = post.caption.match(urlRegex);
    if (!matches) return null;

    let url = matches[0];
    if (url.endsWith('.') || url.endsWith(',') || url.endsWith(')')) {
      url = url.slice(0, -1);
    }
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }
    return url;
  }, [post?.caption]);

  const scrollViewRef = useRef<ScrollView>(null);
  const commentsSectionRef = useRef<View>(null);
  const highlightAnimation = useRef(new Animated.Value(0)).current;
  const { isReported, addReportedItem, removeReportedItem } = useReportedContentStore();
  const { showToast } = useToastStore();

  const handleStalePost = async () => {
    const isBookmarked = bookmarks.some(b => 
      isMarket === 'true' ? b.market_item_id === postId : b.post_id === postId
    );
    if (isBookmarked) {
      Alert.alert(
        (isMarket === 'true' ? 'Item' : 'Post') + ' Unavailable',
        'This ' + (isMarket === 'true' ? 'item' : 'post') + ' has been deleted from the server and was removed from your bookmarks.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      if (isMarket === 'true') {
        await useBookmarkStore.getState().removeMarketBookmark(postId);
      } else {
        await removeBookmark(postId);
      }
    } else {
      Alert.alert(
        (isMarket === 'true' ? 'Item' : 'Post') + ' Gone',
        'This ' + (isMarket === 'true' ? 'item' : 'post') + ' is no longer available.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  useEffect(() => {
    // If post not found in store, fetch it
    if (!post && postId) {
      const fetchData = async () => {
        setLoading(true);
        try {
          if (isMarket === 'true') {
            const marketData = await fetchMarketItemById(postId);
            if (marketData) {
              addOrUpdateItem(marketData);
            }
          } else {
            const postData = await fetchPostById(postId);
            if (postData) {
              addPost(postData);
            }
          }
        } catch (error: any) {
          console.error('Error fetching data:', error);
          if (error.response?.status === 404) {
            handleStalePost();
          }
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [postId, post, addPost, addOrUpdateItem, bookmarks, isMarket]);

  // Handle comment highlighting when highlightCommentId changes
  useEffect(() => {
    if (highlightCommentId) {
      setHighlightedCommentId(highlightCommentId as string);
      setShowComments(true); // FORCE SHOW COMMENTS

      // Animate highlight
      Animated.sequence([
        Animated.timing(highlightAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(highlightAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]).start();

      // Initial scroll to comments section
      setTimeout(() => {
        commentsSectionRef.current?.measure((x, y, width, height, pageX, pageY) => {
          scrollViewRef.current?.scrollTo({ y: y + pageY - 100, animated: true });
        });
      }, 500);
    }
  }, [highlightCommentId]);

  const handleCommentLayout = (commentId: string, y: number) => {
    if (highlightCommentId === commentId) {
      commentsSectionRef.current?.measure((_x, _y, _width, _height, _pageX, pageY) => {
        // Y is relative to the start of RenderComments
        scrollViewRef.current?.scrollTo({ y: pageY + y - 80, animated: true });
      });
    }
  };

  console.log('📱 PostDetailScreen opened with:', {
    id: postId,
    highlightCommentId,
    postFound: !!post,
    loading
  });

  // Handle post reaction
  const handleReact = async (emoji: string) => {
    if (!post) return;

    try {
      await reactToPost(post.id, emoji);
      // Refresh post data
      const postData = await fetchPostById(postId);
      if (postData) {
        addPost(postData);
      }
    } catch (error: any) {
      console.error('Error reacting to post:', error);
      if (error.response?.status === 404) handleStalePost();
    }
  };

  // Handle comment reaction
  const handleReactComment = async (emoji: string, commentId: number) => {
    try {
      if (isMarket === 'true') {
        await reactToMarketComment(postId, commentId, emoji);
        const marketData = await fetchMarketItemById(postId);
        if (marketData) addOrUpdateItem(marketData);
      } else {
        await reactToComment(postId, commentId, emoji);
        const postData = await fetchPostById(postId);
        if (postData) addPost(postData);
      }
    } catch (error: any) {
      console.error('Error reacting to comment:', error);
      if (error.response?.status === 404) handleStalePost();
    }
  };

  // Handle delete post reaction
  const handleDeletePostReaction = async () => {
    if (!post) return;

    try {
      await deleteReactionFromPost(post.id);
      // Refresh post data
      const postData = await fetchPostById(postId);
      if (postData) {
        addPost(postData);
      }
    } catch (error: any) {
      console.error('Error deleting post reaction:', error);
      if (error.response?.status === 404) handleStalePost();
    }
  };

  const handleProfilePress = (userId: string) => {
    setProfileViewUserId(userId);
    setProfilePreviewVisible(true);
  };

  const handleReply = (comment: any) => {
    setCommentText(`@${comment.user.name} `);
  };

  const handleReactCommentPress = (commentId: number) => {
    setCurrentReactingComment({ postId, commentId });
    setIsEmojiPickerOpen(true);
  };

  const handleDeleteCommentReaction = async (commentId: number, emoji: string) => {
    try {
      if (isMarket === 'true') {
        await deleteMarketCommentReaction(commentId);
        const marketData = await fetchMarketItemById(postId);
        if (marketData) addOrUpdateItem(marketData);
      } else {
        await deleteReactionFromComment(commentId);
        const postData = await fetchPostById(postId);
        if (postData) addPost(postData);
      }
    } catch (error: any) {
      console.error('Error deleting comment reaction:', error);
      if (error.response?.status === 404) handleStalePost();
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      if (isMarket === 'true') {
        await deleteMarketItemComment(postId, commentId);
        const marketData = await fetchMarketItemById(postId);
        if (marketData) addOrUpdateItem(marketData);
      } else {
        await deleteComment(postId, commentId);
        const postData = await fetchPostById(postId);
        if (postData) addPost(postData);
      }
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      if (error.response?.status === 404) handleStalePost();
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmitting || !post) return;

    setIsSubmitting(true);
    try {
      const comment = isMarket === 'true' 
        ? await addMarketItemComment(postId, commentText.trim())
        : await commentOnPost(postId, commentText.trim());

      // Refresh post/market data to get updated comments and other metadata
      if (isMarket === 'true') {
        const marketData = await fetchMarketItemById(postId);
        if (marketData) addOrUpdateItem(marketData);
      } else {
        // Optimistic update for immediate feedback (only for posts for now to keep it simple)
        const formattedComment = {
          id: comment.id,
          content: comment.content,
          user_id: comment.user_id,
          user: {
            id: user?.id || comment.user.id,
            name: user?.name || comment.user.name,
            profile_photo: user?.profile_photo || comment.user.profile_photo
          },
          post_id: comment.post_id,
          parent_id: comment.parent_id,
          replies: [],
          reaction_counts: [],
          reactions: [],
          reaction_comments: [],
          reaction_comments_count: 0
        };
        usePostStore.getState().updatePostWithNewComment(Number(postId), formattedComment as any);
        
        const postData = await fetchPostById(postId);
        if (postData) addPost(postData);
      }
      setCommentText('');
    } catch (error: any) {
      console.error('Error submitting comment:', error);
      if (error.response?.status === 404) handleStalePost();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikePost = async () => {
    try {
      await handleReact('❤️');
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleSharePost = async () => {
    if (post) {
      openModal('share', { post });
    }
  };

  const handleOpenMenu = (event: any) => {
    const { pageY, pageX } = event.nativeEvent;
    setMenuPosition({ top: pageY, left: pageX });
    setMenuVisible(true);
  };

  const handleOpenMediaViewer = (index: number) => {
    setMediaViewerIndex(index);
    setMediaViewerVisible(true);
  };

  const handleBookmarkPost = async () => {
    if (!post) return;
    try {
      if (isMarket === 'true') {
        const response = await bookmarkMarketItem(post.id);
        useBookmarkStore.getState().loadBookmarks();
        if (response.bookmarked) {
          showToast('Item bookmarked!', 'success');
          router.push({
            pathname: '/settings/bookmarks',
            params: { initialMarketItemId: post.id }
          });
        } else {
          showToast('Bookmark removed', 'info');
        }
      } else {
        const result = await addBookmark(post.id);
        if (result.bookmarked && result.bookmark) {
          showToast('Post bookmarked!', 'success');

          if (mediaViewerVisible) {
            setMediaViewerVisible(false);
          }

          router.push({
            pathname: '/settings/bookmarks',
            params: { initialPostId: post.id }
          });
        } else {
          showToast('Bookmark removed', 'info');
        }
      }
    } catch (error) {
      console.error('Error bookmarking:', error);
      showToast("Failed to bookmark", 'error');
    }
  };
  
  const handleChatPress = async () => {
    if (!post || isMarket !== 'true') return;
    
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const response = await startItemChat(post.id);
      if (response.space) {
        // Automatically send the item share so the owner knows the context
        const collaborationService = CollaborationService.getInstance();
        const baseUrl = getApiBaseImage();
        
        const metadata = {
          post_id: post.id,
          is_market: true,
          creator_name: post.user?.name || 'Anonymous',
          creator_avatar: post.user?.profile_photo,
          media: post.media || [],
          caption: post.caption,
          is_internal_share: true,
          post_url: `${baseUrl}/post/${post.id}`,
        };

        await collaborationService.sendMessage(response.space.id, {
          content: `${t('inquiry_about')}: ${post.title || 'Market Item'}`,
          type: 'post_share',
          metadata
        });

        router.push(`/(spaces)/${response.space.id}`);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const handleToggleReport = async () => {
    const isReported = useReportedContentStore.getState().isReported('post', Number(postId));
    if (isReported) {
      try {
        await deleteReportByTarget('post', Number(postId));
        useReportedContentStore.getState().removeReportedItem('post', Number(postId));
        useToastStore.getState().showToast('Report removed successfully', 'success');
      } catch (error) {
        console.error('Failed to remove report:', error);
        useToastStore.getState().showToast('Failed to remove report', 'error');
      }
    } else {
      setShowReportModal(true);
    }
  };

  // Get grouped reactions for post
  const groupedReactions = useMemo(() => {
    if (!post?.reactions) return [];

    const reactionMap = new Map();
    post.reactions.forEach(reaction => {
      const existing = reactionMap.get(reaction.emoji) || { count: 0, user_ids: [] };
      reactionMap.set(reaction.emoji, {
        count: existing.count + 1,
        user_ids: [...existing.user_ids, reaction.user_id]
      });
    });

    return Array.from(reactionMap.entries())
      .map(([emoji, { count, user_ids }]) => ({
        emoji,
        count,
        user_ids
      }))
      .sort((a, b) => b.count - a.count);
  }, [post?.reactions]);

  // Check if user has reacted to post
  const userHasReacted = useMemo(() => {
    if (!post?.reactions || !user) return false;
    return post.reactions.some(reaction => reaction.user_id === Number(user.id));
  }, [post?.reactions, user?.id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={styles.loadingText}>Loading post...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.errorText}>Post not found</Text>
        <BackButton
          onPress={() => {
            if (returnTo) {
              router.replace(returnTo as any);
            } else {
              router.back();
            }
          }}
        />
      </View>
    );
  }

  const interpolatedBackgroundColor = highlightAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', activeScheme === 'dark' ? 'rgba(52, 152, 219, 0.2)' : '#e6f3ff']
  });


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.webWrapper}>
        {/* Header with Back Button - Premium Blur Header */}
        <BlurView intensity={80} tint={activeScheme as any} style={styles.header}>
          <BackButton
            onPress={() => {
              if (returnTo) {
                router.replace(returnTo as any);
              } else {
                router.back();
              }
            }}
          />
          <Text style={styles.headerTitle}>{isMarket === 'true' ? 'Market Item' : 'Post'}</Text>
          <View style={styles.headerSpacer}>
            {post && !isMarket && isReported('post', post.id) && (
              <TouchableOpacity
                onPress={() => handleToggleReport()}
                style={styles.headerIcon}
              >
                <Ionicons name="flag" size={22} color="#ff3040" />
              </TouchableOpacity>
            )}
            {!isMarket && (
              <TouchableOpacity
                onPress={handleSharePost}
                style={styles.headerIcon}
              >
                <Ionicons name="share-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </BlurView>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {isMarket === 'true' ? (
            <MarketCard
              item={post as any}
              onProfilePress={handleProfilePress}
              onChatPress={handleChatPress}
              initialShowComments={showComments}
              hideCommentSystem={false}
            />
          ) : (
            <View>
              {/* Post Header */}
              <View style={styles.postHeader}>
                <TouchableOpacity
                  style={styles.userInfo}
                  onPress={() => post.user && handleProfilePress(post.user.id.toString())}
                >
                  <View style={{ marginRight: 8 }}>
                    <Avatar
                      source={post.user?.profile_photo}
                      name={post.user?.name || 'User'}
                      size={32}
                      showStatus={false}
                    />
                  </View>
                  <Text style={styles.userName}>{post.user?.name}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreButton} onPress={handleOpenMenu}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Post Content */}
              <View style={styles.postContent}>
                <Text style={styles.contentText}>
                  <Text style={styles.userName}>{post.user?.name} </Text>
                  {post.caption || post.content}
                </Text>
                {post.caption && post.content && post.caption !== post.content && (
                  <Text style={styles.additionalContent}>
                    {post.content}
                  </Text>
                )}

                {/* Link Previews */}
                {detectedUrl && (
                  <View style={{ marginTop: 10 }}>
                    <LinkPreviewCard url={detectedUrl} />
                  </View>
                )}

                {post.media?.map((media: any, index: number) => {
                  if (media.type === 'link' || media.mime_type === 'text/url') {
                    return (
                      <View key={`link-${index}`} style={{ marginTop: 10 }}>
                        <LinkPreviewCard url={media.file_path || media.url} />
                      </View>
                    );
                  }
                  return null;
                })}
              </View>

              {/* Post media – Premium Gallery */}
              {post.media && post.media.length > 0 && (
                <View style={styles.premiumMediaContainer}>
                  {(() => {
                    const sortedMedia = [...post.media].sort((a, b) => {
                      if (a.type === 'video' && b.type !== 'video') return 1;
                      if (a.type !== 'video' && b.type === 'video') return -1;
                      return 0;
                    });

                    const containerWidth = Dimensions.get('window').width * (isDesktopWeb ? 0.8 : 1.0);

                    return (
                      <>
                        <FlatList
                          data={sortedMedia}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          snapToInterval={containerWidth}
                          snapToAlignment="start"
                          decelerationRate="fast"
                          onMomentumScrollEnd={(e) => {
                            const index = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
                            setActiveMediaIndex(index);
                          }}
                          keyExtractor={(item, index) => `${item.id}-${index}`}
                          initialNumToRender={1}
                          maxToRenderPerBatch={2}
                          windowSize={3}
                          removeClippedSubviews={Platform.OS !== 'web'}
                          renderItem={({ item, index }: { item: any, index: number }) => {
                            const mediaUrl = (item.file_path || item.url || '').startsWith('http')
                              ? (item.file_path || item.url || '')
                              : `${getApiBaseImage()}/storage/${item.file_path}`;

                            if (item.type === 'video') {
                              return (
                                <View style={{ width: containerWidth }}>
                                  <VideoCarouselItem uri={mediaUrl} index={index} service={{ ...service, openMediaViewer: handleOpenMediaViewer }} styles={styles} />
                                </View>
                              );
                            }
                            return (
                              <View style={{ width: containerWidth }}>
                                <ImageCarouselItem uri={mediaUrl} index={index} service={{ ...service, openMediaViewer: handleOpenMediaViewer }} styles={styles} />
                              </View>
                            );
                          }}
                        />
                        {sortedMedia.length > 1 && (
                          <View style={styles.paginationContainer}>
                            {sortedMedia.map((_, i) => (
                              <View
                                key={i}
                                style={[
                                  styles.paginationDot,
                                  activeMediaIndex === i && styles.paginationDotActive
                                ]}
                              />
                            ))}
                          </View>
                        )}
                      </>
                    );
                  })()}
                </View>
              )}

              {/* Post Actions */}
              <View style={styles.postActions}>
                <View style={styles.leftActions}>
                  {groupedReactions.length === 0 && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        setCurrentReactingItem({ postId: post.id });
                        setIsEmojiPickerOpen(true);
                      }}
                    >
                      <Ionicons
                        name={userHasReacted ? "heart" : "heart-outline"}
                        size={28}
                        color={userHasReacted ? "#ff3040" : colors.text}
                      />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      setShowComments(true);
                      setTimeout(() => {
                        commentsSectionRef.current?.measure((x, y, width, height, pageX, pageY) => {
                          scrollViewRef.current?.scrollTo({ y: pageY - 100, animated: true });
                        });
                      }, 100);
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={26} color={colors.text} />
                    {(post.comments_count ?? 0) > 0 && (
                      <View style={styles.commentCountBadge}>
                        <Text style={styles.commentCountText}>{post.comments_count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton} onPress={handleSharePost}>
                    <Ionicons name="paper-plane-outline" size={26} color={colors.text} />
                  </TouchableOpacity>

                  {/* Post Reactions */}
                  {groupedReactions.length > 0 && (
                    <View style={styles.reactionsContainer}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.reactionsList}>
                          {groupedReactions.map((reaction, index) => {
                            const isMyReaction = reaction.user_ids.includes(Number(user?.id));
                            return (
                              <TouchableOpacity
                                key={index}
                                style={[
                                  styles.reactionItem,
                                  isMyReaction && styles.reactionItemMine
                                ]}
                                onPress={() => isMyReaction ? handleDeletePostReaction() : handleReact(reaction.emoji)}
                              >
                                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                                {reaction.count > 1 && (
                                  <Text style={[
                                    styles.reactionCount,
                                    isMyReaction && styles.reactionCountMine
                                  ]}>
                                    {reaction.count}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                          <TouchableOpacity
                            style={styles.addReactionButton}
                            onPress={() => {
                              setCurrentReactingItem({ postId: post.id });
                              setIsEmojiPickerOpen(true);
                            }}
                          >
                            <Ionicons name="add" size={16} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </View>
                <TouchableOpacity style={styles.actionButton} onPress={handleBookmarkPost}>
                  <Ionicons
                    name={isBookmarked ? "bookmark" : "bookmark-outline"}
                    size={26}
                    color={isBookmarked ? "#10b981" : colors.text}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <TouchableOpacity
              style={styles.commentsHeader}
              onPress={() => setShowComments(!showComments)}
            >
              <Text style={styles.commentsTitle}>
                Comments • {post.comments_count ?? 0}
              </Text>
              <Ionicons
                name={showComments ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <Animated.View
              ref={commentsSectionRef}
              style={[styles.highlightContainer, { backgroundColor: interpolatedBackgroundColor }]}
            >
              <RenderComments
                user={user}
                service={{
                  setCurrentReactingComment: setCurrentReactingComment,
                  setCurrentReactingItem: setCurrentReactingItem,
                  setIsEmojiPickerOpen: setIsEmojiPickerOpen,
                  handleReactComment: handleReactComment,
                  isEmojiPickerOpen: isEmojiPickerOpen,
                  currentReactingComment: currentReactingComment
                }}
                postId={post.id}
                onProfilePress={handleProfilePress}
                onReply={handleReply}
                onReactComment={handleReactCommentPress}
                onDeleteCommentReaction={handleDeleteCommentReaction}
                onDeleteComment={handleDeleteComment}
                highlightedCommentId={highlightedCommentId}
                onCommentLayout={handleCommentLayout}
                overrideComments={isMarket === 'true' ? post.comments : undefined}
                hideReactions={false}
              />
            </Animated.View>
          </View>
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          style={styles.commentInputWrapper}
        >
            <View style={styles.commentInputContainer}>
              <View style={{ marginRight: 8 }}>
                <Avatar
                  source={user?.profile_photo}
                  name={user?.name || 'User'}
                  size={32}
                  showStatus={false}
                />
              </View>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textSecondary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.commentSubmitButton,
                  (!commentText.trim() || isSubmitting) && styles.commentSubmitButtonDisabled
                ]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || isSubmitting}
              >
                {isSubmitting ? (
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

      {/* Overlays & Modals */}
      <PostMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onDelete={() => {
          setMenuVisible(false);
          if (post) service.handleDelete(post.id);
        }}
        onEdit={() => {
          setMenuVisible(false);
          if (post) service.handleEdit(post as any);
        }}
        onReport={() => {
          setMenuVisible(false);
          handleToggleReport();
        }}
        isOwner={post && post.user ? service.isOwner(post.user.id) : false}
        anchorPosition={menuPosition}
      />

      {post && (
        <MediaViewer
          visible={mediaViewerVisible}
          mediaItems={post.media as any}
          startIndex={mediaViewerIndex}
          onClose={() => setMediaViewerVisible(false)}
          post={post as any}
          getApiBaseImage={getApiBaseImage}
          onNavigateNext={() => { }}
          onNavigatePrev={() => { }}
          onReact={handleReact}
          onDeleteReaction={handleDeletePostReaction}
          onRepost={() => { }}
          onShare={handleSharePost}
          onBookmark={handleBookmarkPost}
          onCommentPress={() => {
            setMediaViewerVisible(false);
            setShowComments(true);
            setTimeout(() => {
              commentsSectionRef.current?.measure((x, y, width, height, pageX, pageY) => {
                scrollViewRef.current?.scrollTo({ y: pageY - 100, animated: true });
              });
            }, 300);
          }}
          onDoubleTap={() => handleReact('❤️')}
          currentReactingItem={currentReactingItem}
          setCurrentReactingItem={setCurrentReactingItem}
          setIsEmojiPickerOpen={setIsEmojiPickerOpen}
          isBookmarked={isBookmarked}
          onCommentSubmit={async (content) => commentOnPost(post.id, content)}
          getGroupedReactions={(p) => service.getGroupedReactions(p as any)}
          handleReactComment={(emoji) => { }}
          deleteCommentReaction={(emoji) => { }}
        />
      )}

      {/* Emoji Picker */}
      <EmojiPicker
        open={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onEmojiSelected={(emoji) => {
          if (currentReactingComment) {
            handleReactComment(emoji.emoji, currentReactingComment.commentId);
          } else if (currentReactingItem) {
            handleReact(emoji.emoji);
          }
          setIsEmojiPickerOpen(false);
          setCurrentReactingItem(null);
          setCurrentReactingComment(null);
        }}
        emojiSize={28}
      />

      <ReportPost
        visible={showReportModal}
        postId={Number(id)}
        type="post"
        onClose={() => setShowReportModal(false)}
        onReportSubmitted={(reportId) => {
          setShowReportModal(false);
        }}
      />
    </KeyboardAvoidingView>
  );
};

const getStyles = (colors: any, activeScheme: string, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: isDesktopWeb ? 'center' : 'stretch',
  },
  webWrapper: {
    width: '100%',
    // maxWidth: Platform.OS === 'web' ? '80%' : '100%',
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: activeScheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
    zIndex: 10,
  },
  headerIcon: {
    padding: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
  },
  headerSpacer: {
    width: 60,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: 20,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  userName: {
    fontWeight: '600',
    fontSize: 14,
    color: colors.text,
  },
  moreButton: {
    padding: 4,
  },
  postMedia: {
    width: '100%',
    height: 400,
    backgroundColor: colors.muted,
  },
  premiumMediaContainer: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  carouselItem: {
    width: isDesktopWeb ? Dimensions.get('window').width * 0.8 : Dimensions.get('window').width,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselMedia: {
    width: '100%',
    height: '100%',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  paginationContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  paginationDotActive: {
    backgroundColor: '#fff',
    width: 14,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
    marginRight: 12,
  },
  reactionsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reactionsList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 15,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  reactionItemMine: {
    borderColor: colors.primary,
    backgroundColor: activeScheme === 'dark' ? 'rgba(52, 152, 219, 0.2)' : 'rgba(52, 152, 219, 0.1)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
    color: colors.textSecondary,
  },
  reactionCountMine: {
    color: colors.primary,
    fontWeight: '600',
  },
  addReactionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  postStats: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  likesCount: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
    color: colors.text,
  },
  timestamp: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  postContent: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  additionalContent: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: 8,
    color: colors.textSecondary,
  },
  commentsSection: {
    paddingBottom: 80,
  },
  commentsTitle: {
    fontWeight: '600',
    fontSize: 14,
    padding: 12,
    color: colors.textSecondary,
  },
  highlightContainer: {
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  commentInputWrapper: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  commentInputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.surface,
  },
  currentUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    [isRTL ? 'marginLeft' : 'marginRight']: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    maxHeight: 80,
    [isRTL ? 'marginLeft' : 'marginRight']: 8,
    backgroundColor: colors.surface,
    textAlign: isRTL ? 'right' : 'left',
  },
  commentSubmitButton: {
    backgroundColor: colors.tint,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    [isRTL ? 'paddingRight' : 'paddingLeft']: 3,
  },
  commentSubmitButtonDisabled: {
    backgroundColor: colors.muted,
    opacity: 0.5,
  },
  sendIcon: {
    transform: [{ rotate: isRTL ? '165deg' : '-15deg' }],
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
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commentCountBadge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: colors.error || '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  commentCountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default PostDetailScreen;