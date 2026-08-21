import { create } from 'zustand';

/**
 * Dialectical UI Store — ephemeral, NO persistence.
 *
 * Separation of concerns: expansion/collapse state for message items is kept
 * OUTSIDE the main chatbotStore so that toggling an axiom tree does NOT
 * trigger a re-render of all messages in the FlatList.
 *
 * Each MessageItem subscribes only to its own key via a selector:
 *   const isOpen = useDialecticalUIStore(s => s.expandedAxiomTrees[item.id] ?? false);
 * Because the selector extracts a primitive boolean, Zustand will only re-render
 * that specific MessageItem — not the entire list.
 */

interface DialecticalUIState {
  /** Axiom pedigree tree expansion per message id */
  expandedAxiomTrees: Record<string, boolean>;
  /** Bot message body expansion per message id */
  expandedMessages: Record<string, boolean>;
  /** User message body expansion per message id */
  expandedUserMessages: Record<string, boolean>;

  toggleAxiomTree: (id: string) => void;
  toggleMessage: (id: string) => void;
  toggleUserMessage: (id: string) => void;
  resetAll: () => void;
}

export const useDialecticalUIStore = create<DialecticalUIState>()((set) => ({
  expandedAxiomTrees: {},
  expandedMessages: {},
  expandedUserMessages: {},

  toggleAxiomTree: (id) =>
    set((s) => ({
      expandedAxiomTrees: {
        ...s.expandedAxiomTrees,
        [id]: !s.expandedAxiomTrees[id],
      },
    })),

  toggleMessage: (id) =>
    set((s) => ({
      expandedMessages: {
        ...s.expandedMessages,
        [id]: !s.expandedMessages[id],
      },
    })),

  toggleUserMessage: (id) =>
    set((s) => ({
      expandedUserMessages: {
        ...s.expandedUserMessages,
        [id]: !s.expandedUserMessages[id],
      },
    })),

  resetAll: () =>
    set({
      expandedAxiomTrees: {},
      expandedMessages: {},
      expandedUserMessages: {},
    }),
}));
