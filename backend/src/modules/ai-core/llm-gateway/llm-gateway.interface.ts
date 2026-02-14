export interface LLMRequest {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  responseFormat?: 'text' | 'json_object';
  model?: string;
  maxTokens?: number;
  provider?: string;
  providerConfig?: {
    apiKey?: string;
    baseUrl?: string;
  };
}

export interface LLMResponse<T = any> {
  content: T;
  rawContent: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
}

export interface ILLMProvider {
  getName(): string;
  generate(request: LLMRequest): Promise<LLMResponse>;
  embed(text: string): Promise<number[]>;
}
