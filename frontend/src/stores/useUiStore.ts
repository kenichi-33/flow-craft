import { create } from 'zustand';

interface UiState {
  isCopilotOpen: boolean;
  toggleCopilot: () => void;
  setCopilotOpen: (open: boolean) => void;
  copilotContext: Record<string, any>;
  setCopilotContext: (context: Record<string, any>) => void;
  designerContext: { type: 'form' | 'flow'; data: any } | null;
  setDesignerContext: (context: { type: 'form' | 'flow'; data: any } | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCopilotOpen: false,
  toggleCopilot: () => set((state) => ({ isCopilotOpen: !state.isCopilotOpen })),
  setCopilotOpen: (open) => set({ isCopilotOpen: open }),
  copilotContext: {},
  setCopilotContext: (context) => set({ copilotContext: context }),
  designerContext: null,
  setDesignerContext: (context) => set({ designerContext: context }),
}));
