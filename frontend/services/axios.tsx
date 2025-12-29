import axiosLib from 'axios';
import { getToken } from './TokenService';
import { Constants } from 'expo-constants';

const axios = axiosLib.create({
  baseURL: 'http://127.0.0.1:8000/api',
  headers: {
    Accept: "application/json",
  },
});

axios.interceptors.request.use(async (req) => {
  const token = await getToken();

  if (token !== null) {
    req.headers["Authorization"] =`Bearer ${token}`;
  }
  return req;
});

export default axios;