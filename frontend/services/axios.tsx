// services/axios.js
import axiosLib from 'axios';
import { getToken } from './TokenService';
import getApiBase from './getApiBase';
import PusherService from './PusherService';

const baseURL = getApiBase();
const axios = axiosLib.create({
  baseURL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

axios.interceptors.request.use(async (req) => {
  const fullUrl =
    req.url?.startsWith('http')
      ? req.url
      : `${req.baseURL}${req.url}`;

  console.log('Axios Request:', {
    url: req.url,
    fullUrl,
    headers: req.headers,
  });

  const authEndpoints = ['/login', '/register', '/forgot-password', '/reset-password'];
  const isAuthRequest = authEndpoints.some(endpoint =>
    req.url?.includes(endpoint)
  );

  if (!isAuthRequest) {
    const token = await getToken();
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ FIX: Include X-Socket-ID for broadcast deduplication (toOthers)
    const socketId = PusherService.getSocketId();
    if (socketId) {
      req.headers['X-Socket-ID'] = socketId;
    }
  }

  return req;
});


export default axios;