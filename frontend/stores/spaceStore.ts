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
    handleSpaceEvent: (event: any) => void;
    reset: () => void;
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

    handleSpaceEvent: (event: any) => {
        const { type, data } = event;
        const spaceData = data.space || data.data?.space || data;
        const spaceId = (spaceData.id || data.space_id || data.spaceId)?.toString();

        if (!spaceId) return;

        switch (type) {
            case 'space-created':
            case 'space_created':
            case 'space-invitation':
            case 'space_invitation':
                const exists = get().spaces.some(s => s.id.toString() === spaceId);
                if (!exists) {
                    get().addSpace(spaceData);
                } else {
                    get().updateSpace(spaceData);
                }
                break;
            case 'space-updated':
            case 'space.updated':
                get().updateSpace(spaceData);
                break;
            case 'space-deleted':
            case 'space.deleted':
                set((state) => ({
                    spaces: state.spaces.filter(s => s.id.toString() !== spaceId)
                }));
                break;
        }
    },

    reset: () => set({
        currentSpace: null,
        participants: [],
        magicEvents: [],
        spaces: [],
    }),
}));