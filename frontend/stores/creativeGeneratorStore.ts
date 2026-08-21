import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import getApiBase from '@/services/getApiBase';
import axios from '@/services/axios';

export interface Idea {
  id: string;
  content: string;
  type: string;
  mood?: 'positive' | 'neutral' | 'creative' | 'analytical';
  timestamp: string;
  contributors?: string[];
  isSaved?: boolean;
  metadata?: {
    source?: string;
    duration?: string;
    confidence: number;
    generatedAt?: string;
    weight?: number;
  };
}

interface LogicMetrics {
  confidence: number;
  tier: number;
  synergy: number;
  activeNodes: number;
}

interface AIState {
  generatedIdeas: Idea[];
  activeModeId: string;
  isGenerating: boolean;
  logicMetrics: LogicMetrics;

  // Actions
  setMode: (modeId: string) => void;
  setGenerating: (isGenerating: boolean) => void;
  addIdea: (idea: Idea) => void;
  clearIdeas: () => void;
  removeIdea: (id: string) => void;
  toggleSaveIdea: (id: string, isSaved: boolean) => void;
  setLogicMetrics: (metrics: Partial<LogicMetrics>) => void;
  
  // Async Actions
  submitFeedback: (query: string, response: string, type: 'save' | 'discard', mode: string) => Promise<number | null>;
}

export const useCreativeGeneratorStore = create<AIState>()(
  persist(
    (set, get) => ({
      generatedIdeas: [],
      activeModeId: 'brainstorm',
      isGenerating: false,
      logicMetrics: {
        confidence: 0,
        tier: 3,
        synergy: 0,
        activeNodes: 0
      },

      setMode: (modeId) => set({ activeModeId: modeId }),
      setGenerating: (isGenerating) => set({ isGenerating }),
      
      addIdea: (idea) => set((state) => ({ 
        generatedIdeas: [idea, ...state.generatedIdeas] 
      })),

      clearIdeas: () => set({ generatedIdeas: [] }),
      
      removeIdea: (id) => set((state) => ({ 
        generatedIdeas: state.generatedIdeas.filter(i => i.id !== id) 
      })),

      toggleSaveIdea: (id, isSaved) => set((state) => ({
        generatedIdeas: state.generatedIdeas.map(i => 
          i.id === id ? { ...i, isSaved } : i
        )
      })),

      setLogicMetrics: (metrics) => set((state) => ({
        logicMetrics: { ...state.logicMetrics, ...metrics }
      })),

      submitFeedback: async (query, response, type, mode) => {
        try {
          const API_BASE = getApiBase();
          const res = await axios.post(`${API_BASE}/ai/submit-feedback`, {
            query,
            response,
            type,
            mode
          });

          if (res.data.success) {
            return res.data.new_weight;
          }
          return null;
        } catch (error) {
          console.error('Creative Generator Store Feedback error:', error);
          return null;
        }
      }
    }),
    {
      name: 'creative-generator-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

