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
    onCapture?: (uri: string) => void;
    showControls?: boolean;
    cameraRef?: React.RefObject<any>;
}

export default function PlatformCameraView({
    style,
    facing = 'front',
    showControls = false,
    cameraRef,
}: Props) {
    return (
        <View style={[styles.container, style]}>
            <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
            />
            {showControls && (
                <View style={styles.controls}>
                    <Ionicons name="camera" size={28} color="white" />
                </View>
            )}
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
