import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConversationStatus } from '@prisma/client';
import { ApplicationsService } from '../../applications/applications.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { UsersService } from '../../users/users.service';

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

export interface ExtractParametersRequest {
  text: string;
  requiredSlots: string[];
  provider?: string;
  model?: string;
}

export interface ExtractParametersResponse {
  extractedData: Record<string, any>;
  missingSlots: string[];
  reasoning: string;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
  userId: string;
}

export interface ChatResponse {
  message: string;
  isComplete: boolean;
  extractedParameters?: Record<string, any>;
  suggestedFlowId?: string;
}

// 複数アプリ検出用の型定義
export interface DetectedApp {
  appId: string;
  appName: string;
  confidence: number;
  reason: string;
  requiredSlots?: string[];
}

// スロット抽出リクエスト・レスポンス
export interface MultiAppSlotExtractionRequest {
  detectedApps: DetectedApp[];
  history: Array<{ role: string; content: string }>;
  formSchemas: Record<string, any>; // appId -> form fields definition
}

export interface MultiAppSlotExtractionResponse {
  slotsByApp: Record<string, Record<string, any>>;
  globalMissingSlots: string[];
  aggregatedQuestion?: string;
}

// スロット収集リクエスト
export interface SlotFillingRequest {
  sessionId: string;
  userMessage: string;
  appId: string;
}

export interface SlotFillingResponse {
  extractedInfo: Record<string, any>;
  missingFields: string[];
  nextQuestion: string;
  isComplete: boolean;
}

export interface AppDetectionRequest {
  message: string;
  availableApps: Array<{ id: string; name: string; description?: string }>;
}

export interface AppDetectionResponse {
  detectedApps: DetectedApp[];
  reasoning: string;
}

export interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface SlotFillingRequest {
  sessionId: string;
  userMessage: string;
  appId: string;
}

export interface SlotFillingResponse {
  extractedInfo: Record<string, any>;
  missingFields: string[];
  nextQuestion: string;
  isComplete: boolean;
}

