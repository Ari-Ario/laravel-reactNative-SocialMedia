// components/LinkPreviewCard.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
  ActivityIndicator,
  Modal,
  Dimensions,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAudioPlayer } from 'expo-audio';
import * as WebBrowser from 'expo-web-browser';
import { BlurView } from 'expo-blur';
import { createShadow } from '@/utils/styles';
import axios from 'axios';
import { useAppTheme } from '@/hooks/useAppTheme';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// --- Styles ---

const getStyles = (colors: any, activeScheme: string) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginVertical: 8,
    width: '100%',
    overflow: 'hidden',
    ...createShadow({ opacity: activeScheme === 'dark' ? 0.3 : 0.05, radius: 8 }),
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  containerHovered: {
    ...createShadow({ opacity: activeScheme === 'dark' ? 0.4 : 0.1, radius: 12 }),
    borderColor: colors.primary,
  },
  containerCompact: {
    marginVertical: 4,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: activeScheme === 'dark' ? 'rgba(255, 68, 68, 0.1)' : '#FFF0F0',
    borderColor: activeScheme === 'dark' ? 'rgba(255, 68, 68, 0.3)' : '#FFCDD2',
  },
  errorContent: {
    alignItems: 'center',
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: '#FF3B30',
    textAlign: 'center',
  },
  fallbackUrl: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  platformIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  domain: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  date: {
    fontSize: 10,
  },
  content: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  contentCompact: {
    padding: 8,
    gap: 8,
  },
  mediaContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  mediaContainerCompact: {
    width: 65,
    height: 65,
    borderRadius: 10,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  audioPreview: {
    width: '100%',
    height: '100%',
  },
  audioVisualizer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 8,
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
  placeholderMedia: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  textContainerCompact: {
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 18,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  authorText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  typeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  openContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openText: {
    fontSize: 11,
    color: '#1DA1F2',
    fontWeight: '600',
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  expandedDescription: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    marginBottom: 10,
  },
  embedContainer: {
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  embedTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  embedUrl: {
    fontSize: 10,
    color: colors.primary,
  },
  mediaModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  mediaModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  mediaModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  fullscreenImage: {
    width: width,
    height: height * 0.7,
  },
  fullscreenVideo: {
    width: width,
    height: height * 0.7,
  },
  audioPlayerContainer: {
    alignItems: 'center',
    padding: 30,
  },
  audioArtwork: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  audioTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  audioControls: {
    flexDirection: 'row',
    gap: 20,
  },
  audioControl: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  skeletonCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  skeletonLineShort: {
    width: 80,
    height: 12,
    borderRadius: 6,
  },
  skeletonBody: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonMedia: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  skeletonTextContainer: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  skeletonLineLong: {
    width: '100%',
    height: 12,
    borderRadius: 6,
  },
});

// --- interfaces ---

interface LinkPreviewData {
  title: string;
  description: string;
  image: string | null;
  video: string | null;
  audio: string | null;
  siteName: string;
  favicon: string | null;
  type: 'website' | 'video' | 'audio' | 'article' | 'product' | 'social' | 'unknown';
  author: string | null;
  publishedDate: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  embedUrl: string | null;
  embedCode: string | null;
}

interface LinkPreviewCardProps {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  style?: any;
  onError?: (error: Error) => void;
  onLoad?: (data: LinkPreviewData) => void;
  compact?: boolean;
  showMediaControls?: boolean;
  autoPlayVideo?: boolean;
}

// --- Premium Sub-Components ---

const SkeletonItem = ({ style }: { style?: any }) => {
  const { colors } = useAppTheme();
  return (
    <MotiView
      from={{ opacity: 0.5, scale: 1 }}
      animate={{ opacity: 0.8, scale: 1 }}
      transition={{
        type: 'timing',
        duration: 1000,
        loop: true,
        repeatReverse: true,
      }}
      style={[{ backgroundColor: colors.border, borderRadius: 8 }, style]}
    />
  );
};

const AnimatedWaveformBar = ({ index }: { index: number }) => {
  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, activeScheme);
  return (
    <MotiView
      animate={{
        height: [10, 25, 12, 20, 10][index % 5],
      }}
      transition={{
        type: 'timing',
        duration: 500 + (index * 100),
        loop: true,
        repeatReverse: true,
      }}
      style={styles.waveformBar}
    />
  );
};

const extractDomain = (url: string): string => {
  try {
    const domain = url.split('/')[2];
    return domain?.replace('www.', '') || 'unknown';
  } catch {
    return 'unknown';
  }
};

