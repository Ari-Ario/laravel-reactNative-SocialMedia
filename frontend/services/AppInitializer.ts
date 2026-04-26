import { getToken } from '@/services/TokenService';
import PusherService from '@/services/PusherService';
import PushNotificationService from '@/services/PushNotificationService';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePostStore } from '@/stores/postStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useStoryStore } from '@/stores/storyStore';
import { useReportedContentStore } from '@/stores/reportedContentStore';

class AppInitializer {
  private static instance: AppInitializer;
  private isInitialized = false;
  private currentUserId: string | number | null = null;
  private currentToken: string | null = null;
  private isVerified: boolean | null = null;

  private constructor() {}

  public static getInstance(): AppInitializer {
    if (!AppInitializer.instance) {
      AppInitializer.instance = new AppInitializer();
    }
    return AppInitializer.instance;
  }

  public async initialize() {
    const authStore = useAuthStore.getState();
    const user = authStore.user;
    // Decisively fetch the token from TokenService to ensure it's always up-to-date
    const token = await getToken();
    const isVerified = !!user?.email_verified_at;

    // Guard: Only skip if fully initialized for this specific user, token, AND verification status
    if (!user || !token || (this.isInitialized && this.currentUserId === user.id && this.currentToken === token && this.isVerified === isVerified)) {
      return;
    }

    console.log(`🚀 [AppInitializer] Starting global initialization for user: ${user.name} (${user.id})`);

    try {
      this.currentUserId = user.id;
      this.currentToken = token;
      this.isVerified = isVerified;
      const numericUserId = Number(user.id);

      // 1. Initialize core services once
      PusherService.initialize(token);
      PushNotificationService.initialize();

      // 2. Initialize stores with the token/userId
      // We do this surgically so stores don't have to listen to effects
      
      // Notifications
      const notificationStore = useNotificationStore.getState();
      notificationStore.setCurrentUserId(numericUserId);
      notificationStore.initializeRealtime(token, numericUserId, isVerified);

      // Posts & Stories
      usePostStore.getState().initializeRealtime(token);
      useStoryStore.getState().initializeRealtime();

      // 3. Pre-fetch essential data in background (coalesced)
      await Promise.all([
        useCollaborationStore.getState().fetchUserSpaces(numericUserId),
        useReportedContentStore.getState().fetchReportedContent()
      ]);

      this.isInitialized = true;
      console.log('✅ [AppInitializer] All systems ready');
    } catch (error) {
      console.error('❌ [AppInitializer] Initialization failed:', error);
      this.isInitialized = false;
    }
  }

  public reset() {
    console.log('🧹 [AppInitializer] Resetting services...');
    PusherService.disconnect();
    usePostStore.getState().disconnectRealtime();
    useNotificationStore.getState().disconnectRealtime();
    useCollaborationStore.getState().unsubscribeFromAllSpaces();
    
    this.isInitialized = false;
    this.currentUserId = null;
    this.currentToken = null;
    this.isVerified = null;
  }
}

export default AppInitializer.getInstance();
