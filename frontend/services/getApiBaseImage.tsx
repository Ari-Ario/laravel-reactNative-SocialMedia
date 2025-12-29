import { Platform } from 'react-native';

const getApiBaseImage = () => {
  const defaultUrl = process.env.EXPO_PUBLIC_API_URL || '';
  const androidUrl = process.env.EXPO_PUBLIC_API_URL_ANDROID || defaultUrl;
  const iosUrl = process.env.EXPO_PUBLIC_API_URL_IOS || defaultUrl;

  if (Platform.OS === 'android') {
    return androidUrl;
  }
  if (Platform.OS === 'ios') {
    return iosUrl;
  }

  // Web, physical devices, or fallback
  // console.log("Default URL for images:", defaultUrl);
  return defaultUrl;
};

export default getApiBaseImage;