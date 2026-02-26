import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import { createShadow } from '@/utils/styles';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  FadeIn,
} from 'react-native-reanimated';
import { safeHaptics } from '@/utils/haptics';

interface CreateActivityModalProps {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
  onActivityCreated: () => void;
  defaultDate?: string;
}

const CreateActivityModal: React.FC<CreateActivityModalProps> = ({
  spaceId,
  visible,
  onClose,
  onActivityCreated,
  defaultDate,
}) => {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('meeting');
  const [scheduledStart, setScheduledStart] = useState<Date>(() => {
    const date = defaultDate ? new Date(defaultDate) : new Date();
    date.setHours(10, 0, 0, 0);
    return date;
  });
  const [duration, setDuration] = useState(60);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState<number | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const collaborationService = CollaborationService.getInstance();

  // Animation values
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, { duration: 500 });
    } else {
      progress.value = 0;
      setStep(1);
      setIsSubmitting(false);
    }
  }, [visible]);

  const activityTypes = [
    { id: 'meeting', name: 'Team Meeting', icon: 'people', color: '#6366f1' },
    { id: 'brainstorm', name: 'Brainstorm', icon: 'bulb', color: '#10b981' },
    { id: 'workshop', name: 'Workshop', icon: 'school', color: '#f59e0b' },
    { id: 'review', name: 'Review', icon: 'checkmark-circle', color: '#8b5cf6' },
    { id: 'planning', name: 'Planning', icon: 'calendar', color: '#3b82f6' },
    { id: 'social', name: 'Social', icon: 'wine', color: '#ec4899' },
  ];

  const durationOptions = [15, 30, 45, 60, 90, 120];
  const quickTimes = [
    { label: 'Morning', time: '09:00' },
    { label: 'Lunch', time: '12:00' },
    { label: 'Afternoon', time: '14:00' },
    { label: 'Late', time: '16:00' },
  ];

  const handleNext = () => {
    if (step === 1 && !title.trim()) {
      Alert.alert('Error', 'Please enter a title for your session');
      return;
    }
    if (step === 2 && !scheduledStart) {
      Alert.alert('Error', 'Please select a date and time');
      return;
    }
    if (step < 3) {
      setStep(step + 1);
      safeHaptics.impact();
      scale.value = withSpring(1.1, {}, () => {
        scale.value = withSpring(1);
      });
    } else {
      handleCreateActivity();
    }
  };

  const handleCreateActivity = async () => {
    try {
      setIsSubmitting(true);
      safeHaptics.success();

      // Simulate a short delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));

      const activityData = {
        space_id: spaceId,
        title,
        description,
        activity_type: activityType,
        scheduled_start: scheduledStart.toISOString(),
        duration_minutes: duration,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : null,
        max_participants: maxParticipants,
      };

      await collaborationService.createCollaborativeActivity(activityData);
      onActivityCreated();
      onClose();
    } catch (error) {
      console.error('Error creating activity:', error);
      Alert.alert('Error', 'Failed to create activity. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickTimeSelect = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(scheduledStart);
    newDate.setHours(hours, minutes, 0, 0);
    setScheduledStart(newDate);
    safeHaptics.impact();
  };

  const handleQuickDateSelect = (daysToAdd: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + daysToAdd);
    newDate.setHours(scheduledStart.getHours(), scheduledStart.getMinutes(), 0, 0);
    setScheduledStart(newDate);
    safeHaptics.impact();
  };

  const animatedHeaderStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1], Extrapolate.CLAMP) }],
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const renderStepIndicator = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        {[1, 2, 3].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.progressDot,
              i <= step && styles.progressDotActive,
              i === step && styles.progressDotCurrent,
            ]}
          />
        ))}
      </View>
      <Text style={styles.stepText}>Step {step} of 3</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#f8fafc', '#f1f5f9']}
        style={styles.container}
      >
        {/* Header */}
        <Animated.View style={[styles.header, animatedHeaderStyle]}>
          <TouchableOpacity
            onPress={step > 1 ? () => setStep(step - 1) : onClose}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <Ionicons name={step > 1 ? 'chevron-back' : 'close'} size={28} color="#1e293b" />
          </TouchableOpacity>

          {renderStepIndicator()}

          <View style={{ width: 28 }} />
        </Animated.View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && (
            <Animated.View entering={FadeIn.duration(300)}>
              <Text style={styles.heroTitle}>Create Session</Text>
              <Text style={styles.heroSubtitle}>Let’s set up your collaborative activity</Text>

              <View style={styles.card}>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Session title"
                  placeholderTextColor="#94a3b8"
                  value={title}
                  onChangeText={setTitle}
                  autoFocus
                />
                <TextInput
                  style={styles.descriptionInput}
                  placeholder="Add description (optional)"
                  placeholderTextColor="#94a3b8"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <Text style={styles.sectionLabel}>Activity Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                {activityTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    activeOpacity={0.7}
                    style={[
                      styles.typeChip,
                      activityType === type.id && styles.typeChipSelected,
                      { borderColor: type.color + '80' },
                    ]}
                    onPress={() => {
                      setActivityType(type.id);
                      safeHaptics.impact();
                    }}
                  >
                    <LinearGradient
                      colors={[type.color, type.color + 'd0']}
                      style={styles.typeIconGradient}
                    >
                      <Ionicons name={type.icon as any} size={22} color="#fff" />
                    </LinearGradient>
                    <Text
                      style={[
                        styles.typeName,
                        activityType === type.id && { color: type.color, fontWeight: '700' },
                      ]}
                    >
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {step === 2 && (
            <Animated.View entering={FadeIn.duration(300)}>
              <Text style={styles.heroTitle}>When?</Text>

              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.dateTimeRow}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={22} color="#64748b" />
                  <Text style={styles.dateTimeValue}>
                    {format(scheduledStart, 'EEEE, MMMM d, yyyy')}
                  </Text>
                </TouchableOpacity>

                <View style={styles.separator} />

                <TouchableOpacity
                  style={styles.dateTimeRow}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={22} color="#64748b" />
                  <Text style={styles.dateTimeValue}>
                    {format(scheduledStart, 'h:mm a')}
                  </Text>
                </TouchableOpacity>
              </View>

              {Platform.OS === 'ios' && showDatePicker && (
                <DateTimePicker
                  value={scheduledStart}
                  mode="date"
                  display="spinner"
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setScheduledStart(date);
                  }}
                />
              )}
              {Platform.OS === 'ios' && showTimePicker && (
                <DateTimePicker
                  value={scheduledStart}
                  mode="time"
                  display="spinner"
                  onChange={(_, date) => {
                    setShowTimePicker(false);
                    if (date) setScheduledStart(date);
                  }}
                />
              )}

              <Text style={styles.sectionLabel}>Quick start times</Text>
              <View style={styles.quickGrid}>
                {quickTimes.map((qt) => (
                  <TouchableOpacity
                    key={qt.time}
                    style={styles.quickPill}
                    onPress={() => handleQuickTimeSelect(qt.time)}
                  >
                    <Text style={styles.quickLabel}>{qt.label}</Text>
                    <Text style={styles.quickValue}>{qt.time}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Quick dates</Text>
              <View style={styles.quickGrid}>
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Tomorrow', days: 1 },
                  { label: 'Next Mon', days: (1 - new Date().getDay() + 7) % 7 || 7 },
                  { label: 'Next week', days: 7 },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={styles.quickPill}
                    onPress={() => handleQuickDateSelect(item.days)}
                  >
                    <Text style={styles.quickLabelBig}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Duration</Text>
              <View style={styles.durationGrid}>
                {durationOptions.map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    style={[
                      styles.durationChip,
                      duration === mins && styles.durationChipActive,
                    ]}
                    onPress={() => {
                      setDuration(mins);
                      safeHaptics.impact();
                    }}
                  >
                    <Text
                      style={[
                        styles.durationText,
                        duration === mins && styles.durationTextActive,
                      ]}
                    >
                      {mins} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          {step === 3 && (
            <Animated.View entering={FadeIn.duration(300)}>
              <Text style={styles.heroTitle}>Almost done!</Text>

              <LinearGradient
                colors={['#ffffff', '#f8fafc']}
                style={styles.summaryCard}
              >
                <View style={styles.summaryHeader}>
                  <LinearGradient
                    colors={[activityTypes.find(t => t.id === activityType)?.color + '80' || '#6366f180', activityTypes.find(t => t.id === activityType)?.color || '#6366f1']}
                    style={styles.summaryIcon}
                  >
                    <Ionicons
                      name={activityTypes.find(t => t.id === activityType)?.icon as any || 'calendar'}
                      size={24}
                      color="#fff"
                    />
                  </LinearGradient>
                  <Text style={styles.summaryTitle} numberOfLines={1}>
                    {title || 'Untitled Session'}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="calendar-outline" size={18} color="#64748b" />
                  <Text style={styles.summaryValue}>
                    {format(scheduledStart, 'EEE, MMM d • h:mm a')}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="time-outline" size={18} color="#64748b" />
                  <Text style={styles.summaryValue}>{duration} minutes</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="people-outline" size={18} color="#64748b" />
                  <Text style={styles.summaryValue}>
                    {maxParticipants ? `Max ${maxParticipants} people` : 'Open to all'}
                  </Text>
                </View>
                {isRecurring && (
                  <View style={styles.summaryRow}>
                    <Ionicons name="repeat-outline" size={18} color="#64748b" />
                    <Text style={styles.summaryValue}>
                      Repeats {recurrencePattern === 'weekly' ? 'weekly' : recurrencePattern === 'biweekly' ? 'every 2 weeks' : 'monthly'}
                    </Text>
                  </View>
                )}
              </LinearGradient>

              <View style={styles.settingCard}>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingTitle}>Recurring</Text>
                  <Text style={styles.settingDesc}>Repeat this event</Text>
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={(val) => {
                    setIsRecurring(val);
                    safeHaptics.impact();
                  }}
                  trackColor={{ false: '#cbd5e1', true: '#6366f1' }}
                  thumbColor={isRecurring ? '#fff' : '#f1f5f9'}
                />
              </View>

              {isRecurring && (
                <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 16 }}>
                  <Text style={styles.sectionLabelSmall}>Repeat every</Text>
                  <View style={styles.recurrenceRow}>
                    {['weekly', 'biweekly', 'monthly'].map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.recurrenceOption,
                          recurrencePattern === p && styles.recurrenceOptionActive,
                        ]}
                        onPress={() => setRecurrencePattern(p as any)}
                      >
                        <Text
                          style={[
                            styles.recurrenceText,
                            recurrencePattern === p && styles.recurrenceTextActive,
                          ]}
                        >
                          {p === 'biweekly' ? '2 weeks' : p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              )}

              <View style={{ marginTop: 24 }}>
                <Text style={styles.sectionLabel}>Participant Limit (optional)</Text>
                <View style={styles.participantInputWrapper}>
                  <TextInput
                    style={styles.participantInput}
                    placeholder="Unlimited"
                    placeholderTextColor="#94a3b8"
                    value={maxParticipants?.toString() ?? ''}
                    onChangeText={(txt) => setMaxParticipants(txt ? Number(txt) : undefined)}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Animated.View style={[animatedButtonStyle, { flex: 1 }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.actionButton,
                (step === 1 && !title.trim()) || isSubmitting ? styles.actionButtonDisabled : null,
              ]}
              onPress={handleNext}
              disabled={(step === 1 && !title.trim()) || isSubmitting}
            >
              <LinearGradient
                colors={['#6366f1', '#4f46e5']}
                style={styles.buttonGradient}
              >
                {isSubmitting && step === 3 ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>
                      {step === 3 ? 'Schedule Session' : 'Continue'}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </LinearGradient>
    </Modal>
  );
};

const SHADOW = createShadow({ height: 6, opacity: 0.12, radius: 12, elevation: 8 });

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  progressDotActive: {
    backgroundColor: '#6366f1',
  },
  progressDotCurrent: {
    width: 12,
    height: 12,
    borderWidth: 3,
    borderColor: '#a5b4fc',
  },
  stepText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 28,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    ...SHADOW,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  descriptionInput: {
    marginTop: 16,
    fontSize: 16,
    color: '#334155',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 14,
  },
  sectionLabelSmall: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  typeScroll: {
    marginHorizontal: -4,
  },
  typeChip: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
    ...SHADOW,
    minWidth: 110,
  },
  typeChipSelected: {
    borderWidth: 2,
  },
  typeIconGradient: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  dateTimeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 14,
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  quickPill: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    ...SHADOW,
  },
  quickLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  quickLabelBig: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  quickValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  durationChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    ...SHADOW,
  },
  durationChipActive: {
    backgroundColor: '#6366f1',
  },
  durationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  durationTextActive: {
    color: '#ffffff',
  },
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    ...SHADOW,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryValue: {
    fontSize: 15,
    color: '#475569',
    marginLeft: 12,
    flex: 1,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...SHADOW,
  },
  settingLeft: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  settingDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  recurrenceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  recurrenceOption: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    alignItems: 'center',
  },
  recurrenceOptionActive: {
    backgroundColor: '#e0e7ff',
    borderWidth: 1.5,
    borderColor: '#6366f1',
  },
  recurrenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  recurrenceTextActive: {
    color: '#4f46e5',
    fontWeight: '700',
  },
  participantInputWrapper: {
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    marginTop: 8,
    ...SHADOW,
  },
  participantInput: {
    fontSize: 16,
    padding: 16,
    color: '#0f172a',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  actionButton: {
    borderRadius: 20,
    overflow: 'hidden',
    ...SHADOW,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default CreateActivityModal;