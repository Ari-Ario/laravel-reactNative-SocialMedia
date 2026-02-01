// services/getApiBase.ts or wherever you keep it

import { Platform } from 'react-native';
import Constants from 'expo-constants';
const getApiBase = (): string => {
  const defaultUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
  
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_API_URL_ANDROID + '/api' || defaultUrl;
  }
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_API_URL_IOS + '/api' || defaultUrl;
  }
  
  // web / fallback
  return defaultUrl + '/api';
};

export default getApiBase;
  
  // const API_BASE = "http://127.0.0.1:8000/api"; // for web or just use axios.post(/login or /register ,...) 
  // const API_BASE = "http://10.0.2.2:8000/api"; // For Android emulator only
  // const API_BASE = "http://localhost:8000/api"; // For iOS simulator