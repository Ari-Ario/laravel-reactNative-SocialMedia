/**
 * VoiceMessagePlayer.tsx
 * Renders a voice note inside a chat bubble — web + native.
 * Web: uses the HTML <audio> element internally.
 * Native: uses expo-av Sound.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import getApiBaseImage from '@/services/getApiBaseImage';

function formatDuration(ms: number) {
    if (ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function resolveAudioUrl(filePath?: string): string {
    if (!filePath) return '';
    if (filePath.startsWith('http') || filePath.startsWith('file://') || filePath.startsWith('blob:')) {
        return filePath;
    }
    return `${getApiBaseImage()}/storage/${filePath}`;
}

interface VoiceMessagePlayerProps {
    /** file_path or URL from the message */
    filePath?: string;
    /** Pre-resolved blob URL (e.g. just recorded) */
    blobUrl?: string;
    /** Original duration in ms stored in metadata */
    durationMs?: number;
    isCurrentUser?: boolean;
}

const BAR_COUNT = 28;

// Static waveform bars — decorative, using a sine pattern so it looks organic
const StaticBars: React.FC<{ progress: number; isCurrentUser: boolean }> = React.memo(
    ({ progress, isCurrentUser }) => {
        const played = Math.round(progress * BAR_COUNT);
        return (
            <View style={barStyles.container}>
                {Array.from({ length: BAR_COUNT }).map((_, i) => {
                    const h = 4 + Math.abs(Math.sin(i * 1.1 + 0.5)) * 18;
                    const isPast = i < played;
                    return (
                        <View
                            key={i}
                            style={[
                                barStyles.bar,
                                { height: h },
                                isPast
                                    ? (isCurrentUser ? barStyles.playedCurrent : barStyles.playedOther)
                                    : (isCurrentUser ? barStyles.unplayedCurrent : barStyles.unplayedOther),
                            ]}
                        />
                    );
                })}
            </View>
        );
    }
);

const barStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: 30,
        flex: 1,
    },
    bar: { width: 3, borderRadius: 2 },
    playedCurrent: { backgroundColor: 'rgba(255,255,255,0.95)' },
    unplayedCurrent: { backgroundColor: 'rgba(255,255,255,0.35)' },
    playedOther: { backgroundColor: '#007AFF' },
    unplayedOther: { backgroundColor: 'rgba(0,122,255,0.25)' },
});

