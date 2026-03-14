/**
 * PlatformCameraView.native.tsx
 * Native camera using expo-camera CameraView
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    style?: ViewStyle;
    facing?: CameraType;
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
    cameraRef,
    children,
}: Props) {
    const internalRef = React.useRef<any>(null);

    React.useEffect(() => {
        if (cameraRef && 'current' in cameraRef) {
            (cameraRef as any).current = {
                takePictureAsync: (options: any) => internalRef.current?.takePictureAsync(options),
                recordAsync: (options: any) => internalRef.current?.recordAsync(options),
                stopRecording: () => internalRef.current?.stopRecording(),
            };
        }
    }, [cameraRef]);

    return (
        <View style={[styles.container, style]}>
            <CameraView
                ref={internalRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                flash={flash}
                zoom={zoom}
                responsiveOrientationWhenOrientationLocked
                mode="picture" // Default mode, recordAsync will change this if needed
            />
            {showControls && (
                <View style={styles.controls}>
                    <Ionicons name="camera" size={28} color="white" />
                </View>
            )}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    controls: {
        position: 'absolute',
        bottom: 16,
        alignSelf: 'center',
        flexDirection: 'row',
        gap: 16,
    },
});
