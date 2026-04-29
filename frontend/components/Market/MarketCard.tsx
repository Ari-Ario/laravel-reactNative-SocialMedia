import React, { useState, useRef, useMemo } from 'react';
import { router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal, ScrollView, KeyboardAvoidingView, TextInput, ActivityIndicator, Platform, Pressable, Alert, Clipboard } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/constants/i18n';
import { useAppTheme } from '@/hooks/useAppTheme';
import { MarketItem } from '@/services/MarketService';
import getApiBaseImage from '@/services/getApiBaseImage';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMarketStore } from '@/stores/marketStore';
import { PostActionButtons } from '../PostActionButtons';
import GenericMenu from '../GenericMenu';
import RenderComments from '../RenderComments';
import { MediaViewer } from '../MediaViewer';
import EmojiPicker from 'rn-emoji-keyboard';
import { useModal } from '@/context/ModalContext';
import { useToastStore } from '@/stores/toastStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { reactToMarketItem, deleteMarketItemReaction, addMarketItemComment, deleteMarketItemComment, reactToComment, deleteCommentReaction, bookmarkMarketItem, repostMarketItem } from '@/services/MarketService';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { CuratorFrame } from '../CuratorFrame';
import { CuratorCircle } from '../CuratorCircle';
import { ContextTagSelector } from '../ContextTagSelector';
import { LinkPreviewCard } from '../LinkPreviewCard';

const PostVideoPlayer = React.lazy(() => import('../PostVideoPlayer').then(module => ({ default: module.PostVideoPlayer })));

