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
    Alert,                    // ← ADDED
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    const {
        getSpaces,
        markAsRead,
        removeNotification
    } = useNotificationStore();
    
    const { user } = React.useContext(AuthContext);

    const spaces = getSpaces();

    const handleSpacePress = (item: Notification) => {
        if (!item.isRead) {
            markAsRead(item.id);
        }

        if (item.spaceId || item.data?.space_id || item.data?.space?.id) {
            const spaceId = item.spaceId || item.data?.space_id || item.data?.space?.id;
            router.push({
                pathname: '/(spaces)/[id]',
                params: {
                    id: spaceId,
                    ...(item.type === 'space_invitation' ? { justInvited: 'true' } : {})
                }
            });
        }
        onClose();
    };

    const renderSpaceItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.spaceItem, !item.isRead && styles.unreadSpace]}
            onPress={() => handleSpacePress(item)}
        >
            <TouchableOpacity
                style={styles.Foto}
                onPress={(e) => {
                    e.stopPropagation();
                    // Optional: navigate to user profile
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

            <View style={styles.spaceContent}>
                <View style={styles.textContent}>
                    <View style={styles.titleRow}>
                        <View style={styles.titleWithIcon}>
                            <Ionicons
                                name={item.type === 'space_invitation' ? 'people' : 'cube'}
                                size={16}
                                color="#5856D6"
                            />
                            <Text style={styles.spaceTitle}>{item.title}</Text>
                            {useReportedContentStore.getState().isReported('space', item.spaceId || item.data?.space_id || item.data?.space?.id) && (
                                <Ionicons name="flag" size={14} color="#ff4444" style={{ marginLeft: 4 }} />
                            )}
                        </View>
                        <Text style={styles.spaceTime}>
                            {formatTimeAgo(item.createdAt)}
                        </Text>
                    </View>
                    <Text style={styles.spaceMessage}>{item.message}</Text>

                    {(item.data?.space?.title || item.data?.space_title) && (
                        <View style={styles.metadataContainer}>
                            <Ionicons name="cube" size={12} color="#5856D6" />
                            <Text style={styles.metadataText}>
                                {item.data?.space?.title || item.data?.space_title}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* ACCEPT BUTTON - only for space invitations */}
            {item.type === 'space_invitation' && (
                <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={async (e) => {
                        e.stopPropagation();
                        const spaceId = item.spaceId || item.data?.space_id || item.data?.space?.id;
                        if (!spaceId) {
                            Alert.alert('Error', 'Space ID not found');
                            return;
                        }

                        try {
                            const response = await CollaborationService.getInstance().acceptSpaceInvitation(spaceId.toString());

                            markAsRead(item.id);
                            removeNotification(item.id);

                            // Update global store so the UI reflects the new space immediately
                            if (user?.id) {
                                if (response?.space) {
                                    useCollaborationStore.getState().addSpace(response.space);
                                } else {
                                    useCollaborationStore.getState().fetchUserSpaces(Number(user.id));
                                }
                            }

                            router.push({
                                pathname: '/(spaces)/[id]',
                                params: { id: spaceId.toString() }
                            });
                            onClose();
                        } catch (error: any) {
                            console.error('Accept invitation failed:', error);
                            Alert.alert(
                                'Failed to Accept',
                                error.response?.data?.message ||
                                error.message ||
                                'Please try again later.'
                            );
                        }
                    }}
                >
                    <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
            )}

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
                            Spaces {spaces.length > 0 ? `(${spaces.length})` : ''}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                        {spaces.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="cube-outline" size={48} color="#ccc" />
                                <Text style={styles.emptyText}>No space notifications</Text>
                                <Text style={styles.emptySubtext}>
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
        borderBottomColor: '#f5f5f5',
    },
    unreadSpace: {
        backgroundColor: '#f8faff',
        borderLeftWidth: 3,
        borderLeftColor: '#5856D6',
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
        color: '#1a1a1a',
        flex: 1,
    },
    spaceMessage: {
        fontSize: 13,
        color: '#666',
        marginBottom: 6,
        lineHeight: 18,
    },
    spaceTime: {
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
    acceptButton: {
        backgroundColor: '#007AFF',
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

export default SpacesPanel;