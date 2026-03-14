import React, { useEffect, useRef, useState, useImperativeHandle } from 'react';

interface Props {
    style?: React.CSSProperties;
    facing?: 'front' | 'back';
    flash?: 'off' | 'on' | 'auto';
    zoom?: number;
    onCapture?: (uri: string) => void;
    showControls?: boolean;
    cameraRef?: React.RefObject<any>;
    children?: React.ReactNode;
}

export default function PlatformCameraView({
    style,
    facing = 'front',
    flash = 'off',
    zoom = 0,
    showControls = false,
    onCapture,
    cameraRef,
    children,
}: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const recordingPromiseRef = useRef<{ resolve: (val: any) => void; reject: (err: any) => void } | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: facing === 'front' ? 'user' : 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: true, // Enable audio for stories
                });
                streamRef.current = stream;
                setHasPermission(true);

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
            } catch (err: any) {
                setHasPermission(false);
                setError(err?.message ?? 'Camera access denied');
            }
        };

        startCamera();

        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, [facing]);

    // Use useImperativeHandle to expose methods via cameraRef if passed
    // though cameraRef is usually a prop here, we can set it manually if it's a ref object
    useEffect(() => {
        if (cameraRef && 'current' in cameraRef) {
            (cameraRef as any).current = {
                takePictureAsync: async () => {
                    if (!videoRef.current) throw new Error('Video ref not ready');
                    const canvas = document.createElement('canvas');
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('Could not get canvas context');
                    
                    // Flip photo if front facing to match preview
                    if (facing === 'front') {
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                    }
                    
                    ctx.drawImage(videoRef.current, 0, 0);
                    return { uri: canvas.toDataURL('image/jpeg', 0.9) };
                },
                recordAsync: async (options: any) => {
                    if (!streamRef.current) throw new Error('Stream not ready');
                    
                    return new Promise((resolve, reject) => {
                        chunksRef.current = [];
                        
                        // Try to find supported mime type
                        const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
                        const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
                        
                        const stream = streamRef.current;
                        if (!stream) {
                            reject(new Error('Stream not ready'));
                            return;
                        }
                        const recorder = new MediaRecorder(stream, { mimeType });
                        mediaRecorderRef.current = recorder;
                        recordingPromiseRef.current = { resolve, reject };

                        recorder.ondataavailable = (e) => {
                            if (e.data.size > 0) chunksRef.current.push(e.data);
                        };

                        recorder.onstop = () => {
                            const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
                            const uri = URL.createObjectURL(blob);
                            resolve({ uri });
                        };

                        recorder.onerror = (err) => {
                            reject(err);
                        };

                        recorder.start();
                    });
                },
                stopRecording: () => {
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                        mediaRecorderRef.current.stop();
                    }
                }
            };
        }
    }, [cameraRef, facing]);

    const handleCapture = async () => {
        if (!cameraRef?.current || !onCapture) return;
        const result = await cameraRef.current.takePictureAsync();
        onCapture(result.uri);
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
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    transform: facing === 'front' ? 'scaleX(-1)' : 'none',
                    backgroundColor: '#111'
                }}
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
            <div style={childrenWrapperStyle}>
                {children}
            </div>
        </div>
    );
}

const childrenWrapperStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none' as any,
    display: 'flex',
    flexDirection: 'column',
};

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
