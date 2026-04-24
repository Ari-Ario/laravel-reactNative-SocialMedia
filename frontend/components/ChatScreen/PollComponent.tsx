// components/ChatScreen/PollComponent.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { FadeIn } from 'react-native-reanimated';

import Avatar from '@/components/Image/Avatar';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { safeHaptics } from '@/utils/haptics';
import { createShadow } from '@/utils/styles';

// ─── Types & Props ───────────────────────────────────────────────────────────

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
        quorum?: number;
        maxSelections?: number;
    };
    deadline?: Date;
    status: 'draft' | 'active' | 'closed' | 'archived';
    totalVotes: number;
    uniqueVoters: number;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
}

interface PollComponentProps {
    spaceId: string;
    currentUserId: number;
    currentUserRole: string;
    onPollCreated?: (poll: Poll, message?: any) => void;
    onPollUpdated?: (poll: Poll, message?: any) => void;
    onPollClosed?: (pollId: string, results: any) => void;
    onPollForwarded?: (pollId: string, targetSpaceIds: string[]) => void;
    isVisible: boolean;
    onClose: () => void;
    editPoll?: Poll;
    isEditing?: boolean;
}

// ─── Deadline Picker Modal (Activity Pattern) ───────────────────────────────

const DeadlinePickerModal = ({ visible, value, onConfirm, onClose }: { visible: boolean, value: Date, onConfirm: (date: Date) => void, onClose: () => void }) => {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const modalStyles = getDatePickerStyles(colors, activeScheme);

    const baseDate = value || new Date(Date.now() + 86400000);
    const [year, setYear] = useState(String(baseDate.getFullYear()));
    const [month, setMonth] = useState(String(baseDate.getMonth() + 1).padStart(2, '0'));
    const [day, setDay] = useState(String(baseDate.getDate()).padStart(2, '0'));
    const [hour, setHour] = useState(String(baseDate.getHours()).padStart(2, '0'));
    const [minute, setMinute] = useState(String(baseDate.getMinutes()).padStart(2, '0'));

    const [webDateTime, setWebDateTime] = useState(baseDate.toISOString().slice(0, 16));

    const handleConfirm = () => {
        if (Platform.OS === 'web') {
            onConfirm(new Date(webDateTime));
        } else {
            const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
            if (isNaN(d.getTime())) {
                Alert.alert(t('error'), t('invalid_date'));
                return;
            }
            onConfirm(d);
        }
    };

    const MONTHS = [
        t('month_jan'), t('month_feb'), t('month_mar'), t('month_apr'), t('month_may'), t('month_jun'),
        t('month_jul'), t('month_aug'), t('month_sep'), t('month_oct'), t('month_nov'), t('month_dec')
    ];

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={modalStyles.overlay} activeOpacity={1} onPress={onClose}>
                <MotiView
                    from={{ translateY: 300, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    transition={{ type: 'spring', damping: 22 }}
                    style={modalStyles.sheet}
                >
                    <TouchableOpacity activeOpacity={1}>
                        <View style={modalStyles.handle} />
                        <View style={modalStyles.header}>
                            <TouchableOpacity onPress={onClose}>
                                <Text style={modalStyles.cancelBtn}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <Text style={modalStyles.title}>{t('poll_deadline')}</Text>
                            <TouchableOpacity onPress={handleConfirm}>
                                <Text style={modalStyles.doneBtn}>{t('save')}</Text>
                            </TouchableOpacity>
                        </View>

                        {Platform.OS === 'web' ? (
                            <View style={modalStyles.webDateContainer}>
                                <Text style={modalStyles.webDateLabel}>{t('select_deadline')}</Text>
                                <input
                                    type="datetime-local"
                                    value={webDateTime}
                                    min={new Date().toISOString().slice(0, 16)}
                                    onChange={(e: any) => setWebDateTime(e.target.value)}
                                    style={{
                                        width: '85%',
                                        alignSelf: 'center',
                                        padding: 14,
                                        fontSize: 18,
                                        borderRadius: 12,
                                        border: `2px solid ${activeScheme === 'dark' ? '#333' : colors.border}`,
                                        outline: 'none',
                                        fontFamily: 'inherit',
                                        color: colors.text,
                                        backgroundColor: activeScheme === 'dark' ? '#1A1A1A' : colors.surface,
                                        marginTop: 8,
                                        colorScheme: activeScheme === 'dark' ? 'dark' : 'light',
                                    } as any}
                                />
                            </View>
                        ) : (
                            <View style={{ flexShrink: 1 }}>
                                <Text style={[modalStyles.webDateLabel, { paddingHorizontal: 20 }]}>{t('select_deadline')}</Text>
                                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                                    <View style={modalStyles.pickerRow}>
                                        <View style={modalStyles.pickerCol}>
                                            <Text style={modalStyles.pickerLabel}>{t('day')}</Text>
                                            <TextInput
                                                style={modalStyles.pickerInput}
                                                value={day}
                                                onChangeText={v => setDay(v.replace(/\D/g, '').slice(0, 2))}
                                                keyboardType="number-pad"
                                                maxLength={2}
                                            />
                                        </View>
                                        <View style={modalStyles.pickerCol}>
                                            <Text style={modalStyles.pickerLabel}>{t('month')}</Text>
                                            <ScrollView style={modalStyles.monthScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                                                {MONTHS.map((m, i) => (
                                                    <TouchableOpacity
                                                        key={m}
                                                        style={[modalStyles.monthItem, month === String(i + 1).padStart(2, '0') && modalStyles.monthItemActive]}
                                                        onPress={() => setMonth(String(i + 1).padStart(2, '0'))}
                                                    >
                                                        <Text style={[modalStyles.monthText, month === String(i + 1).padStart(2, '0') && modalStyles.monthTextActive]}>
                                                            {m}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                        <View style={modalStyles.pickerCol}>
                                            <Text style={modalStyles.pickerLabel}>{t('year')}</Text>
                                            <TextInput
                                                style={modalStyles.pickerInput}
                                                value={year}
                                                onChangeText={v => setYear(v.replace(/\D/g, '').slice(0, 4))}
                                                keyboardType="number-pad"
                                                maxLength={4}
                                            />
                                        </View>
                                    </View>
                                    <View style={[modalStyles.pickerRow, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10 }]}>
                                        <View style={modalStyles.pickerCol}>
                                            <Text style={modalStyles.pickerLabel}>{t('hour')}</Text>
                                            <TextInput
                                                style={modalStyles.pickerInput}
                                                value={hour}
                                                onChangeText={v => setHour(v.replace(/\D/g, '').slice(0, 2))}
                                                keyboardType="number-pad"
                                                maxLength={2}
                                            />
                                        </View>
                                        <View style={modalStyles.pickerCol}>
                                            <Text style={modalStyles.pickerLabel}>{t('minute')}</Text>
                                            <TextInput
                                                style={modalStyles.pickerInput}
                                                value={minute}
                                                onChangeText={v => setMinute(v.replace(/\D/g, '').slice(0, 2))}
                                                keyboardType="number-pad"
                                                maxLength={2}
                                            />
                                        </View>
                                    </View>
                                </ScrollView>
                            </View>
                        )}
                    </TouchableOpacity>
                </MotiView>
            </TouchableOpacity>
        </Modal>
    );
};

// ─── Main Poll Component ───────────────────────────────────────────────────

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
    const { colors, activeScheme } = useAppTheme();
    const { t, isRTL } = useTranslation();
    const insets = useSafeAreaInsets();
    const styles = getStyles(colors, activeScheme, isRTL);
    const isDark = activeScheme === 'dark';

    // State
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [pollType, setPollType] = useState<'single' | 'multiple' | 'ranked' | 'weighted'>('single');
    const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
    const [allowVoteChange, setAllowVoteChange] = useState(true);
    const [showResults, setShowResults] = useState<'always' | 'after_vote' | 'after_deadline' | 'creator_only'>('after_vote');
    const [anonymous, setAnonymous] = useState(false);
    const [weightedVoting, setWeightedVoting] = useState(false);
    const [hasDeadline, setHasDeadline] = useState(false);
    const [deadline, setDeadline] = useState<Date>(new Date(Date.now() + 86400000));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [quorum, setQuorum] = useState<string>('');
    const [maxSelections, setMaxSelections] = useState<string>('');
    const [tags, setTags] = useState<string>('');
    
    const [availableSpaces, setAvailableSpaces] = useState<any[]>([]);
    const [selectedForwardSpaces, setSelectedForwardSpaces] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showForwardSection, setShowForwardSection] = useState(false);

    const collaborationService = CollaborationService.getInstance();

    // Permissions & Validation
    const isCreator = editPoll?.createdBy?.id === currentUserId;
    const hasVotes = (editPoll?.totalVotes || 0) > 0;
    const canEdit = !editPoll || (isCreator && !hasVotes && editPoll?.status === 'active');
    const isValid = question.trim().length > 0 && options.filter(o => o.trim().length > 0).length >= 2;

    useEffect(() => {
        if (isVisible) {
            if (editPoll) {
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
                resetForm();
            }
            loadAvailableSpaces();
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
        setShowForwardSection(false);
    };

    const loadAvailableSpaces = async () => {
        try {
            const result = await collaborationService.fetchUserSpaces(currentUserId);
            // Filter out direct spaces and the current space as per common collaborative patterns
            const filtered = result.spaces.filter(s => s.id !== spaceId && s.space_type !== 'direct' && s.space_type !== 'chat');
            setAvailableSpaces(filtered);
        } catch (error) {
            console.error('Error loading spaces:', error);
        }
    };

    const addOption = async () => {
        if (options.length < 20) {
            setOptions([...options, '']);
            safeHaptics.impact();
        }
    };

    const removeOption = async (index: number) => {
        if (options.length > 2) {
            const newOptions = [...options];
            newOptions.splice(index, 1);
            setOptions(newOptions);
            safeHaptics.impact();
        }
    };

    const updateOption = (text: string, index: number) => {
        const newOptions = [...options];
        newOptions[index] = text;
        setOptions(newOptions);
    };

    const handleSubmit = async () => {
        if (!isValid) return;
        setIsSubmitting(true);
        safeHaptics.success();

        try {
            const validOptions = options.filter(o => o.trim().length > 0);
            const pollData = {
                question: question.trim(),
                options: validOptions.map(text => ({ text: text.trim() })),
                type: pollType,
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
            if (isEditing && editPoll) {
                savedPoll = await collaborationService.updatePoll(spaceId, editPoll.id, pollData);
                const msg = await collaborationService.sendMessage(spaceId, {
                    content: `📊 ${t('poll_updated_notif').replace('{question}', pollData.question)}`,
                    type: 'text',
                    metadata: { isPollNotification: true, pollId: savedPoll.id, notificationType: 'poll_updated' },
                });
                onPollUpdated?.(savedPoll, msg);
            } else {
                savedPoll = await collaborationService.createPoll(spaceId, pollData);
                const msg = await collaborationService.sendMessage(spaceId, {
                    content: `📊 ${pollData.question}`,
                    type: 'poll',
                    metadata: { isPoll: true, pollId: savedPoll.id, pollData: savedPoll },
                });

                if (selectedForwardSpaces.size > 0) {
                    const forwardTo = Array.from(selectedForwardSpaces);
                    await collaborationService.forwardPoll(savedPoll.id, forwardTo);
                    for (const targetId of forwardTo) {
                        await collaborationService.sendMessage(targetId, {
                            content: `📊 ${t('poll_forwarded_notif').replace('{question}', savedPoll.question)}`,
                            type: 'poll',
                            metadata: { isPoll: true, isPollForward: true, pollId: savedPoll.id, pollData: savedPoll, sourceSpaceId: spaceId },
                        });
                    }
                    onPollForwarded?.(savedPoll.id, forwardTo);
                }
                onPollCreated?.(savedPoll, msg);
            }
            onClose();
            resetForm();
        } catch (error: any) {
            console.error('Poll Error:', error);
            if (error.response?.status === 422) {
                const messages = Object.values(error.response.data.errors).flat().join('\n');
                Alert.alert(t('error'), messages);
            } else {
                Alert.alert(t('error'), error.response?.data?.message || t('failed_save_poll_msg'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const pollTypes = [
        { id: 'single', name: t('single_choice'), icon: 'radio-button-on', color: '#3b82f6' },
        { id: 'multiple', name: t('multiple_choice'), icon: 'checkbox', color: '#10b981' },
        { id: 'ranked', name: t('ranked_choice'), icon: 'list', color: '#f59e0b' },
        { id: 'weighted', name: t('weighted_choice'), icon: 'star', color: '#8b5cf6' },
    ];

    const resultsOptions = [
        { id: 'always', name: t('always_show_results') },
        { id: 'after_vote', name: t('after_vote_show_results') },
        { id: 'after_deadline', name: t('after_deadline_show_results') },
        { id: 'creator_only', name: t('creator_only_show_results') },
    ];

    return (
        <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <LinearGradient colors={isDark ? [colors.background, colors.background] : ['#f8fafc', '#f1f5f9']} style={[styles.container, { paddingTop: insets.top || 20 }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                        <Ionicons name="close" size={28} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{isEditing ? t('edit_poll_title') : t('create_poll_title')}</Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <MotiView entering={FadeIn.duration(400)} style={styles.contentMaxWidth}>
                        
                        {/* Question Input */}
                        <View style={styles.card}>
                            <Text style={styles.cardLabel}>{t('poll_question_title')}</Text>
                            <TextInput
                                style={styles.questionInput}
                                placeholder={t('your_poll_question_placeholder')}
                                placeholderTextColor={colors.textSecondary + '70'}
                                value={question}
                                onChangeText={setQuestion}
                                multiline
                                maxLength={200}
                                editable={canEdit}
                            />
                            <View style={styles.separator} />
                            <View style={styles.tagsRow}>
                                <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
                                <TextInput
                                    style={styles.tagsInput}
                                    placeholder={t('tags_placeholder')}
                                    placeholderTextColor={colors.textSecondary + '70'}
                                    value={tags}
                                    onChangeText={setTags}
                                />
                            </View>
                        </View>

                        {/* Options List */}
                        <Text style={styles.sectionLabel}>{t('options_title')}</Text>
                        <View style={styles.optionsList}>
                            {options.map((option, index) => (
                                <View key={index} style={styles.optionRow}>
                                    <View style={[styles.optionIndex, { backgroundColor: colors.tint + '15' }]}>
                                        <Text style={[styles.optionIndexText, { color: colors.tint }]}>{index + 1}</Text>
                                    </View>
                                    <TextInput
                                        style={styles.optionInput}
                                        placeholder={t('option_placeholder', { index: index + 1 })}
                                        placeholderTextColor={colors.textSecondary + '60'}
                                        value={option}
                                        onChangeText={(text) => updateOption(text, index)}
                                        editable={canEdit}
                                    />
                                    {options.length > 2 && canEdit && (
                                        <TouchableOpacity onPress={() => removeOption(index)} style={styles.removeBtn}>
                                            <Ionicons name="remove-circle-outline" size={22} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                            {canEdit && options.length < 20 && (
                                <TouchableOpacity style={styles.addOptionBtn} onPress={addOption}>
                                    <Ionicons name="add-circle" size={24} color={colors.tint} />
                                    <Text style={styles.addOptionText}>{t('add_option_btn')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Poll Type Selector */}
                        <Text style={styles.sectionLabel}>{t('poll_type_label')}</Text>
                        <View style={styles.pillsGrid}>
                            {pollTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[styles.pill, pollType === type.id && styles.pillActive]}
                                    onPress={() => { setPollType(type.id as any); safeHaptics.impact(); }}
                                    disabled={!canEdit}
                                >
                                    <Ionicons name={type.icon as any} size={18} color={pollType === type.id ? '#fff' : colors.tint} />
                                    <Text style={[styles.pillText, pollType === type.id && styles.pillTextActive]}>{type.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Settings Toggles */}
                        <Text style={styles.sectionLabel}>{t('poll_settings_title')}</Text>
                        <View style={styles.settingsToggles}>
                            <TouchableOpacity 
                                style={[styles.togglePill, anonymous && styles.togglePillActive]} 
                                onPress={() => setAnonymous(!anonymous)}
                                disabled={!canEdit}
                            >
                                <Ionicons name={anonymous ? "person-circle" : "person-circle-outline"} size={18} color={anonymous ? "#fff" : colors.textSecondary} />
                                <Text style={[styles.togglePillText, anonymous && styles.togglePillTextActive]}>{t('anonymous_voting_label')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.togglePill, allowVoteChange && styles.togglePillActive]} 
                                onPress={() => setAllowVoteChange(!allowVoteChange)}
                                disabled={!canEdit}
                            >
                                <Ionicons name="refresh-outline" size={18} color={allowVoteChange ? "#fff" : colors.textSecondary} />
                                <Text style={[styles.togglePillText, allowVoteChange && styles.togglePillTextActive]}>{t('allow_vote_change_label')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.togglePill, allowMultipleVotes && styles.togglePillActive]} 
                                onPress={() => setAllowMultipleVotes(!allowMultipleVotes)}
                                disabled={!canEdit}
                            >
                                <Ionicons name="checkbox-outline" size={18} color={allowMultipleVotes ? "#fff" : colors.textSecondary} />
                                <Text style={[styles.togglePillText, allowMultipleVotes && styles.togglePillTextActive]}>{t('allow_multiple_votes_label')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.togglePill, weightedVoting && styles.togglePillActive]} 
                                onPress={() => setWeightedVoting(!weightedVoting)}
                                disabled={!canEdit}
                            >
                                <Ionicons name="star-outline" size={18} color={weightedVoting ? "#fff" : colors.textSecondary} />
                                <Text style={[styles.togglePillText, weightedVoting && styles.togglePillTextActive]}>{t('weighted_voting_label')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.togglePill, hasDeadline && styles.togglePillActive]} 
                                onPress={() => setHasDeadline(!hasDeadline)}
                                disabled={!canEdit}
                            >
                                <Ionicons name="time-outline" size={18} color={hasDeadline ? "#fff" : colors.textSecondary} />
                                <Text style={[styles.togglePillText, hasDeadline && styles.togglePillTextActive]}>{t('has_deadline_label')}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Conditional Advanced Inputs */}
                        {(hasDeadline || quorum || pollType === 'multiple') && (
                            <MotiView from={{ opacity: 0, scaleY: 0.9 }} animate={{ opacity: 1, scaleY: 1 }} style={styles.advancedInputs}>
                                {hasDeadline && (
                                    <TouchableOpacity style={styles.inputCard} onPress={() => setShowDatePicker(true)} disabled={!canEdit}>
                                        <View style={styles.inputIconCircle}>
                                            <Ionicons name="calendar-outline" size={18} color={colors.tint} />
                                        </View>
                                        <View style={styles.inputInfo}>
                                            <Text style={styles.inputLabel}>{t('poll_deadline')}</Text>
                                            <Text style={styles.inputValue}>{format(deadline, 'PPpp')}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                )}
                                <View style={styles.inputsRow}>
                                    <View style={[styles.inputCard, { flex: 1 }]}>
                                        <View style={styles.inputIconCircle}>
                                            <Ionicons name="people-outline" size={18} color={colors.tint} />
                                        </View>
                                        <View style={styles.inputInfo}>
                                            <Text style={styles.inputLabel}>{t('quorum_label')}</Text>
                                            <TextInput
                                                style={styles.textInput}
                                                value={quorum}
                                                onChangeText={v => setQuorum(v.replace(/\D/g, ''))}
                                                keyboardType="numeric"
                                                placeholder="0"
                                                editable={canEdit}
                                            />
                                        </View>
                                    </View>
                                    {pollType === 'multiple' && (
                                        <View style={[styles.inputCard, { flex: 1 }]}>
                                            <View style={styles.inputIconCircle}>
                                                <Ionicons name="list-outline" size={18} color={colors.tint} />
                                            </View>
                                            <View style={styles.inputInfo}>
                                                <Text style={styles.inputLabel}>{t('max_selections_label')}</Text>
                                                <TextInput
                                                    style={styles.textInput}
                                                    value={maxSelections}
                                                    onChangeText={v => setMaxSelections(v.replace(/\D/g, ''))}
                                                    keyboardType="numeric"
                                                    placeholder="2"
                                                    editable={canEdit}
                                                />
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </MotiView>
                        )}

                        {/* Show Results Settings */}
                        <Text style={styles.sectionLabel}>{t('show_results_label')}</Text>
                        <View style={styles.pillsGrid}>
                            {resultsOptions.map((opt) => (
                                <TouchableOpacity
                                    key={opt.id}
                                    style={[styles.pill, showResults === opt.id && styles.pillActive]}
                                    onPress={() => { setShowResults(opt.id as any); safeHaptics.impact(); }}
                                    disabled={!canEdit}
                                >
                                    <Text style={[styles.pillText, showResults === opt.id && styles.pillTextActive]}>{opt.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Forwarding Section */}
                        <TouchableOpacity style={styles.forwardHeader} onPress={() => setShowForwardSection(!showForwardSection)}>
                            <Text style={styles.sectionLabel}>{t('forward_poll_title')}</Text>
                            <Ionicons name={showForwardSection ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                        {showForwardSection && (
                            <View style={styles.forwardContent}>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder={t('search_spaces_placeholder')}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spacesScrollContent}>
                                    {availableSpaces
                                        .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map(s => (
                                        <TouchableOpacity
                                            key={s.id}
                                            style={[styles.spacePill, selectedForwardSpaces.has(s.id) && styles.spacePillActive]}
                                            onPress={() => {
                                                const next = new Set(selectedForwardSpaces);
                                                if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                                                setSelectedForwardSpaces(next);
                                                safeHaptics.impact();
                                            }}
                                        >
                                            <Avatar source={s.image_url} name={s.title} size={24} />
                                            <Text style={[styles.spacePillText, selectedForwardSpaces.has(s.id) && { color: colors.tint }]}>{s.title}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </MotiView>
                </ScrollView>

                {/* Submit Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.submitBtn, (!isValid || isSubmitting) && styles.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={!isValid || isSubmitting}
                    >
                        <LinearGradient colors={isValid ? ['#6366f1', '#4f46e5'] : [colors.muted, colors.muted]} style={styles.submitGradient}>
                            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{isEditing ? t('edit_poll_title') : t('create_poll_title')}</Text>}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Deadline Picker */}
                <DeadlinePickerModal
                    visible={showDatePicker}
                    value={deadline}
                    onConfirm={(date) => { setDeadline(date); setShowDatePicker(false); }}
                    onClose={() => setShowDatePicker(false)}
                />
            </LinearGradient>
        </Modal>
    );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const getDatePickerStyles = (colors: any, activeScheme: string) => {
    const isDark = activeScheme === 'dark';
    return StyleSheet.create({
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
        sheet: { backgroundColor: isDark ? '#111' : colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, width: '100%', maxHeight: '80%' },
        handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 10 },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
        title: { fontSize: 16, fontWeight: '900', color: colors.text },
        cancelBtn: { fontSize: 15, color: colors.textSecondary, fontWeight: '700' },
        doneBtn: { fontSize: 15, color: colors.tint, fontWeight: '900' },
        webDateContainer: { paddingVertical: 20, alignItems: 'center', width: '100%', paddingHorizontal: 20 },
        webDateLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '700', marginBottom: 12 },
        pickerRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 15 },
        pickerCol: { flex: 1, alignItems: 'center' },
        pickerLabel: { fontSize: 10, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 6 },
        pickerInput: { width: '100%', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 18, fontWeight: '800', textAlign: 'center', color: colors.text, backgroundColor: isDark ? '#1A1A1A' : colors.background },
        monthScroll: { maxHeight: 150, width: '100%' },
        monthItem: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 4, alignItems: 'center' },
        monthItemActive: { backgroundColor: colors.tint + '20' },
        monthText: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },
        monthTextActive: { color: colors.tint, fontWeight: '900' },
    });
};

const getStyles = (colors: any, activeScheme: string, isRTL: boolean) => {
    const isDark = activeScheme === 'dark';
    const SHADOW = createShadow({ height: 4, opacity: isDark ? 0.3 : 0.05, radius: 8, elevation: 4 });

    return StyleSheet.create({
        container: { flex: 1 },
        header: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 60 },
        headerTitle: { fontSize: 15, fontWeight: '900', color: colors.text, textTransform: 'uppercase', letterSpacing: 1 },
        scroll: { flex: 1 },
        scrollContent: { paddingBottom: 140 },
        contentMaxWidth: { width: '100%', maxWidth: 1440, alignSelf: 'center', paddingHorizontal: 20 },
        card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, marginBottom: 20, ...SHADOW },
        cardLabel: { fontSize: 10, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 12 },
        questionInput: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: isRTL ? 'right' : 'left', minHeight: 60 },
        separator: { height: 1, backgroundColor: colors.border, opacity: 0.15, marginVertical: 12 },
        tagsRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 },
        tagsInput: { flex: 1, fontSize: 14, color: colors.textSecondary },
        sectionLabel: { fontSize: 11, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, marginTop: 10 },
        optionsList: { gap: 10, marginBottom: 20 },
        optionRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 },
        optionIndex: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
        optionIndexText: { fontSize: 11, fontWeight: '900' },
        optionInput: { flex: 1, height: 48, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 15, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border + '20', ...SHADOW },
        removeBtn: { padding: 4 },
        addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 8 },
        addOptionText: { fontSize: 14, fontWeight: '700', color: colors.tint },
        pillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
        pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border + '30', ...SHADOW },
        pillActive: { backgroundColor: colors.tint, borderColor: colors.tint },
        pillText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
        pillTextActive: { color: '#fff' },
        settingsToggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
        togglePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border + '30', ...SHADOW },
        togglePillActive: { backgroundColor: colors.tint, borderColor: colors.tint },
        togglePillText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
        togglePillTextActive: { color: '#fff' },
        advancedInputs: { gap: 10, marginBottom: 20 },
        inputsRow: { flexDirection: 'row', gap: 10 },
        inputCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.card, borderRadius: 16, ...SHADOW },
        inputIconCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.tint + '10', justifyContent: 'center', alignItems: 'center' },
        inputInfo: { flex: 1 },
        inputLabel: { fontSize: 9, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' },
        inputValue: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 1 },
        textInput: { fontSize: 15, fontWeight: '800', color: colors.tint, padding: 0 },
        forwardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 10 },
        forwardContent: { backgroundColor: colors.card, borderRadius: 20, padding: 15, ...SHADOW },
        searchInput: { backgroundColor: colors.muted, borderRadius: 12, padding: 10, fontSize: 14, color: colors.text, marginBottom: 12 },
        spacesScrollContent: { gap: 8, paddingBottom: 5 },
        spacePill: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, paddingRight: 12, backgroundColor: colors.muted, borderRadius: 15 },
        spacePillActive: { backgroundColor: colors.tint + '15', borderWidth: 1, borderColor: colors.tint },
        spacePillText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
        footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, backgroundColor: colors.background + 'F0' },
        submitBtn: { height: 54, borderRadius: 27, overflow: 'hidden', ...SHADOW },
        submitBtnDisabled: { opacity: 0.5 },
        submitGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        submitText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
    });
};

export default PollComponent;
