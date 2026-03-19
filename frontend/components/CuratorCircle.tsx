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
      showToast("This profile is private", "error");
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
    if (!date) return 'Recently';
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
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
        <View style={styles.cardHeader}>
          {reposter.profile_photo ? (
            <Image
              source={{ uri: `${getApiBaseImage()}/storage/${reposter.profile_photo}` }}
              style={styles.cardAvatar}
            />
          ) : (
            <View style={[styles.cardAvatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>{getInitials(reposter.name)}</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{reposter.name}</Text>
            <Text style={styles.cardTime}>{formatDate(reposter.created_at)}</Text>
          </View>
          <View style={[styles.tagPill, { backgroundColor: getTagColor(reposter.context_tag) + '20' }]}>
            <Text style={[styles.tagText, { color: getTagColor(reposter.context_tag) }]}>
              {reposter.context_tag || '📌 Shared'}
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
          <View style={styles.noteContainer}>
            <View style={styles.quoteMark}>
              <Text style={styles.quoteText}>"</Text>
            </View>
            <Text style={styles.noteText} numberOfLines={2}>
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
        style={styles.circleContainer}
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
        <View style={styles.avatarStack}>
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
                  { marginLeft: index > 0 ? -15 : 0, zIndex: 4 - index }
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
              style={[styles.avatarWrapper, styles.moreBadge, { marginLeft: -15 }]}
            >
              <Text style={styles.moreText}>+{reposters.length - 4}</Text>
            </MotiView>
          )}
        </View>

        {/* Context Text */}
        <View style={styles.textContainer}>
          <Text style={styles.circleText} numberOfLines={1}>
            <Text style={styles.boldText}>{reposters[0].name}</Text>
            {reposters.length > 1 && ` and ${reposters.length - 1} ${reposters.length === 2 ? 'other' : 'others'}`}
          </Text>
          <Text style={styles.circleSubtext}>
            shared this {reposters.length > 1 ? 'post' : 'with context'}
          </Text>
        </View>

        {/* Interactive Chevron */}
        <View style={styles.chevronContainer}>
          <Ionicons name="chevron-forward-circle" size={24} color="#0084ff" />
        </View>
      </TouchableOpacity>

      {/* Gallery Modal - scrollable list of reposters */}
      <Modal
        visible={showGallery}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGallery(false)}
      >
        <BlurView intensity={90} tint="dark" style={styles.galleryOverlay}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>Who Shared This</Text>
            <TouchableOpacity onPress={() => setShowGallery(false)}>
              <Ionicons name="close" size={28} color="#fff" />
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
            <View style={styles.previewBar}>
              <Text style={styles.previewText} numberOfLines={1}>
                Replying to: {postContent}
              </Text>
            </View>
          )}
        </BlurView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  circleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 132, 255, 0.03)',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 132, 255, 0.1)',
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
    backgroundColor: 'rgba(0, 132, 255, 0.1)',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarWrapper: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    ...createShadow({ width: 0, height: 2, opacity: 0.2, radius: 4, elevation: 3 }),
  },
  stackAvatar: {
    width: 36, height: 36, borderRadius: 18,
  },
  avatarPlaceholderSmall: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsSmall: {
    fontSize: 12, fontWeight: '600', color: '#666',
  },
  moreBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 12, fontWeight: '700', color: '#fff',
  },
  textContainer: { flex: 1 },
  circleText: { fontSize: 13, color: '#444' },
  boldText: { fontWeight: '700', color: '#1a1a1a' },
  circleSubtext: { fontSize: 11, color: '#666', marginTop: 2 },
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
    fontSize: 24, fontWeight: '700', color: '#fff',
  },
  galleryList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  galleryCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    marginBottom: 12,
    ...createShadow({ width: 0, height: 4, opacity: 0.2, radius: 8, elevation: 5 }),
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
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 16, fontWeight: '600', color: '#666',
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  cardTime: { fontSize: 11, color: '#666', marginTop: 2 },
  tagPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8,
  },
  tagText: { fontSize: 11, fontWeight: '600' },
  messageButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0, 132, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12, padding: 12, position: 'relative',
  },
  quoteMark: { position: 'absolute', top: 4, left: 8 },
  quoteText: { fontSize: 24, color: '#999', fontWeight: '700' },
  noteText: { fontSize: 13, color: '#333', marginLeft: 12, lineHeight: 18 },
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