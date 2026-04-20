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
    Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { MediaCompressor } from '@/utils/mediaCompressor';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import getApiBase from '@/services/getApiBase';
import getApiBaseImage from '@/services/getApiBaseImage';
import { getToken } from '@/services/TokenService';
import { MediaViewer } from '@/components/MediaViewer';
import { useProfileView } from '@/context/ProfileViewContext';
import Avatar from '@/components/Image/Avatar';
import StoryViewer from '@/components/StoryViewer';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useThemeStore } from '@/stores/themeStore';
import GenericMenu, { MenuItem } from '@/components/GenericMenu';
import { calculateAnchor, AnchorPosition } from '@/utils/layout';
import { createShadow } from '@/utils/styles';

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

type SettingsTab = 'info' | 'media' | 'evolution';


const getStyles = (colors: any, activeScheme: 'light' | 'dark', isWeb: boolean, isLargeScreen: boolean): any => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: activeScheme === 'dark' ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    sheet: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '92%',
        width: '100%',
        maxWidth: 1440,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    sheetWeb: {
        borderRadius: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 1,
    },
    themeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 8,
        backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    },
    tabActive: {
        borderBottomWidth: 3,
        borderBottomColor: colors.tint,
    },
    tabText: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '600',
        marginTop: 2,
    },
    tabTextActive: {
        color: colors.tint,
        fontWeight: '700',
    },
    tabContentContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    tabContent: {
        flex: 1,
    },
    // Original Header Style Restored
    generalHeader: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.03)' : '#fafafa',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    mainPhotoContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: colors.tint,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        ...createShadow({
            color: colors.tint,
            width: 0,
            height: 4,
            opacity: 0.2,
            radius: 8,
            elevation: 6,
        }),
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
        backgroundColor: colors.muted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainPhotoEditBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: colors.tint,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: colors.background,
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 16,
    },
    inputCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textSecondary,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    textInput: {
        fontSize: 16,
        color: colors.text,
        paddingVertical: 8,
    },
    descInput: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    // Danger Tab Styles
    dangerSection: {
        padding: 20,
        gap: 16,
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FF3B30',
        gap: 12,
    },
    dangerButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF3B30',
    },
    // Activity Tab Styles (Intermingled)
    activityCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 20,
    },
    energyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    energyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
    },
    energyMeterContainer: {
        height: 10,
        backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        borderRadius: 5,
        marginBottom: 8,
        overflow: 'hidden',
    },
    energyMeterFill: {
        height: '100%',
        backgroundColor: colors.tint,
        borderRadius: 5,
    },
    energySubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 16,
    },
    contributorsSection: {
        marginTop: 12,
    },
    contributorList: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    contributorItem: {
        alignItems: 'center',
        width: 60,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 6,
    },
    contributorAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    rankBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.surface,
    },
    rankText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    contributorName: {
        fontSize: 11,
        color: colors.text,
        textAlign: 'center',
    },
    saveButton: {
        backgroundColor: colors.tint,
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        margin: 20,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    // Privacy Switcher (Keep the enhanced version as it was liked)
    privacySwitcher: {
        flexDirection: 'row',
        backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f2f2f7',
        borderRadius: 12,
        padding: 4,
        marginTop: 8,
        position: 'relative',
        height: 48,
    },
    privacyIndicator: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        width: '49%',
        backgroundColor: colors.tint,
        borderRadius: 10,
    },
    privacyOption: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        zIndex: 1,
    },
    privacyText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    privacyTextActive: {
        color: '#fff',
    },
    // List Item Styles
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    infoLabel: {
        fontSize: 15,
        color: colors.text,
        marginLeft: 12,
        flex: 1,
    },
    infoValue: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    // Toggles
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    toggleLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    toggleTextGroup: {
        marginLeft: 12,
    },
    toggleLabel: {
        fontSize: 16,
        color: colors.text,
        fontWeight: '500',
    },
    toggleSubline: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    customToggle: {
        width: 51,
        height: 31,
        borderRadius: 15.5,
        backgroundColor: activeScheme === 'dark' ? '#39393d' : '#e9e9ea',
        padding: 2,
    },
    customToggleActive: {
        backgroundColor: '#34c759',
    },
    toggleCircle: {
        width: 27,
        height: 27,
        borderRadius: 13.5,
        backgroundColor: '#fff',
    },
    toggleCircleActive: {
        transform: [{ translateX: 20 }],
    },
    // Role Sheet
    roleSheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 32,
        gap: 8,
    },
    roleSheetTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 12,
    },
    roleOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    roleOptionActive: {
        borderColor: colors.tint,
        backgroundColor: activeScheme === 'dark' ? 'rgba(0,122,255,0.1)' : '#f0f7ff',
    },
    roleOptionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
    },
    roleOptionDesc: {
        fontSize: 13,
        color: colors.textSecondary,
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
    mediaSection: {
        marginTop: 20,
    },
    mediaSectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
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
        borderRadius: 8,
        backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f0f0f0',
        overflow: 'hidden',
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    gridVideoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: activeScheme === 'dark' ? '#1c1c1e' : '#333',
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
        color: colors.text,
    },
    mediaEmptySub: {
        fontSize: 13,
        color: colors.textSecondary,
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
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
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
        backgroundColor: activeScheme === 'dark' ? 'rgba(0,122,255,0.1)' : '#f0f7ff',
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
        color: colors.text,
    },
    docMeta: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
});

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
    const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
    const { width: windowWidth } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isLargeScreen = isWeb && windowWidth > 768;
    const router = useRouter();

    const { colors, activeScheme, themePreference } = useAppTheme();
    const { setThemePreference } = useThemeStore();
    const [showThemeMenu, setShowThemeMenu] = useState(false);
    const [themeMenuPosition, setThemeMenuPosition] = useState<AnchorPosition | undefined>(undefined);
    const themeIconRef = useRef<View>(null);

    const dynamicStyles = getStyles(colors, activeScheme, isWeb, isLargeScreen);

    const collaborationService = CollaborationService.getInstance();

    const [activeTab, setActiveTab] = useState<SettingsTab>('info');
    const [editingTitle, setEditingTitle] = useState(space?.title || '');
    const [editingDescription, setEditingDescription] = useState(space?.description || '');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [spacePhoto, setSpacePhoto] = useState<string | null>(space?.image_url || space?.avatar || null);
    const isOwnerOrModerator = currentUserRole === 'owner' || currentUserRole === 'moderator';
    const isOwner = currentUserRole === 'owner';

    const [isMuted, setIsMuted] = useState(space?.my_participation?.is_muted || false);
    const [isArchived, setIsArchived] = useState(space?.my_participation?.is_archived || false);
    const [spaceType, setSpaceType] = useState(space?.space_type || 'general');

    // Privacy animation
    const privacyAnim = useRef(new Animated.Value(space?.space_type === 'protected' ? 1 : 0)).current;

    useEffect(() => {
        Animated.spring(privacyAnim, {
            toValue: spaceType === 'protected' ? 1 : 0,
            useNativeDriver: false,
            tension: 50,
            friction: 8
        }).start();
    }, [spaceType]);

    // ─── Media state ─────────────────────────────────────────────────────────────
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [mediaPage, setMediaPage] = useState(1);
    const [hasMoreMedia, setHasMoreMedia] = useState(true);
    const [loadingMoreMedia, setLoadingMoreMedia] = useState(false);
    const [deletingMediaId, setDeletingMediaId] = useState<number | null>(null);

    // Media Viewer state
    const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
    const [mediaViewerIndex, setMediaViewerIndex] = useState(0);

    // Story Viewer state
    const [storyViewerVisible, setStoryViewerVisible] = useState(false);
    const [selectedStoryId, setSelectedStoryId] = useState<number | null>(null);
    const [selectedStoryUserId, setSelectedStoryUserId] = useState<number | null>(null);

    const handleThemeAction = () => {
        if (themeIconRef.current) {
            themeIconRef.current.measure((x, y, width, height, pageX, pageY) => {
                const anchor = calculateAnchor(pageX, pageY, width, height, 220);
                setThemeMenuPosition(anchor);
                setShowThemeMenu(true);
            });
        } else {
            setShowThemeMenu(true);
        }
    };

    const getThemeIcon = () => {
        switch (themePreference) {
            case 'light': return 'sunny';
            case 'dark': return 'moon';
            case 'dynamic': return 'color-palette';
            default: return 'contrast';
        }
    };

    const themeMenuItems: MenuItem[] = [
        { icon: 'contrast', label: 'Automatic (System)', onPress: () => { setThemePreference('automatic'); setShowThemeMenu(false); } },
        { icon: 'sunny', label: 'Light Mode', onPress: () => { setThemePreference('light'); setShowThemeMenu(false); } },
        { icon: 'moon', label: 'Dark Mode', onPress: () => { setThemePreference('dark'); setShowThemeMenu(false); } },
        { icon: 'color-palette', label: 'Dynamic (Android 12+)', onPress: () => { setThemePreference('dynamic'); setShowThemeMenu(false); } },
    ];

    const fetchMedia = useCallback(async (page: number = 1) => {
        if (page === 1) {
            setLoadingMedia(true);
            setMediaPage(1);
        } else {
            setLoadingMoreMedia(true);
        }

        try {
            const token = await getToken();
            const res = await fetch(`${getApiBase()}/spaces/${space.id}/media?page=${page}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            const newItems = data.media ?? [];
            if (page === 1) {
                setMediaItems(newItems);
            } else {
                setMediaItems(prev => [...prev, ...newItems]);
            }

            setHasMoreMedia(data.pagination?.has_more ?? false);
            setMediaPage(page);
        } catch (err) {
            console.error('Failed to fetch media:', err);
        } finally {
            setLoadingMedia(false);
            setLoadingMoreMedia(false);
        }
    }, [space?.id]);

    useEffect(() => {
        if (activeTab === 'media' && visible) {
            fetchMedia(1);
        }
    }, [activeTab, visible, fetchMedia]);

    const handleMediaScroll = (event: any) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const paddingToBottom = 50;
        const reachedBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

        if (reachedBottom && hasMoreMedia && !loadingMoreMedia && !loadingMedia) {
            fetchMedia(mediaPage + 1);
        }
    };

    const isStory = useCallback((item: any) => {
        return item.model_type?.includes('Story') || !!item.story_id || item.origin === 'story';
    }, []);

    const isPost = useCallback((item: any) => {
        return item.model_type?.includes('Post') || !!item.post_id || item.origin === 'post';
    }, []);

    const handleMediaPress = (item: any) => {
        if (isPost(item)) {
            const postId = item.model_id || item.post_id;
            if (postId) {
                router.push({
                    pathname: '/post/[id]',
                    params: { id: postId.toString() }
                } as any);
            }
            return;
        }

        if (isStory(item)) {
            const storyId = item.model_id || item.story_id;
            const userId = item.uploader?.id || item.user_id;
            if (storyId && userId) {
                setSelectedStoryId(Number(storyId));
                setSelectedStoryUserId(Number(userId));
                setStoryViewerVisible(true);
            }
            return;
        }

        // Chat Media Gallery
        const galleryItems = mediaItems.filter(m => (m.type === 'image' || m.type === 'video') && !isStory(m));
        const index = galleryItems.findIndex(m => m.id === item.id);
        if (index !== -1) {
            setMediaViewerIndex(index);
            setMediaViewerVisible(true);
        }
    };

    // Helper to map space media to MediaViewer expectations
    const viewerMediaItems = mediaItems
        .filter(m => (m.type === 'image' || m.type === 'video') && !isStory(m))
        .map(m => ({
            id: m.id,
            file_path: m.url, // MediaViewer's MediaItemDisplay resolves this correctly
            type: m.type
        }));

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
                space_type: spaceType,
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
    }, [editingTitle, editingDescription, spaceType, space?.id]);

    const handleToggleMute = async () => {
        try {
            const token = await getToken();
            const res = await fetch(`${getApiBase()}/spaces/${space.id}/mute`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setIsMuted(data.is_muted);
                if (Platform.OS !== 'web') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (err) {
            console.error('Mute toggle error:', err);
        }
    };

    const handleToggleArchive = async () => {
        try {
            const token = await getToken();
            const res = await fetch(`${getApiBase()}/spaces/${space.id}/archive`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setIsArchived(data.is_archived);
                if (Platform.OS !== 'web') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (err) {
            console.error('Archive toggle error:', err);
        }
    };

    const uploadPhotoNative = async (uri: string, mimeType: string) => {
        // We already compress in handlePickPhoto, but keeping this for safety
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
        // We already compress in handlePickPhoto
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
                if (file) {
                    setUploading(true);
                    try {
                        const uri = URL.createObjectURL(file);
                        // Aggressive compression like settings/index.tsx
                        const compressedUri = await MediaCompressor.compressImage(uri, {
                            maxWidth: 200,
                            quality: 0.5
                        });

                        const response = await fetch(compressedUri);
                        const blob = await response.blob();
                        const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
                        await uploadPhotoFile(compressedFile);
                    } catch (err) {
                        console.error('Web compression failed:', err);
                        await uploadPhotoFile(file);
                    } finally {
                        setUploading(false);
                    }
                }
            };
            input.click();
            return;
        }

        Alert.alert('Upload Space Photo', 'Choose a source', [
            {
                text: 'Camera', onPress: async () => {
                    const perm = await ImagePicker.requestCameraPermissionsAsync();
                    if (!perm.granted) return;
                    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
                    if (!result.canceled && result.assets?.[0]) {
                        setUploading(true);
                        try {
                            const compressedUri = await MediaCompressor.compressImage(result.assets[0].uri, {
                                maxWidth: 200,
                                quality: 0.5
                            });
                            await uploadPhotoNative(compressedUri, result.assets[0].mimeType || 'image/jpeg');
                        } catch (err) {
                            console.error('Compression failed:', err);
                            await uploadPhotoNative(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
                        } finally {
                            setUploading(false);
                        }
                    }
                }
            },
            {
                text: 'Photo Library', onPress: async () => {
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) return;
                    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
                    if (!result.canceled && result.assets?.[0]) {
                        setUploading(true);
                        try {
                            const compressedUri = await MediaCompressor.compressImage(result.assets[0].uri, {
                                maxWidth: 200,
                                quality: 0.5
                            });
                            await uploadPhotoNative(compressedUri, result.assets[0].mimeType || 'image/jpeg');
                        } catch (err) {
                            console.error('Compression failed:', err);
                            await uploadPhotoNative(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
                        } finally {
                            setUploading(false);
                        }
                    }
                }
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    }, [space?.id]);

    const renderInfoTab = () => (
        <ScrollView style={dynamicStyles.tabContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Space Header Info (Original centered layout) */}
            <View style={dynamicStyles.generalHeader}>
                <TouchableOpacity
                    style={dynamicStyles.mainPhotoContainer}
                    onPress={handlePickPhoto}
                    disabled={uploading || !isOwnerOrModerator}
                >
                    {uploading ? (
                        <ActivityIndicator size="large" color={colors.tint} />
                    ) : spacePhoto ? (
                        <Image
                            source={{ uri: spacePhoto.startsWith('http') ? spacePhoto : `${getApiBaseImage()}${spacePhoto}` }}
                            style={dynamicStyles.mainPhoto}
                        />
                    ) : (
                        <View style={dynamicStyles.mainPhotoPlaceholder}>
                            <Ionicons name="camera" size={50} color="#fff" />
                        </View>
                    )}
                    {isOwnerOrModerator && !uploading && (
                        <View style={dynamicStyles.mainPhotoEditBadge}>
                            <Ionicons name="pencil" size={18} color="#fff" />
                        </View>
                    )}
                </TouchableOpacity>

                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 8 }}>
                    {editingTitle || 'Untitled Space'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }} numberOfLines={2}>
                    {editingDescription || 'No description provided.'}
                </Text>
            </View>

            {/* Edit Section */}
            <View style={dynamicStyles.section}>
                {isOwnerOrModerator && (
                    <>
                        <Text style={dynamicStyles.sectionTitle}>Space Details</Text>
                        <View style={dynamicStyles.inputCard}>
                            <Text style={dynamicStyles.inputLabel}>Space Name</Text>
                            <TextInput
                                style={dynamicStyles.textInput}
                                value={editingTitle}
                                onChangeText={setEditingTitle}
                                placeholder="Enter space name"
                                placeholderTextColor={colors.textSecondary + '80'}
                            />
                        </View>

                        <View style={dynamicStyles.inputCard}>
                            <Text style={dynamicStyles.inputLabel}>Description</Text>
                            <TextInput
                                style={[dynamicStyles.textInput, dynamicStyles.descInput]}
                                value={editingDescription}
                                onChangeText={setEditingDescription}
                                placeholder="What is this space about?"
                                placeholderTextColor={colors.textSecondary + '80'}
                                multiline
                                numberOfLines={4}
                            />
                        </View>
                    </>
                )}

                <Text style={dynamicStyles.sectionTitle}>Statistics</Text>
                <View style={dynamicStyles.infoCard}>
                    <View style={dynamicStyles.infoRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="people-outline" size={20} color={colors.tint} />
                            <Text style={dynamicStyles.infoLabel}>Members</Text>
                        </View>
                        <Text style={dynamicStyles.infoValue}>{participants.length}</Text>
                    </View>
                    <View style={dynamicStyles.infoRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#34C759" />
                            <Text style={dynamicStyles.infoLabel}>Messages</Text>
                        </View>
                        <Text style={dynamicStyles.infoValue}>{space?.content_state?.messages?.length || 0}</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );

    const renderMediaTab = () => (
        <ScrollView
            style={dynamicStyles.tabContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleMediaScroll}
            scrollEventThrottle={16}
        >
            {loadingMedia ? (
                <ActivityIndicator size="large" color={colors.tint} style={{ marginTop: 40 }} />
            ) : mediaItems.length === 0 ? (
                <View style={dynamicStyles.mediaEmpty}>
                    <Ionicons name="images-outline" size={64} color={activeScheme === 'dark' ? '#333' : '#eee'} />
                    <Text style={dynamicStyles.mediaEmptyTitle}>No Media</Text>
                    <Text style={dynamicStyles.mediaEmptySub}>Photos, videos and documents will appear here.</Text>
                </View>
            ) : (
                <View>
                    {/* Images & Videos Grid */}
                    {mediaItems.filter(m => m.type === 'image' || m.type === 'video').length > 0 && (
                        <View style={dynamicStyles.mediaSection}>
                            <Text style={dynamicStyles.mediaSectionTitle}>Media</Text>
                            <View style={dynamicStyles.mediaGrid}>
                                {mediaItems
                                    .filter(m => m.type === 'image' || m.type === 'video')
                                    .map((item) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={dynamicStyles.gridItem}
                                            onPress={() => item.type === 'image' || item.type === 'video'
                                                ? handleMediaPress(item)
                                                : item.url && Linking.openURL(item.url.startsWith('http') ? item.url : `${getApiBaseImage()}${item.url}`)}
                                        >
                                            {item.type === 'image' ? (
                                                <Image
                                                    source={{ uri: item.url?.startsWith('http') ? item.url : `${getApiBaseImage()}${item.url}` }}
                                                    style={dynamicStyles.gridImage}
                                                />
                                            ) : (
                                                <View style={dynamicStyles.gridVideoPlaceholder}>
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
                        <View style={dynamicStyles.docsSection}>
                            <Text style={dynamicStyles.mediaSectionTitle}>Documents</Text>
                            {mediaItems
                                .filter(m => m.type !== 'image' && m.type !== 'video')
                                .map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={dynamicStyles.docRow}
                                        onPress={() => item.type === 'image' || item.type === 'video'
                                            ? handleMediaPress(item)
                                            : item.url && Linking.openURL(item.url.startsWith('http') ? item.url : `${getApiBaseImage()}${item.url}`)}
                                    >
                                        <View style={dynamicStyles.docIconContainer}>
                                            <Ionicons name="document-text" size={24} color="#007AFF" />
                                        </View>
                                        <View style={dynamicStyles.docInfo}>
                                            <Text style={dynamicStyles.docName} numberOfLines={1}>{item.file_name}</Text>
                                            <Text style={dynamicStyles.docMeta}>{formatBytes(item.file_size)}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#ccc" />
                                    </TouchableOpacity>
                                ))}
                        </View>
                    )}

                    {loadingMoreMedia && (
                        <View style={{ paddingVertical: 20 }}>
                            <ActivityIndicator size="small" color="#007AFF" />
                        </View>
                    )}
                </View>
            )}

            <MediaViewer
                visible={mediaViewerVisible}
                mediaItems={viewerMediaItems}
                startIndex={mediaViewerIndex}
                onClose={() => setMediaViewerVisible(false)}
                post={null} // Passing null hides social actions
                getApiBaseImage={getApiBaseImage}
                onNavigateNext={() => { }}
                onNavigatePrev={() => { }}
                onReact={() => { }}
                onDeleteReaction={() => { }}
                onRepost={() => { }}
                onShare={() => { }}
                onBookmark={() => { }}
                onCommentPress={() => { }}
                onDoubleTap={() => { }}
                currentReactingItem={null}
                setCurrentReactingItem={() => { }}
                setIsEmojiPickerOpen={() => { }}
                onCommentSubmit={async () => { }}
                getGroupedReactions={() => []}
                handleReactComment={() => { }}
                deleteCommentReaction={() => { }}
            />

            {storyViewerVisible && selectedStoryUserId && selectedStoryId && (
                <Modal
                    visible={storyViewerVisible}
                    animationType="slide"
                    transparent={false}
                    onRequestClose={() => setStoryViewerVisible(false)}
                >
                    <StoryViewer
                        userId={selectedStoryUserId}
                        initialStoryId={selectedStoryId}
                        onClose={() => setStoryViewerVisible(false)}
                        onNextUser={() => setStoryViewerVisible(false)}
                        onPrevUser={() => setStoryViewerVisible(false)}
                    />
                </Modal>
            )}
        </ScrollView>
    );

    const renderActivityTab = () => {
        const evolutionLevel = space?.evolution_level || 1;
        const energyPercentage = (evolutionLevel / 10) * 100;

        const getInitials = (name: string) => {
            if (!name) return '?';
            const parts = name.trim().split(' ');
            if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            return name.slice(0, 2).toUpperCase();
        };

        const resolveProfilePhoto = (path: string) => {
            if (!path) return '';
            if (path.startsWith('http')) return path;
            const base = getApiBaseImage();
            const cleanPath = path.startsWith('/') ? path.substring(1) : path;
            return cleanPath.startsWith('storage/') ? `${base}/${cleanPath}` : `${base}/storage/${cleanPath}`;
        };

        const handleProfilePress = (userId: any) => {
            if (!userId) return;
            setProfileViewUserId(String(userId));
            setProfilePreviewVisible(true);
        };

        return (
            <ScrollView style={dynamicStyles.tabContent} showsVerticalScrollIndicator={false}>
                <View style={dynamicStyles.section}>
                    {/* 📊 Space Activity Section */}
                    <View style={dynamicStyles.activityCard}>
                        <View style={dynamicStyles.energyHeader}>
                            <Ionicons name="flash" size={24} color={colors.tint} />
                            <Text style={dynamicStyles.energyTitle}>Space Activity</Text>
                        </View>

                        <View style={dynamicStyles.energyMeterContainer}>
                            <View style={[dynamicStyles.energyMeterFill, { width: `${energyPercentage}%` }]} />
                        </View>
                        <Text style={dynamicStyles.energySubtitle}>
                            Energy Level: <Text style={{ color: colors.tint, fontWeight: '700' }}>{evolutionLevel}/10</Text>
                            {evolutionLevel > 7 ? ' — This space is thriving!' : ' — Steady momentum.'}
                        </Text>

                        {/* Top Contributors */}
                        <View style={dynamicStyles.contributorsSection}>
                            <Text style={[dynamicStyles.inputLabel, { marginBottom: 12 }]}>Top Contributors</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dynamicStyles.contributorList}>
                                {participants.slice(0, 5).map((p, i) => (
                                    <TouchableOpacity
                                        key={p.user_id || i}
                                        style={dynamicStyles.contributorItem}
                                        onPress={() => handleProfilePress(p.user_id)}
                                    >
                                        <View style={dynamicStyles.avatarWrapper}>
                                            {p.user?.profile_photo ? (
                                                <Image
                                                    source={{ uri: resolveProfilePhoto(p.user.profile_photo) }}
                                                    style={dynamicStyles.contributorAvatar}
                                                />
                                            ) : (
                                                <View style={[dynamicStyles.contributorAvatar, { backgroundColor: colors.tint + '20', justifyContent: 'center', alignItems: 'center' }]}>
                                                    <Text style={{ color: colors.tint, fontWeight: 'bold' }}>{getInitials(p.user?.name)}</Text>
                                                </View>
                                            )}
                                            <View style={[dynamicStyles.rankBadge, { backgroundColor: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32' }]}>
                                                <Text style={dynamicStyles.rankText}>{i + 1}</Text>
                                            </View>
                                        </View>
                                        <Text style={dynamicStyles.contributorName} numberOfLines={1}>{p.user?.name?.split(' ')[0]}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>

                    {/* 🔔 Notifications & Privacy Section */}
                    <Text style={dynamicStyles.sectionTitle}>Notifications & Privacy</Text>
                    <View style={dynamicStyles.infoCard}>
                        <TouchableOpacity style={dynamicStyles.infoRow} onPress={handleToggleMute} activeOpacity={0.7}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name={isMuted ? "notifications-off" : "notifications"} size={22} color={isMuted ? "#FF3B30" : colors.tint} />
                                <Text style={dynamicStyles.infoLabel}>Mute Notifications</Text>
                            </View>
                            <View style={[dynamicStyles.customToggle, isMuted && dynamicStyles.customToggleActive]}>
                                <View style={[dynamicStyles.toggleCircle, isMuted && dynamicStyles.toggleCircleActive]} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={dynamicStyles.infoRow} onPress={handleToggleArchive} activeOpacity={0.7}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="eye-off-outline" size={22} color={colors.textSecondary} />
                                <Text style={dynamicStyles.infoLabel}>Hide from Feed</Text>
                            </View>
                            <View style={[dynamicStyles.customToggle, isArchived && dynamicStyles.customToggleActive]}>
                                <View style={[dynamicStyles.toggleCircle, isArchived && dynamicStyles.toggleCircleActive]} />
                            </View>
                        </TouchableOpacity>

                        {isOwner && space?.space_type !== 'direct' && (
                            <View style={{ padding: 16 }}>
                                <Text style={[dynamicStyles.inputLabel, { marginBottom: 12 }]}>Who can join?</Text>
                                <View style={dynamicStyles.privacySwitcher}>
                                    <Animated.View style={[dynamicStyles.privacyIndicator, {
                                        left: privacyAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['1%', '50%']
                                        })
                                    }]} />
                                    <TouchableOpacity
                                        style={dynamicStyles.privacyOption}
                                        onPress={() => setSpaceType('general')}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="earth" size={18} color={spaceType !== 'protected' ? "#fff" : "#8E8E93"} />
                                        <Text style={[dynamicStyles.privacyText, spaceType !== 'protected' ? dynamicStyles.privacyTextActive : null]}>Public</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={dynamicStyles.privacyOption}
                                        onPress={() => setSpaceType('protected')}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="lock-closed" size={18} color={spaceType === 'protected' ? "#fff" : "#8E8E93"} />
                                        <Text style={[dynamicStyles.privacyText, spaceType === 'protected' ? dynamicStyles.privacyTextActive : null]}>Internal</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* ⚠️ Danger Zone */}
                    <Text style={[dynamicStyles.sectionTitle, { color: '#FF3B30', marginTop: 32 }]}>Responsibility</Text>
                    <View style={{ gap: 12 }}>
                        {isOwner ? (
                            <TouchableOpacity
                                style={dynamicStyles.dangerButton}
                                onPress={() => {
                                    const title = 'Delete Space Forever';
                                    const message = 'The space will be deleted forever for all participants with all messages and belongings. Proceed?';

                                    if (Platform.OS === 'web') {
                                        if (window.confirm(`${title}\n\n${message}`)) {
                                            (async () => {
                                                try {
                                                    await collaborationService.deleteSpace(space.id);
                                                    onClose();
                                                    router.replace('/(tabs)/chats');
                                                    Alert.alert('Success', 'Space deleted forever.');
                                                } catch (err) {
                                                    console.error('Delete error', err);
                                                    Alert.alert('Error', 'Failed to delete space');
                                                }
                                            })();
                                        }
                                    } else {
                                        Alert.alert(title, message, [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Delete',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    try {
                                                        await collaborationService.deleteSpace(space.id);
                                                        onClose();
                                                        router.replace('/(tabs)/chats');
                                                        Alert.alert('Success', 'Space deleted forever.');
                                                    } catch (err) {
                                                        console.error('Delete error', err);
                                                        Alert.alert('Error', 'Failed to delete space');
                                                    }
                                                },
                                            },
                                        ]);
                                    }
                                }}
                            >
                                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                <Text style={dynamicStyles.dangerButtonText}>Delete Permanently</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={dynamicStyles.dangerButton}
                                onPress={() => {
                                    Alert.alert(
                                        'Leave Space',
                                        'Are you sure you want to leave this space?',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Leave',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    try {
                                                        await collaborationService.leaveSpace(space.id);
                                                        onClose();
                                                    } catch (err) {
                                                        console.error('Leave error', err);
                                                        Alert.alert('Error', 'Could not leave space');
                                                    }
                                                },
                                            },
                                        ]
                                    );
                                }}
                            >
                                <Ionicons name="exit-outline" size={20} color="#FF3B30" />
                                <Text style={dynamicStyles.dangerButtonText}>Leave Space</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </ScrollView>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType={isWeb ? 'fade' : 'slide'}
            transparent
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={dynamicStyles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={[
                        dynamicStyles.sheet,
                        isLargeScreen && dynamicStyles.sheetWeb
                    ] as any}
                >
                    {/* Header */}
                    <View style={dynamicStyles.header}>
                        <View>
                            <Text style={dynamicStyles.headerTitle}>Space Settings</Text>
                            <Text style={dynamicStyles.headerSubtitle}>{space?.title || 'Collaboration'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View ref={themeIconRef}>
                                <TouchableOpacity
                                    onPress={handleThemeAction}
                                    style={dynamicStyles.themeButton}
                                >
                                    <Ionicons name={getThemeIcon()} size={20} color={colors.tint} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }} style={dynamicStyles.closeBtn}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <GenericMenu
                        visible={showThemeMenu}
                        onClose={() => setShowThemeMenu(false)}
                        items={themeMenuItems}
                        anchorPosition={themeMenuPosition}
                    />

                    {/* Tab Bar Restored */}
                    <View style={dynamicStyles.tabBar}>
                        {(['info', 'media', 'evolution'] as SettingsTab[]).map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={[
                                    dynamicStyles.tab,
                                    activeTab === tab && dynamicStyles.tabActive
                                ]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Ionicons
                                    name={tab === 'info' ? 'information-circle-outline' : tab === 'media' ? 'images-outline' : 'analytics-outline'}
                                    size={18}
                                    color={activeTab === tab ? colors.tint : colors.textSecondary}
                                />
                                <Text style={[
                                    dynamicStyles.tabText,
                                    activeTab === tab && dynamicStyles.tabTextActive
                                ]}>
                                    {tab === 'info' ? 'Info' : tab === 'media' ? 'Media' : 'Evolution'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Tab Content */}
                    <View style={dynamicStyles.tabContentContainer}>
                        {activeTab === 'info' && renderInfoTab()}
                        {activeTab === 'media' && renderMediaTab()}
                        {activeTab === 'evolution' && renderActivityTab()}
                    </View>

                    {/* Save Button (only on Info tab) */}
                    {activeTab === 'info' && isOwnerOrModerator && (
                        <TouchableOpacity
                            style={[dynamicStyles.saveButton, saving && dynamicStyles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                    <Text style={dynamicStyles.saveButtonText}>Save Changes</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};


export default SpaceSettingsModal;