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
      const response = await api.post('/ai/copilot/start', {});
      
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
      // Regular POST request for now, assuming non-streaming response from controller 
      // (Controller implementation suggests simple POST, not SSE yet, based on provided snippet. 
      // If SSE is desired, we need to adjust controller and this hook. 
      // For Phase 1 simple implementation, let's stick to simple request-response first as per controller code).
      
      // Wait, the controller code calls aiCopilotService.chat which calls llmGateway.generate.
      // llmGateway.generate returns a promise, so it's not streaming by default unless configured.
      // The previous plan mentioned SSE, but the provided controller code was simple POST.
      // I will implement simple POST first for robustness, as per the code I just wrote.
      
      const response = await api.post(`/ai/copilot/${currentSessionId}/chat`, {
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
