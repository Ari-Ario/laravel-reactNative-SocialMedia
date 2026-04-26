// components/ChatScreen/CollaborativeActivities.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef, useContext } from 'react';
import { useTranslation } from '@/constants/i18n';
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
import CollaborationService, { CollaborativeActivity } from '@/services/ChatScreen/CollaborationService';
import { createShadow } from '@/utils/styles';
import * as Haptics from 'expo-haptics';
import { Calendar } from 'react-native-calendars';
import { useAppTheme } from '@/hooks/useAppTheme';
import {
  format,
  parseISO,
  isToday,
  isTomorrow,
  addDays,
  addMinutes,
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
  startOfDay,
  endOfDay,
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ActivityDetailModal from './ActivityDetailModal';
import { useToastStore } from '@/stores/toastStore';

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
  const { colors, activeScheme } = useAppTheme();
  const { t, isRTL } = useTranslation();
  const getLocalizedDay = (date: Date, short = true) => {
    const dayKey = 'day_' + format(date, 'eee').toLowerCase();
    const shortKey = dayKey + '_s';
    return t(short ? shortKey : dayKey);
  };

  const styles = getStyles(colors, activeScheme, isRTL);
  const isDark = activeScheme === 'dark';

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
  const { user } = useContext(AuthContext);
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

  const upcomingActivities = useMemo(() => {
    const now = new Date();
    return filteredActivities
      .filter(a => {
        if (!a.scheduled_start) return false;
        const start = parseISO(a.scheduled_start);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        return (start >= oneHourAgo || a.status === 'active') && a.status !== 'cancelled' && a.status !== 'completed';
      })
      .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime());
  }, [filteredActivities]);

  // Get activities for selected date range
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

  const getActivitiesForDate = useCallback((date: Date) => {
    return filteredActivities.filter(activity => isActivityVisibleOnDate(activity, date))
      .sort((a, b) => {
        const aTime = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
        const bTime = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
        return aTime - bTime;
      });
  }, [filteredActivities, isActivityVisibleOnDate]);

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
    for (let i = 0; i <= 24; i++) {
      hours.push(setHours(setMinutes(new Date(), 0), i));
    }
    return hours;
  }, []);

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

  const computeActivityLayout = useCallback((dayActivities: CollaborativeActivity[], viewingDate: Date) => {
    if (dayActivities.length === 0) return {};

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
        const hasOverlap = columns[i].some(other => {
          const otherPos = getActivityPosition(other, viewingDate);
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

  const updateCalendarMarks = useCallback(() => {
    const markedDates: any = {};

    filteredActivities.forEach(activity => {
      if (activity.scheduled_start) {
        // Mark all days covered by this activity (up to a reasonable limit e.g. 60 days)
        const start = parseISO(activity.scheduled_start);
        const today = startOfDay(new Date());
        const limit = addDays(today, 60);

        for (let d = startOfDay(start); d <= limit; d = addDays(d, 1)) {
          if (isActivityVisibleOnDate(activity, d)) {
            const dateStr = format(d, 'yyyy-MM-dd');
            if (!markedDates[dateStr]) {
              markedDates[dateStr] = {
                marked: true,
                dots: [],
                activities: [],
              };
            }
            // Avoid duplicate dots/activities for the same session on the same day
            if (!markedDates[dateStr].activities.some((a: any) => a.id === activity.id)) {
              markedDates[dateStr].dots.push({
                color: getStatusColor(activity.status),
              });
              markedDates[dateStr].activities.push(activity);
            }
          } else if (d > start && !activity.is_recurring) {
            // For non-recurring, we can stop the loop once we pass the end
            break;
          }
        }
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
    const statusColors: Record<string, string> = {
      scheduled: '#4B53BC',
      proposed: '#FFA726',
      active: '#4CAF50',
      completed: '#757575',
      cancelled: '#F44336',
      archived: '#9E9E9E',
    };
    return statusColors[status] || '#666';
  };

  const getStatusLabel = (status: string): string => {
    const statusLabels: Record<string, string> = {
      scheduled: t('scheduled'),
      proposed: t('proposed'),
      active: t('active'),
      completed: t('completed'),
      cancelled: t('cancelled'),
      archived: t('archived'),
    };
    return statusLabels[status] || status;
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

  const getActivityLabel = (type: string): string => {
    const labels: Record<string, string> = {
      brainstorm: t('brainstorm'),
      discussion: t('discussion'),
      workshop: t('workshop'),
      meeting: t('meeting'),
      'problem-solving': t('problem_solving'),
      planning: t('planning'),
      review: t('review'),
      retrospective: t('retrospective'),
      social: t('social'),
    };
    return labels[type] || type;
  };

  const getSpaceInfo = (spaceId: string) => {
    const space = spaces.find(s => s.id === spaceId);
    return {
      name: space?.title || t('unknown_space'),
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
      Alert.alert(t('error'), t('failed_update_participants'));
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

  const handleDeleteActivity = async (activity: CollaborativeActivity) => {
    const performDeletion = async () => {
      try {
        await CollaborationService.getInstance().deleteCollaborativeActivity(activity.id);

        // Update global store immediately for snappy UI
        useCollaborationStore.getState().deleteActivity(activity.id.toString(), activity.space_id);

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
        performDeletion();
      }
    } else {
      Alert.alert(
        t('delete_activity'),
        t('confirm_delete_activity'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('delete'), style: 'destructive', onPress: performDeletion }
        ]
      );
    }
  };

  const handleCopyLink = async (activity: CollaborativeActivity) => {
    const frontendHost = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://zmzir.com';
    const deepLink = `${frontendHost}/spaces/${activity.space_id}?activity=${activity.id}`;
    await require('expo-clipboard').setStringAsync(deepLink);
    useToastStore.getState().showToast(t('session_link_copied'), 'success');
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

    // Shared horizontal scroll offset so the sticky header row stays in sync with the grid
    const headerScrollRef = useRef<ScrollView>(null);

    // Pre-calculate layouts for all days in the week
    const layouts = useMemo(() => {
      const res: Record<string, any> = {};
      weekDays.forEach(day => {
        res[day.date.toISOString()] = computeActivityLayout(day.activities, day.date);
      });
      return res;
    }, [weekDays]);

    // Sync header scroll when the grid scrolls horizontally
    const onGridScroll = useCallback((e: any) => {
      const x = e.nativeEvent.contentOffset.x;
      headerScrollRef.current?.scrollTo({ x, animated: false });
    }, []);

    const TIME_COL_WIDTH = 50;
    const DAYS_TO_VISIBLE = width < 500 ? 3.5 : 7;
    const DAY_COL_WIDTH = (width - TIME_COL_WIDTH) / DAYS_TO_VISIBLE;
    const totalGridHeight = 24 * HOUR_HEIGHT;

    // Current time offset inside the grid (no header to offset since header is now outside)
    const now = new Date();
    const currentTimeTop = now.getHours() * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        {/* ── STICKY HEADER ROW (day names + numbers, never scrolls away) ── */}
        <View style={[styles.weekStickyHeader, { borderBottomColor: colors.border }]}>
          {/* Spacer aligned with the time-label column */}
          <View style={[styles.weekStickyTimespacer, { width: TIME_COL_WIDTH, [isRTL ? 'borderLeftColor' : 'borderRightColor']: colors.border }]} />

          {/* Horizontally scrollable day-name cells, locked to grid offset */}
          <ScrollView
            ref={headerScrollRef}
            horizontal
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            {weekDays.map((day, dayIndex) => {
              const isSelected = isSameDay(day.date, selectedDate);
              const today = isToday(day.date);
              return (
                <TouchableOpacity
                  key={dayIndex}
                  style={[
                    styles.weekStickyDayCell,
                    isSelected && styles.weekStickyDayCellSelected,
                    { width: DAY_COL_WIDTH, [isRTL ? 'borderLeftColor' : 'borderRightColor']: colors.border },
                  ]}
                  onPress={() => setSelectedDate(day.date)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayName, isSelected && styles.dayNameSelected, { color: isSelected ? colors.tint : colors.textSecondary }]}>
                    {getLocalizedDay(day.date)}
                  </Text>
                  <View style={[styles.dayNumberCircle, today && styles.dayNumberCircleToday, isSelected && !today && styles.dayNumberCircleSelected]}>
                    <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected, today && styles.dayNumberToday, { color: today ? '#fff' : (isSelected ? colors.tint : colors.text) }]}>
                      {format(day.date, 'd')}
                    </Text>
                  </View>
                  {today && (
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayBadgeText}>{t('today')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── SCROLLABLE GRID (time labels + 24-hour slots + cards + red line) ── */}
        <ScrollView
          ref={weekScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.weekContainer, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.weekContent}
          onScroll={onGridScroll}
          scrollEventThrottle={16}
        >
          {/* Time-label column */}
          <View style={[styles.timeColumn, { width: TIME_COL_WIDTH, backgroundColor: isDark ? '#121212' : '#F8F9FA', [isRTL ? 'borderLeftColor' : 'borderRightColor']: colors.border }]}>
            {hours.map((hour, index) => (
              <View key={index} style={styles.timeSlot}>
                <Text style={[styles.timeText, { color: colors.textSecondary }]}>{format(hour, 'h a')}</Text>
              </View>
            ))}
          </View>

          {/* Day columns + overlays */}
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', width: DAY_COL_WIDTH * weekDays.length, position: 'relative', height: totalGridHeight }}>

            {/* LAYER 1 – Background grid (tappable hour slots) */}
            {weekDays.map((day, dayIndex) => {
              const isSelected = isSameDay(day.date, selectedDate);
              return (
                <TouchableOpacity
                  key={dayIndex}
                  style={[
                    styles.dayColumn,
                    isSelected && styles.dayColumnSelected,
                    { [isRTL ? 'borderLeftColor' : 'borderRightColor']: colors.border, height: totalGridHeight },
                  ]}
                  activeOpacity={1}
                  onPress={() => setSelectedDate(day.date)}
                >
                  <View style={styles.dayGrid}>
                    {hours.map((_, hourIndex) => (
                      <TouchableOpacity
                        key={hourIndex}
                        style={[styles.hourSlot, { borderBottomColor: colors.border }]}
                        activeOpacity={0.7}
                        onPress={() => {
                          const date = new Date(day.date);
                          date.setHours(hourIndex, 0, 0, 0);
                          handleTimeSlotPress(date);
                        }}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* LAYER 2 – Activity cards overlay */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {weekDays.map((day, dayIndex) => (
                <View
                  key={dayIndex}
                  style={{ width: DAY_COL_WIDTH, position: 'relative' }}
                  pointerEvents="box-none"
                >
                  {day.activities.map(activity => {
                    const position = getActivityPosition(activity, day.date);
                    const dayLayout = layouts[day.date.toISOString()] || {};
                    const actLayout = dayLayout[activity.id] || { left: 0, width: 100 };
                    return (
                      <Animated.View
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
                            paddingRight: 4,
                            borderLeftColor: getStatusColor(activity.status),
                            backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                            zIndex: 300,
                          }
                        ]}
                      >
                        <TouchableOpacity style={styles.weekActivityTouchable} onPress={() => handleActivityPress(activity)}>
                          <Text style={[styles.weekActivityTitle, { color: colors.text }]} numberOfLines={1}>{activity.title}</Text>
                          <View style={styles.weekActivityMeta}>
                            <Ionicons name={getActivityIcon(activity.activity_type)} size={10} color={getStatusColor(activity.status)} />
                            <Text style={[styles.weekActivityTime, { color: colors.textSecondary }]}>{format(parseISO(activity.scheduled_start!), 'h:mm a')}</Text>
                          </View>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* LAYER 3 – Red current-time line (stretched across all days) */}
            <View
              style={[
                styles.weekCurrentTimeLine,
                {
                  top: currentTimeTop,
                  left: 0,
                  right: 0,
                  zIndex: 99999,
                }
              ]}
              pointerEvents="none"
            >
              <View style={styles.currentTimeDot} />
              <View style={styles.currentTimeBar} />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  // Day View Component
  const DayView = () => {
    const activitiesForDay = getActivitiesForDate(selectedDate);
    const hours = getHoursRange();
    const totalHeight = 25 * HOUR_HEIGHT;

    // Pre-calculate layout for the current day
    const layout = useMemo(() => computeActivityLayout(activitiesForDay, selectedDate), [activitiesForDay, selectedDate]);

    return (
      <ScrollView
        ref={dayScrollRef}
        style={[styles.dayContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: totalHeight, position: 'relative' }}>
          {/* Main Grid Row (Labels + Lines) */}
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flex: 1 }}>
            {/* Sidebar (Time Labels) */}
            <View style={{ width: 50, [isRTL ? 'borderLeftWidth' : 'borderRightWidth']: 1, [isRTL ? 'borderLeftColor' : 'borderRightColor']: colors.border, backgroundColor: isDark ? '#121212' : '#F8F9FA' }}>
              {hours.map((hour, index) => (
                <View key={index} style={{ height: HOUR_HEIGHT, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 8 }}>
                  <Text style={[styles.dayHourText, { color: colors.textSecondary }]}>{format(hour, 'h a')}</Text>
                </View>
              ))}
            </View>

            {/* Background Grid Area */}
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              {hours.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={{ height: HOUR_HEIGHT, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  activeOpacity={0.7}
                  onPress={() => {
                    const date = new Date(selectedDate);
                    date.setHours(index, 0, 0, 0);
                    handleTimeSlotPress(date);
                  }}
                />
              ))}
            </View>
          </View>

          {activitiesForDay.map((activity) => {
            const position = getActivityPosition(activity, selectedDate);
            const actLayout = layout[activity.id] || { left: 0, width: 100 };
            const spaceInfo = getSpaceInfo(activity.space_id);

            return (
              <Animated.View
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
                    paddingRight: 4,
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
                      <Ionicons name={getActivityIcon(activity.activity_type)} size={14} color={getStatusColor(activity.status)} />
                      <Text style={[styles.dayActivityType, { color: getStatusColor(activity.status) }]}>{getActivityLabel(activity.activity_type)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: spaceInfo.color + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <View style={[styles.spaceDot, { backgroundColor: spaceInfo.color }]} />
                      <Text style={[styles.spaceBadgeText, { color: colors.textSecondary }]}>{spaceInfo.name}</Text>
                    </View>
                  </View>

                  <Text style={[styles.dayActivityTitle, { color: colors.text }]}>{activity.title}</Text>
                  {activity.description && <Text style={[styles.dayActivityDescription, { color: colors.textSecondary }]} numberOfLines={2}>{activity.description}</Text>}

                  <View style={styles.dayActivityMeta}>
                    <View style={styles.dayActivityDuration}>
                      <Ionicons name="timer-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.dayActivityMetaText, { color: colors.textSecondary }]}>{t('duration_minutes').replace('{count}', (activity.duration_minutes || 60).toString())}</Text>
                    </View>
                    <View style={styles.dayActivityStatus}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(activity.status) }]} />
                      <Text style={[styles.dayActivityMetaText, { color: colors.textSecondary }]}>{getStatusLabel(activity.status)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
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
        {/* </View> */}
      </ScrollView>
    );
  };
  // Month View Component
  const MonthView = () => (
    <ScrollView
      style={styles.monthContainer}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <Calendar
        current={format(selectedDate, 'yyyy-MM-dd')}
        onDayPress={(day: any) => {
          setSelectedDate(parseISO(day.dateString));
          setViewMode('day');
        }}
        markedDates={calendarMarked}
        theme={{
          backgroundColor: colors.background,
          calendarBackground: colors.background,
          textSectionTitleColor: colors.textSecondary,
          selectedDayBackgroundColor: colors.tint,
          selectedDayTextColor: '#fff',
          todayTextColor: colors.tint,
          dayTextColor: colors.text,
          textDisabledColor: isDark ? '#444' : '#ddd',
          dotColor: colors.tint,
          arrowColor: colors.tint,
          monthTextColor: colors.text,
          textMonthFontWeight: '600',
          textDayFontSize: 16,
          textDayHeaderFontSize: 12,
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



  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Header */}
      <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {spaceId ? t('space_sessions') : t('collaborative_sessions')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('total_activities').replace('{count}', filteredActivities.length.toString())} • {t('upcoming_activities').replace('{count}', upcomingActivities.length.toString())}
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
      <View style={[styles.viewToggle, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {[
          { id: 'day', label: t('day'), icon: 'today' },
          { id: 'week', label: t('week'), icon: 'calendar' },
          { id: 'month', label: t('month'), icon: 'calendar-outline' },
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
              color={viewMode === mode.id ? colors.tint : colors.textSecondary}
            />
            <Text style={[
              styles.viewToggleText,
              { color: viewMode === mode.id ? colors.tint : colors.textSecondary },
              viewMode === mode.id && styles.viewToggleTextActive
            ]}>
              {mode.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Navigation Bar */}
      {(viewMode === 'week' || viewMode === 'day') && (
        <View style={[styles.navBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => viewMode === 'week' ? navigateWeek(isRTL ? 'next' : 'prev') : navigateDay(isRTL ? 'next' : 'prev')}
          >
            <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={20} color={colors.tint} />
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
            onPress={() => viewMode === 'week' ? navigateWeek(isRTL ? 'prev' : 'next') : navigateDay(isRTL ? 'prev' : 'next')}
          >
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.tint} />
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.tint} />
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
        onDelete={handleDeleteActivity}
        onJoin={(activity) => {
          setSelectedActivity(null);
          // Close the parent modal first to ensure UI unblocks
          if (onClose) onClose();

          // Small delay to allow modal unmounting before triggering the call
          setTimeout(() => {
            if (onActivitySelect) {
              onActivitySelect(activity);
            } else {
              router.push(`/(spaces)/${activity.space_id}?tab=meeting&activity=${activity.id}`);
            }
          }, 100);
        }}
        onUpdateParticipant={handleUpdateParticipant}
        isManagingParticipants={isManagingParticipants}
        setIsManagingParticipants={setIsManagingParticipants}
        isUpdatingParticipants={isUpdatingParticipants}
        spaceParticipants={spaceParticipants}
        currentUserId={user?.id}
        isRTL={isRTL}
        onAddToCalendar={handleAddToCalendar}
        onExportICS={handleExportICS}
        onCopyLink={handleCopyLink}
      />
    </Animated.View>
  );
};

const getStyles = (colors: any, activeScheme: string, isRTL: boolean) => {
  const isDark = activeScheme === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
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
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },
    viewToggleButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F5F5F5',
      gap: 6,
    },
    viewToggleButtonActive: {
      backgroundColor: isDark ? 'rgba(0,122,255,0.2)' : '#E8F0FE',
      borderWidth: 1,
      borderColor: colors.tint,
    },
    viewToggleText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    viewToggleTextActive: {
      color: colors.tint,
    },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F5F5F5',
    },
    navDate: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    navDateText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    weekStickyHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...createShadow({ width: 0, height: 2, opacity: 0.06, radius: 4, elevation: 3 }),
      zIndex: 10,
    },
    weekStickyTimespacer: {
      width: 50,
      backgroundColor: isDark ? '#121212' : '#F8F9FA',
      [isRTL ? 'borderLeftWidth' : 'borderRightWidth']: 1,
      [isRTL ? 'borderLeftColor' : 'borderRightColor']: colors.border,
    },
    weekStickyDayCell: {
      height: 80,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      [isRTL ? 'borderLeftWidth' : 'borderRightWidth']: 1,
      [isRTL ? 'borderLeftColor' : 'borderRightColor']: colors.border,
    },
    weekStickyDayCellSelected: {
      backgroundColor: isDark ? 'rgba(0,122,255,0.08)' : '#EEF4FF',
    },
    weekContainer: {
      flex: 1,
    },
    weekContent: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
    },
    timeColumn: {
      width: 50,
      [isRTL ? 'borderLeftWidth' : 'borderRightWidth']: 1,
      [isRTL ? 'borderLeftColor' : 'borderRightColor']: colors.border,
    },
    timeSlot: {
      height: HOUR_HEIGHT,
      justifyContent: 'flex-start',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    timeText: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: -8,
    },
    dayColumn: {
      width: width < 500 ? (width - 50) / 3.5 : (width - 50) / 7,
      backgroundColor: colors.background,
      [isRTL ? 'borderLeftWidth' : 'borderRightWidth']: 1,
      [isRTL ? 'borderLeftColor' : 'borderRightColor']: colors.border,
    },
    dayColumnSelected: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8F9FA',
    },
    dayHeader: {
      height: 80,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    dayHeaderSelected: {
      backgroundColor: isDark ? 'rgba(0,122,255,0.1)' : '#E8F0FE',
    },
    dayName: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    dayNameSelected: {
      color: colors.tint,
      fontWeight: '700',
    },
    dayNumber: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
    },
    dayNumberSelected: {
      color: colors.tint,
    },
    dayNumberToday: {
      color: '#fff',
    },
    dayNumberCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 4,
    },
    dayNumberCircleToday: {
      backgroundColor: colors.tint,
    },
    dayNumberCircleSelected: {
      backgroundColor: isDark ? 'rgba(0,122,255,0.15)' : 'rgba(0,122,255,0.12)',
    },
    todayBadge: {
      marginTop: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: colors.tint,
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
      borderBottomColor: colors.border,
      position: 'relative',
    },
    weekActivityCard: {
      position: 'absolute',
      left: 4,
      right: 4,
      backgroundColor: isDark ? colors.card : '#FFFFFF',
      borderRadius: 6,
      padding: 4,
      [isRTL ? 'borderRightWidth' : 'borderLeftWidth']: 3,
      ...createShadow({
        width: 0,
        height: 1,
        opacity: isDark ? 0.3 : 0.1,
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
      color: colors.text,
    },
    weekActivityMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
      gap: 4,
    },
    weekActivityTime: {
      fontSize: 8,
      color: colors.textSecondary,
    },
    dayContainer: {
      flex: 1,
    },
    weekCurrentTimeLine: {
      position: 'absolute',
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      pointerEvents: 'none',
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
      borderBottomColor: colors.border,
    },
    dayHourLabel: {
      width: 60,
      paddingTop: 8,
      alignItems: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    dayHourText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    dayHourContent: {
      flex: 1,
      padding: 8,
    },
    dayActivityCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 8,
      [isRTL ? 'borderRightWidth' : 'borderLeftWidth']: 4,
      ...createShadow({
        width: 0,
        height: 2,
        opacity: isDark ? 0.3 : 0.05,
        radius: 4,
        elevation: 2,
      }),
    },
    dayActivityCardOverlay: {
      backgroundColor: colors.card,
      borderRadius: 12,
      [isRTL ? 'borderRightWidth' : 'borderLeftWidth']: 4,
      ...createShadow({
        width: 0,
        height: 2,
        opacity: isDark ? 0.3 : 0.05,
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
      color: colors.textSecondary,
    },
    dayActivityTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    dayActivityDescription: {
      fontSize: 13,
      color: colors.textSecondary,
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
      color: colors.textSecondary,
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
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F5F5F5',
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
      color: colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)',
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
      color: colors.tint,
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
      color: colors.tint,
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
      backgroundColor: colors.tint,
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
};

export default CollaborativeActivities;