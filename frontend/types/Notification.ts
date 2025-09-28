export interface Notification {
  id: string;
  type: 'comment' | 'reaction' | 'post' | 'mention' | 'follow';
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