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
  /** Bot message reasoning expansion per message id */
  expandedMessages: Record<string, boolean>;
  /** User message body expansion per message id */
  expandedUserMessages: Record<string, boolean>;
  /** Currently expanded user message id (single-selection for show more/less) */
  expandedUserMessageId: string | null;

  toggleAxiomTree: (id: string) => void;
  toggleMessage: (id: string) => void;
  toggleUserMessage: (id: string) => void;
  /** Set a specific user message as expanded (or null to collapse all) */
  setExpandedUserMessageId: (id: string | null) => void;
  resetAll: () => void;
}

export const useDialecticalUIStore = create<DialecticalUIState>()((set) => ({
  expandedAxiomTrees: {},
  expandedMessages: {},
  expandedUserMessages: {},
  expandedUserMessageId: null,

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
    set((s) => {
      const current = s.expandedUserMessages[id] ?? false;
      return {
        expandedUserMessages: {
          ...s.expandedUserMessages,
          [id]: !current,
        },
        // Also sync the single-selection id field
        expandedUserMessageId: !current ? id : null,
      };
    }),

  setExpandedUserMessageId: (id) =>
    set((s) => {
      // Toggle the record map to match the single-selection id
      const newMap = { ...s.expandedUserMessages };
      // Collapse previous if any
      if (s.expandedUserMessageId && s.expandedUserMessageId !== id) {
        newMap[s.expandedUserMessageId] = false;
      }
      if (id !== null) {
        newMap[id] = true;
      }
      return { expandedUserMessageId: id, expandedUserMessages: newMap };
    }),

  resetAll: () =>
    set({
      expandedAxiomTrees: {},
      expandedMessages: {},
      expandedUserMessages: {},
      expandedUserMessageId: null,
    }),
}));
