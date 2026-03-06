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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';

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
    const [step, setStep] = useState<Step>('CONTACTS');

    // Contacts Step State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());

    // Details Step State
    const [spaceName, setSpaceName] = useState('');
    const [spaceDescription, setSpaceDescription] = useState('');
    const [spacePhoto, setSpacePhoto] = useState<string | null>(null);
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
                    style={styles.contactRow}
                    onPress={() => toggleContactSelection(item.user_id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.contactAvatarContainer}>
                        {item.avatar ? (
                            <Image source={{ uri: item.avatar }} style={styles.contactAvatar} />
                        ) : (
                            <View style={[styles.contactAvatar, styles.contactAvatarFallback]}>
                                <Text style={styles.contactAvatarText}>
                                    {item.name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        {isSelected && (
                            <View style={styles.contactSelectedBadge}>
                                <Ionicons name="checkmark" size={14} color="#fff" />
                            </View>
                        )}
                    </View>
                    <View style={styles.contactInfo}>
                        <Text style={styles.contactName}>{item.name}</Text>
                        {item.username && <Text style={styles.contactUsername}>@{item.username}</Text>}
                    </View>
                    <View style={styles.checkboxContainer}>
                        <Ionicons
                            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={24}
                            color={isSelected ? '#007AFF' : '#C7C7CC'}
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
                    setSpacePhoto(URL.createObjectURL(file));
                }
            };
            input.click();
            return;
        }

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
                setSpacePhoto(result.assets[0].uri);
            }
        } catch (err) {
            console.error('Gallery pick error:', err);
            Alert.alert('Error', 'Could not open gallery.');
        }
    };

    const handleCreateSpace = async () => {
        if (!spaceName.trim()) {
            Alert.alert('Required', 'Please enter a space name.');
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
            if (spacePhoto && !spacePhoto.startsWith('http') && !spacePhoto.startsWith('blob:')) {
                setIsUploadingPhoto(true);
                try {
                    await uploadSpacePhoto(newSpaceId, spacePhoto);
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
                    'Partial Success',
                    `Space created, but could not invite ${failedCount} out of ${totalCount} people. They can be invited later from space settings.`,
                    [{
                        text: 'OK', onPress: () => {
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
            Alert.alert('Creation Failed', error.message || 'Could not create the space.');
        } finally {
            setIsCreating(false);
            setIsUploadingPhoto(false);
        }
    };

    const uploadSpacePhoto = async (spaceId: string, uri: string) => {
        try {
            const token = await getToken();
            const API_BASE = getApiBase();
            const formData = new FormData();
            formData.append('file', {
                uri,
                type: 'image/jpeg',
                name: `space_photo_${Date.now()}.jpg`,
            } as any);
            formData.append('type', 'image');

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

    // --- Renders ---
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={step === 'CONTACTS' ? onClose : () => setStep('CONTACTS')} style={styles.headerButton}>
                        <Text style={styles.headerButtonText}>{step === 'CONTACTS' ? 'Cancel' : 'Back'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {step === 'CONTACTS' ? 'New Space' : 'Space Details'}
                    </Text>
                    <TouchableOpacity
                        onPress={step === 'CONTACTS' ? handleNextStep : handleCreateSpace}
                        style={styles.headerButton}
                        disabled={isCreating}
                    >
                        {isCreating ? (
                            <ActivityIndicator size="small" color="#007AFF" />
                        ) : (
                            <Text style={[styles.headerButtonText, { fontWeight: '600', textAlign: 'right' }]}>
                                {step === 'CONTACTS' ? 'Next' : 'Create'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {step === 'CONTACTS' && (
                    <View style={styles.stepContainer}>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search contacts..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                clearButtonMode="while-editing"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.selectionSummary}>
                            <Text style={styles.selectionText}>
                                {selectedContacts.size} selected
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
                            <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto}>
                                {spacePhoto ? (
                                    <Image source={{ uri: spacePhoto }} style={styles.photoPreview} />
                                ) : (
                                    <View style={styles.photoPlaceholder}>
                                        <Ionicons name="camera" size={30} color="#007AFF" />
                                    </View>
                                )}
                                <View style={styles.photoEditBadge}>
                                    <Ionicons name="add" size={14} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.nameInputContainer}>
                                <TextInput
                                    style={styles.nameInput}
                                    placeholder="Space Name"
                                    value={spaceName}
                                    onChangeText={setSpaceName}
                                    maxLength={100}
                                    autoFocus
                                />
                            </View>
                        </View>

                        <View style={styles.formSection}>
                            <Text style={styles.sectionLabel}>Description (Optional)</Text>
                            <TextInput
                                style={styles.descriptionInput}
                                placeholder="What is this space for?"
                                value={spaceDescription}
                                onChangeText={setSpaceDescription}
                                multiline
                                maxLength={500}
                            />
                        </View>

                        <View style={styles.formSection}>
                            <Text style={styles.sectionLabel}>Privacy Tier</Text>

                            <TouchableOpacity style={[styles.tierOption, privacyTier === 'general' && styles.tierOptionSelected]} onPress={() => setPrivacyTier('general')}>
                                <Ionicons name="globe-outline" size={24} color={privacyTier === 'general' ? '#007AFF' : '#666'} />
                                <View style={styles.tierTextContainer}>
                                    <Text style={[styles.tierTitle, privacyTier === 'general' && styles.tierTitleSelected]}>General</Text>
                                    <Text style={styles.tierDescription}>Open group. Anyone can find and join.</Text>
                                </View>
                                {privacyTier === 'general' && <Ionicons name="checkmark" size={20} color="#007AFF" />}
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.tierOption, privacyTier === 'protected' && styles.tierOptionSelected]} onPress={() => setPrivacyTier('protected')}>
                                <Ionicons name="shield-checkmark-outline" size={24} color={privacyTier === 'protected' ? '#34C759' : '#666'} />
                                <View style={styles.tierTextContainer}>
                                    <Text style={[styles.tierTitle, privacyTier === 'protected' && { color: '#34C759' }]}>Protected</Text>
                                    <Text style={styles.tierDescription}>Private group. Invite only. Hidden from search.</Text>
                                </View>
                                {privacyTier === 'protected' && <Ionicons name="checkmark" size={20} color="#34C759" />}
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.tierOption, privacyTier === 'channel' && styles.tierOptionSelected]} onPress={() => setPrivacyTier('channel')}>
                                <Ionicons name="megaphone-outline" size={24} color={privacyTier === 'channel' ? '#FF9500' : '#666'} />
                                <View style={styles.tierTextContainer}>
                                    <Text style={[styles.tierTitle, privacyTier === 'channel' && { color: '#FF9500' }]}>Channel</Text>
                                    <Text style={styles.tierDescription}>Broadcast only. Participants cannot chat.</Text>
                                </View>
                                {privacyTier === 'channel' && <Ionicons name="checkmark" size={20} color="#FF9500" />}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.formSection}>
                            <Text style={styles.sectionLabel}>Capabilities</Text>
                            <TouchableOpacity style={[styles.tierOption, enableAI && styles.tierOptionSelected]} onPress={() => setEnableAI(!enableAI)}>
                                <Ionicons name="sparkles-outline" size={24} color={enableAI ? '#AF52DE' : '#666'} />
                                <View style={styles.tierTextContainer}>
                                    <Text style={[styles.tierTitle, enableAI && { color: '#AF52DE' }]}>AI Ghost Insights</Text>
                                    <Text style={styles.tierDescription}>Enable AI summaries and creative suggestions.</Text>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
        top: 40
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        paddingBottom: 10,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#C7C7CC',
    },
    headerButton: {
        minWidth: 60,
        justifyContent: 'center',
    },
    headerButtonText: {
        color: '#007AFF',
        fontSize: 17,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000',
    },
    stepContainer: {
        flex: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
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
    },
    selectionSummary: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    selectionText: {
        fontSize: 13,
        color: '#8E8E93',
        textTransform: 'uppercase',
    },
    listContent: {
        backgroundColor: '#fff',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#C7C7CC',
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#C7C7CC',
        backgroundColor: '#fff',
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
        backgroundColor: '#E5E5EA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contactAvatarText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#8E8E93',
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
        borderColor: '#fff',
    },
    contactInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    contactName: {
        fontSize: 17,
        fontWeight: '500',
        color: '#000',
    },
    contactUsername: {
        fontSize: 14,
        color: '#8E8E93',
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
        backgroundColor: '#fff',
        padding: 16,
        marginTop: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: '#C7C7CC',
    },
    photoPicker: {
        position: 'relative',
        marginRight: 16,
    },
    photoPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#E5E5EA',
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
        backgroundColor: '#007AFF',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    nameInputContainer: {
        flex: 1,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#C7C7CC',
    },
    nameInput: {
        fontSize: 17,
        paddingVertical: 10,
        fontWeight: '500',
    },
    formSection: {
        marginTop: 20,
    },
    sectionLabel: {
        marginLeft: 16,
        marginBottom: 8,
        fontSize: 13,
        color: '#8E8E93',
        textTransform: 'uppercase',
    },
    descriptionInput: {
        backgroundColor: '#fff',
        padding: 16,
        fontSize: 17,
        minHeight: 80,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: '#C7C7CC',
    },
    tierOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#C7C7CC',
    },
    tierOptionSelected: {
        backgroundColor: '#F2F2F7',
    },
    tierTextContainer: {
        flex: 1,
        marginLeft: 16,
    },
    tierTitle: {
        fontSize: 17,
        fontWeight: '500',
        color: '#000',
        marginBottom: 2,
    },
    tierTitleSelected: {
        color: '#007AFF',
    },
    tierDescription: {
        fontSize: 14,
        color: '#8E8E93',
    },
});

export default SpaceCreationModal;
