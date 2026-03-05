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
    Animated,
    Platform,
    Alert,
} from 'react-native';
import AnimatedRN, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import MessageList from './MessageList';
import AdvancedMediaUploader, { AdvancedMediaUploaderRef } from './AdvancedMediaUploader';
import AttachmentPicker from './AttachmentPicker';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { createShadow } from '@/utils/styles';

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

                    <TouchableOpacity
                        style={[styles.sendButton, !content.trim() && { backgroundColor: '#FF9500' }]}
                        onPress={content.trim() ? handleSendMessage : () => Alert.alert('Coming Soon', 'Voice recording features are coming soon!')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name={content.trim() ? "send" : "mic"} size={content.trim() ? 18 : 22} color="#fff" />
                    </TouchableOpacity>
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
});

export default React.memo(SpaceChatTab);
