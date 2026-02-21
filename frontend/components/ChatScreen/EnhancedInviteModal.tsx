// components/ChatScreen/EnhancedInviteModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
    FlatList,
    Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import debounce from 'lodash/debounce';
import axios from '@/services/axios';
import { getToken } from '@/services/TokenService';
import getApiBase from '@/services/getApiBase';
import Avatar from '@/components/Image/Avatar';

interface InviteRecipient {
    id?: string;
    identifier: string;
    type: 'user_id' | 'email' | 'phone' | 'space' | 'invalid';
    isValid: boolean;
    userData?: any;
    isExistingUser?: boolean;
    status?: 'pending' | 'found' | 'not_found' | 'already_in_space' | 'invited';
}

interface EnhancedInviteModalProps {
    visible: boolean;
    spaceId: string;
    spaceTitle: string;
    onClose: () => void;
    onInvite: (recipients: InviteRecipient[]) => Promise<void>;
}

const EnhancedInviteModal: React.FC<EnhancedInviteModalProps> = ({
    visible,
    spaceId,
    spaceTitle,
    onClose,
    onInvite,
}) => {
    const [inputText, setInputText] = useState('');
    const [recipients, setRecipients] = useState<InviteRecipient[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [failedInvites, setFailedInvites] = useState<InviteRecipient[]>([]);
    const [showResults, setShowResults] = useState(false);

    const searchInputRef = useRef<TextInput>(null);
    const API_BASE = getApiBase();

    // Parse input into recipients when comma is typed or on blur
    const parseInput = (text: string) => {
        if (!text.trim()) return [];

        // Split by comma and trim each item
        const items = text.split(',').map(item => item.trim()).filter(item => item.length > 0);

        const newRecipients: InviteRecipient[] = items.map(item => {
            // Check if it's a valid email
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item);

            // Check if it's a valid phone number (with + or 00)
            const isPhone = /^(\+[0-9]{1,3}[0-9]{4,14}|00[0-9]{1,3}[0-9]{4,14})$/.test(item.replace(/\s/g, ''));

            // Check if it's a numeric ID
            const isUserId = /^\d+$/.test(item);

            // Check if it's a space UUID
            const isSpace = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item);

            let type: 'user_id' | 'email' | 'phone' | 'space' | 'invalid' = 'invalid';
            if (isEmail) type = 'email';
            else if (isPhone) type = 'phone';
            else if (isUserId) type = 'user_id';
            else if (isSpace) type = 'space';

            return {
                identifier: item,
                type,
                isValid: type !== 'invalid',
                status: 'pending',
            };
        });

        return newRecipients;
    };

    // Handle input change
    const handleInputChange = (text: string) => {
        setInputText(text);

        // Check if last character is comma
        if (text.endsWith(',')) {
            const newRecipients = parseInput(text);
            if (newRecipients.length > 0) {
                setRecipients(prev => [...prev, ...newRecipients]);
                setInputText('');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        }
    };

    // Handle input submit (when user presses enter/done)
    const handleInputSubmit = () => {
        if (inputText.trim()) {
            const newRecipients = parseInput(inputText);
            if (newRecipients.length > 0) {
                setRecipients(prev => [...prev, ...newRecipients]);
                setInputText('');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        }
    };

    // Remove a recipient
    const removeRecipient = (index: number) => {
        setRecipients(prev => prev.filter((_, i) => i !== index));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Clear all recipients
    const clearAll = () => {
        setRecipients([]);
        setInputText('');
        setSuggestions([]);
        setFailedInvites([]);
    };

    // Debounced search for suggestions
    const debouncedSearch = useRef(
        debounce(async (query: string) => {
            if (!query.trim() || query.length < 2) {
                setSuggestions([]);
                setShowResults(false);
                return;
            }

            setIsSearching(true);
            setShowResults(true);

            try {
                const token = await getToken();
                const response = await axios.post(`${API_BASE}/search/users`, {
                    query: query,
                    limit: 10,
                }, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                setSuggestions(response.data.users || []);
            } catch (error) {
                console.error('Error searching users:', error);
                setSuggestions([]);
            } finally {
                setIsSearching(false);
            }
        }, 500)
    ).current;

    // Trigger search when input changes
    useEffect(() => {
        if (inputText.trim() && !inputText.endsWith(',')) {
            debouncedSearch(inputText);
        } else {
            setSuggestions([]);
            setShowResults(false);
        }

        return () => {
            debouncedSearch.cancel();
        };
    }, [inputText]);

    // Add suggestion to recipients
    const addSuggestion = (user: any) => {
        const newRecipient: InviteRecipient = {
            identifier: user.email || user.phone || user.id.toString(),
            type: user.email ? 'email' : user.phone ? 'phone' : 'user_id',
            isValid: true,
            isExistingUser: true,
            userData: user,
            status: 'found',
        };

        setRecipients(prev => [...prev, newRecipient]);
        setInputText('');
        setSuggestions([]);
        setShowResults(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Validate all recipients before sending
    const validateRecipients = async (): Promise<InviteRecipient[]> => {
        const validated: InviteRecipient[] = [];
        const token = await getToken();

        for (const recipient of recipients) {
            if (recipient.status === 'invited') continue;

            try {
                // For user IDs, emails, and phones, check if user exists
                if (recipient.type !== 'space') {
                    const response = await axios.post(`${API_BASE}/users/lookup`, {
                        identifier: recipient.identifier,
                        type: recipient.type,
                    }, {
                        headers: { Authorization: `Bearer ${token}` },
                    });

                    if (response.data.exists) {
                        recipient.userData = response.data.user;
                        recipient.isExistingUser = true;
                        recipient.status = 'found';
                    } else {
                        recipient.status = 'not_found';
                    }
                } else {
                    // For space invites, check if space exists
                    const response = await axios.get(`${API_BASE}/spaces/${recipient.identifier}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });

                    if (response.data.space) {
                        recipient.userData = response.data.space;
                        recipient.isExistingUser = true;
                        recipient.status = 'found';
                    } else {
                        recipient.status = 'not_found';
                    }
                }
            } catch (error) {
                recipient.status = 'not_found';
            }

            validated.push(recipient);
        }

        return validated;
    };

    // Send invites
    const handleSendInvites = async () => {
        Keyboard.dismiss();
        setIsInviting(true);

        try {
            // First validate all recipients
            const validatedRecipients = await validateRecipients();

            // Separate valid and invalid
            const validRecipients = validatedRecipients.filter(r => r.status === 'found');
            const invalidRecipients = validatedRecipients.filter(r => r.status === 'not_found');

            if (validRecipients.length === 0) {
                Alert.alert(
                    'No Valid Recipients',
                    'None of the entered identifiers could be found. Please check and try again.',
                    [{ text: 'OK' }]
                );
                setIsInviting(false);
                return;
            }

            // Send invites to valid recipients
            await onInvite(validRecipients);

            // Update status of invited recipients
            setRecipients(prev =>
                prev.map(r => {
                    const isInvited = validRecipients.some(v => v.identifier === r.identifier);
                    return isInvited ? { ...r, status: 'invited' } : r;
                })
            );

            // If there were invalid recipients, show them
            if (invalidRecipients.length > 0) {
                setFailedInvites(invalidRecipients);
                Alert.alert(
                    'Partial Success',
                    `${validRecipients.length} invite(s) sent successfully. ${invalidRecipients.length} could not be found.`,
                    [
                        { text: 'View Failed', onPress: () => setFailedInvites(invalidRecipients) },
                        { text: 'OK' }
                    ]
                );
            } else {
                Alert.alert(
                    'Success',
                    `${validRecipients.length} invite(s) sent successfully!`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                clearAll();
                                onClose();
                            }
                        }
                    ]
                );
            }
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

        } catch (error) {
            console.error('Error sending invites:', error);
            Alert.alert('Error', 'Failed to send invites. Please try again.');
        } finally {
            setIsInviting(false);
        }
    };

    // Get icon for recipient type
    const getRecipientIcon = (type: string, status?: string) => {
        if (status === 'invited') return 'checkmark-circle';
        if (status === 'not_found') return 'alert-circle';

        switch (type) {
            case 'email': return 'mail';
            case 'phone': return 'call';
            case 'user_id': return 'person';
            case 'space': return 'cube';
            default: return 'help';
        }
    };

    // Get color for recipient
    const getRecipientColor = (type: string, status?: string) => {
        if (status === 'invited') return '#4CAF50';
        if (status === 'not_found') return '#FF6B6B';

        switch (type) {
            case 'email': return '#FFA726';
            case 'phone': return '#4CAF50';
            case 'user_id': return '#007AFF';
            case 'space': return '#9C27B0';
            default: return '#999';
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Invite to Space</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.spaceTitle}>Inviting to: {spaceTitle}</Text>

                    {/* Recipients Chips */}
                    {recipients.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.recipientsScroll}
                            contentContainerStyle={styles.recipientsContainer}
                        >
                            {recipients.map((recipient, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.recipientChip,
                                        { borderColor: getRecipientColor(recipient.type, recipient.status) }
                                    ]}
                                >
                                    <Ionicons
                                        name={getRecipientIcon(recipient.type, recipient.status)}
                                        size={16}
                                        color={getRecipientColor(recipient.type, recipient.status)}
                                    />
                                    <Text style={styles.recipientText} numberOfLines={1}>
                                        {recipient.identifier}
                                    </Text>
                                    {recipient.status !== 'invited' && (
                                        <TouchableOpacity onPress={() => removeRecipient(index)}>
                                            <Ionicons name="close-circle" size={16} color="#999" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {/* Input Area */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            ref={searchInputRef}
                            style={styles.input}
                            placeholder="Enter email, phone, user ID, or space ID (comma separated)"
                            value={inputText}
                            onChangeText={handleInputChange}
                            onSubmitEditing={handleInputSubmit}
                            returnKeyType="done"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!isInviting}
                        />
                        {inputText.length > 0 && (
                            <TouchableOpacity onPress={handleInputSubmit} style={styles.addButton}>
                                <Ionicons name="add-circle" size={24} color="#007AFF" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.hintText}>
                        Press comma (,) or Enter to add multiple
                    </Text>

                    {/* Search Results / Suggestions */}
                    {showResults && (
                        <View style={styles.suggestionsContainer}>
                            {isSearching ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="small" color="#007AFF" />
                                    <Text style={styles.loadingText}>Searching...</Text>
                                </View>
                            ) : suggestions.length > 0 ? (
                                <>
                                    <Text style={styles.suggestionsTitle}>Suggestions:</Text>
                                    {suggestions.map((user) => (
                                        <TouchableOpacity
                                            key={user.id}
                                            style={styles.suggestionItem}
                                            onPress={() => addSuggestion(user)}
                                        >
                                            <Avatar source={user.profile_photo} size={40} name={user.name} />
                                            <View style={styles.suggestionInfo}>
                                                <Text style={styles.suggestionName}>{user.name}</Text>
                                                <Text style={styles.suggestionDetail}>
                                                    {user.email || user.phone || `@${user.username}`}
                                                </Text>
                                            </View>
                                            <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
                                        </TouchableOpacity>
                                    ))}
                                </>
                            ) : inputText.length >= 2 ? (
                                <Text style={styles.noResultsText}>No users found</Text>
                            ) : null}
                        </View>
                    )}

                    {/* Failed Invites Section */}
                    {failedInvites.length > 0 && (
                        <View style={styles.failedContainer}>
                            <Text style={styles.failedTitle}>Failed Invites:</Text>
                            {failedInvites.map((invite, index) => (
                                <View key={index} style={styles.failedItem}>
                                    <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
                                    <Text style={styles.failedText}>{invite.identifier}</Text>
                                    <Text style={styles.failedReason}>(not found)</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Action Buttons */}
                    <View style={styles.modalButtons}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.modalButtonCancel]}
                            onPress={() => {
                                clearAll();
                                onClose();
                            }}
                            disabled={isInviting}
                        >
                            <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.modalButton,
                                styles.modalButtonConfirm,
                                (recipients.length === 0 || isInviting) && styles.modalButtonDisabled
                            ]}
                            onPress={handleSendInvites}
                            disabled={recipients.length === 0 || isInviting}
                        >
                            {isInviting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.modalButtonTextConfirm}>
                                    Send Invites ({recipients.length})
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 500,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
    },
    spaceTitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        fontStyle: 'italic',
    },
    recipientsScroll: {
        maxHeight: 60,
        marginBottom: 16,
    },
    recipientsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        gap: 8,
    },
    recipientChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f8f8',
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1,
        gap: 6,
    },
    recipientText: {
        fontSize: 14,
        color: '#333',
        maxWidth: 150,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    input: {
        flex: 1,
        fontSize: 16,
        padding: 12,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    addButton: {
        marginLeft: 8,
    },
    hintText: {
        fontSize: 12,
        color: '#999',
        marginBottom: 16,
        fontStyle: 'italic',
    },
    suggestionsContainer: {
        maxHeight: 200,
        marginBottom: 16,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        padding: 8,
    },
    suggestionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
        paddingHorizontal: 8,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    suggestionInfo: {
        flex: 1,
        marginLeft: 12,
    },
    suggestionName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 2,
    },
    suggestionDetail: {
        fontSize: 12,
        color: '#999',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
    },
    loadingText: {
        fontSize: 14,
        color: '#666',
    },
    noResultsText: {
        textAlign: 'center',
        padding: 16,
        color: '#999',
        fontSize: 14,
    },
    failedContainer: {
        backgroundColor: '#FF6B6B10',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    failedTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FF6B6B',
        marginBottom: 8,
    },
    failedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6,
    },
    failedText: {
        fontSize: 14,
        color: '#333',
    },
    failedReason: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalButtonCancel: {
        backgroundColor: '#f0f0f0',
    },
    modalButtonConfirm: {
        backgroundColor: '#007AFF',
    },
    modalButtonDisabled: {
        opacity: 0.5,
    },
    modalButtonTextCancel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    modalButtonTextConfirm: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default EnhancedInviteModal;