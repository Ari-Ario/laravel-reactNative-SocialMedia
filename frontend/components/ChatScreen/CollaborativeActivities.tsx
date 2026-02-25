import React, { useState, useEffect } from 'react';
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
  SectionList,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CollaborationService, { CollaborativeActivity } from '@/services/ChatScreen/CollaborationService';
import { createShadow } from '@/utils/styles';
import * as Haptics from 'expo-haptics';
import { Calendar, CalendarList, Agenda, LocaleConfig } from 'react-native-calendars';
import { format, parseISO, isToday, isTomorrow, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import CreateActivityModal from './CreateActivityModal';

const { width, height } = Dimensions.get('window');

LocaleConfig.locales['en'] = {
  monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  today: 'Today'
};
LocaleConfig.defaultLocale = 'en';

interface CollaborativeActivitiesProps {
  spaces: any[];
  activities: CollaborativeActivity[];
  activitiesCount: number;
  onClose: () => void;
  onActivitySelect: (activity: CollaborativeActivity) => void;
}

const CollaborativeActivities: React.FC<CollaborativeActivitiesProps> = ({
  spaces,
  activities,
  activitiesCount,
  onClose,
  onActivitySelect,
  scheduled_start,
  scheduled_end,
}) => {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'active' | 'completed'>('upcoming');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [calendarMarked, setCalendarMarked] = useState<any>({});
  const [newActivity, setNewActivity] = useState({
    title: '',
    description: '',
    activity_type: 'brainstorm',
    duration_minutes: 60,
    scheduled_start: new Date().toISOString(),
  });
  const [showActivities, setShowActivities] = useState(false);

  const collaborationService = CollaborationService.getInstance();

  useEffect(() => {
    if (activities.length > 0) {
      updateCalendarMarks();
    }
  }, [activities]);

  const updateCalendarMarks = () => {
    const markedDates: any = {};

    activities.forEach(activity => {
      if (activity.scheduled_start) {
        const date = format(parseISO(activity.scheduled_start), 'yyyy-MM-dd');

        if (!markedDates[date]) {
          markedDates[date] = {
            marked: true,
            dots: [],
            activities: [],
            customStyles: {
              container: {
                backgroundColor: 'transparent',
              },
              text: {
                color: isToday(parseISO(date)) ? '#007AFF' : '#333',
                fontWeight: isToday(parseISO(date)) ? 'bold' : 'normal',
              }
            }
          };
        }

        markedDates[date].activities.push(activity);
        markedDates[date].dots.push({
          color: getStatusColor(activity.status),
          selectedColor: getStatusColor(activity.status),
        });
      }
    });

    // Mark today
    const today = format(new Date(), 'yyyy-MM-dd');
    if (!markedDates[today]) {
      markedDates[today] = {
        customStyles: {
          container: {
            backgroundColor: 'transparent',
          },
          text: {
            color: '#007AFF',
            fontWeight: 'bold',
          }
        }
      };
    }

    setCalendarMarked(markedDates);
  };

  const getActivitiesForDate = (date: string) => {
    return activities.filter(activity =>
      activity.scheduled_start &&
      format(parseISO(activity.scheduled_start), 'yyyy-MM-dd') === date
    ).sort((a, b) =>
      new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
    );
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      scheduled: '#007AFF',
      proposed: '#FFA726',
      active: '#4CAF50',
      completed: '#2196F3',
      cancelled: '#F44336',
      archived: '#9E9E9E',
    };
    return colors[status] || '#666';
  };

  const getActivityIcon = (type: string): string => {
    const icons: Record<string, string> = {
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

  const handleActivityPress = (activity: CollaborativeActivity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onActivitySelect(activity);
  };

  const startActivity = async (activity: CollaborativeActivity) => {
    try {
      await collaborationService.updateActivityStatus(activity.id, {
        status: 'active',
        notes: 'Activity started',
      });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error starting activity:', error);
      Alert.alert('Error', 'Failed to start activity');
    }
  };

  const renderActivityCard = (activity: CollaborativeActivity, index: number) => {
    const spaceInfo = getSpaceInfo(activity.space_id);
    const activityDate = activity.scheduled_start ? parseISO(activity.scheduled_start) : null;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50)}
        style={styles.activityCard}
      >
        <TouchableOpacity
          onPress={() => handleActivityPress(activity)}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              activity.title,
              activity.description || 'No description provided',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Go to Space', onPress: () => {
                    router.push(`/(spaces)/${activity.space_id}?activity=${activity.id}`);
                    onClose();
                  }
                },
                { text: 'Start Now', onPress: () => startActivity(activity) },
                { text: 'Add to Calendar', onPress: () => { } },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.activityCardInner}>
            {/* Left timeline indicator */}
            <View style={styles.timelineIndicator}>
              <View style={[styles.timelineDot, { backgroundColor: getStatusColor(activity.status) }]} />
              {index < activities.length - 1 && <View style={styles.timelineLine} />}
            </View>

            <View style={styles.activityContent}>
              <View style={styles.activityHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(activity.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(activity.status) }]}>
                    {activity.status.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.spaceTag}>
                  <View style={[styles.spaceDot, { backgroundColor: spaceInfo.color }]} />
                  <Text style={styles.spaceName} numberOfLines={1}>
                    {spaceInfo.name}
                  </Text>
                </View>
              </View>

              <Text style={styles.activityTitle} numberOfLines={1}>
                {activity.title}
              </Text>

              {activity.description && (
                <Text style={styles.activityDescription} numberOfLines={2}>
                  {activity.description}
                </Text>
              )}

              <View style={styles.activityMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="time" size={14} color="#666" />
                  <Text style={styles.metaText}>
                    {activityDate ? format(activityDate, 'h:mm a') : 'No time set'}
                  </Text>
                </View>

                <View style={styles.metaItem}>
                  <Ionicons name="timer" size={14} color="#666" />
                  <Text style={styles.metaText}>
                    {activity.duration_minutes || 60}m
                  </Text>
                </View>

                <View style={styles.metaItem}>
                  <Ionicons name={getActivityIcon(activity.activity_type)} size={14} color="#666" />
                  <Text style={styles.metaText}>
                    {activity.activity_type}
                  </Text>
                </View>
              </View>

              {/* Quick actions */}
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => router.push(`/(spaces)/${activity.space_id}?activity=${activity.id}`)}
                >
                  <Ionicons name="enter" size={16} color="#007AFF" />
                  <Text style={styles.quickActionText}>Join</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => startActivity(activity)}
                >
                  <Ionicons name="play" size={16} color="#4CAF50" />
                  <Text style={styles.quickActionText}>Start</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => {/* Add to calendar */ }}
                >
                  <Ionicons name="calendar" size={16} color="#FFA726" />
                  <Text style={styles.quickActionText}>Calendar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderCalendarDay = (day: any) => {
    const dateActivities = getActivitiesForDate(day.dateString);

    return (
      <TouchableOpacity
        style={[
          styles.calendarDay,
          day.dateString === selectedDate && styles.calendarDaySelected,
        ]}
        onPress={() => setSelectedDate(day.dateString)}
      >
        <Text style={[
          styles.calendarDayText,
          day.dateString === selectedDate && styles.calendarDayTextSelected,
          isToday(parseISO(day.dateString)) && styles.calendarDayTextToday,
        ]}>
          {day.day}
        </Text>

        {dateActivities.length > 0 && (
          <View style={styles.calendarDayDots}>
            {dateActivities.slice(0, 3).map((activity, index) => (
              <View
                key={index}
                style={[
                  styles.calendarDayDot,
                  { backgroundColor: getStatusColor(activity.status) }
                ]}
              />
            ))}
            {dateActivities.length > 3 && (
              <Text style={styles.calendarDayMore}>+{dateActivities.length - 3}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderCalendarView = () => (
    <View style={styles.calendarContainer}>
      <Calendar
        current={selectedDate}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={{
          ...calendarMarked,
          [selectedDate]: {
            ...calendarMarked[selectedDate],
            selected: true,
            selectedColor: '#007AFF',
            selectedTextColor: '#fff',
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
          selectedDotColor: '#fff',
          arrowColor: '#007AFF',
          monthTextColor: '#333',
          textMonthFontWeight: '600',
          textDayFontSize: 16,
          textDayHeaderFontSize: 12,
        }}
        renderArrow={(direction) => (
          <Ionicons
            name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
            size={20}
            color="#007AFF"
          />
        )}
        dayComponent={({ date, state }: any) => renderCalendarDay({ date, state, ...date })}
      />

      <View style={styles.calendarDayHeader}>
        <Text style={styles.calendarDayTitle}>
          {format(parseISO(selectedDate), 'EEEE, MMMM d')}
          {isToday(parseISO(selectedDate)) && (
            <Text style={styles.todayIndicator}> • Today</Text>
          )}
          {isTomorrow(parseISO(selectedDate)) && (
            <Text style={styles.tomorrowIndicator}> • Tomorrow</Text>
          )}
        </Text>
        <Text style={styles.calendarDaySubtitle}>
          {getActivitiesForDate(selectedDate).length} sessions
        </Text>
      </View>

      <ScrollView style={styles.calendarDayActivities}>
        {getActivitiesForDate(selectedDate).length > 0 ? (
          getActivitiesForDate(selectedDate).map((activity, index) => (
            <TouchableOpacity
              key={activity.id}
              style={[
                styles.calendarEvent,
                { borderLeftColor: getStatusColor(activity.status) }
              ]}
              onPress={() => handleActivityPress(activity)}
            >
              <View style={styles.calendarEventTime}>
                <Text style={styles.calendarEventTimeText}>
                  {format(parseISO(activity.scheduled_start), 'h:mm')}
                </Text>
                <Text style={styles.calendarEventTimePeriod}>
                  {format(parseISO(activity.scheduled_start), 'a')}
                </Text>
              </View>

              <View style={styles.calendarEventContent}>
                <Text style={styles.calendarEventTitle}>{activity.title}</Text>
                <Text style={styles.calendarEventDescription} numberOfLines={1}>
                  {activity.description}
                </Text>

                <View style={styles.calendarEventMeta}>
                  <View style={styles.calendarEventSpace}>
                    <View style={[styles.spaceDotSmall, { backgroundColor: getSpaceInfo(activity.space_id).color }]} />
                    <Text style={styles.calendarEventSpaceText}>
                      {getSpaceInfo(activity.space_id).name}
                    </Text>
                  </View>

                  <View style={styles.calendarEventDuration}>
                    <Ionicons name="timer" size={12} color="#666" />
                    <Text style={styles.calendarEventDurationText}>
                      {activity.duration_minutes}m
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.calendarEventAction}
                onPress={() => router.push(`/(spaces)/${activity.space_id}?activity=${activity.id}`)}
              >
                <LinearGradient
                  colors={['#007AFF', '#0056CC']}
                  style={styles.calendarEventActionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="enter" size={16} color="#fff" />
                  <Text style={styles.calendarEventActionText}>Join</Text>
                </LinearGradient>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCalendarDay}>
            <Ionicons name="calendar-outline" size={64} color="#e0e0e0" />
            <Text style={styles.emptyCalendarText}>No sessions scheduled</Text>
            <Text style={styles.emptyCalendarSubtext}>
              Tap the + button to schedule your first session
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderListView = () => (
    <ScrollView
      style={styles.listContainer}
      showsVerticalScrollIndicator={false}
      key={filterStatus}
    >
      <View style={styles.upcomingSection}>
        <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
        <Text style={styles.sectionSubtitle}>
          {activities.filter(a => a.status === 'scheduled' || a.status === 'proposed').length} sessions scheduled
        </Text>
      </View>

      {activities
        .filter(activity => activity.status === 'scheduled' || activity.status === 'proposed')
        .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
        .map((activity, index) => renderActivityCard(activity, index))}

      {activities.filter(a => a.status === 'active').length > 0 && (
        <View style={styles.activeSection}>
          <Text style={styles.sectionTitle}>Active Now</Text>
          <Text style={styles.sectionSubtitle}>
            {activities.filter(a => a.status === 'active').length} in progress
          </Text>
        </View>
      )}

      {activities
        .filter(activity => activity.status === 'active')
        .map((activity, index) => renderActivityCard(activity, index))}

      {activities.filter(a => a.status === 'completed').length > 0 && (
        <View style={styles.completedSection}>
          <Text style={styles.sectionTitle}>Completed</Text>
          <Text style={styles.sectionSubtitle}>
            {activities.filter(a => a.status === 'completed').length} sessions completed
          </Text>
        </View>
      )}

      {activities
        .filter(activity => activity.status === 'completed')
        .slice(0, 5) // Only show 5 most recent
        .map((activity, index) => renderActivityCard(activity, index))}
    </ScrollView>
  );

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <BlurView intensity={90} tint="light" style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Collaborative Sessions</Text>
          <Text style={styles.headerSubtitle}>
            {activitiesCount} total • {activities.filter(a => a.status === 'scheduled').length} upcoming
          </Text>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <LinearGradient
            colors={['#007AFF', '#0056CC']}
            style={styles.createButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </BlurView>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons
            name="list"
            size={20}
            color={viewMode === 'list' ? '#007AFF' : '#666'}
          />
          <Text style={[
            styles.viewToggleText,
            viewMode === 'list' && styles.viewToggleTextActive
          ]}>
            List
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewToggleButton, viewMode === 'calendar' && styles.viewToggleButtonActive]}
          onPress={() => setViewMode('calendar')}
        >
          <Ionicons
            name="calendar"
            size={20}
            color={viewMode === 'calendar' ? '#007AFF' : '#666'}
          />
          <Text style={[
            styles.viewToggleText,
            viewMode === 'calendar' && styles.viewToggleTextActive
          ]}>
            Calendar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statusFilter}
        contentContainerStyle={styles.statusFilterContent}
      >
        {[
          { id: 'upcoming', label: 'Upcoming', count: activities.filter(a => a.status === 'scheduled' || a.status === 'proposed').length },
          { id: 'active', label: 'Active', count: activities.filter(a => a.status === 'active').length },
          { id: 'completed', label: 'Completed', count: activities.filter(a => a.status === 'completed').length },
          { id: 'all', label: 'All Sessions', count: activitiesCount },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterButton,
              filterStatus === filter.id && styles.filterButtonActive
            ]}
            onPress={() => setFilterStatus(filter.id as any)}
          >
            <Text style={[
              styles.filterButtonText,
              filterStatus === filter.id && styles.filterButtonTextActive
            ]}>
              {filter.label}
            </Text>
            <View style={[
              styles.filterBadge,
              filterStatus === filter.id && styles.filterBadgeActive
            ]}>
              <Text style={styles.filterBadgeText}>{filter.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Main Content */}
      {viewMode === 'calendar' ? renderCalendarView() : renderListView()}

      {/* Floating Create Button */}
      <TouchableOpacity
        style={styles.floatingCreateButton}
        onPress={() => {
          setShowActivities(false);
          setShowCreateModal(true);
        }}
      >
        <LinearGradient
          colors={['#007AFF', '#0056CC']}
          style={styles.floatingCreateButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.floatingCreateButtonText}>New Session</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
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
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    marginHorizontal: 4,
  },
  viewToggleButtonActive: {
    backgroundColor: '#007AFF20',
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  viewToggleTextActive: {
    color: '#007AFF',
  },
  statusFilter: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f8f8',
    maxHeight: 60,
  },
  statusFilterContent: {
    gap: 8,
    maxHeight: 40,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filterBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    minWidth: 24,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: '#fff',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  listContainer: {
    flex: 1,
    padding: 20,
  },
  calendarContainer: {
    flex: 1,
  },
  upcomingSection: {
    marginBottom: 24,
  },
  activeSection: {
    marginTop: 32,
    marginBottom: 24,
  },
  completedSection: {
    marginTop: 32,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  activityCard: {
    marginBottom: 16,
  },
  activityCardInner: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    ...createShadow({
      width: 0,
      height: 4,
      opacity: 0.05,
      radius: 12,
      elevation: 3,
    }),
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  timelineIndicator: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e0e0e0',
    marginTop: 4,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  spaceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flex: 1,
  },
  spaceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  spaceName: {
    fontSize: 11,
    color: '#666',
    flex: 1,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  activityDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  calendarDay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  calendarDaySelected: {
    backgroundColor: '#007AFF',
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  calendarDayTextToday: {
    color: '#007AFF',
    fontWeight: '700',
  },
  calendarDayDots: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 2,
    alignItems: 'center',
  },
  calendarDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  calendarDayMore: {
    fontSize: 8,
    color: '#666',
    marginLeft: 2,
  },
  calendarDayHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  calendarDayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  todayIndicator: {
    color: '#007AFF',
    fontWeight: '600',
  },
  tomorrowIndicator: {
    color: '#FFA726',
    fontWeight: '600',
  },
  calendarDaySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  calendarDayActivities: {
    flex: 1,
    padding: 20,
  },
  calendarEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.05,
      radius: 8,
      elevation: 2,
    }),
  },
  calendarEventTime: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 60,
  },
  calendarEventTimeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  calendarEventTimePeriod: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  calendarEventContent: {
    flex: 1,
  },
  calendarEventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  calendarEventDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  calendarEventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendarEventSpace: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spaceDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  calendarEventSpaceText: {
    fontSize: 12,
    color: '#666',
  },
  calendarEventDuration: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarEventDurationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  calendarEventAction: {
    marginLeft: 12,
  },
  calendarEventActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  calendarEventActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  emptyCalendarDay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyCalendarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyCalendarSubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  floatingCreateButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    borderRadius: 25,
    overflow: 'hidden',
    ...createShadow({
      color: '#007AFF',
      width: 0,
      height: 4,
      opacity: 0.3,
      radius: 12,
      elevation: 8,
    }),
  },
  floatingCreateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  floatingCreateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default CollaborativeActivities;