import { create } from 'zustand';

interface UiState {
  isCopilotOpen: boolean;
  toggleCopilot: () => void;
  setCopilotOpen: (open: boolean) => void;
  copilotContext: Record<string, any>;
  setCopilotContext: (context: Record<string, any>) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCopilotOpen: false,
  toggleCopilot: () => set((state) => ({ isCopilotOpen: !state.isCopilotOpen })),
  setCopilotOpen: (open) => set({ isCopilotOpen: open }),
  copilotContext: {},
  setCopilotContext: (context) => set({ copilotContext: context }),
}));
