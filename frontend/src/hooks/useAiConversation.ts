import { useState, useEffect, useRef, useCallback } from 'react';
import { api, API_BASE_URL } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface DetectedApp {
  appId: string;
  appName: string;
  reason: string;
  confidence: number;
}

export interface ExecutionResult {
  parentApplicationId: string;
  childApplicationIds: string[];
}

export interface ConversationState {
  sessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  isConnected: boolean;
  agentName: string;
  sessionStatus: string; // 'ACTIVE', 'COLLECTING', 'CONFIRMING', 'EXECUTING', 'COMPLETED', 'CANCELED'
  detectedApps: DetectedApp[];
  collectedSlots: Record<string, any>;
  executionResult?: ExecutionResult;
}

export function useAiConversation(
  flowId: string,
  config?: {
    agentName?: string;
    systemPrompt?: string;
    allowedApps?: string[];
  }
) {
  const [state, setState] = useState<ConversationState>({
    sessionId: null,
    messages: [],
    isLoading: false,
    isConnected: false,
    agentName: config?.agentName || 'AIアシスタント',
    sessionStatus: 'ACTIVE',
    detectedApps: [],
    collectedSlots: {},
    executionResult: undefined,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const isStartingRef = useRef(false);

  // 会話セッション開始
  const startConversation = useCallback(async () => {
    if (isStartingRef.current || state.sessionId) return state.sessionId;
    
    isStartingRef.current = true;
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const response = await api.post('/ai/chat/start', {
        flowId,
        agentName: config?.agentName,
        systemPrompt: config?.systemPrompt,
        allowedApps: config?.allowedApps,
      });
      
      setState((prev) => ({
        ...prev,
        sessionId: response.sessionId,
        agentName: response.agentName || config?.agentName || 'AIアシスタント',
        isLoading: false,
      }));

      return response.sessionId;
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    } finally {
      isStartingRef.current = false;
    }
  }, [flowId, config, state.sessionId]);

  // メッセージ送信（SSEストリーミング）
  const sendMessage = useCallback(
    async (message: string) => {
      if (!state.sessionId) {
        throw new Error('Session not started');
      }

      // ユーザーメッセージを即座に追加
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
      }));

      try {
        // fetchでPOSTリクエストを送信し、SSEレスポンスを受信
        const { token } = useAuthStore.getState();
        const response = await fetch(
          `${API_BASE_URL}/ai/chat/${state.sessionId}/message`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ message }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        // SSEストリームを読み取る
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'message') {
                const assistantMessage: Message = {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant',
                  content: data.content,
                  timestamp: new Date(),
                };

                setState((prev) => ({
                  ...prev,
                  messages: [...prev.messages, assistantMessage],
                  isLoading: false,
                  // セッション状態の更新
                  sessionStatus: data.sessionStatus || prev.sessionStatus,
                  detectedApps: data.detectedApps || prev.detectedApps,
                  collectedSlots: data.collectedSlots || prev.collectedSlots,
                  executionResult: data.executionResult || prev.executionResult,
                }));
              } else if (data.type === 'done') {
                setState((prev) => ({ ...prev, isLoading: false }));
              } else if (data.type === 'error') {
                console.error('SSE Error:', data.message);
                setState((prev) => ({ ...prev, isLoading: false }));
                throw new Error(data.message);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    [state.sessionId]
  );


  // セッション情報取得
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const response = await api.get(`/ai/chat/${sessionId}`);
      
      const messages: Message[] = (response.history || []).map((msg: any, idx: number) => ({
        id: `${msg.role}-${idx}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));

      setState((prev) => ({
        ...prev,
        sessionId: response.id,
        messages,
        agentName: response.agentName || 'AIアシスタント',
        sessionStatus: response.status || 'ACTIVE',
        detectedApps: response.detectedApps || [],
        collectedSlots: response.slots || {},
        executionResult: response.applicationId ? {
          parentApplicationId: response.applicationId,
          childApplicationIds: response.childApplicationIds || [],
        } : undefined,
      }));
    } catch (error) {
      console.error('Failed to load session:', error);
      throw error;
    }
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    startConversation,
    sendMessage,
    loadSession,
  };
}
