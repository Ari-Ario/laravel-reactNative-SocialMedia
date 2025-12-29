// services/getApiBase.ts or wherever you keep it

import { Platform } from 'react-native';
import Constants from 'expo-constants';
const getApiBase = (): string => {
  const androidUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL_ANDROID || Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || '';
  const iosUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL_IOS || Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || '';
  const defaultUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || '';

  if (Platform.OS === 'android') {
    return androidUrl;
  }

  if (Platform.OS === 'ios') {
    return iosUrl;
  }

  // Web and physical devices (or fallback)
  return defaultUrl;
};

export default getApiBase;
  
  // const API_BASE = "http://127.0.0.1:8000/api"; // for web or just use axios.post(/login or /register ,...) 
  // const API_BASE = "http://10.0.2.2:8000/api"; // For Android emulator only
  // const API_BASE = "http://localhost:8000/api"; // For iOS simulator