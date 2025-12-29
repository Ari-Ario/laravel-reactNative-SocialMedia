// AuthService.tsx (or .ts)

import axios from "@/services/axios";
import { getToken, setToken } from "./TokenService";
import getApiBase from "./getApiBase";

const API_BASE = getApiBase(); // One single source of truth

export async function login(credentials: any) {
  try {
    const { data } = await axios.post(`${API_BASE}/login`, credentials);
    await setToken(data.token);
    return data;
  } catch (error) {
    throw error;
  }
}

export async function register(registerInfo: any) {
  try {
    const { data } = await axios.post(`${API_BASE}/register`, registerInfo);
    await setToken(data.token);
    return data;
  } catch (error) {
    throw error;
  }
}

export async function loadUser() {
  try {
    const token = await getToken();
    if (!token) throw new Error('No authentication token found');

    const response = await axios.get(`${API_BASE}/user`);
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

export async function sendPasswordResetLink(email: string) {
  try {
    const { data } = await axios.post(`${API_BASE}/forgot-password`, { email });
    return data.status;
  } catch (error) {
    console.error('Reset Password failed:', error);
    throw error;
  }
}

export async function logout() {
  try {
    const token = await getToken();
    if (token) {
      await axios.post(`${API_BASE}/logout`, {});
    }
  } catch (error) {
    console.error('Logout API error:', error);
  } finally {
    await setToken(null);
    console.log("Local logout completed");
  }
}