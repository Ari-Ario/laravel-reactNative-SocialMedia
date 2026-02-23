// components/ChatScreen/PollComponent.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    Alert,
    Platform,
    ActivityIndicator,
    Switch,
    Animated,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
// Conditionally import DateTimePicker only on native platforms
let DateTimePicker: any = null;
// if (Platform.OS !== 'web') {
//     DateTimePicker = require('@react-native-community/datetimepicker').default;
// }
import { useRouter } from 'expo-router';
import Avatar from '@/components/Image/Avatar';
import CollaborationService from '@/services/ChatScreen/CollaborationService';

export interface PollOption {
    id: string;
    text: string;
    votes: number[];
    voters: { userId: number; name: string; avatar?: string }[];
    percentage?: number;
}

export interface Poll {
    id: string;
    spaceId: string;
    createdBy: {
        id: number;
        name: string;
        avatar?: string;
    };
    question: string;
    options: PollOption[];
    type: 'single' | 'multiple' | 'ranked' | 'weighted';
    settings: {
        allowMultipleVotes: boolean;
        allowVoteChange: boolean;
        showResults: 'always' | 'after_vote' | 'after_deadline' | 'creator_only';
        anonymous: boolean;
        weightedVoting: boolean;
        quorum?: number; // Minimum participants needed
        maxSelections?: number; // For multiple choice
    };
    deadline?: Date;
    status: 'draft' | 'active' | 'closed' | 'archived';
    totalVotes: number;
    uniqueVoters: number;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date;
    closedBy?: number;
    forwardedFrom?: string[]; // Space IDs where this poll was forwarded
    parentPollId?: string; // For poll chains/threads
    tags?: string[];
}

interface PollComponentProps {
    spaceId: string;
    currentUserId: number;
    currentUserRole: string;
    onPollCreated?: (poll: Poll) => void;
    onPollUpdated?: (poll: Poll) => void;
    onPollClosed?: (pollId: string, results: any) => void;
    onPollForwarded?: (pollId: string, targetSpaceIds: string[]) => void;
    isVisible: boolean;
    onClose: () => void;
    editPoll?: Poll; // For editing existing poll
    isEditing?: boolean; // New prop to differentiate
}

