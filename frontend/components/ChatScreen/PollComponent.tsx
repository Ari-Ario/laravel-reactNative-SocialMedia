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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
// import DateTimePicker from '@react-native-community/datetimepicker';
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
            }
        }
    }, [isVisible, editPoll]);

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
            if (max > validOptions.length) {
                Alert.alert('Error', 'Max selections cannot exceed number of options');
                return false;
            }
        }

        return true;
    };

    const createPoll = async (): Promise<Poll> => {
        const validOptions = options.filter(o => o.trim().length > 0);

        // Format options as array of objects with 'text' property
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
                ...(maxSelections ? { maxSelections: parseInt(maxSelections) } : {}),
            },
            ...(hasDeadline ? { deadline } : {}),
            status: 'active',
            totalVotes: 0,
            uniqueVoters: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...(tags ? { tags: tags.split(',').map(t => t.trim()) } : {}),
            ...(editPoll?.forwardedFrom ? { forwardedFrom: editPoll.forwardedFrom } : {}),
        };

        return poll;
    };

    const handleSubmit = async () => {
        if (!validatePoll()) return;

        setIsSubmitting(true);

        try {
            const poll = await createPoll();

            // Save to backend via CollaborationService
            // You'll need to add this method
            const savedPoll = await collaborationService.createPoll(spaceId, {
                question: poll.question,
                options: poll.options.map(opt => ({ text: opt.text })), // Send only text
                type: poll.type,
                settings: poll.settings,
                deadline: poll.deadline,
                tags: poll.tags,
            });

            // Forward to selected spaces
            if (selectedForwardSpaces.size > 0) {
                const forwardTo = Array.from(selectedForwardSpaces);
                await collaborationService.forwardPoll(savedPoll.id, forwardTo);
                if (onPollForwarded) {
                    onPollForwarded(savedPoll.id, forwardTo);
                }
            }

            await safeHaptics.notification();


            if (editPoll && onPollUpdated) {
                onPollUpdated(savedPoll);
            } else if (onPollCreated) {
                onPollCreated(savedPoll);
            }

            // Send poll as a message in the space
            await collaborationService.sendMessage(spaceId, {
                content: `📊 **POLL**: ${poll.question}`,
                type: 'poll',
                metadata: {
                    pollId: savedPoll.id,
                    pollData: poll,
                },
            });

            onClose();
        } catch (error) {
            console.error('Error creating poll:', error);
            Alert.alert('Error', 'Failed to create poll');
        } finally {
            setIsSubmitting(false);
        }
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

            {showDatePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                    value={deadline}
                    mode="datetime"
                    onChange={(event, selectedDate) => {
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
                onPress={() => setShowForwardModal(true)}
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

                        <ScrollView style={styles.spacesList}>
                            {/* This would be populated with actual spaces */}
                            <Text style={styles.placeholderText}>Loading spaces...</Text>
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.doneButton}
                            onPress={() => setShowForwardModal(false)}
                        >
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
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
});

export default PollComponent;