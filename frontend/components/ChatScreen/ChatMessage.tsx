// components/ChatMessage.tsx
import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { PostActionButtons } from '../PostActionButtons';
import getApiBaseImage from '@/services/getApiBaseImage';
import { Ionicons } from '@expo/vector-icons';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { useToastStore } from '@/stores/toastStore';
import { router } from 'expo-router';
import Markdown from 'react-native-markdown-display';

interface ChatMessageProps {
  item: any;
  user: any;
  service: any;
  onMenuPress?: () => void;
  onCommentPress?: (post: any) => void;
}

const preprocessMath = (text: string) => {
  if (!text) return '';
  let processed = text;

  // Truncate long Zmzir hashes that break React Native text wrapping
  processed = processed.replace(/Zmzir Engine Autonomous Axiom DB \(([a-f0-9]{32,})\)/gi, (match, hash) => {
    return `Zmzir Engine Autonomous Axiom DB (${hash.substring(0, 16)}...)`;
  });

  // Convert $$ ... $$ to a fenced code block
  processed = processed.replace(/\$\$(.*?)\$\$/gs, (match, math) => {
    return `\n\n\`\`\`math\n${math.trim()}\n\`\`\`\n\n`;
  });

  // Convert \[ ... \] to a fenced code block
  processed = processed.replace(/\\\[(.*?)\\\]/gs, (match, math) => {
    return `\n\n\`\`\`math\n${math.trim()}\n\`\`\`\n\n`;
  });

  // Convert \( ... \) to inline code
  processed = processed.replace(/\\\((.*?)\\\)/gs, (match, math) => {
    return `\`${math.trim()}\``;
  });

  // Convert single $ ... $ to inline code
  processed = processed.replace(/(^|[^\\])\$([^\$]+?)\$/g, (match, prefix, math) => {
    if (/^\s*\d/.test(math)) return match;
    return `${prefix}\`${math.trim()}\``;
  });

  return processed;
};

