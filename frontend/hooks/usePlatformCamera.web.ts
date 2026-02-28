/**
 * usePlatformCamera.web.ts
 * Web implementation using browser getUserMedia API
 */
import { useRef, useState, useCallback } from 'react';

export interface CameraPermissions {
    cameraGranted: boolean;
    micGranted: boolean;
    requestPermissions: () => Promise<void>;
}

export interface PlatformCameraHook extends CameraPermissions {
    cameraRef: React.RefObject<HTMLVideoElement | null>;
    stream: MediaStream | null;
    isReady: boolean;
    facing: 'front' | 'back';
    toggleFacing: () => void;
    startStream: () => Promise<void>;
    stopStream: () => void;
}

export function usePlatformCamera(): PlatformCameraHook {
    const cameraRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [facing, setFacing] = useState<'front' | 'back'>('front');
    const [cameraGranted, setCameraGranted] = useState(false);
    const [micGranted, setMicGranted] = useState(false);

    const startStream = useCallback(async () => {
        try {
            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: facing === 'front' ? 'user' : 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: true,
            };
            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = mediaStream;
            setStream(mediaStream);
            setCameraGranted(true);
            setMicGranted(true);
            setIsReady(true);

            if (cameraRef.current) {
                cameraRef.current.srcObject = mediaStream;
                await cameraRef.current.play();
            }
        } catch (err) {
            console.error('Camera access denied:', err);
        }
    }, [facing]);

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setStream(null);
            setIsReady(false);
        }
    }, []);

    const requestPermissions = async () => {
        await startStream();
    };

    const toggleFacing = useCallback(() => {
        setFacing((f) => (f === 'front' ? 'back' : 'front'));
        stopStream();
    }, [stopStream]);

    return {
        cameraRef,
        stream,
        isReady,
        facing,
        toggleFacing,
        cameraGranted,
        micGranted,
        requestPermissions,
        startStream,
        stopStream,
    } as PlatformCameraHook;
}
