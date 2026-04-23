import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    FlatList,
    Image,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { MediaCompressor } from '@/utils/mediaCompressor';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';
import { useAppTheme } from '@/hooks/useAppTheme';
import Avatar from '@/components/Image/Avatar';
import { useTranslation } from '@/constants/i18n';

type Step = 'CONTACTS' | 'DETAILS';
type PrivacyTier = 'general' | 'protected' | 'channel';

interface SpaceCreationModalProps {
    visible: boolean;
    onClose: () => void;
    contacts: any[];
    onSpaceCreated: (newSpace: any) => void;
}

const SpaceCreationModal: React.FC<SpaceCreationModalProps> = ({
    visible,
    onClose,
    contacts,
    onSpaceCreated,
}) => {
    const insets = useSafeAreaInsets();
    const { colors, activeScheme } = useAppTheme();
    const { t, isRTL } = useTranslation();
    const styles = getStyles(colors, activeScheme, isRTL);
    const [step, setStep] = useState<Step>('CONTACTS');

    // Contacts Step State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());

    // Details Step State
    const [spaceName, setSpaceName] = useState('');
    const [spaceDescription, setSpaceDescription] = useState('');
    const [spacePhoto, setSpacePhoto] = useState<string | null>(null);
    const [spacePhotoFile, setSpacePhotoFile] = useState<File | null>(null);
    const [privacyTier, setPrivacyTier] = useState<PrivacyTier>('general');
    const [enableAI, setEnableAI] = useState(false);

    const [isCreating, setIsCreating] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setStep('CONTACTS');
            setSearchQuery('');
            setSelectedContacts(new Set());
            setSpaceName('');
            setSpaceDescription('');
            setSpacePhoto(null);
            setSpacePhotoFile(null);
            setPrivacyTier('general');
            setEnableAI(false);
            setIsCreating(false);
            setIsUploadingPhoto(false);
        }
    }, [visible]);

    // --- Contacts Step Logic ---
    const filteredContacts = useMemo(() => {
        if (!searchQuery.trim()) return contacts;
        const lowerQuery = searchQuery.toLowerCase();
        return contacts.filter(
            (c) =>
                c.name.toLowerCase().includes(lowerQuery) ||
                c.email?.toLowerCase().includes(lowerQuery) ||
                c.username?.toLowerCase().includes(lowerQuery)
        );
    }, [contacts, searchQuery]);

    const toggleContactSelection = useCallback((userId: number) => {
        setSelectedContacts((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
        if (Platform.OS !== 'web') {
            Haptics.selectionAsync();
        }
    }, []);

    const handleNextStep = () => {
        setStep('DETAILS');
    };

    const renderContactItem = useCallback(
        ({ item }: { item: any }) => {
            const isSelected = selectedContacts.has(item.user_id);
            return (
                <TouchableOpacity
                    style={[styles.contactRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                    onPress={() => toggleContactSelection(item.user_id)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.contactAvatarContainer, { [isRTL ? 'marginLeft' : 'marginRight']: 12 }]}>
                        <Avatar
                            source={item.avatar || null}
                            name={item.name}
                            size={44}
                        />
                        {isSelected && (
                            <View style={[styles.contactSelectedBadge, { borderColor: colors.background, [isRTL ? 'left' : 'right']: -2 }]}>
                                <Ionicons name="checkmark" size={14} color="#fff" />
                            </View>
                        )}
                    </View>
                    <View style={[styles.contactInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                        <Text style={styles.contactName}>{item.name}</Text>
                        {item.username && <Text style={styles.contactUsername}>@{item.username}</Text>}
                    </View>
                    <View style={[styles.checkboxContainer, { [isRTL ? 'marginRight' : 'marginLeft']: 10 }]}>
                        <Ionicons
                            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={24}
                            color={isSelected ? colors.tint : (activeScheme === 'dark' ? colors.border : '#C7C7CC')}
                        />
                    </View>
                </TouchableOpacity>
            );
        },
        [selectedContacts, toggleContactSelection]
    );

    // --- Details Step Logic ---
    const handlePickPhoto = async () => {
        if (Platform.OS === 'web') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (event: any) => {
                const file = event.target?.files?.[0];
                if (file) {
                    setIsUploadingPhoto(true);
                    try {
                        const uri = URL.createObjectURL(file);
                        // Aggressive compression like settings/index.tsx
                        const compressedUri = await MediaCompressor.compressImage(uri, {
                            maxWidth: 200,
                            quality: 0.5
                        });
                        setSpacePhoto(compressedUri);
                        
                        const response = await fetch(compressedUri);
                        const blob = await response.blob();
                        const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
                        setSpacePhotoFile(compressedFile);
                    } catch (err) {
                        console.error('Web compression failed:', err);
                        setSpacePhoto(URL.createObjectURL(file));
                        setSpacePhotoFile(file);
                    } finally {
                        setIsUploadingPhoto(false);
                    }
                }
            };
            input.click();
            return;
        }

        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert(t('permission_required'), t('allow_photo_access'));
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
            });
            if (!result.canceled && result.assets?.[0]) {
                setIsUploadingPhoto(true);
                try {
                    // Aggressive compression like settings/index.tsx
                    const compressedUri = await MediaCompressor.compressImage(result.assets[0].uri, {
                        maxWidth: 200,
                        quality: 0.5
                    });
                    setSpacePhoto(compressedUri);
                } catch (err) {
                    console.error('Compression failed:', err);
                    setSpacePhoto(result.assets[0].uri);
                } finally {
                    setIsUploadingPhoto(false);
                }
            }
        } catch (err) {
            console.error('Gallery pick error:', err);
            Alert.alert(t('error'), t('error'));
        }
    };

    const handleCreateSpace = async () => {
        if (!spaceName.trim()) {
            Alert.alert(t('required'), t('space_name_required'));
            return;
        }

        setIsCreating(true);
        try {
            const collaborationService = CollaborationService.getInstance();

            // 1. Create the space first without participants (backend ignores them anyway)
            const payload: any = {
                title: spaceName.trim(),
                description: spaceDescription.trim(),
                space_type: privacyTier,
                settings: {
                    privacy_tier: privacyTier,
                    has_ai_assistant: enableAI,
                },
                ai_personality: enableAI ? 'helpful' : undefined,
            };

            const response = await collaborationService.createSpace(payload);
            const newSpaceId = response.id;

            // 2. Upload photo if selected
            if (spacePhoto) {
                setIsUploadingPhoto(true);
                try {
                    if (Platform.OS === 'web' && spacePhotoFile) {
                        await uploadSpacePhotoWeb(newSpaceId, spacePhotoFile);
                    } else if (Platform.OS !== 'web' && !spacePhoto.startsWith('http')) {
                        await uploadSpacePhoto(newSpaceId, spacePhoto);
                    }
                } catch (photoError) {
                    console.error('Photo upload failed, but space was created:', photoError);
                }
            }

            // 3. Send invitations individually and collect errors
            const participantIds = Array.from(selectedContacts);
            const failedInvites: number[] = [];

            if (participantIds.length > 0) {
                console.log(`Sending invitations to ${participantIds.length} users for space ${newSpaceId}`);

                for (const userId of participantIds) {
                    try {
                        await collaborationService.inviteToSpace(newSpaceId, [userId]);
                    } catch (inviteError) {
                        console.error(`Failed to invite user ${userId}:`, inviteError);
                        failedInvites.push(userId);
                    }
                }
            }

            if (Platform.OS !== 'web') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            // 4. Handle summary of errors if any
            if (failedInvites.length > 0) {
                const failedCount = failedInvites.length;
                const totalCount = participantIds.length;
                Alert.alert(
                    t('partial_success'),
                    t('space_created_invite_error').replace('{count}', failedCount.toString()).replace('{total}', totalCount.toString()),
                    [{
                        text: t('ok'), onPress: () => {
                            onSpaceCreated(response);
                            onClose();
                        }
                    }]
                );
            } else {
                // 5. Notify parent and close (Routing happens here via onSpaceCreated)
                onSpaceCreated(response);
                onClose();
            }
        } catch (error: any) {
            console.error('Failed to create space:', error);
            Alert.alert(t('creation_failed'), error.message || t('could_not_create_space'));
        } finally {
            setIsCreating(false);
            setIsUploadingPhoto(false);
        }
    };

    const uploadSpacePhoto = async (spaceId: string, uri: string) => {
        try {
            // Compress first
            const compressed = await MediaCompressor.prepareMediaForUpload(uri);
            const finalUri = compressed.uri;

            const token = await getToken();
            const API_BASE = getApiBase();
            const formData = new FormData();
            formData.append('file', {
                uri: finalUri,
                type: compressed.type || 'image/jpeg',
                name: compressed.fileName || `space_photo_${Date.now()}.jpg`,
            } as any);
            formData.append('type', 'image');
            formData.append('is_logo', 'true');

            await fetch(`${API_BASE}/spaces/${spaceId}/upload-media`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });
        } catch (err) {
            console.error('Photo upload error during creation:', err);
        }
    };

    const uploadSpacePhotoWeb = async (spaceId: string, file: File) => {
        try {
            // Prepare for web (compression happens inside if more than 2MB)
            const uri = URL.createObjectURL(file);
            const compressed = await MediaCompressor.prepareMediaForUpload(uri, file.name);
            
            let finalFile: any = file;
            if (compressed.uri !== uri) {
                // If it was actually compressed, convert back to blob/file
                const response = await fetch(compressed.uri);
                const blob = await response.blob();
                finalFile = new File([blob], compressed.fileName, { type: compressed.type });
            }

            const token = await getToken();
            const API_BASE = getApiBase();
            const formData = new FormData();
            formData.append('file', finalFile);
            formData.append('type', 'image');
            formData.append('is_logo', 'true');

            await fetch(`${API_BASE}/spaces/${spaceId}/upload-media`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });
        } catch (err) {
            console.error('Photo upload error during creation (web):', err);
        }
    };

    // --- Renders ---
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={[GlobalStyles.popupContainer, { paddingTop: insets.top, backgroundColor: activeScheme === 'dark' ? colors.background : '#F2F2F7' }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <TouchableOpacity onPress={step === 'CONTACTS' ? onClose : () => setStep('CONTACTS')} style={styles.headerButton}>
                        <Text style={[styles.headerButtonText, { textAlign: isRTL ? 'right' : 'left' }]}>{step === 'CONTACTS' ? t('cancel') : t('back')}</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {step === 'CONTACTS' ? t('new_space') : t('space_details')}
                    </Text>
                    <TouchableOpacity
                        onPress={step === 'CONTACTS' ? handleNextStep : handleCreateSpace}
                        style={styles.headerButton}
                        disabled={isCreating}
                    >
                        {isCreating ? (
                            <ActivityIndicator size="small" color={colors.tint} />
                        ) : (
                            <Text style={[styles.headerButtonText, { fontWeight: '600', textAlign: isRTL ? 'left' : 'right', color: colors.tint }]}>
                                {step === 'CONTACTS' ? t('next') : t('create')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {step === 'CONTACTS' && (
                    <View style={styles.stepContainer}>
                        <View style={[styles.searchContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <Ionicons name="search" size={20} color={colors.textSecondary} style={[styles.searchIcon, { [isRTL ? 'marginLeft' : 'marginRight']: 8 }]} />
                            <TextInput
                                style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
                                placeholder={t('search_contacts_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                clearButtonMode="while-editing"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={[styles.selectionSummary, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                            <Text style={styles.selectionText}>
                                {selectedContacts.size} {t('selected')}
                            </Text>
                        </View>

                        <FlatList
                            data={filteredContacts}
                            keyExtractor={(item) => item.user_id.toString()}
                            renderItem={renderContactItem}
                            contentContainerStyle={styles.listContent}
                            keyboardShouldPersistTaps="handled"
                            initialNumToRender={15}
                            maxToRenderPerBatch={20}
                            windowSize={5}
                        />
                    </View>
                )}

                {step === 'DETAILS' && (
                    <View style={styles.stepContainer}>
                        {/* Form Fields for Details Step */}
                        <View style={styles.detailsTopContainer}>
                            <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto} disabled={isUploadingPhoto}>
                                {spacePhoto ? (
                                    <Image source={{ uri: spacePhoto }} style={styles.photoPreview} />
                                ) : (
                                    <View style={[styles.photoPlaceholder, { backgroundColor: activeScheme === 'dark' ? colors.muted : '#E5E5EA' }]}>
                                        <Ionicons name="camera" size={30} color={colors.tint} />
                                    </View>
                                )}
                                {isUploadingPhoto ? (
                                    <View style={[styles.photoEditBadge, { backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'transparent' }]}>
                                        <ActivityIndicator size="small" color="#fff" />
                                    </View>
                                ) : (
                                    <View style={[styles.photoEditBadge, { backgroundColor: colors.tint, borderColor: colors.background }]}>
                                        <Ionicons name="add" size={14} color="#fff" />
                                    </View>
                                )}
                            </TouchableOpacity>

                            <View style={styles.nameInputContainer}>
                                <TextInput
                                    style={[styles.nameInput, { textAlign: isRTL ? 'right' : 'left' }]}
                                    placeholder={t('name')}
                                    placeholderTextColor={colors.textSecondary}
                                    value={spaceName}
                                    onChangeText={setSpaceName}
                                    maxLength={100}
                                    autoFocus
                                />
                            </View>
                        </View>

                        <View style={styles.formSection}>
                            <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t('description_optional')}</Text>
                            <TextInput
                                style={[styles.descriptionInput, { textAlign: isRTL ? 'right' : 'left' }]}
                                placeholder={t('bio')}
                                placeholderTextColor={colors.textSecondary}
                                value={spaceDescription}
                                onChangeText={setSpaceDescription}
                                multiline
                                maxLength={500}
                            />
                        </View>

                        <View style={styles.formSection}>
                            <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t('privacy_tier')}</Text>

                            <TouchableOpacity style={[styles.tierOption, { flexDirection: isRTL ? 'row-reverse' : 'row' }, privacyTier === 'general' && styles.tierOptionSelected]} onPress={() => setPrivacyTier('general')}>
                                <Ionicons name="globe-outline" size={24} color={privacyTier === 'general' ? '#007AFF' : '#666'} />
                                <View style={[styles.tierTextContainer, { [isRTL ? 'marginRight' : 'marginLeft']: 16 }]}>
                                    <Text style={[styles.tierTitle, { textAlign: isRTL ? 'right' : 'left' }, privacyTier === 'general' && styles.tierTitleSelected]}>{t('tier_general')}</Text>
                                    <Text style={[styles.tierDescription, { textAlign: isRTL ? 'right' : 'left' }]}>{t('tier_general_desc')}</Text>
                                </View>
                                {privacyTier === 'general' && <Ionicons name="checkmark" size={20} color={colors.tint} />}
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.tierOption, { flexDirection: isRTL ? 'row-reverse' : 'row' }, privacyTier === 'protected' && styles.tierOptionSelected]} onPress={() => setPrivacyTier('protected')}>
                                <Ionicons name="shield-checkmark-outline" size={24} color={privacyTier === 'protected' ? '#34C759' : '#666'} />
                                <View style={[styles.tierTextContainer, { [isRTL ? 'marginRight' : 'marginLeft']: 16 }]}>
                                    <Text style={[styles.tierTitle, { textAlign: isRTL ? 'right' : 'left' }, privacyTier === 'protected' && { color: '#34C759' }]}>{t('tier_protected')}</Text>
                                    <Text style={[styles.tierDescription, { textAlign: isRTL ? 'right' : 'left' }]}>{t('tier_protected_desc')}</Text>
                                </View>
                                {privacyTier === 'protected' && <Ionicons name="checkmark" size={20} color="#34C759" />}
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.tierOption, { flexDirection: isRTL ? 'row-reverse' : 'row' }, privacyTier === 'channel' && styles.tierOptionSelected]} onPress={() => setPrivacyTier('channel')}>
                                <Ionicons name="megaphone-outline" size={24} color={privacyTier === 'channel' ? '#FF9500' : '#666'} />
                                <View style={[styles.tierTextContainer, { [isRTL ? 'marginRight' : 'marginLeft']: 16 }]}>
                                    <Text style={[styles.tierTitle, { textAlign: isRTL ? 'right' : 'left' }, privacyTier === 'channel' && { color: '#FF9500' }]}>{t('tier_channel')}</Text>
                                    <Text style={[styles.tierDescription, { textAlign: isRTL ? 'right' : 'left' }]}>{t('tier_channel_desc')}</Text>
                                </View>
                                {privacyTier === 'channel' && <Ionicons name="checkmark" size={20} color="#FF9500" />}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.formSection}>
                            <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t('capabilities')}</Text>
                            <TouchableOpacity style={[styles.tierOption, { flexDirection: isRTL ? 'row-reverse' : 'row' }, enableAI && styles.tierOptionSelected]} onPress={() => setEnableAI(!enableAI)}>
                                <Ionicons name="sparkles-outline" size={24} color={enableAI ? '#AF52DE' : '#666'} />
                                <View style={[styles.tierTextContainer, { [isRTL ? 'marginRight' : 'marginLeft']: 16 }]}>
                                    <Text style={[styles.tierTitle, { textAlign: isRTL ? 'right' : 'left' }, enableAI && { color: '#AF52DE' }]}>{t('ai_ghost_insights')}</Text>
                                    <Text style={[styles.tierDescription, { textAlign: isRTL ? 'right' : 'left' }]}>{t('ai_ghost_insights_desc')}</Text>
                                </View>
                                {enableAI && <Ionicons name="checkmark" size={20} color="#AF52DE" />}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
};
 
const getStyles = (colors: any, activeScheme: string, isRTL: boolean) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        paddingBottom: 10,
        paddingHorizontal: 16,
        backgroundColor: colors.background,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    headerButton: {
        minWidth: 60,
        justifyContent: 'center',
    },
    headerButtonText: {
        color: colors.tint,
        fontSize: 17,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.text,
    },
    stepContainer: {
        flex: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: activeScheme === 'dark' ? colors.muted : '#fff',
        margin: 16,
        paddingHorizontal: 12,
        borderRadius: 10,
        height: 36,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 17,
        height: '100%',
        color: colors.text,
    },
    selectionSummary: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    selectionText: {
        fontSize: 13,
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    listContent: {
        backgroundColor: colors.background,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
    },
    contactAvatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    contactAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    contactAvatarFallback: {
        backgroundColor: activeScheme === 'dark' ? colors.muted : '#E5E5EA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contactAvatarText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    contactSelectedBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#34C759',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    contactInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    contactName: {
        fontSize: 17,
        fontWeight: '500',
        color: colors.text,
    },
    contactUsername: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    checkboxContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    detailsTopContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: 16,
        marginTop: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    photoPicker: {
        position: 'relative',
        marginRight: 16,
    },
    photoPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoPreview: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    photoEditBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    nameInputContainer: {
        flex: 1,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    nameInput: {
        fontSize: 17,
        paddingVertical: 10,
        fontWeight: '500',
        color: colors.text,
    },
    formSection: {
        marginTop: 20,
    },
    sectionLabel: {
        marginLeft: 16,
        marginBottom: 8,
        fontSize: 13,
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    descriptionInput: {
        backgroundColor: colors.background,
        padding: 16,
        fontSize: 17,
        color: colors.text,
        minHeight: 80,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    tierOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    tierOptionSelected: {
        backgroundColor: colors.surface,
    },
    tierTextContainer: {
        flex: 1,
        marginLeft: 16,
    },
    tierTitle: {
        fontSize: 17,
        fontWeight: '500',
        color: colors.text,
        marginBottom: 2,
    },
    tierTitleSelected: {
        color: colors.tint,
    },
    tierDescription: {
        fontSize: 14,
        color: colors.textSecondary,
    },
});

export default SpaceCreationModal;
