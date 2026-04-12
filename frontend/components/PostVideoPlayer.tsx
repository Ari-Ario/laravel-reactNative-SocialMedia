import React from 'react';
import { Platform, StyleSheet, Dimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

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

export const PostVideoPlayer = React.forwardRef<any, PostVideoPlayerProps>(({ 
  uri, 
  style, 
  contentFit = 'cover',
  shouldPlay = true,
  isMuted = true,
  volume = 1,
  poster
}, ref) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    // On mobile web, autoplay REQUIRES muted state
    p.muted = isMobileWeb ? true : isMuted;
    p.volume = volume;
    if (shouldPlay) p.play();
  });

  React.useEffect(() => {
    player.muted = isMobileWeb ? true : isMuted;
  }, [player, isMuted]);

  React.useEffect(() => {
    player.volume = volume;
  }, [player, volume]);

  React.useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, shouldPlay]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={false}
      allowsVideoFrameAnalysis={false}
      // @ts-ignore - expo-video uses this for web poster
      posterSource={poster ? { uri: poster } : undefined}
    />
  );
});