import { ConfigService } from '@nestjs/config';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly llmGateway: LlmGatewayService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ApplicationsService))
    private readonly applicationsService: ApplicationsService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflowEngineService: WorkflowEngineService,
    private readonly usersService: UsersService,
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
   * テキストから必須パラメータを抽出
   */
  async extractParameters(
    request: ExtractParametersRequest,
  ): Promise<ExtractParametersResponse> {
    this.logger.log('Extracting parameters from user input');

    const systemPrompt = `
You are a parameter extraction assistant.
Your task is to extract required parameters from the user's input.

Rules:
1. Extract as many required parameters as possible from the input.
2. For missing parameters, list them in "missingSlots".
3. Provide reasoning in Japanese.
4. Output must be in JSON format.

Output JSON Format:
{
  "extractedData": { "key": "value" },
  "missingSlots": ["slot1", "slot2"],
  "reasoning": "string"
}
`;

    const userPrompt = `
User Input: "${request.text}"

Required Parameters:
${request.requiredSlots.join(', ')}

Extract available parameters and identify missing ones.
`;

    const response = await this.llmGateway.generate({
      systemPrompt,
      userPrompt,
      responseFormat: 'json_object',
      provider: request.provider,
      model: request.model || 'qwen2.5-coder:14b',
      temperature: 0.1,
    });

    return response.content as ExtractParametersResponse;
  }

  /**
   * 会話セッションを開始
   */
  async startConversation(
    flowId: string,
    userId: string,
    config?: {
      agentName?: string;
      systemPrompt?: string;
      allowedApps?: string[];
    },
  ) {
    this.logger.log(`Starting conversation for user ${userId}, flow ${flowId}`);
    this.logger.log(`Config allowedApps: ${JSON.stringify(config?.allowedApps)}`);

    // FlowDefinitionを取得してformDefinitionIdを確認
    const flowDef = await this.prisma.flowDefinition.findUnique({
      where: { id: flowId },
      include: {
        applicationDefinitions: {
          take: 1, // AIスタートノードのApplicationDefinitionを取得
        },
      },
    });

    if (!flowDef) {
      throw new BadRequestException(`Flow ${flowId} not found`);
    }

    // ApplicationDefinitionから親Application作成
    let parentApplicationId: string | null = null;
    
    if (flowDef.applicationDefinitions && flowDef.applicationDefinitions.length > 0) {
      const appDef = flowDef.applicationDefinitions[0];
      
      if (appDef.formDefinitionId && appDef.flowDefinitionId) {

        const now = new Date();
        const formattedDate = new Date().toLocaleString('ja-JP', {
             year: 'numeric',
             month: '2-digit',
             day: '2-digit',
             hour: '2-digit',
             minute: '2-digit'
        });

        // 親Application作成
        const parentApp = await this.applicationsService.create({
          applicationDefinitionId: appDef.id,
          formDefinitionId: appDef.formDefinitionId,
          flowDefinitionId: appDef.flowDefinitionId,
          applicantId: userId, // userIdにはusernameが入っている
          title: `AIチャット申請 - ${formattedDate}`,
          inputData: {},
        });
        
        parentApplicationId = parentApp.id;
        this.logger.log(`Created parent application: ${parentApplicationId}`);
      }
    }

    // ConversationSession作成
    const session = await this.prisma.conversationSession.create({
      data: {
        flowId,
        userId,
        status: ConversationStatus.ACTIVE,
        agentName: config?.agentName,
        systemPrompt: config?.systemPrompt,
        allowedApps: config?.allowedApps || [],
        applicationId: parentApplicationId,
        context: {},
        history: [],
        detectedApps: [],
        slots: {},
        childApplicationIds: [],
      },
    });

    // 親Applicationに__conversationIdを即座に設定 (DRAFT段階で)
    if (parentApplicationId) {
      await this.prisma.application.update({
        where: { id: parentApplicationId },
        data: {
          inputData: {
            __conversationId: session.id,
          },
        },
      });
      this.logger.log(`Set __conversationId on parent application: ${parentApplicationId}`);
    }

    this.logger.log(
      `Created session ${session.id} with allowedApps: ${JSON.stringify(session.allowedApps)}`,
    );

    return session;
  }

  /**
   * 会話を継続（スロットフィリング）
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.logger.log(`Processing chat for session ${request.sessionId}`);

    const session = await this.getSession(request.sessionId);

    // 会話履歴に追加
    const history = Array.isArray(session.history) ? session.history : [];
    history.push({
      role: 'user',
      content: request.message,
      timestamp: new Date().toISOString(),
    });

    let responseMessage: string;
    let isComplete = false;

    // ステータスに応じた処理分岐
    switch (session.status) {
      case ConversationStatus.ACTIVE:
        // フェーズ1: アプリ検出
        responseMessage = await this.handleAppDetection(session, request.message);
        break;

      case ConversationStatus.COLLECTING:
        // フェーズ2: 情報収集
        responseMessage = await this.handleSlotFilling(session, request.message);
        break;

      case ConversationStatus.CONFIRMING:
        // フェーズ3: 確認
        responseMessage = await this.handleConfirmation(session, request.message);
        break;

      default:
        // デフォルトは通常の会話
        responseMessage = await this.handleNormalChat(session, history);
        break;
    }

    // 履歴に追加
    history.push({
      role: 'assistant',
      content: responseMessage,
      timestamp: new Date().toISOString(),
    });

    // セッション更新
    await this.prisma.conversationSession.update({
      where: { id: request.sessionId },
      data: { history, updatedAt: new Date() },
    });

    return {
      message: responseMessage,
      isComplete,
    };
  }

  /**
   * フェーズ1: アプリ検出処理
   */
  private async handleAppDetection(session: any, message: string): Promise<string> {
    const allowedApps = session.allowedApps || [];
    
    if (allowedApps.length === 0) {
      return '申し訳ございません。利用可能なアプリケーションが設定されていません。';
    }

    // アプリ定義を取得
    const appDefs = await this.prisma.applicationDefinition.findMany({
      where: { id: { in: allowedApps } },
      select: { id: true, name: true, description: true },
    });

    // アプリを検出
    const detection = await this.detectApps({
      message,
      availableApps: appDefs.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description || undefined,
      })),
    });

    if (detection.detectedApps.length === 0) {
      return 'どのアプリケーションを実行すればよいか判断できませんでした。もう少し詳しく教えてください。';
    }

    // セッションを更新（COLLECTING状態へ）
    await this.prisma.conversationSession.update({
      where: { id: session.id },
      data: {
        status: ConversationStatus.COLLECTING,
        detectedApps: detection.detectedApps as any,
      },
    });

    // 最初のアプリの情報収集を開始
    const firstApp = detection.detectedApps[0];
    const slotResponse = await this.performSlotFilling({
      sessionId: session.id,
      userMessage: message,
      appId: firstApp.appId,
    });

    let response = `以下のアプリケーションを検出しました:\n`;
    detection.detectedApps.forEach((app, i) => {
      response += `${i + 1}. ${app.appName}\n`;
    });
    response += `\n${slotResponse.nextQuestion}`;

    return response;
  }

  /**
   * フェーズ2: スロットフィリング処理
   */
  private async handleSlotFilling(session: any, message: string): Promise<string> {
    const detectedApps = session.detectedApps as any[];
    const slots = session.slots as any || {};

    // ターゲットアプリを決定（必須項目が不足しているアプリを優先）
    let targetAppId: string | null = null;
    let fallbackAppId: string | null = null;

    for (const app of detectedApps) {
      if (!fallbackAppId) fallbackAppId = app.appId;

      const appSlots = slots[app.appId] || {};
      const fields = await this.extractFormFields(app.appId);
      const requiredFields = fields.filter(f => f.required);
      const missingCount = requiredFields.filter(f => !appSlots[f.id]).length;

      if (missingCount > 0) {
        targetAppId = app.appId;
        break;
      }
    }

    const appIdToUse = targetAppId || fallbackAppId;

    if (!appIdToUse) {
      return 'アプリケーションが見つかりません。';
    }

    // 情報収集を実行（ユーザーメッセージを処理し、スロットを更新）
    // 必須項目が揃っていても、任意項目の追加や値の修正のために呼び出す必要がある
    const slotResponse = await this.performSlotFilling({
      sessionId: session.id,
      userMessage: message,
      appId: appIdToUse,
    });

    // スロット更新後の状態で再度完了判定
    const updatedSession = await this.getSession(session.id);
    const updatedSlots = updatedSession.slots as any || {};
    
    let allComplete = true;
    
    for (const app of detectedApps) {
      const appSlots = updatedSlots[app.appId] || {};
      const fields = await this.extractFormFields(app.appId);
      const requiredFields = fields.filter(f => f.required);
      const missingCount = requiredFields.filter(f => !appSlots[f.id]).length;

      if (missingCount > 0) {
        allComplete = false;
        break;
      }
    }

    if (slotResponse.nextQuestion) {
      return slotResponse.nextQuestion;
    }

    if (allComplete) {
      // すべての情報が揃った → 確認フェーズへ
      await this.prisma.conversationSession.update({
        where: { id: session.id },
        data: { status: ConversationStatus.CONFIRMING },
      });

      return await this.generateConfirmationMessage(session.id);
    }

    // LLMからの質問はないが、システム的には未完了の場合
    // 不足している必須フィールドを探して明示的に聞く
    const missingFieldLabels: string[] = [];
    for (const app of detectedApps) {
      const appSlots = updatedSlots[app.appId] || {};
      const fields = await this.extractFormFields(app.appId);
      const requiredFields = fields.filter(f => f.required && !appSlots[f.id]);
      if (requiredFields.length > 0) {
        missingFieldLabels.push(...requiredFields.map(f => f.label));
      }
    }

    if (missingFieldLabels.length > 0) {
      return `以下の必須項目がまだ入力されていません: ${missingFieldLabels.join(', ')}。\n入力をお願いします。中止する場合は「キャンセル」と言ってください。`;
    }

    // ここに来ることは理論上ないはずだが、念のため
    return '情報をありがとうございます。他に必要な情報はありますか？';
  }

  /**
   * フェーズ3: 確認処理
   */
  private async handleConfirmation(session: any, message: string): Promise<string> {
    const lowerMessage = message.toLowerCase().trim();
    
    if (lowerMessage.includes('はい') || lowerMessage.includes('実行') || lowerMessage.includes('yes')) {
      try {
        // アプリケーション実行
        const result = await this.executeApplications(session.id, session.userId);
        
        return `✅ アプリケーションを実行しました!\n\n` +
               `親Application ID: ${result.parentApplicationId}\n` +
               `実行した子Application数: ${result.childApplicationIds.length}\n\n` +
               `各アプリケーションのワークフローが開始されました。`;
      } catch (error) {
        this.logger.error('Failed to execute applications', error);
        return '申し訳ございません。アプリケーションの実行中にエラーが発生しました。';
      }
    } else if (lowerMessage.includes('いいえ') || lowerMessage.includes('キャンセル') || lowerMessage.includes('no')) {
      // キャンセル
      await this.prisma.conversationSession.update({
        where: { id: session.id },
        data: { status: ConversationStatus.CANCELED },
      });

      return '実行をキャンセルしました。';
    } else {
      // 修正指示の可能性あり
      // すべての検出済みアプリに対してスロットフィリングを再実行
      const detectedApps = session.detectedApps as any[];
      let updated = false;

      // 修正指示であることを伝えるためにシステムプロンプトを少し調整したいが、
      // performSlotFillingは汎用的に作られているのでそのまま利用してみる。
      // ただし、現状のシステムプロンプトは「不足している情報を特定」に重点が置かれている。
      // 修正の場合は「既存の値を上書き」する動作が必要。
      // performSlotFilling内のupdatedSlotsマージロジックは上書きするのでOK。

      for (const app of detectedApps) {
         try {
             // 修正のみを目的とする場合、本来はmissingFieldsのチェックなどは不要だが、
             // 既存のメソッドを再利用する。
             const result = await this.performSlotFilling({
                 sessionId: session.id,
                 userMessage: message,
                 appId: app.appId
             });
             
             if (Object.keys(result.extractedInfo).length > 0) {
                 updated = true;
             }
         } catch (e) {
             this.logger.warn(`Failed to update slots for app ${app.appId}`, e);
         }
      }

      if (updated) {
          return '承知しました。情報を更新しました。\n\n' + await this.generateConfirmationMessage(session.id);
      } else {
          // 再確認
          return '申し訳ございません。修正内容を特定できませんでした。修正したい項目と値を具体的に教えてください。\n\n' + await this.generateConfirmationMessage(session.id);
      }
    }
  }

  /**
   * 通常の会話処理（フォールバック）
   */
  private async handleNormalChat(session: any, history: any[]): Promise<string> {
    const systemPrompt =
      session.systemPrompt ||
      `
You are a helpful assistant helping users to fill out workflow forms.
Your goal is to gather all required information through natural conversation.
Be friendly and concise.
`;

    const conversationContext = history
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const response = await this.llmGateway.generate({
      model: this.configService.get('AI_CHAT_MODEL', 'qwen2.5:14b'),
      systemPrompt,
      userPrompt: conversationContext,
      temperature: 0.7,
    });

    return response.rawContent;
  }

  /**
   * セッション情報取得
   */
  async getSession(sessionId: string) {
    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Conversation session not found');
    }

    return session;
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
      
      return {
        detectedApps: parsed.detectedApps || [],
        reasoning: parsed.reasoning || '',
      };
    } catch (error) {
      this.logger.error('Failed to detect apps', error);
      throw error;
    }
  }

  /**
   * ApplicationDefinitionからフォームフィールドを抽出
   */
  async extractFormFields(appDefinitionId: string): Promise<FormField[]> {
    this.logger.log(`Extracting form fields for app ${appDefinitionId}`);

    const appDef = await this.prisma.applicationDefinition.findUnique({
      where: { id: appDefinitionId },
      include: { formDefinition: true },
    });

    if (!appDef || !appDef.formDefinition) {
      throw new NotFoundException('Application definition or form not found');
    }

    const formSchema = appDef.formDefinition.schema as any;
    const fields: FormField[] = [];

    // スキーマからフィールドを抽出
    if (formSchema.properties) {
      for (const [fieldId, fieldDef] of Object.entries(formSchema.properties)) {
        const def = fieldDef as any;
        let type = def.type || 'string';

        // ファイルタイプの判定
        if (def.type === 'file' || def['x-type'] === 'file' || (def.type === 'string' && def.format === 'binary')) {
             type = 'file';
        } else if (def.format) {
            type = `${def.type} (${def.format})`;
        }

        fields.push({
          id: fieldId,
          label: def.title || fieldId,
          type: type,
          required: formSchema.required?.includes(fieldId) || false,
          description: def.description,
        });
      }
    }

    return fields;
  }

  /**
   * スロットフィリング - LLMを使用して情報を抽出
   */
  async performSlotFilling(
    request: SlotFillingRequest,
  ): Promise<SlotFillingResponse> {
    this.logger.log(`Performing slot filling for app ${request.appId}`);


    const session = await this.getSession(request.sessionId);
    const fields = await this.extractFormFields(request.appId);
    this.logger.log(`Extracted fields count: ${fields.length}`);

    
    // 現在のスロット（既に収集済みの情報）
    const currentSlots = (session.slots as any)[request.appId] || {};

    const systemPrompt = `
あなたは情報収集アシスタントです。
ユーザーとの会話から必要な情報を抽出してください。

## 必要な情報フィールド:
${fields.map(f => `- ${f.label} (${f.id}): ${f.type}${f.required ? ' [必須]' : ' [任意]'}${f.description ? ` - ${f.description}` : ''}`).join('\n')}

## 現在収集済みの情報:
${JSON.stringify(currentSlots, null, 2)}

## タスク:
1. ユーザーの最新メッセージから情報を抽出
   - **重要**: 必須フィールドだけでなく、**任意フィールド**も積極的に抽出してください。
   - **重要**: 既に値が入っているフィールドでも、ユーザーが新しい値を指定した場合は**上書き更新**してください。
2. まだ不足している必須フィールド、任意フィールドを特定
3. 次に聞くべき質問を生成
   - **優先順位1**: 不足している必須フィールドについて質問してください。
   - **優先順位2**: 必須フィールドが揃っていても、未入力の任意フィールドがある場合は、「〇〇（任意項目）については入力しますか？」と確認してください。
   - **優先順位3**: 全ての情報が揃った、またはユーザーが「ない」「不要」と言った場合は質問なし（完了）としてください。
4. 完了判定
   - 必須情報が全て揃っており、かつユーザーへの確認事項がなければ完了フラグを立ててください。

## コメント・補足情報の抽出:
- フォーム定義に \`notes\`, \`description\`, \`remarks\`, \`comment\` などのテキストフィールドが存在する場合、ユーザーのメッセージに含まれる補足的な発言やコメントをそのフィールドに抽出してください。
- ファイルアップロード時のコメント（例:「領収書です。接待費として計上します」）は特に重要です。この場合、「接待費として計上します」の部分をコメントフィールドに抽出してください。

## データ形式:
各フィールドの値は以下のフォーマットに従ってください:
- **数値 (number/integer)**: 半角数字のみを使用してください。カンマ、単位、全角数字は含めないでください。(例: 3000)
- **日付 (date/datetime)**: YYYY-MM-DD 形式または YYYY-MM-DD HH:mm:ss 形式で抽出してください。(例: 2024-01-15)
- **真偽値 (boolean)**: true または false のみを使用してください。(例: true)

## ファイル添付に関するルール:
- ユーザーメッセージ履歴に「ファイルをアップロードしました: [ファイル名] (ID: [UUID])」のようなメッセージが含まれている場合、そのファイルID（UUID）を抽出してください。
- フォームフィールドに \`type: file\` または \`attachment\` という名前のフィールドがあり、ユーザーがファイルをアップロード済みの場合は、その **ファイルID** を抽出値として使用してください。
- **重要**: ファイル名は抽出しないでください。必ずUUID形式のIDを使用してください。
- **重要**: JSONのキー（フィールドID）は、必ず上記の「必要な情報フィールド」に記載されているIDと完全に一致させてください。勝手に新しいID（例: receipt_file）を作らないでください。
- 抽出例: {"receipt": "550e8400-e29b-41d4-a716-446655440000"}

## 回答形式:
以下のJSON形式で回答してください:
{
  "extractedInfo": {
    "フィールドID": "抽出した値"
  },
  "missingFields": ["不足しているフィールドID"],
  "nextQuestion": "次に聞くべき質問（日本語）",
  "isComplete": false
}
`;

    const history = (session.history as any[] || [])
      .slice(-10)
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `
## 会話履歴:
${history}

## 最新のメッセージ:
"${request.userMessage}"
`;

    try {
      this.logger.log(`Calling LLM Gateway. User Prompt:\n${userPrompt}`);
      const response = await this.llmGateway.generate({
        model: this.configService.get('AI_CHAT_MODEL', 'qwen2.5:14b'),
        systemPrompt,
        userPrompt,
        temperature: 0.1, // 温度を下げて抽出精度を上げる
      });

      this.logger.log(`LLM raw response: ${response.rawContent}`);

      const parsed = JSON.parse(response.rawContent);
      
      this.logger.log(`Parsed extractedInfo: ${JSON.stringify(parsed.extractedInfo)}`);
      this.logger.log(`Available fields: ${JSON.stringify(fields.map(f => ({ id: f.id, type: f.type })))}`);

      // キーごとに型変換を実行
      const convertedInfo: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsed.extractedInfo || {})) {
        const field = fields.find(f => f.id === key);
        this.logger.log(`Converting field "${key}": value="${value}", fieldType="${field?.type || 'unknown'}"`);
        if (field) {
          convertedInfo[key] = this.convertValue(value, field.type, key);
        } else {
          convertedInfo[key] = value;
        }
        this.logger.log(`Converted "${key}": ${convertedInfo[key]} (${typeof convertedInfo[key]})`);
      }

      // スロットを更新
      const updatedSlots = {
        ...currentSlots,
        ...convertedInfo,
      };

      this.logger.log(`Updated slots for app ${request.appId}: ${JSON.stringify(updatedSlots)}`);

      // セッション更新
      const allSlots = (session.slots as any) || {};
      allSlots[request.appId] = updatedSlots;

      await this.prisma.conversationSession.update({
        where: { id: request.sessionId },
        data: { slots: allSlots },
      });

      return {
        extractedInfo: convertedInfo,
        missingFields: parsed.missingFields || [],
        nextQuestion: parsed.nextQuestion || '',
        isComplete: parsed.isComplete || false,
      };
    } catch (error) {
      this.logger.error('Failed to perform slot filling', error);
      throw error;
    }
  }

  /**
   * 値をフィールド型に合わせて変換
   */
  private convertValue(value: any, type: string, fieldId?: string): any {
    if (value === null || value === undefined) return null;

    // もし値がオブジェクトで、idプロパティを持っている場合（LLMが誤ってオブジェクトを返した場合の救済措置）
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (value.id) return value.id;
      if (value.field_id) return value.field_id;
      if (value.file_id) return value.file_id;
      // 値として使えそうなプロパティが見つからない場合は、JSON文字列化して返す（Reactエラー回避のため）
      return JSON.stringify(value);
    }
    
    // 型情報からフォーマットを除去 ("number (currency)" -> "number")
    const baseType = type.split(' ')[0].trim();
    
    // 金額関連のフィールド名は強制的に数値変換を試みる
    const isAmountField = fieldId && /amount|price|cost|fee|salary|total|sum/i.test(fieldId);
    
    switch (baseType) {
      case 'number':
      case 'integer':
         return this.convertToNumber(value);
      
      case 'boolean':
         if (typeof value === 'boolean') return value;
         if (typeof value === 'string') {
             if (value.toLowerCase() === 'true') return true;
             if (value.toLowerCase() === 'false') return false;
         }
         return value;

      case 'date':
      case 'datetime':
         return value;

      default:
         // フィールド名が金額を示唆する場合は数値変換を試みる
         if (isAmountField && typeof value === 'string') {
           const numValue = this.convertToNumber(value);
           if (typeof numValue === 'number') return numValue;
         }
         return value;
    }
  }

  /**
   * 文字列を数値に変換（カンマや単位を除去）
   */
  private convertToNumber(value: any): any {
    if (typeof value === 'number') return value;
    
    if (typeof value === 'string') {
      // 全角数字を半角数字に変換
      const zenkaku = value.replace(/[０-９]/g, (s) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
      });

      // 3桁区切りのカンマを除去し、数字・小数点・マイナス以外を除去
      const cleanStr = zenkaku.replace(/,/g, '').replace(/[^0-9.-]/g, '');
      if (cleanStr === '') return value; // 数字が含まれていない場合は元の値を返す
      const num = Number(cleanStr);
      return isNaN(num) ? value : num;
    }
    
    const num = Number(value);
    return isNaN(num) ? value : num;
  }

  /**
   * 実行確認メッセージを生成
   */
  async generateConfirmationMessage(sessionId: string): Promise<string> {
    this.logger.log(`Generating confirmation for session ${sessionId}`);

    const session = await this.getSession(sessionId);
    const detectedApps = session.detectedApps as any[];
    const slots = session.slots as any;

    if (!detectedApps || detectedApps.length === 0) {
      return '実行するアプリケーションが見つかりません。';
    }

    let message = '以下のアプリケーションを実行します。よろしいですか？\n\n';

    for (let i = 0; i < detectedApps.length; i++) {
      const app = detectedApps[i];
      const appSlots = slots[app.appId] || {};
      
      message += `${i + 1}. **${app.appName}**\n`;
      message += `   理由: ${app.reason}\n`;
      
      if (Object.keys(appSlots).length > 0) {
        message += '   入力情報:\n';
        for (const [key, value] of Object.entries(appSlots)) {
          message += `   - ${key}: ${value}\n`;
        }
      }
      message += '\n';
    }

    message += '実行する場合は「はい」または「実行」と入力してください。';

    return message;
  }

  /**
   * アプリケーションを実行
   * 親Applicationと複数の子Applicationを作成し、ワークフローを開始
   */
  async executeApplications(sessionId: string, userId: string): Promise<{
    parentApplicationId: string;
    childApplicationIds: string[];
  }> {
    this.logger.log(`Executing applications for session ${sessionId}`);

    const session = await this.getSession(sessionId);
    const detectedApps = session.detectedApps as any[];
    const slots = session.slots as any;

    if (!detectedApps || detectedApps.length === 0) {
      throw new BadRequestException('No apps detected to execute');
    }

    // 親ApplicationIDを取得（startConversationで作成済み）
    const parentApplicationId = (session as any).applicationId;
    
    if (!parentApplicationId) {
      throw new BadRequestException(
        'Parent application not found. Session may not have been properly initialized.',
      );
    }

    this.logger.log(`Using parent application: ${parentApplicationId}`);

    // 親Applicationを取得して申請者情報を確認
    const parentApp = await this.prisma.application.findUnique({
      where: { id: parentApplicationId },
    });

    if (!parentApp) {
      throw new BadRequestException('Parent application not found in database');
    }

    const parentApplicantId = parentApp.applicantId;

    // 親ApplicationをIN_PROGRESSに更新（一覧に表示されるように）
    await this.prisma.application.update({
      where: { id: parentApplicationId },
      data: { status: 'IN_PROGRESS' },
    });

    // 各検出されたアプリの子Application作成
    const childApplicationIds: string[] = [];

    for (const detectedApp of detectedApps) {
      const appSlots = slots[detectedApp.appId] || {};

      try {
        // ApplicationDefinitionを取得
        const appDef = await this.prisma.applicationDefinition.findUnique({
          where: { id: detectedApp.appId },
        });

        if (!appDef || !appDef.formDefinitionId || !appDef.flowDefinitionId) {
          this.logger.error(`Invalid application definition: ${detectedApp.appId}`);
          continue;
        }

        // 子Application作成（親の申請者を使用）
        const childApp = await this.applicationsService.create({
          applicationDefinitionId: detectedApp.appId,
          formDefinitionId: appDef.formDefinitionId,
          flowDefinitionId: appDef.flowDefinitionId,
          applicantId: parentApplicantId, // 親の申請者を使用
          title: detectedApp.appName || '自動申請',
          inputData: appSlots,
        });

        // フロー定義からstartノードを取得
        const flowDef = await this.prisma.flowDefinition.findUnique({
          where: { id: appDef.flowDefinitionId },
        });

        if (!flowDef) {
          this.logger.error(`Flow definition not found: ${appDef.flowDefinitionId}`);
          continue;
        }

        const flowNodes = (childApp.flowNodes || flowDef.nodes) as any[];
        const startNode = flowNodes.find((n: any) => n.type === 'start');

        if (!startNode) {
          this.logger.error(`Start node not found in flow: ${appDef.flowDefinitionId}`);
          continue;
        }

        // ApplicationをIN_PROGRESSに更新し、currentNodeIdを設定
        await this.prisma.application.update({
          where: { id: childApp.id },
          data: {
            status: 'IN_PROGRESS',
            currentNodeId: startNode.id,
            parentId: parentApplicationId,
          },
        });

        // 承認履歴にSTARTアクションを記録
        await this.prisma.approvalHistory.create({
          data: {
            applicationId: childApp.id,
            actorId: parentApplicantId, // 親の申請者を使用
            actorInfo: { username: parentApplicantId }, // 簡易情報
            action: 'START',
            stepId: startNode.id,
            comment: 'AIチャットから自動申請を開始しました',
          },
        });

        // ワークフロー開始
        await this.workflowEngineService['helper'].advanceToNextNode(
          childApp.id,
        );

        childApplicationIds.push(childApp.id);
        this.logger.log(`Created and started child application: ${childApp.id}`);
      } catch (error) {
        this.logger.error(`Failed to create child app ${detectedApp.appId}`, error);
        // エラーでも続行（一部失敗を許容）
      }
    }

    if (childApplicationIds.length === 0) {
      throw new BadRequestException('Failed to create any child applications');
    }

    // セッション更新
    await this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        childApplicationIds,
      },
    });

    // 親申請のワークフロー開始
    if (parentApplicationId) {
        try {
            const session = await this.prisma.conversationSession.findUnique({
                where: { id: sessionId },
                select: { flowId: true }
            });

            if (session) {
                // フロー定義からstartノードを取得
                const flowDef = await this.prisma.flowDefinition.findUnique({
                    where: { id: session.flowId },
                });

                if (flowDef && flowDef.nodes) {
                    const nodes = flowDef.nodes as any[];
                    const startNode = nodes.find((n: any) => n.type === 'start' || n.type === 'aiStart'); // aiStartも考慮

                    if (startNode) {
                        // ApplicationをIN_PROGRESSに更新し、currentNodeIdを設定
                        // inputDataにconversationIdを保存
                        const parentApp = await this.prisma.application.findUnique({
                             where: { id: parentApplicationId },
                             select: { inputData: true, applicantId: true }
                        });
                        
                        const currentInput = parentApp?.inputData ? (parentApp.inputData as Record<string, any>) : {};
                        const newInputData = {
                            ...currentInput,
                            __conversationId: sessionId,
                            __childApplicationIds: childApplicationIds
                        };

                        await this.prisma.application.update({
                            where: { id: parentApplicationId },
                            data: {
                                status: 'IN_PROGRESS',
                                currentNodeId: startNode.id,
                                inputData: newInputData,
                            },
                        });

                         this.logger.log(`Updated parent application status to IN_PROGRESS: ${parentApplicationId}`);
                         
                         // 親申請の履歴を作成 (AI_STARTアクション)
                         await this.prisma.approvalHistory.create({
                             data: {
                                 applicationId: parentApplicationId,
                                 actorId: parentApp?.applicantId || 'SYSTEM', // 申請者またはSYSTEM
                                 actorInfo: { username: parentApp?.applicantId || 'AI' },
                                 action: 'AI_START',
                                 stepId: startNode.id,
                                 comment: 'AIチャットにより申請が自動生成され、子申請が開始されました。全ての子申請が完了すると自動的に進行します。',
                             }
                         });

                         // 親申請は子申請の完了を待つため、ここでは進めない
                         // タスクを作成して待機状態にする
                         // ユーザー名を取得
                         let displayName = parentApp?.applicantId || 'SYSTEM';
                         if (parentApp?.applicantId) {
                             try {
                                 const userSnapshot = await this.usersService.getUserSnapshotByUsername(parentApp.applicantId);
                                 if (userSnapshot.lastName || userSnapshot.firstName) {
                                     displayName = `${userSnapshot.lastName || ''} ${userSnapshot.firstName || ''}`.trim();
                                 } else {
                                     displayName = userSnapshot.username;
                                 }
                             } catch (e) {
                                 this.logger.warn(`Failed to get user snapshot for ${parentApp.applicantId}`, e);
                             }
                         }
                         
                         await this.prisma.workflowTask.create({
                             data: {
                                 applicationId: parentApplicationId,
                                 stepId: startNode.id,
                                 status: 'PENDING',
                                 assignedTo: parentApp?.applicantId || 'SYSTEM',
                                 assignedToDisplay: displayName,
                                 type: 'aiStarting', // 識別しやすいタイプにする
                                 config: {
                                     title: 'AI申請調整中',
                                     description: 'AIチャットによる申請内容の調整中です。子申請が全て完了すると自動的に進行します。'
                                 },
                             }
                         });
                         
                         this.logger.log(`Created pending task for AI Start node: ${startNode.id}`);
                         // await this.workflowEngineService['helper'].advanceToNextNode(parentApplicationId);
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Failed to start parent application ${parentApplicationId}`, error);
        }
    }

    return {
      parentApplicationId,
      childApplicationIds,
    };
  }
}
