/**
 * PlatformCameraView.web.tsx
 * Web camera using browser getUserMedia + <video> element
 */
import React, { useEffect, useRef, useState } from 'react';

interface Props {
    style?: React.CSSProperties;
    facing?: 'front' | 'back';
    onCapture?: (uri: string) => void;
    showControls?: boolean;
    cameraRef?: React.RefObject<any>;
}

export default function PlatformCameraView({
    style,
    facing = 'front',
    showControls = false,
    onCapture,
    cameraRef,
}: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;

        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: facing === 'front' ? 'user' : 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });
                setHasPermission(true);

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                // Expose stream to parent via cameraRef
                if (cameraRef && typeof cameraRef === 'object') {
                    (cameraRef as any).current = { stream, videoRef };
                }
            } catch (err: any) {
                setHasPermission(false);
                setError(err?.message ?? 'Camera access denied');
            }
        };

        startCamera();

        return () => {
            stream?.getTracks().forEach((t) => t.stop());
        };
    }, [facing]);

    const handleCapture = () => {
        if (!videoRef.current || !onCapture) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(videoRef.current, 0, 0);
        const uri = canvas.toDataURL('image/jpeg', 0.9);
        onCapture(uri);
    };

    if (hasPermission === false) {
        return (
            <div style={{ ...containerStyle, ...style, color: '#fff', justifyContent: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 48 }}>📷</span>
                <p style={{ color: '#aaa', textAlign: 'center', padding: 16 }}>
                    {error ?? 'Camera permission denied. Please allow camera access in your browser settings.'}
                </p>
            </div>
        );
    }

    return (
        <div style={{ ...containerStyle, ...style }}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facing === 'front' ? 'scaleX(-1)' : 'none' }}
            />
            {showControls && onCapture && (
                <div style={controlsStyle}>
                    <button
                        onClick={handleCapture}
                        style={captureButtonStyle}
                        title="Take photo"
                    >
                        📷
                    </button>
                </div>
            )}
        </div>
    );
}

const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
};

const controlsStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
};

const captureButtonStyle: React.CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: '3px solid white',
    background: 'rgba(255,255,255,0.2)',
    cursor: 'pointer',
    fontSize: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(8px)',
};
