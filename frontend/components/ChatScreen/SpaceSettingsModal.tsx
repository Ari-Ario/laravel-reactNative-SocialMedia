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
    Linking,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { MediaCompressor } from '@/utils/mediaCompressor';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import getApiBase from '@/services/getApiBase';
import getApiBaseImage from '@/services/getApiBaseImage';
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

type SettingsTab = 'general' | 'media' | 'danger';

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
    const { width: windowWidth } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isLargeScreen = isWeb && windowWidth > 768;

    const collaborationService = CollaborationService.getInstance();

    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [editingTitle, setEditingTitle] = useState(space?.title || '');
    const [editingDescription, setEditingDescription] = useState(space?.description || '');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [spacePhoto, setSpacePhoto] = useState<string | null>(space?.image_url || space?.avatar || null);
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

    // ─── General Settings Logic ──────────────────────────────────────────────────

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
            if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Saved', 'Space settings updated successfully.');
        } catch (err) {
            console.error('[SpaceSettings] Save error:', err);
            Alert.alert('Error', 'Could not save settings.');
        } finally {
            setSaving(false);
        }
    }, [editingTitle, editingDescription, space?.id]);

    const uploadPhotoNative = async (uri: string, mimeType: string) => {
        setUploading(true);
        try {
            const compressed = await MediaCompressor.prepareMediaForUpload(uri);
            const token = await getToken();
            const formData = new FormData();
            formData.append('file', {
                uri: compressed.uri,
                type: compressed.type || 'image/jpeg',
                name: compressed.fileName || `space_photo_${Date.now()}.jpg`,
            } as any);
            formData.append('type', 'image');
            formData.append('is_logo', 'true');

            const res = await fetch(`${getApiBase()}/spaces/${space.id}/upload-media`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            const photoUrl = data?.media?.url || data?.url || data?.path || null;
            if (photoUrl) {
                setSpacePhoto(photoUrl);
                onSpaceUpdated({ ...space, image_url: photoUrl });
            }
            if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Space photo updated!');
        } catch (err) {
            console.error('[SpaceSettings] Upload error:', err);
            Alert.alert('Upload Failed', 'Could not upload image.');
        } finally {
            setUploading(false);
        }
    };

    const uploadPhotoFile = async (file: File) => {
        setUploading(true);
        try {
            const uri = URL.createObjectURL(file);
            const compressed = await MediaCompressor.prepareMediaForUpload(uri, file.name);
            let finalFile: any = file;
            if (compressed.uri !== uri) {
                const response = await fetch(compressed.uri);
                const blob = await response.blob();
                finalFile = new File([blob], compressed.fileName, { type: compressed.type });
            }

            const token = await getToken();
            const formData = new FormData();
            formData.append('file', finalFile);
            formData.append('type', 'image');
            formData.append('is_logo', 'true');

            const res = await fetch(`${getApiBase()}/spaces/${space.id}/upload-media`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            const photoUrl = data?.media?.url || data?.url || data?.path || null;
            if (photoUrl) {
                setSpacePhoto(photoUrl);
                onSpaceUpdated({ ...space, image_url: photoUrl });
            }
            Alert.alert('Success', 'Space photo updated!');
        } catch (err) {
            console.error('[SpaceSettings] Web upload error:', err);
            Alert.alert('Upload Failed', 'Could not upload image.');
        } finally {
            setUploading(false);
        }
    };

    const handlePickPhoto = useCallback(async () => {
        if (Platform.OS === 'web') {
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

        Alert.alert('Upload Space Photo', 'Choose a source', [
            { text: 'Camera', onPress: async () => {
                const perm = await ImagePicker.requestCameraPermissionsAsync();
                if (!perm.granted) return;
                const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
                if (!result.canceled && result.assets?.[0]) {
                    await uploadPhotoNative(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
                }
            }},
            { text: 'Photo Library', onPress: async () => {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) return;
                const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
                if (!result.canceled && result.assets?.[0]) {
                    await uploadPhotoNative(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
                }
            }},
            { text: 'Cancel', style: 'cancel' },
        ]);
    }, [space?.id]);

    const renderGeneralTab = () => (
        <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Space Header Info (Name & Description) */}
            <View style={styles.generalHeader}>
                <TouchableOpacity
                    style={styles.mainPhotoContainer}
                    onPress={handlePickPhoto}
                    disabled={uploading || !isOwnerOrModerator}
                >
                    {uploading ? (
                        <ActivityIndicator size="large" color="#007AFF" />
                    ) : spacePhoto ? (
                        <Image 
                            source={{ uri: spacePhoto.startsWith('http') ? spacePhoto : `${getApiBaseImage()}${spacePhoto}` }} 
                            style={styles.mainPhoto} 
                        />
                    ) : (
                        <View style={styles.mainPhotoPlaceholder}>
                            <Ionicons name="camera" size={40} color="#fff" />
                        </View>
                    )}
                    {isOwnerOrModerator && !uploading && (
                        <View style={styles.mainPhotoEditBadge}>
                            <Ionicons name="pencil" size={16} color="#fff" />
                        </View>
                    )}
                </TouchableOpacity>

                <View style={styles.generalInfoText}>
                    <Text style={styles.mainTitle}>{editingTitle || 'Untitled Space'}</Text>
                    <Text style={styles.mainDescription} numberOfLines={3}>
                        {editingDescription || 'No description provided.'}
                    </Text>
                </View>
            </View>

            {/* Edit Section (if owner/moderator) */}
            {isOwnerOrModerator && (
                <View style={styles.editSection}>
                    <Text style={styles.sectionTitle}>Edit Space Details</Text>
                    <TextInput
                        style={styles.input}
                        value={editingTitle}
                        onChangeText={setEditingTitle}
                        placeholder="Space Name"
                        maxLength={60}
                    />
                    <TextInput
                        style={[styles.input, styles.textarea]}
                        value={editingDescription}
                        onChangeText={setEditingDescription}
                        placeholder="Description"
                        multiline
                        maxLength={500}
                    />
                </View>
            )}

            {/* Stats Row */}
            <Text style={styles.sectionTitle}>Statistics</Text>
            <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                    <Ionicons name="people-outline" size={20} color="#007AFF" />
                    <Text style={styles.infoLabel}>Members</Text>
                    <Text style={styles.infoValue}>{participants.length}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color="#34C759" />
                    <Text style={styles.infoLabel}>Messages</Text>
                    <Text style={styles.infoValue}>{space?.content_state?.messages?.length || 0}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={20} color="#FF9500" />
                    <Text style={styles.infoLabel}>Since</Text>
                    <Text style={styles.infoValue}>
                        {space?.created_at ? new Date(space.created_at).toLocaleDateString() : 'N/A'}
                    </Text>
                </View>
            </View>
        </ScrollView>
    );

    const renderMediaTab = () => (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            {loadingMedia ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
            ) : mediaItems.length === 0 ? (
                <View style={styles.mediaEmpty}>
                    <Ionicons name="images-outline" size={64} color="#eee" />
                    <Text style={styles.mediaEmptyTitle}>No Media</Text>
                    <Text style={styles.mediaEmptySub}>Photos, videos and documents will appear here.</Text>
                </View>
            ) : (
                <View>
                    {/* Images & Videos Grid */}
                    {mediaItems.filter(m => m.type === 'image' || m.type === 'video').length > 0 && (
                        <View style={styles.mediaSection}>
                            <Text style={styles.mediaSectionTitle}>Media</Text>
                            <View style={styles.mediaGrid}>
                                {mediaItems
                                    .filter(m => m.type === 'image' || m.type === 'video')
                                    .map((item) => (
                                        <TouchableOpacity 
                                            key={item.id} 
                                            style={styles.gridItem}
                                            onPress={() => item.url && Linking.openURL(item.url.startsWith('http') ? item.url : `${getApiBaseImage()}${item.url}`)}
                                        >
                                            {item.type === 'image' ? (
                                                <Image 
                                                    source={{ uri: item.url?.startsWith('http') ? item.url : `${getApiBaseImage()}${item.url}` }} 
                                                    style={styles.gridImage} 
                                                />
                                            ) : (
                                                <View style={styles.gridVideoPlaceholder}>
                                                    <Ionicons name="play-circle" size={32} color="#fff" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                            </View>
                        </View>
                    )}

                    {/* Documents List */}
                    {mediaItems.filter(m => m.type !== 'image' && m.type !== 'video').length > 0 && (
                        <View style={styles.docsSection}>
                            <Text style={styles.mediaSectionTitle}>Documents</Text>
                            {mediaItems
                                .filter(m => m.type !== 'image' && m.type !== 'video')
                                .map((item) => (
                                    <TouchableOpacity 
                                        key={item.id} 
                                        style={styles.docRow}
                                        onPress={() => item.url && Linking.openURL(item.url.startsWith('http') ? item.url : `${getApiBaseImage()}${item.url}`)}
                                    >
                                        <View style={styles.docIconContainer}>
                                            <Ionicons name="document-text" size={24} color="#007AFF" />
                                        </View>
                                        <View style={styles.docInfo}>
                                            <Text style={styles.docName} numberOfLines={1}>{item.file_name}</Text>
                                            <Text style={styles.docMeta}>{formatBytes(item.file_size)}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#ccc" />
                                    </TouchableOpacity>
                                ))}
                        </View>
                    )}
                </View>
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
            animationType={isWeb ? 'fade' : 'slide'}
            transparent
            onRequestClose={onClose}
        >
            <TouchableOpacity 
                style={styles.overlay} 
                activeOpacity={1} 
                onPress={onClose}
            >
                <TouchableOpacity 
                    activeOpacity={1} 
                    style={[
                        styles.sheet,
                        isLargeScreen && styles.sheetWeb
                    ] as any}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerTitle}>Space Settings</Text>
                            <Text style={styles.headerSubtitle}>{space?.title || 'Collaboration'}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }} style={styles.closeBtn as any}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    {/* Tab Bar */}
                    <View style={styles.tabBar}>
                        {(['general', 'media', 'danger'] as SettingsTab[]).map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tab, activeTab === tab && styles.tabActive]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Ionicons 
                                    name={tab === 'general' ? 'information-circle-outline' : tab === 'media' ? 'images-outline' : 'warning-outline'} 
                                    size={18} 
                                    color={activeTab === tab ? '#007AFF' : '#888'} 
                                />
                                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                    {tab === 'general' ? 'Info'
                                        : tab === 'media' ? 'Media'
                                            : 'Danger'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Tab Content */}
                    <View style={styles.tabContentContainer}>
                        {activeTab === 'general' && renderGeneralTab()}
                        {activeTab === 'media' && renderMediaTab()}
                        {activeTab === 'danger' && renderDangerTab()}
                    </View>

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
                                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                    <Text style={styles.saveButtonText}>Save Changes</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
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
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '90%', // Fixed height for consistency on Android
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        overflow: 'hidden',
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
    headerSubtitle: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    closeBtn: {
        padding: 4,
    },
    sheetWeb: {
        width: 500,
        alignSelf: 'center',
        borderRadius: 24,
        marginTop: '10%',
        maxHeight: '80%',
        ...Platform.select({
            web: {
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }
        } as any),
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingHorizontal: 10,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabActive: {
        borderBottomWidth: 3,
        borderBottomColor: '#007AFF',
    },
    tabText: {
        fontSize: 11,
        color: '#888',
        fontWeight: '600',
        marginTop: 2,
    },
    tabTextActive: {
        color: '#007AFF',
        fontWeight: '700',
    },
    tabContentContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    tabContent: {
        flex: 1,
    },
    roleSheetWeb: {
        width: 400,
        alignSelf: 'center',
        marginTop: '20%',
    },
    // Unified Header Style
    generalHeader: {
        padding: 20,
        alignItems: 'center',
        backgroundColor: '#fafafa',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    mainPhotoContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
    },
    mainPhoto: {
        width: 140,
        height: 140,
        borderRadius: 70,
    },
    mainPhotoPlaceholder: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainPhotoEditBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: '#007AFF',
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 3,
        borderColor: '#fafafa',
        justifyContent: 'center',
        alignItems: 'center',
    },
    generalInfoText: {
        alignItems: 'center',
    },
    mainTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1a1a1a',
        textAlign: 'center',
    },
    mainDescription: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    editSection: {
        paddingHorizontal: 20,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#007AFF',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
        marginTop: 20,
        paddingHorizontal: 20,
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
    // ─── Media Refined Grid ─────────────────────────────────────────────────────────────
    mediaSection: {
        marginTop: 20,
    },
    mediaSectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1a1a1a',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 14,
        gap: 4,
    },
    gridItem: {
        width: '32%', 
        aspectRatio: 1,
        borderRadius: 4,
        backgroundColor: '#f0f0f0',
        overflow: 'hidden',
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    gridVideoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
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
    docsSection: {
        marginTop: 24,
        paddingBottom: 40,
    },
    docRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
        marginHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    docIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#f0f7ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    docInfo: {
        flex: 1,
    },
    docName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    docMeta: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
});



export default SpaceSettingsModal;
