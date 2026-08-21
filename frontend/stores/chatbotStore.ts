import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  type: 'text' | 'ai' | 'code' | 'error';
  timestamp: string; // ISO string
  model?: string;
  tokens?: number;
  reasoning?: string;
  sources?: { title: string; url: string }[];
  feedback?: 'up' | 'down' | null;
  isAxiom?: boolean;
  status?: string;
  confidenceScore?: number;
  axiomId?: number;
  // ── Dialectical engine fields ──────────────────────────────────────────────
  /** Full parent chain from backend: Root (0/1) → ... → direct parent */
  parentAxioms?: { id: number; thesis_statement: string; branch?: string }[];
  /** Science branch (e.g. formal_logic, relativity, genetics) */
  branch?: string;
  /** Sub-domain (e.g. propositional_logic, quantum_mechanics) */
  domainPartition?: string;
  /** True when the engine could not resolve from existing axioms */
  isNewFallback?: boolean;
  /** chatbot_training.id created when is_fallback=true */
  trainingTicketId?: number;
  /** Track local feedback counts */
  feedbackCounts?: { up: number; down: number };
}


export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  model: string;
  isPinned?: boolean;
}

interface ChatbotState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isTyping: boolean;
  searchQuery: string;
  currentModel: string;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  addConversation: (conversation: Conversation) => void;
  deleteConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateLastMessage: (conversationId: string, text: string) => void;
  updateConversationTitle: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  setMessageFeedback: (conversationId: string, messageId: string, feedback: 'up' | 'down' | null) => void;
  setIsTyping: (isTyping: boolean) => void;
  clearConversation: (id: string) => void;
  clearHistory: () => void;
  setCurrentModel: (model: string) => void;
  truncateMessagesAfter: (conversationId: string, messageId: string) => void;
  pruneConversation: (conversationId: string, maxMessages?: number) => void;

  // Computed
  getFilteredConversations: () => Conversation[];
}

export const useChatbotStore = create<ChatbotState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,
      isTyping: false,
      searchQuery: '',
      currentModel: 'phi-3',

      setConversations: (conversations) => set({ conversations }),

      setCurrentConversationId: (id) => set((state) => {
        const conv = state.conversations.find(c => c.id === id);
        return { 
          currentConversationId: id,
          currentModel: (conv && conv.model) ? conv.model : state.currentModel
        };
      }),
      
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      addConversation: (conversation) => set((state) => ({
        conversations: [conversation, ...state.conversations],
        currentConversationId: conversation.id
      })),

      deleteConversation: (id) => set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        currentConversationId: state.currentConversationId === id ? null : state.currentConversationId
      })),

      addMessage: (conversationId, message) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? {
              ...c,
              messages: [...c.messages, message],
              updatedAt: new Date().toISOString()
            }
            : c
        ).sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })
      })),

      updateLastMessage: (conversationId, text) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? {
              ...c,
              messages: c.messages.map((m, idx) =>
                idx === c.messages.length - 1 ? { ...m, text } : m
              ),
              updatedAt: new Date().toISOString()
            }
            : c
        )
      })),

      updateConversationTitle: (id, title) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, title } : c
        )
      })),

      togglePin: (id) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, isPinned: !c.isPinned } : c
        ).sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })
      })),

      setMessageFeedback: (conversationId, messageId, feedback) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, feedback } : m
              )
            }
            : c
        )
      })),

      setIsTyping: (isTyping) => set({ isTyping }),

      clearConversation: (id) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, messages: [], updatedAt: new Date().toISOString() } : c
        )
      })),

      clearHistory: () => set({ conversations: [], currentConversationId: null }),

      /**
       * Anti-Lazy Memory Guard: Prunes oldest non-pinned messages from a conversation
       * once it exceeds maxMessages (default 80), keeping the conversation performant
       * even after 100+ prompts. Axiom messages and the last 40 are always preserved.
       */
      pruneConversation: (conversationId, maxMessages = 80) => set((state) => ({
        conversations: state.conversations.map((c) => {
          if (c.id !== conversationId || c.messages.length <= maxMessages) return c;
          // Always keep the last 40 messages and any axiom/global_axiom messages
          const tail = c.messages.slice(-40);
          const tailIds = new Set(tail.map(m => m.id));
          const axiomMessages = c.messages
            .slice(0, -40)
            .filter(m => m.status === 'global_axiom' || m.isAxiom);
          const pruned = [...axiomMessages, ...tail]
            .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          return { ...c, messages: pruned };
        }),
      })),

      truncateMessagesAfter: (conversationId, messageId) => set((state) => ({
        conversations: state.conversations.map((c) => {
          if (c.id !== conversationId) return c;
          const idx = c.messages.findIndex((m) => m.id === messageId);
          if (idx === -1) return c;
          return { ...c, messages: c.messages.slice(0, idx), updatedAt: new Date().toISOString() };
        }),
      })),

      setCurrentModel: (currentModel) => set((state) => {
        // If we are in an active conversation, update its model too
        const newConversations = state.currentConversationId
          ? state.conversations.map(c =>
              c.id === state.currentConversationId ? { ...c, model: currentModel } : c
            )
          : state.conversations;

        return {
          currentModel,
          conversations: newConversations
        };
      }),

      getFilteredConversations: () => {
        const { conversations, searchQuery } = get();
        if (!searchQuery) return conversations;
        return conversations.filter(c => 
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.messages.some(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
    }),
    {
      name: 'chatbot-storage-v2', // Increment version to clear any stale data
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        conversations: state.conversations,
        currentModel: state.currentModel,
      }),
    }
  )
);
