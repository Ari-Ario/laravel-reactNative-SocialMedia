import { create } from 'zustand';
import { MarketItem, fetchMarketItems, fetchMyMarketItems, createMarketItem, updateMarketItem, deleteMarketItem } from '../services/MarketService';

interface MarketState {
  items: MarketItem[];
  currentPage: number;
  lastPage: number;
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  searchQuery: string;

  // My Items State
  myItems: MarketItem[];
  myCurrentPage: number;
  myLastPage: number;
  myIsLoading: boolean;
  myIsRefreshing: boolean;
  myHasMore: boolean;
  
  setSearchQuery: (query: string) => void;
  loadItems: (refresh?: boolean, category?: string) => Promise<void>;
  loadMyItems: (refresh?: boolean) => Promise<void>;
  addItem: (formData: FormData) => Promise<MarketItem>;
  updateItem: (id: number, data: any) => Promise<MarketItem>;
  removeItem: (id: number) => Promise<void>;
  updateItemLocally: (id: number, updateFn: (item: MarketItem) => MarketItem) => void;
  removeItemLocally: (id: number) => void;
  addOrUpdateItem: (item: MarketItem) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  items: [],
  currentPage: 1,
  lastPage: 1,
  isLoading: false,
  isRefreshing: false,
  hasMore: true,
  searchQuery: '',

  // My Items Initial State
  myItems: [],
  myCurrentPage: 1,
  myLastPage: 1,
  myIsLoading: false,
  myIsRefreshing: false,
  myHasMore: true,

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  loadItems: async (refresh = false, category?: string) => {
    const { currentPage, isLoading, isRefreshing, searchQuery } = get();
    
    if (isLoading || isRefreshing) return;
    
    const page = refresh ? 1 : currentPage + 1;
    
    if (refresh) {
      set({ isRefreshing: true });
    } else {
      set({ isLoading: true });
    }

    try {
      const response = await fetchMarketItems(page, category, searchQuery);
      const newItems = response.data;
      
      set((state) => ({
        items: refresh ? newItems : [...state.items, ...newItems],
        currentPage: response.current_page,
        lastPage: response.last_page,
        hasMore: response.current_page < response.last_page,
      }));
    } catch (error) {
      console.error('Failed to load market items:', error);
    } finally {
      set({ isLoading: false, isRefreshing: false });
    }
  },

  loadMyItems: async (refresh = false) => {
    const { myCurrentPage, myIsLoading, myIsRefreshing, searchQuery } = get();
    
    if (myIsLoading || myIsRefreshing) return;
    
    const page = refresh ? 1 : myCurrentPage + 1;
    
    if (refresh) {
      set({ myIsRefreshing: true });
    } else {
      set({ myIsLoading: true });
    }

    try {
      const response = await fetchMyMarketItems(page, searchQuery);
      const newItems = response.data;
      
      set((state) => ({
        myItems: refresh ? newItems : [...state.myItems, ...newItems],
        myCurrentPage: response.current_page,
        myLastPage: response.last_page,
        myHasMore: response.current_page < response.last_page,
      }));
    } catch (error) {
      console.error('Failed to load my market items:', error);
    } finally {
      set({ myIsLoading: false, myIsRefreshing: false });
    }
  },

  addItem: async (formData: FormData) => {
    const newItem = await createMarketItem(formData);
    set((state) => ({
      items: [newItem, ...state.items],
      myItems: [newItem, ...state.myItems]
    }));
    return newItem;
  },

  updateItem: async (id: number, data: any) => {
    const updatedItem = await updateMarketItem(id, data);
    set((state) => ({
      items: state.items.map(item => item.id === id ? updatedItem : item),
      myItems: state.myItems.map(item => item.id === id ? updatedItem : item)
    }));
    return updatedItem;
  },

  removeItem: async (id: number) => {
    await deleteMarketItem(id);
    set((state) => ({
      items: state.items.filter(item => item.id !== id),
      myItems: state.myItems.filter(item => item.id !== id)
    }));
  },

  updateItemLocally: (id: number, updateFn: (item: MarketItem) => MarketItem) => {
    set((state) => ({
      items: state.items.map(item => item.id === id ? updateFn(item) : item),
      myItems: state.myItems.map(item => item.id === id ? updateFn(item) : item)
    }));
  },
  
  removeItemLocally: (id: number) => {
    set((state) => ({
      items: state.items.filter(item => item.id !== id),
      myItems: state.myItems.filter(item => item.id !== id)
    }));
  },
  
  addOrUpdateItem: (item: MarketItem) => {
    set((state) => {
      const itemsExists = state.items.some(i => i.id === item.id);
      const myItemsExists = state.myItems.some(i => i.id === item.id);

      return {
        items: itemsExists 
          ? state.items.map(i => i.id === item.id ? item : i)
          : [item, ...state.items],
        myItems: myItemsExists
          ? state.myItems.map(i => i.id === item.id ? item : i)
          : (item.user_id === state.myItems[0]?.user_id ? [item, ...state.myItems] : state.myItems)
          // Note: for myItems we only add if it belongs to the user, but we don't have currentUserId here easily.
          // However, the backend route /my-items ensures it.
          // For Pusher updates, we should check if item.user_id matches current user.
      };
    });
  }
}));
