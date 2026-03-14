import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Dimensions,
    Platform,
    PanResponder,
    ActivityIndicator,
    StatusBar,
    Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
    interpolate,
    Extrapolate,
    withSequence,
    withDelay,
} from 'react-native-reanimated';
import { MediaCompressor } from '@/utils/mediaCompressor';
import * as Haptics from 'expo-haptics';

interface VideoTrimmerProps {
    visible: boolean;
    videoUri: string;
    maxDuration?: number; // In seconds (default 120 for posts, 10 for stories)
    onClose: () => void;
    onSave: (trimmedData: {
        uri: string;
        startTime: number;
        endTime: number;
        duration: number;
        thumbnailUri?: string;
    }) => void;
    isStory?: boolean; // If true, maxDuration is 10s and UI adapts
}

const HANDLE_WIDTH = 20;
const MIN_SELECTION_DURATION = 1; // Minimum 1 second selection
const MAX_FILE_SIZE_MB = 40; // Maximum 40MB for trimmed video

const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
    visible,
    videoUri,
    maxDuration: propMaxDuration = 120,
    onClose,
    onSave,
    isStory = false,
}) => {
    // Determine max duration based on context
    const maxDuration = isStory ? 10 : propMaxDuration;

    const [duration, setDuration] = useState(0);
    const [startPos, setStartPos] = useState(0);
    const [endPos, setEndPos] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState<'start' | 'end' | 'playhead' | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showTimeTooltip, setShowTimeTooltip] = useState(false);
    const [tooltipTime, setTooltipTime] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isSnapping, setIsSnapping] = useState(false);
    const [scrubberLayout, setScrubberLayout] = useState({ x: 0, width: 0 });
    const { width: trimmerWindowWidth } = useWindowDimensions();
    const scrubberLayoutRef = useRef({ x: 0, width: 0 });
    const [effectiveScrubberWidth, setEffectiveScrubberWidth] = useState(trimmerWindowWidth - 72);
    const initialDurationSet = useRef(false);

    // Reset initialization when URI changes
    useEffect(() => {
        initialDurationSet.current = false;
        setIsLoading(true);
    }, [videoUri]);

    const onScrubberLayout = useCallback((event: any) => {
        const { x, width } = event.nativeEvent.layout;
        scrubberLayoutRef.current = { x, width };
        setEffectiveScrubberWidth(width);
    }, []);

    // Animation values
    const scrubberScale = useSharedValue(1);
    const handlesOpacity = useSharedValue(1);
    const tooltipOpacity = useSharedValue(0);
    const durationLabelScale = useSharedValue(0);
    const saveButtonScale = useSharedValue(1);

    const player = useVideoPlayer(videoUri, (p) => {
        p.loop = true;
        p.timeUpdateEventInterval = 0.05; // Update every 50ms for super smooth playhead
    });

    // Safe Helpers to prevent non-finite errors and division by zero
    const safeDuration = useMemo(() => duration > 0 ? duration : 1, [duration]);
    const safeStartPos = useMemo(() => startPos, [startPos]);
    const safeEndPos = useMemo(() => endPos, [endPos]);
    const trimDuration = useMemo(() => 
        (safeEndPos - safeStartPos) * safeDuration, 
        [safeEndPos, safeStartPos, safeDuration]
    );
    const safeTrimDuration = useMemo(() => trimDuration > 0 ? trimDuration : 1, [trimDuration]);

    const safeSetCurrentTime = useCallback((timeInSeconds: number) => {
        if (!player || !duration || duration === 0) return;
        
        const timeMs = timeInSeconds * 1000;
        if (!isNaN(timeMs) && isFinite(timeMs) && timeMs >= 0) {
            player.currentTime = timeMs;
        }
    }, [player, duration]);

    // Animate duration label when selection changes
    useEffect(() => {
        if (!isNaN(trimDuration) && trimDuration > 0) {
            durationLabelScale.value = withSequence(
                withSpring(1.2, { damping: 2 }),
                withSpring(1)
            );
        }
    }, [trimDuration]);

    // Simplified Duration Loading Logic (Easy Logic) with 10s Story constraint
    useEffect(() => {
        if (!player || !visible) return;

        setIsLoading(true);

        const setInitialDuration = () => {
            if (player.duration > 0 && !initialDurationSet.current) {
                const dur = player.duration / 1000;
                setDuration(dur);
                
                // Set exactly maxDuration (10s for stories, 120s for posts)
                if (dur > maxDuration) {
                    setEndPos(maxDuration / dur);
                } else {
                    setEndPos(1);
                }
                
                setStartPos(0);
                initialDurationSet.current = true;
                setIsLoading(false);
                return true;
            }
            if (player.duration > 0) {
                setIsLoading(false);
                return true;
            }
            return false;
        };

        // Try immediately
        if (setInitialDuration()) return;

        // Listen for status changes and time updates to catch duration ASAP
        const statusSub = player.addListener('statusChange', setInitialDuration);
        const timeSub = player.addListener('timeUpdate', setInitialDuration);

        return () => {
            statusSub.remove();
            timeSub.remove();
            player.pause();
        };
    }, [player, visible, maxDuration, videoUri]); // Added videoUri to dependencies

    // Enhanced time update with haptics on boundaries
    useEffect(() => {
        if (!player) return;

        const subscription = player.addListener('timeUpdate', (event) => {
            const time = event.currentTime / 1000;
            setCurrentTime(time);

            // Keep within trim range with spring-back effect
            const startSec = startPos * duration;
            const endSec = endPos * duration;

            if (time >= endSec || time < startSec) {
                safeSetCurrentTime(startSec);

                // Haptic feedback when hitting boundaries
                if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
            }
        });

        return () => subscription.remove();
    }, [player, startPos, endPos, duration]);

    // Play/pause sync
    useEffect(() => {
        if (!player) return;

        if (isPlaying) {
            player.play();
        } else {
            player.pause();
        }
    }, [isPlaying, player]);

    // iOS-style haptic feedback for dragging
    const triggerHaptic = useCallback((style: 'light' | 'medium' | 'heavy' = 'light') => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(
                style === 'light' ? Haptics.ImpactFeedbackStyle.Light :
                    style === 'medium' ? Haptics.ImpactFeedbackStyle.Medium :
                        Haptics.ImpactFeedbackStyle.Heavy
            );
        }
    }, []);

    // PanResponder for Start Handle with sliding window logic
    const startPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                setIsDragging('start');
                setShowTimeTooltip(true);
                handlesOpacity.value = withTiming(1.2);
                scrubberScale.value = withSpring(1.02);
                triggerHaptic('light');
            },
            onPanResponderMove: (_, gestureState) => {
                if (!duration || isNaN(duration) || duration === 0) return;
                
                // Calibration: moveX is absolute, we need relative to scrubber
                // gestureState.x0 is start position. startPos * effectiveScrubberWidth is where it WAS.
                // So scrubberStart = x0 - (startPos * effectiveScrubberWidth)
                // But this only works if x0 was on the handle.
                // Safer: just use moveX and localized scrubberLayout.
                const rawPos = (gestureState.moveX - (scrubberLayoutRef.current.x || 36)) / effectiveScrubberWidth;
                let newStartPos = Math.max(0, Math.min(rawPos, endPos - (MIN_SELECTION_DURATION / (safeDuration * zoomLevel))));

                if (isNaN(newStartPos) || !isFinite(newStartPos)) return;

                // Update tooltip time
                setTooltipTime((newStartPos * safeDuration) / zoomLevel);

                // Check if selection would exceed max duration
                const currentSelectionDuration = (endPos - newStartPos) * safeDuration;

                if (currentSelectionDuration > maxDuration) {
                    const excess = currentSelectionDuration - maxDuration;
                    const newEndPos = endPos - (excess / safeDuration);
                    if (newEndPos >= newStartPos + (MIN_SELECTION_DURATION / safeDuration)) {
                        setEndPos(newEndPos);
                    } else {
                        newStartPos = endPos - (maxDuration / safeDuration);
                    }
                }

                setStartPos(newStartPos);
                safeSetCurrentTime(newStartPos * safeDuration);
                triggerHaptic('light');
            },
            onPanResponderRelease: () => {
                setIsDragging(null);
                setShowTimeTooltip(false);
                handlesOpacity.value = withTiming(1);
                scrubberScale.value = withSpring(1);
                triggerHaptic('medium');
            },
        })
    ).current;

    // PanResponder for End Handle with sliding window logic
    const endPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                setIsDragging('end');
                setShowTimeTooltip(true);
                handlesOpacity.value = withTiming(1.2);
                scrubberScale.value = withSpring(1.02);
                triggerHaptic('light');
            },
            onPanResponderMove: (_, gestureState) => {
                if (!duration || isNaN(duration) || duration === 0) return;
                
                const rawPos = (gestureState.moveX - (scrubberLayoutRef.current.x || 36)) / effectiveScrubberWidth;
                let newEndPos = Math.max(startPos + (MIN_SELECTION_DURATION / (safeDuration * zoomLevel)), Math.min(rawPos, 1));

                if (isNaN(newEndPos) || !isFinite(newEndPos)) return;

                // Update tooltip time
                setTooltipTime((newEndPos * safeDuration) / zoomLevel);

                // Check if selection would exceed max duration
                const currentSelectionDuration = (newEndPos - startPos) * safeDuration;

                if (currentSelectionDuration > maxDuration) {
                    const excess = currentSelectionDuration - maxDuration;
                    const newStartPos = startPos + (excess / safeDuration);
                    if (newStartPos <= newEndPos - (MIN_SELECTION_DURATION / safeDuration)) {
                        setStartPos(newStartPos);
                    } else {
                        newEndPos = startPos + (maxDuration / safeDuration);
                    }
                }

                setEndPos(newEndPos);
                safeSetCurrentTime(newEndPos * safeDuration);
                triggerHaptic('light');
            },
            onPanResponderRelease: () => {
                setIsDragging(null);
                setShowTimeTooltip(false);
                handlesOpacity.value = withTiming(1);
                scrubberScale.value = withSpring(1);
                triggerHaptic('medium');
            },
        })
    ).current;

    // Playhead dragging for precise scrubbing
    const playheadPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                setIsDragging('playhead');
                setShowTimeTooltip(true);
                player.pause();
                setIsPlaying(false);
                triggerHaptic('light');
            },
            onPanResponderMove: (_, gestureState) => {
                if (!duration || isNaN(duration) || duration === 0) return;
                
                const rawPos = (gestureState.moveX - (scrubberLayoutRef.current.x || 36)) / effectiveScrubberWidth;
                const newPos = Math.max(0, Math.min(rawPos, 1));
                const newTime = (newPos * safeDuration) / zoomLevel;

                if (isNaN(newTime) || !isFinite(newTime)) return;

                setTooltipTime(newTime);
                safeSetCurrentTime(newTime);
                triggerHaptic('light');
            },
            onPanResponderRelease: () => {
                setIsDragging(null);
                setShowTimeTooltip(false);
                triggerHaptic('medium');
            },
        })
    ).current;

    const handleSave = async () => {
        setIsProcessing(true);
        saveButtonScale.value = withSequence(
            withSpring(0.9),
            withSpring(1)
        );

        const startTime = startPos * safeDuration;
        const endTime = endPos * safeDuration;
        const currentDuration = trimDuration;

        try {
            triggerHaptic('heavy');

            let trimmedUri = videoUri;
            let thumbnailUri;

            // Compress and trim video to max 40MB
            if (Platform.OS !== 'web') {
                const result = await MediaCompressor.compressVideo({
                    uri: videoUri,
                    startTime,
                    endTime,
                    maxSizeMB: MAX_FILE_SIZE_MB,
                    quality: 'high',
                });

                trimmedUri = result.uri;
                thumbnailUri = result.thumbnailUri;
            }

            onSave({
                uri: trimmedUri,
                startTime,
                endTime,
                duration: currentDuration,
                thumbnailUri,
            });

            // Small delay to show success state
            setTimeout(() => {
                setIsProcessing(false);
                onClose();
            }, 300);
        } catch (error) {
            console.error('Error saving video:', error);
            setIsProcessing(false);
            triggerHaptic('heavy');
        }
    };

    const handlePlayPause = useCallback(() => {
        setIsPlaying(prev => !prev);
        triggerHaptic('light');
    }, []);

    const handleReset = useCallback(() => {
        setIsSnapping(true);
        setStartPos(0);
        setEndPos(Math.min(1, maxDuration / safeDuration));
        safeSetCurrentTime(0);
        setIsPlaying(false);

        // Animate reset
        scrubberScale.value = withSequence(
            withSpring(1.05),
            withSpring(1)
        );

        triggerHaptic('medium');

        setTimeout(() => setIsSnapping(false), 300);
    }, [duration, maxDuration, player]);

    const handleZoomIn = useCallback(() => {
        setZoomLevel(prev => Math.min(prev + 0.5, 3));
        triggerHaptic('light');
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoomLevel(prev => Math.max(prev - 0.5, 1));
        triggerHaptic('light');
    }, []);

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDetailedTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00.00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    const isOverMax = trimDuration > maxDuration;
    const isUnderMin = trimDuration < MIN_SELECTION_DURATION;
    const progress = (currentTime - startPos * safeDuration) / safeTrimDuration;

    // Animated styles
    const scrubberAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scrubberScale.value }],
    }));

    const handlesAnimatedStyle = useAnimatedStyle(() => ({
        opacity: handlesOpacity.value,
    }));

    const tooltipAnimatedStyle = useAnimatedStyle(() => ({
        opacity: tooltipOpacity.value,
    }));

    const durationLabelStyle = useAnimatedStyle(() => ({
        transform: [{ scale: durationLabelScale.value }],
    }));

    const saveButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: saveButtonScale.value }],
    }));

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <StatusBar barStyle="light-content" />
            <View style={styles.modalOverlay}>
                <Animated.View
                    entering={SlideInDown.springify().damping(15)}
                    exiting={SlideOutDown.springify()}
                    style={styles.container}
                >
                    {/* Premium Header with high visibility */}
                    <LinearGradient
                        colors={['rgba(40,40,45,0.95)', 'rgba(30,30,35,0.98)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.header}
                    >
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.headerButton}
                            disabled={isProcessing}
                        >
                            <Ionicons name="chevron-down" size={28} color="#FF9F0A" />
                        </TouchableOpacity>

                        <Text style={styles.headerTitle}>
                            {isStory ? 'Edit Story' : 'Trim Video'}
                        </Text>

                        <Animated.View style={saveButtonStyle}>
                            <TouchableOpacity
                                onPress={handleSave}
                                style={styles.headerButton}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator size="small" color="#FF9F0A" />
                                ) : (
                                    <Ionicons name="checkmark-circle" size={32} color="#FF9F0A" />
                                )}
                            </TouchableOpacity>
                        </Animated.View>
                    </LinearGradient>

                    {/* Premium Preview Area with Intermingled Loading */}
                    <View style={styles.previewContainer}>
                        <VideoView
                            player={player}
                            style={styles.previewVideo}
                            contentFit="contain"
                            nativeControls={false}
                        />

                        {isLoading && (
                            <BlurView intensity={60} style={[styles.loadingOverlay, StyleSheet.absoluteFill]}>
                                <ActivityIndicator size="large" color="#FF9F0A" />
                                <Text style={styles.loadingText}>Preparing video...</Text>
                            </BlurView>
                        )}

                        {!isLoading && (
                            <>
                                {/* Video Controls Overlay - Non-blurring */}
                                <View style={styles.videoControls}>
                                    <TouchableOpacity
                                        style={styles.playButton}
                                        onPress={handlePlayPause}
                                    >
                                        <LinearGradient
                                            colors={['#FF9F0A', '#FF8800']}
                                            style={styles.playButtonGradient}
                                        >
                                            <Ionicons
                                                name={isPlaying ? 'pause' : 'play'}
                                                size={28}
                                                color="white"
                                            />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>

                                {/* Premium Time Display */}
                                <View style={styles.timeDisplayContainer}>
                                    <BlurView intensity={80} style={styles.timeDisplay}>
                                        <Text style={styles.timeDisplayText}>
                                            {formatDetailedTime(currentTime)}
                                        </Text>
                                    </BlurView>
                                    <BlurView intensity={80} style={[styles.timeDisplay, styles.totalTimeDisplay]}>
                                        <Text style={styles.timeDisplayText}>
                                            {formatDetailedTime(duration)}
                                        </Text>
                                    </BlurView>
                                </View>

                                {/* Premium Selection Info with Duration Badge */}
                                <BlurView intensity={80} style={styles.selectionInfo}>
                                    <Animated.View style={[styles.durationBadge, durationLabelStyle]}>
                                        <LinearGradient
                                            colors={['#FF9F0A', '#FF8800']}
                                            style={styles.durationBadgeGradient}
                                        >
                                            <Text style={styles.durationBadgeText}>
                                                {formatTime(trimDuration)}
                                            </Text>
                                        </LinearGradient>
                                    </Animated.View>
                                    <Text style={[
                                        styles.selectionText,
                                        (isOverMax || isUnderMin) && styles.selectionTextWarning
                                    ]}>
                                        {isStory ? 'max 10s' : 'max 2min'}
                                    </Text>
                                </BlurView>
                            </>
                        )}
                    </View>

                    {/* Premium iPhone-style Precision Scrubber */}
                    {!isLoading && (
                        <Animated.View style={[styles.scrubberWrapper, scrubberAnimatedStyle]}>
                            <View 
                                style={styles.scrubberContainer}
                                onLayout={onScrubberLayout}
                            >
                                {/* Premium Time Ruler */}
                                <View style={styles.timeRuler}>
                                    {[0, 0.25, 0.5, 0.75, 1].map((mark, index) => (
                                        <View key={index} style={styles.rulerMark}>
                                            <View style={[styles.rulerLine, { height: index % 2 === 0 ? 12 : 8 }]} />
                                            <Text style={styles.rulerText}>
                                                {formatTime(duration * mark)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Main scrubber track */}
                                <View style={styles.trackContainer}>
                                    {/* Premium background with waveform effect */}
                                    <LinearGradient
                                        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)']}
                                        style={styles.trackBackground}
                                    />

                                    {/* Inactive track segments with blur */}
                                    <BlurView intensity={20} style={[styles.trackSegment, { width: `${startPos * 100}%` }]} />
                                    <BlurView intensity={20} style={[styles.trackSegment, {
                                        left: `${endPos * 100}%`,
                                        width: `${(1 - endPos) * 100}%`
                                    }]} />

                                    {/* Active trim region with premium gradient */}
                                    <LinearGradient
                                        colors={['rgba(255,159,10,0.35)', 'rgba(255,159,10,0.15)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={[
                                            styles.activeTrack,
                                            {
                                                left: `${startPos * 100}%`,
                                                width: `${(endPos - startPos) * 100}%`
                                            }
                                        ]}
                                    />

                                    {/* Premium time tooltip */}
                                    {showTimeTooltip && (
                                        <Animated.View
                                            entering={FadeIn.springify()}
                                            exiting={FadeOut.springify()}
                                            style={[
                                                styles.timeTooltip,
                                                { left: (tooltipTime / safeDuration) * effectiveScrubberWidth - 35 }
                                            ]}
                                        >
                                            <BlurView intensity={90} style={styles.timeTooltipInner}>
                                                <Text style={styles.timeTooltipText}>
                                                    {formatDetailedTime(tooltipTime)}
                                                </Text>
                                                <View style={styles.timeTooltipArrow} />
                                            </BlurView>
                                        </Animated.View>
                                    )}

                                    {/* Premium Start Handle */}
                                    <Animated.View
                                        style={[
                                            styles.handle,
                                            styles.startHandle,
                                            handlesAnimatedStyle,
                                            { left: startPos * effectiveScrubberWidth - HANDLE_WIDTH }
                                        ]}
                                        {...startPanResponder.panHandlers}
                                    >
                                        <LinearGradient
                                            colors={['#FF9F0A', '#FF8800']}
                                            style={styles.handleGradient}
                                        >
                                            <View style={styles.handleInner} />
                                            <View style={styles.handleGrip} />
                                        </LinearGradient>
                                    </Animated.View>

                                    {/* Premium End Handle */}
                                    <Animated.View
                                        style={[
                                            styles.handle,
                                            styles.endHandle,
                                            handlesAnimatedStyle,
                                            { left: endPos * effectiveScrubberWidth }
                                        ]}
                                        {...endPanResponder.panHandlers}
                                    >
                                        <LinearGradient
                                            colors={['#FF9F0A', '#FF8800']}
                                            style={styles.handleGradient}
                                        >
                                            <View style={styles.handleInner} />
                                            <View style={styles.handleGrip} />
                                        </LinearGradient>
                                    </Animated.View>

                                    {/* Premium Playhead with drag capability */}
                                    <Animated.View
                                        style={[
                                            styles.playhead,
                                            { left: (currentTime / safeDuration) * effectiveScrubberWidth - 1 }
                                        ]}
                                        {...playheadPanResponder.panHandlers}
                                    >
                                        <LinearGradient
                                            colors={['#FF9F0A', '#FF8800']}
                                            style={styles.playheadInner}
                                        />
                                        <View style={styles.playheadCircle} />
                                    </Animated.View>

                                    {/* Waveform visualization overlay */}
                                    <View style={styles.waveformOverlay}>
                                        {[...Array(40)].map((_, i) => (
                                            <View
                                                key={i}
                                                style={[
                                                    styles.waveformBar,
                                                    {
                                                        height: 20 + Math.sin(i * 0.3) * 15,
                                                        opacity: i / 40,
                                                        left: (i / 40) * effectiveScrubberWidth,
                                                    }
                                                ]}
                                            />
                                        ))}
                                    </View>
                                </View>

                                {/* Premium constraint indicators */}
                                <View style={styles.constraintIndicators}>
                                    <LinearGradient
                                        colors={['rgba(255,159,10,0.3)', 'transparent']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={[styles.constraintBar, { width: `${(maxDuration / safeDuration) * 100}%` }]}
                                    />
                                </View>
                            </View>

                            {/* Premium Action Buttons */}
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={handleReset}
                                >
                                    <BlurView intensity={40} style={styles.actionButtonInner}>
                                        <Ionicons name="refresh" size={18} color="#FF9F0A" />
                                        <Text style={styles.actionButtonText}>Reset</Text>
                                    </BlurView>
                                </TouchableOpacity>

                                <View style={styles.zoomControls}>
                                    <TouchableOpacity
                                        style={styles.zoomButton}
                                        onPress={handleZoomOut}
                                    >
                                        <BlurView intensity={40} style={styles.zoomButtonInner}>
                                            <Ionicons name="remove" size={18} color="#FF9F0A" />
                                        </BlurView>
                                    </TouchableOpacity>
                                    <Text style={styles.zoomLevel}>{zoomLevel}x</Text>
                                    <TouchableOpacity
                                        style={styles.zoomButton}
                                        onPress={handleZoomIn}
                                    >
                                        <BlurView intensity={40} style={styles.zoomButtonInner}>
                                            <Ionicons name="add" size={18} color="#FF9F0A" />
                                        </BlurView>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Premium Instruction */}
                            <BlurView intensity={40} style={styles.instructionContainer}>
                                <Text style={styles.instruction}>
                                    {isStory
                                        ? 'Drag handles to select up to 10 seconds'
                                        : 'Drag handles to select up to 2 minutes'
                                    }
                                </Text>
                            </BlurView>
                        </Animated.View>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
    },
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: -0.5,
    },
    headerButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.15)',
        zIndex: 100,
        backgroundColor: 'rgba(30,30,35,0.95)',
    },
    previewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingOverlay: {
        width: '100%',
        aspectRatio: 16 / 9,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 24,
        overflow: 'hidden',
        zIndex: 10,
    },
    loadingText: {
        color: '#fff',
        fontSize: 15,
        marginTop: 12,
        fontWeight: '500',
    },
    previewVideo: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 24,
        backgroundColor: '#000',
    },
    videoControls: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
        shadowColor: '#FF9F0A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    playButtonGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeDisplayContainer: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    timeDisplay: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        overflow: 'hidden',
    },
    totalTimeDisplay: {
        opacity: 0.8,
    },
    timeDisplayText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
        letterSpacing: 0.5,
    },
    selectionInfo: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 24,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    durationBadge: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    durationBadgeGradient: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    durationBadgeText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    selectionText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        fontWeight: '500',
    },
    selectionTextWarning: {
        color: '#FF453A',
    },
    scrubberWrapper: {
        height: 180,
        justifyContent: 'center',
        paddingHorizontal: 36,
        marginBottom: 20,
    },
    scrubberContainer: {
        width: '100%',
    },
    timeRuler: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    rulerMark: {
        alignItems: 'center',
    },
    rulerLine: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginBottom: 4,
    },
    rulerText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
    },
    trackContainer: {
        height: 52,
        justifyContent: 'center',
        position: 'relative',
    },
    trackBackground: {
        position: 'absolute',
        width: '100%',
        height: 52,
        borderRadius: 12,
    },
    trackSegment: {
        position: 'absolute',
        height: 52,
        borderRadius: 12,
        overflow: 'hidden',
    },
    activeTrack: {
        position: 'absolute',
        height: 52,
        borderRadius: 12,
        overflow: 'hidden',
    },
    waveformOverlay: {
        position: 'absolute',
        width: '100%',
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        opacity: 0.3,
    },
    waveformBar: {
        position: 'absolute',
        width: 2,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: 1,
    },
    handle: {
        position: 'absolute',
        width: HANDLE_WIDTH,
        height: 64,
        zIndex: 10,
        top: -6,
    },
    startHandle: {
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
    endHandle: {
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
    },
    handleGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
        shadowColor: '#FF9F0A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 4,
    },
    handleInner: {
        width: 3,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: 1.5,
    },
    handleGrip: {
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
        bottom: 6,
    },
    playhead: {
        position: 'absolute',
        width: 2,
        height: 64,
        zIndex: 15,
        top: -6,
        alignItems: 'center',
    },
    playheadInner: {
        width: 2,
        height: 64,
        borderRadius: 1,
    },
    playheadCircle: {
        position: 'absolute',
        top: -6,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF9F0A',
        marginLeft: -5,
        borderWidth: 2,
        borderColor: 'white',
    },
    timeTooltip: {
        position: 'absolute',
        top: -45,
        alignItems: 'center',
        zIndex: 20,
    },
    timeTooltipInner: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        overflow: 'hidden',
        alignItems: 'center',
    },
    timeTooltipText: {
        color: 'white',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
        fontWeight: '600',
    },
    timeTooltipArrow: {
        position: 'absolute',
        bottom: -5,
        width: 10,
        height: 10,
        backgroundColor: 'rgba(255,149,0,0.9)',
        transform: [{ rotate: '45deg' }],
    },
    constraintIndicators: {
        position: 'absolute',
        top: 30,
        left: 0,
        right: 0,
        height: 3,
    },
    constraintBar: {
        position: 'absolute',
        height: 3,
        borderRadius: 1.5,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
    },
    actionButton: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    actionButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 6,
    },
    actionButtonText: {
        color: '#FF9F0A',
        fontSize: 14,
        fontWeight: '600',
    },
    zoomControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    zoomButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    zoomButtonInner: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomLevel: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        minWidth: 40,
        textAlign: 'center',
    },
    instructionContainer: {
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        overflow: 'hidden',
        alignSelf: 'center',
    },
    instruction: {
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
});

export default VideoTrimmer;