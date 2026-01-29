// components/Magic/QuantumEntanglement.tsx
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

interface QuantumEvent {
  id: string;
  type: 'echo' | 'synchronicity' | 'breakthrough' | 'entanglement';
  data: any;
  probability: number;
  superpositions: string[];
}

export const QuantumEntanglement: React.FC<{ spaceId: string }> = ({ spaceId }) => {
  const [events, setEvents] = useState<QuantumEvent[]>([]);
  const [entangledUsers, setEntangledUsers] = useState<Set<string>>(new Set());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [sound, setSound] = useState<Audio.Sound>();

  useEffect(() => {
    loadQuantumEvents();
    initQuantumSound();
  }, []);

  const initQuantumSound = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require('@/assets/quantum-ambient.mp3')
    );
    setSound(sound);
    await sound.playAsync();
    
    // Fade in/out based on activity
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const createEntanglement = async (userId1: string, userId2: string) => {
    // When two users are entangled, their actions sync
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    setEntangledUsers(prev => new Set([...prev, userId1, userId2]));
    
    // Create quantum event
    const event: QuantumEvent = {
      id: `entangle-${Date.now()}`,
      type: 'entanglement',
      data: { userId1, userId2 },
      probability: 0.9,
      superpositions: ['synced-cursor', 'shared-ideas', 'mirror-actions'],
    };
    
    setEvents(prev => [event, ...prev]);
    
    // Visual effect
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 2, duration: 200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const collapseWaveFunction = async (eventId: string, choice: string) => {
    // User makes a choice, collapsing quantum possibilities
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    setEvents(prev => prev.map(event => 
      event.id === eventId 
        ? { ...event, probability: 1, superpositions: [choice] }
        : event
    ));
  };

  const triggerTimeEcho = async () => {
    // Resurface meaningful past moments
    const echoEvent: QuantumEvent = {
      id: `echo-${Date.now()}`,
      type: 'echo',
      data: {
        originalTimestamp: '2 days ago',
        content: 'Remember when we decided on the project name?',
        emotionalWeight: 0.8,
      },
      probability: 0.7,
      superpositions: ['happy-memory', 'lesson-learned', 'inspiration'],
    };
    
    setEvents(prev => [echoEvent, ...prev]);
    
    // Play echo sound
    if (sound) {
      await sound.replayAsync();
    }
  };

  const renderQuantumOrb = (event: QuantumEvent) => (
    <Animated.View
      key={event.id}
      style={[
        styles.quantumOrb,
        {
          transform: [{ scale: pulseAnim }],
          opacity: event.probability,
        }
      ]}
    >
      <TouchableOpacity
        style={styles.orbTouchable}
        onPress={() => collapseWaveFunction(event.id, event.superpositions[0])}
      >
        <Ionicons 
          name={getQuantumIcon(event.type)} 
          size={24} 
          color={getQuantumColor(event.type)} 
        />
        
        {/* Probability wave visualization */}
        <View style={styles.probabilityWave}>
          {[0, 1, 2, 3, 4].map(i => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: Math.random() * 20 + 5,
                  opacity: 0.3 + Math.random() * 0.7,
                }
              ]}
            />
          ))}
        </View>
      </TouchableOpacity>
      
      {/* Superposition choices */}
      <View style={styles.superpositionChoices}>
        {event.superpositions.map((choice, index) => (
          <TouchableOpacity
            key={index}
            style={styles.superpositionChoice}
            onPress={() => collapseWaveFunction(event.id, choice)}
          >
            <Text style={styles.choiceText}>{choice}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {/* Entangled users visualization */}
      <View style={styles.entanglementVisualization}>
        {Array.from(entangledUsers).map(userId => (
          <View key={userId} style={styles.entangledUser}>
            <Text style={styles.userLabel}>👥 {userId}</Text>
          </View>
        ))}
      </View>

      {/* Quantum events */}
      <View style={styles.eventsContainer}>
        {events.map(renderQuantumOrb)}
      </View>

      {/* Controls */}
      <TouchableOpacity 
        style={styles.magicButton}
        onPress={triggerTimeEcho}
      >
        <Ionicons name="time" size={24} color="#fff" />
        <Text style={styles.buttonText}>Time Echo</Text>
      </TouchableOpacity>
    </View>
  );
};