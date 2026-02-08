import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import DateTimePicker from '@react-native-community/datetimepicker';
import { format, addHours, nextMonday } from 'date-fns';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import * as Haptics from 'expo-haptics';

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
    date.setHours(10, 0, 0, 0); // Default 10 AM
    return date;
  });
  const [duration, setDuration] = useState(60);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState<number | undefined>();

  const collaborationService = CollaborationService.getInstance();

  const activityTypes = [
    { id: 'meeting', name: 'Team Meeting', icon: 'people', color: '#007AFF' },
    { id: 'brainstorm', name: 'Brainstorm', icon: 'bulb', color: '#4CAF50' },
    { id: 'workshop', name: 'Workshop', icon: 'school', color: '#FF9800' },
    { id: 'review', name: 'Review', icon: 'checkmark-circle', color: '#9C27B0' },
    { id: 'planning', name: 'Planning', icon: 'calendar', color: '#3F51B5' },
    { id: 'social', name: 'Social', icon: 'wine', color: '#E91E63' },
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      handleCreateActivity();
    }
  };

  const handleCreateActivity = async () => {
    try {
      const scheduledEnd = new Date(scheduledStart.getTime() + duration * 60000);
      
      await collaborationService.createCollaborativeActivity({
        space_id: spaceId,
        activity_type: activityType,
        title,
        description,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        duration_minutes: duration,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : undefined,
        max_participants: maxParticipants,
        metadata: {
          created_via: 'calendar',
          quick_schedule: true,
        }
      });
      if (Platform.OS === 'web') {
            // const Haptics = await import('expo-haptics');
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
      Alert.alert(
        'Session Scheduled!',
        'Would you like to add this to your device calendar and notify participants?',
        [
          { text: 'Just Save', style: 'cancel', onPress: onClose },
          { 
            text: 'Add to Calendar', 
            onPress: async () => {
              // Here you would trigger the calendar integration
              await handleAddToCalendar();
              onClose();
            }
          },
          { 
            text: 'Send Invites', 
            onPress: async () => {
              // Send notifications to space participants
              await sendInvites();
              onClose();
            }
          }
        ]
      );

      onActivityCreated();
    } catch (error: any) {
      console.error('Error creating activity:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to schedule session');
    }
  };

  const handleAddToCalendar = async () => {
    // Implementation for expo-calendar
    Alert.alert('Calendar', 'This would add to your device calendar');
  };

  const sendInvites = async () => {
    // Implementation for sending invites
    Alert.alert('Invites', 'This would send invites to all space participants');
  };

  const handleQuickTimeSelect = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(scheduledStart);
    newDate.setHours(hours, minutes, 0, 0);
    setScheduledStart(newDate);
  };

  const handleQuickDateSelect = (daysToAdd: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + daysToAdd);
    newDate.setHours(scheduledStart.getHours(), scheduledStart.getMinutes(), 0, 0);
    setScheduledStart(newDate);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header with progress */}
        <View style={styles.header}>
          <TouchableOpacity onPress={step > 1 ? () => setStep(step - 1) : onClose}>
            <Ionicons name={step > 1 ? "chevron-back" : "close"} size={24} color="#333" />
          </TouchableOpacity>
          
          <View style={styles.progressBar}>
            {[1, 2, 3].map((i) => (
              <View 
                key={i}
                style={[
                  styles.progressDot,
                  i <= step && styles.progressDotActive,
                  i === step && styles.progressDotCurrent,
                ]}
              />
            ))}
          </View>
          
          <Text style={styles.stepIndicator}>Step {step}/3</Text>
        </View>

        <ScrollView style={styles.content}>
          {step === 1 && (
            <>
              <Text style={styles.sectionTitle}>What's this session about?</Text>
              
              <TextInput
                style={styles.titleInput}
                placeholder="Session Title (e.g., Weekly Team Sync)"
                value={title}
                onChangeText={setTitle}
                autoFocus
              />
              
              <TextInput
                style={styles.descriptionInput}
                placeholder="Description (optional)"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
              
              <Text style={styles.sectionSubtitle}>Session Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
                {activityTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeOption,
                      activityType === type.id && { borderColor: type.color, backgroundColor: type.color + '10' }
                    ]}
                    onPress={() => setActivityType(type.id)}
                  >
                    <View style={[styles.typeIcon, { backgroundColor: type.color }]}>
                      <Ionicons name={type.icon as any} size={20} color="#fff" />
                    </View>
                    <Text style={[
                      styles.typeName,
                      activityType === type.id && { color: type.color, fontWeight: '600' }
                    ]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.sectionTitle}>When should we meet?</Text>
              
              <View style={styles.dateTimeDisplay}>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                  <Text style={styles.dateTimeText}>
                    {format(scheduledStart, 'EEEE, MMMM d')}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time" size={20} color="#007AFF" />
                  <Text style={styles.dateTimeText}>
                    {format(scheduledStart, 'h:mm a')}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {showDatePicker && Platform.OS === 'ios' && (
                <DateTimePicker
                  value={scheduledStart}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) setScheduledStart(date);
                  }}
                />
              )}
              
              {showTimePicker && Platform.OS === 'ios' && (
                <DateTimePicker
                  value={scheduledStart}
                  mode="time"
                  display="spinner"
                  onChange={(event, date) => {
                    setShowTimePicker(false);
                    if (date) setScheduledStart(date);
                  }}
                />
              )}
              
              <Text style={styles.sectionSubtitle}>Quick Times</Text>
              <View style={styles.quickTimeRow}>
                {quickTimes.map((time) => (
                  <TouchableOpacity
                    key={time.time}
                    style={styles.quickTimeButton}
                    onPress={() => handleQuickTimeSelect(time.time)}
                  >
                    <Text style={styles.quickTimeLabel}>{time.label}</Text>
                    <Text style={styles.quickTimeValue}>{time.time}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.sectionSubtitle}>Quick Dates</Text>
              <View style={styles.quickDateRow}>
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Tomorrow', days: 1 },
                  { label: 'Monday', days: (1 - new Date().getDay() + 7) % 7 || 7 },
                  { label: 'Next Week', days: 7 },
                ].map((date) => (
                  <TouchableOpacity
                    key={date.label}
                    style={styles.quickDateButton}
                    onPress={() => handleQuickDateSelect(date.days)}
                  >
                    <Text style={styles.quickDateLabel}>{date.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.sectionSubtitle}>Duration</Text>
              <View style={styles.durationRow}>
                {durationOptions.map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    style={[styles.durationButton, duration === mins && styles.durationButtonActive]}
                    onPress={() => setDuration(mins)}
                  >
                    <Text style={[styles.durationText, duration === mins && styles.durationTextActive]}>
                      {mins}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.sectionTitle}>Final Details</Text>
              
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>{title}</Text>
                <View style={styles.summaryRow}>
                  <Ionicons name="calendar" size={16} color="#666" />
                  <Text style={styles.summaryText}>
                    {format(scheduledStart, 'EEEE, MMMM d • h:mm a')}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="time" size={16} color="#666" />
                  <Text style={styles.summaryText}>{duration} minutes</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="people" size={16} color="#666" />
                  <Text style={styles.summaryText}>
                    {maxParticipants ? `Up to ${maxParticipants} participants` : 'No participant limit'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.settingRow}>
                <View>
                  <Text style={styles.settingTitle}>Recurring Session</Text>
                  <Text style={styles.settingDescription}>
                    Repeat this session weekly
                  </Text>
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  trackColor={{ false: '#ddd', true: '#007AFF' }}
                />
              </View>
              
              {isRecurring && (
                <View style={styles.recurrenceOptions}>
                  <Text style={styles.sectionSubtitle}>Repeat every:</Text>
                  <View style={styles.recurrenceRow}>
                    {['weekly', 'biweekly', 'monthly'].map((pattern) => (
                      <TouchableOpacity
                        key={pattern}
                        style={[
                          styles.recurrenceButton,
                          recurrencePattern === pattern && styles.recurrenceButtonActive
                        ]}
                        onPress={() => setRecurrencePattern(pattern as any)}
                      >
                        <Text style={[
                          styles.recurrenceText,
                          recurrencePattern === pattern && styles.recurrenceTextActive
                        ]}>
                          {pattern === 'biweekly' ? 'Every 2 weeks' : pattern}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              
              <View style={styles.participantLimit}>
                <Text style={styles.sectionSubtitle}>Participant Limit (optional)</Text>
                <TextInput
                  style={styles.participantInput}
                  placeholder="No limit"
                  value={maxParticipants?.toString() || ''}
                  onChangeText={(text) => setMaxParticipants(text ? parseInt(text) : undefined)}
                  keyboardType="number-pad"
                />
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.nextButton, !title.trim() && step === 1 && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={step === 1 && !title.trim()}
          >
            <Text style={styles.nextButtonText}>
              {step === 3 ? 'Schedule Session' : 'Continue'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  progressDotActive: {
    backgroundColor: '#007AFF',
  },
  progressDotCurrent: {
    width: 12,
    height: 12,
  },
  stepIndicator: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 24,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 12,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    marginBottom: 24,
  },
  descriptionInput: {
    fontSize: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 60,
  },
  typeSelector: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  typeOption: {
    alignItems: 'center',
    padding: 12,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f0f0f0',
    minWidth: 100,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  dateTimeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    flex: 0.48,
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  quickTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickTimeButton: {
    flex: 1,
    minWidth: '22%',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    alignItems: 'center',
  },
  quickTimeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  quickTimeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  quickDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  quickDateButton: {
    flex: 1,
    minWidth: '22%',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    alignItems: 'center',
  },
  quickDateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
  },
  durationButtonActive: {
    backgroundColor: '#007AFF',
  },
  durationText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  durationTextActive: {
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  recurrenceOptions: {
    marginTop: 16,
  },
  recurrenceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  recurrenceButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    alignItems: 'center',
  },
  recurrenceButtonActive: {
    backgroundColor: '#007AFF20',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  recurrenceText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  recurrenceTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  participantLimit: {
    marginTop: 24,
  },
  participantInput: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginTop: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default CreateActivityModal;