// ─────────────────────────────────────────────────────────────────────────────
const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
    filePath,
    blobUrl,
    durationMs = 0,
    isCurrentUser = false,
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0); // 0–1
    const [currentMs, setCurrentMs] = useState(0);
    const [totalMs, setTotalMs] = useState(durationMs);
    const [error, setError] = useState(false);

    const audioElRef = useRef<HTMLAudioElement | null>(null); // web
    const soundRef = useRef<any>(null); // native expo-av Sound
    const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const url = blobUrl || resolveAudioUrl(filePath);

    // ── Cleanup on unmount ──────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (Platform.OS === 'web') {
                audioElRef.current?.pause();
                audioElRef.current = null;
            } else {
                soundRef.current?.unloadAsync?.();
                soundRef.current = null;
            }
            if (progressInterval.current) clearInterval(progressInterval.current);
        };
    }, []);

    // ── Web implementation ─────────────────────────────────────────────────
    const playWeb = useCallback(() => {
        if (!url) return;
        setError(false);

        if (!audioElRef.current) {
            const el = new Audio(url);
            el.onerror = () => { setError(true); setIsPlaying(false); };
            el.onloadedmetadata = () => {
                setTotalMs(Math.round(el.duration * 1000));
            };
            el.onended = () => {
                setIsPlaying(false);
                setProgress(0);
                setCurrentMs(0);
                if (progressInterval.current) clearInterval(progressInterval.current);
            };
            audioElRef.current = el;
        }

        audioElRef.current.play();
        setIsPlaying(true);

        progressInterval.current = setInterval(() => {
            const el = audioElRef.current;
            if (!el || el.paused) return;
            const dur = el.duration * 1000 || totalMs || 1;
            const cur = el.currentTime * 1000;
            setCurrentMs(cur);
            setProgress(cur / dur);
        }, 80);
    }, [url, totalMs]);

    const pauseWeb = useCallback(() => {
        audioElRef.current?.pause();
        setIsPlaying(false);
        if (progressInterval.current) clearInterval(progressInterval.current);
    }, []);

    // ── Native implementation ──────────────────────────────────────────────
    const playNative = useCallback(async () => {
        if (!url) return;
        setError(false);
        try {
            const { Audio, AVPlaybackStatus } = await import('expo-av');
            if (!soundRef.current) {
                const { sound } = await Audio.Sound.createAsync(
                    { uri: url },
                    { shouldPlay: false }
                );
                soundRef.current = sound;
                const status = await sound.getStatusAsync() as any;
                if (status.isLoaded && status.durationMillis) {
                    setTotalMs(status.durationMillis);
                }
                sound.setOnPlaybackStatusUpdate((st: any) => {
                    if (!st.isLoaded) return;
                    const dur = st.durationMillis || totalMs || 1;
                    const pos = st.positionMillis || 0;
                    setCurrentMs(pos);
                    setProgress(pos / dur);
                    if (st.didJustFinish) {
                        setIsPlaying(false);
                        setProgress(0);
                        setCurrentMs(0);
                    }
                });
            }
            await soundRef.current.playAsync();
            setIsPlaying(true);
        } catch (err) {
            console.error('[VoiceMessagePlayer] native play error:', err);
            setError(true);
        }
    }, [url, totalMs]);

    const pauseNative = useCallback(async () => {
        await soundRef.current?.pauseAsync?.();
        setIsPlaying(false);
    }, []);

    // ── Toggle play/pause ───────────────────────────────────────────────────
    const handleToggle = useCallback(() => {
        if (error) return;
        if (Platform.OS === 'web') {
            isPlaying ? pauseWeb() : playWeb();
        } else {
            isPlaying ? pauseNative() : playNative();
        }
    }, [error, isPlaying, pauseWeb, playWeb, pauseNative, playNative]);

    const displayTime = isPlaying || currentMs > 0 ? currentMs : totalMs;

    return (
        <View style={[styles.container, isCurrentUser ? styles.containerCurrent : styles.containerOther]}>
            {/* Play / Pause button */}
            <TouchableOpacity
                style={[styles.playBtn, isCurrentUser ? styles.playBtnCurrent : styles.playBtnOther]}
                onPress={handleToggle}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                {error ? (
                    <Ionicons name="alert-circle-outline" size={18} color={isCurrentUser ? '#fff' : '#FF3B30'} />
                ) : (
                    <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={18}
                        color={isCurrentUser ? '#fff' : '#007AFF'}
                    />
                )}
            </TouchableOpacity>

            {/* Waveform + duration */}
            <View style={styles.middle}>
                <StaticBars progress={progress} isCurrentUser={isCurrentUser} />
                <Text style={[styles.duration, isCurrentUser ? styles.durationCurrent : styles.durationOther]}>
                    {error ? 'Error' : formatDuration(displayTime)}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minWidth: 180,
        paddingVertical: 6,
    },
    containerCurrent: {},
    containerOther: {},
    playBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playBtnCurrent: {
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    playBtnOther: {
        backgroundColor: 'rgba(0,122,255,0.12)',
    },
    middle: {
        flex: 1,
        gap: 4,
    },
    duration: {
        fontSize: 11,
        fontVariant: ['tabular-nums'],
    },
    durationCurrent: { color: 'rgba(255,255,255,0.75)' },
    durationOther: { color: '#8E8E93' },
});

export default React.memo(VoiceMessagePlayer);