const ChatMessage = ({ item, user, service, onMenuPress, onCommentPress }: ChatMessageProps) => {
  const postMedia = useMemo(() => {
    return service.sortMedia(item.media || []);
  }, [item.media, service]);

  const { addBookmark, bookmarks } = useBookmarkStore();
  const isBookmarked = bookmarks.some(b => b && b.post_id === item.id);
  const showToast = useToastStore(state => state.showToast);

  const handleBookmark = async () => {
    try {
      const result = await addBookmark(item.id);
      if (result.bookmarked && result.bookmark) {
        showToast('Post bookmarked!', 'success');

        // Navigation to bookmarks settings which acts as the popup gallery
        router.push({
          pathname: '/settings/bookmarks',
          params: { initialPostId: item.id }
        });
      } else {
        showToast('Bookmark removed', 'info');
      }
    } catch (error) {
      console.error("Bookmark from chat failed:", error);
      showToast("Failed to bookmark post", 'error');
    }
  };

  // Handle comment press with the specific post
  const handleCommentPress = () => {
    if (onCommentPress) {
      onCommentPress(item);
    } else {
      service.setShowComments(!service.showComments);
    }
  };

  const isOutgoing = item.user.id === user?.id;
  const textColor = isOutgoing ? '#fff' : '#000';

  const markdownStyles = useMemo(() => ({
    body: {
      fontSize: 16,
      color: textColor,
    },
    heading1: {
      fontSize: 22,
      fontWeight: 'bold',
      color: textColor,
      marginTop: 10,
      marginBottom: 5,
    },
    heading2: {
      fontSize: 20,
      fontWeight: 'bold',
      color: textColor,
      marginTop: 10,
      marginBottom: 5,
    },
    heading3: {
      fontSize: 18,
      fontWeight: 'bold',
      color: textColor,
      marginTop: 10,
      marginBottom: 5,
    },
    strong: {
      fontWeight: 'bold',
      color: textColor,
    },
    em: {
      fontStyle: 'italic',
      color: textColor,
    },
    link: {
      color: isOutgoing ? '#e0e0e0' : '#0A84FF',
      textDecorationLine: 'underline',
    },
    blockquote: {
      backgroundColor: isOutgoing ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      borderLeftWidth: 4,
      borderLeftColor: isOutgoing ? '#fff' : '#007AFF',
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginVertical: 5,
    },
    table: {
      borderColor: isOutgoing ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
      borderWidth: 1,
      borderRadius: 4,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: isOutgoing ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
      flexDirection: 'row',
    },
    th: {
      padding: 5,
      fontWeight: 'bold',
      color: textColor,
    },
    td: {
      padding: 5,
      color: textColor,
    },
    hr: {
      backgroundColor: isOutgoing ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
      height: 1,
      marginVertical: 10,
    },
    code_inline: {
      backgroundColor: isOutgoing ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
      paddingHorizontal: 4,
      borderRadius: 4,
      fontFamily: 'monospace',
      color: textColor,
      flexWrap: 'wrap',
      lineHeight: 24,
    },
    code_block: {
      backgroundColor: isOutgoing ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
      padding: 10,
      borderRadius: 4,
      fontFamily: 'monospace',
      color: textColor,
      marginVertical: 5,
      overflow: 'hidden',
    },
    fence: {
      backgroundColor: isOutgoing ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
      padding: 10,
      borderRadius: 4,
      fontFamily: 'monospace',
      color: textColor,
      marginVertical: 5,
      overflow: 'hidden',
    },
    pre: {
      backgroundColor: isOutgoing ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
      padding: 10,
      borderRadius: 4,
      marginVertical: 5,
      overflow: 'hidden',
    },
  }), [isOutgoing, textColor]);

  return (
    <View style={[
      styles.messageContainer,
      item.user.id === user?.id ? styles.outgoingContainer : styles.incomingContainer
    ]}>

      {/* Menu button */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={service.handleMenuPress}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color="#666" />
      </TouchableOpacity>

      <View style={[
        styles.messageBubble,
        item.user.id === user?.id ? styles.outgoingBubble : styles.incomingBubble
      ]}>

        {/* Media for this specific post */}
        {postMedia.length > 0 && (
          <View style={[
            styles.mediaContainer,
            postMedia.length > 1 && styles.gridMediaContainer
          ]}>
            <View style={styles.gridWrapper}>
              {postMedia.map((media: any, index: number) => {
                let itemStyle: any = styles.singleMedia;
                if (postMedia.length === 2) {
                  itemStyle = styles.gridItemTwo;
                } else if (postMedia.length === 3) {
                  itemStyle = index === 0 ? styles.gridItemThreeLarge : styles.gridItemThreeSmall;
                } else if (postMedia.length >= 4) {
                  itemStyle = styles.gridItemFour;
                }

                return (
                  <TouchableOpacity
                    key={`${media.id}-${index}`}
                    onPress={() => {
                      service.setMediaViewerIndex(index);
                      service.setMediaViewerVisible(true);
                    }}
                    style={itemStyle}
                  >
                    {media.type === 'video' ? (
                      <VideoView
                        player={useVideoPlayer(
                          `${getApiBaseImage()}/storage/${media.file_path}`
                        )}
                        style={styles.mediaContent}
                        contentFit="cover"
                        nativeControls={false}
                      />
                    ) : (
                      <Image
                        source={{ uri: `${getApiBaseImage()}/storage/${media.file_path}` }}
                        style={styles.mediaContent}
                        resizeMode="cover"
                      />
                    )}
                    {postMedia.length > 4 && index === 3 && (
                      <View style={styles.overlayMore}>
                        <Text style={styles.moreText}>+{postMedia.length - 3}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }).slice(0, 4)}
            </View>
          </View>
        )}

        {/* Message header with text and timestamp */}
        <View style={styles.messageHeader}>
          {item.caption && (
            <Markdown style={markdownStyles as any}>
              {preprocessMath(item.caption)}
            </Markdown>
          )}

          <Text style={[
            styles.messageTime,
            item.user.id === user?.id ? styles.outgoingTime : styles.incomingTime
          ]}>
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        {/* Post Action Buttons */}
        <View style={styles.messageActions}>
          <PostActionButtons
            post={item}
            onReact={(emoji: string) => service.handleReact(emoji, item.id)}
            onDeleteReaction={() => service.deletePostReaction(item.id)}
            onRepost={() => { }}
            onShare={() => { }}
            onBookmark={handleBookmark}
            onCommentPress={handleCommentPress}
            currentReactingItem={service.currentReactingItem}
            setCurrentReactingItem={service.setCurrentReactingItem}
            setIsEmojiPickerOpen={service.setIsEmojiPickerOpen}
            getGroupedReactions={service.getGroupedReactions}
            isBookmarked={isBookmarked}
            compact={true}
          />
        </View>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: 8,
    alignSelf: 'flex-start',
    position: 'relative',
  },
  outgoingContainer: {
    alignSelf: 'flex-end',
  },
  incomingContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
  },
  outgoingBubble: {
    backgroundColor: '#007AFF',
    borderTopRightRadius: 4,
  },
  incomingBubble: {
    backgroundColor: '#f0f0f0',
    borderTopLeftRadius: 4,
  },
  messageHeader: {
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  outgoingText: {
    color: '#fff',
  },
  incomingText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-start',
  },
  outgoingTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  incomingTime: {
    color: '#666',
  },
  mediaContainer: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 8,
  },
  gridMediaContainer: {
    aspectRatio: 1,
  },
  gridWrapper: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  singleMedia: {
    width: '100%',
    height: 250,
  },
  gridItemTwo: {
    width: '49.5%',
    height: '100%',
  },
  gridItemThreeLarge: {
    width: '50%',
    height: '100%',
  },
  gridItemThreeSmall: {
    width: '49%',
    height: '49.5%',
  },
  gridItemFour: {
    width: '49.5%',
    height: '49.5%',
  },
  mediaContent: {
    width: '100%',
    height: '100%',
  },
  overlayMore: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  multiMediaItem: {
    width: 120,
    height: 120,
    marginRight: 8,
    maxHeight: 120,
    alignSelf: 'center',
  },
  multiMediaContent: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  reaction: {
    fontSize: 16,
    marginRight: 4,
  },
  messageActions: {
    marginTop: 4,
    height: 40,
  },
  menuButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 4,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
  },
});

export default ChatMessage;