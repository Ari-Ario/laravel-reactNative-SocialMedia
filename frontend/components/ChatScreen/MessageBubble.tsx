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
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import Avatar from '@/components/Image/Avatar';
import getApiBaseImage from '@/services/getApiBaseImage';
import PollViewer from './PollViewer';

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
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadMedia = async (url: string, filename: string) => {
    if (Platform.OS === 'web') {
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error('Web download failed:', err);
        Alert.alert('Error', 'Failed to download media on web.');
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
      <View style={[styles.replyHeaderContainer, isCurrentUser ? styles.currentUserReplyHeader : styles.otherUserReplyHeader]}>
        <View style={styles.replyHeaderBar} />
        <View style={styles.replyHeaderContent}>
          <Text style={styles.replyHeaderName} numberOfLines={1}>
            {repliedToMessage.user?.name || repliedToMessage.user_name || 'User'}
          </Text>
          <Text style={styles.replyHeaderText} numberOfLines={1}>
            {repliedToMessage.type === 'text' ? repliedToMessage.content : `[${repliedToMessage.type}]`}
          </Text>
        </View>
      </View>
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
          <Text style={styles.timestamp}>
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
    color: '#444',
    fontWeight: '600',
    flex: 1,
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
});

export default MessageBubble;