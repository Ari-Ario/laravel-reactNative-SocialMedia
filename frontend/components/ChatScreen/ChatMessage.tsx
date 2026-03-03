// components/ChatMessage.tsx
import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { PostActionButtons } from '../PostActionButtons';
import getApiBaseImage from '@/services/getApiBaseImage';
import { Ionicons } from '@expo/vector-icons';

interface ChatMessageProps {
  item: any;
  user: any;
  service: any;
  onMenuPress?: () => void;
  onCommentPress?: (post: any) => void;
}

const ChatMessage = ({ item, user, service, onMenuPress, onCommentPress }: ChatMessageProps) => {
  const postMedia = useMemo(() => {
    return service.sortMedia(item.media || []);
  }, [item.media, service]);

  // Handle comment press with the specific post
  const handleCommentPress = () => {
    if (onCommentPress) {
      onCommentPress(item);
    } else {
      service.setShowComments(!service.showComments);
    }
  };

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
            <Text style={[
              styles.messageText,
              item.user.id === user?.id ? styles.outgoingText : styles.incomingText
            ]}>
              {item.caption}
            </Text>
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
            onBookmark={() => { }}
            onCommentPress={handleCommentPress}
            currentReactingItem={service.currentReactingItem}
            setCurrentReactingItem={service.setCurrentReactingItem}
            setIsEmojiPickerOpen={service.setIsEmojiPickerOpen}
            getGroupedReactions={service.getGroupedReactions}
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