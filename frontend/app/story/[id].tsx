import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import StoryViewer from '@/components/StoryViewer';
import { fetchStories, markStoryAsViewed, fetchStory } from '@/services/StoryService';
import { useStoryStore } from '@/stores/storyStore';

interface StoryGroup {
  user: {
    id: number;
    name: string;
    profile_photo: string;
  };
  stories: Array<{
    id: number;
    media_path: string;
    viewed: boolean;
  }>;
  all_viewed: boolean;
  latest_story: any;
}

export default function StoryScreen() {
  const { id, standalone, returnTo } = useLocalSearchParams();
  const router = useRouter();
  const { storyGroups, fetchStories: fetchStoriesFromStore, initializeRealtime } = useStoryStore();
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Initialize real-time when entering story screen
  useEffect(() => {
    initializeRealtime();
  }, []);

  useEffect(() => {
    const loadStories = async () => {
      try {
        setLoading(true);

        if (standalone === 'true') {
          // Keep standalone logic for single story deep links if needed, 
          // but usually we want the full experience.
          const storyData = await fetchStory(Number(id));
          const singleGroup: StoryGroup = {
            user: storyData.user,
            stories: [storyData],
            all_viewed: storyData.viewed,
            latest_story: storyData
          };
          // Note: We don't set the global store for standalone to avoid polluting it 
          // with potentially filtered data, but for this screen we use it.
          // Since we want real-time, it's better to just use the store if possible.
        } else {
          if (storyGroups.length === 0) {
            await fetchStoriesFromStore();
          }

          const groups = useStoryStore.getState().storyGroups;

          // Order: groups with unviewed stories first, then viewed
          const orderedGroups = [...groups].sort((a, b) =>
            a.all_viewed === b.all_viewed ? 0 : a.all_viewed ? 1 : -1
          );

          // Find the group containing the requested story
          const groupIndex = orderedGroups.findIndex(group =>
            group.stories.some((story: any) => story.id.toString() === id)
          );

          if (groupIndex !== -1) {
            setCurrentGroupIndex(groupIndex);
          } else if (groups.length > 0) {
            // If story not found but we have groups, just show the first unviewed
            setCurrentGroupIndex(0);
          } else {
            router.back();
          }
        }
      } catch (error) {
        console.error('Error loading stories:', error);
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadStories();
  }, [id, standalone, storyGroups.length]);

  const handleClose = () => {
    if (returnTo) {
      router.replace(returnTo as any);
    } else {
      router.back();
    }
  };

  const handleNextUser = async (currentIndex?: number) => {
    const groups = useStoryStore.getState().storyGroups;
    if (currentGroupIndex < groups.length - 1) {
      try {
        if (currentIndex !== undefined) {
          await markStoryAsViewed(groups[currentGroupIndex].stories[currentIndex].id);
        }
      } catch (error) {
        console.error('Error marking story as viewed:', error);
      }

      const nextGroup = groups[currentGroupIndex + 1];
      setCurrentGroupIndex(currentGroupIndex + 1);
      router.setParams({ id: nextGroup.latest_story.id.toString() });
    } else {
      handleClose();
    }
  };

  const handlePrevUser = async (currentIndex?: number) => {
    const groups = useStoryStore.getState().storyGroups;
    if (currentGroupIndex > 0) {
      try {
        if (currentIndex !== undefined) {
          await markStoryAsViewed(groups[currentGroupIndex].stories[currentIndex].id);
        }
      } catch (error) {
        console.error('Error marking story as viewed:', error);
      }

      const prevGroup = groups[currentGroupIndex - 1];
      setCurrentGroupIndex(currentGroupIndex - 1);
      router.setParams({ id: prevGroup.latest_story.id.toString() });
    }
  };

  if (loading || !storyGroups.length) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  // Modify the initialStoryId selection logic (around line 76)
  const currentGroup = storyGroups[currentGroupIndex];
  const initialStoryId = currentGroup.stories.find(story => story.id.toString() === id)?.id ||
    currentGroup.stories.find(story => !story.viewed)?.id ||
    currentGroup.stories[0].id;

  return (
    <View style={styles.container}>
      <StoryViewer
        userId={currentGroup.user.id}
        initialStoryId={initialStoryId}
        onClose={handleClose}
        onNextUser={handleNextUser}
        onPrevUser={handlePrevUser}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
});