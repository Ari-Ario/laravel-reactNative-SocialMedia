import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore } from '@/stores/toastStore';

export const Toast = () => {
  const { message, visible, type, hideToast } = useToastStore();
  const { width } = useWindowDimensions();

  const getIcon = () => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'alert-circle';
      case 'info': return 'information-circle';
      default: return 'checkmark-circle';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success': return '#4ADE80';
      case 'error': return '#F87171';
      case 'info': return '#60A5FA';
      default: return '#4ADE80';
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <MotiView
          from={{ opacity: 0, translateY: -50, scale: 0.9 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          exit={{ opacity: 0, translateY: -20, scale: 0.9 }}
          style={[styles.container, { width: width - 40 }]}
        >
          <BlurView intensity={80} tint="dark" style={styles.blur}>
            <View style={[styles.indicator, { backgroundColor: getColor() }]} />
            <Ionicons name={getIcon()} size={24} color={getColor()} style={styles.icon} />
            <Text style={styles.text}>{message}</Text>
          </BlurView>
        </MotiView>
      )}
    </AnimatePresence>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 9999,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingLeft: 20,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  icon: {
    marginRight: 12,
  },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
});
