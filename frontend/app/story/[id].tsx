import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import StoryViewer from '@/components/StoryViewer';
import { fetchStories, markStoryAsViewed, fetchStory } from '@/services/StoryService';

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
}

export default function StoryScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStories = async () => {
      try {
        setLoading(true);
        const data = await fetchStories();
        
        // Order: groups with unviewed stories first, then viewed
        const orderedGroups = [...data].sort((a, b) => 
          a.all_viewed === b.all_viewed ? 0 : a.all_viewed ? 1 : -1
        );
        
        setStoryGroups(orderedGroups);
        
        // Find the group containing the requested story
        const groupIndex = orderedGroups.findIndex(group => 
          group.stories.some(story => story.id.toString() === id)
        );
        
        if (groupIndex !== -1) {
          setCurrentGroupIndex(groupIndex);
        } else {
          router.back();
        }
      } catch (error) {
        console.error('Error loading stories:', error);
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadStories();
  }, [id]);

  const handleClose = () => {
    router.back();
  };

// Modify the handleNext and handlePrev functions to ensure stories are marked as viewed
const handleNextUser = async () => {
    if (currentGroupIndex < storyGroups.length - 1) {
        // Mark current story as viewed before moving
        try {
            await markStoryAsViewed(storyGroups[currentGroupIndex].stories[currentStoryIndex].id);
        } catch (error) {
            console.error('Error marking story as viewed:', error);
        }
        
        setCurrentGroupIndex(currentGroupIndex + 1);
        router.setParams({ id: storyGroups[currentGroupIndex + 1].stories[0].id.toString() });
    } else {
        handleClose();
    }
};

const handlePrevUser = async () => {
    if (currentGroupIndex > 0) {
        // Mark current story as viewed before moving
        try {
            await markStoryAsViewed(storyGroups[currentGroupIndex].stories[currentStoryIndex].id);
        } catch (error) {
            console.error('Error marking story as viewed:', error);
        }
        
        setCurrentGroupIndex(currentGroupIndex - 1);
        router.setParams({ id: storyGroups[currentGroupIndex - 1].stories[0].id.toString() });
    }
};

  if (loading || !storyGroups.length) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  const currentGroup = storyGroups[currentGroupIndex];
  const initialStoryId = currentGroup.stories.find(story => story.id.toString() === id)?.id || 
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