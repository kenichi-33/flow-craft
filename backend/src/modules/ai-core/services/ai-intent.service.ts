import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';

export interface DetectIntentRequest {
  text: string;
  allowedFlows: Array<{ id: string; name: string; description?: string }>;
  customPrompt?: string;
  provider?: string;
  model?: string;
}

export interface DetectIntentResponse {
  flowId: string;
  confidence: number;
  reasoning: string;
}

export interface DetectedApp {
  appId: string;
  appName: string;
  confidence: number;
  reason: string;
  requiredSlots?: string[];
  description?: string;
}

export interface AppDetectionRequest {
  message: string;
  availableApps: Array<{ id: string; name: string; description?: string }>;
}

export interface AppDetectionResponse {
  detectedApps: DetectedApp[];
  reasoning: string;
}

@Injectable()
export class AiIntentService {
  private readonly logger = new Logger(AiIntentService.name);

  constructor(
    private readonly llmGateway: LlmGatewayService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * ユーザー入力から最適なフローを検出
   */
  async detectIntent(
    request: DetectIntentRequest,
  ): Promise<DetectIntentResponse> {
    this.logger.log('Detecting intent from user input');

    const systemPrompt = `
You are a workflow intent classifier.
Your task is to analyze the user's input and select the most appropriate workflow from the allowed list.

Rules:
1. Analyze the user's intent and match it against the workflow descriptions.
2. Return the flowId with the highest confidence match.
3. Provide a confidence score (0.0 to 1.0).
4. Provide reasoning in Japanese.
5. Output must be in JSON format.

${request.customPrompt ? `Additional Instructions:\n${request.customPrompt}` : ''}

Output JSON Format:
{
  "flowId": "string",
  "confidence": number,
  "reasoning": "string"
}
`;

    const userPrompt = `
User Input: "${request.text}"

Allowed Workflows:
${JSON.stringify(request.allowedFlows, null, 2)}

Select the best matching workflow.
`;

    const response = await this.llmGateway.generate({
      systemPrompt,
      userPrompt,
      responseFormat: 'json_object',
      provider: request.provider,
      model: request.model || 'qwen2.5-coder:14b',
      temperature: 0.1,
    });

    return response.content as DetectIntentResponse;
  }

  /**
   * 複数アプリ意図検出
   * ユーザーメッセージから必要なアプリケーションを特定
   */
  async detectApps(
    request: AppDetectionRequest,
  ): Promise<AppDetectionResponse> {
    this.logger.log('Detecting apps from user message');

    const systemPrompt = `
あなたはワークフローアシスタントです。
ユーザーの要求を分析し、必要なアプリケーションを特定してください。

## ルール
1. ユーザーの要求から必要なアプリケーションを特定
2. 複数のアプリが必要な場合はすべて検出
3. 各アプリの信頼度スコア（0.0-1.0）を付与
4. なぜそのアプリが必要かの理由を説明

## 利用可能なアプリケーション:
${request.availableApps.map(app => `- ${app.name} (ID: ${app.id})${app.description ? `: ${app.description}` : ''}`).join('\n')}

## 回答形式
以下のJSON形式で回答してください:
{
  "detectedApps": [
    {
      "appId": "アプリID",
      "appName": "アプリ名",
      "reason": "このアプリが必要な理由",
      "confidence": 0.9
    }
  ],
  "reasoning": "全体的な判断理由"
}
`;

    const userPrompt = `ユーザー要求: "${request.message}"`;

    try {
      const response = await this.llmGateway.generate({
        model: this.configService.get('AI_CHAT_MODEL', 'qwen2.5:14b'),
        systemPrompt,
        userPrompt,
        temperature: 0.3,
      });

      const parsed = JSON.parse(response.rawContent);
      
      const detectedApps: DetectedApp[] = (parsed.detectedApps || []).map((d: any) => {
        const appDef = request.availableApps.find(a => a.id === d.appId);
        return {
          ...d,
          description: appDef?.description
        };
      });

      return {
        detectedApps,
        reasoning: parsed.reasoning || '',
      };
    } catch (error) {
      this.logger.error('Failed to detect apps', error);
      throw error;
    }
  }
}
