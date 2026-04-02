// components/CalendarView.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  Animated,
  RefreshControl,
  Modal,
  Share,
  Linking,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { format, parseISO, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, isTomorrow, addHours, differenceInMinutes, getHours, getMinutes, setHours, setMinutes } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AnimatedComponent, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import * as CalendarService from 'expo-calendar';
import CollaborationService, { CollaborativeActivity } from '@/services/ChatScreen/CollaborationService';
import { createShadow } from '@/utils/styles';
import { useCollaborationStore } from '@/stores/collaborationStore';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import CreateActivityModal from './CreateActivityModal';
import AuthContext from '@/context/AuthContext';
import { useToastStore } from '@/stores/toastStore';

const { width, height } = Dimensions.get('window');
const HOUR_HEIGHT = 80;

interface CalendarViewProps {
  spaceId: string;
  initialActivityId?: string;
  onActivityCreated?: () => void;
  onCreateActivity?: () => void;
  onJoinSession?: (activity: CollaborativeActivity) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  spaceId,
  initialActivityId,
  onActivityCreated,
  onCreateActivity,
  onJoinSession,
}) => {
  const { user } = useContext(AuthContext);
  const { showToast } = useToastStore();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [selectedActivity, setSelectedActivity] = useState<CollaborativeActivity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const weekScrollRef = useRef<ScrollView>(null);
  const dayScrollRef = useRef<ScrollView>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<CollaborativeActivity | null>(null);
  const [spaceParticipants, setSpaceParticipants] = useState<any[]>([]);
  const [isManagingParticipants, setIsManagingParticipants] = useState(false);
  const [isUpdatingParticipants, setIsUpdatingParticipants] = useState(false);
  const [preselectedTime, setPreselectedTime] = useState<Date | undefined>(undefined);

  const spaceActivitiesData = useCollaborationStore(state => state.spaceActivities[spaceId]);
  const spaceActivities = spaceActivitiesData || [];
  const currentSpace = useCollaborationStore(state => state.spaces.find(s => s.id === spaceId));
  const loading = useCollaborationStore(state => state.isLoading);

  useEffect(() => {
    useCollaborationStore.getState().fetchSpaceActivities(spaceId);
  }, [spaceId]);

  // Handle initial activity selection from routing/notifications
  useEffect(() => {
    if (initialActivityId && spaceActivities.length > 0) {
      const activity = spaceActivities.find(a => String(a.id) === String(initialActivityId));
      if (activity && activity.scheduled_start) {
        console.log('📍 Auto-selecting activity from route:', initialActivityId);
        setSelectedDate(parseISO(activity.scheduled_start));
        setSelectedActivity(activity);
        setViewMode('day'); // Focus on the day view

        // Haptic feedback to confirm the landing
        safeHaptics.success();
      }
    }
  }, [initialActivityId, spaceActivities.length]);

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      scheduled: '#007AFF',
      active: '#4CAF50',
      completed: '#757575',
      cancelled: '#F44336',
      proposed: '#FFA726',
    };
    return colors[status] || '#666';
  };

  const getActivityIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      brainstorm: 'bulb',
      discussion: 'chatbubbles',
      workshop: 'people',
      meeting: 'videocam',
      'problem-solving': 'construct',
      planning: 'calendar',
      review: 'checkmark-circle',
      retrospective: 'refresh-circle',
      social: 'wine',
    };
    return icons[type] || 'cube';
  };

  // Get activities for a specific date
  const getActivitiesForDate = useCallback((date: Date) => {
    return spaceActivities.filter(activity => {
      if (!activity.scheduled_start) return false;
      const activityDate = parseISO(activity.scheduled_start);
      return isSameDay(activityDate, date);
    }).sort((a, b) => {
      const aTime = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
      const bTime = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      return aTime - bTime;
    });
  }, [spaceActivities]);

  const handleTimeSlotPress = (date: Date) => {
    setPreselectedTime(date);
    setShowCreateModal(true);
    safeHaptics.impact();
  };

  // Get position for activity in timeline
  const getActivityPosition = useCallback((activity: CollaborativeActivity) => {
    if (!activity.scheduled_start) return { top: 0, height: 0 };
    const startTime = parseISO(activity.scheduled_start);
    const endTime = addHours(startTime, (activity.duration_minutes || 60) / 60);

    const startHour = getHours(startTime);
    const startMinute = getMinutes(startTime);
    const endHour = getHours(endTime);
    const endMinute = getMinutes(endTime);

    const startOffset = startHour * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT;
    const duration = (endHour - startHour) * HOUR_HEIGHT + (endMinute - startMinute) / 60 * HOUR_HEIGHT;

    return { top: startOffset, height: Math.max(duration, HOUR_HEIGHT / 2) };
  }, []);

  // Get hours for timeline
  const getHoursRange = useCallback(() => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(setHours(setMinutes(new Date(), 0), i));
    }
    return hours;
  }, []);

  // Get week days
  const getWeekDays = useCallback(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end }).map(day => ({
      date: day,
      activities: getActivitiesForDate(day),
    }));
  }, [selectedDate, getActivitiesForDate]);

  // Generate marked dates for calendar
  const markedDates = useMemo(() => {
    const marks: { [key: string]: any } = {};
    spaceActivities.forEach(activity => {
      if (activity.scheduled_start) {
        const date = format(parseISO(activity.scheduled_start), 'yyyy-MM-dd');
        if (!marks[date]) {
          marks[date] = {
            marked: true,
            dots: [{ color: getStatusColor(activity.status) }],
            activities: [activity],
          };
        } else {
          marks[date].dots.push({ color: getStatusColor(activity.status) });
          marks[date].activities.push(activity);
        }
      }
    });
    return marks;
  }, [spaceActivities]);

  const handleDayPress = (day: any) => {
    setSelectedDate(parseISO(day.dateString));
    setViewMode('day');
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleAddToDeviceCalendar = async (activity: CollaborativeActivity) => {
    const success = await CollaborationService.getInstance().exportToExternalCalendar(activity);
    if (success && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleExportICS = async (activity: CollaborativeActivity) => {
    const success = await CollaborationService.getInstance().exportToICS(activity, currentSpace?.title);
    if (success && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleActivityPress = async (activity: CollaborativeActivity) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedActivity(activity);
    setIsManagingParticipants(false);

    // Fetch space details to get full participant list for picking
    try {
      const spaceData = await CollaborationService.getInstance().fetchSpaceDetails(activity.space_id);
      setSpaceParticipants(spaceData.participants || []);
    } catch (error) {
      console.error('Error fetching space participants:', error);
    }
  };

  const handleDeleteActivity = async (activityId: number) => {
    console.log('🗑️ Delete activity triggered for ID:', activityId);

    const performDeletion = async () => {
      try {
        await CollaborationService.getInstance().deleteCollaborativeActivity(activityId);
        setSelectedActivity(null);

        // Store will update automatically via real-time event
        useToastStore.getState().showToast('Activity deleted successfully', 'success');

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error: any) {
        console.error('Error deleting activity:', error);
        const errorMessage = error.message || 'Failed to delete activity';
        if (Platform.OS === 'web') {
          window.alert(errorMessage);
        } else {
          Alert.alert('Error', errorMessage);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this activity? This action cannot be undone and will notify all participants.')) {
        await performDeletion();
      }
    } else {
      Alert.alert(
        'Delete Activity',
        'Are you sure you want to delete this activity? This action cannot be undone and will notify all participants.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDeletion
          }
        ]
      );
    }
  };

  const handleUpdateParticipant = async (userId: number, action: 'add' | 'remove') => {
    if (!selectedActivity) return;

    setIsUpdatingParticipants(true);
    try {
      const updatedActivity = await CollaborationService.getInstance().updateActivityParticipants(
        selectedActivity.id,
        {
          participant_ids: [userId],
          action: action
        }
      );

      // Update local state
      setSelectedActivity(updatedActivity);
      // Update global store
      useCollaborationStore.getState().updateActivity(updatedActivity);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error updating participants:', error);
      Alert.alert('Error', 'Failed to update participants');
    } finally {
      setIsUpdatingParticipants(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = addDays(selectedDate, direction === 'next' ? 7 : -7);
    setSelectedDate(newDate);
    if (weekScrollRef.current) {
      weekScrollRef.current.scrollTo({ x: 0, animated: true });
    }
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = addDays(selectedDate, direction === 'next' ? 1 : -1);
    setSelectedDate(newDate);
    if (dayScrollRef.current) {
      dayScrollRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await useCollaborationStore.getState().fetchSpaceActivities(spaceId);
    setRefreshing(false);
  };

  // Week View Component
  const WeekView = () => {
    const weekDays = getWeekDays();
    const hours = getHoursRange();

    return (
      <View style={{ flex: 1, width: '100%', maxWidth: 1400 }}>
        <ScrollView
          ref={weekScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.weekContainer}
          contentContainerStyle={styles.weekContent}
        >
          <View style={{ flex: 1 }}>
            {/* Header Row */}
            <View style={{ flexDirection: 'row', backgroundColor: '#fff', zIndex: 10 }}>
              <View style={[styles.timeColumn, { height: 90, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }]}>
                <View style={styles.timeHeader} />
              </View>
              {weekDays.map((day, dayIndex) => {
                const isSelected = isSameDay(day.date, selectedDate);
                return (
                  <TouchableOpacity
                    key={dayIndex}
                    style={[
                      styles.dayColumn,
                      { height: 90, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
                      isSelected && styles.dayColumnSelected,
                    ]}
                    onPress={() => setSelectedDate(day.date)}
                  >
                    <View style={[styles.dayHeader, isSelected && styles.dayHeaderSelected, { height: '100%', borderBottomWidth: 0 }]}>
                      <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                        {format(day.date, 'EEE')}
                      </Text>
                      <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
                        {format(day.date, 'd')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Shared Vertical Scroll Area */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={{ flexDirection: 'row' }}
            >
              <View style={[styles.timeColumn, { borderTopWidth: 0 }]}>
                {hours.map((hour, index) => (
                  <View key={index} style={styles.timeSlot}>
                    <Text style={styles.timeText}>
                      {format(hour, 'h a')}
                    </Text>
                  </View>
                ))}
              </View>

              {weekDays.map((day, dayIndex) => {
                const isSelected = isSameDay(day.date, selectedDate);

                return (
                  <View
                    key={dayIndex}
                    style={[
                      styles.dayColumn,
                      isSelected && styles.dayColumnSelected,
                      { borderTopWidth: 0 }
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={1}
                      style={styles.dayGrid}
                    >
                      {hours.map((hour, hourIndex) => {
                        const hourActivities = day.activities.filter(activity => {
                          if (!activity.scheduled_start) return false;
                          const activityHour = getHours(parseISO(activity.scheduled_start));
                          return activityHour === hourIndex;
                        });

                        return (
                          <TouchableOpacity
                            key={hourIndex}
                            style={styles.hourSlot}
                            activeOpacity={0.7}
                            onPress={() => {
                              const date = new Date(day.date);
                              date.setHours(hourIndex, 0, 0, 0);
                              handleTimeSlotPress(date);
                            }}
                          >
                            {hourActivities.map(activity => {
                              const position = getActivityPosition(activity);
                              return (
                                <AnimatedComponent.View
                                  key={activity.id}
                                  entering={FadeInDown.delay(dayIndex * 50)}
                                  style={[
                                    styles.weekActivityCard,
                                    {
                                      top: position.top % HOUR_HEIGHT,
                                      height: position.height,
                                      borderLeftColor: getStatusColor(activity.status),
                                    }
                                  ]}
                                >
                                  <TouchableOpacity
                                    style={styles.weekActivityTouchable}
                                    onPress={() => handleActivityPress(activity)}
                                  >
                                    <View style={styles.weekActivityHeader}>
                                      <Ionicons
                                        name={getActivityIcon(activity.activity_type)}
                                        size={10}
                                        color={getStatusColor(activity.status)}
                                      />
                                      <Text style={styles.weekActivityTitle} numberOfLines={1}>
                                        {activity.title}
                                      </Text>
                                    </View>
                                    <Text style={styles.weekActivityTime}>
                                      {format(parseISO(activity.scheduled_start!), 'h:mm a')}
                                    </Text>
                                  </TouchableOpacity>
                                </AnimatedComponent.View>
                              );
                            })}
                          </TouchableOpacity>
                        );
                      })}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    );
  };

  // Day View Component
  const DayView = () => {
    const activities = getActivitiesForDate(selectedDate);
    const hours = getHoursRange();

    return (
      <ScrollView
        ref={dayScrollRef}
        style={styles.dayContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4B53BC" />
        }
      >
        {/* Current Time Indicator */}
        {isToday(selectedDate) && (
          <View
            style={[
              styles.currentTimeLine,
              { top: (new Date().getHours() * HOUR_HEIGHT) + (new Date().getMinutes() / 60 * HOUR_HEIGHT) }
            ]}
          >
            <View style={styles.currentTimeDot} />
            <View style={styles.currentTimeBar} />
          </View>
        )}

        {hours.map((hour, index) => {
          const hourActivities = activities.filter(activity => {
            if (!activity.scheduled_start) return false;
            const activityHour = getHours(parseISO(activity.scheduled_start));
            return activityHour === index;
          });

          return (
            <View key={index} style={styles.dayHourSlot}>
              <View style={styles.dayHourLabel}>
                <Text style={styles.dayHourText}>
                  {format(hour, 'h a')}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.dayHourContent}
                activeOpacity={0.7}
                onPress={() => handleTimeSlotPress(hour)}
              >
                {hourActivities.map(activity => (
                  <AnimatedComponent.View
                    key={activity.id}
                    entering={SlideInRight.delay(index * 30)}
                    style={[
                      styles.dayActivityCard,
                      { borderLeftColor: getStatusColor(activity.status) }
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.dayActivityTouchable}
                      onPress={() => handleActivityPress(activity)}
                    >
                      <View style={styles.dayActivityHeader}>
                        <View style={styles.dayActivityBadge}>
                          <Ionicons
                            name={getActivityIcon(activity.activity_type)}
                            size={14}
                            color={getStatusColor(activity.status)}
                          />
                          <Text style={[
                            styles.dayActivityType,
                            { color: getStatusColor(activity.status) }
                          ]}>
                            {activity.activity_type}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(activity.status) + '20' }]}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(activity.status) }]} />
                          <Text style={[styles.statusText, { color: getStatusColor(activity.status) }]}>
                            {activity.status}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.dayActivityTitle}>{activity.title}</Text>

                      {activity.description && (
                        <Text style={styles.dayActivityDescription} numberOfLines={2}>
                          {activity.description}
                        </Text>
                      )}

                      <View style={styles.dayActivityMeta}>
                        <View style={styles.dayActivityDuration}>
                          <Ionicons name="timer-outline" size={14} color="#666" />
                          <Text style={styles.dayActivityMetaText}>
                            {activity.duration_minutes || 60} min
                          </Text>
                        </View>
                        <View style={styles.dayActivityParticipants}>
                          <Ionicons name="people-outline" size={14} color="#666" />
                          <Text style={styles.dayActivityMetaText}>
                            {activity.confirmed_participants || 0} participants
                          </Text>
                        </View>
                      </View>

                      <View style={styles.dayActivityActions}>
                        <TouchableOpacity
                          style={styles.dayAction}
                          onPress={() => handleAddToDeviceCalendar(activity)}
                        >
                          <Ionicons name="calendar-outline" size={16} color="#4B53BC" />
                          <Text style={[styles.dayActionText, { color: '#4B53BC' }]}>Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.dayAction}
                          onPress={() => handleExportICS(activity)}
                        >
                          <Ionicons name="download-outline" size={16} color="#666" />
                          <Text style={styles.dayActionText}>Export</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.dayAction, styles.dayActionJoin]}
                          onPress={() => {
                            // Join session logic
                          }}
                        >
                          <LinearGradient
                            colors={['#4B53BC', '#3A4299']}
                            style={styles.joinButtonGradient}
                          >
                            <Ionicons name="enter-outline" size={14} color="#fff" />
                            <Text style={styles.joinButtonText}>Join</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </AnimatedComponent.View>
                ))}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // Month View Component
  const MonthView = () => (
    <ScrollView style={styles.monthContainer}>
      <Calendar
        current={format(selectedDate, 'yyyy-MM-dd')}
        onDayPress={handleDayPress}
        markedDates={{
          ...markedDates,
          [format(selectedDate, 'yyyy-MM-dd')]: {
            ...markedDates[format(selectedDate, 'yyyy-MM-dd')],
            selected: true,
            selectedColor: '#007AFF'
          }
        }}
        theme={{
          backgroundColor: '#fff',
          calendarBackground: '#fff',
          textSectionTitleColor: '#666',
          selectedDayBackgroundColor: '#007AFF',
          selectedDayTextColor: '#fff',
          todayTextColor: '#007AFF',
          dayTextColor: '#333',
          textDisabledColor: '#ddd',
          dotColor: '#007AFF',
          arrowColor: '#007AFF',
          monthTextColor: '#333',
          textMonthFontWeight: '600',
          textDayFontSize: 16,
          textDayHeaderFontSize: 13,
        }}
        renderArrow={(direction: string) => (
          <Ionicons
            name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
            size={24}
            color="#4B53BC"
          />
        )}
        markingType={'multi-dot'}
      />
    </ScrollView>
  );

  // Activity Detail Modal
  const ActivityDetailModal = () => (
    <Modal
      visible={!!selectedActivity}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedActivity(null)}
    >
      <BlurView intensity={90} tint="dark" style={styles.modalOverlay}>
        <AnimatedComponent.View
          entering={FadeInUp.springify().damping(15)}
          style={styles.modalContainer}
        >
          {selectedActivity && (
            <>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <Text style={styles.modalTitle}>{selectedActivity.title}</Text>
                  {(String(selectedActivity.created_by || selectedActivity.creator?.id) === String(user?.id)) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        style={styles.editButton}
                        activeOpacity={0.6}
                        onPress={() => {
                          setActivityToEdit(selectedActivity);
                          setIsEditing(true);
                          setShowCreateModal(true);
                          setSelectedActivity(null);
                        }}
                      >
                        <Ionicons name="pencil" size={20} color="#007AFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editButton, { marginLeft: 12 }]}
                        activeOpacity={0.6}
                        onPress={() => handleDeleteActivity(selectedActivity.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => setSelectedActivity(null)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Details</Text>
                  <Text style={styles.modalText}>{selectedActivity.description || 'No description'}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Time</Text>
                  <View style={styles.modalTimeRow}>
                    <Ionicons name="time-outline" size={20} color="#007AFF" />
                    <Text style={styles.modalText}>
                      {selectedActivity.scheduled_start
                        ? format(parseISO(selectedActivity.scheduled_start), 'EEEE, MMMM d, h:mm a')
                        : 'Not scheduled'}
                    </Text>
                  </View>
                  <View style={styles.modalTimeRow}>
                    <Ionicons name="timer-outline" size={20} color="#007AFF" />
                    <Text style={styles.modalText}>
                      Duration: {selectedActivity.duration_minutes || 60} minutes
                    </Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Participants</Text>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.modalParticipantsRow}>
                      <Ionicons name="people" size={18} color="#007AFF" />
                      <Text style={styles.modalText}>
                        {selectedActivity.participants?.length || 0} participants
                      </Text>
                    </View>
                    {(String(selectedActivity.created_by || selectedActivity.creator?.id) === String(user?.id)) && (
                      <TouchableOpacity
                        onPress={() => setIsManagingParticipants(!isManagingParticipants)}
                        style={styles.manageButton}
                      >
                        <Text style={styles.manageButtonText}>
                          {isManagingParticipants ? 'Done' : 'Manage'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.participantsList}>
                    {selectedActivity.participants?.map((p: any) => (
                      <View key={p.id} style={styles.participantItem}>
                        <View style={styles.participantInfo}>
                          <View style={styles.participantAvatar}>
                            <Text style={styles.avatarText}>{p.name?.charAt(0).toUpperCase()}</Text>
                          </View>
                          <Text style={styles.participantName}>{p.name}</Text>
                        </View>
                        {isManagingParticipants && (
                          <TouchableOpacity
                            onPress={() => handleUpdateParticipant(p.id, 'remove')}
                            disabled={isUpdatingParticipants}
                          >
                            <Ionicons name="remove-circle" size={22} color="#F44336" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}

                    {isManagingParticipants && spaceParticipants
                      .filter(sp => !selectedActivity.participant_ids?.includes(sp.user_id) && !selectedActivity.participants?.some((p: any) => p.id === sp.user_id))
                      .map((sp: any) => (
                        <View key={sp.user_id} style={styles.participantItem}>
                          <View style={styles.participantInfo}>
                            <View style={[styles.participantAvatar, { backgroundColor: '#E0E0E0' }]}>
                              <Text style={styles.avatarText}>{sp.user?.name?.charAt(0).toUpperCase()}</Text>
                            </View>
                            <Text style={[styles.participantName, { color: '#888' }]}>{sp.user?.name}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleUpdateParticipant(sp.user_id, 'add')}
                            disabled={isUpdatingParticipants}
                          >
                            <Ionicons name="add-circle" size={22} color="#4CAF50" />
                          </TouchableOpacity>
                        </View>
                      ))
                    }
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalAction}
                    onPress={() => handleAddToDeviceCalendar(selectedActivity)}
                  >
                    <Ionicons name="calendar" size={20} color="#007AFF" />
                    <Text style={styles.modalActionText}>Add to Calendar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalAction}
                    onPress={() => handleExportICS(selectedActivity)}
                  >
                    <Ionicons name="download" size={20} color="#666" />
                    <Text style={styles.modalActionText}>Export ICS</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalAction}
                    onPress={() => {
                      const frontendHost = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
                      const deepLink = `${frontendHost}/${selectedActivity.space_id}?activity=${selectedActivity.id}`;
                      require('expo-clipboard').setStringAsync(deepLink);
                      useToastStore.getState().showToast('Session link copied to clipboard!', 'success');
                      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                  >
                    <Ionicons name="link" size={20} color="#666" />
                    <Text style={styles.modalActionText}>Copy Link</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalAction, styles.modalActionJoin]}
                    onPress={() => {
                      const activityToJoin = selectedActivity;
                      console.log('🔗 Join Session clicked for activity:', activityToJoin?.id);
                      setSelectedActivity(null); // Immediate modal closure
                      
                      if (activityToJoin) {
                        if (onJoinSession) {
                          onJoinSession(activityToJoin);
                        } else {
                          router.push(`/(spaces)/${activityToJoin.space_id}?tab=meeting&activity=${activityToJoin.id}`);
                        }
                      }
                    }}
                  >
                    <LinearGradient
                      colors={['#007AFF', '#0056CC']}
                      style={styles.modalJoinGradient}
                    >
                      <Ionicons name="enter" size={20} color="#fff" />
                      <Text style={styles.modalJoinText}>Join Session</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </>
          )}
        </AnimatedComponent.View>
      </BlurView>
    </Modal>
  );

  if (loading && spaceActivities.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with View Toggle */}
      <View style={styles.header}>
        <View style={styles.viewToggle}>
          {[
            { id: 'day', label: 'Day', icon: 'today' },
            { id: 'week', label: 'Week', icon: 'calendar' },
            { id: 'month', label: 'Month', icon: 'calendar-outline' },
          ].map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[
                styles.viewToggleButton,
                viewMode === mode.id && styles.viewToggleButtonActive
              ]}
              onPress={() => setViewMode(mode.id as any)}
            >
              <Ionicons
                name={mode.icon as any}
                size={16}
                color={viewMode === mode.id ? '#007AFF' : '#666'}
              />
              <Text style={[
                styles.viewToggleText,
                viewMode === mode.id && styles.viewToggleTextActive
              ]}>
                {mode.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={onCreateActivity}
        >
          <LinearGradient
            colors={['#007AFF', '#0056CC']}
            style={styles.createButtonGradient}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.createButtonText}>Schedule</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Navigation Bar */}
      {(viewMode === 'week' || viewMode === 'day') && (
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => viewMode === 'week' ? navigateWeek('prev') : navigateDay('prev')}
          >
            <Ionicons name="chevron-back" size={20} color="#007AFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navDate}
            onPress={() => setSelectedDate(new Date())}
          >
            <Text style={styles.navDateText}>
              {viewMode === 'week'
                ? `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
                : format(selectedDate, 'MMMM d, yyyy')
              }
            </Text>
            {viewMode === 'day' && (
              <View style={styles.activityCountBadge}>
                <Text style={styles.activityCountBadgeText}>
                  {getActivitiesForDate(selectedDate).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => viewMode === 'week' ? navigateWeek('next') : navigateDay('next')}
          >
            <Ionicons name="chevron-forward" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        {viewMode === 'day' && <DayView />}
        {viewMode === 'week' && <WeekView />}
        {viewMode === 'month' && <MonthView />}
      </View>

      {/* Activity Detail Modal */}
      <ActivityDetailModal />

      <CreateActivityModal
        visible={showCreateModal}
        spaceId={spaceId}
        initialTime={preselectedTime}
        isEditing={isEditing}
        activityToEdit={activityToEdit || undefined}
        onClose={() => {
          setShowCreateModal(false);
          setPreselectedTime(undefined);
          setIsEditing(false);
          setActivityToEdit(null);
        }}
        onActivityCreated={() => {
          if (onActivityCreated) onActivityCreated();
          // Local store is updated inside CreateActivityModal
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 4,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  viewToggleButtonActive: {
    backgroundColor: '#fff',
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.1,
      radius: 4,
      elevation: 2,
    }),
  },
  viewToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  viewToggleTextActive: {
    color: '#007AFF',
  },
  createButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  navDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  activityCountBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activityCountBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  // Week View Styles
  weekContainer: {
    flex: 1,
  },
  weekContent: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 50,
    backgroundColor: '#F8F9FA',
    borderRightWidth: 1,
    borderRightColor: '#F0F0F0',
  },
  timeHeader: {
    height: 80,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timeSlot: {
    height: HOUR_HEIGHT,
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timeText: {
    fontSize: 10,
    color: '#666',
    marginTop: -8,
  },
  dayColumn: {
    width: (width - 50) / 7,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#F0F0F0',
  },
  dayColumnSelected: {
    backgroundColor: '#F8F9FA',
  },
  dayHeader: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#fff',
    paddingVertical: 8,
  },
  dayHeaderSelected: {
    backgroundColor: '#EBF0FF',
  },
  dayName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    textTransform: 'uppercase',
  },
  dayNameSelected: {
    color: '#007AFF',
    fontWeight: '700',
  },
  dayNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 2,
  },
  dayNumberSelected: {
    color: '#007AFF',
  },
  todayBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  todayBadgeText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '600',
  },
  activityCount: {
    fontSize: 9,
    color: '#666',
    marginTop: 4,
  },
  dayGrid: {
    height: 24 * HOUR_HEIGHT,
  },
  hourSlot: {
    height: HOUR_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    position: 'relative',
  },
  weekActivityCard: {
    position: 'absolute',
    left: 2,
    right: 2,
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 6,
    borderLeftWidth: 3,
    ...createShadow({
      width: 0,
      height: 1,
      opacity: 0.1,
      radius: 2,
      elevation: 1,
    }),
  },
  weekActivityTouchable: {
    flex: 1,
  },
  weekActivityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  weekActivityTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  weekActivityTime: {
    fontSize: 8,
    color: '#666',
  },
  // Day View Styles
  dayContainer: {
    flex: 1,
  },
  currentTimeLine: {
    position: 'absolute',
    left: 50,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  currentTimeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginLeft: -5,
  },
  currentTimeBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#FF3B30',
  },
  dayHourSlot: {
    flexDirection: 'row',
    minHeight: HOUR_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dayHourLabel: {
    width: 50,
    paddingTop: 8,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F0F0F0',
    backgroundColor: '#F8F9FA',
  },
  dayHourText: {
    fontSize: 11,
    color: '#666',
  },
  dayHourContent: {
    flex: 1,
    padding: 8,
  },
  dayActivityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.05,
      radius: 4,
      elevation: 2,
    }),
  },
  dayActivityTouchable: {
    padding: 12,
  },
  dayActivityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayActivityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayActivityType: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dayActivityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  dayActivityDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  dayActivityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  dayActivityDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayActivityParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayActivityMetaText: {
    fontSize: 11,
    color: '#666',
  },
  dayActivityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    gap: 4,
  },
  dayActionJoin: {
    padding: 0,
    backgroundColor: 'transparent',
  },
  joinButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  joinButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  dayActionText: {
    fontSize: 12,
    color: '#666',
  },
  // Month View Styles
  monthContainer: {
    flex: 1,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    width: Math.min(width - 40, 500),
    maxHeight: height * 0.8,
    ...createShadow({
      width: 0,
      height: 10,
      opacity: 0.3,
      radius: 20,
      elevation: 10,
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flexShrink: 1,
  },
  editButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
  },
  modalContent: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  modalTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modalSpaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalSpaceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modalParticipantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  modalAction: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  modalActionJoin: {
    padding: 0,
    backgroundColor: 'transparent',
    minWidth: '100%',
  },
  modalJoinGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  modalActionText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  modalJoinText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  manageButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  manageButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  participantsList: {
    gap: 10,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    borderRadius: 12,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  participantName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
});

export default CalendarView;