// components/ChatScreen/SpaceChatTab.tsx
import React, { useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MessageList from './MessageList';
import MediaUploader from '@/services/ChatScreen/MediaUploader';
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
    currentUserRole?: string;
    onNavigateToAllPolls?: () => void;
}

const SpaceChatTab: React.FC<SpaceChatTabProps> = ({
    spaceId,
    currentUserId,
    space,
    setSpace,
    setShowPollCreator,
    polls = [],
    currentUserRole,
    onNavigateToAllPolls,
}) => {
    const [content, setContent] = useState<string>('');
    const [showMediaUploader, setShowMediaUploader] = useState(false); // ← now local
    const collaborationService = CollaborationService.getInstance();

    const handleSendMessage = async () => {
        if (!content.trim() || !space) return;

        const trimmed = content.trim();
        setContent('');

        try {
            const message = await collaborationService.sendMessage(spaceId, {
                content: trimmed,
                type: 'text',
            });

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
                    onPollPress={() => { }} // No-op now that polls are inline
                />

                {/* ─── Input Bar ─── */}
                <View style={styles.chatInputContainer}>
                    <View style={styles.attachActions}>
                        <TouchableOpacity
                            onPress={() => setShowMediaUploader(true)}
                            style={styles.actionButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="attach" size={24} color="#007AFF" />
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
                    />

                    <TouchableOpacity
                        style={[styles.sendButton, !content.trim() && styles.sendButtonDisabled]}
                        onPress={handleSendMessage}
                        disabled={!content.trim()}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="send" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* MediaUploader \u2013 fully self-contained inside SpaceChatTab */}
            <MediaUploader
                spaceId={spaceId}
                isVisible={showMediaUploader}
                onClose={() => setShowMediaUploader(false)}
                onUploadComplete={(media) => {
                    console.log('[SpaceChatTab] Media uploaded:', media);
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
});

export default React.memo(SpaceChatTab);
