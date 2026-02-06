import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { LLMRequest, LLMResponse, ILLMProvider } from './llm-gateway.interface';

@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);
  private providers: Map<string, ILLMProvider> = new Map();

  constructor(
    @Optional() @Inject('LLM_PROVIDERS') providers: ILLMProvider[] = [],
  ) {
    providers.forEach((provider) => {
      this.providers.set(provider.getName(), provider);
      this.logger.log(`Registered LLM Provider: ${provider.getName()}`);
    });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const providerName = request.provider || process.env.AI_PROVIDER || 'ollama'; // Use request provider first
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`LLM Model Provider not found: ${providerName}`);
    }

    this.logger.log(`Sending request to LLM Provider: ${providerName}`);
    try {
      return await provider.generate(request);
    } catch (error) {
      this.logger.error(`LLM Generation failed: ${error}`);
      throw error;
    }
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
