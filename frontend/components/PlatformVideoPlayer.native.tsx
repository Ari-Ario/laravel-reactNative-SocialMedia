/**
 * PlatformVideoPlayer.native.tsx
 * Native video playback using expo-video
 */
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface Props {
    uri: string;
    style?: ViewStyle;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    controls?: boolean;
    resizeMode?: 'contain' | 'cover' | 'fill';
}

export default function PlatformVideoPlayer({
    uri,
    style,
    autoPlay = false,
    loop = false,
    muted = false,
    controls = false,
    resizeMode = 'contain',
}: Props) {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = loop;
        p.muted = muted;
        if (autoPlay) p.play();
    });

    return (
        <VideoView
            player={player}
            style={[styles.video, style]}
            contentFit={resizeMode}
            nativeControls={controls}
        />
    );
}

const styles = StyleSheet.create({
    video: {
        width: '100%',
        height: '100%',
    },
});
