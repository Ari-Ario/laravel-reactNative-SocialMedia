import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { format } from 'date-fns';
import CollaborationService, { CollaborativeActivity } from '@/services/ChatScreen/CollaborationService';
import { createShadow } from '@/utils/styles';
import { useToastStore } from '@/stores/toastStore';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
  FadeIn,
} from 'react-native-reanimated';
import { safeHaptics } from '@/utils/haptics';
import { MotiView } from 'moti';

// ─── Types & Props ───────────────────────────────────────────────────────────

interface CreateActivityModalProps {
  spaceId?: string;
  visible: boolean;
  onClose: () => void;
  onActivityCreated: () => void;
  defaultDate?: string;
  initialTime?: Date;
  activityToEdit?: CollaborativeActivity | null;
  isEditing?: boolean;
}

interface SessionDatePickerModalProps {
  visible: boolean;
  value: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
}

// ─── Custom Date Picker Modal ───────────────────────────────────────────────

const SessionDatePickerModal = ({ visible, value, onConfirm, onClose }: SessionDatePickerModalProps) => {
  const { t } = useTranslation();
  const { colors, activeScheme } = useAppTheme();
  const modalStyles = getDatePickerStyles(colors, activeScheme);

  const baseDate = value || new Date(Date.now() + 3600000);
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
              <Text style={modalStyles.title}>{t('schedule_session')}</Text>
              <TouchableOpacity onPress={handleConfirm}>
                <Text style={modalStyles.doneBtn}>{t('save')}</Text>
              </TouchableOpacity>
            </View>

            {Platform.OS === 'web' ? (
              <View style={modalStyles.webDateContainer}>
                <Text style={modalStyles.webDateLabel}>{t('select_date_time')}</Text>
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
                <Text style={[modalStyles.webDateLabel, { paddingHorizontal: 20 }]}>{t('select_date_time')}</Text>
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

// ─── Main Component ──────────────────────────────────────────────────────────

const CreateActivityModal: React.FC<CreateActivityModalProps> = ({
  spaceId,
  visible,
  onClose,
  onActivityCreated,
  defaultDate,
  initialTime,
  activityToEdit,
  isEditing,
}) => {
  const { showToast } = useToastStore();
  const insets = useSafeAreaInsets();
  const { colors, activeScheme } = useAppTheme();
  const { t, isRTL } = useTranslation();
  const isDark = activeScheme === 'dark';

  // State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('meeting');
  const [scheduledStart, setScheduledStart] = useState<Date>(new Date());
  
  const [durationValue, setDurationValue] = useState('60');
  const [durationUnit, setDurationUnit] = useState<'min' | 'hour' | 'day'>('min');
  
  const [isRecurring, setIsRecurring] = useState(true);
  const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState<number | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { spaces } = require('@/stores/collaborationStore').useCollaborationStore();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(spaceId || '');
  const collaborationService = CollaborationService.getInstance();

  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, { duration: 400 });
      
      if (initialTime) setScheduledStart(new Date(initialTime));
      else if (defaultDate) {
        const d = new Date(defaultDate);
        d.setHours(new Date().getHours() + 1, 0, 0, 0);
        setScheduledStart(d);
      } else {
        const now = new Date();
        now.setHours(now.getHours() + 1, 0, 0, 0);
        setScheduledStart(now);
      }
      
      if (spaceId) setSelectedSpaceId(spaceId);

      if (isEditing && activityToEdit) {
        setTitle(activityToEdit.title);
        setDescription(activityToEdit.description || '');
        if (activityToEdit.scheduled_start) setScheduledStart(new Date(activityToEdit.scheduled_start));
        
        const mins = activityToEdit.duration_minutes || 60;
        if (mins >= 1440 && mins % 1440 === 0) {
          setDurationValue(String(mins / 1440));
          setDurationUnit('day');
        } else if (mins >= 60 && mins % 60 === 0) {
          setDurationValue(String(mins / 60));
          setDurationUnit('hour');
        } else {
          setDurationValue(String(mins));
          setDurationUnit('min');
        }

        setIsRecurring(!!activityToEdit.is_recurring);
        setRecurrencePattern(activityToEdit.recurrence_pattern as any || 'weekly');
        setMaxParticipants(activityToEdit.max_participants);
        setSelectedSpaceId(activityToEdit.space_id);
      }
    } else {
      progress.value = 0;
      setIsSubmitting(false);
    }
  }, [visible, initialTime, spaceId, defaultDate, isEditing, activityToEdit]);

  const activityTypes = useMemo(() => [
    { id: 'meeting', name: t('team_meeting'), icon: 'people', color: '#6366f1' },
    { id: 'brainstorm', name: t('brainstorm'), icon: 'bulb', color: '#10b981' },
    { id: 'workshop', name: t('workshop'), icon: 'school', color: '#f59e0b' },
    { id: 'review', name: t('review'), icon: 'checkmark-circle', color: '#8b5cf6' },
    { id: 'planning', name: t('planning'), icon: 'calendar', color: '#3b82f6' },
    { id: 'social', name: t('social'), icon: 'wine', color: '#ec4899' },
  ], [t]);

  const getLocalizedDay = useCallback((date: Date, short = true) => {
    const dayKey = 'day_' + format(date, 'eee').toLowerCase();
    const shortKey = dayKey + '_s';
    return t(short ? shortKey : dayKey);
  }, [t]);

  const durationInMinutes = useMemo(() => {
    const val = parseInt(durationValue, 10) || 0;
    if (durationUnit === 'day') return val * 1440;
    if (durationUnit === 'hour') return val * 60;
    return val;
  }, [durationValue, durationUnit]);

  const isFormValid = useMemo(() => {
    return title.trim().length > 0 && selectedSpaceId.length > 0 && !!scheduledStart && durationInMinutes > 0;
  }, [title, selectedSpaceId, scheduledStart, durationInMinutes]);

  const handleAction = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    safeHaptics.success();

    const activityData: any = {
      space_id: selectedSpaceId,
      title,
      description,
      activity_type: activityType,
      scheduled_start: scheduledStart.toISOString(),
      duration_minutes: durationInMinutes,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      max_participants: maxParticipants,
    };

    try {
      let result;
      const store = require('@/stores/collaborationStore').useCollaborationStore.getState();
      if (isEditing && activityToEdit) {
        result = await collaborationService.updateCollaborativeActivity(Number(activityToEdit.id), activityData);
        if (result) {
          store.updateActivity(result);
          showToast(t('session_updated'), 'success');
        }
      } else {
        result = await collaborationService.createCollaborativeActivity(activityData);
        if (result) {
          store.addActivity(result);
          showToast(t('session_scheduled'), 'success');
        }
      }
      onActivityCreated();
      onClose();
    } catch (error) {
      showToast(t('error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = getStyles(colors, activeScheme, isRTL);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.background] : ['#f8fafc', '#f1f5f9']}
        style={[GlobalStyles.popupContainer, { paddingTop: insets.top || 20, backgroundColor: colors.background }]}
      >
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? t('edit_session') : t('create_session')}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(400)}>
            
            {/* Title Card */}
            <View style={styles.card}>
              <TextInput
                style={styles.titleInput}
                placeholder={t('session_title')}
                placeholderTextColor={colors.textSecondary + '70'}
                value={title}
                onChangeText={setTitle}
              />
              <View style={styles.separator} />
              <TextInput
                style={styles.descriptionInput}
                placeholder={t('description_placeholder')}
                placeholderTextColor={colors.textSecondary + '70'}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* PACKED HORIZONTAL Type Icons */}
            <Text style={styles.sectionLabel}>{t('activity_type')}</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.typeScroll}
              contentContainerStyle={styles.typeScrollContent}
            >
              {activityTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.typeItem, activityType === type.id && styles.typeItemSelected]}
                  onPress={() => { setActivityType(type.id); safeHaptics.impact(); }}
                >
                  <LinearGradient colors={[type.color, type.color + 'cc']} style={styles.typeIconCircle}>
                    <Ionicons name={type.icon as any} size={32} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.typeName, activityType === type.id && { color: type.color, fontWeight: '800' }]} numberOfLines={1}>
                    {type.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* When Hub */}
            <Text style={styles.sectionLabel}>{t('when')}</Text>
            <TouchableOpacity 
              style={styles.scheduleCard}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <View style={styles.scheduleIconWrapper}>
                <Ionicons name="calendar" size={20} color={colors.tint} />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleDate}>
                  {getLocalizedDay(scheduledStart, false) + format(scheduledStart, ', MMM d, yyyy')}
                </Text>
                <Text style={styles.scheduleTime}>
                  {format(scheduledStart, 'h:mm a')} • {durationInMinutes} {t('min')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <SessionDatePickerModal
              visible={showDatePicker}
              value={scheduledStart}
              onConfirm={(date) => { setScheduledStart(date); setShowDatePicker(false); }}
              onClose={() => setShowDatePicker(false)}
            />

            {/* Duration & Participants */}
            <View style={styles.splitBox}>
              <Text style={styles.boxLabel}>{t('duration')}</Text>
              <View style={styles.durationInputRow}>
                <TextInput
                  style={styles.numericInput}
                  value={durationValue}
                  onChangeText={v => setDurationValue(v.replace(/\D/g, ''))}
                  keyboardType="numeric"
                />
                <View style={styles.unitSelector}>
                  {['min', 'hour', 'day'].map(u => (
                    <TouchableOpacity 
                      key={u} 
                      onPress={() => setDurationUnit(u as any)}
                      style={[styles.unitPill, durationUnit === u && styles.unitPillActive]}
                    >
                      <Text style={[styles.unitPillText, durationUnit === u && styles.unitPillTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={[styles.splitBox, { marginTop: 16 }]}>
              <Text style={styles.boxLabel}>{t('participants')}</Text>
              <TextInput
                style={styles.numericInputLarge}
                placeholder="∞"
                value={maxParticipants === undefined ? '' : String(maxParticipants)}
                onChangeText={v => {
                  if (v === '') setMaxParticipants(undefined);
                  else {
                    const n = parseInt(v, 10);
                    if (!isNaN(n)) setMaxParticipants(n);
                  }
                }}
                keyboardType="numeric"
              />
              <Text style={styles.usageDescription}>{t('participants_limit_desc')}</Text>
            </View>

            {/* Recurrence & Frequency */}
            <View style={styles.recurrenceGroup}>
              <View style={styles.recurrenceHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recurrenceTitle}>{t('recurring')}</Text>
                  <Text style={styles.recurrenceDesc}>{t('repeat_event')}</Text>
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  trackColor={{ false: colors.border, true: colors.tint }}
                />
              </View>
              
              {isRecurring && (
                <MotiView from={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} style={styles.freqContainer}>
                  <View style={styles.divider} />
                  <View style={styles.freqPills}>
                    {['daily', 'weekly', 'biweekly', 'monthly'].map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.freqPill, recurrencePattern === p && styles.freqPillActive]}
                        onPress={() => setRecurrencePattern(p as any)}
                      >
                        <Text style={[styles.freqPillText, recurrencePattern === p && styles.freqPillTextActive]}>
                          {p === 'biweekly' ? t('two_weeks') : t(`repeats_${p}`)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </MotiView>
              )}
            </View>

            {/* Target Space */}
            <Text style={styles.sectionLabel}>{t('target_space')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.spaceScroll}>
              {spaces
                .filter((s: any) => s && s.id && s.space_type !== 'direct' && s.space_type !== 'chat')
                .map((s: any) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.spacePill, selectedSpaceId === s.id && styles.spacePillActive]}
                  onPress={() => setSelectedSpaceId(s.id)}
                >
                  <View style={[styles.dot, { backgroundColor: colors.tint }]} />
                  <Text style={[styles.spaceText, selectedSpaceId === s.id && { color: colors.tint }]}>{s.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionBtn, !isFormValid && styles.actionBtnDisabled]}
            onPress={handleAction}
            disabled={!isFormValid || isSubmitting}
          >
            <LinearGradient colors={isFormValid ? ['#6366f1', '#4f46e5'] : [colors.border, colors.border]} style={styles.actionGradient}>
              {isSubmitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.actionBtnText}>{isEditing ? t('update_session') : t('schedule_session')}</Text>
                  {isFormValid && <Ionicons name="sparkles" size={18} color="#fff" />}
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
};

const getStyles = (colors: any, activeScheme: string, isRTL: boolean) => {
  const isDark = activeScheme === 'dark';
  const SHADOW = createShadow({ height: 4, opacity: isDark ? 0.3 : 0.05, radius: 6, elevation: 3 });

  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 16, alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { fontSize: 16, fontWeight: '900', color: colors.text, textTransform: 'uppercase' },
    scrollContent: { flex: 1 },
    scrollContentContainer: { paddingHorizontal: 20, paddingBottom: 140 },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, ...SHADOW },
    titleInput: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 6 },
    descriptionInput: { fontSize: 14, color: colors.textSecondary, lineHeight: 18 },
    separator: { height: 1, backgroundColor: colors.border, opacity: 0.2, marginVertical: 6 },
    sectionLabel: { fontSize: 10, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
    typeScroll: { marginBottom: 20, marginHorizontal: -20 },
    typeScrollContent: { paddingHorizontal: 20, gap: 10 },
    typeItem: { width: 85, height: 95, backgroundColor: colors.card, borderRadius: 16, justifyContent: 'center', alignItems: 'center', ...SHADOW },
    typeItemSelected: { borderWidth: 2, borderColor: colors.tint },
    typeIconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    typeName: { fontSize: 10, fontWeight: '800', color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 4 },
    scheduleCard: { backgroundColor: colors.card, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16, ...SHADOW },
    scheduleIconWrapper: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.tint + '10', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    scheduleInfo: { flex: 1 },
    scheduleDate: { fontSize: 15, fontWeight: '800', color: colors.text },
    scheduleTime: { fontSize: 12, color: colors.textSecondary },
    splitBox: { backgroundColor: colors.card, borderRadius: 16, padding: 14, ...SHADOW },
    boxLabel: { fontSize: 10, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 },
    durationInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    numericInput: { fontSize: 18, fontWeight: '800', color: colors.text, width: 55, textAlign: 'center', backgroundColor: colors.muted, borderRadius: 8, padding: 6 },
    numericInputLarge: { fontSize: 22, fontWeight: '900', color: colors.tint, width: '100%', textAlign: 'center' },
    unitSelector: { flex: 1, flexDirection: 'row', gap: 4 },
    unitPill: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.muted, alignItems: 'center' },
    unitPillActive: { backgroundColor: colors.tint },
    unitPillText: { fontSize: 10, fontWeight: '800', color: colors.textSecondary },
    unitPillTextActive: { color: '#fff' },
    usageDescription: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
    recurrenceGroup: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 16, marginBottom: 16, ...SHADOW },
    recurrenceHeader: { flexDirection: 'row', alignItems: 'center' },
    recurrenceTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    recurrenceDesc: { fontSize: 12, color: colors.textSecondary },
    freqContainer: { overflow: 'hidden' },
    divider: { height: 1, backgroundColor: colors.border, opacity: 0.2, marginVertical: 10 },
    freqPills: { flexDirection: 'row', gap: 4 },
    freqPill: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.muted, alignItems: 'center' },
    freqPillActive: { backgroundColor: colors.tint },
    freqPillText: { fontSize: 9, fontWeight: '800', color: colors.textSecondary },
    freqPillTextActive: { color: '#fff' },
    spaceScroll: { marginBottom: 16 },
    spacePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.card, borderRadius: 10, marginRight: 8, ...SHADOW },
    spacePillActive: { borderColor: colors.tint, borderWidth: 1.5 },
    dot: { width: 4, height: 4, borderRadius: 2, marginRight: 6 },
    spaceText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 20, backgroundColor: colors.background + 'F0' },
    actionBtn: { height: 50, borderRadius: 25, overflow: 'hidden', ...SHADOW },
    actionBtnDisabled: { opacity: 0.3 },
    actionGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  });
};

