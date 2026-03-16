import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedLocation {
  id: string; // Typically "lat,lng" or a unique name
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  savedAt: number;
}

interface SavedLocationsState {
  favorites: SavedLocation[];
  toggleFavorite: (location: Omit<SavedLocation, 'id' | 'savedAt'>) => void;
  isFavorite: (latitude: number, longitude: number) => boolean;
  clearAll: () => void;
}

export const useSavedLocationsStore = create<SavedLocationsState>()(
  persist(
    (set, get) => ({
      favorites: [],

      toggleFavorite: (loc) => {
        const { favorites } = get();
        const id = `${loc.latitude.toFixed(6)},${loc.longitude.toFixed(6)}`;
        const exists = favorites.find((f) => f.id === id);

        if (exists) {
          set({
            favorites: favorites.filter((f) => f.id !== id),
          });
        } else {
          set({
            favorites: [
              ...favorites,
              {
                ...loc,
                id,
                savedAt: Date.now(),
              },
            ],
          });
        }
      },

      isFavorite: (lat, lng) => {
        const { favorites } = get();
        const id = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        return favorites.some((f) => f.id === id);
      },

      clearAll: () => set({ favorites: [] }),
    }),
    {
      name: 'saved-locations-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
