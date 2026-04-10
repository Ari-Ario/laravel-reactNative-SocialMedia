import React, { useMemo, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, PanResponder, LayoutChangeEvent, Platform } from 'react-native';

interface AudioSeekerProps {
  progress: number; // 0 to 1
  duration: number; // in seconds
  onSeek: (position: number) => void; // position in seconds
  onSeekingChange?: (isSeeking: boolean) => void;
  isCurrentUser: boolean;
  metering?: number[]; // Real-time amplitude values for waveforms
  color?: string;
  activeColor?: string;
  barCount?: number;
}

const AudioSeeker: React.FC<AudioSeekerProps> = ({
  progress,
  duration,
  onSeek,
  onSeekingChange,
  isCurrentUser,
  metering,
  color,
  activeColor,
  barCount = 35
}) => {
  const [width, setWidth] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubProgress, setScrubProgress] = useState(0);
  const containerRef = useRef<View>(null);
  const leftOffsetRef = useRef(0);

  const widthRef = useRef(0);
  const durationRef = useRef(duration);
  const onSeekRef = useRef(onSeek);
  const onSeekingChangeRef = useRef(onSeekingChange);

  widthRef.current = width;
  durationRef.current = duration;
  onSeekRef.current = onSeek;
  onSeekingChangeRef.current = onSeekingChange;

  /**
   * REFINED WAVEFORM LOGIC:
   * If metering data is provided, we sample it to fit the barCount.
   * If not, we generate decent-looking symmetric pseudo-waveforms.
   */
  const waveformBars = useMemo(() => {
    if (metering && metering.length > 0) {
      // Downsample metering to barCount
      const result: number[] = [];
      const step = metering.length / barCount;
      for (let i = 0; i < barCount; i++) {
        const index = Math.floor(i * step);
        // metering is 0-1 normalized. Map to height 4-24
        const val = metering[index] || 0.1;
        result.push(4 + val * 22);
      }
      return result;
    } else {
      // Fallback: Static but nice-looking waveform shape
      return Array.from({ length: barCount }).map((_, i) => {
        const centerDist = Math.abs(i - (barCount / 2)) / (barCount / 2);
        const base = 8 + Math.abs(Math.sin(i * 0.6) * 12);
        // Taper the ends slightly
        return base * (1 - centerDist * 0.3) + 2;
      });
    }
  }, [metering, barCount]);

  const handleTouch = useCallback((pageX: number, locationX: number) => {
    const currentWidth = widthRef.current;
    const currentDuration = durationRef.current;
    if (currentWidth <= 0 || currentDuration <= 0) return;

    // ✅ REFINED COORDINATE CALCULATION FOR WEB:
    // Native locationX can be relative to the specific bar being touched.
    // pageX is absolute. Subtracting the container's left offset is more robust.
    let x = locationX;
    if (Platform.OS === 'web' && containerRef.current) {
      const el = containerRef.current as any;
      if (el.getBoundingClientRect) {
        const rect = el.getBoundingClientRect();
        x = pageX - (rect.left + window.scrollX);
      }
    }

    const newProgress = Math.max(0, Math.min(1, x / currentWidth));
    setScrubProgress(newProgress);
    onSeekRef.current(newProgress * currentDuration);
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    
    onPanResponderGrant: (evt) => {
      setIsScrubbing(true);
      onSeekingChangeRef.current?.(true);
      handleTouch(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
    },
    onPanResponderMove: (evt) => {
      handleTouch(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
    },
    onPanResponderRelease: (evt) => {
      setIsScrubbing(false);
      onSeekingChangeRef.current?.(false);
      handleTouch(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
    },
    onPanResponderTerminate: () => {
      setIsScrubbing(false);
      onSeekingChangeRef.current?.(false);
    },
  }), [handleTouch]);

  const onLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  };

  const barColor = color || (isCurrentUser ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 122, 255, 0.2)');
  const barActiveColor = activeColor || (isCurrentUser ? '#fff' : '#007AFF');
  
  const currentProgress = isScrubbing ? scrubProgress : progress;

  return (
    <View 
      ref={containerRef}
      style={styles.container} 
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      <View style={styles.waveformContainer}>
        {waveformBars.map((h, i) => (
          <View 
            key={i} 
            style={[
              styles.bar,
              { height: h, backgroundColor: barColor }
            ]}
          />
        ))}
        {/* Active Overaly */}
        <View style={[styles.activeOverlay, { width: `${currentProgress * 100}%` }]}>
          <View style={[styles.waveformContainer, { width: width || 200, position: 'absolute', left: 0 }]}>
            {waveformBars.map((h, i) => (
              <View 
                key={i} 
                style={[
                  styles.bar,
                  { height: h, backgroundColor: barActiveColor }
                ]}
              />
            ))}
          </View>
        </View>
        {/* Playhead */}
        <View style={[styles.playhead, { left: `${currentProgress * 100}%`, backgroundColor: barActiveColor }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 48, 
    justifyContent: 'center',
    paddingHorizontal: 2,
    ...Platform.select({
      web: { touchAction: 'none', cursor: 'pointer' }
    })
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    gap: 2,
  },
  bar: {
    width: 2,
    borderRadius: 1,
  },
  activeOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  playhead: {
    position: 'absolute',
    width: 2,
    height: 32,
    borderRadius: 1,
    top: 0,
    zIndex: 10,
  }
});

export default AudioSeeker;
