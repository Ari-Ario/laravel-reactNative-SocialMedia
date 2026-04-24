import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { format, parseISO } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { useTranslation } from '@/constants/i18n';
// import { useTheme } from '@/hooks/useTheme';
import { CollaborativeActivity } from '@/services/ChatScreen/CollaborationService';
import { createShadow } from '@/utils/styles';
import { useAppTheme } from '@/hooks/useAppTheme';

const { width, height } = Dimensions.get('window');

interface ActivityDetailModalProps {
  isVisible: boolean;
  activity: CollaborativeActivity | null;
  onClose: () => void;
  onEdit?: (activity: CollaborativeActivity) => void;
  onDelete?: (activity: CollaborativeActivity) => void;
  onJoin?: (activity: CollaborativeActivity) => void;
  onUpdateParticipant?: (userId: number, action: 'add' | 'remove') => Promise<void>;
  isManagingParticipants?: boolean;
  setIsManagingParticipants?: (value: boolean) => void;
  isUpdatingParticipants?: boolean;
  spaceParticipants?: any[];
  currentUserId?: string | number;
  isRTL?: boolean;
  onAddToCalendar?: (activity: CollaborativeActivity) => void;
  onExportICS?: (activity: CollaborativeActivity) => void;
  onCopyLink?: (activity: CollaborativeActivity) => void;
}

