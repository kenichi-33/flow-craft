import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: {
    type: string;
    payload: any;
  };
}

export interface CopilotState {
  sessionId: string | null;
  messages: CopilotMessage[];
  isLoading: boolean;
  isConnected: boolean;
}

export function useAiCopilot() {
  const [state, setState] = useState<CopilotState>({
    sessionId: null,
    messages: [],
    isLoading: false,
    isConnected: false,
  });

  // Start Session
  const startSession = useCallback(async () => {
    if (state.sessionId) return state.sessionId;

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const response = await api.post<{ sessionId: string }>('/ai/copilot/start', {});
      
      setState(prev => ({
        ...prev,
        sessionId: response.sessionId,
        isLoading: false,
        isConnected: true,
      }));
      return response.sessionId;
    } catch (error) {
      console.error('Failed to start Copilot session:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [state.sessionId]);
  // Send Message
  const sendMessage = useCallback(async (message: string, context?: any) => {
    let currentSessionId = state.sessionId;
    if (!currentSessionId) {
      currentSessionId = await startSession();
    }

    if (!currentSessionId) throw new Error('Failed to initialize session');

    // Add user message
    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
    }));

    try {
      // Regular POST request for now
      const response = await api.post<{ message: string; action?: any }>(`/ai/copilot/${currentSessionId}/chat`, {
        message,
        context
      });

      const assistantMessage: CopilotMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        action: response.action,
        timestamp: new Date(),
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
      }));

      return response;

    } catch (error) {
      console.error('Failed to send message:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [state.sessionId, startSession]);

  return {
    ...state,
    startSession,
    sendMessage,
  };
}
