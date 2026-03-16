// stores/storyStore.tsx
import { create } from 'zustand';
import { fetchStories } from '@/services/StoryService';
import PusherService from '@/services/PusherService';

export interface Story {
  id: number;
  userId: number; // For compatibility, though stories usually have user_id
  user_id?: number;
  media_path: string;
  type: 'photo' | 'video';
  caption?: string;
  stickers?: any;
  location?: any;
  viewed: boolean;
  user: {
    id: number;
    name: string;
    profile_photo: string;
  };
}

export interface StoryGroup {
  user: {
    id: number;
    name: string;
    profile_photo: string;
  };
  stories: Story[];
  all_viewed: boolean;
  latest_story: Story;
}

interface StoryStore {
  storyGroups: StoryGroup[];
  loading: boolean;

  // Actions
  fetchStories: () => Promise<void>;
  setStoryGroups: (groups: StoryGroup[]) => void;

  // Real-time handlers
  handleStoryCreated: (data: { story: any }) => void;
  handleStoryDeleted: (data: { storyId: number; userId: number }) => void;

  // Real-time initialization
  initializeRealtime: () => void;
  setStoriesForUser: (userId: number, stories: Story[]) => void;
}

export const useStoryStore = create<StoryStore>((set, get) => ({
  storyGroups: [],
  loading: false,

  fetchStories: async () => {
    set({ loading: true });
    try {
      const data = await fetchStories();
      set({ storyGroups: data });
    } catch (error) {
      console.error('Error fetching stories in store:', error);
    } finally {
      set({ loading: false });
    }
  },

  setStoryGroups: (groups) => set({ storyGroups: groups }),

  handleStoryCreated: (data) => {
    if (!data.story) return;

    set((state) => {
      const userId = Number(data.story.user_id || data.story.userId);
      const prevGroups = [...state.storyGroups];
      const existingGroupIndex = prevGroups.findIndex(g => g.user.id === userId);

      if (existingGroupIndex !== -1) {
        const group = { ...prevGroups[existingGroupIndex] };

        // Skip duplicate
        if (group.stories.some(s => s.id === data.story.id)) return state;

        group.stories = [data.story, ...group.stories];
        group.latest_story = data.story;
        group.all_viewed = false;

        prevGroups[existingGroupIndex] = group;
        return { storyGroups: prevGroups };
      } else {
        const newGroup: StoryGroup = {
          user: data.story.user,
          stories: [data.story],
          all_viewed: false,
          latest_story: data.story
        };
        return { storyGroups: [newGroup, ...prevGroups] };
      }
    });
  },

  handleStoryDeleted: (data) => {
    if (!data.storyId) return;

    set((state) => {
      const userId = Number(data.userId);
      const prevGroups = [...state.storyGroups];
      const existingGroupIndex = prevGroups.findIndex(g => g.user.id === userId);

      if (existingGroupIndex === -1) return state;

      const group = { ...prevGroups[existingGroupIndex] };
      group.stories = group.stories.filter(s => s.id !== data.storyId);

      if (group.stories.length === 0) {
        return { storyGroups: prevGroups.filter(g => g.user.id !== userId) };
      } else {
        // Update latest story if it was the one deleted
        if (group.latest_story.id === data.storyId) {
          group.latest_story = group.stories[0];
        }
        group.all_viewed = group.stories.every(s => s.viewed);

        prevGroups[existingGroupIndex] = group;
        return { storyGroups: prevGroups };
      }
    });
  },

  initializeRealtime: () => {
    console.log('📡 Initializing StoryStore real-time connection');
    PusherService.subscribeToStories(
      (data) => get().handleStoryCreated(data),
      (data) => get().handleStoryDeleted(data)
    );
  },

  setStoriesForUser: (userId, stories) => {
    set((state) => {
      const prevGroups = [...state.storyGroups];
      const existingGroupIndex = prevGroups.findIndex(g => g.user.id === userId);

      if (existingGroupIndex !== -1) {
        const group = { ...prevGroups[existingGroupIndex] };
        group.stories = stories;
        // latest_story should be the first one in the array (assuming sorted by created_at desc)
        group.latest_story = stories.length > 0 ? stories[0] : group.latest_story;
        group.all_viewed = stories.every(s => s.viewed);

        prevGroups[existingGroupIndex] = group;
        return { storyGroups: prevGroups };
      } else if (stories.length > 0) {
        const newGroup: StoryGroup = {
          user: stories[0].user,
          stories: stories,
          all_viewed: stories.every(s => s.viewed),
          latest_story: stories[0]
        };
        return { storyGroups: [newGroup, ...prevGroups] };
      }
      return state;
    });
  }
}));