const getPlatformIcon = (domain: string): string => {
  if (domain.includes('youtube') || domain.includes('youtu.be')) return 'logo-youtube';
  if (domain.includes('twitter') || domain.includes('x.com')) return 'logo-twitter';
  if (domain.includes('instagram')) return 'logo-instagram';
  if (domain.includes('facebook')) return 'logo-facebook';
  if (domain.includes('linkedin')) return 'logo-linkedin';
  if (domain.includes('github')) return 'logo-github';
  if (domain.includes('medium')) return 'logo-medium';
  if (domain.includes('reddit')) return 'logo-reddit';
  if (domain.includes('tiktok')) return 'logo-tiktok';
  if (domain.includes('spotify')) return 'logo-spotify';
  if (domain.includes('soundcloud')) return 'logo-soundcloud';
  if (domain.includes('vimeo')) return 'logo-vimeo';
  if (domain.includes('dailymotion')) return 'logo-dailymotion';
  if (domain.includes('twitch')) return 'logo-twitch';
  if (domain.includes('discord')) return 'logo-discord';
  if (domain.includes('whatsapp')) return 'logo-whatsapp';
  if (domain.includes('telegram')) return 'logo-telegram';
  if (domain.includes('pinterest')) return 'logo-pinterest';
  if (domain.includes('tumblr')) return 'logo-tumblr';
  return 'link-outline';
};

const getPlatformColor = (domain: string): string => {
  if (domain.includes('youtube')) return '#FF0000';
  if (domain.includes('twitter') || domain.includes('x.com')) return '#1DA1F2';
  if (domain.includes('instagram')) return '#E4405F';
  if (domain.includes('facebook')) return '#1877F2';
  if (domain.includes('linkedin')) return '#0077B5';
  if (domain.includes('github')) return '#181717';
  if (domain.includes('medium')) return '#00AB6C';
  if (domain.includes('reddit')) return '#FF4500';
  if (domain.includes('tiktok')) return '#000000';
  if (domain.includes('spotify')) return '#1DB954';
  if (domain.includes('soundcloud')) return '#FF3300';
  if (domain.includes('vimeo')) return '#1AB7EA';
  return '#3498db';
};

const isValidImageUrl = (url: string): boolean => {
  return !!(url && (url.startsWith('http://') || url.startsWith('https://')));
};

const getDirectMediaType = (url: string): 'image' | 'video' | 'audio' | null => {
  if (!url) return null;
  const path = url.split(/[?#]/)[0];
  const extension = path.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension || '')) return 'image';
  if (['mp4', 'm4v', 'webm', 'mov', 'avi', 'mkv'].includes(extension || '')) return 'video';
  if (['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'].includes(extension || '')) return 'audio';
  return null;
};

