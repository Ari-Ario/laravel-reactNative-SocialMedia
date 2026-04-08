import { 
  useAudioRecorder, 
  useAudioRecorderState, 
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets, 
  requestRecordingPermissionsAsync 
} from 'expo-audio';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useToastStore } from '@/stores/toastStore';

interface UseAudioRecordingOptions {
  maxDuration?: number; // in seconds, default 60
  onRecordingComplete?: (uri: string, duration: number) => void;
  onRecordingError?: (error: Error) => void;
}

export const useAudioRecording = (options: UseAudioRecordingOptions = {}) => {
  const { maxDuration = 60, onRecordingComplete, onRecordingError } = options;
  const { showToast } = useToastStore();
  
  // expo-audio recorder hook
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 100);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  // CRITICAL: use Refs for chunks and duration to avoid stale state and blockages
  const chunksRef = useRef<string[]>([]);
  const cumulativeDurationRef = useRef(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // Preview Player management
  const previewPlayer = useAudioPlayer(previewUri);
  const previewStatus = useAudioPlayerStatus(previewPlayer);
  
  // Scrubbing stabilization
  const [displayProgress, setDisplayProgress] = useState(0);
  
  // Total duration including previous chunks and current state
  const totalRecordedMillis = cumulativeDurationRef.current + (state.isRecording ? state.durationMillis : 0);
  const effectiveDuration = previewStatus.duration > 0 ? previewStatus.duration : (totalRecordedMillis / 1000);

  useEffect(() => {
    if (!isSeeking) {
      const p = previewStatus.duration > 0 ? previewStatus.currentTime / previewStatus.duration : 0;
      setDisplayProgress(p);
    }
  }, [previewStatus.currentTime, previewStatus.duration, isSeeking]);

  /**
   * LAZY MERGE: Efficiently combine segments into a single playable blob ONLY when needed.
   * This prevents UI lag during the recording phase.
   */
  const getMergedUri = useCallback(async (finalChunkUri?: string) => {
    if (Platform.OS !== 'web') {
      return finalChunkUri || chunksRef.current[chunksRef.current.length - 1];
    }

    try {
      const uls = [...chunksRef.current];
      if (finalChunkUri && !uls.includes(finalChunkUri)) {
        uls.push(finalChunkUri);
      }
      
      if (uls.length === 0) return null;
      if (uls.length === 1) return uls[0];

      console.log(`[useAudioRecording] Merging ${uls.length} segments...`);
      const blobPromises = uls.map(u => fetch(u).then(r => r.blob()));
      const blobs = await Promise.all(blobPromises);
      
      const mergedBlob = new Blob(blobs, { type: blobs[0]?.type || 'audio/webm' });
      return URL.createObjectURL(mergedBlob);
    } catch (error) {
      console.error('Error merging segments:', error);
      return finalChunkUri || null;
    }
  }, []);

  // Sync player source when URI becomes available
  useEffect(() => {
    if (previewUri) {
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
      chunksRef.current = [];
      cumulativeDurationRef.current = 0;
      setPreviewUri(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      console.error('Error starting recording:', error);
      showToast('Failed to start recording', 'error');
      onRecordingError?.(error as Error);
    }
  }, [recorder, showToast, onRecordingError]);

  const pauseRecording = useCallback(async () => {
    try {
      if (state.isRecording && !isPaused) {
        const currentChunkDuration = state.durationMillis;
        
        // On Web, we MUST stop to make the blob playable
        if (Platform.OS === 'web') {
          await recorder.stop();
          const currentUri = recorder.uri;
          if (currentUri && !chunksRef.current.includes(currentUri)) {
            chunksRef.current.push(currentUri);
            cumulativeDurationRef.current += currentChunkDuration;
          }
          // Note: We DO NOT merge here to prevent UI lag. Merge is lazy.
        } else {
          await recorder.pause();
          cumulativeDurationRef.current += currentChunkDuration;
        }
        setIsPaused(true);
      }
    } catch (error) {
      console.error('Error pausing recording:', error);
      showToast('Failed to pause recording', 'error');
    }
  }, [recorder, state.isRecording, state.durationMillis, isPaused, showToast]);

  const resumeRecording = useCallback(async () => {
    try {
      if (isPaused) {
        if (previewStatus.playing) {
          previewPlayer.pause();
        }
        
        if (Platform.OS === 'web') {
          await recorder.prepareToRecordAsync();
          recorder.record();
        } else {
          recorder.record();
        }
        setIsPaused(false);
      }
    } catch (error) {
      console.error('Error resuming recording:', error);
      showToast('Failed to resume recording', 'error');
    }
  }, [recorder, isPaused, showToast, previewStatus.playing, previewPlayer]);

  const playPreview = useCallback(async () => {
    try {
      // Lazy merge if preview URI isn't ready
      if (!previewUri && chunksRef.current.length > 0) {
        const merged = await getMergedUri();
        if (merged) setPreviewUri(merged);
      }

      if (previewStatus.playbackState === 'finished') {
        previewPlayer.seekTo(0);
      }
      previewPlayer.play();
    } catch (error) {
      console.error('Error playing preview:', error);
    }
  }, [previewPlayer, previewStatus.playbackState, previewUri, getMergedUri]);

  const pausePreview = useCallback(() => {
    previewPlayer.pause();
  }, [previewPlayer]);

  const seekPreview = useCallback((positionSeconds: number) => {
    previewPlayer.seekTo(positionSeconds);
  }, [previewPlayer]);

  const stopRecording = useCallback(async () => {
    if (!state.isRecording && !isPaused) return;

    try {
      if (previewStatus.playing) {
        previewPlayer.pause();
      }

      let finalTotalDuration = cumulativeDurationRef.current;
      let finalSegmentUri: string | undefined;

      if (state.isRecording) {
        finalTotalDuration += state.durationMillis;
        await recorder.stop();
        finalSegmentUri = recorder.uri || undefined;
      }

      // LAZY MERGE ALL AT ONCE
      const finalUri = await getMergedUri(finalSegmentUri);
      
      setIsPaused(false);
      const totalSeconds = finalTotalDuration / 1000;
      
      console.log(`[useAudioRecording] Finished. Duration: ${totalSeconds}s, Total Segments: ${chunksRef.current.length + (finalSegmentUri ? 1 : 0)}`);

      if (finalUri && totalSeconds >= 0.5) {
        onRecordingComplete?.(finalUri, totalSeconds);
      } else if (totalSeconds < 0.5) {
        showToast('Recording too short', 'info');
      }
      
      // Cleanup
      chunksRef.current = [];
      cumulativeDurationRef.current = 0;
      setPreviewUri(null);
    } catch (error) {
      console.error('Error stopping recording:', error);
      showToast('Failed to stop recording', 'error');
      onRecordingError?.(error as Error);
    }
  }, [recorder, state.isRecording, state.durationMillis, isPaused, onRecordingComplete, onRecordingError, showToast, previewPlayer, previewStatus.playing, getMergedUri]);

  const cancelRecording = useCallback(async () => {
    try {
      if (previewStatus.playing) {
        previewPlayer.pause();
      }
      if (state.isRecording || isPaused) {
        await recorder.stop();
        setIsPaused(false);
      }
      chunksRef.current = [];
      cumulativeDurationRef.current = 0;
      setPreviewUri(null);
    } catch (error) {
      console.error('Error canceling recording:', error);
    }
  }, [recorder, state.isRecording, isPaused, previewPlayer, previewStatus.playing]);

  const formatDuration = useCallback((millis: number): string => {
    const totalSeconds = Math.floor(millis / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
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
  };
};
