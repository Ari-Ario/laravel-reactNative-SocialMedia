import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Image, ImageProps } from 'expo-image';

interface LazyImageProps extends ImageProps {
  placeholderColor?: string;
  showLoading?: boolean;
  fadeDuration?: number;
  fallbackUri?: string;
}

const DEFAULT_FALLBACK =
  'https://picsum.photos/200'; // Default fallback image URL

const LazyImage: React.FC<LazyImageProps> = ({
  source,
  style,
  placeholderColor = '#f0f0f0',
  showLoading = true,
  fadeDuration = 300,
  fallbackUri = DEFAULT_FALLBACK,
  onLoadStart,
  onLoadEnd,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (source) {
      setIsLoading(true);
      setHasError(false);
      fadeAnim.setValue(0);
      onLoadStart?.();
    }
  }, [source]);

  const handleLoadEnd = () => {
    setIsLoading(false);
    onLoadEnd?.();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: fadeDuration,
      useNativeDriver: true,
    }).start();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const resolvedSource =
    hasError || !source
      ? { uri: fallbackUri }
      : typeof source === 'string'
      ? { uri: source }
      : source;

  return (
    <View style={[styles.container, style]}>
      {isLoading && showLoading && (
        <View
          style={[
            styles.loadingContainer,
            { backgroundColor: placeholderColor },
          ]}
        >
          <ActivityIndicator size="small" color="#666" />
        </View>
      )}

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Image
          source={resolvedSource}
          style={styles.image}
          contentFit="cover"
          transition={fadeDuration}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          {...props}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LazyImage;
