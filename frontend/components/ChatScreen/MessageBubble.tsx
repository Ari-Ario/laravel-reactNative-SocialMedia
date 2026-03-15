import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { BlurView } from 'expo-blur';
import Avatar from '@/components/Image/Avatar';
import getApiBaseImage from '@/services/getApiBaseImage';
import PollViewer from './PollViewer';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { MotiView } from 'moti';
import LocationPreview from './LocationPreview';
import { createShadow } from '@/utils/styles';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    type: string;
    file_path?: string;
    user?: {
      id: number;
      name: string;
      profile_photo?: string;
    };
    created_at: string;
    reactions?: any[];
    metadata?: any;
    poll?: any;
    reply_to_id?: string;
  };
  repliedToMessage?: any;
  translatedContent?: string;
  isCurrentUser: boolean;
  showAvatar: boolean;
  isSelected: boolean;
  onPress: () => void;
  onMediaPress?: (index: number) => void;
  onLongPress: () => void;
  onLongPressWithPosition?: (message: any, x: number, y: number) => void;
  onPollPress?: (poll: any) => void;
  onToggleTranslation?: () => void;
  /** Required for InlinePollCard voting */
  spaceId?: string;
  currentUserId?: number;
  currentUserRole?: string;
  highlighted?: boolean;
  onJumpToMessage?: (messageId: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  repliedToMessage,
  isCurrentUser,
  showAvatar,
  isSelected,
  onPress,
  onMediaPress,
  onLongPress,
  onLongPressWithPosition,
  onPollPress,
  onToggleTranslation,
  spaceId,
  currentUserId,
  currentUserRole,
  translatedContent,
  highlighted,
  onJumpToMessage,
}) => {
  const bubbleRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const [isSelfHighlighted, setIsSelfHighlighted] = useState(false);

  useEffect(() => {
    if (highlighted) {
      setIsSelfHighlighted(true);
      const timer = setTimeout(() => setIsSelfHighlighted(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [highlighted]);
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    if (isToday) return timeStr;

    const dateStr = date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    });

    return `${dateStr}, ${timeStr}`;
  };

  const downloadMedia = async (url: string, filename: string) => {
    if (Platform.OS === 'web') {
      try {
        // Try fetch/blob approach first to force download with filename
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } else {
          // Fallback to direct opening in new tab
          window.open(url, '_blank');
        }
      } catch (err) {
        console.warn('Web download fetch failed, falling back to window.open:', err);
        window.open(url, '_blank');
      }
      return;
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Unable to save media without gallery access.');
        return;
      }

      const fileUri = `${(FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || ''}${filename}`;
      const downloadRes = await FileSystem.downloadAsync(url, fileUri);

      await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
      Alert.alert('Success', 'Saved to your gallery!');

      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (err) {
      console.error('Download failed:', err);
      Alert.alert('Error', 'Failed to download media.');
    }
  };

  const renderContent = () => {
    switch (message.type) {
      case 'image':
      case 'video': {
        const rawUrl = message.metadata?.url || message.file_path || '';
        const isNetworkUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
        const isFileUrl = rawUrl.startsWith('file://');
        const isDataUrl = rawUrl.startsWith('data:');

        const url = (isNetworkUrl || isFileUrl || isDataUrl)
          ? rawUrl
          : (rawUrl ? `${getApiBaseImage()}/storage/${rawUrl}` : 'https://via.placeholder.com/300');

        const isVideo = message.type === 'video';

        return (
          <View style={styles.imageContainer}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onMediaPress?.(0)}
              style={styles.image}
            >
              {isVideo ? (
                <View style={[styles.image, styles.videoPlaceholder]}>
                  <Ionicons name="videocam" size={48} color="#fff" />
                  <Text style={styles.videoText}>Video Message</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: url, cache: 'force-cache' }}
                  style={styles.image}
                  resizeMode="cover"
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.downloadBtnOverlay}
              onPress={() => downloadMedia(url, `download_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`)}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
            </TouchableOpacity>

            {message.content ? (
              <Text style={[styles.imageCaption, isCurrentUser ? styles.currentUserText : styles.otherUserText]}>
                {message.content}
              </Text>
            ) : null}
          </View>
        );
      }

      case 'album': {
        const mediaItems = message.metadata?.media_items || [];
        if (mediaItems.length === 0) return null;

        // Telegram style: 1 is big, 2 is 2x1, 3 is 1 top + 2 bottom, 4 is 2x2
        // We'll simplify to a robust grid for 2-4 and grid with +X for 5+
        const displayItems = mediaItems.slice(0, 4);
        const remaining = mediaItems.length - 4;

        return (
          <View style={styles.albumContainer}>
            <View style={styles.albumGrid}>
              {displayItems.map((item: any, idx: number) => {
                const rawUrl = item.url || item.file_path || '';
                const isNetworkUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
                const isFileUrl = rawUrl.startsWith('file://');
                const isDataUrl = rawUrl.startsWith('data:');

                const url = (isNetworkUrl || isFileUrl || isDataUrl)
                  ? rawUrl
                  : (rawUrl ? `${getApiBaseImage()}/storage/${rawUrl}` : 'https://via.placeholder.com/300');

                const isLast = idx === 3 && remaining > 0;
                const isVideo = item.type === 'video';

                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.9}
                    onPress={() => onMediaPress?.(idx)}
                    style={[
                      styles.albumItem,
                      displayItems.length === 1 ? styles.albumItemFull :
                        displayItems.length === 2 ? styles.albumItemHalf :
                          styles.albumItemQuarter
                    ]}
                  >
                    {isVideo ? (
                      <View style={[styles.albumMedia, styles.videoPlaceholderSmall]}>
                        <Ionicons name="play" size={24} color="#fff" />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: url, cache: 'force-cache' }}
                        style={styles.albumMedia}
                        resizeMode="cover"
                      />
                    )}
                    {isLast && (
                      <View style={styles.albumOverlay}>
                        <Text style={styles.albumOverlayText}>+{remaining}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {message.content ? (
              <Text style={[styles.imageCaption, isCurrentUser ? styles.currentUserText : styles.otherUserText]}>
                {message.content}
              </Text>
            ) : null}
          </View>
        );
      }

      case 'voice':
        return (
          <View style={styles.voiceContainer}>
            <Ionicons name="mic" size={20} color="#007AFF" />
            <Text style={styles.voiceDuration}>
              {message.metadata?.duration || '0:30'}
            </Text>
            <View style={styles.waveform}>
              {Array.from({ length: 20 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveformBar,
                    { height: Math.random() * 20 + 4 }
                  ]}
                />
              ))}
            </View>
          </View>
        );

      case 'poll': {
        const pollData = message.poll || message.metadata?.pollData;
        // ── Render InlinePollCard OUTSIDE the normal bubble wrapper ──────────
        // Early return so we bypass the blue/grey bubble entirely.
        if (pollData && spaceId && currentUserId) {
          return (
            <PollViewer
              poll={pollData}
              spaceId={spaceId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole || 'participant'}
              onRefresh={() => { }}
            />
          );
        }
        // Fallback if no spaceId/userId context
        return (
          <View style={styles.pollFallback}>
            <Ionicons name="bar-chart" size={14} color="#007AFF" />
            <Text style={styles.pollFallbackText}>
              {pollData?.question || 'Poll'}
            </Text>
          </View>
        );
      }

      case 'document': {
        const rawUrl = message.metadata?.url || message.file_path || '';
        const isNetworkUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
        const isFileUrl = rawUrl.startsWith('file://');
        const isDataUrl = rawUrl.startsWith('data:');

        const url = (isNetworkUrl || isFileUrl || isDataUrl)
          ? rawUrl
          : (rawUrl ? `${getApiBaseImage()}/storage/${rawUrl}` : '');

        const fileName = message.metadata?.file_name || message.metadata?.name || 'Document';
        const fileSize = message.metadata?.file_size;

        return (
          <TouchableOpacity
            style={[
              styles.documentContainer,
              isCurrentUser ? styles.currentUserDocument : styles.otherUserDocument
            ]}
            onPress={() => downloadMedia(url, fileName)}
            activeOpacity={0.7}
          >
            <View style={styles.documentIconContainer}>
              <Ionicons name="document-text" size={24} color="#007AFF" />
            </View>
            <View style={styles.documentInfo}>
              <Text
                style={[
                  styles.documentName,
                  isCurrentUser ? styles.currentUserText : styles.otherUserText
                ]}
                numberOfLines={1}
              >
                {fileName}
              </Text>
              {fileSize && (
                <Text style={[styles.documentSize, isCurrentUser && { color: 'rgba(255,255,255,0.7)' }]}>
                  {(fileSize / (1024 * 1024)).toFixed(2)} MB
                </Text>
              )}
            </View>
            <Ionicons name="download-outline" size={20} color={isCurrentUser ? "#fff" : "#007AFF"} />
          </TouchableOpacity>
        );
      }

      case 'location': {
        const { latitude, longitude, name, address } = message.metadata || {};
        if (!latitude || !longitude) return null;

        const openInMaps = () => {
          const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
          const latLng = `${latitude},${longitude}`;
          const label = name || 'Location';
          const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`,
            web: `https://www.google.com/maps/search/?api=1&query=${latLng}`
          });
          if (url) {
            if (Platform.OS === 'web') {
              window.open(url, '_blank');
            } else {
              Linking.openURL(url);
            }
          }
        };

        return (
          <TouchableOpacity
            style={[
              styles.locationBubbleContainer,
              isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
            ]}
            onPress={openInMaps}
            activeOpacity={0.9}
          >
            <View style={styles.locationMapContainer}>
              <LocationPreview 
                latitude={latitude} 
                longitude={longitude} 
                name={name}
                style={styles.locationMiniMap} 
              />
            </View>
            <View style={styles.locationInfo}>
              <Text style={[styles.locationName, isCurrentUser && { color: '#fff' }]} numberOfLines={1}>
                {name || 'Selected Location'}
              </Text>
              {address && (
                <Text style={[styles.locationAddress, isCurrentUser ? { color: 'rgba(255,255,255,1)' } : { color: '#007AFF', fontWeight: '500' }]} numberOfLines={2}>
                  {address}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      }

      case 'live_location': {
        const { latitude, longitude, expiresAt } = message.metadata || {};
        const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

        return (
          <TouchableOpacity
            style={[
              styles.locationBubbleContainer,
              isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
            ]}
            activeOpacity={0.9}
          >
            <View style={styles.locationMapContainer}>
               <View style={[styles.locationMiniMap, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                  {!isExpired && (
                    <MotiView
                      from={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 2, opacity: 0 }}
                      transition={{ type: 'timing', duration: 1500, loop: true }}
                      style={styles.livePulse}
                    />
                  )}
                  <Ionicons name="location" size={32} color={isExpired ? "#8E8E93" : "#FF3B30"} />
               </View>
            </View>
            <View style={styles.locationInfo}>
              <View style={styles.liveHeader}>
                <View style={[styles.liveIndicator, isExpired && { backgroundColor: '#8E8E93' }]} />
                <Text style={[styles.locationName, isCurrentUser && { color: '#fff' }]}>
                  {isExpired ? 'Live location ended' : 'Live Location'}
                </Text>
              </View>
              {!isExpired && (
                <Text style={[styles.locationAddress, isCurrentUser && { color: 'rgba(255,255,255,0.7)' }]}>
                  Sharing until {expiresAt ? new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      }

      case 'post_share':
        return null; // Handled by specialized block below

      case 'text':
      default:
        // Use translation if provided
        return (
          <View>
            <Text style={[styles.text, isCurrentUser ? styles.currentUserText : styles.otherUserText]}>
              {translatedContent || message.content}
            </Text>
            {translatedContent && (
              <TouchableOpacity onPress={onToggleTranslation} style={styles.translatedContainer}>
                <Text style={[styles.translatedLabel, isCurrentUser ? styles.currentUserText : styles.otherUserText]}>
                  (Translated)
                </Text>
                <Text style={[styles.seeOriginalLink, isCurrentUser ? styles.currentUserText : { color: '#007AFF' }]}>
                  See Original
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
    }
  };

  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;

    const reactionCounts: Record<string, number> = {};
    message.reactions.forEach(r => {
      reactionCounts[r.reaction] = (reactionCounts[r.reaction] || 0) + 1;
    });

    return (
      <View style={[
        styles.reactionsContainer,
        isCurrentUser ? styles.currentUserReactions : styles.otherUserReactions
      ]}>
        {Object.entries(reactionCounts).map(([reaction, count]) => (
          <View key={reaction} style={styles.reactionBadge}>
            <Text style={styles.reactionEmoji}>{reaction}</Text>
            {count > 1 && (
              <Text style={styles.reactionCount}>{count}</Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderReplyHeader = () => {
    if (!repliedToMessage) return null;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onJumpToMessage?.(message.reply_to_id!)}
        style={[
          styles.replyHeaderContainer,
          isCurrentUser ? styles.currentUserReplyHeader : styles.otherUserReplyHeader
        ]}
      >
        <View style={[styles.replyHeaderBar, isCurrentUser && { backgroundColor: '#fff' }]} />
        <View style={styles.replyHeaderContent}>
          <Text style={[styles.replyHeaderName, isCurrentUser && { color: '#fff' }]} numberOfLines={1}>
            {repliedToMessage.user?.name || repliedToMessage.user_name || 'User'}
          </Text>
          <Text style={[styles.replyHeaderText, isCurrentUser && { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>
            {repliedToMessage.type === 'text' ? repliedToMessage.content : `[${repliedToMessage.type}]`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Poll messages: wrapped in a message bubble container with long-press ──
  if (message.type === 'poll') {
    const pollData = message.poll || message.metadata?.pollData;
    if (pollData && spaceId && currentUserId) {
      return (
        <TouchableOpacity
          ref={bubbleRef}
          activeOpacity={0.95}
          onPress={onPress}
          onLongPress={() => {
            if (onLongPressWithPosition) {
              bubbleRef.current?.measure((_x: number, _y: number, width: number, _height: number, pageX: number, pageY: number) => {
                onLongPressWithPosition(message, pageX + width / 2, pageY);
              });
            } else if (onLongPress) {
              onLongPress();
            }
          }}
          delayLongPress={200}
          style={[
            styles.container,
            isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer,
            isSelfHighlighted && styles.selectedContainer,
            isSelected && styles.selectedContainer,
          ]}
        >
          {!isCurrentUser && showAvatar && (
            <View style={styles.avatarContainer}>
              <Avatar
                source={message.user?.profile_photo}
                size={32}
                name={message.user?.name}
                showStatus={false}
              />
            </View>
          )}
          <View style={[
            styles.bubbleContainer,
            isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
            isSelfHighlighted && styles.highlightedBubble,
            { maxWidth: '85%' } // Polls can be wider than text
          ]}>
            {!isCurrentUser && showAvatar && (
              <Text style={styles.userName}>{message.user?.name}</Text>
            )}

            {renderReplyHeader()}
            <PollViewer
              poll={pollData}
              spaceId={spaceId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole || 'participant'}
              onRefresh={() => { }}
              inChatMode={true}
            />

            <View style={styles.messageFooter}>
              <Text style={styles.timestamp}>
                {formatTime(message.created_at)}
              </Text>
            </View>

            {renderReactions()}
          </View>
          {isCurrentUser && showAvatar && (
            <View style={styles.avatarContainer}>
              <Avatar
                source={message.user?.profile_photo}
                size={32}
                name={message.user?.name}
                showStatus={false}
              />
            </View>
          )}
        </TouchableOpacity>
      );
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  // ── Post Share messages: Premium Instagram-style card ──
  if (message.type === 'post_share' || message.type === 'story_share') {
    const isStory = message.type === 'story_share';
    const metadata = message.metadata || {};
    const itemId = isStory ? metadata.story_id : metadata.post_id;
    const creatorName = metadata.creator_name || 'Anonymous';
    const creatorAvatar = metadata.creator_avatar;
    const allMedia = isStory ? [{ file_path: metadata.media_url, type: metadata.media_type }] : (metadata.media || []);
    const caption = metadata.caption;

    const handlePress = () => {
      if (itemId) {
        if (isStory) {
          router.push({ pathname: '/story/[id]', params: { id: itemId, standalone: 'true' } });
        } else {
          router.push({ pathname: '/post/[id]', params: { id: itemId } });
        }
      }
    };

    const renderMediaCollection = () => {
      if (!allMedia || allMedia.length === 0 || !allMedia[0].file_path) {
        return (
          <View style={styles.sharedPostPlaceholder}>
            <Ionicons name={isStory ? "camera-outline" : "document-text-outline"} size={40} color="#ccc" />
          </View>
        );
      }

      if (allMedia.length === 1 || isStory) {
        const item = allMedia[0];
        const mediaUrl = (item.file_path || item.url).startsWith('http') 
          ? (item.file_path || item.url) 
          : `${getApiBaseImage()}/storage/${item.file_path || item.url}`;
        
        return (
          <View style={styles.sharedPostMediaContainer}>
            <Image 
              source={{ uri: mediaUrl }} 
              style={[styles.sharedPostMedia, isStory && { height: 350 }]} 
              resizeMode="cover"
            />
            {(item.type === 'video' || metadata.media_type === 'video') && (
              <View style={styles.playIconOverlay}>
                <Ionicons name="play" size={42} color="white" />
              </View>
            )}
            <View style={styles.mediaTypeBadge}>
               <Ionicons 
                 name={(item.type === 'video' || metadata.media_type === 'video') ? "videocam" : "image"} 
                 size={12} 
                 color="white" 
               />
            </View>
            {isStory && (
              <View style={styles.storyOverlayBadge}>
                <Text style={styles.storyOverlayText}>STORY</Text>
              </View>
            )}
          </View>
        );
      }

      const displayMedia = allMedia.slice(0, 4);
      const remainingCount = allMedia.length - 4;

      return (
        <View style={styles.mediaGrid}>
          {displayMedia.map((item: any, index: number) => {
            const mediaUrl = (item.file_path || item.url).startsWith('http') 
              ? (item.file_path || item.url) 
              : `${getApiBaseImage()}/storage/${item.file_path || item.url}`;
            
            return (
              <View 
                key={index} 
                style={[
                  styles.gridItem,
                  allMedia.length === 2 && styles.gridItemHalf,
                  allMedia.length === 3 && index === 0 && styles.gridItemFullWidth,
                ]}
              >
                <Image 
                  source={{ uri: mediaUrl }} 
                  style={styles.gridImage} 
                  resizeMode="cover"
                />
                {item.type === 'video' && (
                  <View style={styles.playIconOverlaySmall}>
                    <Ionicons name="play" size={20} color="white" />
                  </View>
                )}
                {index === 3 && remainingCount > 0 && (
                  <View style={styles.remainingOverlay}>
                    <Text style={styles.remainingText}>+{remainingCount}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
    };

    return (
      <View style={[
        styles.container,
        isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer,
      ]}>
        {!isCurrentUser && showAvatar && (
          <View style={styles.avatarContainer}>
            <Avatar
              source={message.user?.profile_photo}
              size={32}
              name={message.user?.name}
              showStatus={false}
            />
          </View>
        )}

        <TouchableOpacity
          ref={bubbleRef}
          activeOpacity={0.9}
          onPress={handlePress}
          onLongPress={() => {
            if (onLongPressWithPosition) {
              bubbleRef.current?.measure((_x, _y, width, _height, pageX, pageY) => {
                onLongPressWithPosition(message, pageX + width / 2, pageY);
              });
            } else if (onLongPress) {
              onLongPress();
            }
          }}
          delayLongPress={200}
          style={[
            styles.sharedPostContainer,
            isCurrentUser ? styles.currentUserSharedPost : styles.otherUserSharedPost,
            isSelected && styles.selectedContainer,
            isStory && { width: 250 }
          ]}
        >
          <BlurView intensity={20} tint="light" style={styles.sharedPostHeader}>
            <Avatar 
              source={creatorAvatar} 
              size={24} 
              name={creatorName}
              showStatus={false}
            />
            <Text style={styles.sharedPostCreatorName} numberOfLines={1}>
              {creatorName}
            </Text>
            <Ionicons name="chevron-forward" size={12} color="#8E8E93" style={{marginLeft: 'auto'}} />
          </BlurView>

          {renderMediaCollection()}

          <BlurView intensity={30} tint="light" style={styles.sharedPostFooter}>
             <Text style={styles.sharedPostCaption} numberOfLines={2}>
                <Text style={styles.sharedPostCreatorLabel}>{creatorName} </Text>
                {caption}
             </Text>
             <View style={styles.sharedPostMeta}>
                <Text style={styles.sharedPostTime}>
                  {formatTime(message.created_at)}
                </Text>
             </View>
          </BlurView>

          {renderReactions()}
        </TouchableOpacity>

        {isCurrentUser && showAvatar && (
          <View style={styles.avatarContainer}>
            <Avatar
              source={message.user?.profile_photo}
              size={32}
              name={message.user?.name}
              showStatus={false}
            />
          </View>
        )}
      </View>
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <TouchableOpacity
      ref={bubbleRef}
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={() => {
        if (onLongPressWithPosition) {
          // Use the ref instead of event.currentTarget — which can be null on Android
          bubbleRef.current?.measure((_x: number, _y: number, width: number, _height: number, pageX: number, pageY: number) => {
            onLongPressWithPosition(message, pageX + width / 2, pageY);
          });
        } else if (onLongPress) {
          onLongPress();
        }
      }}
      delayLongPress={200}
      style={[
        styles.container,
        isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer,
        isSelected && styles.selectedContainer
      ]}
    >
      {!isCurrentUser && showAvatar && (
        <View style={styles.avatarContainer}>
          <Avatar
            source={message.user?.profile_photo}
            size={32}
            name={message.user?.name}
            showStatus={false}
          />
        </View>
      )}

      <View style={[
        styles.bubbleContainer,
        isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
        isSelfHighlighted && styles.highlightedBubble
      ]}>
        {!isCurrentUser && showAvatar && (
          <Text style={styles.userName}>{message.user?.name}</Text>
        )}

        {renderReplyHeader()}
        {renderContent()}

        <View style={styles.messageFooter}>
          <Text style={[styles.timestamp, !isCurrentUser && { color: '#333333ff' }]}>
            {formatTime(message.created_at)}
          </Text>
          {isCurrentUser && (
            <Ionicons
              name="checkmark-done"
              size={12}
              color={message.metadata?.read ? "#007AFF" : "#999"}
            />
          )}
        </View>

        {renderReactions()}
      </View>

      {isCurrentUser && showAvatar && (
        <View style={styles.avatarContainer}>
          <Avatar
            source={message.user?.profile_photo}
            size={32}
            name={message.user?.name}
            showStatus={false}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
    marginHorizontal: 8,
    paddingHorizontal: 8,
  },
  currentUserContainer: {
    justifyContent: 'flex-end',
  },
  otherUserContainer: {
    justifyContent: 'flex-start',
  },
  selectedContainer: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
  },
  avatarContainer: {
    marginHorizontal: 8,
    marginBottom: 4,
  },
  bubbleContainer: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 18,
  },
  currentUserBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  translatedLabel: {
    fontSize: 10,
    marginTop: 2,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  translatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  seeOriginalLink: {
    fontSize: 10,
    marginLeft: 5,
    textDecorationLine: 'underline',
  },
  currentUserText: {
    color: '#fff',
  },
  otherUserText: {
    color: '#333',
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  imageCaption: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  videoPlaceholder: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  videoText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  // Album Styles
  albumContainer: {
    width: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  albumItem: {
    backgroundColor: '#333',
    overflow: 'hidden',
  },
  albumItemFull: {
    width: '100%',
    aspectRatio: 1,
  },
  albumItemHalf: {
    width: '49.5%',
    aspectRatio: 1,
  },
  albumItemQuarter: {
    width: '49.5%',
    aspectRatio: 1,
  },
  albumMedia: {
    width: '100%',
    height: '100%',
  },
  albumOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumOverlayText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  videoPlaceholderSmall: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
  },
  downloadBtnOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  voiceDuration: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  waveformBar: {
    width: 2,
    backgroundColor: '#007AFF',
    marginHorizontal: 1,
    borderRadius: 1,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginRight: 4,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  currentUserReactions: {
    justifyContent: 'flex-end',
  },
  otherUserReactions: {
    justifyContent: 'flex-start',
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    color: '#666',
    marginLeft: 2,
  },
  pollContainer: {
    minWidth: 180,
    maxWidth: 240,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pollIconBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    borderRadius: 6,
    padding: 4,
  },
  pollLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 1,
  },
  pollQuestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  pollMeta: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  viewPollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  viewPollButtonOther: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  viewPollButtonCurrent: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  viewPollButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  viewPollButtonTextCurrent: {
    color: '#fff',
  },
  pollFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
  },
  pollFallbackText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    flex: 1,
  },
  // Shared Post Styles
  sharedPostContainer: {
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(229, 229, 234, 0.5)',
    ...createShadow({
      width: 0,
      height: 8,
      opacity: 0.12,
      radius: 12,
      elevation: 10,
    }),
  },
  currentUserSharedPost: {
    borderBottomRightRadius: 6,
  },
  otherUserSharedPost: {
    borderBottomLeftRadius: 6,
  },
  sharedPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  sharedPostCreatorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  sharedPostMediaContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F2F2F7',
    position: 'relative',
    overflow: 'hidden',
  },
  sharedPostMedia: {
    width: '100%',
    height: '100%',
  },
  mediaTypeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 4,
    borderRadius: 6,
  },
  mediaGrid: {
    width: '100%',
    aspectRatio: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    backgroundColor: '#fff',
  },
  gridItem: {
    width: '49.8%',
    height: '49.8%',
    position: 'relative',
  },
  gridItemHalf: {
    width: '49.8%',
    height: '100%',
  },
  gridItemFullWidth: {
    width: '100%',
    height: '49.8%',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  remainingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remainingText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  playIconOverlaySmall: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  sharedPostPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  sharedPostFooter: {
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  sharedPostCaption: {
    fontSize: 14,
    color: '#2C2C2E',
    lineHeight: 20,
  },
  sharedPostCreatorLabel: {
    fontWeight: '800',
    color: '#000',
  },
  sharedPostMeta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sharedPostTime: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
  /* ── Reply Header Styles ── */
  replyHeaderContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 6,
    marginBottom: 6,
    alignItems: 'center',
  },
  currentUserReplyHeader: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  otherUserReplyHeader: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  replyHeaderBar: {
    width: 3,
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 1.5,
  },
  replyHeaderContent: {
    flex: 1,
    marginLeft: 8,
  },
  replyHeaderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 1,
  },
  replyHeaderText: {
    fontSize: 12,
    color: '#666',
  },
  pollBubbleContent: {
    flex: 1,
  },
  highlightedBubble: {
    backgroundColor: '#FFF9C4', // Soft yellow highlight
    borderWidth: 1,
    borderColor: '#FBC02D',
  },
  wrappedShareContainer: {
    backgroundColor: '#007AFF', // Standard blue for the "cover"
    borderRadius: 20,
    overflow: 'hidden',
    width: 280,
    ...createShadow({
      width: 0,
      height: 4,
      opacity: 0.15,
      radius: 8,
      elevation: 5,
    }),
  },
  currentUserWrappedShare: {
    borderBottomRightRadius: 6,
  },
  otherUserWrappedShare: {
    borderBottomLeftRadius: 6,
  },
  appendedMessageContainer: {
    padding: 12,
    paddingTop: 8,
  },
  appendedMessageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  appendedMessageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  appendedMessageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  storyOverlayBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  storyOverlayText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  /* ── Document Styles ── */
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    gap: 12,
    minWidth: 200,
  },
  currentUserDocument: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  otherUserDocument: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  documentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadow({ width: 0, height: 2, opacity: 0.1, radius: 4, elevation: 2 }),
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
  },
  documentSize: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  /* ── Location Styles ── */
  locationBubbleContainer: {
    width: 240,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 4,
  },
  locationMapContainer: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
  },
  locationMiniMap: {
    width: '100%',
    height: '100%',
  },
  webMapPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  webMapText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  locationInfo: {
    padding: 8,
    gap: 2,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  locationAddress: {
    fontSize: 12,
    color: '#8E8E93',
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  livePulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,59,48,0.3)',
  },
});

export default MessageBubble;