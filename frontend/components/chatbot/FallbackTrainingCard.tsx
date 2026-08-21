import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Props {
  ticketId: number;
  branch?: string;
  colors: Record<string, string>;
  activeScheme?: string;
}

/**
 * FallbackTrainingCard
 *
 * Shown inside a bot message when the dialectical engine could NOT resolve
 * the thesis from existing axioms (is_fallback: true) and auto-created a
 * chatbot_training ticket.
 *
 * Only rendered for expert users (check done in parent MessageItem).
 */
const FallbackTrainingCard = memo(({ ticketId, branch, colors, activeScheme }: Props) => {
  const router = useRouter();
  const isDark = activeScheme === 'dark';

  const branchLabel = branch
    ? String(branch).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'General';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(255,152,0,0.12)' : 'rgba(255,152,0,0.08)',
          borderColor: '#FF9800',
        },
      ]}
      onPress={() =>
        router.push({
          pathname: '/chatbotTraining',
          params: { highlight: String(ticketId) },
        })
      }
    >
      <View style={styles.header}>
        <Ionicons name="flask-outline" size={15} color="#FF9800" style={styles.icon} />
        <Text style={[styles.title, { color: '#FF9800' }]}>
          🧪 New Thesis — Expert Review Needed
        </Text>
      </View>
      <View style={styles.row}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{branchLabel}</Text>
        </View>
        <Text style={[styles.ticketLabel, { color: colors.subtext || '#999' }]}>
          Ticket #{ticketId}
        </Text>
      </View>
      <Text style={[styles.action, { color: '#FF9800' }]}>
        Tap to review in Training Hub →
      </Text>
    </TouchableOpacity>
  );
});

FallbackTrainingCard.displayName = 'FallbackTrainingCard';

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    marginTop: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  badge: {
    backgroundColor: 'rgba(255,152,0,0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    color: '#FF9800',
    fontWeight: '500',
  },
  ticketLabel: {
    fontSize: 11,
  },
  action: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
});

export default FallbackTrainingCard;
