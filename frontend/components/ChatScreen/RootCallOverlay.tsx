import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCall } from '@/context/CallContext';
import ImmersiveCallView from './ImmersiveCallView';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MINIMIZED_WIDTH = Platform.OS === 'web' ? 320 : 150;
const MINIMIZED_HEIGHT = Platform.OS === 'web' ? 180 : 220;

export const RootCallOverlay: React.FC = () => {
  const { activeCall, isMinimized, minimizeCall, maximizeCall, callPosition, updateCallPosition, endCall } = useCall();
  const insets = useSafeAreaInsets();
  
  const pan = useRef(new Animated.ValueXY(callPosition)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // Animate between full screen and Pip
  useEffect(() => {
    if (!isMinimized) {
      // Return to full screen position
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
        tension: 40,
        friction: 7
      }).start();
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true
      }).start();
    } else {
      // Go to saved Pip position
      Animated.spring(pan, {
        toValue: callPosition,
        useNativeDriver: true,
        tension: 40,
        friction: 7
      }).start();
    }
  }, [isMinimized]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isMinimized,
      onMoveShouldSetPanResponder: () => isMinimized,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        Animated.spring(scale, { toValue: 1.05, useNativeDriver: true }).start();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

        let newX = (pan.x as any)._value;
        let newY = (pan.y as any)._value;

        // Constrain to screen bounds
        newX = Math.min(Math.max(newX, 10), SCREEN_WIDTH - MINIMIZED_WIDTH - 10);
        newY = Math.min(Math.max(newY, insets.top + 50), SCREEN_HEIGHT - MINIMIZED_HEIGHT - 100);

        updateCallPosition(newX, newY);
        pan.setValue({ x: newX, y: newY });
      },
    })
  ).current;

  if (!activeCall) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        {...(isMinimized ? panResponder.panHandlers : {})}
        style={[
          isMinimized ? styles.minimizedContainer : styles.fullScreenContainer,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: scale },
            ],
          },
          !isMinimized && {
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT,
          },
          { zIndex: 9999 }
        ]}
      >
        <TouchableOpacity
          activeOpacity={isMinimized ? 0.9 : 1}
          onPress={isMinimized ? maximizeCall : undefined}
          style={styles.containerTouchable}
          disabled={!isMinimized}
        >
          <ImmersiveCallView
            spaceId={activeCall.spaceId}
            spaceType={activeCall.spaceType as any}
            isMinimized={isMinimized}
            onToggleMinimize={isMinimized ? maximizeCall : minimizeCall}
          />

          {isMinimized && (
            <>
              {/* Controls Overlay for Minimized View */}
              <View style={styles.minimizedControls}>
                <TouchableOpacity
                  style={styles.minimizedButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    maximizeCall();
                  }}
                >
                  <Ionicons name="expand" size={14} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Drag Handle Area */}
              <View style={styles.dragHandle}>
                <View style={styles.dragHandleBar} />
              </View>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 9998,
  },
  minimizedContainer: {
    position: 'absolute',
    width: MINIMIZED_WIDTH,
    height: MINIMIZED_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    zIndex: 9999,
    ...Platform.select({
      web: {
        // @ts-ignore
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        cursor: 'auto',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
      },
    }),
  },
  containerTouchable: {
    flex: 1,
  },
  minimizedControls: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
    zIndex: 100,
  },
  minimizedButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 101,
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});
