import { create } from 'zustand';

interface UiState {
  isCopilotOpen: boolean;
  toggleCopilot: () => void;
  setCopilotOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCopilotOpen: false,
  toggleCopilot: () => set((state) => ({ isCopilotOpen: !state.isCopilotOpen })),
  setCopilotOpen: (open) => set({ isCopilotOpen: open }),
}));
