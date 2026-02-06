import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';

export interface BranchRule {
  id: string;
  label: string;
  aiCondition: string;
}

export interface AiBranchRequest {
  formData: Record<string, any>;
  branchRules: BranchRule[];
  piiMasking?: boolean;
  provider?: string;
  model?: string;
  temperature?: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface AiBranchResponse {
  selectedRouteId: string;
  reasoning: string;
}

@Injectable()
export class AiBranchService {
  private readonly logger = new Logger(AiBranchService.name);

  constructor(private readonly llmGateway: LlmGatewayService) {}

  async evaluate(request: AiBranchRequest): Promise<AiBranchResponse> {
    const { formData, branchRules, model, temperature, provider, apiKey, baseUrl } = request;

    // TODO: Implement PII Masking logic here if needed
    // const maskedFormData = this.maskPii(formData);

    const systemPrompt = `
You are a workflow decision helper.
Your task is to select the most appropriate route based on the provided form data and branch rules.

Rules:
1. You must carefully analyze the "formData" and match it against each "branchRule".
2. You must select exactly one "id" from the branchRules.
3. You must provide a clear "reasoning" for your decision. MUST BE IN JAPANESE.
4. Output must be in strictly JSON format.
5. If no rule perfectly matches, choose the one with "default" or "fallback" intent if present, otherwise choose the most logical one or a default id if specified in rules.

Output JSON Format:
{
  "selectedRouteId": "string",
  "reasoning": "string"
}
`;

    const userPrompt = `
Form Data:
${JSON.stringify(formData, null, 2)}

Branch Rules:
${JSON.stringify(branchRules, null, 2)}

Select the best route.
`;

    const response = await this.llmGateway.generate({
      systemPrompt,
      userPrompt,
      responseFormat: 'json_object',
      provider: provider,
      model: model || 'qwen2.5-coder:14b', // Default recommended model
      temperature: temperature ?? 0.1, // Low temperature for deterministic results (0 is falsy, so use ??)
      providerConfig: {
        apiKey,
        baseUrl
      }
    });

    const content = response.content;

    if (!content.selectedRouteId) {
      this.logger.error('Invalid AI Branch Response', content);
      throw new Error('AI failed to select a route');
    }

    return {
      selectedRouteId: content.selectedRouteId,
      reasoning: content.reasoning || 'No reasoning provided',
    };
  }
}
