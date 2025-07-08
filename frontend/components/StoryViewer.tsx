import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Animated, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { markStoryAsViewed, fetchUserStories } from '@/services/StoryService';
import getApiBaseImage from '@/services/getApiBaseImage';

const { width } = Dimensions.get('window');
const STORY_DURATION = 10000; // 10 seconds

interface StoryViewerProps {
  userId: number;
  initialStoryId: number;
  onClose: () => void;
  onNextUser: () => void;
  onPrevUser: () => void;
}

const StoryViewer = ({ userId, initialStoryId, onClose, onNextUser, onPrevUser }: StoryViewerProps) => {
  const [stories, setStories] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const router = useRouter();

  // Load all stories for this user
  useEffect(() => {
    const loadStories = async () => {
      try {
        setLoading(true);
        const data = await fetchUserStories(userId);
        setStories(data);
        
        // Find the index of the initial story
        const initialIndex = data.findIndex(story => story.id === initialStoryId);
        setCurrentStoryIndex(initialIndex !== -1 ? initialIndex : 0);
      } catch (error) {
        console.error('Error loading stories:', error);
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadStories();
  }, [userId]);

  // Mark story as viewed when it's displayed
  useEffect(() => {
    if (!loading && stories.length > 0 && currentStoryIndex >= 0) {
      const currentStory = stories[currentStoryIndex];
      if (currentStory && !currentStory.viewed) {
        markStoryAsViewed(currentStory.id)
          .then(() => {
            // Update local state to reflect viewed status
            setStories(prevStories => 
              prevStories.map((story, idx) => 
                idx === currentStoryIndex ? { ...story, viewed: true } : story
              )
            );
          })
          .catch(error => {
            console.error('Error marking story as viewed:', error);
          });
      }
    }
  }, [currentStoryIndex, loading, stories]);

  // Handle story progression
  useEffect(() => {
    if (loading || stories.length === 0 || paused) return;

    // Reset animation
    progressAnim.setValue(0);

    // Start progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        handleNext();
      }
    });

    return () => {
      progressAnim.stopAnimation();
      clearInterval(timerRef.current);
    };
  }, [currentStoryIndex, stories, paused]);

  const currentStory = stories[currentStoryIndex];

  const handleNext = () => {
    if (currentStoryIndex < stories.length - 1) {
      // Move to next story from this user
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else {
      // No more stories from this user, move to next user
      onNextUser();
    }
  };

  const handlePrev = () => {
    if (currentStoryIndex > 0) {
      // Move to previous story from this user
      setCurrentStoryIndex(currentStoryIndex - 1);
    } else {
      // No more stories from this user, move to previous user
      onPrevUser();
    }
  };

  const togglePause = () => {
    setPaused(!paused);
  };

  const handleSwipe = (evt) => {
    const { nativeEvent } = evt;
    const touchX = nativeEvent.pageX;
    const screenThird = width / 3;

    if (touchX < screenThird) {
      handlePrev();
    } else if (touchX > screenThird * 2) {
      handleNext();
    } else {
      togglePause();
    }
  };

  if (loading || !currentStory) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress bars for all stories */}
      <View style={styles.progressBarsContainer}>
        {stories.map((story, index) => (
          <View key={story.id} style={styles.progressBarBackground}>
            {index === currentStoryIndex ? (
              <Animated.View 
                style={[
                  styles.progressBar,
                  { width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%']
                  })}
                ]}
              />
            ) : (
              <View style={[
                styles.progressBar,
                { 
                  width: `${index < currentStoryIndex ? 100 : 0}%`,
                  backgroundColor: index < currentStoryIndex ? '#fff' : 'rgba(255,255,255,0.3)'
                }
              ]} />
            )}
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image 
            source={{ uri: `${getApiBaseImage()}/storage/${currentStory.user.profile_photo}` }}
            style={styles.userImage}
          />
          <Text style={styles.username}>{currentStory.user.name}</Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Story content - Wrapped in new ScrollView container */}
      <View style={styles.scrollWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <TouchableOpacity 
            style={styles.contentContainer}
            activeOpacity={1}
            onPress={handleSwipe}
          >
            <Image 
              source={{ uri: `${getApiBaseImage()}/storage/${currentStory.media_path}` }}
              style={styles.storyImage}
              resizeMode="contain"
            />
            
            {currentStory.caption && (
              <View style={styles.captionContainer}>
                <Text style={styles.caption}>{currentStory.caption}</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TextInput
          style={styles.replyInput}
          placeholder="Send message"
          placeholderTextColor="rgba(255,255,255,0.7)"
        />
        <TouchableOpacity style={styles.sendButton}>
          <Ionicons name="send" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    width: '100%',
    maxWidth: 1024,
    alignSelf: 'center',
  },
  scrollWrapper: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  progressBarsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 2,
    paddingTop: 10,
    gap: 2,
  },
  progressBarBackground: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  username: {
    color: 'white',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  captionContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    padding: 20,
  },
  caption: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  replyInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: 'white',
    marginRight: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StoryViewer;