// components/ChatScreen/SpaceChatTab.tsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
    View,
    StyleSheet as RNStyleSheet,
    TouchableOpacity,
    TextInput,
    Text,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import AnimatedRN, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import MessageList from './MessageList';
import AdvancedMediaUploader, { AdvancedMediaUploaderRef } from './AdvancedMediaUploader';
import AttachmentPicker from './AttachmentPicker';
import ShareLocation, { LocationData } from './ShareLocation';
import CollaborationService, { CollaborationSpace } from '@/services/ChatScreen/CollaborationService';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { createShadow } from '@/utils/styles';
import { useToastStore } from '@/stores/toastStore';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import AudioSeeker from './AudioSeeker';
import { useTranslation } from '@/constants/i18n';

interface SpaceChatTabProps {
    spaceId: string;
    currentUserId: number;
    space: CollaborationSpace;
    setSpace: React.Dispatch<React.SetStateAction<CollaborationSpace>>;
    setShowPollCreator: (show: boolean) => void;
    /** All polls for this space (passed from [id].tsx so we don't re-fetch) */
    polls?: any[];
    /** Provide active participants for enriching chat message avatars */
    participants?: any[];
    currentUserRole?: string;
    onNavigateToAllPolls?: () => void;
    highlightMessageId?: string;
    onStartCall?: (type: 'audio' | 'video') => void;
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
    onStartCall,
}) => {
    const { colors, activeScheme } = useAppTheme();
    const { t, isRTL } = useTranslation();
    const styles = getStyles(colors, activeScheme, isRTL);
    const { showToast } = useToastStore();
    const [content, setContent] = useState<string>('');
    const [showMediaUploader, setShowMediaUploader] = useState(false);
    const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; user: { name: string } } | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const uploaderRef = useRef<AdvancedMediaUploaderRef>(null);
    const collaborationService = CollaborationService.getInstance();

    // 1. Ref to break circular dependency (the hook needs options which needs callback, but callback needs hook returns)
    const onRecordingCompleteRef = useRef<(uri: string, duration: number, metering?: number[]) => Promise<void>>(undefined);

    const audioRecordingOptions = useMemo(() => ({
        maxDuration: 120,
        onRecordingComplete: (uri: string, duration: number, metering?: number[]) =>
            onRecordingCompleteRef.current?.(uri, duration, metering),
    }), []);

    const {
        isRecording,
        isPaused,
        recordingDuration,
        isUploading: audioIsUploading,
        previewStatus,
        displayProgress,
        effectiveDuration,
        startRecording,
        pauseRecording,
        resumeRecording,
        playPreview,
        pausePreview,
        seekPreview,
        stopRecording,
        cancelRecording,
        formatDuration,
        setIsUploading: setAudioIsUploading,
        setIsSeeking,
        meteringData,
    } = useAudioRecording(audioRecordingOptions);

    const onRecordingCompleteCallback = useCallback(async (uri: string, duration: number, metering?: number[]) => {
        setAudioIsUploading(true);

        // ─── Optimistic UI Update ───
        const tempId = `temp_${Date.now()}`;
        const optimisticMessage = {
            id: tempId,
            user_id: currentUserId,
            type: 'voice',
            content: t('voice_message_label'),
            file_path: uri,
            metadata: {
                duration: Math.round(duration),
                metering: metering || []
            },
            created_at: new Date().toISOString(),
            isOptimistic: true,
            user: { id: currentUserId, name: 'You' }
        };

        setSpace((prev: any) => ({
            ...prev,
            content_state: {
                ...prev.content_state,
                messages: [...(prev?.content_state?.messages || []), optimisticMessage]
            }
        }));

        try {
            const formData = new FormData();

            if (Platform.OS === 'web') {
                const response = await fetch(uri);
                const blob = await response.blob();

                let extension = 'm4a';
                if (blob.type.includes('webm')) extension = 'webm';
                else if (blob.type.includes('mp4')) extension = 'mp4';
                else if (blob.type.includes('ogg')) extension = 'ogg';
                else if (blob.type.includes('wav')) extension = 'wav';
                else if (blob.type.includes('opus')) extension = 'opus';

                formData.append('audio', blob, `audio_${Date.now()}.${extension}`);
            } else {
                formData.append('audio', {
                    uri: uri,
                    type: 'audio/m4a',
                    name: `audio_${Date.now()}.m4a`,
                } as any);
            }

            formData.append('duration', Math.round(duration).toString());
            if (metering) {
                formData.append('metering', JSON.stringify(metering));
            }

            const message = await collaborationService.sendAudioMessage(spaceId, formData);

            // Replace optimistic message with the real one
            setSpace((prev: any) => ({
                ...prev,
                content_state: {
                    ...prev.content_state,
                    messages: (prev?.content_state?.messages || []).map((m: any) =>
                        m.id === tempId ? message : m
                    )
                }
            }));

            showToast(t('audio_message_sent_msg'), 'success');
        } catch (error) {
            console.error('Failed to send audio message:', error);
            showToast(t('failed_send_audio_msg'), 'error');

            // Remove optimistic message on error
            setSpace((prev: any) => ({
                ...prev,
                content_state: {
                    ...prev.content_state,
                    messages: (prev?.content_state?.messages || []).filter((m: any) => m.id !== tempId)
                }
            }));
        } finally {
            setAudioIsUploading(false);
        }
    }, [spaceId, currentUserId, setSpace, collaborationService, showToast, setAudioIsUploading]);

    useEffect(() => {
        onRecordingCompleteRef.current = onRecordingCompleteCallback;
    }, [onRecordingCompleteCallback]);

    const handleAudioPress = () => {
        if (isRecording || isPaused) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // ─── Recording UI Animations ───
    const recordingPulseScale = useSharedValue(1);

    useEffect(() => {
        if (isRecording && !isPaused) {
            recordingPulseScale.value = withTiming(1.3, { duration: 600 }, (finished) => {
                if (finished) {
                    recordingPulseScale.value = withTiming(1, { duration: 600 });
                }
            });

            const interval = setInterval(() => {
                recordingPulseScale.value = withTiming(1.3, { duration: 600 }, (finished) => {
                    if (finished) {
                        recordingPulseScale.value = withTiming(1, { duration: 600 });
                    }
                });
            }, 1200);

            return () => clearInterval(interval);
        } else {
            recordingPulseScale.value = withTiming(1);
        }
    }, [isRecording, isPaused]);

    const recordingPulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: recordingPulseScale.value }],
        opacity: isPaused ? 0.5 : 1
    }));

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

    const hydrateSpace = useCollaborationStore(state => state.hydrateSpace);

    useEffect(() => {
        if (spaceId) {
            hydrateSpace(spaceId);
        }
    }, [spaceId, hydrateSpace]);

    const handleSendMessage = useCallback(async () => {
        if (!content.trim() || !space) return;

        const trimmed = content.trim();
        setContent('');

        try {
            const message = await collaborationService.sendMessage(spaceId, {
                content: trimmed,
                type: 'text',
                reply_to_id: replyingTo?.id,
            }) as any;

            setReplyingTo(null);

            setSpace((prev: any) => {
                const msgs = prev?.content_state?.messages || [];
                // ✅ FIX: Prevent duplicates if real-time event arrived before API response
                if (msgs.some((m: any) => m.id === message.id)) {
                    return prev;
                }

                const updatedSpace = {
                    ...prev,
                    content_state: {
                        ...prev.content_state,
                        messages: [...msgs, message]
                    },
                    updated_at: new Date().toISOString()
                };

                // ✅ Sync with global store to trigger list re-ordering
                useCollaborationStore.getState().updateSpace(spaceId, {
                    updated_at: updatedSpace.updated_at,
                    content_state: updatedSpace.content_state
                });

                return updatedSpace;
            });

            if (message.user_id !== currentUserId) {
                useCollaborationStore.getState().incrementUnreadCount(spaceId);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            // Restore content on error
            setContent(trimmed);
        }
    }, [content, space, spaceId, currentUserId, collaborationService, showToast, replyingTo, setAudioIsUploading, setReplyingTo, setContent]);

    const handleJoin = async () => {
        setIsJoining(true);
        try {
            const { participation, space: joinedSpace } = await collaborationService.joinSpace(spaceId);

            // ✅ Update global store immediately
            useCollaborationStore.getState().addSpace(joinedSpace);

            setSpace((prev: any) => ({
                ...prev,
                ...joinedSpace, // Comprehensive update
                my_participation: participation,
                my_permissions: participation.permissions,
                my_role: participation.role,
            }));

            // ✅ Clear all local notifications related to this space (binding Join & Accept)
            useNotificationStore.getState().removeSpaceNotifications(spaceId);

            if (Platform.OS !== 'web') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            // No alert needed for success if participation is instant
        } catch (error) {
            console.error('Error joining space:', error);
            showToast(t('failed_join_space_msg'), 'error');
        } finally {
            setIsJoining(false);
        }
    };

    const handleShareLocation = async (location: LocationData) => {
        try {
            const message = await collaborationService.sendMessage(spaceId, {
                content: location.address || t('shared_location'),
                type: 'location',
                metadata: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    name: location.name,
                    address: location.address,
                    isLive: false,
                },
                reply_to_id: replyingTo?.id,
            }) as any;

            setReplyingTo(null);
            setSpace((prev: any) => ({
                ...prev,
                content_state: {
                    ...prev.content_state,
                    messages: [...(prev?.content_state?.messages || []), message]
                }
            }));
        } catch (error) {
            console.error('Error sharing location:', error);
            showToast(t('failed_share_location_msg'), 'error');
        }
    };

    const handleShareLiveLocation = async (location: LocationData, duration: number) => {
        try {
            const message = await collaborationService.sendMessage(spaceId, {
                content: t('live_location_duration').replace('{duration}', duration.toString()),
                type: 'live_location',
                metadata: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    isLive: true,
                    liveDuration: duration,
                    expiresAt: new Date(Date.now() + duration * 60 * 1000).toISOString(),
                },
                reply_to_id: replyingTo?.id,
            }) as any;

            setReplyingTo(null);
            setSpace((prev: any) => ({
                ...prev,
                content_state: {
                    ...prev.content_state,
                    messages: [...(prev?.content_state?.messages || []), message]
                }
            }));
        } catch (error) {
            console.error('Error sharing live location:', error);
            showToast(t('failed_share_live_location_msg'), 'error');
        }
    };

    /** Unread poll count badge */
    const pollCount = polls.length;

    return (
        <>
            <View style={styles.chatContainer}>
                {/* ─── Chat header bar with Poll shortcut ─── */}
                {polls.length > 0 && (
                    <TouchableOpacity
                        style={[styles.pollsBanner, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
                        onPress={onNavigateToAllPolls}
                        activeOpacity={0.8}
                    >
                        <View style={styles.pollsBannerLeft}>
                            <Ionicons name="bar-chart" size={16} color={colors.tint} />
                            <Text style={[styles.pollsBannerText, { color: colors.tint }]}>
                                {pollCount} {pollCount !== 1 ? t('active_polls_plural') : t('active_poll_singular')}
                            </Text>
                        </View>
                        <View style={styles.pollsBannerRight}>
                            <Text style={[styles.pollsBannerCta, { color: colors.tint }]}>{t('view_all_btn')}</Text>
                            <Ionicons name="chevron-forward" size={14} color={colors.tint} />
                        </View>
                    </TouchableOpacity>
                )}

                {/* ─── Message List ─── */}
                {(() => {
                    const myParticipation = space?.my_participation || (space?.participations ? space.participations[0] : null);
                    const isPending = myParticipation?.role === 'pending';

                    return (
                        <MessageList
                            spaceId={spaceId}
                            currentUserId={currentUserId}
                            polls={polls}
                            participants={participants}
                            onReply={(msg) => setReplyingTo(msg)}
                            highlightMessageId={highlightMessageId}
                            lastReadAt={
                                (space?.my_participation as any)?.last_read_at ??
                                (space?.my_permissions as any)?.last_read_at ??
                                (space?.my_participation as any)?.last_active_at ??
                                null
                            }
                            onPollPress={() => { }} // No-op now that polls are inline
                            onStartCall={onStartCall}
                            isPending={isPending}
                            spaceType={space?.space_type}
                            messages={(space?.content_state as any)?.messages || []}
                        />
                    );
                })()}

                {/* ─── Reply Preview ─── */}
                {replyingTo && (
                    <View style={styles.replyPreviewContainer}>
                        <View style={styles.replyPreviewBar} />
                        <View style={styles.replyPreviewContent}>
                            <Text style={styles.replyPreviewName} numberOfLines={1}>
                                {(replyingTo as any).user_name || replyingTo.user?.name || t('user_fallback')}
                            </Text>
                            <Text style={[styles.replyPreviewText, { color: colors.text }]} numberOfLines={1}>
                                {replyingTo.content}
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

                {/* ─── Input Bar / Join Bar ─── */}
                {(() => {
                    const myParticipation = space?.my_participation || (space?.participations ? space.participations[0] : null);
                    const isParticipant = !!myParticipation;
                    const isPending = myParticipation?.role === 'pending';
                    const isChannel = space?.space_type === 'channel';
                    const isGeneral = space?.space_type === 'general';
                    const isDirect = space?.space_type === 'direct' || space?.space_type === 'chat';
                    const isAdmin = ['owner', 'moderator', 'admin'].includes(myParticipation?.role || currentUserRole || '');
                    const permissions = space?.my_permissions || (myParticipation as any)?.permissions || {};
                    const canWrite = permissions.write !== false;

                    // Case 1: Not joined a public space or Pending participation
                    if ((!myParticipation && (isChannel || isGeneral)) || isPending) {
                        const btnText = isDirect ? t('accept_message_request_btn') : isChannel ? t('join_channel_btn') : t('join_space');
                        const hintText = isDirect ? t('accept_request_hint') : isChannel ? t('join_channel_hint') : t('must_join_to_send_msg');

                        return (
                            <View style={styles.joinBarContainer}>
                                <TouchableOpacity
                                    style={styles.joinButton}
                                    onPress={handleJoin}
                                    disabled={isJoining}
                                >
                                    {isJoining ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name={isChannel ? "add-circle" : "enter"} size={20} color="#fff" />
                                            <Text style={styles.joinButtonText}>
                                                {btnText}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                                <Text style={styles.joinHint}>
                                    {hintText}
                                </Text>
                            </View>
                        );
                    }

                    // Case 2: Joined but no write permission (Muted/Channel non-admin)
                    if (!canWrite || (isChannel && !isAdmin)) {
                        const readonlyText = isChannel ? t('only_admins_post_msg') : t('no_permission_send_msg');
                        return (
                            <View style={styles.adminOnlyBar}>
                                <Ionicons name="lock-closed" size={16} color="#8E8E93" />
                                <Text style={styles.adminOnlyText}>{readonlyText}</Text>
                            </View>
                        );
                    }

                    // Default Case: Standard Chat Input (Joined or Private Space)
                    return (
                        <View style={{ width: '100%' }}>
                            {(isRecording || isPaused) && (
                                <View style={styles.recordingOverlay}>
                                    <TouchableOpacity
                                        style={styles.discardButton}
                                        onPress={cancelRecording}
                                        activeOpacity={0.7}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                                    </TouchableOpacity>

                                    <View style={styles.recordingCenterSection}>
                                        {isPaused ? (
                                            <TouchableOpacity
                                                onPress={previewStatus.playing ? pausePreview : playPreview}
                                                style={styles.previewPlayButton}
                                            >
                                                <Ionicons
                                                    name={previewStatus.playing ? "pause" : "play"}
                                                    size={24}
                                                    color="#007AFF"
                                                />
                                            </TouchableOpacity>
                                        ) : (
                                            <AnimatedRN.View style={[styles.recordingPulse, recordingPulseStyle]} />
                                        )}

                                        <View style={{ flex: 1, height: 40, justifyContent: 'center' }}>
                                            {isPaused ? (
                                                <AudioSeeker
                                                    progress={displayProgress}
                                                    duration={effectiveDuration}
                                                    onSeek={seekPreview}
                                                    onSeekingChange={setIsSeeking}
                                                    isCurrentUser={true}
                                                    metering={meteringData}
                                                    color="rgba(0, 122, 255, 0.1)"
                                                    activeColor="#007AFF"
                                                />
                                            ) : (
                                                <Text style={styles.recordingTimerText}>
                                                    {formatDuration(recordingDuration)}
                                                </Text>
                                            )}
                                        </View>

                                        <TouchableOpacity
                                            style={styles.pauseResumeButton}
                                            onPress={isPaused ? resumeRecording : pauseRecording}
                                            activeOpacity={0.7}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Ionicons
                                                name={isPaused ? "mic" : "pause-circle"}
                                                size={isPaused ? 26 : 30}
                                                color={isPaused ? "#8E8E93" : "#007AFF"}
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.sendRecordingButton}
                                        onPress={stopRecording}
                                        activeOpacity={0.8}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Ionicons name="send" size={20} color="#fff" style={styles.sendIcon} />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <AnimatedRN.View style={[styles.chatInputContainer, { borderTopColor: colors.border }, animatedInputStyle]}>
                                <View style={styles.attachActions}>
                                    <TouchableOpacity
                                        onPress={() => setShowAttachmentPicker(!showAttachmentPicker)}
                                        style={styles.actionButton}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons
                                            name={showAttachmentPicker ? "close" : "attach"}
                                            size={24}
                                            color={colors.tint}
                                        />
                                    </TouchableOpacity>
                                </View>

                                <TextInput
                                    style={[styles.messageInput, { backgroundColor: colors.muted, color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
                                    placeholder={isRecording ? t('recording_status_dot') : t('message_in_space_placeholder').replace('{title}', space?.title || t('space_fallback'))}
                                    value={content}
                                    onChangeText={setContent}
                                    multiline
                                    maxLength={2000}
                                    placeholderTextColor={colors.textSecondary + '80'}
                                    returnKeyType="default"
                                    blurOnSubmit={false}
                                    onFocus={() => setShowAttachmentPicker(false)}
                                    editable={!isRecording}
                                    keyboardAppearance={activeScheme}
                                />

                                <TouchableOpacity
                                    style={[
                                        styles.sendButton,
                                        !content.trim() && !isRecording && { backgroundColor: '#FF9500' },
                                        audioIsUploading && { opacity: 0.7 }
                                    ]}
                                    onPress={content.trim() ? handleSendMessage : handleAudioPress}
                                    disabled={audioIsUploading}
                                    activeOpacity={0.8}
                                >
                                    {audioIsUploading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Ionicons
                                            name={content.trim() ? "send" : (isRecording ? "stop" : "mic")}
                                            size={content.trim() ? 18 : 22}
                                            color="#fff"
                                            style={content.trim() && styles.sendIcon}
                                        />
                                    )}
                                </TouchableOpacity>
                            </AnimatedRN.View>
                        </View>
                    );
                })()}
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
                    } else if (action === 'location') {
                        setShowLocationPicker(true);
                    } else {
                        showToast(t('coming_soon_action').replace('{action}', action), 'info');
                    }
                }}
            />

            <ShareLocation
                visible={showLocationPicker}
                onClose={() => setShowLocationPicker(false)}
                onShareLocation={handleShareLocation}
                onShareLiveLocation={handleShareLiveLocation}
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

                        const message = await collaborationService.sendMessage(spaceId, messageData) as any;

                        setSpace((prev: any) => ({
                            ...prev,
                            content_state: {
                                ...prev.content_state,
                                messages: [...(prev?.content_state?.messages || []), message]
                            }
                        }));

                        if ((message as any).user_id !== currentUserId) {
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

function getStyles(colors: any, activeScheme: string, isRTL: boolean) {
    return RNStyleSheet.create({
        chatContainer: {
            flex: 1,
        },
        /* ── Polls banner ── */
        pollsBanner: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderBottomWidth: 1,
        },
        pollsBannerLeft: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 6,
        },
        pollsBannerText: {
            fontSize: 13,
            fontWeight: '600',
            color: '#007AFF',
        },
        pollsBannerRight: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
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
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-end',
            paddingHorizontal: 8,
            paddingVertical: 8,
            borderTopWidth: 1,
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
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'ios' ? 10 : 8,
            paddingBottom: Platform.OS === 'ios' ? 10 : 8,
            marginHorizontal: 6,
            fontSize: 15,
            maxHeight: 120,
            lineHeight: 20,
            textAlign: isRTL ? 'right' : 'left',
        },
        sendButton: {
            backgroundColor: '#007AFF',
            width: 42,
            height: 42,
            borderRadius: 21,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 1,
            [isRTL ? 'paddingRight' : 'paddingLeft']: 2,
        },
        sendIcon: {
            transform: [{ rotate: isRTL ? '165deg' : '-15deg' }],
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
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '80%',
            ...createShadow({ width: 0, height: -4, opacity: activeScheme === 'dark' ? 0.3 : 0.12, radius: 20, elevation: 20 }),
            overflow: 'hidden',
        },
        sheetHeader: {
            paddingTop: 10,
            paddingBottom: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        sheetHandle: {
            width: 36,
            height: 4,
            backgroundColor: activeScheme === 'dark' ? colors.border : '#d0d0d0',
            borderRadius: 2,
            alignSelf: 'center',
            marginBottom: 12,
        },
        sheetTitleRow: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
        },
        sheetTitle: {
            flex: 1,
            fontSize: 17,
            fontWeight: '700',
            color: colors.text,
        },
        sheetCloseBtn: {
            padding: 4,
            borderRadius: 14,
            backgroundColor: colors.muted,
        },
        /* ── Reply Preview Styles ── */
        replyPreviewContainer: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
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
            color: colors.textSecondary,
            textAlign: isRTL ? 'right' : 'left',
        },
        replyPreviewClose: {
            padding: 4,
        },
        /* ── Join / Admin Only Bars ── */
        joinBarContainer: {
            padding: 16,
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 10,
        },
        joinButton: {
            backgroundColor: '#007AFF',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 25,
            gap: 8,
            width: '100%',
            ...createShadow({ width: 0, height: 2, opacity: 0.1, radius: 4, elevation: 3 }),
        },
        joinButtonText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '700',
        },
        joinHint: {
            fontSize: 13,
            color: '#8E8E93',
            textAlign: 'center',
        },
        adminOnlyBar: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.muted,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 8,
        },
        adminOnlyText: {
            fontSize: 14,
            color: '#8E8E93',
            fontWeight: '500',
        },
        recordingOverlay: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            borderRadius: 25,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginHorizontal: 10,
            marginBottom: 8,
            borderWidth: activeScheme === 'dark' ? 1 : 0,
            borderColor: colors.border,
            ...createShadow({ width: 0, height: 2, opacity: 0.1, radius: 8, elevation: 5 }),
        },
        recordingCenterSection: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
        },
        recordingPulse: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#FF3B30',
        },
        recordingTimerText: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            width: 45,
            textAlign: 'center',
        },
        discardButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: activeScheme === 'dark' ? 'rgba(255, 59, 48, 0.15)' : '#FFE5E5',
            justifyContent: 'center',
            alignItems: 'center',
        },
        pauseResumeButton: {
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
        },
        previewPlayButton: {
            width: 32,
            height: 32,
            justifyContent: 'center',
            alignItems: 'center',
        },
        sendRecordingButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#007AFF',
            justifyContent: 'center',
            alignItems: 'center',
        },
    });
}

export default React.memo(SpaceChatTab);
