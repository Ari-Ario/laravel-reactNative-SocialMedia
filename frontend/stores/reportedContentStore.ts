import { create } from 'zustand';
import { getMyReportedContent } from '@/services/ReportService';

interface ReportedItem {
  target_type: 'post' | 'story' | 'space' | 'comment' | 'user' | 'profile';
  target_id: string | number;
}

interface ReportedContentState {
  reportedItems: ReportedItem[];
  isLoading: boolean;
  error: string | null;
  fetchReportedContent: () => Promise<void>;
  isReported: (type: string, id: string | number) => boolean;
  addReportedItem: (type: string, id: string | number) => void;
  removeReportedItem: (type: string, id: string | number) => void;
}

export const useReportedContentStore = create<ReportedContentState>((set, get) => ({
  reportedItems: [],
  isLoading: false,
  error: null,

  fetchReportedContent: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getMyReportedContent();
      set({ reportedItems: data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch reported content', isLoading: false });
    }
  },

  isReported: (type: string, id: string | number) => {
    const { reportedItems } = get();
    // Normalize comparison (string vs number)
    return reportedItems.some(
      item => item.target_type === type && String(item.target_id) === String(id)
    );
  },

  addReportedItem: (type: any, id: string | number) => {
    set(state => ({
      reportedItems: [...state.reportedItems, { target_type: type, target_id: id }]
    }));
  },

  removeReportedItem: (type: string, id: string | number) => {
    set(state => ({
      reportedItems: state.reportedItems.filter(
        item => !(item.target_type === type && String(item.target_id) === String(id))
      )
    }));
  }
}));
