import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ILLMProvider,
  LLMRequest,
  LLMResponse,
} from '../llm-gateway.interface';

@Injectable()
export class OllamaProvider implements ILLMProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://localhost:11434';
  }

  getName(): string {
    return 'ollama';
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const model =
      request.model ||
      this.configService.get<string>('OLLAMA_MODEL') ||
      'qwen2.5-coder:14b';
    
    // Use runtime Base URL if provided
    const baseUrl = request.providerConfig?.baseUrl || this.baseUrl;
    const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;

    const messages: { role: string; content: string }[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.userPrompt });

    const body = {
      model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens,
      },
      format: request.responseFormat === 'json_object' ? 'json' : undefined,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ollama API Error: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    const content = data.message?.content || '';

    let parsedContent = content;
    if (request.responseFormat === 'json_object' && content) {
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        this.logger.warn('Failed to parse JSON response from Ollama', e);
      }
    }

    return {
      content: parsedContent,
      rawContent: content,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      provider: 'ollama',
    };
  }
}
