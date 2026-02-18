// stores/spaceStore.ts (new file)
import { create } from 'zustand';
interface Space {
    id: string;
    name: string;
    [key: string]: any;
}

interface Participant {
    id: string;
    name: string;
    [key: string]: any;
}

interface MagicEvent {
    id: string;
    type: string;
    [key: string]: any;
}

interface SpaceStoreState {
    currentSpace: Space | null;
    participants: Participant[];
    magicEvents: MagicEvent[];
    spaces: Space[];
    setSpace: (space: Space | null) => void;
    updateParticipants: (participants: Participant[]) => void;
    addMagicEvent: (event: MagicEvent) => void;
    setSpaces: (spaces: Space[]) => void;
    addSpace: (space: Space) => void;
    updateSpace: (space: Space) => void;
}

export const useSpaceStore = create<SpaceStoreState>((set, get) => ({
    currentSpace: null,
    participants: [],
    magicEvents: [],
    spaces: [], // Global spaces list

    setSpace: (space) => set({ currentSpace: space }),
    updateParticipants: (participants) => set({ participants }),
    addMagicEvent: (event) => set((state) => ({ magicEvents: [event, ...state.magicEvents] })),

    // New actions
    setSpaces: (spaces) => set({ spaces }),
    addSpace: (space) => set((state) => ({
        spaces: [space, ...state.spaces] // Add to top
    })),
    updateSpace: (updatedSpace) => set((state) => ({
        spaces: state.spaces.map(s => s.id === updatedSpace.id ? { ...s, ...updatedSpace } : s)
    })),
}));