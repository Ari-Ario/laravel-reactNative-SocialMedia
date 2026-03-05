// services/ContactService.ts
import axios from '@/services/axios';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';

class ContactService {
  private static instance: ContactService;
  private baseURL: string;
  private token: string | null = null;

  private constructor() {
    this.baseURL = getApiBase();
  }

  static getInstance() {
    if (!ContactService.instance) {
      ContactService.instance = new ContactService();
    }
    return ContactService.instance;
  }

  async setToken() {
    this.token = await getToken();
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    };
  }

  // 🔥 Fetch followers
  async fetchFollowers() {
    if (!this.token) await this.setToken();

    const response = await axios.get(`${this.baseURL}/profile/followers`, {
      headers: this.getHeaders(),
    });
    console.log('All Followers', response.data)
    return response.data;
  }

  // 🔥 Fetch following
  async fetchFollowing() {
    if (!this.token) await this.setToken();

    const response = await axios.get(`${this.baseURL}/profile/following`, {
      headers: this.getHeaders(),
    });
    console.log('All Followings', response.data)

    return response.data;
  }
}

export default ContactService;
