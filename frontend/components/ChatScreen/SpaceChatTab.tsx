import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MessageList from './MessageList';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { useCollaborationStore } from '@/stores/collaborationStore';

interface SpaceChatTabProps {
    spaceId: string;
    currentUserId: number;
    space: any;
    setSpace: React.Dispatch<React.SetStateAction<any>>;
    setShowMediaUploader: (show: boolean) => void;
    setShowPollCreator: (show: boolean) => void;
}

const SpaceChatTab: React.FC<SpaceChatTabProps> = ({
    spaceId,
    currentUserId,
    space,
    setSpace,
    setShowMediaUploader,
    setShowPollCreator,
}) => {
    const [content, setContent] = useState<string>('');
    const collaborationService = CollaborationService.getInstance();

    const handleSendMessage = async () => {
        if (!content.trim() || !space) return;

        try {
            const message = await collaborationService.sendMessage(spaceId, {
                content: content.trim(),
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

            setContent('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    return (
        <View style={styles.chatContainer}>
            <MessageList
                spaceId={spaceId}
                currentUserId={currentUserId}
            />

            <View style={styles.chatInputContainer}>
                <View style={styles.attachActions}>
                    <TouchableOpacity
                        onPress={() => setShowMediaUploader(true)}
                        style={styles.actionButton}
                    >
                        <Ionicons name="attach" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setShowPollCreator(true)}
                        style={styles.actionButton}
                    >
                        <Ionicons name="bar-chart" size={24} color="#007AFF" />
                    </TouchableOpacity>
                </View>

                <TextInput
                    style={styles.messageInput}
                    placeholder={`Message in ${space?.title || 'space'}...`}
                    value={content}
                    onChangeText={setContent}
                    multiline
                    maxLength={500}
                    placeholderTextColor="#999"
                />

                <TouchableOpacity
                    style={[styles.sendButton, !content.trim() && styles.sendButtonDisabled]}
                    onPress={handleSendMessage}
                    disabled={!content.trim()}
                >
                    <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    chatContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    chatInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    messageInput: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginHorizontal: 8,
        fontSize: 16,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: '#007AFF',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#ccc',
    },
    attachActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 6,
    },
});

export default React.memo(SpaceChatTab);
