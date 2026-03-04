import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

interface VoiceMessagePlayerProps {
    uri: string;
    durationLabel: string;
    isCurrentUser: boolean;
}

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ uri, durationLabel, isCurrentUser }) => {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0); // 0 to 1
    const [positionMillis, setPositionMillis] = useState(0);
    const [durationMillis, setDurationMillis] = useState(1);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync().catch(() => { });
            }
        };
    }, []);

    const initializeSound = async () => {
        try {
            // Unload existing sound if any
            if (sound) {
                await sound.unloadAsync();
            }

            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                allowsRecordingIOS: false,
            });

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: true },
                (status) => {
                    if (status.isLoaded) {
                        setIsLoaded(true);
                        const duration = status.durationMillis || 1;
                        setDurationMillis(duration);
                        setPositionMillis(status.positionMillis);
                        setProgress(status.positionMillis / duration);

                        setIsPlaying(status.isPlaying);

                        if (status.didJustFinish) {
                            setIsPlaying(false);
                            setProgress(0);
                            setPositionMillis(0);
                            newSound.setPositionAsync(0);
                        }
                    }
                }
            );
            setSound(newSound);
        } catch (err) {
            console.error('Failed to load sound', err);
        }
    };

    const togglePlayback = async () => {
        if (!sound) {
            await initializeSound();
            return;
        }

        if (isPlaying) {
            await sound.pauseAsync();
        } else {
            await sound.playAsync();
        }
    };

    const formatCurrentTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const displayTime = positionMillis > 0 ? formatCurrentTime(positionMillis) : durationLabel;

    // Generate a reasonably distributed set of bars for the waveform
    const BARS_COUNT = 35;
    const bars = React.useMemo(() => {
        return Array.from({ length: BARS_COUNT }).map((_, i) => {
            // Pseudo-random but deterministic heights for consistent look per message
            // Uses a simple hash based on URI length and index
            const seed = (uri.length + i) * 123.456;
            const height = 4 + Math.abs(Math.sin(seed)) * 14 + Math.abs(Math.cos(seed * 0.5)) * 10;
            return height;
        });
    }, [uri]);

    return (
        <View style={styles.voiceContainer}>
            <TouchableOpacity
                onPress={togglePlayback}
                style={[styles.playButton, !isCurrentUser && styles.playButtonOther]}
                activeOpacity={0.8}
            >
                <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={22}
                    color={isCurrentUser ? "#007AFF" : "#fff"}
                />
            </TouchableOpacity>

            <View style={styles.waveformContainer}>
                {bars.map((height, i) => {
                    const isPlayed = (i / BARS_COUNT) <= progress;
                    return (
                        <View
                            key={i}
                            style={[
                                styles.waveformBar,
                                { height },
                                isPlayed ? (isCurrentUser ? styles.barPlayedCurrent : styles.barPlayedOther) :
                                    (isCurrentUser ? styles.barUnplayedCurrent : styles.barUnplayedOther)
                            ]}
                        />
                    );
                })}
            </View>

            <View style={styles.durationContainer}>
                <Text style={[styles.durationText, isCurrentUser ? styles.durationCurrent : styles.durationOther]}>
                    {displayTime}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    voiceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        minWidth: 220,
        maxWidth: 280,
    },
    playButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    playButtonOther: {
        backgroundColor: 'rgba(0,122,255,0.9)', // Blue play button on grey bubble
    },
    waveformContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 30,
        marginRight: 10,
    },
    waveformBar: {
        width: 2.5,
        borderRadius: 1.5,
    },
    barPlayedCurrent: {
        backgroundColor: '#fff', // White on Blue bubble
    },
    barUnplayedCurrent: {
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
    barPlayedOther: {
        backgroundColor: '#007AFF', // Blue on Grey bubble
    },
    barUnplayedOther: {
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    durationContainer: {
        minWidth: 35,
    },
    durationText: {
        fontSize: 12,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    durationCurrent: {
        color: 'rgba(255,255,255,0.9)',
    },
    durationOther: {
        color: '#666',
    }
});

export default VoiceMessagePlayer;
