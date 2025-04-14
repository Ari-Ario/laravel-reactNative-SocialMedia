import axios from "@/services/axios";
import { getToken, setToken } from "./TokenService";
import { Platform } from 'react-native';

const getApiBase = () => {
  const isWeb = Platform.OS === 'web';

  if (Platform.OS === 'android') {
    console.log("platform is Android");

    return 'http://10.0.2.2:8000/api'; // Android emulator
  }
  if (Platform.OS === 'ios') {
    return 'http://localhost:8000/api'; // iOS simulator
  } 
  if (Platform.OS === 'web') {
    console.log("platform is WEB");

    return '/api';
  } else {
    console.log("Platform is unknown. Use Web, Android or IOS!")
  }
};

// const API_BASE = "http://127.0.0.1:8000/api"; // for web or just use axios.post(/login or /register ,...) 
// const API_BASE = "http://10.0.2.2:8000/api"; // For Android emulator only
// const API_BASE = "http://localhost:8000/api"; // For iOS simulator

export async function login(credentials) {
    const API_BASE = getApiBase();
    const url = (API_BASE === '/api') ? '/login' : `${API_BASE}/login`;

    const { data } = await axios.post(url, credentials);
    console.log("sent to setToken from Login");

    await setToken(data.token);
}

export async function register(registerInfo) {
    const API_BASE = getApiBase();
    const url = (API_BASE === '/api') ? '/register' : `${API_BASE}/register`;

    const { data } = await axios.post(url, registerInfo);
    console.log("sending to set token from Registration:"); // Add this

    await setToken(data.token);
}

export async function loadUser() {
  const API_BASE = getApiBase();
  
  try {
    const token = await getToken();
    if (!token) throw new Error('No authentication token found');

    const response = await axios.get(`${API_BASE}/user`);

    // Handle both response structures
    const userData = response.data.user || response.data;
    
    if (!userData?.id) {
      throw new Error('Invalid user data structure received');
    }

    return userData;
    
  } catch (error) {
    console.error('Failed to load user:', error);
    await setToken(null);
    throw error;
  }
}

// export async function logout() {
//   const token = await getToken();
//   const API_BASE = getApiBase();
//   const url = (API_BASE === '/api') ? '/register' : `${API_BASE}/register`;
//   const { data } = await axios.post(`${API_BASE}/logout`, {}, {
//     headers: {
//       'Authorization': `Bearer ${token}`,
//       'Accept': 'application/json'
//     }
//   });
//   console.log("Loged out"); 
//   await setToken(null);

// }

export async function logout() {
  try {
    const token = await getToken();
    if (!token) {
      console.log("No token - already logged out");
      return;
    }

    const API_BASE = getApiBase();
    await axios.post(`${API_BASE}/logout`, {});
    await setToken(null);

  } catch (error) {
    console.error('Logout API error:', error);
    // Continue with local cleanup even if API fails
  } finally {
    await setToken(null);
    console.log("Local logout completed");
  }
}
