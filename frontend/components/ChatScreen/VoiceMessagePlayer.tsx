import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import getApiBaseImage from '@/services/getApiBaseImage';

interface VoiceMessagePlayerProps {
    file_path: string | null;
    duration?: string;
    isCurrentUser: boolean;
    isOptimistic?: boolean;
}

import AudioSeeker from './AudioSeeker';

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ file_path, duration, isCurrentUser, isOptimistic }) => {
    const audioUrl = useMemo(() => {
        if (!file_path) return null;
        if (file_path.startsWith('http')) return file_path;
        
        const baseUrl = getApiBaseImage();
        const path = file_path.startsWith('/') ? file_path : `/${file_path}`;
        const resolvedUrl = path.includes('/storage/') ? `${baseUrl}${path}` : `${baseUrl}/storage${path}`;
        console.log('[VoiceMessagePlayer] Resolved Audio URL:', resolvedUrl);
        return resolvedUrl;
    }, [file_path]);

    const player = useAudioPlayer(audioUrl);
    const status = useAudioPlayerStatus(player);
    const [isSeeking, setIsSeeking] = useState(false);

    // Sync player source if audioUrl changes
    useEffect(() => {
        if (audioUrl) {
            player.replace(audioUrl);
        }
    }, [audioUrl, player]);

    const togglePlay = () => {
        if (status.playbackState === 'finished') {
            player.seekTo(0);
            player.play();
        } else if (status.playing) {
            player.pause();
        } else {
            player.play();
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const effectiveDuration = status.duration > 0 ? status.duration : (duration ? parseFloat(duration) : 0);
    const progress = effectiveDuration > 0 ? status.currentTime / effectiveDuration : 0;

    return (
        <View style={styles.container}>
            <TouchableOpacity 
                onPress={togglePlay} 
                style={[
                    styles.playButton, 
                    isCurrentUser ? styles.currentUserPlayButton : styles.otherUserPlayButton
                ]}
                activeOpacity={0.8}
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
                />
                
                <View style={styles.metaRow}>
                    <Text style={[styles.timeText, isCurrentUser ? styles.currentUserMetaText : styles.otherUserMetaText]}>
                        {isOptimistic ? 'Sending...' : (status.playing || status.currentTime > 0 ? formatTime(status.currentTime) : formatTime(effectiveDuration))}
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
        height: 50,
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
    },
    waveformWrapper: {
        height: 25,
        justifyContent: 'center',
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: 25,
    },
    bar: {
        width: 2,
        borderRadius: 1,
    },
    currentUserBarInactive: {
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    currentUserBarActive: {
        backgroundColor: '#fff',
    },
    otherUserBarInactive: {
        backgroundColor: 'rgba(0, 122, 255, 0.2)',
    },
    otherUserBarActive: {
        backgroundColor: '#007AFF',
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
    metaRow: {
        marginTop: 2,
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
