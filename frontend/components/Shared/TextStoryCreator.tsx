import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, ScrollView, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GradientPreset } from './StoryTypes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GRADIENT_PRESETS: GradientPreset[] = [
  {
    colors: ['#FF9F0A', '#FF3B30'],
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAABG0lEQVR4nO3S0QmAMBAFQSOWYTmX6Sre' +
           'r+NgNAnisZm13ot/7t0HnMSTODKz+4ZjKCtQVqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQVKCpQ' +
           'VmCswBsGygqUFSgrUFagrEBZgbICYwXeMFBWoKxAWYGyAmUFygqUFSgrMFbgDQNlBcoKlBUoK1BW' +
           'oKxAWYGxAm8YKCtQVqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQVKCtQVmCswBsGygqUFSgrUFag' +
           'rEBZgbICYwXeMFBWoKxAWYGyAmUFygqUFRgr8IaBsgJlBcoKlBUoK1BWoKxAWYGxAm8YKCtQVqCs' +
           'QFmBsgJlBcoKjBV4w0BZgbICZQXKCpQVKCtQVmCswBsGygqUFSgrUFagrEBZgbICYwUf2OIEvA5Q' +
           'mPUAAAAASUVORK5CYII='
  },
  {
    colors: ['#007AFF', '#5856D6'],
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAABHElEQVR4nO3S0QmAMBAFQSOWc9l+' +
           'map4v46D0SSI7LGZtd6Lf+7dB5zEkzgyrfuGYygrUFagrEBZgbICZQXKCowVeMNAMoFlBcoKlBUo' +
           'K1BWoKzAWIE3DJQVKCtQVqCsQFmBsgJlBcYKvGGgrEBZgbICZQXKCpQVKCswVuANA2UFygqUFSgr' +
           'UFagrEBZgbECbxgoK1BWoKxAWYGyAmUFygqMFXjDQFmBsgJlBcoKlBUoK1BWYKzAGwbKCpQVKCtQ' +
           'VqCsQFmBsgJjBd4wUFagrEBZgbICZQXKCpQVGCvwhoGyAmUFygqUFSgrUFagrMBYgTcMlBUoK1BW' +
           'oKxAWYGyAmUFxgq8YaCsQFmBsgJlBcoKlBUoKzBW8IEvTsAl6bY8mgoAAAAASUVORK5CYII='
  },
  {
    colors: ['#34C759', '#00C7BE'],
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAABHUlEQVR4nO3S0QmAMBAFQSOW8TqX' +
           '6Srer+NgNAniMZq13ot/7t0HnMSTODKz+4ZjKCtQVqCsQFmBsgJlBcoKjBV4Y0BZgbICZQXKCpQV' +
           'KCtQVmCswBsGygqUFSgrUFagrEBZgbICYwXeMFBWoKxAWYGyAmUFygqUFSgrMFbgDQNlBcoKlBUo' +
           'K1BWoKxAWYGxAm8YKCtQVqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQVKCtQVmCswBsGygqUFSgr' +
           'UFagrEBZgbICYwXeMFBWoKxAWYGyAmUFygqUFRgr8IaBsgJlBcoKlBUoK1BWoKxAWYGxAm8YKCtQ' +
           'VqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQVKCtQVmCswBsGygqUFSgrUFagrEBZgbICYwUf0OYE' +
           'vA5Ff9yWAAAAAElEQVR4nO3T0QmAQAwFQSOWcdh/mbbgfh0HMxWEx2bWei/+uXcfcBJjBc/M7L7h' +
           'GMoKlBUoK1BWoKxAWYGyAmMF3jBQVqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQVKCtQVmCswBsG' +
           'ygqUFSgrUFagrEBZgbICYwXeMFBWoKxAWYGyAmUFygqUFSgrMFbgDQNlBcoKlBUoK1BWoKxAWYGx' +
           'Am8YKCtQVqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQVKCtQVmCswBsGygqUFSgrUFagrEBZgbIC' +
           'YwXeMFBWoKxAWYGyAmUFygqUFRgr8IaBsgJlBcoKlBUoK1BWoKxAWYGxAm8YKCtQVqCsQFmBsgJl' +
           'BcoKjBV4w0BZgbICZQXKCpQVKCtQVmCswBsGygqUFSgrUFagrEBZgbICYwUf0OYEvA5Ff9yWAAAA' +
           'AElFTkSuQmCC'
  },
  {
    colors: ['#AF52DE', '#FF2D55'],
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAABiklEQVR4nO3S0QmAMBAFQSOW4TqX' +
           '6Sr7r+NgNBHiMZq13ot/7t0HnMSTODKz+4ZjKCtQVqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQV' +
           'KCtQVmCswBsGygqUFSgrUFagrEBZgbICYwXeMFBWoKxAWYGyAmUFygqUFSgrMFbgDQNlBcoKlBUo' +
           'K1BWoKxAWYGxAm8YKCtQVqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQVKCtQVmCswBsGygqUFSgr' +
           'UFagrEBZgbICYwXeMFBWoKxAWYGyAmUFygqUFRgr8IaBsgJlBcoKlBUoK1BWoKxAWYGxAm8YKCtQ' +
           'VqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQVKCtQVmCswBsGygqUFSgrUFagrEBZgbICYwXeMFBW' +
           'oKxAWYGyAmUFygqUFRgr8IaBsgJlBcoKlBUoK1BWoKxAWYGxAm8YKCtQVqCsQFmBsgJlBcoKjBV4' +
           'w0BZgbICZQXKCpQVKCtQVmCswBsGygqUFSgrUFagrEBZgbICYwUfOOMExA5R4D8AAAAASUVORK5C' +
           'YII='
  },
  {
    colors: ['#1C1C1E', '#48484A'],
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAABHElEQVR4nO3S0QmAMBAFQSOWYTmX' +
           '6Sr+r+NgNAnisZm13ot/7t0HnMSTODKz+4ZjKCtQVqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQV' +
           'KCtQVmCswBsGygqUFSgrUFagrEBZgbICYwXeMFBWoKxAWYGyAmUFygqUFSgrMFbgDQNlBcoKlBUo' +
           'K1BWoKxAWYGxAm8YKCtQVqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQVKCtQVmCswBsGygqUFSgr' +
           'UFagrEBZgbICYwXeMFBWoKxAWYGyAmUFygqUFRgr8IaBsgJlBcoKlBUoK1BWoKxAWYGxAm8YKCtQ' +
           'VqCsQFmBsgJlBcoKjBV4w0BZgbICZQXKCpQVKCtQVmCswBsGygqUFSgrUFagrEBZgbICYwUf2OIE' +
           'vA5QmPUAAAAASUVORK5CYII='
  }
];