const PollComponent: React.FC<PollComponentProps> = ({
    spaceId,
    currentUserId,
    currentUserRole,
    onPollCreated,
    onPollUpdated,
    onPollClosed,
    onPollForwarded,
    isVisible,
    onClose,
    editPoll,
    isEditing = false,
}) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [pollType, setPollType] = useState<'single' | 'multiple' | 'ranked' | 'weighted'>('single');
    const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
    const [allowVoteChange, setAllowVoteChange] = useState(true);
    const [showResults, setShowResults] = useState<'always' | 'after_vote' | 'after_deadline' | 'creator_only'>('after_vote');
    const [anonymous, setAnonymous] = useState(false);
    const [weightedVoting, setWeightedVoting] = useState(false);
    const [hasDeadline, setHasDeadline] = useState(false);
    const [deadline, setDeadline] = useState<Date>(new Date(Date.now() + 86400000)); // Default 24h
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [quorum, setQuorum] = useState<string>('');
    const [maxSelections, setMaxSelections] = useState<string>('');
    const [tags, setTags] = useState<string>('');
    const [forwardToSpaces, setForwardToSpaces] = useState<string[]>([]);
    const [availableSpaces, setAvailableSpaces] = useState<any[]>([]);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedForwardSpaces, setSelectedForwardSpaces] = useState<Set<string>>(new Set());
    const [currentStep, setCurrentStep] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);

    const router = useRouter();
    const fadeAnim = useState(new Animated.Value(0))[0];

    const collaborationService = CollaborationService.getInstance();

    useEffect(() => {
        if (isVisible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();

            if (editPoll) {
                // Load existing poll for editing
                setQuestion(editPoll.question);
                setOptions(editPoll.options.map(o => o.text));
                setPollType(editPoll.type);
                setAllowMultipleVotes(editPoll.settings.allowMultipleVotes);
                setAllowVoteChange(editPoll.settings.allowVoteChange);
                setShowResults(editPoll.settings.showResults);
                setAnonymous(editPoll.settings.anonymous);
                setWeightedVoting(editPoll.settings.weightedVoting);
                if (editPoll.deadline) {
                    setHasDeadline(true);
                    setDeadline(new Date(editPoll.deadline));
                }
                if (editPoll.settings.quorum) setQuorum(editPoll.settings.quorum.toString());
                if (editPoll.settings.maxSelections) setMaxSelections(editPoll.settings.maxSelections.toString());
                if (editPoll.tags) setTags(editPoll.tags.join(', '));
            } else {
                // Reset form
                resetForm();
            }
        }
    }, [isVisible, editPoll]);

    const resetForm = () => {
        setQuestion('');
        setOptions(['', '']);
        setPollType('single');
        setAllowMultipleVotes(false);
        setAllowVoteChange(true);
        setShowResults('after_vote');
        setAnonymous(false);
        setWeightedVoting(false);
        setHasDeadline(false);
        setDeadline(new Date(Date.now() + 86400000));
        setQuorum('');
        setMaxSelections('');
        setTags('');
        setSelectedForwardSpaces(new Set());
        setCurrentStep(1);
    };

    const safeHaptics = {
        impact: async (style: any = Haptics.ImpactFeedbackStyle.Light) => {
            if (Platform.OS !== 'web') {
                try {
                    await Haptics.impactAsync(style);
                } catch (error) {
                    console.warn('Haptics not available:', error);
                }
            }
        },
        notification: async (type: any = Haptics.NotificationFeedbackType.Success) => {
            if (Platform.OS !== 'web') {
                try {
                    await Haptics.notificationAsync(type);
                } catch (error) {
                    console.warn('Haptics not available:', error);
                }
            }
        }
    };

    // Compute diff between original and updated poll
    const computePollDiff = (original: any, updated: any): string => {
        const changes: string[] = [];

        if (original.question !== updated.question) {
            changes.push(`• Question changed from "${original.question}" to "${updated.question}"`);
        }

        const originalOptions = original.options.map((o: any) => o.text);
        const updatedOptions = updated.options.map((o: any) => o.text);

        if (JSON.stringify(originalOptions) !== JSON.stringify(updatedOptions)) {
            changes.push(`• Options changed:`);
            originalOptions.forEach((opt: string, idx: number) => {
                if (updatedOptions[idx] && opt !== updatedOptions[idx]) {
                    changes.push(`  - Option ${idx + 1}: "${opt}" → "${updatedOptions[idx]}"`);
                }
            });
            if (updatedOptions.length > originalOptions.length) {
                changes.push(`  - Added option: "${updatedOptions[updatedOptions.length - 1]}"`);
            }
            if (updatedOptions.length < originalOptions.length) {
                changes.push(`  - Removed option: "${originalOptions[originalOptions.length - 1]}"`);
            }
        }

        // Compare settings (simplified)
        const settingsChanged = [];
        if (original.settings.allowMultipleVotes !== updated.settings.allowMultipleVotes) settingsChanged.push('allowMultipleVotes');
        if (original.settings.allowVoteChange !== updated.settings.allowVoteChange) settingsChanged.push('allowVoteChange');
        if (original.settings.showResults !== updated.settings.showResults) settingsChanged.push('showResults');
        if (original.settings.anonymous !== updated.settings.anonymous) settingsChanged.push('anonymous');
        if (original.settings.weightedVoting !== updated.settings.weightedVoting) settingsChanged.push('weightedVoting');
        if (original.settings.quorum !== updated.settings.quorum) settingsChanged.push('quorum');
        if (original.settings.maxSelections !== updated.settings.maxSelections) settingsChanged.push('maxSelections');

        if (settingsChanged.length > 0) {
            changes.push(`• Settings updated: ${settingsChanged.join(', ')}`);
        }

        if (changes.length === 0) {
            return "No significant changes detected.";
        }

        return changes.join('\n');
    };


    const addOption = async () => {
        if (options.length < 10) {
            setOptions([...options, '']);
            await safeHaptics.impact();
        }
    };

    const removeOption = async (index: number) => {
        if (options.length > 2) {
            const newOptions = [...options];
            newOptions.splice(index, 1);
            setOptions(newOptions);
            await safeHaptics.impact();
        }
    };

    const updateOption = (text: string, index: number) => {
        const newOptions = [...options];
        newOptions[index] = text;
        setOptions(newOptions);
    };

    const validatePoll = (): boolean => {
        if (!question.trim()) {
            Alert.alert('Error', 'Please enter a question');
            return false;
        }

        const validOptions = options.filter(o => o.trim().length > 0);
        if (validOptions.length < 2) {
            Alert.alert('Error', 'Please add at least 2 options');
            return false;
        }

        if (pollType === 'multiple' && maxSelections) {
            const max = parseInt(maxSelections);
            if (isNaN(max) || max < 1) {
                Alert.alert('Error', 'Max selections must be a positive number');
                return false;
            }
            if (max > validOptions.length) {
                Alert.alert('Error', 'Max selections cannot exceed number of options');
                return false;
            }
        }

        if (hasDeadline && deadline <= new Date()) {
            Alert.alert('Error', 'Deadline must be in the future');
            return false;
        }

        return true;
    };

    const createPoll = async (): Promise<Poll> => {
        const validOptions = options.filter(o => o.trim().length > 0);

        const formattedOptions = validOptions.map(text => ({
            text: text.trim()
        }));

        const poll: Poll = {
            id: editPoll?.id || `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            spaceId,
            createdBy: {
                id: currentUserId,
                name: 'Current User', // This should come from context
                avatar: undefined,
            },
            question: question.trim(),
            options: formattedOptions.map((opt, index) => ({
                id: `opt_${Date.now()}_${index}`,
                text: opt.text,
                votes: [],
                voters: [],
            })),
            type: pollType,
            settings: {
                allowMultipleVotes,
                allowVoteChange,
                showResults,
                anonymous,
                weightedVoting,
                ...(quorum ? { quorum: parseInt(quorum) } : {}),
                ...(pollType === 'multiple' && maxSelections ? { maxSelections: parseInt(maxSelections, 10) } : {}),
            },
            ...(hasDeadline ? { deadline } : {}),
            status: 'active',
            totalVotes: 0,
            uniqueVoters: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...(tags ? { tags: tags.split(',').map(t => t.trim()).filter(t => t) } : {}),
            ...(editPoll?.forwardedFrom ? { forwardedFrom: editPoll.forwardedFrom } : {}),
        };

        return poll;
    };

    const handleSubmit = async () => {
        if (!validatePoll()) return;

        setIsSubmitting(true);

        try {
            const pollData = {
                question: poll.question,
                options: poll.options.map(opt => ({ text: opt.text })),
                type: poll.type,
                settings: {
                    allowMultipleVotes,
                    allowVoteChange,
                    showResults,
                    anonymous,
                    weightedVoting,
                    ...(quorum ? { quorum: parseInt(quorum, 10) } : {}),
                    ...(pollType === 'multiple' && maxSelections ? { maxSelections: parseInt(maxSelections, 10) } : {}),
                },
                deadline: hasDeadline ? deadline : undefined,
                tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : undefined,
            };

            let savedPoll;
            // When updating:
            if (isEditing && editPoll) {
                savedPoll = await collaborationService.updatePoll(spaceId, editPoll.id, pollData);
            }

            if (isEditing && editPoll) {
                // Update existing poll
                savedPoll = await collaborationService.updatePoll(spaceId, editPoll.id, {
                    question: pollData.question,
                    options: pollData.options.map(opt => ({ text: opt.text })),
                    type: pollData.type,
                    settings: pollData.settings,
                    deadline: pollData.deadline,
                    tags: pollData.tags,
                });

                // Compute diff and send update message
                const diffMessage = computePollDiff(editPoll, savedPoll);
                await collaborationService.sendMessage(spaceId, {
                    content: `📊 Poll updated:\n${diffMessage}`,
                    type: 'text',
                    metadata: {
                        isPollNotification: true,
                        pollId: savedPoll.id,
                        notificationType: 'poll_updated',
                    },
                });
            } else {
                // Create new poll
                savedPoll = await collaborationService.createPoll(spaceId, {
                    question: pollData.question,
                    options: pollData.options.map(opt => ({ text: opt.text })),
                    type: pollData.type,
                    settings: pollData.settings,
                    deadline: pollData.deadline,
                    tags: pollData.tags,
                });

                // Send poll creation message
                await collaborationService.sendMessage(spaceId, {
                    content: `📊 **POLL**: ${pollData.question}`,
                    type: 'poll',
                    metadata: {
                        pollId: savedPoll.id,
                        pollData: pollData,
                    },
                });
            }

            // Forward to selected spaces (only for new polls? or also for updates?)
            if (selectedForwardSpaces.size > 0 && !isEditing) {
                const forwardTo = Array.from(selectedForwardSpaces);
                await collaborationService.forwardPoll(savedPoll.id, forwardTo);
                if (onPollForwarded) {
                    onPollForwarded(savedPoll.id, forwardTo);
                }
            }

            await safeHaptics.notification(Haptics.NotificationFeedbackType.Success);

            if (isEditing && onPollUpdated) {
                onPollUpdated(savedPoll);
            } else if (onPollCreated) {
                onPollCreated(savedPoll);
            }

            resetForm();
            onClose();
        } catch (error: any) {
            console.error('Error creating/updating poll:', error);
            if (error.response?.status === 422) {
                const errors = error.response.data.errors;
                const messages = Object.values(errors).flat().join('\n');
                Alert.alert('Validation Error', messages);
            } else {
                Alert.alert('Error', error.response?.data?.message || 'Failed to save poll. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Load available spaces for forwarding
    const loadAvailableSpaces = async () => {
        setIsLoadingSpaces(true);
        try {
            const userSpaces = await collaborationService.fetchUserSpaces(currentUserId);
            const filtered = userSpaces.filter(s => s.id !== spaceId);
            setAvailableSpaces(filtered);
        } catch (error) {
            console.error('Error loading spaces:', error);
            Alert.alert('Error', 'Could not load spaces');
        } finally {
            setIsLoadingSpaces(false);
        }
    };

    const handleOpenForwardModal = () => {
        loadAvailableSpaces();
        setShowForwardModal(true);
    };

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.sectionTitle}>Poll Question</Text>
            <TextInput
                style={styles.questionInput}
                placeholder="Ask your question..."
                value={question}
                onChangeText={setQuestion}
                multiline
                maxLength={200}
            />

            <Text style={styles.sectionTitle}>Options</Text>
            {options.map((option, index) => (
                <View key={index} style={styles.optionRow}>
                    <View style={styles.optionNumber}>
                        <Text style={styles.optionNumberText}>{index + 1}</Text>
                    </View>
                    <TextInput
                        style={styles.optionInput}
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChangeText={(text) => updateOption(text, index)}
                        maxLength={100}
                    />
                    {options.length > 2 && (
                        <TouchableOpacity onPress={() => removeOption(index)}>
                            <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                        </TouchableOpacity>
                    )}
                </View>
            ))}

            {options.length < 10 && (
                <TouchableOpacity style={styles.addOptionButton} onPress={addOption}>
                    <Ionicons name="add-circle" size={24} color="#007AFF" />
                    <Text style={styles.addOptionText}>Add Option</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.sectionTitle}>Poll Settings</Text>

            <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Poll Type</Text>
                <View style={styles.typeSelector}>
                    {['single', 'multiple', 'ranked', 'weighted'].map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.typeButton,
                                pollType === type && styles.typeButtonActive,
                            ]}
                            onPress={() => setPollType(type as any)}
                        >
                            <Text
                                style={[
                                    styles.typeButtonText,
                                    pollType === type && styles.typeButtonTextActive,
                                ]}
                            >
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {pollType === 'multiple' && (
                <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Max Selections</Text>
                    <TextInput
                        style={styles.numberInput}
                        value={maxSelections}
                        onChangeText={setMaxSelections}
                        keyboardType="numeric"
                        placeholder="Unlimited"
                    />
                </View>
            )}

            <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Allow Multiple Votes</Text>
                <Switch
                    value={allowMultipleVotes}
                    onValueChange={setAllowMultipleVotes}
                    trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
                />
            </View>

            <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Allow Vote Change</Text>
                <Switch
                    value={allowVoteChange}
                    onValueChange={setAllowVoteChange}
                    trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
                />
            </View>

            <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Show Results</Text>
                <View style={styles.resultsSelector}>
                    {['always', 'after_vote', 'after_deadline', 'creator_only'].map((option) => (
                        <TouchableOpacity
                            key={option}
                            style={[
                                styles.resultsButton,
                                showResults === option && styles.resultsButtonActive,
                            ]}
                            onPress={() => setShowResults(option as any)}
                        >
                            <Text
                                style={[
                                    styles.resultsButtonText,
                                    showResults === option && styles.resultsButtonTextActive,
                                ]}
                            >
                                {option.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Anonymous Voting</Text>
                <Switch
                    value={anonymous}
                    onValueChange={setAnonymous}
                    trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
                />
            </View>

            <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Weighted Voting</Text>
                <Switch
                    value={weightedVoting}
                    onValueChange={setWeightedVoting}
                    trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
                />
            </View>
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.sectionTitle}>Advanced Options</Text>

            <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Has Deadline</Text>
                <Switch
                    value={hasDeadline}
                    onValueChange={setHasDeadline}
                    trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
                />
            </View>

            {hasDeadline && (
                <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Ionicons name="calendar" size={20} color="#007AFF" />
                    <Text style={styles.datePickerText}>
                        {deadline.toLocaleString()}
                    </Text>
                </TouchableOpacity>
            )}

            {showDatePicker && Platform.OS !== 'web' && DateTimePicker && (
                <DateTimePicker
                    value={deadline}
                    mode="datetime"
                    onChange={(event: any, selectedDate?: Date) => {
                        setShowDatePicker(false);
                        if (selectedDate) setDeadline(selectedDate);
                    }}
                />
            )}

            <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Quorum (min. participants)</Text>
                <TextInput
                    style={styles.numberInput}
                    value={quorum}
                    onChangeText={setQuorum}
                    keyboardType="numeric"
                    placeholder="No minimum"
                />
            </View>

            <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Tags (comma separated)</Text>
                <TextInput
                    style={styles.tagsInput}
                    value={tags}
                    onChangeText={setTags}
                    placeholder="e.g. decision, planning, fun"
                />
            </View>
        </View>
    );

    const renderStep4 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.sectionTitle}>Forward to Spaces</Text>

            <TouchableOpacity
                style={styles.forwardButton}
                onPress={handleOpenForwardModal}
            >
                <Ionicons name="share-social" size={20} color="#007AFF" />
                <Text style={styles.forwardButtonText}>
                    {selectedForwardSpaces.size > 0
                        ? `Forwarding to ${selectedForwardSpaces.size} space(s)`
                        : 'Select spaces to forward this poll'}
                </Text>
            </TouchableOpacity>

            <View style={styles.previewContainer}>
                <Text style={styles.previewTitle}>Preview</Text>
                <View style={styles.pollPreview}>
                    <Text style={styles.previewQuestion}>{question || 'Your poll question'}</Text>
                    {options.filter(o => o.trim()).map((opt, idx) => (
                        <View key={idx} style={styles.previewOption}>
                            <Text style={styles.previewOptionText}>• {opt || `Option ${idx + 1}`}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>
                            {editPoll ? 'Edit Poll' : 'Create Poll'}
                        </Text>
                        <View style={{ width: 24 }} />
                    </View>

                    <View style={styles.stepIndicator}>
                        {[1, 2, 3, 4].map((step) => (
                            <TouchableOpacity
                                key={step}
                                style={[
                                    styles.stepDot,
                                    currentStep === step && styles.stepDotActive,
                                    currentStep > step && styles.stepDotCompleted,
                                ]}
                                onPress={() => setCurrentStep(step)}
                            >
                                {currentStep > step ? (
                                    <Ionicons name="checkmark" size={12} color="#fff" />
                                ) : (
                                    <Text style={styles.stepDotText}>{step}</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    <ScrollView style={styles.scrollContent}>
                        {currentStep === 1 && renderStep1()}
                        {currentStep === 2 && renderStep2()}
                        {currentStep === 3 && renderStep3()}
                        {currentStep === 4 && renderStep4()}
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={[styles.footerButton, styles.cancelButton]}
                            onPress={onClose}
                            disabled={isSubmitting}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        {currentStep < 4 ? (
                            <TouchableOpacity
                                style={[styles.footerButton, styles.nextButton]}
                                onPress={() => setCurrentStep(currentStep + 1)}
                            >
                                <Text style={styles.nextButtonText}>Next</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.footerButton,
                                    styles.createButton,
                                    isSubmitting && styles.createButtonDisabled,
                                ]}
                                onPress={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                        <Text style={styles.createButtonText}>
                                            {editPoll ? 'Update Poll' : 'Create Poll'}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>
            </View>

            {/* Forward to Spaces Modal */}
            <Modal
                visible={showForwardModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowForwardModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.forwardModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Forward to Spaces</Text>
                            <TouchableOpacity onPress={() => setShowForwardModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search spaces..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            clearButtonMode="while-editing"
                        />

                        {isLoadingSpaces ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#007AFF" />
                                <Text style={styles.loadingText}>Loading spaces...</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={availableSpaces.filter(s =>
                                    s.title?.toLowerCase().includes(searchQuery.toLowerCase())
                                )}
                                keyExtractor={(item) => item.id}
                                style={styles.spacesList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.spaceItem,
                                            selectedForwardSpaces.has(item.id) && styles.spaceItemSelected
                                        ]}
                                        onPress={() => {
                                            const newSelected = new Set(selectedForwardSpaces);
                                            if (newSelected.has(item.id)) {
                                                newSelected.delete(item.id);
                                            } else {
                                                newSelected.add(item.id);
                                            }
                                            setSelectedForwardSpaces(newSelected);
                                        }}
                                    >
                                        <Avatar
                                            source={item.creator?.profile_photo}
                                            size={40}
                                            name={item.title}
                                        />
                                        <View style={styles.spaceInfo}>
                                            <Text style={styles.spaceTitle}>{item.title}</Text>
                                            <Text style={styles.spaceType}>{item.space_type}</Text>
                                        </View>
                                        {selectedForwardSpaces.has(item.id) && (
                                            <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                                        )}
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>No spaces available</Text>
                                }
                            />
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonCancel]}
                                onPress={() => {
                                    setShowForwardModal(false);
                                    setSelectedForwardSpaces(new Set());
                                }}
                            >
                                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.modalButtonConfirm,
                                    selectedForwardSpaces.size === 0 && styles.modalButtonDisabled
                                ]}
                                onPress={() => {
                                    setShowForwardModal(false);
                                    // No need to save here; selectedForwardSpaces is already set
                                }}
                                disabled={selectedForwardSpaces.size === 0}
                            >
                                <Text style={styles.modalButtonTextConfirm}>
                                    Done ({selectedForwardSpaces.size})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        width: '100%',
        maxWidth: 600,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        gap: 16,
    },
    stepDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDotActive: {
        backgroundColor: '#007AFF',
    },
    stepDotCompleted: {
        backgroundColor: '#4CAF50',
    },
    stepDotText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    scrollContent: {
        padding: 16,
    },
    stepContainer: {
        gap: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    questionInput: {
        fontSize: 16,
        padding: 12,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    optionNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionNumberText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    optionInput: {
        flex: 1,
        fontSize: 16,
        padding: 10,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    addOptionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: '#007AFF10',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#007AFF',
        borderStyle: 'dashed',
        marginTop: 8,
    },
    addOptionText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
        color: '#007AFF',
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    settingLabel: {
        fontSize: 15,
        color: '#333',
        flex: 1,
    },
    typeSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    typeButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f0f0f0',
    },
    typeButtonActive: {
        backgroundColor: '#007AFF',
    },
    typeButtonText: {
        fontSize: 12,
        color: '#666',
    },
    typeButtonTextActive: {
        color: '#fff',
    },
    resultsSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'flex-end',
    },
    resultsButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#f0f0f0',
    },
    resultsButtonActive: {
        backgroundColor: '#007AFF',
    },
    resultsButtonText: {
        fontSize: 11,
        color: '#666',
    },
    resultsButtonTextActive: {
        color: '#fff',
    },
    numberInput: {
        width: 80,
        fontSize: 15,
        padding: 8,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        textAlign: 'center',
    },
    tagsInput: {
        flex: 1,
        fontSize: 15,
        padding: 8,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    datePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    datePickerText: {
        fontSize: 15,
        color: '#333',
    },
    forwardButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    forwardButtonText: {
        fontSize: 15,
        color: '#007AFF',
        fontWeight: '500',
    },
    previewContainer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
    },
    previewTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    pollPreview: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
    },
    previewQuestion: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    previewOption: {
        paddingVertical: 6,
    },
    previewOptionText: {
        fontSize: 14,
        color: '#666',
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        gap: 12,
    },
    footerButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    cancelButton: {
        backgroundColor: '#f0f0f0',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    nextButton: {
        backgroundColor: '#007AFF',
    },
    nextButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    createButton: {
        backgroundColor: '#4CAF50',
    },
    createButtonDisabled: {
        opacity: 0.5,
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    forwardModalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '90%',
        maxWidth: 500,
        maxHeight: '70%',
    },
    spacesList: {
        padding: 16,
        maxHeight: 400,
    },
    placeholderText: {
        textAlign: 'center',
        color: '#999',
        padding: 20,
    },
    doneButton: {
        padding: 16,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    doneButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#007AFF',
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    searchInput: {
        fontSize: 16,
        padding: 12,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        marginHorizontal: 16,
        marginBottom: 16,
    },
    spacesList: {
        maxHeight: 300,
    },
    spaceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    spaceItemSelected: {
        backgroundColor: '#007AFF10',
    },
    spaceInfo: {
        flex: 1,
        marginLeft: 12,
    },
    spaceTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    spaceType: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    emptyText: {
        textAlign: 'center',
        padding: 20,
        color: '#999',
    },
    forwardModalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '90%',
        maxHeight: '80%',
    },
    modalButtons: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
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

export default PollComponent;