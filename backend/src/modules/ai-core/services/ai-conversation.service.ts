import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConversationStatus } from '@prisma/client';
import { ApplicationsService } from '../../applications/applications.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { AiIntentService } from './ai-intent.service';
import { AiSlotFillingService } from './ai-slot-filling.service';
import { AiExecutionService } from './ai-execution.service';

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

@Injectable()
export class AiConversationService {
  private readonly logger = new Logger(AiConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly llmGateway: LlmGatewayService,
    @Inject(forwardRef(() => ApplicationsService))
    private readonly applicationsService: ApplicationsService,
    private readonly aiIntentService: AiIntentService,
    private readonly aiSlotFillingService: AiSlotFillingService,
    private readonly aiExecutionService: AiExecutionService,
  ) {}

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
    const detection = await this.aiIntentService.detectApps({
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
    const slotResponse = await this.aiSlotFillingService.performSlotFilling(
      firstApp.appId,
      message,
      {}, // 初期スロットは空
      session.history as any[],
      firstApp.appName,
      firstApp.description,
    );

    // スロット更新
    const slots = session.slots as any || {};
    slots[firstApp.appId] = slotResponse.extractedInfo;
     await this.prisma.conversationSession.update({
      where: { id: session.id },
      data: { slots },
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
      const fields = await this.aiSlotFillingService.extractFormFields(app.appId);
      const requiredFields = fields.filter(f => f.required);
      // Fix: Check for strictly undefined or null, allow false/0
      const missingCount = requiredFields.filter(f => appSlots[f.id] === undefined || appSlots[f.id] === null || appSlots[f.id] === '').length;

      if (missingCount > 0) {
        targetAppId = app.appId;
        break;
      }
    }

    const appIdToUse = targetAppId || fallbackAppId;

    if (!appIdToUse) {
      return 'アプリケーションが見つかりません。';
    }

    const targetApp = detectedApps.find(a => a.appId === appIdToUse);

    // 情報収集を実行（ユーザーメッセージを処理し、スロットを更新）
    // 必須項目が揃っていても、任意項目の追加や値の修正のために呼び出す必要がある
    const slotResponse = await this.aiSlotFillingService.performSlotFilling(
      appIdToUse,
      message,
      slots[appIdToUse] || {},
      session.history as any[],
      targetApp?.appName,
      targetApp?.description,
    );

    // スロット更新
    const updatedSlots = { ...slots };
    updatedSlots[appIdToUse] = {
        ...(updatedSlots[appIdToUse] || {}),
        ...slotResponse.extractedInfo
    };
    
    // DB更新
     await this.prisma.conversationSession.update({
      where: { id: session.id },
      data: { slots: updatedSlots },
    });

    // スロット更新後の状態で再度完了判定
    let allComplete = true;
    
    for (const app of detectedApps) {
      const appSlots = updatedSlots[app.appId] || {};
      const fields = await this.aiSlotFillingService.extractFormFields(app.appId);
      const requiredFields = fields.filter(f => f.required);
      // Fix: Check for strictly undefined or null, allow false/0
      const missingCount = requiredFields.filter(f => appSlots[f.id] === undefined || appSlots[f.id] === null || appSlots[f.id] === '').length;

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

      return await this.aiExecutionService.generateConfirmationMessage(session.id);
    }

    // LLMからの質問はないが、システム的には未完了の場合
    // 不足している必須フィールドを探して明示的に聞く
    const missingFieldLabels: string[] = [];
    for (const app of detectedApps) {
      const appSlots = updatedSlots[app.appId] || {};
      const fields = await this.aiSlotFillingService.extractFormFields(app.appId);
      const requiredFields = fields.filter(f => f.required && (appSlots[f.id] === undefined || appSlots[f.id] === null || appSlots[f.id] === ''));
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
        const result = await this.aiExecutionService.executeApplications(session.id, session.userId);
        
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

      // セッションから最新のスロットを取得
      const slots = session.slots as any || {};
      const updatedSlots = { ...slots };

      for (const app of detectedApps) {
         try {
             // 修正のみを目的とする場合
             const result = await this.aiSlotFillingService.performSlotFilling(
                 app.appId,
                 message,
                 updatedSlots[app.appId] || {},
                 session.history as any[],
             );
             
             if (Object.keys(result.extractedInfo).length > 0) {
                 updated = true;
                 updatedSlots[app.appId] = {
                   ...(updatedSlots[app.appId] || {}),
                   ...result.extractedInfo
                 };
             }
         } catch (e) {
             this.logger.warn(`Failed to update slots for app ${app.appId}`, e);
         }
      }

      if (updated) {
          // DB更新
          await this.prisma.conversationSession.update({
              where: { id: session.id },
              data: { slots: updatedSlots },
          });

          return '承知しました。情報を更新しました。\n\n' + await this.aiExecutionService.generateConfirmationMessage(session.id);
      } else {
          // 再確認
          return '申し訳ございません。修正内容を特定できませんでした。修正したい項目と値を具体的に教えてください。\n\n' + await this.aiExecutionService.generateConfirmationMessage(session.id);
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
}
