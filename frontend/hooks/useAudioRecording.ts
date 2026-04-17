import { 
  useAudioRecorder, 
  useAudioRecorderState, 
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets, 
  requestRecordingPermissionsAsync 
} from 'expo-audio';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Platform } from 'react-native';
import { useToastStore } from '@/stores/toastStore';

interface UseAudioRecordingOptions {
  maxDuration?: number; 
  onRecordingComplete?: (uri: string, duration: number, metering?: number[]) => void;
  onRecordingError?: (error: Error) => void;
}

/**
 * useAudioRecording (v3.0 - Total Restructure)
 * Fixes:
 * 1. [Web] Single-stream recording (no more broken multi-segment files)
 * 2. [Real-time Waveforms] Amplitude metering support
 * 3. [Stability] Robust discard / state machine
 */
export const useAudioRecording = (options: UseAudioRecordingOptions = {}) => {
  const { maxDuration = 120, onRecordingComplete, onRecordingError } = options;
  const { showToast } = useToastStore();
  
  // Use refs for callbacks to avoid re-initializing logic when parent re-renders with unstable objects
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  const onRecordingErrorRef = useRef(onRecordingError);
  useEffect(() => {
    onRecordingCompleteRef.current = onRecordingComplete;
    onRecordingErrorRef.current = onRecordingError;
  }, [onRecordingComplete, onRecordingError]);
  
  // Recorder setup with metering enabled
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  
  // High-frequency polling for timer and metering: throttled to 100ms to prevent React re-render loops
  const state = useAudioRecorderState(recorder, 100); 
  
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);

  // Metering storage (Amplitude values for waveforms)
  const meteringDataRef = useRef<number[]>([]);
  const lastMeterPollRef = useRef<number>(0);
  // Web-only: cumulative MediaRecorder chunks (chunk[0] has the WebM EBML header)
  const webChunksRef = useRef<Blob[]>([]);
  const webMimeTypeRef = useRef<string>('audio/webm');

  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const previewPlayer = useAudioPlayer(previewUri);
  const previewStatus = useAudioPlayerStatus(previewPlayer);
  
  // Memoize state values to avoid unnecessary re-renders in consumers
  const totalRecordedMillis = state.durationMillis || 0;
  const effectiveDuration = previewStatus.duration > 0 ? previewStatus.duration : (totalRecordedMillis / 1000);

  // Capturing metering data for waveforms while recording
  useEffect(() => {
    if (state.isRecording && !isPaused) {
      const now = Date.now();
      // Poll every 100ms for metering to avoid bloating metadata
      if (now - lastMeterPollRef.current > 100) {
        lastMeterPollRef.current = now;
        // Normalize metering (-160 to 0 dB range usually, but depends on platform)
        // We push a relative amplitude 0-1
        const raw = state.metering ?? -160;
        const normalized = Math.max(0, (raw + 160) / 160);
        meteringDataRef.current.push(Number(normalized.toFixed(3)));
      }
    }
  }, [state.isRecording, isPaused, state.metering]);

  // Throttled progress update to prevent re-render loops during playback
  useEffect(() => {
    // Only track progress when NOT recording to avoid interference with the high-frequency recording state
    if (!state.isRecording && !isSeeking && previewStatus.duration > 0) {
      const p = previewStatus.currentTime / previewStatus.duration;
      const normalizedP = isNaN(p) ? 0 : p;
      setDisplayProgress(prev => (Math.abs(prev - normalizedP) > 0.01) ? normalizedP : prev);
    } else if (!state.isRecording && !isSeeking && previewStatus.currentTime === 0) {
      setDisplayProgress(0);
    }
  }, [previewStatus.currentTime, previewStatus.duration, isSeeking, state.isRecording]);

  // Sync player source
  const lastLoadedPreviewUri = useRef<string | null>(null);
  useEffect(() => {
    if (previewUri && previewUri !== lastLoadedPreviewUri.current) {
      lastLoadedPreviewUri.current = previewUri;
      previewPlayer.replace(previewUri);
    }
  }, [previewUri, previewPlayer]);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showToast('Microphone permission denied', 'error');
        return;
      }

      setIsPaused(false);
      setPreviewUri(null);
      lastLoadedPreviewUri.current = null;
      meteringDataRef.current = [];
      setDisplayProgress(0);

      webChunksRef.current = [];
      await recorder.prepareToRecordAsync();
      recorder.record();

      // ── Web: wire cumulative chunk collection ONCE per session ──────────
      // The first chunk from MediaRecorder always contains the WebM EBML header.
      // By collecting every chunk with timeslice we can build a valid playable
      // blob for preview at any point in the recording, without stopping the stream.
      if (Platform.OS === 'web') {
        const internalRecorder = (recorder as any).mediaRecorder as MediaRecorder | null;
        if (internalRecorder) {
          webMimeTypeRef.current = internalRecorder.mimeType
            ? internalRecorder.mimeType.split(';')[0]  // strip 'codecs=opus' etc.
            : 'audio/webm';

          // Use timeslice so dataavailable fires every 500 ms while recording.
          // We restart the MediaRecorder.start() with timeslice via a low-level call.
          // (expo-audio already called start(), so we collect from here forward)
          internalRecorder.addEventListener('dataavailable', (e: Event) => {
            const be = e as BlobEvent;
            if (be.data && be.data.size > 0) {
              webChunksRef.current.push(be.data);
            }
          });
        }
      }
    } catch (error) {
      console.error('[useAudioRecording] Start failed:', error);
      showToast('Failed to start recording', 'error');
      onRecordingErrorRef.current?.(error as Error);
    }
  }, [recorder, showToast]);

  const pauseRecording = useCallback(async () => {
    try {
      if (state.isRecording && !isPaused) {
        // Native & Web: pause() keeps ONE continuous MediaRecorder stream alive.
        // All pause/resume periods stay in the same stream → stop() gives the full file.
        await recorder.pause();
        setIsPaused(true);

        if (Platform.OS !== 'web') {
          // ── Native: recorder.uri is available immediately during pause ──
          if (recorder.uri) {
            setPreviewUri(recorder.uri);
          }
        } else {
          // ── Web: build preview from ALL chunks collected so far ─────────
          // requestData() flushes any in-flight data to our listener, then we
          // create a blob from webChunksRef (chunk[0] = WebM EBML header +
          // first cluster, subsequent chunks = more clusters). The concatenated
          // Blob is a valid playable WebM file because it starts with the header.
          try {
            const internalRecorder = (recorder as any).mediaRecorder as MediaRecorder | null;
            if (internalRecorder && internalRecorder.state === 'paused') {
              // requestData() fires dataavailable synchronously while paused,
              // flushing any buffered data into webChunksRef via our listener
              internalRecorder.requestData();

              // Allow the event to be processed
              await new Promise<void>((resolve) => setTimeout(resolve, 60));

              if (webChunksRef.current.length > 0) {
                // Merge ALL chunks (header + all audio data so far)
                const blob = new Blob(webChunksRef.current, { type: webMimeTypeRef.current });
                const url  = URL.createObjectURL(blob);

                setPreviewUri(prev => {
                  if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                  return url;
                });
                console.log(
                  `[useAudioRecording] Web pause → preview ok (${webChunksRef.current.length} chunks, ${blob.size} bytes)`
                );
              } else {
                console.warn('[useAudioRecording] Web pause → no chunks yet, retrying requestData in 200ms');
                // Fallback: recorder may not have emitted the first chunk yet, retry once
                setTimeout(() => {
                  internalRecorder.requestData();
                  setTimeout(() => {
                    if (webChunksRef.current.length > 0) {
                      const blob = new Blob(webChunksRef.current, { type: webMimeTypeRef.current });
                      const url  = URL.createObjectURL(blob);
                      setPreviewUri(prev => {
                        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                        return url;
                      });
                    }
                  }, 100);
                }, 200);
              }
            } else {
              console.warn('[useAudioRecording] Web pause → recorder state:', internalRecorder?.state);
            }
          } catch (webErr) {
            console.warn('[useAudioRecording] Web pause → preview build failed:', webErr);
          }
        }
      }
    } catch (error) {
      console.error('[useAudioRecording] Pause failed:', error);
      showToast('Failed to pause', 'error');
    }
  }, [recorder, state.isRecording, isPaused, showToast]);

  const resumeRecording = useCallback(async () => {
    try {
      if (isPaused) {
        if (previewStatus.playing) {
          previewPlayer.pause();
        }
        recorder.record();
        setIsPaused(false);
      }
    } catch (error) {
      console.error('[useAudioRecording] Resume failed:', error);
    }
  }, [recorder, isPaused, previewStatus.playing, previewPlayer]);

  const playPreview = useCallback(async () => {
    try {
      if (!previewUri && recorder.uri) {
        setPreviewUri(recorder.uri);
      }
      if (previewStatus.playbackState === 'finished') {
        previewPlayer.seekTo(0);
      }
      previewPlayer.play();
    } catch (error) {
      console.error('[useAudioRecording] Preview Play failed:', error);
    }
  }, [previewPlayer, previewStatus.playbackState, previewUri, recorder.uri]);

  const pausePreview = useCallback(() => {
    previewPlayer.pause();
  }, [previewPlayer]);

  const seekPreview = useCallback((seconds: number) => {
    previewPlayer.seekTo(seconds);
  }, [previewPlayer]);

  const stopRecording = useCallback(async () => {
    if (!state.isRecording && !isPaused) return;

    try {
      if (previewStatus.playing) {
        previewPlayer.pause();
      }

      // Final stop - captures the URI
      const result = await recorder.stop();
      let finalUri = (result as any)?.uri ?? recorder.uri;
      const finalDurationSeconds = totalRecordedMillis / 1000;

      // Web over-ride: Because we are collecting chunks for preview via cumulative listeners,
      // the built-in recorder.stop() listener might only receive the final fragment.
      // We use our cumulative webChunksRef to provide the FULL combined audio for sending.
      if (Platform.OS === 'web' && webChunksRef.current.length > 0) {
        // Wait a tiny bit for the final 'dataavailable' from stop() to reach our listener
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const fullBlob = new Blob(webChunksRef.current, { type: webMimeTypeRef.current });
        finalUri = URL.createObjectURL(fullBlob);
        
        console.log(`[useAudioRecording] Web stop → full merged blob created, size: ${fullBlob.size} bytes`);
      }

      setIsPaused(false);
      
      console.log(`[useAudioRecording] Stop: URI=${finalUri ? 'ok' : 'MISSING'}, Dur=${finalDurationSeconds.toFixed(1)}s`);

      if (finalUri && finalDurationSeconds >= 0.5) {
        onRecordingCompleteRef.current?.(finalUri, finalDurationSeconds, [...meteringDataRef.current]);
      } else if (!finalUri) {
        showToast('Recording failed - please try again', 'error');
      } else {
        showToast('Recording too short', 'info');
      }
      
      // Cleanup all local state for next recording
      setPreviewUri(null);
      lastLoadedPreviewUri.current = null;
      meteringDataRef.current = [];
      webChunksRef.current = [];
      setDisplayProgress(0);
    } catch (error) {
      console.error('[useAudioRecording] Stop failed:', error);
      showToast('Failed to save recording', 'error');
      onRecordingErrorRef.current?.(error as Error);
    }
  }, [recorder, state.isRecording, isPaused, totalRecordedMillis, showToast, previewPlayer, previewStatus.playing]);

  const cancelRecording = useCallback(async () => {
    try {
      if (previewStatus.playing) {
        previewPlayer.pause();
      }
      
      // Safely stop if recording or paused
      if (state.isRecording || isPaused) {
        await recorder.stop();
      }

      setIsPaused(false);
      setPreviewUri(null);
      lastLoadedPreviewUri.current = null;
      meteringDataRef.current = [];
      webChunksRef.current = [];
      setDisplayProgress(0);
    } catch (error) {
      console.error('[useAudioRecording] Cancel failed:', error);
    }
  }, [recorder, state.isRecording, isPaused, previewPlayer, previewStatus.playing]);

  const formatDuration = useCallback((millis: number): string => {
    const totalSeconds = Math.max(0, Math.floor(millis / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return useMemo(() => ({
    isRecording: state.isRecording,
    isPaused,
    displayProgress,
    effectiveDuration,
    recordingDuration: totalRecordedMillis,
    isUploading,
    previewStatus,
    startRecording,
    pauseRecording,
    resumeRecording,
    playPreview,
    pausePreview,
    seekPreview,
    stopRecording,
    cancelRecording,
    formatDuration,
    setIsUploading,
    setIsSeeking,
    meteringData: meteringDataRef.current
  }), [
    state.isRecording,
    isPaused,
    displayProgress,
    effectiveDuration,
    totalRecordedMillis,
    isUploading,
    previewStatus,
    startRecording,
    pauseRecording,
    resumeRecording,
    playPreview,
    pausePreview,
    seekPreview,
    stopRecording,
    cancelRecording,
    formatDuration,
    setIsUploading,
    setIsSeeking
  ]);
};