function getDatePickerStyles(colors: any, activeScheme: string) {
  const isDark = activeScheme === 'dark';
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: isDark ? '#111' : colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, width: '100%', maxHeight: '75%' },
    handle: { width: 30, height: 3, borderRadius: 1.5, backgroundColor: colors.border, alignSelf: 'center', marginTop: 8, marginBottom: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    title: { fontSize: 15, fontWeight: '900', color: colors.text },
    cancelBtn: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },
    doneBtn: { fontSize: 14, color: colors.tint, fontWeight: '900' },
    pickerRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
    pickerCol: { flex: 1, alignItems: 'center' },
    pickerLabel: { fontSize: 9, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 },
    pickerInput: { width: '100%', borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 16, fontWeight: '800', textAlign: 'center', color: colors.text, backgroundColor: isDark ? '#1A1A1A' : colors.background },
    monthScroll: { maxHeight: 120, width: '100%' },
    monthItem: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, marginBottom: 2, alignItems: 'center' },
    monthItemActive: { backgroundColor: colors.tint + '20' },
    monthText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
    monthTextActive: { color: colors.tint, fontWeight: '900' },
    webDateContainer: { paddingVertical: 20, alignItems: 'center', width: '100%', paddingHorizontal: 12 },
    webDateLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '700', marginBottom: 10 },
  });
}

export default CreateActivityModal;