/**
 * usePlatformAudio.web.ts
 * Web audio recording using browser MediaRecorder API
 */
import { useState, useRef } from 'react';

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
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);

    const requestPermission = async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Stop stream immediately - just checking permission
            stream.getTracks().forEach((t) => t.stop());
            setPermissionGranted(true);
            return true;
        } catch {
            setPermissionGranted(false);
            return false;
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setPermissionGranted(true);
            chunksRef.current = [];

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.start(100); // collect data every 100ms
            setIsRecording(true);
        } catch (err) {
            console.error('Microphone access denied:', err);
        }
    };

    const stopRecording = (): Promise<string | null> => {
        return new Promise((resolve) => {
            const recorder = mediaRecorderRef.current;
            if (!recorder) { resolve(null); return; }

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
                const url = URL.createObjectURL(blob);
                setAudioUri(url);
                // Stop all tracks
                recorder.stream.getTracks().forEach((t) => t.stop());
                mediaRecorderRef.current = null;
                setIsRecording(false);
                resolve(url);
            };

            recorder.stop();
        });
    };

    const clearRecording = () => {
        if (audioUri) URL.revokeObjectURL(audioUri);
        setAudioUri(null);
    };

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
