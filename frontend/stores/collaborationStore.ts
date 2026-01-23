// stores/collaborationStore.ts
import { create } from 'zustand';
import { CollaborationSpace, SpaceParticipation } from '@/services/CollaborationService';

interface CollaborationState {
  spaces: CollaborationSpace[];
  activeSpace: CollaborationSpace | null;
  participants: SpaceParticipation[];
  magicEvents: any[];
  
  setSpaces: (spaces: CollaborationSpace[]) => void;
  setActiveSpace: (space: CollaborationSpace | null) => void;
  addSpace: (space: CollaborationSpace) => void;
  updateSpace: (spaceId: string, updates: Partial<CollaborationSpace>) => void;
  setParticipants: (participants: SpaceParticipation[]) => void;
  addMagicEvent: (event: any) => void;
  discoverMagicEvent: (eventId: string) => void;
}

export const useCollaborationStore = create<CollaborationState>((set) => ({
  spaces: [],
  activeSpace: null,
  participants: [],
  magicEvents: [],
  
  setSpaces: (spaces) => set({ spaces }),
  setActiveSpace: (space) => set({ activeSpace: space }),
  addSpace: (space) => set((state) => ({ spaces: [space, ...state.spaces] })),
  updateSpace: (spaceId, updates) => set((state) => ({
    spaces: state.spaces.map(space => 
      space.id === spaceId ? { ...space, ...updates } : space
    ),
    activeSpace: state.activeSpace?.id === spaceId 
      ? { ...state.activeSpace, ...updates } 
      : state.activeSpace,
  })),
  setParticipants: (participants) => set({ participants }),
  addMagicEvent: (event) => set((state) => ({ magicEvents: [event, ...state.magicEvents] })),
  discoverMagicEvent: (eventId) => set((state) => ({
    magicEvents: state.magicEvents.map(event =>
      event.id === eventId ? { ...event, has_been_discovered: true } : event
    ),
  })),
}));