const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  isVisible,
  activity,
  onClose,
  onEdit,
  onDelete,
  onJoin,
  onUpdateParticipant,
  isManagingParticipants = false,
  setIsManagingParticipants,
  isUpdatingParticipants = false,
  spaceParticipants = [],
  currentUserId,
  isRTL = false,
  onAddToCalendar,
  onExportICS,
  onCopyLink,
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();

  if (!activity) return null;

  const isCreator = String(activity.created_by || activity.creator?.id) === String(currentUserId);

  const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      scheduled: colors.tint,
      active: colors.success,
      completed: '#757575',
      cancelled: colors.error,
      proposed: '#FFA726',
    };
    return statusColors[status] || '#666';
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

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={styles.modalOverlay}>
        <Animated.View
          entering={FadeInUp.springify().damping(15)}
          style={[styles.modalContainer, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.modalHeaderTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.typeIcon, { backgroundColor: getStatusColor(activity.status) + '20' }]}>
                <Ionicons name={getActivityIcon(activity.activity_type)} size={20} color={getStatusColor(activity.status)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000', textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                  {activity.title || t('untitled')}
                </Text>
                <Text style={[styles.statusText, { color: getStatusColor(activity.status), textAlign: isRTL ? 'right' : 'left' }]}>
                  {activity.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {isCreator && (
                <>
                  <TouchableOpacity
                    style={[styles.headerActionBtn, { backgroundColor: colors.tint + '15' }]}
                    onPress={() => onEdit?.(activity)}
                  >
                    <Ionicons name="pencil" size={18} color={colors.tint} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.headerActionBtn, { backgroundColor: colors.error + '15' }]}
                    onPress={() => onDelete?.(activity)}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#333'} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Description Section */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: colors.tint, textAlign: isRTL ? 'right' : 'left' }]}>{t('details')}</Text>
              <View style={[styles.descriptionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>
                <Text style={[styles.modalText, { color: isDark ? '#fff' : '#444', textAlign: isRTL ? 'right' : 'left' }]}>
                  {activity.description || t('no_description')}
                </Text>
              </View>
            </View>

            {/* Time & Location Section */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: colors.tint, textAlign: isRTL ? 'right' : 'left' }]}>{t('time')}</Text>
              <View style={styles.infoGrid}>
                <View style={[styles.infoCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>
                  <Ionicons name="calendar-outline" size={20} color={colors.tint} />
                  <Text style={[styles.infoText, { color: isDark ? '#fff' : '#444' }]}>
                    {activity.scheduled_start
                      ? format(parseISO(activity.scheduled_start), 'EEEE, MMM d')
                      : t('not_scheduled')}
                  </Text>
                </View>
                <View style={[styles.infoCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>
                  <Ionicons name="time-outline" size={20} color={colors.tint} />
                  <Text style={[styles.infoText, { color: isDark ? '#fff' : '#444' }]}>
                    {activity.scheduled_start
                      ? format(parseISO(activity.scheduled_start), 'h:mm a')
                      : '--:--'}
                  </Text>
                </View>
              </View>
              <View style={[styles.infoCardFull, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', marginTop: 10 }]}>
                <Ionicons name="timer-outline" size={20} color={colors.tint} />
                <Text style={[styles.infoText, { color: isDark ? '#fff' : '#444' }]}>
                  {t('duration_label').replace('{duration}', String(activity.duration_minutes || 60))}
                </Text>
              </View>
            </View>

            {/* Participants Section */}
            <View style={styles.modalSection}>
              <View style={[styles.sectionHeaderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.modalSectionTitle, { color: colors.tint, textAlign: isRTL ? 'right' : 'left' }]}>{t('participants')}</Text>
                {isCreator && setIsManagingParticipants && (
                  <TouchableOpacity
                    onPress={() => setIsManagingParticipants(!isManagingParticipants)}
                    style={[styles.manageButton, { backgroundColor: colors.tint + '15' }]}
                  >
                    <Text style={[styles.manageButtonText, { color: colors.tint }]}>
                      {isManagingParticipants ? t('done') : t('manage')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.participantsList}>
                {activity.participants?.map((p: any) => (
                  <View key={p.id} style={[styles.participantItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View style={[styles.participantInfo, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <View style={[styles.participantAvatar, { backgroundColor: colors.tint }]}>
                        <Text style={styles.avatarText}>{p.name?.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.participantName, { color: isDark ? '#fff' : '#444', textAlign: isRTL ? 'right' : 'left' }]}>{p.name}</Text>
                    </View>
                    {isManagingParticipants && (
                      <TouchableOpacity
                        onPress={() => onUpdateParticipant?.(p.id, 'remove')}
                        disabled={isUpdatingParticipants}
                      >
                        {isUpdatingParticipants ? (
                          <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                          <Ionicons name="remove-circle" size={22} color={colors.error} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {isManagingParticipants && spaceParticipants
                  .filter(sp => !activity.participant_ids?.includes(sp.user_id) && !activity.participants?.some((p: any) => p.id === sp.user_id))
                  .map((sp: any) => (
                    <View key={sp.user_id} style={[styles.participantItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <View style={[styles.participantInfo, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <View style={[styles.participantAvatar, { backgroundColor: isDark ? '#444' : '#E0E0E0' }]}>
                          <Text style={styles.avatarText}>{sp.user?.name?.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={[styles.participantName, { color: isDark ? '#888' : '#666', textAlign: isRTL ? 'right' : 'left' }]}>{sp.user?.name}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => onUpdateParticipant?.(sp.user_id, 'add')}
                        disabled={isUpdatingParticipants}
                      >
                        {isUpdatingParticipants ? (
                          <ActivityIndicator size="small" color={colors.success} />
                        ) : (
                          <Ionicons name="add-circle" size={22} color={colors.success} />
                        )}
                      </TouchableOpacity>
                    </View>
                  ))
                }
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: colors.tint, textAlign: isRTL ? 'right' : 'left' }]}>{t('actions')}</Text>
              <View style={[styles.modalActionsGrid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <TouchableOpacity
                  style={[styles.modalAction, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                  onPress={() => onAddToCalendar?.(activity)}
                >
                  <Ionicons name="calendar" size={20} color={colors.tint} />
                  <Text style={[styles.modalActionText, { color: isDark ? '#fff' : '#444' }]}>{t('add_to_calendar')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalAction, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                  onPress={() => onExportICS?.(activity)}
                >
                  <Ionicons name="download" size={20} color={colors.textSecondary} />
                  <Text style={[styles.modalActionText, { color: isDark ? '#fff' : '#444' }]}>{t('export_ics')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalAction, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                  onPress={() => onCopyLink?.(activity)}
                >
                  <Ionicons name="link" size={20} color={colors.textSecondary} />
                  <Text style={[styles.modalActionText, { color: isDark ? '#fff' : '#444' }]}>{t('copy_link')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Bottom Fixed Join Button */}
          {onJoin && activity.status !== 'completed' && activity.status !== 'cancelled' && (
            <View style={[styles.bottomActions, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <TouchableOpacity
                style={styles.joinButtonContainer}
                activeOpacity={0.8}
                onPress={() => onJoin(activity)}
              >
                <LinearGradient
                  colors={[colors.tint, '#4B53BC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.joinGradient}
                >
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={styles.joinButtonText}>
                    {activity.status === 'active' ? t('join_now') : t('start_session')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    borderRadius: 32,
    width: Math.min(width - 40, 550),
    maxHeight: height * 0.85,
    overflow: 'hidden',
    ...createShadow({
      width: 0,
      height: 12,
      opacity: 0.4,
      radius: 24,
      elevation: 15,
    }),
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  modalHeaderTitleRow: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: 24,
  },
  modalSection: {
    marginBottom: 28,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  descriptionCard: {
    padding: 16,
    borderRadius: 16,
  },
  modalText: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 10,
  },
  infoCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manageButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  manageButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  participantsList: {
    gap: 10,
  },
  participantItem: {
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
  },
  participantInfo: {
    alignItems: 'center',
    gap: 12,
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalAction: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 8,
  },
  modalActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bottomActions: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1,
  },
  joinButtonContainer: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    ...createShadow({
      width: 0,
      height: 8,
      opacity: 0.25,
      radius: 12,
      elevation: 8,
    }),
  },
  joinGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default ActivityDetailModal;