const VideoFallback = ({ posterUrl, style }: { posterUrl?: string, style: any }) => (
  <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
    {posterUrl && (
      <ExpoImage
        source={{ uri: posterUrl }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        cachePolicy="disk"
      />
    )}
    <Ionicons name="play-circle" size={50} color="rgba(255,255,255,0.7)" />
  </View>
);

const { width } = Dimensions.get('window');

interface MarketCardProps {
  item: MarketItem;
  onPress?: () => void;
  onChatPress?: () => void;
  onProfilePress?: (userId: string) => void;
  initialShowComments?: boolean;
  hideCommentSystem?: boolean;
}

export default function MarketCard({ item, onPress, onChatPress, onProfilePress, initialShowComments = false, hideCommentSystem = false }: MarketCardProps) {
  const { t, isRTL } = useTranslation();
  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, activeScheme);
  const currentUser = useAuthStore(state => state.user);
  const updateItemLocally = useMarketStore(state => state.updateItemLocally);
  const { openModal } = useModal();
  const { showToast } = useToastStore();
  const containerRef = useRef<View>(null);

  // States
  const [showComments, setShowComments] = useState(initialShowComments);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [currentReactingItem, setCurrentReactingItem] = useState<{ postId: number, commentId?: number } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<{ title: string, description: string | null } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [tagSelectorVisible, setTagSelectorVisible] = useState(false);

  const isBookmarked = item.bookmarks?.some((b: any) => b.user_id === currentUser?.id) || false;

  // Detect link in description only
  const detectedUrl = useMemo(() => {
    if (!item.description) return null;
    
    const urlRegex = /((https?:\/\/|www\.)[^\s\n\r]+)/g;
    const matches = item.description.match(urlRegex);
    if (!matches) return null;

    let url = matches[0];
    // Clean up trailing punctuation
    if (url.endsWith('.') || url.endsWith(',') || url.endsWith(')')) {
      url = url.slice(0, -1);
    }
    // Prefix www with https if missing
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }
    return url;
  }, [item.description]);

  const { visualMedia, extraMedia } = useMemo(() => {
    const media = item.media || [];
    // Be lenient: if type is missing, treat as image if it has a file_path
    const visual = media.filter(m =>
      !m.type ||
      m.type === 'image' ||
      m.type === 'video' ||
      m.file_path?.match(/\.(jpg|jpeg|png|gif|mp4|mov)$/i)
    );
    const extra = media.filter(m => !visual.includes(m));
    return { visualMedia: visual, extraMedia: extra };
  }, [item.media]);

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

  const isOwner = currentUser?.id === item.user_id;
  


  const postStyleObject = useMemo(() => ({
    id: item.id,
    comments_count: item.comments?.length || 0,
    comments: item.comments || [],
    reposts_count: item.reposts?.length || 0,
    is_reposted: item.reposts?.some((r: any) => r.user_id === currentUser?.id),
    reactions: item.reactions || [],
    reaction_counts: item.reaction_counts || item.reactionCounts || [],
    caption: item.description,
    user: item.user,
    media: item.media,
    is_market: true
  }), [item, currentUser?.id]);

  const getGroupedReactions = (p: any, userId?: number) => {
    if (!p.reactions || p.reactions.length === 0) {
      return [{ emoji: '🤍', count: 0, user_ids: [] }];
    }

    const reactionMap = new Map<string, { count: number, user_ids: number[] }>();

    for (const reaction of p.reactions) {
      const existing = reactionMap.get(reaction.emoji) || { count: 0, user_ids: [] };
      reactionMap.set(reaction.emoji, {
        count: existing.count + 1,
        user_ids: [...existing.user_ids, reaction.user_id]
      });
    }

    return [...reactionMap.entries()]
      .map(([emoji, { count, user_ids }]) => ({
        emoji,
        count,
        user_ids
      }))
      .sort((a, b) => b.count - a.count);
  };

  const handleReact = async (emoji: string) => {
    try {
      const response = await reactToMarketItem(item.id, emoji);
      updateItemLocally(item.id, (oldItem) => ({
        ...oldItem,
        reaction_counts: response.reaction_counts,
        reactions: [...(oldItem.reactions || []).filter(r => r.user_id !== currentUser?.id), response.reaction]
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteReaction = async () => {
    try {
      const response = await deleteMarketItemReaction(item.id);
      updateItemLocally(item.id, (oldItem) => ({
        ...oldItem,
        reactionCounts: response.reaction_counts,
        reactions: (oldItem.reactions || []).filter(r => r.user_id !== currentUser?.id)
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const { locale } = useTranslation();

  const handleTranslate = React.useCallback(async () => {
    if (!item.title && !item.description) return;

    if (isTranslated) {
      setIsTranslated(false);
      setTranslatedContent(null);
      return;
    }

    setIsTranslating(true);
    try {
      const targetLang = locale || 'en';
      const langpair = `autodetect|${targetLang}`;

      const qTitle = encodeURIComponent(item.title);
      const resTitle = await fetch(`https://api.mymemory.translated.net/get?q=${qTitle}&langpair=${langpair}`);
      const dataTitle = await resTitle.json();

      let tTitle = item.title;
      if (dataTitle?.responseData?.translatedText) {
        tTitle = dataTitle.responseData.translatedText;
      }

      let tDesc = item.description;
      if (item.description) {
        const qDesc = encodeURIComponent(item.description);
        const resDesc = await fetch(`https://api.mymemory.translated.net/get?q=${qDesc}&langpair=${langpair}`);
        const dataDesc = await resDesc.json();
        if (dataDesc?.responseData?.translatedText) {
          tDesc = dataDesc.responseData.translatedText;
        }
      }

      setTranslatedContent({ title: tTitle, description: tDesc });
      setIsTranslated(true);
    } catch (e) {
      console.error('Market translation failed:', e);
      Alert.alert(t('error'), t('could_not_translate'));
    } finally {
      setIsTranslating(false);
    }
  }, [item, isTranslated, locale, t]);

  const handleEmojiSelected = async (emoji: string) => {
    setIsEmojiPickerOpen(false);
    handleReact(emoji);
  };

  const handleBookmark = async () => {
    try {
      const response = await bookmarkMarketItem(item.id);
      updateItemLocally(item.id, (oldItem) => {
        const bookmarks = oldItem.bookmarks || [];
        if (response.bookmarked) {
          return { ...oldItem, bookmarks: [...bookmarks, response.bookmark] };
        } else {
          return { ...oldItem, bookmarks: bookmarks.filter(b => b.user_id !== currentUser?.id) };
        }
      });
      // Update bookmark store to ensure settings/bookmarks page is in sync
      useBookmarkStore.getState().loadBookmarks();

      if (response.bookmarked) {
        showToast(response.message, 'success');
        
        // Navigate to the bookmarks settings page which acts as the official popup
        router.push({
          pathname: '/settings/bookmarks',
          params: { initialMarketItemId: item.id }
        });
      } else {
        showToast(response.message, 'info');
      }
    } catch (e) {
      console.error(e);
      showToast(t('failed_to_bookmark'), 'error');
    }
  };

  const onRepostPress = () => {
    setTagSelectorVisible(true);
  };

  const handleRepostSubmit = async (tag?: string, note?: string) => {
    setTagSelectorVisible(false);
    try {
      const response = await repostMarketItem(item.id, tag, note);
      updateItemLocally(item.id, (oldItem) => {
        const reposts = oldItem.reposts || [];
        if (response.reposted) {
          return { ...oldItem, reposts: [...reposts, response.repost] };
        } else {
          return { ...oldItem, reposts: reposts.filter((r:any) => r.user_id !== currentUser?.id) };
        }
      });
      showToast(response.message, 'success');
    } catch (e) {
      console.error(e);
      showToast(t('failed_to_repost'), 'error');
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const comment = await addMarketItemComment(item.id, commentText, replyingTo || undefined);
      updateItemLocally(item.id, (oldItem) => ({
        ...oldItem,
        comments: [...(oldItem.comments || []), comment]
      }));
      setCommentText('');
      setReplyingTo(null);
    } catch (e) {
      showToast(t('failed_to_comment'), 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCopyLink = () => {
    const url = `https://ari-ario.com/market/${item.id}`; // Replace with actual base URL
    Clipboard.setString(url);
    showToast(t('link_copied'), 'success');
  };

  const handleDelete = React.useCallback(async () => {
    console.log('🗑️ Attempting to delete item:', item.id);
    
    let confirmed = false;
    if (Platform.OS === 'web') {
      confirmed = window.confirm(t('are_you_sure_delete_item'));
    } else {
      confirmed = await new Promise((resolve) => {
        Alert.alert(
          t('delete_item'),
          t('are_you_sure_delete_item'),
          [
            { text: t('cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('delete'), style: 'destructive', onPress: () => resolve(true) }
          ]
        );
      });
    }

    if (confirmed) {
      try {
        console.log('🚮 Confirming deletion for:', item.id);
        await useMarketStore.getState().removeItem(item.id);
        showToast(t('item_deleted'), 'success');
      } catch (e) {
        console.error('❌ Deletion failed:', e);
        showToast(t('failed_to_delete'), 'error');
      }
    }
  }, [item.id, t, showToast]);

  const handleMenuPress = (e: any) => {
    const { pageY, pageX } = e.nativeEvent;
    setMenuPosition({ top: pageY, left: pageX });
    setMenuVisible(true);
  };

  const marketMenuItems = useMemo(() => {
    const items: any[] = [];
    if (isOwner) {
      items.push({
        icon: 'trash-outline',
        label: t('delete'),
        destructive: true,
        onPress: () => {
          setMenuVisible(false);
          handleDelete();
        }
      });
      items.push({
        icon: 'create-outline',
        label: t('edit'),
        onPress: () => {
          setMenuVisible(false);
          openModal('create-market-item', { editItem: item });
        }
      });
    } else {
      items.push({
        icon: 'flag-outline',
        label: t('report'),
        onPress: () => {
          setMenuVisible(false);
          openModal('report', { postId: item.id, type: 'market' });
        }
      });
    }

    items.push({
      icon: 'copy-outline',
      label: t('copy_link'),
      onPress: () => {
        setMenuVisible(false);
        handleCopyLink();
      }
    });

    items.push({
      icon: isTranslated ? 'refresh-outline' : 'language-outline',
      label: isTranslated ? t('see_original') : t('translate'),
      color: isTranslated ? '#25D366' : undefined,
      onPress: () => {
        setMenuVisible(false);
        handleTranslate();
      }
    });

    return items;
  }, [isOwner, item, t, openModal, showToast, isTranslated, handleTranslate, handleDelete]);

  const handleLongPress = (e: any) => {
    const { pageY, pageX } = e.nativeEvent;
    setMenuPosition({ top: pageY, left: pageX });
    setMenuVisible(true);
  };

  const renderMainContent = () => (
    <>
        <View style={styles.mediaSection}>
          {visualMedia.length > 0 ? (
            visualMedia.length === 1 ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => { setMediaViewerIndex(0); setMediaViewerVisible(true); }}
                style={styles.imageContainer}
              >
                {visualMedia[0].type === 'video' ? (
                  <React.Suspense fallback={<VideoFallback posterUrl={getPosterUrl(visualMedia[0])} style={styles.image} />}>
                    <PostVideoPlayer
                      uri={getMediaUrl(visualMedia[0].file_path)}
                      style={styles.image}
                      contentFit="cover"
                      shouldPlay={true}
                      isMuted={true}
                      poster={getPosterUrl(visualMedia[0])}
                    />
                  </React.Suspense>
                ) : (
                  <ExpoImage
                    source={{ uri: getMediaUrl(visualMedia[0].file_path) }}
                    style={styles.image}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="disk"
                  />
                )}
              </TouchableOpacity>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                contentContainerStyle={styles.multiMediaScroll}
              >
                {visualMedia.map((media, index) => (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.9}
                    onPress={() => { setMediaViewerIndex(index); setMediaViewerVisible(true); }}
                    style={styles.multiMediaItem}
                  >
                    {media.type === 'video' ? (
                      <React.Suspense fallback={<VideoFallback posterUrl={getPosterUrl(media)} style={styles.multiMediaContent} />}>
                        <PostVideoPlayer
                          uri={getMediaUrl(media.file_path)}
                          style={styles.multiMediaContent}
                          contentFit="cover"
                          shouldPlay={false}
                          isMuted={true}
                          poster={getPosterUrl(media)}
                        />
                      </React.Suspense>
                    ) : (
                      <ExpoImage
                        source={{ uri: getMediaUrl(media.file_path) }}
                        style={styles.multiMediaContent}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="disk"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.border }]}>
              <Ionicons name="image-outline" size={40} color={colors.textSecondary} />
            </View>
          )}
        </View>
    </>
  );

  return (
    <View style={styles.container} ref={containerRef}>
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={300}
        onPress={onPress}
      >
        {item.reposts && item.reposts.length > 1 && (
          <CuratorCircle
            reposters={item.reposts.map((r: any) => ({
              ...r.user,
              context_tag: r.context_tag,
              personal_note: r.personal_note,
              created_at: r.created_at
            }))}
            postId={item.id}
            postContent={item.title}
            post={postStyleObject as any}
          />
        )}

        {item.reposts && item.reposts.length === 1 ? (
          <CuratorFrame
            reposter={{
              ...item.reposts[0].user,
              context_tag: item.reposts[0].context_tag,
              personal_note: item.reposts[0].personal_note,
              created_at: item.reposts[0].created_at,
            }}
          >
            {renderMainContent()}
          </CuratorFrame>
        ) : (
          renderMainContent()
        )}

        <View style={styles.content}>
          <TouchableOpacity
            onPress={() => setIsExpanded(!isExpanded)}
            onLongPress={handleLongPress}
            delayLongPress={300}
            activeOpacity={0.7}
          >
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 2}>
                  {isTranslated ? translatedContent?.title : item.title}
                </Text>
                <View style={styles.badgeRow}>
                  {item.delivery_available && (
                    <View style={[styles.deliveryBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Ionicons name="cube-outline" size={14} color={colors.primary} />
                      <Text style={[styles.deliveryText, { color: colors.primary }]}>{t('market_delivery_badge')}</Text>
                    </View>
                  )}
                  {item.condition && (
                    <View style={[styles.conditionBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Ionicons name="pricetag-outline" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                      <Text style={[styles.conditionText, { color: colors.textSecondary }]}>
                        {t('market_condition_' + item.condition.toLowerCase())}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[styles.price, { color: colors.primary }]}>
                {item.currency}{item.price}
              </Text>
            </View>

            {item.description && (
              <View>
                <Text
                  style={[styles.description, { color: colors.textSecondary, marginTop: 4 }]}
                  numberOfLines={isExpanded ? undefined : 2}
                >
                  {isTranslated ? translatedContent?.description : item.description}
                </Text>
                {isTranslating && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4, alignSelf: 'flex-start' }} />}
                {isTranslated && (
                  <Text style={[styles.translatedLabel, { color: colors.primary, marginTop: 4 }]}>
                    {t('market_translated_by_google')}
                  </Text>
                )}
              </View>
            )}

            {item.location && (
              <TouchableOpacity
                onPress={() => openModal('location', { location: item.location })}
                style={[styles.locationRow, { marginTop: 8 }]}
              >
                <Ionicons name="location" size={14} color={colors.textSecondary} />
                <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={isExpanded ? undefined : 1}>
                  {item.location.name || item.location.address || 'Unknown'}
                </Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Interactive Media (Links) */}
          {detectedUrl && !extraMedia.some(m => m.file_path === detectedUrl) && (
            <View style={{ marginTop: 10 }}>
              <LinkPreviewCard url={detectedUrl} />
            </View>
          )}

          {extraMedia.map((media: any, index: number) => {
            if (media.type === 'link' || media.mime_type === 'text/url') {
              return (
                <View key={media.id || index} style={{ marginTop: 10 }}>
                  <LinkPreviewCard url={media.file_path} />
                </View>
              );
            }
            return null;
          })}


          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.sellerInfo}
              onPress={() => onProfilePress ? onProfilePress(item.user_id.toString()) : null}
            >
              <ExpoImage
                source={{ uri: item.user?.profile_photo ? `${getApiBaseImage()}/storage/${item.user.profile_photo}` : 'https://ui-avatars.com/api/?name=U' }}
                style={styles.avatar} />
              <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </Text>
            </TouchableOpacity>

            {!isOwner && (
              <TouchableOpacity
                style={[styles.chatBtn, { backgroundColor: colors.primary }]}
                onPress={onChatPress}
              >
                <Ionicons name="chatbubbles-outline" size={16} color="#fff" />
                <Text style={styles.chatBtnText}>{t('message')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Post Parity Actions */}
          <PostActionButtons
            post={postStyleObject as any}
            onReact={handleReact}
            onDeleteReaction={handleDeleteReaction}
            onRepost={onRepostPress}
            onShare={() => openModal('share', { post: postStyleObject })}
            onBookmark={handleBookmark}
            isBookmarked={isBookmarked}
            onCommentPress={() => hideCommentSystem ? null : setShowComments(!showComments)}
            currentReactingItem={currentReactingItem}
            setCurrentReactingItem={setCurrentReactingItem as any}
            setIsEmojiPickerOpen={setIsEmojiPickerOpen}
            getGroupedReactions={getGroupedReactions} />
        </View>
      </Pressable>

      {/* Menus and Modals */}
      <GenericMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={marketMenuItems}
        anchorPosition={menuPosition}
      />

      <ContextTagSelector
        visible={tagSelectorVisible}
        onClose={() => setTagSelectorVisible(false)}
        onConfirm={handleRepostSubmit}
      />

      {!hideCommentSystem && showComments && (
        <Modal
          visible={showComments}
          animationType="slide"
          transparent
          onRequestClose={() => setShowComments(false)}
        >
          <TouchableOpacity style={GlobalStyles.commentsBackdrop} activeOpacity={1} onPress={() => setShowComments(false)} />
          <View style={[GlobalStyles.commentsSheet, { backgroundColor: colors.surface }]}>
            <View style={{ height: 4, width: 40, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 5 }} />
            <ScrollView style={{ flex: 1, padding: 16 }}>
              <RenderComments
                user={currentUser}
                service={{}}
                postId={item.id}
                onProfilePress={onProfilePress || (() => { })}
                onReply={(comment) => { setReplyingTo(comment.id); setCommentText(`@${comment.user.name} `); }}
                onReactComment={() => { }}
                onDeleteCommentReaction={() => { }}
                onDeleteComment={async (commentId) => {
                  try {
                    await deleteMarketItemComment(item.id, commentId);
                    updateItemLocally(item.id, (oldItem) => ({
                      ...oldItem,
                      comments: oldItem.comments?.filter((c: any) => c.id !== commentId)
                    }));
                  } catch (e) { console.error(e); }
                }}
                overrideComments={item.comments}
                hideReactions={true}
              />
            </ScrollView>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
              <View style={{ flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface }}>
                <TextInput
                  style={{ flex: 1, color: colors.text, minHeight: 40, paddingHorizontal: 15, backgroundColor: colors.border, borderRadius: 20, marginRight: 10 }}
                  placeholder={replyingTo ? t('market_replying') : t('market_write_comment')}
                  placeholderTextColor={colors.textSecondary}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <TouchableOpacity onPress={handleSubmitComment} disabled={isSubmittingComment || !commentText.trim()}>
                  <Ionicons name="send" size={24} color={commentText.trim() ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      <Modal transparent visible={isEmojiPickerOpen} animationType="fade" onRequestClose={() => setIsEmojiPickerOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} activeOpacity={1} onPress={() => setIsEmojiPickerOpen(false)} />
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <EmojiPicker
            open={isEmojiPickerOpen}
            onClose={() => { setIsEmojiPickerOpen(false); setCurrentReactingItem(null); }}
            onEmojiSelected={(emoji) => handleEmojiSelected(emoji.emoji)}
          />
        </View>
      </Modal>

      {mediaViewerVisible && (
        <MediaViewer
          visible={mediaViewerVisible}
          mediaItems={item.media || []}
          startIndex={mediaViewerIndex}
          onClose={() => setMediaViewerVisible(false)}
          post={postStyleObject as any}
          getApiBaseImage={getApiBaseImage}
          onNavigateNext={() => { }}
          onNavigatePrev={() => { }}
          onReact={handleReact}
          onDeleteReaction={handleDeleteReaction}
          onRepost={() => { }}
          onShare={() => openModal('share', { post: postStyleObject })}
          onBookmark={() => { }}
          onCommentPress={() => setShowComments(true)}
          onDoubleTap={() => handleReact('❤️')}
          currentReactingItem={currentReactingItem}
          setCurrentReactingItem={setCurrentReactingItem as any}
          setIsEmojiPickerOpen={setIsEmojiPickerOpen}
          onCommentSubmit={handleSubmitComment as any}
          getGroupedReactions={getGroupedReactions}
          isBookmarked={false}
          handleReactComment={() => { }}
          deleteCommentReaction={() => { }}
        />
      )}
    </View>
  );
}

const getStyles = (colors: any, scheme: string) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mediaSection: {
    marginTop: 8,
  },
  multiMediaScroll: {
    paddingHorizontal: 8,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  multiMediaItem: {
    width: width * 0.5,
    aspectRatio: 1,
    marginHorizontal: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  multiMediaContent: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
    borderRadius: 8,
    marginHorizontal: 12,
  },
  content: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  titleContainer: {
    flex: 1,
    marginRight: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 6,
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  deliveryText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 13,
    marginLeft: 4,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  chatBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  translatedLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
});
