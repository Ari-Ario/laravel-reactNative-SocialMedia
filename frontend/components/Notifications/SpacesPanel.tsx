// components/Notifications/SpacesPanel.tsx
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
    Modal,
    Platform,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { createShadow } from '@/utils/styles';
import { useNotificationStore } from '@/stores/notificationStore';
import { Notification } from '@/types/Notification';
import getApiBaseImage from '@/services/getApiBaseImage';
import { router } from 'expo-router';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import AuthContext from '@/context/AuthContext';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useReportedContentStore } from '@/stores/reportedContentStore';

type SpacesPanelProps = {
    visible: boolean;
    onClose: () => void;
    anchorPosition?: { top: number; left?: number; right?: number; arrowOffset?: number };
};

const SpacesPanel = ({ visible, onClose, anchorPosition }: SpacesPanelProps) => {
    const { colors, activeScheme } = useAppTheme();
    const {
        getSpaces,
        markAsRead,
        removeNotification
    } = useNotificationStore();
    const { refreshCollaborations } = useCollaborationStore();

    const spaces = getSpaces();

    const handleSpacePress = (item: Notification) => {
        if (!item.isRead) {
            markAsRead(item.id);
        }

        if (item.spaceId || item.data?.space_id) {
            const spaceId = item.spaceId || item.data?.space_id;
            router.push({
                pathname: '/(spaces)/[id]',
                params: { id: spaceId }
            });
        }
        onClose();
    };

    const handleAcceptInvitation = async (item: Notification) => {
        if (!item.spaceId && !item.data?.space_id) return;
        const spaceId = item.spaceId || item.data?.space_id;

        try {
            await CollaborationService.respondToInvitation(spaceId, 'accepted');
            await refreshCollaborations();
            markAsRead(item.id);
            Alert.alert('Success', 'You have joined the space');
            handleSpacePress(item);
        } catch (error) {
            console.error('Error accepting invitation:', error);
            Alert.alert('Error', 'Failed to accept invitation');
        }
    };

    const renderSpaceItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[
                styles.spaceItem, 
                { borderBottomColor: colors.border },
                !item.isRead && styles.unreadSpace,
                !item.isRead && { backgroundColor: colors.primary + '10', borderLeftColor: colors.primary }
            ]}
            onPress={() => handleSpacePress(item)}
        >
            <View style={styles.Foto}>
                <Image
                    source={{
                        uri: item.avatar ? `${getApiBaseImage()}/storage/${item.avatar}` : undefined
                    }}
                    defaultSource={require('@/assets/images/favicon.png')}
                    style={[styles.avatar, { borderColor: colors.surface, backgroundColor: colors.muted }]}
                />
            </View>

            <View style={styles.spaceContent}>
                <View style={styles.textContent}>
                    <View style={styles.titleRow}>
                        <View style={styles.titleWithIcon}>
                            <Ionicons
                                name={item.type === 'space_invitation' ? 'mail-outline' : 'cube-outline'}
                                size={16}
                                color={item.type === 'space_invitation' ? colors.primary : colors.textSecondary}
                            />
                            <Text style={[styles.spaceTitle, { color: colors.text }]}>{item.title}</Text>
                        </View>
                        <Text style={[styles.spaceTime, { color: colors.textSecondary }]}>
                            {formatTimeAgo(item.createdAt)}
                        </Text>
                    </View>
                    <Text style={[styles.spaceMessage, { color: colors.textSecondary }]}>{item.message}</Text>
                    
                    {item.type === 'space_invitation' && !item.isRead && (
                        <View style={{ flexDirection: 'row', marginTop: 8 }}>
                            <TouchableOpacity
                                style={[styles.acceptButton, { backgroundColor: colors.primary }]}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleAcceptInvitation(item);
                                }}
                            >
                                <Text style={styles.acceptButtonText}>Accept</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation();
                        removeNotification(item.id);
                    }}
                    style={[styles.deleteButton, { backgroundColor: colors.muted }]}
                >
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

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
            >
                {Platform.OS === 'web' && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent', backdropFilter: 'blur(4px)' }]} />}
            </TouchableOpacity>
            <View
                style={[
                    styles.panelContainer,
                    { backgroundColor: colors.surface, borderColor: colors.border },
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
                            { backgroundColor: colors.surface, borderColor: colors.border },
                            anchorPosition.right !== undefined
                                ? { right: anchorPosition.arrowOffset }
                                : { left: anchorPosition.arrowOffset }
                        ]}
                    />
                )}

                <View style={styles.contentWrapper}>
                    <View style={[styles.panelHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
                        <Text style={[styles.panelTitle, { color: colors.text }]}>
                            Spaces {spaces.length > 0 ? `(${spaces.length})` : ''}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.muted }]}>
                            <Ionicons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                        {spaces.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="cube-outline" size={48} color={colors.textSecondary + '40'} />
                                <Text style={[styles.emptyText, { color: colors.text }]}>No space notifications</Text>
                                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                                    Space invitations and updates will appear here
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={spaces}
                                renderItem={renderSpaceItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={styles.spacesList}
                                showsVerticalScrollIndicator={false}
                                indicatorStyle={activeScheme === 'dark' ? 'white' : 'black'}
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
    },
    panelContainer: {
        position: 'absolute',
        width: Platform.OS === 'web' ? 400 : 320,
        maxHeight: 500,
        borderRadius: 16,
        ...createShadow({
            width: 0,
            height: 4,
            opacity: 0.2,
            radius: 12,
            elevation: 8,
        }),
        borderWidth: 1,
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
        transform: [{ rotate: '45deg' }],
        borderTopWidth: 1,
        borderLeftWidth: 1,
        zIndex: -1,
    },
    panelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    panelTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    closeButton: {
        padding: 4,
        borderRadius: 20,
    },
    spacesList: {
        flexGrow: 1,
        paddingVertical: 8,
    },
    spaceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    unreadSpace: {
        borderLeftWidth: 3,
    },
    spaceContent: {
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
    spaceTitle: {
        fontWeight: '600',
        fontSize: 15,
        flex: 1,
    },
    spaceMessage: {
        fontSize: 13,
        marginBottom: 6,
        lineHeight: 18,
    },
    spaceTime: {
        fontSize: 11,
        marginLeft: 8,
    },
    metadataContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    metadataText: {
        fontSize: 11,
        fontWeight: '500',
    },
    deleteButton: {
        padding: 6,
        marginLeft: 8,
        borderRadius: 16,
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptButton: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
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
        fontSize: 18,
        fontWeight: '600',
    },
    emptySubtext: {
        marginTop: 8,
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
        borderWidth: 2,
    },
});

export default SpacesPanel;