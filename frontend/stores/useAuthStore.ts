import { getToken, setToken } from '@/services/TokenService';
import { loadUser as fetchUserFromApi } from '@/services/AuthService';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: number | string;
  name: string;
  email: string;
  profile_photo?: string | null;
  email_verified_at?: string | null;
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // High-level Auth Actions
  initialize: () => Promise<void>;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isInitialized: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      initialize: async () => {
        if (get().isInitialized) return;
        
        set({ isLoading: true });
        try {
          const token = await getToken();
          if (token) {
            try {
              const user = await fetchUserFromApi();
              set({ user, token, isAuthenticated: true, isInitialized: true });
            } catch (e) {
              console.warn('Initialization: Token found but user fetch failed. Clearing auth.');
              await setToken(null);
              set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
            }
          } else {
            set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
          }
        } catch (error: any) {
          set({ error: error.message, isInitialized: true });
        } finally {
          set({ isLoading: false });
        }
      },

      login: async (user, token) => {
        await setToken(token);
        set({ user, token, isAuthenticated: true });
      },

      logout: async () => {
        await setToken(null);
        set({ user: null, token: null, isAuthenticated: false });
      },

      refreshUser: async () => {
        try {
          const user = await fetchUserFromApi();
          set({ user, isAuthenticated: true });
        } catch (error) {
          console.error('Failed to refresh user:', error);
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);
