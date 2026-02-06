import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ILLMProvider,
  LLMRequest,
  LLMResponse,
} from '../llm-gateway.interface';
import OpenAI from 'openai';

@Injectable()
export class OpenAIProvider implements ILLMProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private client: OpenAI;

  constructor(private configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  getName(): string {
    return 'openai';
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model || 'gpt-4o';
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Use runtime API Key if provided, otherwise use default client
    let client = this.client;
    if (request.providerConfig?.apiKey) {
        client = new OpenAI({ apiKey: request.providerConfig.apiKey });
    }

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.userPrompt });

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: request.temperature ?? 0.7,
      response_format:
        request.responseFormat === 'json_object'
          ? { type: 'json_object' }
          : undefined,
      max_tokens: request.maxTokens,
    });

    const content = completion.choices[0].message.content;
    const usage = completion.usage;

    let parsedContent = content;
    if (request.responseFormat === 'json_object' && content) {
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        this.logger.warn('Failed to parse JSON response from OpenAI', e);
      }
    }

    return {
      content: parsedContent,
      rawContent: content || '',
      usage: {
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
      },
      provider: 'openai',
    };
  }
}
