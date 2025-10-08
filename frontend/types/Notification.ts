export interface Notification {
  id: string;
  type:
    | 'reaction'
    | 'post'
    | 'comment'
    | 'mention'
    | 'follow'
    | 'comment_reaction'
    | 'new_post'
    | 'new_follower'
    | 'chatbot_training'
    | 'post_updated'
    | 'post_deleted';
  title: string;
  message: string;
  data: any;
  userId: number;
  postId?: number;
  commentId?: number;
  isRead: boolean;
  createdAt: Date;
  avatar?: string;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isNotificationPanelVisible: boolean;
}