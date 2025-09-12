// components/ChatMessage.tsx
import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Video } from 'expo-av';
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

  // Handle menu press with the specific post
  const handleMenuPress = () => {
    if (onMenuPress) {
      onMenuPress();
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

      {item.caption && (
        <View style={[
          styles.messageBubble,
          item.user.id === user?.id ? styles.outgoingBubble : styles.incomingBubble
        ]}>
                      

          {/* Message header with text and timestamp */}
          <View style={styles.messageHeader}>
            <Text style={[
              styles.messageTime,
              item.user.id === user?.id ? styles.outgoingTime : styles.incomingTime
            ]}>
              {new Date(item.created_at).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            
            <Text style={[
              styles.messageText,
              item.user.id === user?.id ? styles.outgoingText : styles.incomingText
            ]}>
              {item.caption}
            </Text>
          </View>

          {/* Media for this specific post */}
          {postMedia.length > 0 && (
            <View style={styles.mediaContainer}>
              {postMedia.length === 1 ? (
                <TouchableOpacity onPress={() => {
                  service.setMediaViewerIndex(0);
                  service.setMediaViewerVisible(true);
                }}>
                  {postMedia[0].type === 'video' ? (
                    <Video
                      source={{ uri: `${getApiBaseImage()}/storage/${postMedia[0].file_path}` }}
                      style={styles.singleMedia}
                      resizeMode="cover"
                      shouldPlay={false}
                      isMuted
                      useNativeControls={false}
                    />
                  ) : (
                    <Image
                      source={{ uri: `${getApiBaseImage()}/storage/${postMedia[0].file_path}` }}
                      style={styles.singleMedia}
                      resizeMode="cover"
                    />
                  )}
                </TouchableOpacity>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {postMedia.map((media: any, index: number) => (
                    <TouchableOpacity 
                      key={`${media.id}-${index}`}
                      onPress={() => {
                        service.setMediaViewerIndex(index);
                        service.setMediaViewerVisible(true);
                      }}
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
          
          {/* Post Action Buttons */}
          <View style={styles.messageActions}>
            <PostActionButtons
              post={item}
              onReact={(emoji) => service.handleReact(emoji, item.id)}
              onDeleteReaction={() => service.deletePostReaction(item.id)}
              onRepost={() => {}}
              onShare={() => {}}
              onBookmark={() => {}}
              onCommentPress={handleCommentPress}
              currentReactingItem={service.currentReactingItem}
              setCurrentReactingItem={service.setCurrentReactingItem}
              setIsEmojiPickerOpen={service.setIsEmojiPickerOpen}
              getGroupedReactions={service.getGroupedReactions}
              compact={true}
            />
          </View>
        </View>
      )}

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
    maxHeight: 120,
    borderColor: 'black',
  },
  singleMedia: {
    width: 200,
    height: '100%',
    borderRadius: 12,
    maxHeight: 200,
    alignSelf: 'center',
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