// AuthService.tsx (or .ts)

import axios from "@/services/axios";
import { getToken, setToken } from "./TokenService";
import getApiBase from "./getApiBase";
import { router } from "expo-router";

const API_BASE = getApiBase() + '/api'; // One single source of truth

export async function login(credentials: any) {
  try {
    const { data } = await axios.post(`/login`, credentials);
    await setToken(data.token);
    return data;
  } catch (error) {
    throw error;
  }
}

export async function register(registerInfo: any) {
  try {
    const { data } = await axios.post(`/register`, registerInfo);
    await setToken(data.token);
    return data;
  } catch (error) {
    throw error;
  }
}

// Add verification functions
export const verifyEmailCode = async (userId: number, code: string, config = {}) => {
  const response = await axios.post('/verify-email-code', {
    user_id: userId,
    code: code
  }, config);
  return response.data;
};

export const resendVerificationCode = async (userId: number, config = {}) => {
  const response = await axios.post('/resend-verification-code', {
    user_id: userId
  }, config);
  return response.data;
};


export async function loadUser() {
  try {
    const token = await getToken();
    if (!token) throw new Error('No authentication token found');

    const response = await axios.get(`/user`);
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
    const { data } = await axios.post(`/forgot-password`, { email });
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
      await axios.post(`/logout`, {});
    }
    router.replace('/Login');
  } catch (error) {
    console.error('Logout API error:', error);
  } finally {
    await setToken(null);
    console.log("Local logout completed");
  }
}