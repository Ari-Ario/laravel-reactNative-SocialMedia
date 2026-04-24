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
import {
  format,
  parseISO,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isTomorrow,
  addHours,
  addMinutes,
  differenceInMinutes,
  getHours,
  getMinutes,
  setHours,
  setMinutes,
  startOfDay,
  endOfDay,
  isAfter,
  isBefore
} from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AnimatedComponent, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import ActivityDetailModal from './ActivityDetailModal';
import * as CalendarService from 'expo-calendar';
import CollaborationService, { CollaborativeActivity } from '@/services/ChatScreen/CollaborationService';
import { createShadow } from '@/utils/styles';
import { useCollaborationStore } from '@/stores/collaborationStore';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import CreateActivityModal from './CreateActivityModal';
import AuthContext from '@/context/AuthContext';
import { useToastStore } from '@/stores/toastStore';
import { useTranslation } from '@/constants/i18n';
import { useAppTheme } from '@/hooks/useAppTheme';

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
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
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

  // Localization helper
  const getLocalizedDay = useCallback((date: Date, short = true) => {
    const dayName = format(date, 'EEEE').toLowerCase();
    return t(`day_${dayName}${short ? '_s' : ''}`);
  }, [t]);

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
  const upcomingActivities = useMemo(() => {
    const now = new Date();
    const oneHourAgo = addHours(now, -1);
    
    return spaceActivities
      .filter(a => {
        if (!a.scheduled_start) return false;
        const start = parseISO(a.scheduled_start);
        // Show upcoming sessions, currently active ones, or sessions that started within the last hour
        return (start >= oneHourAgo || a.status === 'active') && a.status !== 'cancelled' && a.status !== 'completed';
      })
      .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime());
  }, [spaceActivities]);

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

  // Helper to check if activity should be visible on a specific date (handles recurrence)
  const isActivityVisibleOnDate = useCallback((activity: CollaborativeActivity, date: Date) => {
    if (!activity.scheduled_start) return false;
    const start = parseISO(activity.scheduled_start);
    const duration = activity.duration_minutes || 60;
    const end = addMinutes(start, duration);

    // Normalize dates to midnight for accurate comparison
    const dStart = startOfDay(start);
    const dEnd = startOfDay(end);
    const dCurrent = startOfDay(date);

    // Multi-day non-recurring activity
    if (!activity.is_recurring) {
      if (dCurrent < dStart || dCurrent > dEnd) return false;

      // Only show on the end day if it actually has duration on that day
      if (dCurrent.getTime() === dEnd.getTime()) {
        const minutesOnLastDay = differenceInMinutes(end, dEnd);
        return minutesOnLastDay > 0;
      }
      return true;
    }

    // Recurring activity check
    if (dCurrent < dStart) return false;
    if (activity.recurrence_end && dCurrent > startOfDay(parseISO(activity.recurrence_end))) return false;

    const pattern = activity.recurrence_pattern;
    const diffDays = Math.round((dCurrent.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24));

    // For recurring activities, we check if any previous occurrence covers this date
    // (most recurrences only last a few hours, so we only check the instance starting today 
    // unless duration > 24h)
    const daysToLookBack = Math.ceil(duration / 1440);

    for (let i = 0; i <= daysToLookBack; i++) {
      const checkDayDiff = diffDays - i;
      if (checkDayDiff < 0) continue;

      let isMatch = false;
      if (pattern === 'daily') isMatch = true;
      else if (pattern === 'weekly') isMatch = checkDayDiff % 7 === 0;
      else if (pattern === 'biweekly') isMatch = checkDayDiff % 14 === 0;
      else if (pattern === 'monthly') isMatch = start.getDate() === date.getDate();

      if (isMatch) {
        const instanceStart = addDays(start, checkDayDiff);
        const instanceEnd = addMinutes(instanceStart, duration);
        const dInstEnd = startOfDay(instanceEnd);

        if (dCurrent >= startOfDay(instanceStart) && dCurrent <= dInstEnd) {
          if (dCurrent.getTime() === dInstEnd.getTime()) {
            return differenceInMinutes(instanceEnd, dInstEnd) > 0;
          }
          return true;
        }
      }
    }

    return false;
  }, []);

  // Get activities for a specific date (handles recurrence)
  const getActivitiesForDate = useCallback((date: Date) => {
    return spaceActivities.filter(activity => isActivityVisibleOnDate(activity, date))
      .sort((a, b) => {
        const aTime = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
        const bTime = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
        return aTime - bTime;
      });
  }, [spaceActivities, isActivityVisibleOnDate]);

  const handleTimeSlotPress = (date: Date) => {
    setPreselectedTime(date);
    setShowCreateModal(true);
    safeHaptics.impact();
  };

  // Get position for activity in timeline
  const getActivityPosition = useCallback((activity: CollaborativeActivity, viewingDate: Date) => {
    if (!activity.scheduled_start) return { top: 0, height: 0 };
    const start = parseISO(activity.scheduled_start);
    const duration = activity.duration_minutes || 60;

    // For recurring sessions, find the actual instance that overlaps this day
    let instanceStart = start;
    if (activity.is_recurring) {
      const dCurrent = startOfDay(viewingDate);
      const dStart = startOfDay(start);
      const diffDays = Math.round((dCurrent.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24));

      const daysToLookBack = Math.ceil(duration / 1440);
      for (let i = 0; i <= daysToLookBack; i++) {
        const checkDayDiff = diffDays - i;
        if (checkDayDiff < 0) continue;

        let isMatch = false;
        if (activity.recurrence_pattern === 'daily') isMatch = true;
        else if (activity.recurrence_pattern === 'weekly') isMatch = checkDayDiff % 7 === 0;
        else if (activity.recurrence_pattern === 'biweekly') isMatch = checkDayDiff % 14 === 0;
        else if (activity.recurrence_pattern === 'monthly') isMatch = start.getDate() === viewingDate.getDate();

        if (isMatch) {
          const possibleStart = addDays(start, checkDayDiff);
          const possibleEnd = addMinutes(possibleStart, duration);
          if (viewingDate >= startOfDay(possibleStart) && viewingDate <= startOfDay(possibleEnd)) {
            instanceStart = possibleStart;
            break;
          }
        }
      }
    }

    const end = addMinutes(instanceStart, duration);

    // Calculate start position on the current viewing day
    let startTop = 0;
    if (isSameDay(viewingDate, instanceStart)) {
      startTop = getHours(instanceStart) * HOUR_HEIGHT + (getMinutes(instanceStart) / 60) * HOUR_HEIGHT;
    }

    // Calculate duration visible on this specific day
    const dayStart = startOfDay(viewingDate);
    const dayEnd = endOfDay(viewingDate);

    // The portion of the activity that falls within this day
    const actualStart = isAfter(instanceStart, dayStart) ? instanceStart : dayStart;
    const actualEnd = isBefore(end, dayEnd) ? end : dayEnd;

    const minutesOnThisDay = Math.max(0, differenceInMinutes(actualEnd, actualStart));
    const cardHeight = (minutesOnThisDay / 60) * HOUR_HEIGHT;

    return { top: startTop, height: Math.max(cardHeight, 20) };
  }, []);

  // Get hours for timeline
  const getHoursRange = useCallback(() => {
    const hours = [];
    for (let i = 0; i <= 24; i++) {
      hours.push(setHours(setMinutes(new Date(), 0), i));
    }
    return hours;
  }, []);

  // Get week activities
  const getWeekActivities = useCallback(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end }).map(day => ({
      date: day,
      activities: getActivitiesForDate(day),
    }));
  }, [selectedDate, getActivitiesForDate]);

  // Generate marked dates for calendar (simplified for performance, only marking start and next month's recurrences)
  const markedDates = useMemo(() => {
    const marks: { [key: string]: any } = {};
    const today = new Date();
    const nextMonth = addDays(today, 60); // Check ahead 2 months
    const interval = eachDayOfInterval({ start: today, end: nextMonth });

    spaceActivities.forEach(activity => {
      if (!activity.scheduled_start) return;

      interval.forEach(day => {
        if (isActivityVisibleOnDate(activity, day)) {
          const dateStr = format(day, 'yyyy-MM-dd');
          if (!marks[dateStr]) marks[dateStr] = { marked: true, dots: [] };
          marks[dateStr].dots.push({ color: getStatusColor(activity.status) });
        }
      });
    });
    return marks;
  }, [spaceActivities, isActivityVisibleOnDate]);

  // Compute horizontal layout for overlapping activities
  const computeActivityLayout = useCallback((dayActivities: CollaborativeActivity[], viewingDate: Date) => {
    if (dayActivities.length === 0) return {};

    // Sort by start time then duration (longer first)
    const sorted = [...dayActivities].sort((a, b) => {
      const posA = getActivityPosition(a, viewingDate);
      const posB = getActivityPosition(b, viewingDate);
      if (Math.abs(posA.top - posB.top) > 1) return posA.top - posB.top;
      return posB.height - posA.height;
    });

    const columns: CollaborativeActivity[][] = [];
    const layout: Record<string, { left: number; width: number }> = {};

    sorted.forEach(activity => {
      const pos = getActivityPosition(activity, viewingDate);
      let placed = false;

      for (let i = 0; i < columns.length; i++) {
        // Check if overlaps with any activity in this column
        const hasOverlap = columns[i].some(other => {
          const otherPos = getActivityPosition(other, viewingDate);
          // Standard overlap check: (StartA < EndB) && (EndA > StartB)
          return (pos.top < otherPos.top + otherPos.height - 1) &&
            (pos.top + pos.height > otherPos.top + 1);
        });

        if (!hasOverlap) {
          columns[i].push(activity);
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([activity]);
      }
    });

    // Assign widths and left offsets based on column distribution
    const colCount = columns.length;
    columns.forEach((col, colIndex) => {
      col.forEach(activity => {
        layout[activity.id] = {
          left: (colIndex / colCount) * 100,
          width: (100 / colCount)
        };
      });
    });

    return layout;
  }, [getActivityPosition]);

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
    const performDeletion = async () => {
      try {
        await CollaborationService.getInstance().deleteCollaborativeActivity(activityId);

        // Update global store immediately for snappy UI
        useCollaborationStore.getState().deleteActivity(activityId.toString(), spaceId);

        setSelectedActivity(null);
        useToastStore.getState().showToast(t('activity_deleted_success'), 'success');
        if (Platform.OS !== 'web') safeHaptics.success();
      } catch (error) {
        console.error('Error deleting activity:', error);
        Alert.alert(t('error'), t('failed_delete_activity'));
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('confirm_delete_activity'))) {
        await performDeletion();
      }
    } else {
      Alert.alert(
        t('delete_activity'),
        t('confirm_delete_activity'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: performDeletion
          }
        ]
      );
    }
  };

  const handleCopyLink = async (activity: CollaborativeActivity) => {
    const frontendHost = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://zmzir.com';
    const deepLink = `${frontendHost}/spaces/${activity.space_id}?activity=${activity.id}`;
    await require('expo-clipboard').setStringAsync(deepLink);
    useToastStore.getState().showToast(t('session_link_copied'), 'success');
    if (Platform.OS !== 'web') safeHaptics.success();
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
      Alert.alert(t('error'), t('failed_update_participants'));
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
    const weekDays = getWeekActivities();
    const hours = getHoursRange();

    // Pre-calculate layouts for all days in the week
    const layouts = useMemo(() => {
      const res: Record<string, any> = {};
      weekDays.forEach(day => {
        res[day.date.toISOString()] = computeActivityLayout(day.activities, day.date);
      });
      return res;
    }, [weekDays]);

    return (
      <View style={{ flex: 1, width: '100%' }}>
        <ScrollView
          ref={weekScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.weekContainer}
          contentContainerStyle={styles.weekContent}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#121212' : '#fff', zIndex: 10 }}>
              <View style={[styles.timeColumn, { height: 90, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={styles.timeHeader} />
              </View>
              {weekDays.map((day, dayIndex) => {
                const isSelected = isSameDay(day.date, selectedDate);
                const dayActivitiesCount = day.activities.length;
                
                return (
                  <TouchableOpacity
                    key={dayIndex}
                    style={[
                      styles.dayColumn,
                      { height: 90, borderBottomWidth: 1, borderBottomColor: colors.border },
                      isSelected && styles.dayColumnSelected,
                    ]}
                    onPress={() => setSelectedDate(day.date)}
                  >
                    <View style={[styles.dayHeader, isSelected && styles.dayHeaderSelected, { height: '100%', borderBottomWidth: 0 }]}>
                      <Text style={[styles.dayName, isSelected && styles.dayNameSelected, { color: isSelected ? colors.tint : colors.textSecondary, textTransform: 'uppercase' }]}>
                        {getLocalizedDay(day.date)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected, { color: colors.text }]}>
                          {format(day.date, 'd')}
                        </Text>
                        {dayActivitiesCount > 0 && (
                          <View style={[styles.activityCountBadge, { marginLeft: 4, minWidth: 16, height: 16, borderRadius: 8 }]}>
                            <Text style={[styles.activityCountBadgeText, { fontSize: 9 }]}>
                              {dayActivitiesCount}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 180 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ flexDirection: 'row', flex: 1, position: 'relative' }}>
                <View style={[styles.timeColumn, { borderTopWidth: 0, borderRightColor: colors.border }]}>
                  {hours.map((hour, index) => (
                    <View key={index} style={styles.timeSlot}>
                      <Text style={[styles.timeText, { color: colors.textSecondary }]}>
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
                        { borderTopWidth: 0, borderRightColor: colors.border }
                      ]}
                    >
                      <View
                        style={[styles.dayGrid, { position: 'relative' }]}
                      >
                        {hours.map((hour, hourIndex) => (
                          <TouchableOpacity
                            key={hourIndex}
                            style={[styles.hourSlot, { borderBottomColor: colors.border }]}
                            activeOpacity={0.7}
                            onPress={(e) => {
                              const date = new Date(day.date);
                              const y = e.nativeEvent.locationY;
                              const minutes = Math.floor((y / HOUR_HEIGHT) * 60);
                              const roundedMinutes = Math.floor(minutes / 15) * 15;
                              date.setHours(hourIndex, roundedMinutes, 0, 0);
                              handleTimeSlotPress(date);
                            }}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}

                {/* Activity Cards Layer (Overlays the whole week grid) */}
                <View style={{ position: 'absolute', top: 0, left: 50, right: 0, bottom: 0, pointerEvents: 'box-none', flexDirection: 'row' }}>
                  {weekDays.map((day, dayIndex) => {
                    const isSelected = isSameDay(day.date, selectedDate);
                    return (
                      <View key={dayIndex} style={[styles.dayColumn, isSelected && styles.dayColumnSelected, { borderTopWidth: 0, backgroundColor: 'transparent', borderRightWidth: 0 }]}>
                        {day.activities.map(activity => {
                          const position = getActivityPosition(activity, day.date);
                          const dayLayout = layouts[day.date.toISOString()] || {};
                          const actLayout = dayLayout[activity.id] || { left: 0, width: 100 };
                          const startTime = parseISO(activity.scheduled_start!);

                            return (
                              <AnimatedComponent.View
                                key={activity.id}
                                entering={FadeInDown.delay(dayIndex * 50)}
                                style={[
                                  styles.weekActivityCard,
                                  {
                                    position: 'absolute',
                                    top: position.top,
                                    height: position.height,
                                    left: `${actLayout.left}%`,
                                    width: `${actLayout.width}%`,
                                    paddingRight: 4, // Add gap between columns
                                    borderLeftColor: getStatusColor(activity.status),
                                    zIndex: 20,
                                    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
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
                                    <Text style={[styles.weekActivityTitle, { color: colors.text }]} numberOfLines={1}>
                                      {activity.title}
                                    </Text>
                                  </View>
                                  <Text style={[styles.weekActivityTime, { color: colors.textSecondary }]}>
                                    {format(startTime, 'h:mm a')}
                                  </Text>
                                </TouchableOpacity>
                              </AnimatedComponent.View>
                            );
                          })}
                      </View>
                    );
                  })}
                </View>

                {/* LAYER: Global Red Time Line (Highest Layer - Over Everything) */}
                <View style={{ position: 'absolute', top: 0, left: 50, right: 0, bottom: 0, zIndex: 99999, pointerEvents: 'none' }}>
                  {weekDays.map((day, dayIndex) => {
                    if (!isToday(day.date)) return null;
                    return (
                      <View
                        key={dayIndex}
                        style={[
                          styles.currentTimeLine,
                          {
                            top: (new Date().getHours() * HOUR_HEIGHT) + (new Date().getMinutes() / 60 * HOUR_HEIGHT),
                            left: 0,
                            width: '100%',
                            zIndex: 100000,
                          }
                        ]}
                      >
                        <View style={styles.currentTimeDot} />
                        <View style={styles.currentTimeBar} />
                      </View>
                    );
                  })}
                </View>
              </View>
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
    const totalHeight = 25 * HOUR_HEIGHT;

    // Pre-calculate layout for the current day
    const layout = useMemo(() => computeActivityLayout(activities, selectedDate), [activities, selectedDate]);

    return (
      <ScrollView
        ref={dayScrollRef}
        style={[styles.dayContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4B53BC" />
        }
      >
        <View style={{ height: totalHeight, position: 'relative' }}>
          {/* Main Grid Row (Labels + Lines) */}
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {/* Sidebar (Time Labels) */}
            <View style={{ width: 50, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: isDark ? '#121212' : '#F8F9FA' }}>
              {hours.map((hour, index) => (
                <View key={index} style={{ height: HOUR_HEIGHT, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 8 }}>
                  <Text style={[styles.dayHourText, { color: colors.textSecondary }]}>{format(hour, 'h a')}</Text>
                </View>
              ))}
            </View>

            {/* Background Grid Area - Each hour slot is clickable */}
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              {hours.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={{ height: HOUR_HEIGHT, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  activeOpacity={0.7}
                  onPress={(e) => {
                    const date = new Date(selectedDate);
                    const y = e.nativeEvent.locationY;
                    const minutes = Math.floor((y / HOUR_HEIGHT) * 60);
                    const roundedMinutes = Math.floor(minutes / 15) * 15;
                    date.setHours(index, roundedMinutes, 0, 0);
                    handleTimeSlotPress(date);
                  }}
                />
              ))}
            </View>
          </View>

          {/* Activity Cards Overlay Layer - Now on top of everything including time labels */}
          <View style={{ position: 'absolute', top: 0, left: 50, right: 0, height: totalHeight, zIndex: 200, pointerEvents: 'box-none' }}>
            {activities.map((activity) => {
              const position = getActivityPosition(activity, selectedDate);
              const actLayout = layout[activity.id] || { left: 0, width: 100 };
              const startTime = parseISO(activity.scheduled_start!);

                return (
                  <AnimatedComponent.View
                    key={activity.id}
                    entering={FadeInDown.delay(0)}
                    style={[
                      styles.dayActivityCardOverlay,
                      {
                        position: 'absolute',
                        top: position.top,
                        height: position.height,
                        left: `${actLayout.left}%`,
                        width: `${actLayout.width}%`,
                        paddingRight: 4, // Add gap between columns
                        borderLeftColor: getStatusColor(activity.status),
                        backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                        zIndex: 300,
                      }
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
                            {t(activity.activity_type)}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(activity.status) + '20' }]}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(activity.status) }]} />
                          <Text style={[styles.statusText, { color: getStatusColor(activity.status) }]}>
                            {t(activity.status)}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.dayActivityTitle, { color: colors.text }]}>{activity.title}</Text>

                      {activity.description && (
                        <Text style={[styles.dayActivityDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                          {activity.description}
                        </Text>
                      )}

                      <View style={styles.dayActivityMeta}>
                        <View style={styles.dayActivityDuration}>
                          <Ionicons name="timer-outline" size={14} color="#666" />
                          <Text style={[styles.dayActivityMetaText, { color: colors.textSecondary }]}>
                            {activity.duration_minutes || 60} {t('min')}
                          </Text>
                        </View>
                        <View style={styles.dayActivityParticipants}>
                          <Ionicons name="people-outline" size={14} color="#666" />
                          <Text style={[styles.dayActivityMetaText, { color: colors.textSecondary }]}>
                            {t('participants_count').replace('{count}', String(activity.confirmed_participants || 0))}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.dayActivityActions}>
                        <TouchableOpacity
                          style={styles.dayAction}
                          onPress={() => handleAddToDeviceCalendar(activity)}
                        >
                          <Ionicons name="calendar-outline" size={16} color="#4B53BC" />
                          <Text style={[styles.dayActionText, { color: '#4B53BC' }]}>{t('add')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.dayAction}
                          onPress={() => handleExportICS(activity)}
                        >
                          <Ionicons name="download-outline" size={16} color="#666" />
                          <Text style={[styles.dayActionText, { color: colors.textSecondary }]}>{t('export')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.dayAction, styles.dayActionJoin]}
                          onPress={() => onJoinSession?.(activity)}
                        >
                          <LinearGradient
                            colors={['#4B53BC', '#3A4299']}
                            style={styles.joinButtonGradient}
                          >
                            <Ionicons name="enter-outline" size={14} color="#fff" />
                            <Text style={styles.joinButtonText}>{t('join')}</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </AnimatedComponent.View>
                );
              })}
          </View>

          {/* LAYER: Global Red Time Line (Highest Layer - Over Everything) */}
          {isToday(selectedDate) && (
            <View
              style={[
                styles.currentTimeLine,
                {
                  top: (new Date().getHours() * HOUR_HEIGHT) + (new Date().getMinutes() / 60 * HOUR_HEIGHT),
                  left: 50,
                  right: 0,
                  zIndex: 99999,
                  pointerEvents: 'none'
                }
              ]}
            >
              <View style={styles.currentTimeDot} />
              <View style={styles.currentTimeBar} />
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const MonthView = () => (
    <ScrollView
      style={styles.monthContainer}
      contentContainerStyle={{ paddingBottom: 180 }}
      showsVerticalScrollIndicator={false}
    >
      <Calendar
        current={format(selectedDate, 'yyyy-MM-dd')}
        onDayPress={handleDayPress}
        markedDates={{
          ...markedDates,
          [format(selectedDate, 'yyyy-MM-dd')]: {
            ...markedDates[format(selectedDate, 'yyyy-MM-dd')],
            selected: true,
            selectedColor: colors.tint
          }
        }}
        theme={{
          backgroundColor: colors.background,
          calendarBackground: colors.background,
          textSectionTitleColor: colors.textSecondary,
          selectedDayBackgroundColor: colors.tint,
          selectedDayTextColor: '#fff',
          todayTextColor: colors.tint,
          dayTextColor: colors.text,
          textDisabledColor: isDark ? '#333' : '#ddd',
          dotColor: colors.tint,
          arrowColor: colors.tint,
          monthTextColor: colors.text,
          textMonthFontWeight: '600',
          textDayFontSize: 16,
          textDayHeaderFontSize: 13,
        }}
        renderArrow={(direction: string) => (
          <Ionicons
            name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
            size={24}
            color={colors.tint}
          />
        )}
        markingType={'multi-dot'}
      />

      <View style={styles.upcomingSection}>
        <View style={styles.upcomingHeader}>
          <Text style={[styles.upcomingTitle, { color: colors.text }]}>{t('upcoming_sessions')}</Text>
          <View style={[styles.upcomingBadge, { backgroundColor: colors.tint + '20' }]}>
            <Text style={[styles.upcomingBadgeText, { color: colors.tint }]}>{upcomingActivities.length}</Text>
          </View>
        </View>

        {upcomingActivities.length > 0 ? (
          upcomingActivities.map((activity, index) => {
            const startTime = parseISO(activity.scheduled_start!);
            return (
              <TouchableOpacity
                key={activity.id}
                style={[styles.upcomingCard, { backgroundColor: isDark ? '#1E1E1E' : '#fff', borderLeftColor: getStatusColor(activity.status) }]}
                onPress={() => handleActivityPress(activity)}
              >
                <View style={styles.upcomingCardContent}>
                  <View style={styles.upcomingCardTop}>
                    <View style={styles.upcomingCardIconContainer}>
                      <Ionicons name={getActivityIcon(activity.activity_type)} size={18} color={getStatusColor(activity.status)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.upcomingCardTitle, { color: colors.text }]} numberOfLines={1}>
                        {activity.title}
                      </Text>
                      <Text style={[styles.upcomingCardTime, { color: colors.textSecondary }]}>
                        {isToday(startTime) ? t('today') : format(startTime, 'MMM d')} • {format(startTime, 'h:mm a')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.upcomingEmpty}>
            <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} style={{ opacity: 0.5, marginBottom: 8 }} />
            <Text style={[styles.upcomingEmptyText, { color: colors.textSecondary }]}>{t('no_upcoming_sessions')}</Text>
          </View>
        )}
      </View>
    </ScrollView>
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
            <Text style={styles.createButtonText}>{t('schedule')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

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
            {(viewMode === 'day' || viewMode === 'week') && (
              <View style={styles.activityCountBadge}>
                <Text style={styles.activityCountBadgeText}>
                  {viewMode === 'day' 
                    ? getActivitiesForDate(selectedDate).length
                    : Array.from(new Set(getWeekActivities().flatMap(d => d.activities.map(a => a.id)))).length
                  }
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

      <View style={styles.content}>
        {viewMode === 'day' && <DayView />}
        {viewMode === 'week' && <WeekView />}
        {viewMode === 'month' && <MonthView />}
      </View>

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
      <ActivityDetailModal
        isVisible={!!selectedActivity}
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onEdit={(activity) => {
          setActivityToEdit(activity);
          setIsEditing(true);
          setShowCreateModal(true);
          setSelectedActivity(null);
        }}
        onDelete={(activity) => handleDeleteActivity(activity.id)}
        onJoin={(activity) => {
          // Close BOTH modals immediately for best UX
          setSelectedActivity(null);
          // If in a modal view, this should trigger the parent close as well
          if (onJoinSession) {
            onJoinSession(activity);
          } else {
            router.push(`/(spaces)/${activity.space_id}?tab=meeting&activity=${activity.id}`);
          }
        }}
        onUpdateParticipant={handleUpdateParticipant}
        isManagingParticipants={isManagingParticipants}
        setIsManagingParticipants={setIsManagingParticipants}
        isUpdatingParticipants={isUpdatingParticipants}
        spaceParticipants={spaceParticipants}
        currentUserId={user?.id}
        onAddToCalendar={handleAddToDeviceCalendar}
        onExportICS={handleExportICS}
        onCopyLink={handleCopyLink}
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
    height: 25 * HOUR_HEIGHT,
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
    overflow: 'visible', // CRITICAL: Allow session cards to stretch
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
    padding: 0, // Reset padding for absolute positioning
    overflow: 'visible',
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
  dayActivityCardOverlay: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 3,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.1,
      radius: 4,
      elevation: 2,
    }),
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
  // Upcoming Sessions Styles
  upcomingSection: {
    padding: 20,
    marginTop: 10,
  },
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  upcomingTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  upcomingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  upcomingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  upcomingCard: {
    borderRadius: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.1,
      radius: 4,
      elevation: 2,
    }),
  },
  upcomingCardContent: {
    padding: 16,
  },
  upcomingCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upcomingCardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upcomingCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  upcomingCardTime: {
    fontSize: 12,
  },
  upcomingEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  upcomingEmptyText: {
    fontSize: 14,
  },
});

export default CalendarView;