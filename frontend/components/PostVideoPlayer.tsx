import React, { useState, useEffect } from 'react';
import { Platform, StyleSheet, Dimensions, Pressable, View, ActivityIndicator } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

interface PostVideoPlayerProps {
  uri: string;
  style: any;
  contentFit?: 'cover' | 'contain' | 'fill';
  shouldPlay?: boolean;
  isMuted?: boolean;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  poster?: string;
}

const isMobileWeb = Platform.OS === 'web' && Dimensions.get('window').width < 768;
const isNativeMobile = Platform.OS !== 'web';
const isMobilePlatform = isNativeMobile || isMobileWeb;

export const PostVideoPlayer = React.forwardRef<any, PostVideoPlayerProps>(({ 
  uri, 
  style, 
  contentFit = 'cover',
  shouldPlay = true,
  isMuted = true,
  volume = 1,
  poster
}, ref) => {
  // Manual play tracking for mobile
  const [isUserPlaying, setIsUserPlaying] = useState(!isMobilePlatform);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = isMobilePlatform ? true : isMuted;
    p.volume = volume;
    
    // Auto-start on desktop only
    if (!isMobilePlatform && shouldPlay) {
      p.play();
    }
  });

  // Sync muted state
  useEffect(() => {
    player.muted = isMobilePlatform ? true : isMuted;
  }, [player, isMuted]);

  // Sync volume
  useEffect(() => {
    player.volume = volume;
  }, [player, volume]);

  // Main playback control logic
  useEffect(() => {
    const handlePlayback = async () => {
      try {
        if (shouldPlay) {
          if (!isMobilePlatform || isUserPlaying) {
            // Attempt playback
            const playPromise = player.play();
            if (playPromise instanceof Promise) {
              await playPromise;
            }
            setPlaybackError(null);
          } else {
            player.pause();
          }
        } else {
          player.pause();
          // STRICT: Reset manual play state when scrolled out of view on mobile
          if (isMobilePlatform) {
            setIsUserPlaying(false);
          }
        }
      } catch (err: any) {
        // Handle browser autoplay/interaction errors (NotAllowedError etc)
        if (err?.name === 'NotAllowedError' || err?.message?.includes('interaction')) {
          console.warn('[PostVideoPlayer] Autoplay blocked or interaction required');
          setIsUserPlaying(false);
          setPlaybackError('Tap to play');
        } else {
          console.error('[PostVideoPlayer] Playback error:', err);
          setPlaybackError('Error');
        }
      }
    };

    handlePlayback();
  }, [player, shouldPlay, isUserPlaying]);

  const togglePlayback = () => {
    if (!isMobilePlatform) return;
    
    try {
      if (isUserPlaying) {
        player.pause();
        setIsUserPlaying(false);
      } else {
        setIsUserPlaying(true);
        setPlaybackError(null);
        // Play call is handled by the useEffect above
      }
    } catch (err) {
      console.error('[PostVideoPlayer] Toggle error:', err);
    }
  };

  return (
    <View style={[style, styles.container]}>
      <Pressable 
        onPress={togglePlayback} 
        style={StyleSheet.absoluteFill}
        disabled={!isMobilePlatform}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          nativeControls={false}
          allowsVideoFrameAnalysis={false}
          // @ts-ignore - expo-video uses this for web poster
          posterSource={poster ? { uri: poster } : undefined}
        />

        {/* Play/Pause Overlay for Mobile */}
        {isMobilePlatform && !isUserPlaying && (
          <View style={styles.overlay}>
             <View style={styles.playIconContainer}>
               <Ionicons name="play" size={40} color="white" />
             </View>
             {playbackError && (
               <Text style={styles.errorText}>{playbackError}</Text>
             )}
          </View>
        )}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4, // Center the triangle
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  }
});
