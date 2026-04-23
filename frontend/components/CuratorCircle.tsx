import React, { useState, useContext } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, FlatList, Dimensions, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import AuthContext from '@/context/AuthContext';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useToastStore } from '@/stores/toastStore';
import { useProfileView } from '@/context/ProfileViewContext';
import { useModal } from '@/context/ModalContext';
import { createShadow } from '@/utils/styles';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';

const { width } = Dimensions.get('window');

interface Reposter {
  id: number;
  name: string;
  profile_photo: string | null;
  context_tag?: string;
  personal_note?: string;
  created_at?: string;
}

interface CuratorCircleProps {
  reposters: Reposter[];
  postId: number;
  postContent?: string;
  post?: any;
}

export const CuratorCircle = ({ reposters, postId, postContent, post }: CuratorCircleProps) => {
  const router = useRouter();
  const { user: currentUser } = useContext(AuthContext);
  const { showToast } = useToastStore();
  const { openModal } = useModal();
  const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
  const [showGallery, setShowGallery] = useState(false);
  const [sendingTo, setSendingTo] = useState<number | null>(null);

  const { colors, activeScheme } = useAppTheme();
  const { t, isRTL } = useTranslation();
  const styles = getStyles(colors, activeScheme);

  if (!reposters || reposters.length === 0) return null;

  const handleOpenProfile = (reposterId: number) => {
    setShowGallery(false);
    setProfileViewUserId(reposterId.toString());
    setProfilePreviewVisible(true);
  };

  const handleMessage = async (reposter: Reposter) => {
    if (!currentUser) return;

    // Check privacy
    const userToMessage = reposter as any;
    if (userToMessage.is_private && !userToMessage.is_following) {
      showToast(t('private_profile_msg'), "error");
      return;
    }

    // Instead of creating space immediately, open the share modal pre-filled with this recipient
    setShowGallery(false);
    openModal('share', { 
      post, 
      initialRecipient: reposter 
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (date?: string) => {
    if (!date) return t('recently');
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return t('today');
    if (days === 1) return t('yesterday');
    if (days < 7) return t('days_ago', { days });
    return t('weeks_ago', { weeks: Math.floor(days / 7) });
  };

  const getTagColor = (tag?: string) => {
    if (!tag) return '#666';
    const tagMap: Record<string, string> = {
      '🔥': '#FF6B6B', '💡': '#4ECDC4', '🎯': '#45B7D1', '📚': '#96CEB4',
      '🎨': '#FFEAA7', '🤔': '#D4A5A5', '⚡': '#FF6CCB', '💎': '#845EC2',
      '❤️': '#FF4040', '🎉': '#FFD93D', '🎬': '#6C5CE7', '🎵': '#A8E6CF',
    };
    const emoji = tag?.split(' ')[0];
    return tagMap[emoji || ''] || '#666';
  };

  const ReposterCard = ({ reposter, index }: { reposter: Reposter; index: number }) => (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 50, type: 'timing' }}
      style={styles.galleryCard}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleOpenProfile(reposter.id)}
        style={styles.cardTouchable}
      >
        <View style={[styles.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {reposter.profile_photo ? (
            <Image
              source={{ uri: `${getApiBaseImage()}/storage/${reposter.profile_photo}` }}
              style={[styles.cardAvatar, { [isRTL ? 'marginLeft' : 'marginRight']: 12, [isRTL ? 'marginRight' : 'marginLeft']: 0 }]}
            />
          ) : (
            <View style={[styles.cardAvatar, styles.avatarPlaceholder, { [isRTL ? 'marginLeft' : 'marginRight']: 12, [isRTL ? 'marginRight' : 'marginLeft']: 0 }]}>
              <Text style={styles.avatarInitials}>{getInitials(reposter.name)}</Text>
            </View>
          )}
          <View style={[styles.cardInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Text style={[styles.cardName, { textAlign: isRTL ? 'right' : 'left' }]}>{reposter.name}</Text>
            <Text style={[styles.cardTime, { textAlign: isRTL ? 'right' : 'left' }]}>{formatDate(reposter.created_at)}</Text>
          </View>
          <View style={[styles.tagPill, { backgroundColor: getTagColor(reposter.context_tag) + '20', [isRTL ? 'marginLeft' : 'marginRight']: 8, [isRTL ? 'marginRight' : 'marginLeft']: 0 }]}>
            <Text style={[styles.tagText, { color: getTagColor(reposter.context_tag), textAlign: isRTL ? 'right' : 'left' }]}>
              {reposter.context_tag || t('📌 Shared')}
            </Text>
          </View>

          {/* Message button */}
          <TouchableOpacity
            style={styles.messageButton}
            onPress={(e) => {
              e.stopPropagation();
              handleMessage(reposter);
            }}
            disabled={sendingTo === reposter.id}
          >
            {sendingTo === reposter.id ? (
              <ActivityIndicator size="small" color="#0084ff" />
            ) : (
              <Ionicons name="chatbubble-outline" size={20} color="#0084ff" />
            )}
          </TouchableOpacity>
        </View>

        {reposter.personal_note && (
          <View style={[styles.noteContainer, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <View style={[styles.quoteMark, { [isRTL ? 'right' : 'left']: 8, [isRTL ? 'left' : 'right']: undefined }]}>
              <Text style={styles.quoteText}>"</Text>
            </View>
            <Text style={[styles.noteText, { textAlign: isRTL ? 'right' : 'left', [isRTL ? 'marginRight' : 'marginLeft']: 12, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]} numberOfLines={2}>
              {reposter.personal_note}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </MotiView>
  );

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setShowGallery(true)}
        style={[styles.circleContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        {/* Animated Ripple Effect */}
        <View style={styles.rippleContainer}>
          <MotiView 
            from={{ scale: 0.5, opacity: 0.5 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ loop: true, duration: 2000, type: 'timing' }}
            style={styles.ripple} 
          />
          <MotiView 
            from={{ scale: 0.5, opacity: 0.5 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ loop: true, duration: 2000, delay: 1000, type: 'timing' }}
            style={styles.ripple} 
          />
        </View>

        {/* Stacked Avatars */}
        <View style={[styles.avatarStack, { flexDirection: isRTL ? 'row-reverse' : 'row', [isRTL ? 'marginLeft' : 'marginRight']: 12, [isRTL ? 'marginRight' : 'marginLeft']: 0 }]}>
          {reposters.slice(0, 4).map((reposter, index) => {
            const rotation = (index - 2) * 3;
            return (
              <MotiView
                key={`${reposter.id}-${index}`}
                from={{ opacity: 0, translateY: 10, rotate: `${rotation}deg` }}
                animate={{ opacity: 1, translateY: 0, rotate: '0deg' }}
                transition={{ delay: index * 50, type: 'spring' }}
                style={[
                  styles.avatarWrapper,
                  { [isRTL ? 'marginRight' : 'marginLeft']: index > 0 ? -15 : 0, [isRTL ? 'marginLeft' : 'marginRight']: 0, zIndex: 4 - index }
                ]}
              >
                {reposter.profile_photo ? (
                  <Image
                    source={{ uri: `${getApiBaseImage()}/storage/${reposter.profile_photo}` }}
                    style={styles.stackAvatar}
                  />
                ) : (
                  <View style={[styles.stackAvatar, styles.avatarPlaceholderSmall]}>
                    <Text style={styles.avatarInitialsSmall}>{getInitials(reposter.name)}</Text>
                  </View>
                )}
              </MotiView>
            );
          })}

          {reposters.length > 4 && (
            <MotiView
              from={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' }}
              style={[styles.avatarWrapper, styles.moreBadge, { [isRTL ? 'marginRight' : 'marginLeft']: -15, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}
            >
              <Text style={styles.moreText}>+{reposters.length - 4}</Text>
            </MotiView>
          )}
        </View>

        {/* Context Text */}
        <View style={[styles.textContainer, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Text style={[styles.circleText, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
            <Text style={styles.boldText}>{reposters[0].name}</Text>
            {reposters.length > 1 && ` ${t('and')} ${reposters.length - 1} ${reposters.length === 2 ? t('other') : t('others')}`}
          </Text>
          <Text style={[styles.circleSubtext, { textAlign: isRTL ? 'right' : 'left' }]}>
            {reposters.length > 1 ? t('shared_this_post') : t('shared_with_context')}
          </Text>
        </View>

        {/* Interactive Chevron */}
        <View style={[styles.chevronContainer, { [isRTL ? 'marginRight' : 'marginLeft']: 8, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>
          <Ionicons name={isRTL ? "chevron-back-circle" : "chevron-forward-circle"} size={24} color="#0084ff" />
        </View>
      </TouchableOpacity>

      {/* Gallery Modal - scrollable list of reposters */}
      <Modal
        visible={showGallery}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGallery(false)}
      >
        <BlurView intensity={90} tint={activeScheme as any} style={styles.galleryOverlay}>
          <View style={[styles.galleryHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.galleryTitle, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}>{t('who_shared_this')}</Text>
            <TouchableOpacity onPress={() => setShowGallery(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={reposters}
            keyExtractor={(item: Reposter, index: number) => `${item.id}-${index}`}
            renderItem={({ item, index }: { item: Reposter; index: number }) => <ReposterCard reposter={item} index={index} />}
            contentContainerStyle={styles.galleryList}
            showsVerticalScrollIndicator={false}
          />

          {postContent && (
            <View style={[styles.previewBar, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
              <Text style={[styles.previewText, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                {t('replying_to', { content: postContent })}
              </Text>
            </View>
          )}
        </BlurView>
      </Modal>
    </>
  );
};

const getStyles = (colors: any, activeScheme: string) => StyleSheet.create({
  circleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.tint + '10',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.tint + '20',
    overflow: 'hidden',
    position: 'relative',
  },
  rippleContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: colors.tint + '15',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarWrapper: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.surface,
    ...createShadow({ width: 0, height: 2, opacity: activeScheme === 'dark' ? 0.3 : 0.2, radius: 4, elevation: 3 }),
  },
  stackAvatar: {
    width: 36, height: 36, borderRadius: 18,
  },
  avatarPlaceholderSmall: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsSmall: {
    fontSize: 12, fontWeight: '600', color: colors.textSecondary,
  },
  moreBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 12, fontWeight: '700', color: '#fff',
  },
  textContainer: { flex: 1 },
  circleText: { fontSize: 13, color: colors.textSecondary },
  boldText: { fontWeight: '700', color: colors.text },
  circleSubtext: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  chevronContainer: { marginLeft: 8 },
  galleryOverlay: { flex: 1, paddingTop: 50 },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  galleryTitle: {
    fontSize: 24, fontWeight: '700',
  },
  galleryList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  galleryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    ...createShadow({ width: 0, height: 4, opacity: activeScheme === 'dark' ? 0.4 : 0.2, radius: 8, elevation: 5 }),
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTouchable: { padding: 16 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardAvatar: {
    width: 44, height: 44, borderRadius: 22, marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 16, fontWeight: '600', color: colors.textSecondary,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardTime: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  tagPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8,
  },
  tagText: { fontSize: 11, fontWeight: '600' },
  messageButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteContainer: {
    backgroundColor: colors.background,
    borderRadius: 12, padding: 12, position: 'relative',
  },
  quoteMark: { position: 'absolute', top: 4, left: 8 },
  quoteText: { fontSize: 24, color: colors.textSecondary, fontWeight: '700' },
  noteText: { fontSize: 13, color: colors.text, marginLeft: 12, lineHeight: 18 },
  previewBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  previewText: { color: '#fff', fontSize: 13 },
});
