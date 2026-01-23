// services/ContactService.ts
import axios from '@/services/axios';
import getApiBase from './getApiBase';
import { getToken } from './TokenService';

class ContactService {
  private static instance: ContactService;
  private baseURL: string;
  private token: string | null = null;

  private constructor() {
    this.baseURL = `${getApiBase()}/api`;
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

    const response = await axios.get(`${this.baseURL}/followers`, {
      headers: this.getHeaders(),
    });

    return response.data;
  }

  // 🔥 Fetch following
  async fetchFollowing() {
    if (!this.token) await this.setToken();

    const response = await axios.get(`${this.baseURL}/following`, {
      headers: this.getHeaders(),
    });

    return response.data;
  }
}

export default ContactService;
