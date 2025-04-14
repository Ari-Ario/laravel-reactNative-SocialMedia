import axiosLib from 'axios';
import { getToken } from './TokenService';

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

// export const getUsers = async () => {
//   try {
//     const response = await axios.get(API_URL);
//     return response.data;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// };

export default axios;