import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, PanResponder, LayoutChangeEvent, Platform } from 'react-native';

interface AudioSeekerProps {
  progress: number; // 0 to 1
  duration: number; // in seconds
  onSeek: (position: number) => void; // position in seconds
  onSeekingChange?: (isSeeking: boolean) => void;
  isCurrentUser: boolean;
  color?: string;
  activeColor?: string;
}

const AudioSeeker: React.FC<AudioSeekerProps> = ({
  progress,
  duration,
  onSeek,
  onSeekingChange,
  isCurrentUser,
  color,
  activeColor
}) => {
  const [width, setWidth] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubProgress, setScrubProgress] = useState(0);

  const handleTouch = useCallback((x: number) => {
    if (width <= 0 || duration <= 0) return;
    const newProgress = Math.max(0, Math.min(1, x / width));
    setScrubProgress(newProgress);
    onSeek(newProgress * duration);
  }, [width, duration, onSeek]);

  // Handle touch interactions with Capture handlers to steal from parents
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    
    onPanResponderGrant: (evt) => {
      setIsScrubbing(true);
      onSeekingChange?.(true);
      handleTouch(evt.nativeEvent.locationX);
    },
    onPanResponderMove: (evt) => {
      handleTouch(evt.nativeEvent.locationX);
    },
    onPanResponderRelease: (evt) => {
      setIsScrubbing(false);
      onSeekingChange?.(false);
      handleTouch(evt.nativeEvent.locationX);
    },
    onPanResponderTerminate: () => {
      setIsScrubbing(false);
      onSeekingChange?.(false);
    },
  }), [handleTouch, onSeekingChange]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: layoutWidth } = event.nativeEvent.layout;
    if (layoutWidth > 0) {
      setWidth(layoutWidth);
    }
  };

  const bars = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      height: 8 + Math.abs(Math.sin(i * 0.8) * 15) + (i % 3 === 0 ? 5 : 0)
    }));
  }, []);

  const barColor = color || (isCurrentUser ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 122, 255, 0.2)');
  const barActiveColor = activeColor || (isCurrentUser ? '#fff' : '#007AFF');
  
  const currentProgress = isScrubbing ? scrubProgress : progress;

  return (
    <View 
      style={styles.container} 
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      <View style={styles.waveformContainer}>
        {bars.map((bar, i) => (
          <View 
            key={i} 
            style={[
              styles.bar,
              { height: bar.height, backgroundColor: barColor }
            ]}
          />
        ))}
        {/* Active Progress Layer */}
        <View style={[styles.activeWaveform, { width: `${currentProgress * 100}%` }]}>
          {bars.map((bar, i) => (
            <View 
              key={i} 
              style={[
                styles.bar,
                { height: bar.height, backgroundColor: barActiveColor }
              ]}
            />
          ))}
          {/* Scrubber Head */}
          <View style={[styles.scrubberHead, { backgroundColor: barActiveColor }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 44, // Larger touch area
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
    // On web, ensure touch-action is handled for panning
    ...Platform.select({
      web: {
        touchAction: 'none',
        cursor: 'pointer',
      }
    })
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 30,
  },
  bar: {
    width: 2,
    borderRadius: 1,
  },
  activeWaveform: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  scrubberHead: {
    position: 'absolute',
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  }
});

export default AudioSeeker;
