import React, { useMemo, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import getApiBaseImage from '@/services/getApiBaseImage';

interface VoiceMessagePlayerProps {
    file_path: string | null;
    duration?: string;
    isCurrentUser: boolean;
    isOptimistic?: boolean;
    metadata?: any;
}

import AudioSeeker from './AudioSeeker';

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
    file_path,
    duration,
    isCurrentUser,
    isOptimistic,
    metadata
}) => {
    const audioUrl = useMemo(() => {
        if (!file_path) return null;
        if (file_path.startsWith('http')) return file_path;
        if (file_path.startsWith('blob:') || file_path.startsWith('file://')) return file_path;

        const baseUrl = getApiBaseImage();
        const path = file_path.startsWith('/') ? file_path : `/${file_path}`;
        const resolvedUrl = path.includes('/storage/') ? `${baseUrl}${path}` : `${baseUrl}/storage${path}`;
        console.log('[VoiceMessagePlayer] Resolved Audio URL:', resolvedUrl);
        return resolvedUrl;
    }, [file_path]);

    const player = useAudioPlayer(audioUrl);
    const status = useAudioPlayerStatus(player);
    const [isSeeking, setIsSeeking] = useState(false);

    // ✅ FIX: Cache the last valid duration so it never reverts to 0 during player state changes
    const lastKnownDurationRef = useRef<number>(0);
    if (status.duration > 0) {
        lastKnownDurationRef.current = status.duration;
    }

    // ✅ FIX: Only call player.replace() when the URL genuinely changes — not on every re-render
    const lastLoadedUrlRef = useRef<string | null>(null);
    useEffect(() => {
        if (audioUrl && audioUrl !== lastLoadedUrlRef.current) {
            lastLoadedUrlRef.current = audioUrl;
            player.replace(audioUrl);
        }
    }, [audioUrl, player]);

    const togglePlay = async () => {
        try {
            if (status.playbackState === 'finished') {
                player.seekTo(0);
                await player.play();
            } else if (status.playing) {
                player.pause();
            } else {
                // ✅ IMPROVED Web Resumption: 
                // In some Chrome versions, a simple .play() might fail if the context was suspended.
                // We explicitly trigger play and check if we need to 'prime' it.
                await player.play();

                // Safety check for Chrome: if after a short delay it's still not playing, try again
                if (Platform.OS === 'web') {
                    setTimeout(async () => {
                        if (!player.playing) {
                            try {
                                await player.play();
                            } catch (e) {
                                console.warn('Voice play repeat blocked:', e);
                            }
                        }
                    }, 50);
                }
            }
        } catch (e) {
            console.warn('Voice play blocked:', e);
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Use cascading fallback: live status → cached → metadata prop
    const metadataDuration = duration ? parseFloat(duration) : 0;
    const effectiveDuration = lastKnownDurationRef.current > 0
        ? lastKnownDurationRef.current
        : (metadataDuration > 0 ? metadataDuration : 0);

    // ✅ FIX: Guard against NaN/Infinity progress when duration is momentarily 0
    const progress = effectiveDuration > 0
        ? Math.min(1, Math.max(0, status.currentTime / effectiveDuration))
        : 0;

    // Display time: show current position if playing/paused mid-way, else total duration
    const displayTime = (status.playing || status.currentTime > 0.05)
        ? formatTime(status.currentTime)
        : formatTime(effectiveDuration);

    const metering = metadata?.metering || metadata?.waveform;

    return (
        <View style={styles.container}>
            <TouchableOpacity
                onPress={togglePlay}
                style={[
                    styles.playButton,
                    isCurrentUser ? styles.currentUserPlayButton : styles.otherUserPlayButton
                ]}
                activeOpacity={0.8}
                disabled={isOptimistic}
            >
                <Ionicons
                    name={status.playing ? 'pause' : 'play'}
                    size={22}
                    color={isCurrentUser ? '#007AFF' : '#fff'}
                    style={!status.playing && { marginLeft: 2 }}
                />
            </TouchableOpacity>

            <View style={styles.playerRight}>
                <AudioSeeker
                    progress={progress}
                    duration={effectiveDuration}
                    onSeek={(pos) => player.seekTo(pos)}
                    onSeekingChange={setIsSeeking}
                    isCurrentUser={isCurrentUser}
                    metering={metering}
                />

                <View style={styles.metaRow}>
                    <Text style={[styles.timeText, isCurrentUser ? styles.currentUserMetaText : styles.otherUserMetaText]}>
                        {isOptimistic ? 'Sending...' : displayTime}
                    </Text>
                    {(status.isBuffering || isOptimistic) && (
                        <View style={[styles.bufferingDot, isOptimistic && { backgroundColor: '#FFD60A' }]} />
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        minWidth: 220,
        height: 58,
    },
    playButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    currentUserPlayButton: {
        backgroundColor: '#fff',
    },
    otherUserPlayButton: {
        backgroundColor: '#007AFF',
    },
    playerRight: {
        flex: 1,
        justifyContent: 'center',
        gap: 2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    timeText: {
        fontSize: 11,
        fontFamily: 'system-font',
    },
    currentUserMetaText: {
        color: 'rgba(255, 255, 255, 0.8)',
    },
    otherUserMetaText: {
        color: '#8E8E93',
    },
    bufferingDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#007AFF',
        marginLeft: 6,
    }
});

export default VoiceMessagePlayer;
