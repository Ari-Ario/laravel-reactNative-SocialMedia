import React from 'react';
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
  };
  isCurrentUser: boolean;
  showAvatar: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onLongPressWithPosition?: (message: any, x: number, y: number) => void;
  onPollPress?: (poll: any) => void;
  /** Required for InlinePollCard voting */
  spaceId?: string;
  currentUserId?: number;
  currentUserRole?: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isCurrentUser,
  showAvatar,
  isSelected,
  onPress,
  onLongPress,
  onLongPressWithPosition,
  onPollPress,
  spaceId,
  currentUserId,
  currentUserRole,
}) => {
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

      const fileUri = `${FileSystem.documentDirectory}${filename}`;
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

      default:
        return (
          <Text style={[
            styles.textContent,
            isCurrentUser ? styles.currentUserText : styles.otherUserText
          ]}>
            {message.content}
          </Text>
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

  // ── Poll messages: render PollViewer directly (no bubble wrapper) ───────
  // This makes polls look exactly like WhatsApp — a standalone card in the feed.
  if (message.type === 'poll') {
    const pollData = message.poll || message.metadata?.pollData;
    if (pollData && spaceId && currentUserId) {
      return (
        <View
          style={[
            styles.container,
            isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer,
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
          <PollViewer
            poll={pollData}
            spaceId={spaceId}
            currentUserId={currentUserId}
            currentUserRole="participant" // Default to participant for now, will pass correctly if needed
            onRefresh={() => { }} // No-op, real-time updates handle this
          />
        </View>
      );
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={(event) => {
        if (onLongPressWithPosition) {
          event.currentTarget.measure((x, y, width, height, pageX, pageY) => {
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
        isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
      ]}>
        {!isCurrentUser && showAvatar && (
          <Text style={styles.userName}>{message.user?.name}</Text>
        )}

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
  textContent: {
    fontSize: 16,
    lineHeight: 22,
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
    fontSize: 14,
    fontWeight: '600',
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
});

export default MessageBubble;