// components/Notifications/ActivitiesPanel.tsx
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
import { useNotificationStore } from '@/stores/notificationStore';
import { Notification } from '@/types/Notification';
import getApiBaseImage from '@/services/getApiBaseImage';
import { router } from 'expo-router';

type ActivitiesPanelProps = {
    visible: boolean;
    onClose: () => void;
    anchorPosition?: { top: number; left?: number; right?: number; arrowOffset?: number };
};

const ActivitiesPanel = ({ visible, onClose, anchorPosition }: ActivitiesPanelProps) => {
    const {
        getActivities,
        markAsRead,
        removeNotification
    } = useNotificationStore();

    const activities = getActivities();

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'participant_joined': return 'person-add';
            case 'magic_event': return 'sparkles';
            case 'screen_share': return 'desktop';
            case 'activity_created': return 'calendar';
            case 'activity_updated': return 'create';
            case 'activity_deleted': return 'trash';
            default: return 'notifications';
        }
    };

    const getActivityColor = (type: string) => {
        switch (type) {
            case 'participant_joined': return '#FF9500';
            case 'magic_event': return '#FF2D55';
            case 'screen_share': return '#5856D6';
            case 'activity_created': return '#FF9500';
            case 'activity_updated': return '#34C759';
            case 'activity_deleted': return '#FF3B30';
            default: return '#8E8E93';
        }
    };

    const handleActivityPress = (item: Notification) => {
        if (!item.isRead) {
            markAsRead(item.id);
        }

        if (item.spaceId || item.data?.space_id) {
            const spaceId = item.spaceId || item.data?.space_id;
            
            // Don't route if activity was deleted, just stay in chat/current view
            if (item.type === 'activity_deleted') {
                router.push({
                    pathname: '/(spaces)/[id]',
                    params: { id: spaceId, tab: 'chat' }
                });
            } else {
                const tab = (item.type === 'activity_created' || item.type === 'activity_updated') ? 'calendar' : 'chat';
                router.push({
                    pathname: '/(spaces)/[id]',
                    params: { id: spaceId, tab }
                });
            }
        }
        onClose();
    };

    const renderActivityItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.activityItem, !item.isRead && styles.unreadActivity]}
            onPress={() => handleActivityPress(item)}
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

            <View style={styles.activityContent}>
                <View style={styles.textContent}>
                    <View style={styles.titleRow}>
                        <View style={styles.titleWithIcon}>
                            <Ionicons
                                name={getActivityIcon(item.type)}
                                size={16}
                                color={getActivityColor(item.type)}
                            />
                            <Text style={styles.activityTitle}>{item.title}</Text>
                        </View>
                        <Text style={styles.activityTime}>
                            {formatTimeAgo(item.createdAt)}
                        </Text>
                    </View>
                    <Text style={styles.activityMessage}>{item.message}</Text>
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
                            Activities {activities.length > 0 ? `(${activities.length})` : ''}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                        {activities.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="sparkles-outline" size={48} color="#ccc" />
                                <Text style={styles.emptyText}>No activity notifications</Text>
                                <Text style={styles.emptySubtext}>
                                    Magic events and activities will appear here
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={activities}
                                renderItem={renderActivityItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={styles.activitiesList}
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
    activitiesList: {
        flexGrow: 1,
        paddingVertical: 8,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    unreadActivity: {
        backgroundColor: '#f8faff',
        borderLeftWidth: 3,
        borderLeftColor: '#FF2D55',
    },
    activityContent: {
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
    activityTitle: {
        fontWeight: '600',
        fontSize: 15,
        color: '#1a1a1a',
        flex: 1,
    },
    activityMessage: {
        fontSize: 13,
        color: '#666',
        marginBottom: 6,
        lineHeight: 18,
    },
    activityTime: {
        fontSize: 11,
        color: '#999',
        marginLeft: 8,
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

export default ActivitiesPanel;