import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Animated, 
  Dimensions,
  Platform 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '@/constants/i18n';

const { width, height } = Dimensions.get('window');

interface MagicEventModalProps {
  visible: boolean;
  event: any;
  onClose: () => void;
}

export const MagicEventModal: React.FC<MagicEventModalProps> = ({ visible, event, onClose }) => {
  const { t } = useTranslation();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 40,
          friction: 7
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true
        }),
        Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 10000,
            useNativeDriver: true
          })
        )
      ]).start();
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [visible]);

  if (!event) return null;

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'space_created': return 'rocket';
      case 'emergence_check': return 'flash';
      case 'synchronicity': return 'infinite';
      case 'high_energy': return 'flame';
      default: return 'sparkles';
    }
  };

  const getEventTitle = (type: string) => {
    return t(`magic_event_${type}_title`, { defaultValue: t('magic_discovered_title') });
  };

  const getEventDescription = (type: string, data: any) => {
    if (data?.deduced_insight) {
      return data.deduced_insight;
    }
    // Fallback if no specific translation
    const defaultDesc = t('magic_event_generic_desc');
    return t(`magic_event_${type}_desc`, { defaultValue: defaultDesc });
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        
        <Animated.View 
          style={[
            styles.container,
            { 
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['#667EEA', '#764BA2', '#6B8DD6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Spinning Background Sparks */}
            <Animated.View style={[styles.sparksContainer, { transform: [{ rotate: rotation }] }]}>
              <Ionicons name="sparkles" size={200} color="rgba(255,255,255,0.1)" />
            </Animated.View>

            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <Ionicons name={getEventIcon(event.event_type) as any} size={60} color="#fff" />
              </View>

              <Text style={styles.title}>{getEventTitle(event.event_type)}</Text>
              <Text style={styles.description}>
                {getEventDescription(event.event_type, event.event_data)}
              </Text>

              {event.event_data && (
                <View style={styles.detailsBox}>
                  {event.event_data.pure_knowledge && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Pure Knowledge:</Text>
                      <Text style={[styles.detailValue, { fontStyle: 'italic', color: '#FFF3E0' }]}>{event.event_data.pure_knowledge}</Text>
                    </View>
                  )}
                  {event.event_data.confidence !== undefined && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Confidence:</Text>
                      <Text style={styles.detailValue}>{Math.round(event.event_data.confidence * 100)}%</Text>
                    </View>
                  )}
                  {Object.entries(event.event_data)
                    .filter(([key]) => key !== 'deduced_insight' && key !== 'pure_knowledge' && key !== 'confidence')
                    .map(([key, value]) => (
                      <View key={key} style={styles.detailRow}>
                        <Text style={styles.detailKey}>{key.replace(/_/g, ' ')}:</Text>
                        <Text style={styles.detailValue}>{String(value)}</Text>
                      </View>
                  ))}
                </View>
              )}

              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onClose();
                }}
              >
                <Text style={styles.closeButtonText}>{t('awesome')}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  gradient: {
    padding: 30,
    alignItems: 'center',
  },
  sparksContainer: {
    position: 'absolute',
    top: -50,
    left: -50,
    opacity: 0.5,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 25,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  detailKey: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  detailValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  closeButtonText: {
    color: '#764BA2',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
