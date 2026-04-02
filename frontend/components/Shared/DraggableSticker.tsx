import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useSharedValue as useAnimatedSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Sticker } from './StoryTypes';

interface DraggableStickerProps {
  sticker: Sticker;
  isSelected: boolean;
  stickerAnimations: Map<string, any>;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onSetStickers: React.Dispatch<React.SetStateAction<Sticker[]>>;
  onDelete: (id: string) => void;
  onPressLocation?: (location: any) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const DraggableSticker: React.FC<DraggableStickerProps> = ({
  sticker,
  isSelected,
  stickerAnimations,
  onSelect,
  onUpdatePosition,
  onSetStickers,
  onDelete,
  onPressLocation,
}) => {
  const translateX = useSharedValue(sticker.x);
  const translateY = useSharedValue(sticker.y);
  const scale = useSharedValue(sticker.scale || 1);
  const rotation = useSharedValue(sticker.rotation || 0);

  useEffect(() => {
    translateX.value = sticker.x;
    translateY.value = sticker.y;
    scale.value = sticker.scale || 1;
    rotation.value = sticker.rotation || 0;
  }, [sticker.x, sticker.y, sticker.scale, sticker.rotation]);

  useEffect(() => {
    if (!stickerAnimations.has(sticker.id)) {
      stickerAnimations.set(sticker.id, { translateX, translateY, scale, rotation });
    }
    return () => {
      stickerAnimations.delete(sticker.id);
    };
  }, []);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .activeOffsetY([-5, 5])
    .minDistance(5)
    .onStart(() => {
      runOnJS(onSelect)(sticker.id);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((event) => {
      translateX.value = sticker.x + event.translationX;
      translateY.value = sticker.y + event.translationY;
    })
    .onEnd((event) => {
      const finalX = sticker.x + event.translationX;
      const finalY = sticker.y + event.translationY;
      runOnJS(onUpdatePosition)(sticker.id, finalX, finalY);
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = (sticker.scale || 1) * event.scale;
    })
    .onEnd(() => {
      runOnJS(onSetStickers)((prev: Sticker[]) => prev.map(s =>
        s.id === sticker.id ? { ...s, scale: scale.value } : s
      ));
    });

  const rotateGesture = Gesture.Rotation()
    .onUpdate((event) => {
      rotation.value = (sticker.rotation || 0) + event.rotation;
    })
    .onEnd(() => {
      runOnJS(onSetStickers)((prev: Sticker[]) => prev.map(s =>
        s.id === sticker.id ? { ...s, rotation: rotation.value } : s
      ));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(onDelete)(sticker.id);
    });

  const composed = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    rotateGesture,
    doubleTap
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: sticker.type === 'text' ? 0 : translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View 
        style={[
          styles.sticker, 
          sticker.type === 'text' && { width: '100%', left: 0 },
          animatedStyle
        ]}
      >
        <View style={[styles.stickerContent, sticker.type === 'text' && { width: '100%' }]}>
          {sticker.text !== '' && (
            <Text
              style={[
                styles.stickerText,
                {
                  color: sticker.color,
                  // Scale normalized font size back to current screen width
                  fontSize: sticker.fontSize ? (sticker.fontSize / 375) * SCREEN_WIDTH : 32,
                  lineHeight: sticker.fontSize ? (sticker.fontSize / 375) * SCREEN_WIDTH * 1.2 : 32 * 1.2,
                  fontFamily: sticker.fontFamily,
                  textAlign: 'center',
                  width: '100%',
                }
              ]}
            >
              {sticker.text}
            </Text>
          )}

          {sticker.location && (
            <TouchableOpacity onPress={() => onPressLocation?.(sticker.location)}>
              <BlurView intensity={80} tint="dark" style={styles.integratedLocationSticker}>
                <Ionicons name="location" size={14} color="#0084ff" />
                <Text style={styles.integratedLocationStickerText}>{sticker.location.name}</Text>
              </BlurView>
            </TouchableOpacity>
          )}

          {sticker.feeling && (
            <BlurView intensity={80} tint="dark" style={styles.integratedFeelingSticker}>
              <Text style={styles.integratedFeelingEmoji}>{sticker.feeling.emoji}</Text>
              <Text style={styles.integratedFeelingText}>{sticker.feeling.text}</Text>
            </BlurView>
          )}
        </View>
        {isSelected && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.stickerControls}
          >
            <TouchableOpacity
              style={[styles.stickerControl, styles.stickerDelete]}
              onPress={() => onDelete(sticker.id)}
            >
              <Ionicons name="close" size={16} color="white" />
            </TouchableOpacity>
          </MotiView>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  sticker: {
    position: 'absolute',
    padding: 10,
    minWidth: 50,
  },
  stickerText: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  stickerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  integratedLocationSticker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 6,
    overflow: 'hidden',
  },
  integratedLocationStickerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  integratedFeelingSticker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 6,
    overflow: 'hidden',
  },
  integratedFeelingEmoji: {
    fontSize: 16,
  },
  integratedFeelingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'lowercase',
  },
  stickerControls: {
    position: 'absolute',
    top: -30,
    right: 0,
    flexDirection: 'row',
    gap: 5,
  },
  stickerControl: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerDelete: {
    backgroundColor: '#FF3B30',
  },
});
