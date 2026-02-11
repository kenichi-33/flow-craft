import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';

@Injectable()
export class AiValidatorService {
  private readonly logger = new Logger(AiValidatorService.name);

  constructor(
    private readonly llmGateway: LlmGatewayService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * レビュー（フォーム/フロー定義）
   */
  async reviewDefinition(
    type: 'form' | 'flow',
    definition: any,
    requirements?: string,
  ): Promise<{
    score: number;
    issues: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }>;
    suggestions: string[];
    summary: string;
  }> {
    this.logger.log(`Reviewing ${type} definition`);

    const context =
      type === 'form'
        ? `You are a UI/UX expert reviewing a form definition (React JSON Schema Form).`
        : `You are a workflow expert reviewing a BPMN-like flow definition.`;

    const systemPrompt = `
${context}
Analyze the provided definition JSON and evaluate it based on best practices, usability, and logical correctness.

Requirements from user: ${requirements || 'None'}

Output JSON Format:
{
  "score": number, // 0-100
  "issues": [
    { "severity": "critical"|"warning"|"info", "message": "string (Japanese)" }
  ],
  "suggestions": ["string (Japanese)"],
  "summary": "string (Japanese)"
}
`;

    const userPrompt = `Definition JSON:\n${JSON.stringify(definition, null, 2)}`;

    try {
      const response = await this.llmGateway.generate({
        systemPrompt,
        userPrompt,
        responseFormat: 'json_object',
        model: this.configService.get('AI_CHAT_MODEL', 'qwen2.5-coder:14b'),
        temperature: 0.2,
      });

      return response.content as any;
    } catch (error) {
      this.logger.error('Failed to review definition', error);
      throw error;
    }
  }

  /**
   * AIによる項目チェック (AI Check Node)
   */
  async performCheck(
    data: any,
    criteria: string,
  ): Promise<{
    passed: boolean;
    reasoning: string;
    feedback: string;
  }> {
    this.logger.debug(`[DEBUG] performCheck called with criteria: ${criteria}`);
    this.logger.log('Performing AI check on data');

    const systemPrompt = `
You are an automated compliance officer.
Your task is to validate the provided application data against the specified criteria.

Criteria:
"${criteria}"

Rules:
1. strict adherence to the criteria.
2. Return "passed": true only if ALL criteria are met.
3. If passed is false, provide specific "feedback" to the applicant in Japanese.
4. "reasoning" should verify the logic used.

Output JSON:
{
  "passed": boolean,
  "reasoning": "string (Japanese)",
  "feedback": "string (Japanese)"
}
`;

    const userPrompt = `Application Data:\n${JSON.stringify(data, null, 2)}`;

    try {
      const response = await this.llmGateway.generate({
        systemPrompt,
        userPrompt,
        responseFormat: 'json_object',
        model: this.configService.get('AI_CHAT_MODEL', 'qwen2.5-coder:14b'),
        temperature: 0.1,
      });

      return response.content as any;
    } catch (error) {
      this.logger.error('Failed to perform AI check', error);
      throw error;
    }
  }
}
