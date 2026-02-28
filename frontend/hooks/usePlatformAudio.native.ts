/**
 * usePlatformAudio.native.ts
 * Native audio recording using expo-audio
 */
import { useState, useRef } from 'react';
import {
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    RecordingPresets,
} from 'expo-audio';

export interface PlatformAudioHook {
    isRecording: boolean;
    audioUri: string | null;
    permissionGranted: boolean;
    requestPermission: () => Promise<boolean>;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<string | null>;
    clearRecording: () => void;
}

export function usePlatformAudio(): PlatformAudioHook {
    const [isRecording, setIsRecording] = useState(false);
    const [audioUri, setAudioUri] = useState<string | null>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const recorderRef = useRef<any>(null);

    const requestPermission = async (): Promise<boolean> => {
        const { granted } = await requestRecordingPermissionsAsync();
        setPermissionGranted(granted);
        return granted;
    };

    const startRecording = async () => {
        const granted = permissionGranted || (await requestPermission());
        if (!granted) return;

        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

        const { AudioRecorder } = await import('expo-audio');
        const recorder = new AudioRecorder(RecordingPresets.HIGH_QUALITY);
        recorderRef.current = recorder;
        await recorder.record();
        setIsRecording(true);
    };

    const stopRecording = async (): Promise<string | null> => {
        if (!recorderRef.current) return null;
        await recorderRef.current.stop();
        const uri = recorderRef.current.uri ?? null;
        recorderRef.current = null;
        setIsRecording(false);
        setAudioUri(uri);
        return uri;
    };

    const clearRecording = () => setAudioUri(null);

    return {
        isRecording,
        audioUri,
        permissionGranted,
        requestPermission,
        startRecording,
        stopRecording,
        clearRecording,
    };
}
