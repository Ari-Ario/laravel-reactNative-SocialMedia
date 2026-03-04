// components/ChatScreen/SpaceChatTab.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Text,
    Modal,
    ScrollView,
    Animated as RNAnimated,
    PanResponder,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import AnimatedRN, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import MessageList from './MessageList';
import AdvancedMediaUploader, { AdvancedMediaUploaderRef } from './AdvancedMediaUploader';
import AttachmentPicker from './AttachmentPicker';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { createShadow } from '@/utils/styles';
import useAudioRecorder, { MAX_RECORDING_DURATION_MS } from '@/hooks/useAudioRecorder';
import { safeHaptics } from '@/utils/haptics';

interface SpaceChatTabProps {
    spaceId: string;
    currentUserId: number;
    space: any;
    setSpace: React.Dispatch<React.SetStateAction<any>>;
    setShowPollCreator: (show: boolean) => void;
    /** All polls for this space (passed from [id].tsx so we don't re-fetch) */
    polls?: any[];
    /** Provide active participants for enriching chat message avatars */
    participants?: any[];
    currentUserRole?: string;
    onNavigateToAllPolls?: () => void;
    highlightMessageId?: string;
}

const SpaceChatTab: React.FC<SpaceChatTabProps> = ({
    spaceId,
    currentUserId,
    space,
    setSpace,
    setShowPollCreator,
    polls = [],
    participants = [],
    currentUserRole,
    onNavigateToAllPolls,
    highlightMessageId,
}) => {
    const [content, setContent] = useState<string>('');
    const [showMediaUploader, setShowMediaUploader] = useState(false);
    const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
    const [pendingAsset, setPendingAsset] = useState<any>(null);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const uploaderRef = useRef<AdvancedMediaUploaderRef>(null);
    const collaborationService = CollaborationService.getInstance();

    const [isLocked, setIsLocked] = useState(false);
    const [isSendingAudio, setIsSendingAudio] = useState(false);

    const {
        isRecording,
        isPaused,
        durationMs,
        metering,
        recordingUri,
        sound,
        isPlaying,
        playbackPositionMs,
        startRecording,
        stopRecording,
        cancelRecording,
        pauseRecording,
        resumeRecording,
        playPausePlayback,
        discardRecordingUri,
    } = useAudioRecorder();
    const isLockedRef = useRef(isLocked);
    const isRecordingRef = useRef(isRecording);

    useEffect(() => {
        isLockedRef.current = isLocked;
    }, [isLocked]);

    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    const pan = useRef(new RNAnimated.ValueXY()).current;
    const slideToLockHeight = -80;
    const slideToCancelWidth = -100;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: async () => {
                if (content.trim()) return;
                pan.setOffset({ x: 0, y: 0 });
                pan.setValue({ x: 0, y: 0 });
                const success = await startRecording();
                if (success) setIsLocked(false);
            },
            onPanResponderMove: (_, gestureState) => {
                // If not recording, or already locked, do not move the mic button visually
                if (!isRecordingRef.current || isLockedRef.current) return;

                const dx = Math.min(0, gestureState.dx); // Only allow left
                const dy = Math.min(0, gestureState.dy); // Only allow up

                pan.setValue({ x: dx, y: dy });

                if (dy < slideToLockHeight) {
                    setIsLocked(true);
                    safeHaptics.success();
                    // Reset pan so mic stays in place when locked
                    pan.setValue({ x: 0, y: 0 });
                } else if (dx < slideToCancelWidth) {
                    cancelRecording();
                    pan.setValue({ x: 0, y: 0 });
                }
            },
            onPanResponderRelease: async (_, gestureState) => {
                // Return to original position
                RNAnimated.spring(pan, {
                    toValue: { x: 0, y: 0 },
                    useNativeDriver: true,
                }).start();

                if (!isRecordingRef.current) return;

                // If user released without locking and didn't slide to cancel, 
                // we treat it as "stop and send"
                if (!isLockedRef.current && gestureState.dx >= slideToCancelWidth && gestureState.dy >= slideToLockHeight) {
                    const uri = await stopRecording();
                    if (uri) {
                        handleSendAudio(uri);
                    }
                }
            },
            onPanResponderTerminate: () => {
                if (isRecordingRef.current && !isLockedRef.current) {
                    cancelRecording();
                }
                RNAnimated.spring(pan, {
                    toValue: { x: 0, y: 0 },
                    useNativeDriver: true,
                }).start();
            }
        })
    ).current;

    const inputTranslateY = useSharedValue(0);

    useEffect(() => {
        // WhatsApp height for picker is around 280
        inputTranslateY.value = withTiming(showAttachmentPicker ? -280 : 0, {
            duration: 250
        });
    }, [showAttachmentPicker]);

    const animatedInputStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: inputTranslateY.value }]
    }));

    const handleSendMessage = async () => {
        if (!content.trim() || !space) return;

        const trimmed = content.trim();
        setContent('');

        try {
            const message = await collaborationService.sendMessage(spaceId, {
                content: trimmed,
                type: 'text',
                reply_to_id: replyingTo?.id,
            });

            setReplyingTo(null);

            setSpace((prev: any) => ({
                ...prev,
                content_state: {
                    ...prev.content_state,
                    messages: [...(prev?.content_state?.messages || []), message]
                }
            }));

            if (message.user_id !== currentUserId) {
                useCollaborationStore.getState().incrementUnreadCount(spaceId);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            // Restore content on error
            setContent(trimmed);
        }
    };

    const handleSendAudio = async (uri: string) => {
        setIsSendingAudio(true);
        try {
            const uploadedMedia = await collaborationService.uploadAudio(spaceId, uri, durationMs / 1000);

            const message = await collaborationService.sendMessage(spaceId, {
                content: '',
                type: 'voice',
                file_path: uploadedMedia.media?.file_path || uploadedMedia.url,
                metadata: {
                    duration: formatDuration(durationMs),
                    url: uploadedMedia.url,
                },
                reply_to_id: replyingTo?.id,
            });

            setReplyingTo(null);
            discardRecordingUri();

            setSpace((prev: any) => ({
                ...prev,
                content_state: {
                    ...prev.content_state,
                    messages: [...(prev?.content_state?.messages || []), message]
                }
            }));

            if (message.user_id !== currentUserId) {
                useCollaborationStore.getState().incrementUnreadCount(spaceId);
            }
        } catch (error) {
            console.error('Error sending audio:', error);
            Alert.alert('Error', 'Failed to send voice message.');
        } finally {
            setIsSendingAudio(false);
        }
    };

    const formatDuration = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    /** Unread poll count badge */
    const pollCount = polls.length;

    return (
        <>
            <View style={styles.chatContainer}>
                {/* ─── Chat header bar with Poll shortcut ─── */}
                {polls.length > 0 && (
                    <TouchableOpacity
                        style={styles.pollsBanner}
                        onPress={onNavigateToAllPolls}
                        activeOpacity={0.8}
                    >
                        <View style={styles.pollsBannerLeft}>
                            <Ionicons name="bar-chart" size={16} color="#007AFF" />
                            <Text style={styles.pollsBannerText}>
                                {pollCount} active poll{pollCount !== 1 ? 's' : ''}
                            </Text>
                        </View>
                        <View style={styles.pollsBannerRight}>
                            <Text style={styles.pollsBannerCta}>View all</Text>
                            <Ionicons name="chevron-forward" size={14} color="#007AFF" />
                        </View>
                    </TouchableOpacity>
                )}

                {/* ─── Message List ─── */}
                <MessageList
                    spaceId={spaceId}
                    currentUserId={currentUserId}
                    polls={polls}
                    participants={participants}
                    onReply={(msg) => setReplyingTo(msg)}
                    highlightMessageId={highlightMessageId}
                    lastReadAt={space?.my_participation?.last_active_at ?? null}
                    onPollPress={() => { }} // No-op now that polls are inline
                />

                {/* ─── Reply Preview ─── */}
                {replyingTo && (
                    <View style={styles.replyPreviewContainer}>
                        <View style={styles.replyPreviewBar} />
                        <View style={styles.replyPreviewContent}>
                            <Text style={styles.replyPreviewName} numberOfLines={1}>
                                {replyingTo.user?.name || replyingTo.user_name || 'User'}
                            </Text>
                            <Text style={styles.replyPreviewText} numberOfLines={1}>
                                {replyingTo.type === 'text' ? replyingTo.content : `[${replyingTo.type}]`}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setReplyingTo(null)}
                            style={styles.replyPreviewClose}
                        >
                            <Ionicons name="close-circle" size={20} color="#8E8E93" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* ─── Input Bar ─── */}
                <AnimatedRN.View style={[styles.chatInputContainer, animatedInputStyle]}>
                    {/* Render standard input OR audio recording overlay */}

                    {recordingUri ? (
                        /* PLAYBACK OF DRAFT AUDIO */
                        <View style={styles.audioPreviewContainer}>
                            <TouchableOpacity style={styles.trashAudioBtn} onPress={discardRecordingUri}>
                                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.playPauseBtn} onPress={playPausePlayback}>
                                <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#fff" />
                            </TouchableOpacity>

                            {/* Simple playback slider / waveform */}
                            <View style={styles.playbackWaveform}>
                                {metering.slice(-25).map((meter, i) => (
                                    <View key={i} style={[
                                        styles.waveformBarPlayback,
                                        { height: Math.max(4, (meter / 100) * 30) }
                                    ]} />
                                ))}
                            </View>
                            <Text style={styles.playbackDuration}>
                                {formatDuration(durationMs)}
                            </Text>

                            <TouchableOpacity
                                style={[styles.sendAudioBtn, isSendingAudio && { opacity: 0.5 }]}
                                onPress={() => handleSendAudio(recordingUri)}
                                disabled={isSendingAudio}
                            >
                                {isSendingAudio ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="send" size={18} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>

                    ) : isRecording ? (
                        /* RECORDING OVERLAY (ACTIVE) */
                        <View style={styles.recordingOverlayContainer}>
                            {/* Blinking red dot and timer */}
                            <View style={styles.recordingTimerRow}>
                                <View style={styles.blinkingDot} />
                                <Text style={styles.recordingTimeText}>{formatDuration(durationMs)}</Text>
                            </View>

                            {/* Waveform Visualization */}
                            <View style={styles.liveWaveform}>
                                {metering.slice(-30).map((meter, i) => (
                                    <View key={i} style={[
                                        styles.waveformBarLive,
                                        { height: Math.max(4, (meter / 100) * 24) }
                                    ]} />
                                ))}
                            </View>

                            {/* Center logic: slide to cancel OR lock controls */}
                            {isLocked ? (
                                <View style={styles.lockedModeCenter}>
                                    <TouchableOpacity style={styles.recordActionBtn} onPress={cancelRecording}>
                                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.recordActionBtn} onPress={isPaused ? resumeRecording : pauseRecording}>
                                        <Ionicons name={isPaused ? "play" : "pause"} size={22} color="#007AFF" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.recordActionBtn} onPress={() => stopRecording()}>
                                        <Ionicons name="stop" size={22} color="#FF3B30" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.slideToCancelContainer}>
                                    <View style={styles.slideChevron}>
                                        <Ionicons name="chevron-back" size={16} color="#8e8e93" />
                                    </View>
                                    <Text style={styles.slideCancelText}>Slide to cancel</Text>
                                </View>
                            )}

                            {/* Animated Mic/Send Button (Right side) */}
                            <RNAnimated.View
                                style={[
                                    styles.micCircle,
                                    isLocked ? styles.micCircleLocked : styles.micCircleHold,
                                    !isLocked && {
                                        transform: pan.getTranslateTransform()
                                    }
                                ]}
                                {...(!isLocked ? panResponder.panHandlers : {})}
                            >
                                {isLocked ? (
                                    <TouchableOpacity
                                        onPress={async () => {
                                            const uri = await stopRecording();
                                            if (uri) handleSendAudio(uri);
                                        }}
                                        style={styles.lockedSendInner}
                                    >
                                        <Ionicons name="send" size={20} color="#fff" />
                                    </TouchableOpacity>
                                ) : (
                                    <Ionicons name="mic" size={24} color="#fff" />
                                )}
                            </RNAnimated.View>

                            {/* The slide up to lock icon */}
                            {!isLocked && (
                                <View style={styles.slideToLockOverlay}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#8e8e93" />
                                    <Ionicons name="chevron-up" size={16} color="#8e8e93" />
                                </View>
                            )}
                        </View>

                    ) : (
                        /* STANDARD INPUT */
                        <>
                            <View style={styles.attachActions}>
                                <TouchableOpacity
                                    onPress={() => setShowAttachmentPicker(!showAttachmentPicker)}
                                    style={styles.actionButton}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons
                                        name={showAttachmentPicker ? "close" : "attach"}
                                        size={24}
                                        color="#007AFF"
                                    />
                                </TouchableOpacity>
                            </View>

                            <TextInput
                                style={styles.messageInput}
                                placeholder={`Message in ${space?.title || 'space'}...`}
                                value={content}
                                onChangeText={setContent}
                                multiline
                                maxLength={2000}
                                placeholderTextColor="#9a9a9a"
                                returnKeyType="default"
                                blurOnSubmit={false}
                                onFocus={() => setShowAttachmentPicker(false)}
                            />

                            {/* Dynamic send or mic btn */}
                            {content.trim() ? (
                                <TouchableOpacity
                                    style={styles.sendButton}
                                    onPress={handleSendMessage}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="send" size={18} color="#fff" />
                                </TouchableOpacity>
                            ) : (
                                <RNAnimated.View
                                    style={[styles.sendButton, { backgroundColor: '#FF9500' }]}
                                    {...panResponder.panHandlers}
                                >
                                    <Ionicons name="mic" size={22} color="#fff" />
                                </RNAnimated.View>
                            )}
                        </>
                    )}
                </AnimatedRN.View>
            </View>

            <AttachmentPicker
                isVisible={showAttachmentPicker}
                onClose={() => setShowAttachmentPicker(false)}
                onSelectAction={(action) => {
                    setShowAttachmentPicker(false);
                    if (action === 'poll') {
                        setShowPollCreator(true);
                    } else if (action === 'camera') {
                        uploaderRef.current?.openCamera();
                        setShowMediaUploader(true);
                    } else if (action === 'gallery') {
                        uploaderRef.current?.openGallery();
                        setShowMediaUploader(true);
                    } else if (action === 'document') {
                        uploaderRef.current?.openFilePicker();
                        setShowMediaUploader(true);
                    } else {
                        Alert.alert('Coming Soon', `${action} features are coming soon!`);
                    }
                }}
            />

            <AdvancedMediaUploader
                ref={uploaderRef}
                spaceId={spaceId}
                isVisible={showMediaUploader}
                onClose={() => setShowMediaUploader(false)}
                onUploadComplete={async (mediaList: any[], caption?: string) => {
                    console.log('[SpaceChatTab] Media uploaded:', mediaList);
                    try {
                        const isMultiple = mediaList.length > 1;
                        let messageData: any;

                        if (isMultiple) {
                            messageData = {
                                content: caption || '',
                                type: 'album',
                                metadata: {
                                    media_items: mediaList.map(m => ({
                                        ...m,
                                        url: m.url || m.file_path,
                                    }))
                                }
                            };
                        } else {
                            const media = mediaList[0];
                            messageData = {
                                content: caption || '',
                                type: media.type || 'image',
                                file_path: media.file_path,
                                metadata: {
                                    ...media.metadata,
                                    url: media.url || media.file_path,
                                }
                            };
                        }

                        const message = await collaborationService.sendMessage(spaceId, messageData);

                        setSpace((prev: any) => ({
                            ...prev,
                            content_state: {
                                ...prev.content_state,
                                messages: [...(prev?.content_state?.messages || []), message]
                            }
                        }));

                        if (message.user_id !== currentUserId) {
                            useCollaborationStore.getState().incrementUnreadCount(spaceId);
                        }
                    } catch (error) {
                        console.error('Error sending media message:', error);
                    }
                }}
            />
        </>
    );
};

