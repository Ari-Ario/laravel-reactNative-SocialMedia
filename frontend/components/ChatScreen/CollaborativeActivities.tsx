// components/ChatScreen/CollaborativeActivities.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  StatusBar,
  Platform,
  RefreshControl,
  Share,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CollaborationService, { CollaborativeActivity } from '@/services/ChatScreen/CollaborationService';
import { createShadow } from '@/utils/styles';
import * as Haptics from 'expo-haptics';
import { Calendar } from 'react-native-calendars';
import {
  format,
  parseISO,
  isToday,
  isTomorrow,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameWeek,
  isBefore,
  isAfter,
  differenceInMinutes,
  addHours,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
} from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AuthContext from '@/context/AuthContext';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  SlideInLeft,
  Layout,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeHaptics } from '@/utils/haptics';
import CreateActivityModal from './CreateActivityModal';

const { width, height } = Dimensions.get('window');
const HOUR_HEIGHT = 70;
const DAYS_TO_SHOW = 7;

interface CollaborativeActivitiesProps {
  onClose: () => void;
  onActivitySelect: (activity: CollaborativeActivity) => void;
  spaceId?: string;
  initialActivityId?: string;
}

const CollaborativeActivities: React.FC<CollaborativeActivitiesProps> = ({
  onClose,
  onActivitySelect,
  spaceId,
  initialActivityId,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const storeSpaces = useCollaborationStore(state => state.spaces);
  const globalActivities = useCollaborationStore(state => state.globalActivities);
  const spaceActivitiesNode = useCollaborationStore(state => state.spaceActivities);
  const globalUpcomingCount = useCollaborationStore(state => state.globalUpcomingCount);
  const spaceUpcomingCountsNode = useCollaborationStore(state => state.spaceUpcomingCounts);

  // Backward compatibility for existing logic, now supporting direct space state mapping
  const spaces = storeSpaces;
  const initialActivities = spaceId ? (spaceActivitiesNode[spaceId] || []) : globalActivities;
  const initialCount = spaceId ? (spaceUpcomingCountsNode[spaceId] || 0) : globalUpcomingCount;
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'active' | 'completed'>('upcoming');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<CollaborativeActivity | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<CollaborativeActivity | null>(null);
  const [calendarMarked, setCalendarMarked] = useState<any>({});
  const [spaceParticipants, setSpaceParticipants] = useState<any[]>([]);
  const [isManagingParticipants, setIsManagingParticipants] = useState(false);
  const [isUpdatingParticipants, setIsUpdatingParticipants] = useState(false);
  const [preselectedTime, setPreselectedTime] = useState<Date | undefined>(undefined);
  const { user } = React.useContext(AuthContext);
  const weekScrollRef = useRef<ScrollView>(null);
  const dayScrollRef = useRef<ScrollView>(null);

  const collaborationService = CollaborationService.getInstance();

  const handleTimeSlotPress = (date: Date) => {
    setPreselectedTime(date);
    setShowCreateModal(true);
    safeHaptics.impact();
  };

  // Filter activities based on space
  const filteredActivities = useMemo(() => {
    let activities = initialActivities;
    if (spaceId) {
      activities = activities.filter(a => a.space_id === spaceId);
    }
    return activities;
  }, [initialActivities, spaceId]);

  // Get activities for selected date range
  const getActivitiesForDate = useCallback((date: Date) => {
    return filteredActivities.filter(activity => {
      if (!activity.scheduled_start) return false;
      const activityDate = parseISO(activity.scheduled_start);
      return isSameDay(activityDate, date);
    }).sort((a, b) => {
      const aTime = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
      const bTime = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      return aTime - bTime;
    });
  }, [filteredActivities]);

  // Get activities for week view
  const getWeekActivities = useCallback(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return days.map(day => ({
      date: day,
      activities: getActivitiesForDate(day),
    }));
  }, [selectedDate, getActivitiesForDate]);

  // Get hours for day view
  const getHoursRange = useCallback(() => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(setHours(setMinutes(new Date(), 0), i));
    }
    return hours;
  }, []);

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

  const updateCalendarMarks = useCallback(() => {
    const markedDates: any = {};

    filteredActivities.forEach(activity => {
      if (activity.scheduled_start) {
        const date = format(parseISO(activity.scheduled_start), 'yyyy-MM-dd');
        if (!markedDates[date]) {
          markedDates[date] = {
            marked: true,
            dots: [],
            activities: [],
          };
        }
        markedDates[date].dots.push({
          color: getStatusColor(activity.status),
        });
        markedDates[date].activities.push(activity);
      }
    });

    const today = format(new Date(), 'yyyy-MM-dd');
    if (!markedDates[today]) {
      markedDates[today] = {};
    }
    markedDates[today].selected = true;
    markedDates[today].selectedColor = '#007AFF';

    setCalendarMarked(markedDates);
  }, [filteredActivities]);

  // Handle initial activity selection from routing/notifications
  useEffect(() => {
    if (initialActivityId && globalActivities.length > 0) {
      const activity = globalActivities.find(a => String(a.id) === String(initialActivityId));
      if (activity && activity.scheduled_start) {
        console.log('📍 Auto-selecting activity from route (global):', initialActivityId);
        setSelectedDate(parseISO(activity.scheduled_start));
        setSelectedActivity(activity);
        setViewMode('day'); // Focus on the day view
        
        // Haptic feedback to confirm the landing
        safeHaptics.success();
      }
    }
  }, [initialActivityId, globalActivities.length]);

  // Handle data fetching on mount
  useEffect(() => {
    handleRefresh();
  }, [spaceId]);

  useEffect(() => {
    updateCalendarMarks();
  }, [updateCalendarMarks]);

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      scheduled: '#4B53BC',
      proposed: '#FFA726',
      active: '#4CAF50',
      completed: '#757575',
      cancelled: '#F44336',
      archived: '#9E9E9E',
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

  const getSpaceInfo = (spaceId: string) => {
    const space = spaces.find(s => s.id === spaceId);
    return {
      name: space?.title || 'Unknown Space',
      type: space?.space_type || 'chat',
      color: getSpaceColor(space?.space_type),
    };
  };

  const getSpaceColor = (spaceType?: string): string => {
    const colors: Record<string, string> = {
      whiteboard: '#4CAF50',
      meeting: '#FF6B6B',
      document: '#FFA726',
      brainstorm: '#9C27B0',
      voice_channel: '#3F51B5',
      chat: '#2196F3',
    };
    return colors[spaceType || 'chat'] || '#666';
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

  const handleAddToCalendar = async (activity: CollaborativeActivity) => {
    const success = await CollaborationService.getInstance().exportToExternalCalendar(activity);
    if (success && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleExportICS = async (activity: CollaborativeActivity) => {
    const spaceInfo = getSpaceInfo(activity.space_id);
    const success = await CollaborationService.getInstance().exportToICS(activity, spaceInfo.name);
    if (success && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (spaceId) {
        await useCollaborationStore.getState().fetchSpaceActivities(spaceId as string);
      } else {
        await useCollaborationStore.getState().fetchGlobalActivities();
      }
    } catch (error) {
      console.error('Error refreshing activities:', error);
    } finally {
      setRefreshing(false);
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

  // Week View Component
  const WeekView = () => {
    const weekDays = getWeekActivities();
    const hours = getHoursRange();

    return (
      <ScrollView
        ref={weekScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.weekContainer}
        contentContainerStyle={styles.weekContent}
      >
        <View style={styles.timeColumn}>
          <View style={styles.timeHeader} />
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
            <TouchableOpacity
              key={dayIndex}
              style={[
                styles.dayColumn,
                isSelected && styles.dayColumnSelected,
              ]}
              activeOpacity={0.9}
              onPress={() => setSelectedDate(day.date)}
            >
              <View style={[styles.dayHeader, isSelected && styles.dayHeaderSelected]}>
                <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                  {format(day.date, 'EEE')}
                </Text>
                <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
                  {format(day.date, 'd')}
                </Text>
                {isToday(day.date) && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>Today</Text>
                  </View>
                )}
              </View>

              <ScrollView style={styles.dayGrid} showsVerticalScrollIndicator={false}>
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
                          <Animated.View
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
                              <Text style={styles.weekActivityTitle} numberOfLines={1}>
                                {activity.title}
                              </Text>
                              <View style={styles.weekActivityMeta}>
                                <Ionicons
                                  name={getActivityIcon(activity.activity_type)}
                                  size={10}
                                  color="#666"
                                />
                                <Text style={styles.weekActivityTime}>
                                  {format(parseISO(activity.scheduled_start!), 'h:mm a')}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          </Animated.View>
                        );
                      })}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
      >
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
                activeOpacity={0.7}
                onPress={() => handleTimeSlotPress(hour)}
                style={styles.dayHourContent}
              >
                {hourActivities.map(activity => {
                  const spaceInfo = getSpaceInfo(activity.space_id);
                  return (
                    <Animated.View
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
                          <View style={[styles.spaceBadge, { backgroundColor: spaceInfo.color + '20' }]}>
                            <View style={[styles.spaceDot, { backgroundColor: spaceInfo.color }]} />
                            <Text style={styles.spaceBadgeText}>{spaceInfo.name}</Text>
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
                          <View style={styles.dayActivityStatus}>
                            <View style={[styles.statusDot, { backgroundColor: getStatusColor(activity.status) }]} />
                            <Text style={styles.dayActivityMetaText}>
                              {activity.status}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.dayActivityActions}>
                          <TouchableOpacity
                            style={styles.dayAction}
                            onPress={() => handleAddToCalendar(activity)}
                          >
                            <Ionicons name="calendar-outline" size={16} color="#007AFF" />
                            <Text style={styles.dayActionText}>Calendar</Text>
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
                              onClose();
                              router.push(`/(spaces)/${activity.space_id}?tab=meeting&activity=${activity.id}`);
                            }}
                          >
                            <LinearGradient
                              colors={['#007AFF', '#0056CC']}
                              style={styles.joinButtonGradient}
                            >
                              <Ionicons name="enter-outline" size={14} color="#fff" />
                              <Text style={styles.joinButtonText}>Join</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // Month View Component
  const MonthView = () => (
    <Calendar
      current={format(selectedDate, 'yyyy-MM-dd')}
      onDayPress={(day: any) => {
        setSelectedDate(parseISO(day.dateString));
        setViewMode('day');
      }}
      markedDates={calendarMarked}
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
        textDayHeaderFontSize: 12,
      }}
      renderArrow={(direction: string) => (
        <Ionicons
          name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
          size={24}
          color="#007AFF"
        />
      )}
      markingType={'multi-dot'}
    />
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
        <Animated.View
          entering={FadeInUp.springify().damping(15)}
          style={styles.modalContainer}
        >
          {selectedActivity && (
            <>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <Text style={styles.modalTitle}>{selectedActivity.title}</Text>
                  <Text style={{color: 'rgba(255,255,255,0.3)', fontSize: 8}}>U:{String(user?.id)} C:{String(selectedActivity.created_by)}</Text>
                  {(String(selectedActivity.created_by || selectedActivity.creator?.id) === String(user?.id)) && (
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => {
                        setActivityToEdit(selectedActivity);
                        setIsEditing(true);
                        setShowCreateModal(true);
                        setSelectedActivity(null);
                      }}
                    >
                      <Ionicons name="pencil" size={20} color="#007AFF" />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={() => setSelectedActivity(null)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent}>
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
                  <Text style={styles.modalSectionTitle}>Space</Text>
                  <View style={styles.modalSpaceRow}>
                    <View style={[styles.modalSpaceDot, { backgroundColor: getSpaceInfo(selectedActivity.space_id).color }]} />
                    <Text style={styles.modalText}>
                      {getSpaceInfo(selectedActivity.space_id).name}
                    </Text>
                  </View>
                </View>

                {/* Participants Section */}
                <View style={styles.modalSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.modalSectionTitle}>Participants</Text>
                    {(selectedActivity.created_by === useCollaborationStore.getState().spaces.find(s => s.id === selectedActivity.space_id)?.creator_id || 
                      selectedActivity.created_by === Number(useCollaborationStore.getState().spaces.find(s => s.id === selectedActivity.space_id)?.creator_id)) && (
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
                      .filter(sp => !selectedActivity.participant_ids?.includes(sp.user_id) && !selectedActivity.participants?.some((p:any) => p.id === sp.user_id))
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
                    onPress={() => handleAddToCalendar(selectedActivity)}
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
                        try { require('@/stores/toastStore').useToastStore.getState().showToast('Session link copied to clipboard!', 'success'); } catch(e){}
                        if (Platform.OS !== 'web') try { require('expo-haptics').notificationAsync(require('expo-haptics').NotificationFeedbackType.Success); } catch(e){}
                    }}
                  >
                    <Ionicons name="link" size={20} color="#666" />
                    <Text style={styles.modalActionText}>Copy Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalAction, styles.modalActionJoin]}
                    onPress={() => {
                      const activityToJoin = selectedActivity;
                      setSelectedActivity(null);
                      onClose();
                      if (activityToJoin) {
                        router.push(`/(spaces)/${activityToJoin.space_id}?tab=meeting&activity=${activityToJoin.id}`);
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
        </Animated.View>
      </BlurView>
    </Modal>
  );

  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <BlurView intensity={90} tint="light" style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {spaceId ? 'Space Sessions' : 'Collaborative Sessions'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {filteredActivities.length} total • {filteredActivities.filter(a => a.status === 'scheduled').length} upcoming
          </Text>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <LinearGradient
            colors={['#007AFF', '#0056CC']}
            style={styles.createButtonGradient}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </BlurView>

      {/* View Toggle */}
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
              size={18}
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
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
      >
        {viewMode === 'day' && <DayView />}
        {viewMode === 'week' && <WeekView />}
        {viewMode === 'month' && <MonthView />}
      </ScrollView>

      {/* Create Activity Modal */}
      <CreateActivityModal
        visible={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setIsEditing(false);
          setActivityToEdit(null);
          setPreselectedTime(undefined);
        }}
        spaceId={spaceId}
        initialTime={preselectedTime}
        isEditing={isEditing}
        activityToEdit={activityToEdit}
        onActivityCreated={() => {
          setShowCreateModal(false);
          setIsEditing(false);
          setActivityToEdit(null);
          setPreselectedTime(undefined);
          handleRefresh();
        }}
      />

      {/* Activity Detail Modal */}
      <ActivityDetailModal />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 8,
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    gap: 6,
  },
  viewToggleButtonActive: {
    backgroundColor: '#E8F0FE',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  viewToggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  viewToggleTextActive: {
    color: '#007AFF',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
  },
  weekContainer: {
    flex: 1,
  },
  weekContent: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 60,
    backgroundColor: '#FFFFFF',
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
    fontSize: 11,
    color: '#666',
    marginTop: -8,
  },
  dayColumn: {
    width: (width - 60) / DAYS_TO_SHOW,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
  },
  dayHeaderSelected: {
    backgroundColor: '#E8F0FE',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    textTransform: 'uppercase',
  },
  dayNameSelected: {
    color: '#007AFF',
    fontWeight: '700',
  },
  dayNumber: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 4,
  },
  dayNumberSelected: {
    color: '#007AFF',
  },
  todayBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#007AFF',
    borderRadius: 10,
  },
  todayBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600',
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
    left: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 4,
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
    padding: 4,
  },
  weekActivityTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  weekActivityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  weekActivityTime: {
    fontSize: 8,
    color: '#666',
  },
  dayContainer: {
    flex: 1,
  },
  currentTimeLine: {
    position: 'absolute',
    left: 60,
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
    width: 60,
    paddingTop: 8,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F0F0F0',
  },
  dayHourText: {
    fontSize: 12,
    color: '#666',
  },
  dayHourContent: {
    flex: 1,
    padding: 8,
  },
  dayActivityCard: {
    backgroundColor: '#FFFFFF',
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
  spaceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  spaceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  spaceBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  dayActivityTitle: {
    fontSize: 16,
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
  dayActivityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalAction: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    gap: 6,
  },
  modalActionJoin: {
    padding: 0,
    backgroundColor: 'transparent',
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

export default CollaborativeActivities;