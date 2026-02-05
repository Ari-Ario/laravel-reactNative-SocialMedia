import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { format, parseISO, addDays } from 'date-fns';
import * as CalendarService from 'expo-calendar';
import CollaborationService, { CollaborativeActivity } from '@/services/CollaborationService';

interface CalendarViewProps {
  spaceId: string;
  space?: any;
  onActivityCreated?: () => void;
  onCreateActivity?: () => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  spaceId,
  space,
  onActivityCreated,
  onCreateActivity,
}) => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [calendarEvents, setCalendarEvents] = useState<{[key: string]: any}>({});
  const [activities, setActivities] = useState<CollaborativeActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const collaborationService = CollaborationService.getInstance();

  useEffect(() => {
    loadSpaceActivities();
  }, [spaceId]);

  const loadSpaceActivities = async () => {
    setLoading(true);
    try {
      const result = await collaborationService.getSpaceActivities(spaceId);
      setActivities(result.activities);
      
      // Format for calendar
      const markedDates: {[key: string]: any} = {};
      result.activities.forEach(activity => {
        if (activity.scheduled_start) {
          const date = format(new Date(activity.scheduled_start), 'yyyy-MM-dd');
          if (!markedDates[date]) {
            markedDates[date] = {
              marked: true,
              dots: [{color: getStatusColor(activity.status)}],
              activities: []
            };
          }
          markedDates[date].activities.push(activity);
        }
      });
      setCalendarEvents(markedDates);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
  };

  const handleAddToDeviceCalendar = async (activity: CollaborativeActivity) => {
    try {
      const { status } = await CalendarService.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant calendar access to add events');
        return;
      }

      const calendars = await CalendarService.getCalendarsAsync();
      const defaultCalendar = calendars.find(c => c.isPrimary) || calendars[0];
      
      const eventId = await CalendarService.createEventAsync(defaultCalendar.id, {
        title: activity.title,
        startDate: new Date(activity.scheduled_start),
        endDate: new Date(activity.scheduled_end || addDays(new Date(activity.scheduled_start), 1)),
        location: `Space: ${space?.title}`,
        notes: `${activity.description}\n\nJoin: yourapp://spaces/${spaceId}?activity=${activity.id}`,
        alarms: [{ relativeOffset: -15 }], // 15 minutes before
        url: `yourapp://spaces/${spaceId}?activity=${activity.id}`,
      });

      Alert.alert('Success', 'Added to your calendar!');
    } catch (error) {
      console.error('Error adding to calendar:', error);
      Alert.alert('Error', 'Could not add to calendar');
    }
  };

  const handleActivityPress = (activity: CollaborativeActivity) => {
    Alert.alert(
      activity.title,
      `${activity.description || 'No description'}\n\nStatus: ${activity.status}\nStart: ${format(new Date(activity.scheduled_start), 'PPpp')}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add to Calendar', onPress: () => handleAddToDeviceCalendar(activity) },
        { text: 'View Details', onPress: () => {} },
      ]
    );
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      scheduled: '#007AFF',
      active: '#4CAF50',
      completed: '#9C27B0',
      cancelled: '#F44336',
      proposed: '#FF9800',
    };
    return colors[status] || '#666';
  };

  const renderCalendarItem = (activity: CollaborativeActivity) => (
    <TouchableOpacity
      key={activity.id}
      style={[styles.calendarEvent, {borderLeftColor: getStatusColor(activity.status)}]}
      onPress={() => handleActivityPress(activity)}
      onLongPress={() => handleAddToDeviceCalendar(activity)}
    >
      <View style={styles.calendarEventTime}>
        <Text style={styles.calendarEventTimeText}>
          {format(new Date(activity.scheduled_start), 'HH:mm')}
        </Text>
        <Text style={styles.calendarEventDuration}>
          {activity.duration_minutes}m
        </Text>
      </View>
      <View style={styles.calendarEventContent}>
        <Text style={styles.calendarEventTitle}>{activity.title}</Text>
        <Text style={styles.calendarEventDescription} numberOfLines={1}>
          {activity.description}
        </Text>
        <View style={styles.calendarEventParticipants}>
          <Ionicons name="people" size={12} color="#666" />
          <Text style={styles.calendarEventParticipantsText}>
            {activity.confirmed_participants || 0} going
          </Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.calendarEventAction}
        onPress={() => handleAddToDeviceCalendar(activity)}
      >
        <Ionicons name="calendar-outline" size={18} color="#007AFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const todaysActivities = activities
    .filter(a => a.scheduled_start && format(new Date(a.scheduled_start), 'yyyy-MM-dd') === selectedDate)
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Calendar
        current={selectedDate}
        onDayPress={handleDayPress}
        markedDates={{
          ...calendarEvents,
          [selectedDate]: {
            ...calendarEvents[selectedDate],
            selected: true,
            selectedColor: '#007AFF'
          }
        }}
        theme={{
          selectedDayBackgroundColor: '#007AFF',
          todayTextColor: '#007AFF',
          arrowColor: '#007AFF',
          monthTextColor: '#333',
          textMonthFontWeight: '600',
          textDayFontSize: 14,
          textMonthFontSize: 16,
        }}
      />
      
      <View style={styles.calendarHeader}>
        <Text style={styles.calendarTitle}>
          {format(parseISO(selectedDate), 'EEEE, MMMM d')}
        </Text>
        <TouchableOpacity 
          style={styles.addEventButton}
          onPress={onCreateActivity}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addEventButtonText}>Schedule</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.calendarEventsList}>
        {todaysActivities.length > 0 ? (
          todaysActivities.map(renderCalendarItem)
        ) : (
          <View style={styles.emptyCalendarDay}>
            <Ionicons name="calendar-outline" size={48} color="#ccc" />
            <Text style={styles.emptyCalendarText}>No sessions scheduled</Text>
            <Text style={styles.emptyCalendarSubtext}>
              Schedule your first collaboration session
            </Text>
            <TouchableOpacity 
              style={styles.scheduleFirstButton}
              onPress={onCreateActivity}
            >
              <Text style={styles.scheduleFirstButtonText}>Schedule Session</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  addEventButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  calendarEventsList: {
    flex: 1,
    paddingTop: 8,
  },
  calendarEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    elevation: 2,
  },
  calendarEventTime: {
    alignItems: 'center',
    marginRight: 12,
    minWidth: 60,
  },
  calendarEventTimeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  calendarEventDuration: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  calendarEventContent: {
    flex: 1,
  },
  calendarEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  calendarEventDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  calendarEventParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarEventParticipantsText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  calendarEventAction: {
    padding: 8,
  },
  emptyCalendarDay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyCalendarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyCalendarSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  scheduleFirstButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  scheduleFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CalendarView;