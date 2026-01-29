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
    setSpace: (space: Space | null) => void;
    updateParticipants: (participants: Participant[]) => void;
    addMagicEvent: (event: MagicEvent) => void;
}

export const useSpaceStore = create<SpaceStoreState>((set) => ({
    currentSpace: null,
    participants: [],
    magicEvents: [],
    setSpace: (space) => set({ currentSpace: space }),
    updateParticipants: (participants) => set({ participants }),
    addMagicEvent: (event) => set((state) => ({ magicEvents: [event, ...state.magicEvents] })),
}));