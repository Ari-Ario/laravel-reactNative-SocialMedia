// utils/groupNotifications.ts
// Instagram-style notification grouping for all notification panels.
// NotificationPanel uses individual items (per user request).
// All sub-panels (Calls, Messages, Spaces, Activities) use grouped cards.

import { Notification } from '@/types/Notification';

export interface NotificationGroup {
  /** Unique key for this group */
  key: string;
  /** Notification type that defines this group */
  type: string;
  /** Space ID this group is associated with (if any) */
  spaceId?: string;
  /** Post ID this group is associated with (if any) */
  postId?: number | string;
  /** Space name/title (extracted from latest notification) */
  spaceName?: string;
  /** The most-recent notification — use its time, avatar, message for primary display */
  latestNotification: Notification;
  /** How many total notifications are in this group */
  count: number;
  /** Up to 3 unique actor names for display (e.g. "Alice, Bob, and 3 more") */
  actorNames: string[];
  /** Up to 3 unique actor avatars (stacked) */
  actorAvatars: Array<string | undefined>;
  /** True if any notification in the group is unread */
  hasUnread: boolean;
  /** All raw notifications in this group (for navigation / mark-read) */
  notifications: Notification[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a display name from a notification */
const extractActorName = (n: Notification): string => {
  // Try progressively more generic sources
  return (
    n.data?.userName as string ||
    n.data?.callerName as string ||
    n.data?.user?.name as string ||
    n.data?.follower?.name as string ||
    n.data?.inviter_name as string ||
    n.title?.replace(/^(New |Incoming |Missed )/, '') ||
    'Someone'
  );
};

/** Extract space title from a notification */
const extractSpaceName = (n: Notification): string | undefined => {
  return (
    n.data?.space?.title as string ||
    n.data?.space_title as string ||
    n.data?.spaceTitle as string ||
    undefined
  );
};

/** Compute the grouping key for a notification */
const getGroupKey = (n: Notification): string => {
  const { type, spaceId, postId, userId } = n;

  // Calls: group by space + type-class
  if (type === 'call_started' || type === 'incoming_call' || type === 'call_ended') {
    return `calls::${spaceId || 'no-space'}`;
  }

  // Messages: group by space
  if (
    type === 'new_message' ||
    type === 'message_reaction' ||
    type === 'message_reply' ||
    type === 'message_deleted' ||
    type === 'space_message'
  ) {
    return `messages::${spaceId || 'no-space'}`;
  }

  // Space-related: group by space
  if (
    type === 'space-invitation' ||
    type === 'space_invitation' ||
    type === 'space-updated' ||
    type === 'space_updated' ||
    type === 'space-created' ||
    type === 'space_created' ||
    type === 'space-deleted' ||
    type === 'space_deleted'
  ) {
    return `spaces::${spaceId || 'no-space'}`;
  }

  // Activity: group by space + type
  if (type === 'participant_joined' || type === 'participant_left') {
    return `activity::${type}::${spaceId || 'no-space'}`;
  }

  if (type === 'magic_event') {
    return `magic::${spaceId || 'no-space'}`;
  }

  if (type === 'screen_share') {
    return `screen_share::${spaceId || 'no-space'}`;
  }

  if (
    type === 'activity_created' ||
    type === 'activity_updated' ||
    type === 'activity_deleted'
  ) {
    return `activity::${type}::${spaceId || 'no-space'}`;
  }

  // Post-related: group by post
  if (type === 'comment' || type === 'comment_reaction' || type === 'comment_deleted') {
    return `comments::${postId || 'no-post'}`;
  }

  if (type === 'reaction') {
    return `reactions::${postId || 'no-post'}`;
  }

  if (type === 'new_post' || type === 'post_updated' || type === 'post_deleted') {
    return `posts::${type}::${userId || 'no-user'}`;
  }

  // Follower: group by actor (rarely more than 1, but safe)
  if (type === 'new_follower') {
    return `follower::${userId || 'no-user'}`;
  }

  // Default: each is its own group
  return `unique::${n.id}`;
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Groups a flat array of notifications into NotificationGroup[].
 * Sorts groups by the most recent notification inside (newest first).
 */
export function groupNotifications(notifications: Notification[]): NotificationGroup[] {
  if (!notifications || notifications.length === 0) return [];

  // Sort input newest-first so the first item we encounter is the latest
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const groupMap = new Map<string, NotificationGroup>();

  for (const n of sorted) {
    const key = getGroupKey(n);

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        type: n.type,
        spaceId: n.spaceId,
        postId: n.postId,
        spaceName: extractSpaceName(n),
        latestNotification: n, // first encountered = most recent
        count: 0,
        actorNames: [],
        actorAvatars: [],
        hasUnread: false,
        notifications: [],
      });
    }

    const group = groupMap.get(key)!;
    group.count++;
    group.notifications.push(n);

    if (!n.isRead) group.hasUnread = true;

    // Collect up to 3 unique actors
    const actorName = extractActorName(n);
    if (!group.actorNames.includes(actorName)) {
      group.actorNames.push(actorName);
    }
    if (group.actorAvatars.length < 3) {
      const av = n.avatar;
      if (av && !group.actorAvatars.includes(av)) {
        group.actorAvatars.push(av);
      } else if (!av) {
        group.actorAvatars.push(undefined);
      }
    }

    // spaceName from first found
    if (!group.spaceName) {
      group.spaceName = extractSpaceName(n);
    }
  }

  // Return as array sorted by latest notification time
  return Array.from(groupMap.values()).sort(
    (a, b) =>
      new Date(b.latestNotification.createdAt).getTime() -
      new Date(a.latestNotification.createdAt).getTime()
  );
}

/**
 * Build a human-readable summary message for a group.
 */
export function getGroupSummary(group: NotificationGroup, t: (key: string, params?: any) => string): string {
  const { type, count, actorNames, spaceName, latestNotification } = group;
  const actors = actorNames.slice(0, 2).join(', ');
  const extra = actorNames.length > 2 ? actorNames.length - 2 : 0;

  if (type === 'call_started' || type === 'incoming_call' || type === 'call_ended') {
    if (count === 1) return latestNotification.message || t('incoming_call_title');
    return t('n_calls_from', { count, space: spaceName || t('calls') });
  }

  if (type === 'new_message' || type === 'message_reply' || type === 'message_reaction' || type === 'space_message') {
    if (count === 1) return latestNotification.message || t('n_messages_in', { count: 1, space: spaceName || '' });
    return t('n_messages_in', { count, space: spaceName || t('messages') });
  }

  if (type === 'participant_joined') {
    if (count === 1) return latestNotification.message || t('n_people_joined', { count: 1, space: spaceName || '' });
    return t('n_people_joined', { count, space: spaceName || t('activities') });
  }

  if (type === 'participant_left') {
    if (count === 1) return latestNotification.message || t('n_people_left', { count: 1, space: spaceName || '' });
    return t('n_people_left', { count, space: spaceName || t('activities') });
  }

  if (type === 'reaction') {
    if (count === 1) return latestNotification.message || t('n_reactions_on_post', { count: 1 });
    return t('n_reactions_on_post', { count });
  }

  if (type === 'comment' || type === 'comment_reaction') {
    if (count === 1) return latestNotification.message || t('n_comments_on_post', { count: 1 });
    return t('n_comments_on_post', { count });
  }

  // Default: use the latest message
  return latestNotification.message || t('tap_to_view');
}

/**
 * Returns the IDs of all notifications in a group (for mark-as-read).
 */
export function getGroupNotificationIds(group: NotificationGroup): string[] {
  return group.notifications.map(n => n.id);
}
