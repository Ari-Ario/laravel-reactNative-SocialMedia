export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  createdAt: Date;
  userId?: number;
  postId?: number;
  commentId?: number;
  spaceId?: string;
  callId?: string;
  activityId?: number;
  avatar?: string;
}

export const NOTIFICATION_TYPES = {
  // Existing
  COMMENT: 'comment',
  REACTION: 'reaction',
  COMMENT_REACTION: 'comment_reaction',
  NEW_POST: 'new_post',
  POST_UPDATED: 'post_updated',
  POST_DELETED: 'post_deleted',
  NEW_FOLLOWER: 'new_follower',
  CHATBOT_TRAINING: 'chatbot_training',
  
  // New Chat Types
  SPACE_INVITATION: 'space_invitation',
  CALL_STARTED: 'call_started',
  NEW_MESSAGE: 'new_message',
  PARTICIPANT_JOINED: 'participant_joined',
  MAGIC_EVENT: 'magic_event',
  SCREEN_SHARE: 'screen_share',
  ACTIVITY_CREATED: 'activity_created',
  CALL_ENDED: 'call_ended',
  SPACE_UPDATED: 'space_updated',
};