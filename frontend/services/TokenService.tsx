import * as SecureStore from "expo-secure-store";
import { Platform } from 'react-native';

let token: string | null = null;

export async function setToken(newToken: string | null) {
  token = newToken;
  console.log("Token ready:", token);

  try {
    if (token !== null) {
      if (Platform.OS === 'web') {
        localStorage.setItem("token", token);
      } else {
        await SecureStore.setItemAsync("token", token);
      }
      console.log('Token saved successfully');
    } else {
      if (Platform.OS === 'web') {
        localStorage.removeItem("token");
      } else {
        await SecureStore.deleteItemAsync("token");
      }
    }
  } catch (error) {
    console.error('Storage error:', error);
  }
}

export async function getToken() {
  try {
    if (token !== null) {
      console.log("Token exists already: ", token);
      return token;
    } else {
      if (Platform.OS === 'web') {
        token = localStorage.getItem("token");
      } else {
        token = await SecureStore.getItemAsync("token");
      }
      return token;
    }
  } catch (error) {
    console.error('Storage error:', error);
  }
}
