/**
 * PlatformVideoPlayer.web.tsx
 * Web video playback using HTML <video> element
 */
import React from 'react';

interface Props {
    uri: string;
    style?: React.CSSProperties;
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
    const objectFitMap = {
        contain: 'contain',
        cover: 'cover',
        fill: 'fill',
    } as const;

    return (
        <video
            src={uri}
            autoPlay={autoPlay}
            loop={loop}
            muted={muted}
            controls={controls}
            playsInline
            style={{
                width: '100%',
                height: '100%',
                objectFit: objectFitMap[resizeMode],
                display: 'block',
                ...style,
            }}
        />
    );
}