// Enhanced YouTube thumbnail extraction
const getYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?#]+)/,
    /youtube\.com\/embed\/([^/?]+)/,
    /youtube\.com\/v\/([^/?]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const getYouTubeThumbnail = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

// Enhanced Twitter/X card image extraction
const getTwitterCardImage = (html: string): string | null => {
  const match = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
  return match ? match[1] : null;
};

// Enhanced Open Graph image extraction from HTML
const extractOpenGraphImage = (html: string): string | null => {
  const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  return match ? match[1] : null;
};

const MediaViewerModal = ({
  visible,
  onClose,
  mediaUrl,
  mediaType,
  title
}: {
  visible: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio';
  title?: string;
}) => {
  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, activeScheme);

  const videoPlayer = useVideoPlayer(mediaUrl, (player) => {
    player.loop = true;
    if (visible && mediaType === 'video') player.play();
  });

  const audioPlayer = useAudioPlayer(mediaUrl);

  useEffect(() => {
    if (visible) {
      if (mediaType === 'video') videoPlayer.play();
      if (mediaType === 'audio') audioPlayer.play();
    } else {
      videoPlayer.pause();
      audioPlayer.pause();
    }
  }, [visible, mediaType]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={90} tint="dark" style={styles.mediaModal}>
        <View style={styles.mediaModalHeader}>
          <Text style={styles.mediaModalTitle}>{title || 'Media Preview'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.mediaModalClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.mediaModalContent}>
          {mediaType === 'image' && (
            <Image
              source={{ uri: mediaUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
          {mediaType === 'video' && (
            <VideoView
              player={videoPlayer}
              style={styles.fullscreenVideo}
              nativeControls
              contentFit="contain"
            />
          )}
          {mediaType === 'audio' && (
            <View style={styles.audioPlayerContainer}>
              <View style={styles.audioArtwork}>
                <Ionicons name="musical-notes" size={80} color="#3498db" />
              </View>
              <Text style={styles.audioTitle}>{title || 'Audio Preview'}</Text>
              <View style={styles.audioControls}>
                <TouchableOpacity
                  style={styles.audioControl}
                  onPress={() => audioPlayer.pause()}
                >
                  <Ionicons name="pause" size={32} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.audioControl}
                  onPress={() => audioPlayer.play()}
                >
                  <Ionicons name="play" size={32} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </BlurView>
    </Modal>
  );
};

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  url,
  title: propTitle,
  description: propDescription,
  image: propImage,
  style,
  onError,
  onLoad,
  compact = false,
  showMediaControls = true,
  autoPlayVideo = false,
}) => {
  const [previewData, setPreviewData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: string } | null>(null);

  const videoPreviewPlayer = useVideoPlayer(previewData?.video || '', (player) => {
    player.loop = true;
    player.muted = true;
    if (autoPlayVideo) player.play();
  });

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isHovered, setIsHovered] = useState(false);

  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, activeScheme);

  const domain = extractDomain(url);
  const platformIcon = getPlatformIcon(domain);
  const platformColor = getPlatformColor(domain);

  useEffect(() => {
    fetchPreviewData();
  }, [url]);

  const fetchPreviewData = async () => {
    setLoading(true);
    setError(null);

    // Check for direct media files first
    const directType = getDirectMediaType(url);
    if (directType) {
      const mediaData: LinkPreviewData = {
        title: propTitle || url.split('/').pop()?.split(/[?#]/)[0] || 'Media Preview',
        description: propDescription || `Direct ${directType} file`,
        image: directType === 'image' ? url : propImage || null,
        video: directType === 'video' ? url : null,
        audio: directType === 'audio' ? url : null,
        siteName: domain,
        favicon: null,
        type: directType as any,
        author: null,
        publishedDate: null,
        duration: null,
        width: null,
        height: null,
        embedUrl: null,
        embedCode: null,
      };
      setPreviewData(mediaData);
      setLoading(false);
      onLoad?.(mediaData);
      return;
    }

    // Check for YouTube
    const youtubeId = getYouTubeVideoId(url);
    if (youtubeId) {
      const youtubeThumbnail = getYouTubeThumbnail(youtubeId);
      const mediaData: LinkPreviewData = {
        title: propTitle || 'YouTube Video',
        description: propDescription || 'Watch this video on YouTube',
        image: youtubeThumbnail,
        video: url,
        audio: null,
        siteName: 'YouTube',
        favicon: 'https://youtube.com/favicon.ico',
        type: 'video',
        author: null,
        publishedDate: null,
        duration: null,
        width: null,
        height: null,
        embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
        embedCode: null,
      };
      setPreviewData(mediaData);
      setLoading(false);
      onLoad?.(mediaData);
      return;
    }

    try {
      // Try microlink.io API first
      const response = await axios.get(`https://api.microlink.io?url=${encodeURIComponent(url)}`, {
        timeout: 8000,
        headers: {
          'Accept': 'application/json',
        },
        validateStatus: (status) => status < 500,
      });

      if (response.status === 200 && response.data && response.data.data) {
        const data = response.data.data;
        let imageUrl = data.image?.url || propImage || null;

        // If no image found, try to extract from HTML
        if (!imageUrl && data.html) {
          imageUrl = extractOpenGraphImage(data.html) || getTwitterCardImage(data.html);
        }

        const preview: LinkPreviewData = {
          title: data.title || propTitle || url,
          description: data.description || propDescription || '',
          image: imageUrl,
          video: data.video?.url || null,
          audio: data.audio || null,
          siteName: data.site_name || domain,
          favicon: data.logo?.url || null,
          type: data.type || 'website',
          author: data.author || null,
          publishedDate: data.published_date || null,
          duration: data.video?.duration || null,
          width: data.video?.width || data.image?.width || null,
          height: data.video?.height || data.image?.height || null,
          embedUrl: data.embed?.url || null,
          embedCode: data.embed?.html || null,
        };
        setPreviewData(preview);
        onLoad?.(preview);
        setLoading(false);
        return;
      }

      // If API fails but we have a YouTube ID, we already set preview
      if (youtubeId) {
        setLoading(false);
        return;
      }

      // Fallback: Use placeholder image from favicon service
      const fallbackImage = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      const fallbackData: LinkPreviewData = {
        title: propTitle || url,
        description: propDescription || `Click to visit ${domain}`,
        image: fallbackImage,
        video: null,
        audio: null,
        siteName: domain,
        favicon: fallbackImage,
        type: 'website',
        author: null,
        publishedDate: null,
        duration: null,
        width: null,
        height: null,
        embedUrl: null,
        embedCode: null,
      };
      setPreviewData(fallbackData);
      onLoad?.(fallbackData);

    } catch (err: any) {
      console.warn('Link preview fetch failed:', err?.message || err);

      // Even on error, try to show a favicon-based preview
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      const errorData: LinkPreviewData = {
        title: propTitle || url,
        description: propDescription || `Click to visit ${domain}`,
        image: faviconUrl,
        video: null,
        audio: null,
        siteName: domain,
        favicon: faviconUrl,
        type: 'unknown',
        author: null,
        publishedDate: null,
        duration: null,
        width: null,
        height: null,
        embedUrl: null,
        embedCode: null,
      };
      setPreviewData(errorData);
      setError('Basic preview mode');
      onError?.(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = async () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: Platform.OS !== 'web', friction: 5 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: Platform.OS !== 'web', friction: 5 }),
    ]).start();

    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.OVER_FULL_SCREEN,
          controlsColor: '#3498db',
          toolbarColor: '#fff',
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open link');
    }
  };

  const handleMediaPress = (mediaUrl: string, type: string) => {
    setSelectedMedia({ url: mediaUrl, type });
    setMediaModalVisible(true);
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <View style={styles.skeletonHeader}>
          <SkeletonItem style={styles.skeletonCircle} />
          <SkeletonItem style={styles.skeletonLineShort} />
        </View>
        <View style={styles.skeletonBody}>
          <SkeletonItem style={styles.skeletonMedia} />
          <View style={styles.skeletonTextContainer}>
            <SkeletonItem style={styles.skeletonLineLong} />
            <SkeletonItem style={[styles.skeletonLineLong, { width: '80%' }]} />
            <SkeletonItem style={[styles.skeletonLineLong, { width: '60%' }]} />
          </View>
        </View>
      </View>
    );
  }

  if (error && !previewData) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.errorContainer, style]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.errorContent}>
          <Ionicons name="alert-circle" size={24} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.fallbackUrl} numberOfLines={1}>{url}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (!previewData) return null;

  const hasMedia = previewData.video || previewData.audio || previewData.image;

  const webHoverProps = Platform.OS === 'web' ? {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  } : {};

  return (
    <>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePress}
          onLongPress={() => setShowFullPreview(!showFullPreview)}
          {...webHoverProps}
          style={[
            styles.container,
            isHovered && styles.containerHovered,
            style,
            compact && styles.containerCompact
          ]}
        >
          <LinearGradient
            colors={isHovered
              ? (activeScheme === 'dark' ? ['#2c2c2e', '#1c1c1e'] : ['#fff', '#f8f9fa'])
              : [colors.surface, colors.surface]}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Header with Platform Icon */}
            <View style={styles.header}>
              <View style={[styles.platformIcon, { backgroundColor: platformColor + '15' }]}>
                <Ionicons name={platformIcon as any} size={16} color={platformColor} />
              </View>
              <Text style={[styles.domain, { color: colors.textSecondary }]} numberOfLines={1}>
                {previewData.siteName || domain}
              </Text>
              {previewData.publishedDate && (
                <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(previewData.publishedDate)}</Text>
              )}
            </View>

            {/* Main Content */}
            <View style={[styles.content, compact && styles.contentCompact]}>
              {/* Media Container - Always show something */}
              <TouchableOpacity
                style={[styles.mediaContainer, compact && styles.mediaContainerCompact]}
                onPress={() => {
                  if (previewData.video) handleMediaPress(previewData.video, 'video');
                  else if (previewData.audio) handleMediaPress(previewData.audio, 'audio');
                  else if (previewData.image) handleMediaPress(previewData.image, 'image');
                  else if (previewData.favicon) handleMediaPress(previewData.favicon, 'image');
                }}
              >
                {previewData.video ? (
                  <View style={styles.videoPreview}>
                    <VideoView
                      player={videoPreviewPlayer}
                      style={styles.videoThumbnail}
                      contentFit="cover"
                      nativeControls={false}
                    />
                    {previewData.duration && !compact && (
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>
                          {formatDuration(previewData.duration)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.playOverlay}>
                      <Ionicons name="play-circle" size={compact ? 24 : 48} color="#fff" />
                    </View>
                  </View>
                ) : previewData.audio ? (
                  <View style={styles.audioPreview}>
                    <LinearGradient
                      colors={[platformColor, platformColor + '80']}
                      style={styles.audioVisualizer}
                    >
                      <Ionicons name="musical-notes" size={compact ? 20 : 32} color="#fff" />
                      {!compact && (
                        <View style={styles.waveform}>
                          {[...Array(12)].map((_, i) => (
                            <AnimatedWaveformBar key={i} index={i} />
                          ))}
                        </View>
                      )}
                    </LinearGradient>
                  </View>
                ) : (previewData.image && isValidImageUrl(previewData.image)) ? (
                  <Image
                    source={{ uri: previewData.image }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                ) : previewData.favicon ? (
                  <Image
                    source={{ uri: previewData.favicon }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.placeholderMedia}>
                    <Ionicons name={platformIcon as any} size={32} color={platformColor} />
                  </View>
                )}
              </TouchableOpacity>

              <View style={[styles.textContainer, compact && styles.textContainerCompact]}>
                <Text style={styles.title} numberOfLines={compact ? 2 : 3}>
                  {previewData.title}
                </Text>

                {previewData.description && !compact ? (
                  <Text style={styles.description} numberOfLines={showFullPreview ? undefined : 2}>
                    {previewData.description}
                  </Text>
                ) : !compact && !previewData.description && previewData.siteName ? (
                  <Text style={styles.description} numberOfLines={1}>
                    {previewData.siteName}
                  </Text>
                ) : null}

                {previewData.author && !compact ? (
                  <View style={styles.authorContainer}>
                    <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.authorText}>by {previewData.author}</Text>
                  </View>
                ) : null}

                {/* Type Badges */}
                {previewData.type !== 'unknown' && !compact ? (
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>
                      {previewData.type === 'video' ? '🎬 Video' :
                        previewData.type === 'audio' ? '🎵 Audio' :
                          previewData.type === 'article' ? '📄 Article' :
                            previewData.type === 'product' ? '🛍️ Product' :
                              previewData.type === 'social' ? '💬 Social Post' : '🔗 Link'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Footer Actions */}
            {!compact ? (
              <View style={styles.footer}>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      setShowFullPreview(!showFullPreview);
                    }}
                  >
                    <Ionicons
                      name={showFullPreview ? "chevron-up" : "chevron-down"}
                      size={16}
                      color="#3498db"
                    />
                    <Text style={styles.actionText}>
                      {showFullPreview ? "Show less" : "Show more"}
                    </Text>
                  </TouchableOpacity>

                  {hasMedia ? (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (previewData.video) handleMediaPress(previewData.video, 'video');
                        else if (previewData.audio) handleMediaPress(previewData.audio, 'audio');
                        else if (previewData.image) handleMediaPress(previewData.image, 'image');
                        else if (previewData.favicon) handleMediaPress(previewData.favicon, 'image');
                      }}
                    >
                      <Ionicons name="expand-outline" size={16} color="#3498db" />
                      <Text style={styles.actionText}>Expand</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.openContainer}>
                  <Text style={styles.openText}>Open link</Text>
                  <Ionicons name="open-outline" size={14} color="#1DA1F2" />
                </View>
              </View>
            ) : null}

            {/* Full Preview Expanded Content */}
            <AnimatePresence>
              {showFullPreview && previewData.description && (
                <MotiView
                  from={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={styles.expandedContent}
                >
                  <View style={styles.expandedDivider} />
                  <Text style={styles.expandedDescription}>
                    {previewData.description}
                  </Text>

                  {previewData.embedUrl && (
                    <View style={styles.embedContainer}>
                      <Text style={styles.embedTitle}>Embedded Content</Text>
                      <Text style={styles.embedUrl} numberOfLines={1}>
                        {previewData.embedUrl}
                      </Text>
                    </View>
                  )}
                </MotiView>
              )}
            </AnimatePresence>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Media Viewer Modal */}
      {selectedMedia && (
        <MediaViewerModal
          visible={mediaModalVisible}
          onClose={() => {
            setMediaModalVisible(false);
            setSelectedMedia(null);
          }}
          mediaUrl={selectedMedia.url}
          mediaType={selectedMedia.type as any}
          title={previewData?.title}
        />
      )}
    </>
  );
};