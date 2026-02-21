// components/Space/MorphingSpace.tsx
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import CollaborationService from '@/services/ChatScreen/CollaborationService';

interface MorphingSpaceProps {
  spaceId: string;
  currentType: string;
  onMorphComplete: (newType: string) => void;
}

export const MorphingSpace: React.FC<MorphingSpaceProps> = ({
  spaceId,
  currentType,
  onMorphComplete,
}) => {
  const [isMorphing, setIsMorphing] = useState(false);
  const [suggestedTypes, setSuggestedTypes] = useState<string[]>([]);
  const morphAnim = useRef(new Animated.Value(0)).current;
  const collaborationService = CollaborationService.getInstance();

  // AI suggests when to morph
  useEffect(() => {
    checkForMorphSuggestions();
  }, [currentType]);

  const checkForMorphSuggestions = async () => {
    const analysis = await collaborationService.queryAI(spaceId,
      "Analyze current activity and suggest space type morphs", {
      current_type: currentType,
      action: 'morph_suggestion'
    }
    );

    if (analysis.suggested_morphs) {
      setSuggestedTypes(analysis.suggested_morphs);
    }
  };

  const initiateMorph = async (newType: string) => {
    setIsMorphing(true);

    // Haptic sequence: build anticipation
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Transform animation
    Animated.sequence([
      Animated.timing(morphAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(morphAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      // Update backend
      await collaborationService.updateSpace(spaceId, { space_type: newType });

      // Haptic confirmation
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      onMorphComplete(newType);
      setIsMorphing(false);
    });
  };

  const renderMorphButton = () => (
    <TouchableOpacity
      style={styles.morphButton}
      onPress={() => setIsMorphing(!isMorphing)}
    >
      <Animated.View style={{
        transform: [{
          rotate: morphAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg']
          })
        }]
      }}>
        <Ionicons name="sync" size={24} color="#fff" />
      </Animated.View>
    </TouchableOpacity>
  );

  const renderMorphChoices = () => (
    <Animated.View style={[
      styles.morphChoices,
      {
        opacity: morphAnim,
        transform: [{
          scale: morphAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.5, 1]
          })
        }]
      }
    ]}>
      {['whiteboard', 'meeting', 'brainstorm', 'document', 'voice_channel'].map((type) => (
        <TouchableOpacity
          key={type}
          style={[styles.morphChoice, type === currentType && styles.currentType]}
          onPress={() => initiateMorph(type)}
        >
          <Ionicons name={getIconForType(type)} size={32} color="#fff" />
          <Text style={styles.morphText}>{type}</Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {renderMorphButton()}
      {isMorphing && renderMorphChoices()}
    </View>
  );
};