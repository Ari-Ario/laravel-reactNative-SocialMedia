// services/axios.js
import axiosLib from 'axios';
import { getToken } from './TokenService';
import getApiBase from './getApiBase';

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
  }

  return req;
});


export default axios;