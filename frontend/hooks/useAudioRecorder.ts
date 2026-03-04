import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { safeHaptics } from '@/utils/haptics';

export const MAX_RECORDING_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export interface AudioRecorderState {
    isRecording: boolean;
    isPaused: boolean;
    durationMs: number;
    metering: number[];
    recordingUri: string | null;
    sound: Audio.Sound | null;
    isPlaying: boolean;
    playbackPositionMs: number;
}

export const useAudioRecorder = () => {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [state, setState] = useState<AudioRecorderState>({
        isRecording: false,
        isPaused: false,
        durationMs: 0,
        metering: [],
        recordingUri: null,
        sound: null,
        isPlaying: false,
        playbackPositionMs: 0,
    });

    const maxDurationReachedRef = useRef(false);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (recording) {
                recording.stopAndUnloadAsync().catch(() => { });
            }
            if (state.sound) {
                state.sound.unloadAsync().catch(() => { });
            }
        };
    }, []);

    const updateState = (updates: Partial<AudioRecorderState>) => {
        setState((prev) => ({ ...prev, ...updates }));
    };

    const requestPermissions = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            return permission.status === 'granted';
        } catch (err) {
            console.error('Failed to request audio permissions:', err);
            return false;
        }
    };

    const startRecording = async () => {
        try {
            const hasPermission = await requestPermissions();
            if (!hasPermission) return false;

            // Make sure any previous sound is unloaded
            if (state.sound) {
                await state.sound.unloadAsync();
                updateState({ sound: null, playbackPositionMs: 0, isPlaying: false });
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Start new recording
            const newRecording = new Audio.Recording();
            await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);

            maxDurationReachedRef.current = false;

            newRecording.setOnRecordingStatusUpdate((status: Audio.RecordingStatus) => {
                if (!status.isRecording && !status.isDoneRecording) return;

                // Add metering to the array for waveform (transform -160 to 0 into a positive scale, e.g., 0 to 100)
                let currentMeter = 0;
                if (status.metering !== undefined) {
                    // Normalize metering (-160 minimum, 0 maximum usually)
                    // We can also use a log scale or square for better visuals
                    currentMeter = Math.max(0, (status.metering + 160) / 1.6); // 0 to 100
                }

                setState(prev => {
                    // Update metering array, keep last 60 for visualization (about 6 seconds if 10fps)
                    // Status update is usually every 100ms
                    const newMetering = [...prev.metering, currentMeter].slice(-60);

                    if (status.durationMillis >= MAX_RECORDING_DURATION_MS && !maxDurationReachedRef.current) {
                        maxDurationReachedRef.current = true;
                        // Auto-stop recording
                        stopRecording(newRecording);
                    }

                    return {
                        ...prev,
                        durationMs: status.durationMillis,
                        metering: newMetering,
                    };
                });

                // Haptic milestone near the end
                if (status.durationMillis >= MAX_RECORDING_DURATION_MS - 10000 && status.durationMillis <= MAX_RECORDING_DURATION_MS - 9500) {
                    safeHaptics.warning();
                }
            });

            await newRecording.startAsync();
            setRecording(newRecording);
            updateState({
                isRecording: true,
                isPaused: false,
                durationMs: 0,
                metering: [],
                recordingUri: null,
            });

            safeHaptics.impact(); // Initial haptic
            return true;
        } catch (err) {
            console.error('Failed to start recording', err);
            return false;
        }
    };

    const stopRecording = async (rec = recording) => {
        if (!rec) return null;
        try {
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();
            setRecording(null);
            updateState({
                isRecording: false,
                isPaused: false,
                recordingUri: uri,
            });
            safeHaptics.success();
            return uri;
        } catch (err) {
            console.error('Failed to stop recording', err);
            return null;
        }
    };

    const cancelRecording = async () => {
        if (!recording) {
            updateState({ isRecording: false, durationMs: 0, metering: [], recordingUri: null, isPaused: false });
            return;
        }
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            if (uri) {
                await FileSystem.deleteAsync(uri, { idempotent: true });
            }
        } catch (err) {
            // Ignore cancel errors
        } finally {
            setRecording(null);
            updateState({ isRecording: false, durationMs: 0, metering: [], recordingUri: null, isPaused: false });
            safeHaptics.error(); // Cancel haptic
        }
    };

    const pauseRecording = async () => {
        if (!recording) return;
        try {
            await recording.pauseAsync();
            updateState({ isPaused: true });
            safeHaptics.selection();
        } catch (err) {
            console.error('Failed to pause recording', err);
        }
    };

    const resumeRecording = async () => {
        if (!recording) return;
        try {
            await recording.startAsync();
            updateState({ isPaused: false });
            safeHaptics.selection();
        } catch (err) {
            console.error('Failed to resume recording', err);
        }
    };

    // --- Playback of recorded audio ---

    const loadPlayback = async () => {
        if (!state.recordingUri) return;

        if (state.sound) {
            await state.sound.unloadAsync();
        }

        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: state.recordingUri },
                { shouldPlay: false },
                (status: any) => {
                    if (status.isLoaded) {
                        updateState({
                            playbackPositionMs: status.positionMillis,
                            isPlaying: status.isPlaying,
                        });
                        if (status.didJustFinish) {
                            updateState({ isPlaying: false, playbackPositionMs: 0 });
                            safeHaptics.impact();
                        }
                    }
                }
            );
            updateState({ sound: newSound });
        } catch (err) {
            console.error('Failed to load playback:', err);
        }
    };

    const playPausePlayback = async () => {
        if (!state.sound) {
            await loadPlayback();
            // Need to return and let the user press again, or implicitly play
            return;
        }

        try {
            if (state.isPlaying) {
                await state.sound.pauseAsync();
            } else {
                await state.sound.playAsync();
            }
            safeHaptics.selection();
        } catch (err) {
            console.error('Failed to play/pause:', err);
        }
    };

    const discardRecordingUri = async () => {
        if (state.sound) {
            await state.sound.unloadAsync();
            updateState({ sound: null, isPlaying: false, playbackPositionMs: 0 });
        }
        if (state.recordingUri) {
            try {
                await FileSystem.deleteAsync(state.recordingUri, { idempotent: true });
            } catch (err) { }
        }
        updateState({ recordingUri: null, durationMs: 0, metering: [] });
    };

    return {
        ...state,
        startRecording,
        stopRecording,
        cancelRecording,
        pauseRecording,
        resumeRecording,
        playPausePlayback,
        discardRecordingUri,
    };
};

export default useAudioRecorder;
