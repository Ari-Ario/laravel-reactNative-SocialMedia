// services/getApiBase.ts

import { Platform } from 'react-native';

const getApiBase = (): string => {
  const fallback = 'http://localhost:8000';

  let base =
    Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_API_URL_ANDROID
      : Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_API_URL_IOS
        : process.env.EXPO_PUBLIC_API_URL; // This is for web

  if (!base) {
    base = fallback;
  }

  // ensure NO trailing slash
  base = base.replace(/\/$/, '');

  // FOR WEB: Check if the base already includes /api
  if (Platform.OS === 'web') {
    // If the base URL already ends with /api, don't add it again
    if (base.endsWith('/api')) {
      return base;
    }
    // Otherwise, add /api
    return `${base}/api`;
  }

  // For mobile, always add /api
  return `${base}/api`;
};

export default getApiBase;

// const API_BASE = "http://127.0.0.1:8000/api"; // for web or just use axios.post(/login or /register ,...) 
// const API_BASE = "http://10.0.2.2:8000/api"; // For Android emulator only
// const API_BASE = "http://localhost:8000/api"; // For iOS simulator