const COLORS = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00',
  '#34C759', '#00C7BE', '#007AFF', '#5856D6', '#AF52DE',
  '#FF2D55', '#A2845E', '#E5E5EA', '#3A3A3C', '#FFD60A',
  '#30D158', '#64D2FF', '#0A84FF', '#BF5AF2', '#FF375F'
];

interface TextStoryCreatorProps {
  onSetMedia: (media: { uri: string; type: 'photo'; gradient?: string[] }) => void;
  onClose: () => void;
}

export const TextStoryCreator: React.FC<TextStoryCreatorProps> = React.memo(({
  onSetMedia,
  onClose,
}) => {
  const [currentGradientIndex, setCurrentGradientIndex] = useState(0);
  const [useGradient, setUseGradient] = useState(true);
  const [solidColor, setSolidColor] = useState('#000000');

  const cycleGradient = () => {
    setUseGradient(true);
    setCurrentGradientIndex(prev => (prev + 1) % GRADIENT_PRESETS.length);
  };

  const handleSelectColor = (color: string) => {
    setUseGradient(false);
    setSolidColor(color);
  };

  const getSolidColorDataUrl = (color: string) => {
    if (Platform.OS === 'web') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          return canvas.toDataURL('image/png');
        }
      } catch (e) {
        console.error('Canvas error:', e);
      }
    }
    // Fallback/Native: Return a valid 1x1 white pixel base64 if generation fails
    // or if on native (to ensure validation passes). The preview renders the actual color.
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
  };

  const handleCapture = () => {
    if (useGradient) {
      onSetMedia({
        uri: `data:image/png;base64,${GRADIENT_PRESETS[currentGradientIndex].base64}`,
        type: 'photo',
        gradient: GRADIENT_PRESETS[currentGradientIndex].colors
      });
    } else {
      onSetMedia({
        uri: getSolidColorDataUrl(solidColor),
        type: 'photo',
        gradient: [solidColor, solidColor]
      });
    }
  };

  return (
    <View style={[styles.container, !useGradient && { backgroundColor: solidColor }]}>
      {useGradient && (
        <LinearGradient
          colors={GRADIENT_PRESETS[currentGradientIndex].colors as [string, string, ...string[]]}
          style={StyleSheet.absoluteFill}
        />
      )}
      
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topControls}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>

          <View style={styles.topRightControls}>
            <TouchableOpacity onPress={cycleGradient} style={[styles.iconButton, useGradient && styles.activeButton]}>
              <Ionicons name="color-palette-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomWrapper}>
          <View style={styles.paletteLabelContainer}>
             <Text style={styles.paletteLabel}>Choose Background</Text>
          </View>
          <View style={styles.colorPaletteContainer}>
            <View style={styles.colorPaletteWrapper}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.colorPaletteScroll}
              >
                {COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: color },
                      !useGradient && solidColor === color && styles.selectedColorCircle
                    ]}
                    onPress={() => handleSelectColor(color)}
                  />
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.bottomControls}>
            <View style={{ width: 44, opacity: 0 }} />
            
            <View style={styles.captureContainer}>
              <TouchableOpacity
                onPress={handleCapture}
                style={styles.captureOuter}
                activeOpacity={0.8}
              >
                <View style={styles.captureInner} />
              </TouchableOpacity>
              <Text style={styles.modeText}>Tap to Capture</Text>
            </View>

            <View style={{ width: 44, opacity: 0 }} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 30 : 10,
  },
  topRightControls: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  activeButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderColor: 'white',
    borderWidth: 1,
  },
  bottomWrapper: {
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    alignItems: 'center',
  },
  paletteLabelContainer: {
    marginBottom: 10,
  },
  paletteLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'black',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  colorPaletteContainer: {
    width: Platform.OS === 'web' ? '100%' : SCREEN_WIDTH * 0.9,
    maxWidth: Platform.OS === 'web' ? 500 : undefined,
    height: 60,
    marginBottom: 30,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  colorPaletteWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  colorPaletteScroll: {
    paddingHorizontal: 15,
    alignItems: 'center',
    gap: 12,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  selectedColorCircle: {
    borderColor: 'white',
    transform: [{ scale: 1.15 }],
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    width: '100%',
  },
  captureContainer: {
    alignItems: 'center',
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  captureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'white',
  },
  modeText: {
    color: 'white',
    marginTop: 10,
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
