// components/Notifications/MessagesPanel.tsx
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
    Modal,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createShadow } from '@/utils/styles';
import { useNotificationStore, getNotificationIcon, getNotificationColor } from '@/stores/notificationStore';
import { Notification } from '@/types/Notification';
import getApiBaseImage from '@/services/getApiBaseImage';
import { router } from 'expo-router';
import { useProfileView } from '@/context/ProfileViewContext';

type MessagesPanelProps = {
    visible: boolean;
    onClose: () => void;
    anchorPosition?: { top: number; left?: number; right?: number; arrowOffset?: number };
};

const MessagesPanel = ({ visible, onClose, anchorPosition }: MessagesPanelProps) => {
    const {
        getMessages,
        markAsRead,
        removeNotification
    } = useNotificationStore();

    const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
    const messages = getMessages();

    const handleMessagePress = (item: Notification) => {
        if (!item.isRead) {
            markAsRead(item.id);
        }

        // ✅ Robust resolution of spaceId and messageId
        const spaceId = item.spaceId
            || item.data?.spaceId
            || item.data?.space_id
            || item.data?.space?.id;

        const messageId = item.messageId
            || item.data?.messageId
            || item.data?.message_id
            || item.data?.message?.id
            || item.data?.replyId;

        if (spaceId) {
            router.push({
                pathname: '/(spaces)/[id]',
                params: {
                    id: spaceId.toString(),
                    tab: 'chat',
                    ...(messageId ? { highlightMessageId: messageId.toString() } : {})
                }
            });
        } else if (item.userId || item.data?.user_id || item.data?.userId) {
            const userId = item.userId || item.data?.user_id || item.data?.userId;
            router.push({
                pathname: '/(tabs)/chats/[id]',
                params: { id: userId.toString() }
            });
        }
        onClose();
    };

    const renderMessageItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.messageItem, !item.isRead && styles.unreadMessage]}
            onPress={() => handleMessagePress(item)}
        >
            <TouchableOpacity
                style={styles.Foto}
                onPress={(e) => {
                    e.stopPropagation();
                    if (item.userId) {
                        setProfileViewUserId(item.userId.toString());
                        setProfilePreviewVisible(true);
                    }
                }}
            >
                <Image
                    source={{
                        uri: item.avatar ? `${getApiBaseImage()}/storage/${item.avatar}` : undefined
                    }}
                    defaultSource={require('@/assets/images/favicon.png')}
                    style={styles.avatar}
                />
            </TouchableOpacity>

            <View style={styles.messageContent}>
                <View style={styles.textContent}>
                    <View style={styles.titleRow}>
                        <View style={styles.titleWithIcon}>
                            <Ionicons
                                name={getNotificationIcon(item.type) as any}
                                size={16}
                                color={getNotificationColor(item.type)}
                            />
                            <Text style={styles.messageTitle}>{item.title}</Text>
                        </View>
                        <Text style={styles.messageTime}>
                            {formatTimeAgo(item.createdAt)}
                        </Text>
                    </View>
                    <Text style={styles.messagePreview}>
                        {typeof item.message === 'string'
                            ? item.message
                            : (item.message as any)?.content
                            ?? (item.message as any)?.text
                            ?? 'New message received'}
                    </Text>

                    {item.data?.space?.title && (
                        <View style={styles.metadataContainer}>
                            <Ionicons name="cube" size={12} color="#5856D6" />
                            <Text style={styles.metadataText}>in {item.data.space.title}</Text>
                        </View>
                    )}
                </View>
            </View>
            <TouchableOpacity
                onPress={() => removeNotification(item.id)}
                style={styles.deleteButton}
            >
                <Ionicons name="close" size={16} color="#999" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={onClose}
            />
            <View
                style={[
                    styles.panelContainer,
                    anchorPosition ? {
                        top: anchorPosition.top + 15,
                        left: anchorPosition.left,
                        right: anchorPosition.right,
                    } : styles.defaultPosition
                ]}
            >
                {/* Pointer Arrow */}
                {anchorPosition && (
                    <View
                        style={[
                            styles.pointer,
                            anchorPosition.right !== undefined
                                ? { right: anchorPosition.arrowOffset }
                                : { left: anchorPosition.arrowOffset }
                        ]}
                    />
                )}

                <View style={styles.contentWrapper}>
                    <View style={styles.panelHeader}>
                        <Text style={styles.panelTitle}>
                            Messages {messages.length > 0 ? `(${messages.length})` : ''}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                        {messages.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
                                <Text style={styles.emptyText}>No message notifications</Text>
                                <Text style={styles.emptySubtext}>
                                    New messages will appear here
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={messages}
                                renderItem={renderMessageItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={styles.messagesList}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    panelContainer: {
        position: 'absolute',
        width: Platform.OS === 'web' ? 400 : 320,
        maxHeight: 500,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        ...createShadow({
            width: 0,
            height: 4,
            opacity: 0.2,
            radius: 12,
            elevation: 8,
        }),
        borderWidth: 1,
        borderColor: '#efefef',
        zIndex: 1000,
    },
    defaultPosition: {
        top: 90,
        left: 16,
        right: 16,
    },
    contentWrapper: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 16,
    },
    pointer: {
        position: 'absolute',
        top: -10,
        width: 20,
        height: 20,
        backgroundColor: '#ffffff',
        transform: [{ rotate: '45deg' }],
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: '#efefef',
        zIndex: -1,
    },
    panelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    panelTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    closeButton: {
        padding: 4,
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
    },
    messagesList: {
        flexGrow: 1,
        paddingVertical: 8,
    },
    messageItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    unreadMessage: {
        backgroundColor: '#f8faff',
        borderLeftWidth: 3,
        borderLeftColor: '#007AFF',
    },
    messageContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    textContent: {
        flex: 1,
        marginLeft: 12,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    titleWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    messageTitle: {
        fontWeight: '600',
        fontSize: 15,
        color: '#1a1a1a',
        flex: 1,
    },
    messagePreview: {
        fontSize: 13,
        color: '#666',
        marginBottom: 6,
        lineHeight: 18,
    },
    messageTime: {
        fontSize: 11,
        color: '#999',
        marginLeft: 8,
    },
    metadataContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    metadataText: {
        fontSize: 11,
        color: '#555',
        fontWeight: '500',
    },
    deleteButton: {
        padding: 6,
        marginLeft: 8,
        borderRadius: 16,
        backgroundColor: '#f5f5f5',
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    emptyText: {
        marginTop: 16,
        color: '#666',
        fontSize: 18,
        fontWeight: '600',
    },
    emptySubtext: {
        marginTop: 8,
        color: '#999',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    Foto: {
        alignSelf: 'flex-start',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
        backgroundColor: '#f0f0f0',
        borderWidth: 2,
        borderColor: '#fff',
    },
});

export default MessagesPanel;