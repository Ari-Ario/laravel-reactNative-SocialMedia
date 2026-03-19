import { MotiView } from 'moti';
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { createShadow } from '@/utils/styles';
import getApiBaseImage from '@/services/getApiBaseImage';
import { LinearGradient } from 'expo-linear-gradient';

interface CuratorFrameProps {
  reposter: {
    id: number;
    name: string;
    profile_photo: string | null;
    avatar_url?: string | null;
    context_tag?: string;
    personal_note?: string;
    reactionPreview?: string[];
    created_at?: string;
  };
  children: React.ReactNode;
}

export const CuratorFrame = ({ reposter, children }: CuratorFrameProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const avatarUri = reposter.profile_photo
    ? `${getApiBaseImage()}/storage/${reposter.profile_photo}`
    : (reposter.avatar_url || undefined);

  const getTagColor = (tag?: string) => {
    if (!tag) return '#666';
    const tagMap: Record<string, string> = {
      '🔥': '#FF6B6B',
      '💡': '#4ECDC4',
      '🎯': '#45B7D1',
      '📚': '#96CEB4',
      '🎨': '#FFEAA7',
      '🤔': '#D4A5A5',
      '⚡': '#FF6CCB',
      '💎': '#845EC2',
      '❤️': '#FF4040',
      '🎉': '#FFD93D',
      '🎬': '#6C5CE7',
      '🎵': '#A8E6CF',
    };
    const emoji = tag?.split(' ')[0];
    return tagMap[emoji || ''] || '#666';
  };

  const tagColor = getTagColor(reposter.context_tag);

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95, translateY: 10 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 15 }}
      style={[
        styles.curatorFrame,
        isExpanded && styles.expandedFrame
      ]}
      onTouchStart={() => Platform.OS === 'web' && setIsHovered(true)}
      onTouchEnd={() => Platform.OS === 'web' && setIsHovered(false)}
    >
      {/* Gradient Border Effect */}
      {isHovered && (
        <LinearGradient
          colors={['#0084ff', '#00c6ff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        />
      )}

      {/* Top Bar - Curator's Identity */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setIsExpanded(!isExpanded)}
        style={styles.curatorHeader}
      >
        <View style={styles.curatorBadge}>
          {/* Avatar with Ring */}
          <View style={[styles.avatarRing, { borderColor: tagColor }]}>
            <Image
              source={{ uri: avatarUri }}
              style={styles.curatorAvatar}
            />
          </View>

          <View style={styles.curatorInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.curatorName}>{reposter.name}</Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#666"
              />
            </View>

            {reposter.context_tag && (
              <View style={[styles.curatorTag, { backgroundColor: tagColor + '15' }]}>
                <Text style={[styles.curatorTagText, { color: tagColor }]}>
                  {reposter.context_tag}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Original Post Container */}
      <View style={styles.originalPostContainer}>
        {children}
      </View>

      {/* Expandable Section - Personal Note */}
      {isExpanded && reposter.personal_note && (
        <MotiView
          from={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ type: 'timing', duration: 300 }}
          style={styles.expandableSection}
        >
          <BlurView intensity={20} tint="light" style={styles.noteBlur}>
            <View style={styles.noteContent}>
              <View style={styles.quoteIcon}>
                <Text style={styles.quoteText}>"</Text>
              </View>
              <Text style={styles.personalNote}>{reposter.personal_note}</Text>
              <View style={styles.noteFooter}>
                <Text style={styles.noteTime}>
                  {reposter.created_at ? new Date(reposter.created_at).toLocaleDateString() : 'Just now'}
                </Text>
                <TouchableOpacity style={styles.reactButton}>
                  <Ionicons name="heart-outline" size={16} color="#666" />
                  <Text style={styles.reactCount}>12</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </MotiView>
      )}

      {/* Quick Reaction Preview */}
      {reposter.reactionPreview && reposter.reactionPreview.length > 0 && (
        <View style={styles.reactionStrip}>
          {reposter.reactionPreview.map((emoji, index) => (
            <MotiView
              key={index}
              from={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 50 }}
              style={[styles.reactionBubble, { marginLeft: index > 0 ? -8 : 0 }]}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </MotiView>
          ))}
        </View>
      )}
    </MotiView>
  );
};

const styles = StyleSheet.create({
  curatorFrame: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginVertical: 12,
    marginHorizontal: 12,
    ...createShadow({
      width: 0,
      height: 6,
      opacity: 0.1,
      radius: 16,
      elevation: 6,
    }),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
    position: 'relative',
  },
  expandedFrame: {
    ...createShadow({
      width: 0,
      height: 12,
      opacity: 0.15,
      radius: 24,
      elevation: 10,
    }),
  },
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundImage: 'linear-gradient(45deg, #0084ff, #00c6ff)',
  },
  curatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  curatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  curatorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#fff',
  },
  curatorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  curatorName: {
    fontWeight: '700',
    fontSize: 14,
    color: '#1a1a1a',
  },
  curatorTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  curatorTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  originalPostContainer: {

    paddingTop: 8,
  },
  expandableSection: {
    overflow: 'hidden',
  },
  noteBlur: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  noteContent: {
    position: 'relative',
    paddingLeft: 24,
  },
  quoteIcon: {
    position: 'absolute',
    left: 0,
    top: -8,
  },
  quoteText: {
    fontSize: 40,
    color: '#999',
    fontWeight: '700',
  },
  personalNote: {
    fontSize: 14,
    color: '#4b5563', // gray-600
    lineHeight: 20,
    marginBottom: 12,
    fontStyle: 'italic',
    fontWeight: '400',
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  noteTime: {
    fontSize: 11,
    color: '#999',
  },
  reactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reactCount: {
    fontSize: 11,
    color: '#666',
  },
  reactionStrip: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginTop: -4,
  },
  reactionBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.1,
      radius: 4,
      elevation: 2,
    }),
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  reactionEmoji: {
    fontSize: 14,
  },
});