const styles = StyleSheet.create({
    chatContainer: {
        flex: 1,
        backgroundColor: '#F7F7F7',
    },
    /* ── Polls banner ── */
    pollsBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#EBF3FF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#D0E4FF',
    },
    pollsBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pollsBannerText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#007AFF',
    },
    pollsBannerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    pollsBannerCta: {
        fontSize: 13,
        fontWeight: '500',
        color: '#007AFF',
    },
    /* ── Input area ── */
    chatInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#e8e8e8',
        ...createShadow({ width: 0, height: -2, opacity: 0.04, radius: 4, elevation: 4 }),
    },
    attachActions: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 2,
    },
    actionButton: {
        padding: 6,
        marginHorizontal: 2,
    },
    messageInput: {
        flex: 1,
        backgroundColor: '#f4f4f4',
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 10 : 8,
        paddingBottom: Platform.OS === 'ios' ? 10 : 8,
        marginHorizontal: 6,
        fontSize: 15,
        maxHeight: 120,
        lineHeight: 20,
        color: '#1a1a1a',
    },
    sendButton: {
        backgroundColor: '#007AFF',
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 1,
    },
    sendButtonDisabled: {
        backgroundColor: '#c8c8c8',
    },
    /* ── Poll overlay ── */
    overlayBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    pollOverlaySheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        ...createShadow({ width: 0, height: -4, opacity: 0.12, radius: 20, elevation: 20 }),
        overflow: 'hidden',
    },
    sheetHeader: {
        paddingTop: 10,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    sheetHandle: {
        width: 36,
        height: 4,
        backgroundColor: '#d0d0d0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 12,
    },
    sheetTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sheetTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    sheetCloseBtn: {
        padding: 4,
        borderRadius: 14,
        backgroundColor: '#f0f0f0',
    },
    /* ── Reply Preview Styles ── */
    replyPreviewContainer: {
        flexDirection: 'row',
        backgroundColor: '#f9f9f9',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: 'center',
    },
    replyPreviewBar: {
        width: 4,
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 2,
    },
    replyPreviewContent: {
        flex: 1,
        marginLeft: 10,
        justifyContent: 'center',
    },
    replyPreviewName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#007AFF',
        marginBottom: 2,
    },
    replyPreviewText: {
        fontSize: 13,
        color: '#666',
    },
    replyPreviewClose: {
        padding: 4,
    },
    /* ── Audio Recording & Playback Overlay ── */
    recordingOverlayContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        height: 52,
        justifyContent: 'space-between',
        backgroundColor: '#f8f9fa',
        borderRadius: 26,
    },
    audioPreviewContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 12,
        height: 52,
        backgroundColor: '#f2f2f7',
        borderRadius: 26,
    },
    recordingTimerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 65,
    },
    blinkingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF3B30',
        marginRight: 8,
    },
    recordingTimeText: {
        fontSize: 16,
        color: '#1c1c1e',
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    liveWaveform: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 30,
        gap: 2,
        marginHorizontal: 15,
    },
    waveformBarLive: {
        width: 3,
        backgroundColor: 'rgba(0, 122, 255, 0.5)',
        borderRadius: 2,
    },
    slideToCancelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        opacity: 0.6,
    },
    slideCancelText: {
        color: '#8e8e93',
        fontSize: 14,
        fontWeight: '500',
    },
    slideChevron: {
        marginRight: 4,
    },
    slideToLockOverlay: {
        position: 'absolute',
        right: 12,
        top: -60,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 25,
        ...createShadow({ elevation: 2 }),
    },
    lockedModeCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    recordActionBtn: {
        padding: 8,
        backgroundColor: '#fff',
        borderRadius: 20,
        ...createShadow({ elevation: 1 }),
    },
    micCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    micCircleHold: {
        backgroundColor: '#FF3B30',
    },
    micCircleLocked: {
        backgroundColor: '#007AFF',
    },
    trashAudioBtn: {
        marginRight: 15,
        padding: 8,
        backgroundColor: '#fff',
        borderRadius: 20,
        ...createShadow({ elevation: 1 }),
    },
    playPauseBtn: {
        backgroundColor: '#007AFF',
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        ...createShadow({ elevation: 2 }),
    },
    playbackWaveform: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 32,
        gap: 2,
    },
    waveformBarPlayback: {
        width: 3,
        backgroundColor: '#007AFF',
        borderRadius: 2,
    },
    playbackDuration: {
        marginLeft: 12,
        marginRight: 12,
        fontSize: 14,
        color: '#1c1c1e',
        fontWeight: '600',
        minWidth: 40,
        textAlign: 'right',
    },
    sendAudioBtn: {
        backgroundColor: '#007AFF',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        ...createShadow({ elevation: 2 }),
    },
    lockedSendInner: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    }
});

export default React.memo(SpaceChatTab);
