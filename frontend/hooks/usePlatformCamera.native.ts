/**
 * usePlatformCamera.native.ts
 * Native implementation using expo-camera
 */
import { useRef, useState } from 'react';
import { useCameraPermissions, useMicrophonePermissions, CameraType } from 'expo-camera';

export interface CameraPermissions {
    cameraGranted: boolean;
    micGranted: boolean;
    requestPermissions: () => Promise<void>;
}

export interface PlatformCameraHook extends CameraPermissions {
    cameraRef: React.RefObject<any>;
    isReady: boolean;
    facing: CameraType;
    toggleFacing: () => void;
}

export function usePlatformCamera(): PlatformCameraHook {
    const cameraRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);
    const [facing, setFacing] = useState<CameraType>('front');
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();

    const requestPermissions = async () => {
        await requestCameraPermission();
        await requestMicPermission();
    };

    return {
        cameraRef,
        isReady,
        facing,
        toggleFacing: () =>
            setFacing((f) => (f === 'front' ? 'back' : 'front')),
        cameraGranted: cameraPermission?.granted ?? false,
        micGranted: micPermission?.granted ?? false,
        requestPermissions,
    };
}
