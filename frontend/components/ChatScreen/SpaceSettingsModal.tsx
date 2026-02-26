// components/ChatScreen/SpaceSettingsModal.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    ScrollView,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Image,
    FlatList,
    Linking,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';

interface SpaceSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    space: any;
    participants: any[];
    currentUserRole?: string;
    onSpaceUpdated: (updatedSpace: any) => void;
    onParticipantRoleChanged?: (participantId: number, newRole: string) => void;
    onParticipantRemoved?: (participantId: number) => void;
}

type SettingsTab = 'general' | 'participants' | 'media' | 'danger';

const SpaceSettingsModal: React.FC<SpaceSettingsModalProps> = ({
    visible,
    onClose,
    space,
    participants,
    currentUserRole = 'participant',
    onSpaceUpdated,
    onParticipantRoleChanged,
    onParticipantRemoved,
}) => {
    const collaborationService = CollaborationService.getInstance();

    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [editingTitle, setEditingTitle] = useState(space?.title || '');
    const [editingDescription, setEditingDescription] = useState(space?.description || '');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [spacePhoto, setSpacePhoto] = useState<string | null>(space?.avatar || null);
    const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
    const [showRoleSheet, setShowRoleSheet] = useState(false);

    const isOwnerOrModerator = currentUserRole === 'owner' || currentUserRole === 'moderator';
    const isOwner = currentUserRole === 'owner';

    // ─── Media state ─────────────────────────────────────────────────────────────
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [deletingMediaId, setDeletingMediaId] = useState<number | null>(null);

    const fetchMedia = useCallback(async () => {
        setLoadingMedia(true);
        try {
            const token = await getToken();
            const res = await fetch(`${getApiBase()}/spaces/${space.id}/media`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setMediaItems(data.media ?? []);
        } catch {
            // silently fail — list stays empty
        } finally {
            setLoadingMedia(false);
        }
    }, [space?.id]);

    useEffect(() => {
        if (activeTab === 'media' && visible) {
            fetchMedia();
        }
    }, [activeTab, visible, fetchMedia]);

    // ─── Media Tab ────────────────────────────────────────────────────────────────

    const handleDeleteMedia = async (item: any) => {
        Alert.alert('Delete File', `Delete "${item.file_name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    setDeletingMediaId(item.id);
                    try {
                        const token = await getToken();
                        const res = await fetch(`${getApiBase()}/spaces/${space.id}/media/${item.id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (res.ok) {
                            setMediaItems(prev => prev.filter(m => m.id !== item.id));
                            if (Platform.OS !== 'web') {
                                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                        } else {
                            Alert.alert('Error', 'Could not delete file');
                        }
                    } catch {
                        Alert.alert('Error', 'Network error');
                    } finally {
                        setDeletingMediaId(null);
                    }
                },
            },
        ]);
    };

    const mediaTypeConfig: Record<string, { icon: any; color: string }> = {
        image: { icon: 'image', color: '#34C759' },
        video: { icon: 'videocam', color: '#AF52DE' },
        audio: { icon: 'musical-notes', color: '#FF2D55' },
        document: { icon: 'document-text', color: '#FF9500' },
    };

    const formatBytes = (bytes: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    const renderMediaTab = () => (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.mediaContainer}>
            {loadingMedia ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
            ) : mediaItems.length === 0 ? (
                <View style={styles.mediaEmpty}>
                    <Ionicons name="cloud-upload-outline" size={56} color="#ccc" />
                    <Text style={styles.mediaEmptyTitle}>No files yet</Text>
                    <Text style={styles.mediaEmptySub}>Files uploaded in this space will appear here.</Text>
                </View>
            ) : (
                <View style={styles.mediaGrid}>
                    {mediaItems.map((item) => {
                        const isImg = item.type === 'image';
                        const cfg = mediaTypeConfig[item.type] ?? mediaTypeConfig.document;
                        const isDel = deletingMediaId === item.id;
                        return (
                            <View key={item.id} style={styles.mediaCard}>
                                {/* Thumbnail or icon */}
                                {isImg && item.url ? (
                                    <Image source={{ uri: item.url }} style={styles.mediaThumb} resizeMode="cover" />
                                ) : (
                                    <View style={[styles.mediaThumb, styles.mediaIconBg, { backgroundColor: cfg.color + '22' }]}>
                                        <Ionicons name={cfg.icon} size={32} color={cfg.color} />
                                    </View>
                                )}
                                {/* Info */}
                                <View style={styles.mediaCardInfo}>
                                    <Text style={styles.mediaFileName} numberOfLines={2}>{item.file_name}</Text>
                                    <Text style={styles.mediaMeta}>
                                        {formatBytes(item.file_size)} · {item.uploader?.name ?? 'Unknown'}
                                    </Text>
                                </View>
                                {/* Actions */}
                                <View style={styles.mediaActions}>
                                    <TouchableOpacity
                                        onPress={() => item.url && Linking.openURL(item.url)}
                                        style={styles.mediaActionBtn}
                                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                                    >
                                        {isDel
                                            ? <ActivityIndicator size="small" color="#FF3B30" />
                                            : <Ionicons name="open-outline" size={20} color="#007AFF" />}
                                    </TouchableOpacity>
                                    {isOwnerOrModerator && (
                                        <TouchableOpacity
                                            onPress={() => handleDeleteMedia(item)}
                                            style={[styles.mediaActionBtn, { marginTop: 6 }]}
                                            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                                            disabled={isDel}
                                        >
                                            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );

    // ─── General Settings ────────────────────────────────────────────────────────

    const handleSave = useCallback(async () => {
        if (!editingTitle.trim()) {
            Alert.alert('Validation', 'Space name cannot be empty.');
            return;
        }

        setSaving(true);
        try {
            const updated = await collaborationService.updateSpace(space.id, {
                title: editingTitle.trim(),
                description: editingDescription.trim(),
            });
            onSpaceUpdated(updated);
            if (Platform.OS !== 'web') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert('Saved', 'Space settings updated successfully.');
            onClose();
        } catch (err) {
            console.error('[SpaceSettings] Save error:', err);
            Alert.alert('Error', 'Could not save settings. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [editingTitle, editingDescription, space?.id]);

    // ─── Photo Upload (Web-safe, CORS-fixed) ─────────────────────────────────────

    const pickFromGallery = useCallback(async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('Permission Required', 'Allow access to your photo library.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
            });
            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                await uploadPhotoNative(asset.uri, asset.mimeType || 'image/jpeg');
            }
        } catch (err) {
            console.error('[SpaceSettings] Gallery pick error:', err);
            Alert.alert('Error', 'Could not open gallery.');
        }
    }, [space?.id]);

    const pickFromCamera = useCallback(async () => {
        try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('Permission Required', 'Allow camera access to take a photo.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
            });
            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                await uploadPhotoNative(asset.uri, asset.mimeType || 'image/jpeg');
            }
        } catch (err) {
            console.error('[SpaceSettings] Camera pick error:', err);
            Alert.alert('Error', 'Could not open camera.');
        }
    }, [space?.id]);

    const handlePickPhoto = useCallback(async () => {
        if (Platform.OS === 'web') {
            // On web: trigger native OS file dialog directly — no custom popup
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (event: any) => {
                const file = event.target?.files?.[0];
                if (file) await uploadPhotoFile(file);
            };
            input.click();
            return;
        }

        // Native: system Alert with two choices — no custom menu component needed
        Alert.alert('Upload Space Photo', 'Choose a source', [
            { text: 'Camera', onPress: pickFromCamera },
            { text: 'Photo Library', onPress: pickFromGallery },
            { text: 'Cancel', style: 'cancel' },
        ]);
    }, [pickFromGallery, pickFromCamera]);

    const uploadPhotoNative = async (uri: string, mimeType: string) => {
        setUploading(true);
        try {
            const token = await getToken();
            if (!token) throw new Error('No auth token');

            const API_BASE = getApiBase();
            const formData = new FormData();
            formData.append('file', {
                uri,
                type: mimeType,
                name: `space_photo_${Date.now()}.jpg`,
            } as any);
            formData.append('type', 'image');

            const res = await fetch(`${API_BASE}/spaces/${space.id}/upload-media`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    // Do NOT set Content-Type manually for multipart – browser fills it in automatically
                },
                body: formData,
            });

            if (!res.ok) {
                const body = await res.text();
                throw new Error(`Upload failed (${res.status}): ${body}`);
            }

            const data = await res.json();
            const photoUrl = data?.media?.url || data?.url || data?.path || null;
            if (photoUrl) {
                setSpacePhoto(photoUrl);
                onSpaceUpdated({ ...space, avatar: photoUrl });
            }

            if (Platform.OS !== 'web') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert('Success', 'Space photo updated!');
        } catch (err: any) {
            console.error('[SpaceSettings] Upload error:', err);
            Alert.alert('Upload Failed', err.message || 'Could not upload image. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const uploadPhotoFile = async (file: File) => {
        setUploading(true);
        try {
            const token = await getToken();
            if (!token) throw new Error('No auth token');

            const API_BASE = getApiBase();
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'image');

            const res = await fetch(`${API_BASE}/spaces/${space.id}/upload-media`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!res.ok) {
                const body = await res.text();
                throw new Error(`Upload failed (${res.status}): ${body}`);
            }

            const data = await res.json();
            const photoUrl = data?.media?.url || data?.url || data?.path || null;
            if (photoUrl) {
                setSpacePhoto(photoUrl);
                onSpaceUpdated({ ...space, avatar: photoUrl });
            }

            Alert.alert('Success', 'Space photo updated!');
        } catch (err: any) {
            console.error('[SpaceSettings] Web upload error:', err);
            Alert.alert('Upload Failed', err.message || 'Could not upload image. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    // ─── Participant Management ───────────────────────────────────────────────────

    const handleRoleChange = useCallback(async (participantId: number, newRole: string) => {
        try {
            await collaborationService.updateParticipantRole(space.id, participantId, newRole);
            onParticipantRoleChanged?.(participantId, newRole);
            setShowRoleSheet(false);
            setSelectedParticipant(null);
            if (Platform.OS !== 'web') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert('Updated', `Role changed to ${newRole}.`);
        } catch (err) {
            console.error('[SpaceSettings] Role change error:', err);
            Alert.alert('Error', 'Could not change role. Please try again.');
        }
    }, [space?.id]);

    const handleRemoveParticipant = useCallback(async (participantId: number, name: string) => {
        Alert.alert(
            'Remove Participant',
            `Remove ${name} from this space?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await collaborationService.removeParticipant(space.id, participantId);
                            onParticipantRemoved?.(participantId);
                            if (Platform.OS !== 'web') {
                                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            }
                        } catch (err) {
                            console.error('[SpaceSettings] Remove participant error:', err);
                            Alert.alert('Error', 'Could not remove participant.');
                        }
                    },
                },
            ]
        );
    }, [space?.id]);

    // ─── Render ───────────────────────────────────────────────────────────────────

    const renderGeneralTab = () => (
        <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
            {/* Space Photo */}
            <Text style={styles.sectionTitle}>Space Photo</Text>
            <TouchableOpacity
                style={styles.photoArea}
                onPress={handlePickPhoto}
                disabled={uploading || !isOwnerOrModerator}
                activeOpacity={0.7}
            >
                {uploading ? (
                    <View style={styles.photoPlaceholder}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.photoHint}>Uploading…</Text>
                    </View>
                ) : spacePhoto ? (
                    <View>
                        <Image source={{ uri: spacePhoto }} style={styles.photoPreview} />
                        {isOwnerOrModerator && (
                            <View style={styles.photoEditBadge}>
                                <Ionicons name="camera" size={14} color="#fff" />
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.photoPlaceholder}>
                        <Ionicons name="camera-outline" size={36} color="#999" />
                        <Text style={styles.photoHint}>
                            {isOwnerOrModerator ? 'Tap to upload photo' : 'No photo set'}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* Space Name */}
            <Text style={styles.sectionTitle}>Space Name</Text>
            <TextInput
                style={[styles.input, !isOwnerOrModerator && styles.inputDisabled]}
                value={editingTitle}
                onChangeText={setEditingTitle}
                placeholder="Space name…"
                maxLength={60}
                editable={isOwnerOrModerator}
                returnKeyType="next"
            />

            {/* Description */}
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
                style={[styles.input, styles.textarea, !isOwnerOrModerator && styles.inputDisabled]}
                value={editingDescription}
                onChangeText={setEditingDescription}
                placeholder="Describe your space…"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
                editable={isOwnerOrModerator}
            />

            {/* Stats Row */}
            <Text style={styles.sectionTitle}>Info</Text>
            <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                    <Ionicons name="cube-outline" size={16} color="#666" />
                    <Text style={styles.infoLabel}>Type</Text>
                    <Text style={styles.infoValue}>
                        {(space?.space_type || 'chat').charAt(0).toUpperCase() +
                            (space?.space_type || 'chat').slice(1)}
                    </Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="people-outline" size={16} color="#666" />
                    <Text style={styles.infoLabel}>Participants</Text>
                    <Text style={styles.infoValue}>{participants.length}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="chatbubble-outline" size={16} color="#666" />
                    <Text style={styles.infoLabel}>Messages</Text>
                    <Text style={styles.infoValue}>
                        {space?.content_state?.messages?.length || 0}
                    </Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.infoLabel}>Created</Text>
                    <Text style={styles.infoValue}>
                        {space?.created_at
                            ? new Date(space.created_at).toLocaleDateString()
                            : 'N/A'}{' '}
                        by {space?.creator?.name || 'Unknown'}
                    </Text>
                </View>
            </View>
        </ScrollView>
    );

    const renderParticipantsTab = () => (
        <ScrollView style={styles.tabContent}>
            <Text style={styles.sectionTitle}>{participants.length} Participant{participants.length !== 1 ? 's' : ''}</Text>
            {participants.length === 0 ? (
                <Text style={styles.emptyText}>No participants yet.</Text>
            ) : (
                participants.map((p: any) => {
                    const name = p.user?.name || 'Unknown';
                    const role = p.role || 'participant';
                    const roleColor = role === 'owner' ? '#FFD700' : role === 'moderator' ? '#007AFF' : '#666';
                    return (
                        <View key={p.user_id} style={styles.participantRow}>
                            <View style={styles.participantInfo}>
                                <View style={[styles.participantAvatar, { backgroundColor: `${roleColor}20` }]}>
                                    <Text style={[styles.participantInitial, { color: roleColor }]}>
                                        {name.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={styles.participantName}>{name}</Text>
                                    <Text style={[styles.participantRole, { color: roleColor }]}>
                                        {role.charAt(0).toUpperCase() + role.slice(1)}
                                    </Text>
                                </View>
                            </View>
                            {isOwnerOrModerator && role !== 'owner' && (
                                <View style={styles.participantActions}>
                                    <TouchableOpacity
                                        style={styles.participantActionBtn}
                                        onPress={() => {
                                            setSelectedParticipant(p);
                                            setShowRoleSheet(true);
                                        }}
                                    >
                                        <Ionicons name="shield-outline" size={18} color="#007AFF" />
                                    </TouchableOpacity>
                                    {isOwner && (
                                        <TouchableOpacity
                                            style={[styles.participantActionBtn, styles.dangerBtn]}
                                            onPress={() => handleRemoveParticipant(p.user_id, name)}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    );
                })
            )}
        </ScrollView>
    );

    const renderDangerTab = () => (
        <ScrollView style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <View style={styles.dangerCard}>
                <Text style={styles.dangerDescription}>
                    These actions are irreversible. Proceed with caution.
                </Text>
                {isOwner && (
                    <TouchableOpacity
                        style={styles.dangerButton}
                        onPress={() => {
                            Alert.alert(
                                'Delete Space',
                                `Permanently delete "${space?.title}"? All data will be lost.`,
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Delete',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                await collaborationService.deleteSpace(space.id);
                                                onClose();
                                                // Navigation should happen in parent
                                                Alert.alert('Deleted', 'The space has been deleted.');
                                            } catch (err) {
                                                console.error('[SpaceSettings] Delete error:', err);
                                                Alert.alert('Error', 'Could not delete space.');
                                            }
                                        },
                                    },
                                ]
                            );
                        }}
                    >
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                        <Text style={styles.dangerButtonText}>Delete Space</Text>
                    </TouchableOpacity>
                )}
                {!isOwner && (
                    <TouchableOpacity
                        style={[styles.dangerButton, { borderColor: '#FF9500' }]}
                        onPress={() => {
                            Alert.alert(
                                'Leave Space',
                                `Leave "${space?.title}"?`,
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Leave',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                await collaborationService.leaveSpace(space.id);
                                                onClose();
                                                Alert.alert('Left', 'You have left the space.');
                                            } catch (err) {
                                                console.error('[SpaceSettings] Leave error:', err);
                                                Alert.alert('Error', 'Could not leave space.');
                                            }
                                        },
                                    },
                                ]
                            );
                        }}
                    >
                        <Ionicons name="exit-outline" size={20} color="#FF9500" />
                        <Text style={[styles.dangerButtonText, { color: '#FF9500' }]}>Leave Space</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Space Settings</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    {/* Tab Bar */}
                    <View style={styles.tabBar}>
                        {(['general', 'participants', 'media', 'danger'] as SettingsTab[]).map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tab, activeTab === tab && styles.tabActive]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                    {tab === 'general' ? 'General'
                                        : tab === 'participants' ? 'Members'
                                            : tab === 'media' ? 'Media'
                                                : 'Danger'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Tab Content */}
                    {activeTab === 'general' && renderGeneralTab()}
                    {activeTab === 'participants' && renderParticipantsTab()}
                    {activeTab === 'media' && renderMediaTab()}
                    {activeTab === 'danger' && renderDangerTab()}

                    {/* Save Button (only on General tab) */}
                    {activeTab === 'general' && isOwnerOrModerator && (
                        <TouchableOpacity
                            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark" size={20} color="#fff" />
                                    <Text style={styles.saveButtonText}>Save Changes</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Role Sheet */}
                <Modal
                    visible={showRoleSheet}
                    animationType="slide"
                    transparent
                    onRequestClose={() => setShowRoleSheet(false)}
                >
                    <View style={styles.overlay}>
                        <View style={styles.roleSheet}>
                            <Text style={styles.roleSheetTitle}>
                                Change role for {selectedParticipant?.user?.name}
                            </Text>
                            {['participant', 'moderator', 'owner'].map((role) => {
                                const isCurrentRole = selectedParticipant?.role === role;
                                const roleColor = role === 'owner' ? '#FFD700' : role === 'moderator' ? '#007AFF' : '#666';
                                return (
                                    <TouchableOpacity
                                        key={role}
                                        style={[styles.roleOption, isCurrentRole && styles.roleOptionActive]}
                                        onPress={() => handleRoleChange(selectedParticipant?.user_id, role)}
                                        disabled={isCurrentRole}
                                    >
                                        <Ionicons
                                            name={role === 'owner' ? 'ribbon-outline' : role === 'moderator' ? 'shield' : 'person'}
                                            size={20}
                                            color={roleColor}
                                        />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.roleOptionTitle}>
                                                {role.charAt(0).toUpperCase() + role.slice(1)}
                                            </Text>
                                            <Text style={styles.roleOptionDesc}>
                                                {role === 'owner'
                                                    ? 'Full control'
                                                    : role === 'moderator'
                                                        ? 'Can manage members and content'
                                                        : 'Standard participation'}
                                            </Text>
                                        </View>
                                        {isCurrentRole && <Ionicons name="checkmark-circle" size={20} color="#007AFF" />}
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRoleSheet(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingBottom: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#007AFF',
    },
    tabText: {
        fontSize: 14,
        color: '#888',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#007AFF',
        fontWeight: '700',
    },
    tabContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginTop: 16,
    },
    photoArea: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 120,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#e0e0e0',
        borderStyle: 'dashed',
        overflow: 'hidden',
        backgroundColor: '#fafafa',
    },
    photoPreview: {
        width: 120,
        height: 120,
        borderRadius: 16,
    },
    photoPlaceholder: {
        alignItems: 'center',
        gap: 6,
    },
    photoHint: {
        fontSize: 13,
        color: '#999',
    },
    photoEditBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1a1a1a',
        backgroundColor: '#fff',
    },
    textarea: {
        height: 100,
        paddingTop: 12,
    },
    inputDisabled: {
        backgroundColor: '#f8f8f8',
        color: '#888',
    },
    infoCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 14,
        gap: 10,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: '#888',
        flex: 1,
    },
    infoValue: {
        fontSize: 14,
        color: '#1a1a1a',
        fontWeight: '500',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#007AFF',
        marginHorizontal: 20,
        marginTop: 16,
        paddingVertical: 16,
        borderRadius: 14,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    // Participants
    participantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    participantInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    participantAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    participantInitial: {
        fontSize: 18,
        fontWeight: '700',
    },
    participantName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    participantRole: {
        fontSize: 12,
        marginTop: 2,
    },
    participantActions: {
        flexDirection: 'row',
        gap: 8,
    },
    participantActionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f0f7ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dangerBtn: {
        backgroundColor: '#fff3f3',
    },
    emptyText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: 24,
    },
    // Danger
    dangerCard: {
        backgroundColor: '#fff5f5',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#ffd0d0',
        gap: 12,
    },
    dangerDescription: {
        color: '#888',
        fontSize: 14,
        lineHeight: 20,
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1.5,
        borderColor: '#FF3B30',
        borderRadius: 12,
        padding: 14,
        backgroundColor: '#fff',
    },
    dangerButtonText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: '600',
    },
    // Role Sheet
    roleSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 32,
        gap: 8,
    },
    roleSheetTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    roleOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        backgroundColor: '#fff',
    },
    roleOptionActive: {
        borderColor: '#007AFF',
        backgroundColor: '#f0f7ff',
    },
    roleOptionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    roleOptionDesc: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 16,
        marginTop: 4,
    },
    cancelBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF3B30',
        textAlign: 'center',
    },
    // ─── Media tab styles ─────────────────────────────────────────────────────────────
    mediaContainer: {
        padding: 12,
        paddingBottom: 32,
    },
    mediaEmpty: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 10,
    },
    mediaEmptyTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#333',
    },
    mediaEmptySub: {
        fontSize: 13,
        color: '#999',
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    mediaGrid: {
        flexDirection: 'column',
        gap: 10,
    },
    mediaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fafafa',
        borderRadius: 14,
        padding: 10,
        gap: 12,
        borderWidth: 1,
        borderColor: '#eee',
    },
    mediaThumb: {
        width: 60,
        height: 60,
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
    },
    mediaIconBg: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaCardInfo: {
        flex: 1,
        gap: 4,
    },
    mediaFileName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    mediaMeta: {
        fontSize: 12,
        color: '#888',
    },
    mediaActions: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    mediaActionBtn: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
    },
});

export default SpaceSettingsModal;
