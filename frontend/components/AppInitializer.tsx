// components/AppInitializer.tsx
import { useEffect, useRef, useContext, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { usePostStore } from '@/stores/postStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { getToken } from '@/services/TokenService';
import { fetchPosts } from '@/services/PostService';
import { fetchStories } from '@/services/StoryService';
import AuthContext from '@/context/AuthContext';

interface AppInitializerProps {
  children: React.ReactNode;
}

export const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  const { user } = useContext(AuthContext);
  const { initializeRealtime: initPostRealtime, disconnectRealtime: disconnectPostRealtime, setPosts } = usePostStore();
  const { 
    initializeRealtime: initNotificationRealtime, 
    disconnectRealtime: disconnectNotificationRealtime,
    setCurrentUserId 
  } = useNotificationStore();
  
  const initialized = useRef(false);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      // Prevent multiple initializations
      if (initialized.current || !user?.id) {
        return;
      }

      try {
        setIsInitializing(true);
        console.log('🚀 APP INITIALIZATION STARTED for user:', user.id);
        
        const token = await getToken();
        if (!token || !isMounted) return;

        // ✅ Load all initial data in parallel
        const [postsData, storiesData] = await Promise.all([
          fetchPosts(),
          fetchStories()
        ]);

        if (!isMounted) return;

        // ✅ Update stores with initial data
        setPosts(postsData);
        // If you have a story store, set it here:
        // useStoryStore.getState().setStories(storiesData);

        // ✅ SUBSCRIBE TO POSTS FOR REAL-TIME UPDATES
        const postIds = postsData.map(post => post.id);
        usePostStore.getState().subscribeToPosts(postIds);
        
        // ✅ Initialize real-time systems
        initPostRealtime(token);
        initNotificationRealtime(token, user.id);
        setCurrentUserId(user.id);

        initialized.current = true;
        console.log('✅ APP INITIALIZATION COMPLETE');
        
      } catch (error) {
        console.error('❌ App initialization failed:', error);
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    initializeApp();

    return () => {
      isMounted = false;
      if (initialized.current) {
        console.log('🧹 Cleaning up app initialization...');
        disconnectPostRealtime();
        disconnectNotificationRealtime();
        initialized.current = false;
      }
    };
  }, [user?.id]); // Only re-run when user ID changes

  // Show loading indicator during initialization
  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Loading app...</Text>
      </View>
    );
  }

  return <>{children}</>;
};