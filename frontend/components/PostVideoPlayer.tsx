import React from 'react';
import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface PostVideoPlayerProps {
  uri: string;
  style: any;
  contentFit?: 'cover' | 'contain' | 'fill';
  shouldPlay?: boolean;
  isMuted?: boolean;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
}

export const PostVideoPlayer = React.forwardRef<any, PostVideoPlayerProps>(({ 
  uri, 
  style, 
  contentFit = 'cover',
  shouldPlay = true,
  isMuted = true,
  volume = 1
}, ref) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = isMuted;
    p.volume = volume;
    if (shouldPlay) p.play();
  });

  React.useEffect(() => {
    player.muted = isMuted;
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
    />
  );
});
