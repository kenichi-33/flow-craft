import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiConversationService } from './services/ai-conversation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/types/user.interface';

interface StartChatRequest {
  flowId: string;
  agentName?: string;
  systemPrompt?: string;
  allowedApps?: string[];
}

interface SendMessageRequest {
  message: string;
}

@Controller('ai/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly aiConversationService: AiConversationService) {}

  /**
   * 新規会話セッション開始
   */
  @Post('start')
  async startChat(
    @Body() body: StartChatRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const session = await this.aiConversationService.startConversation(
      body.flowId,
      user.username, // user.idではなくusernameを使用
      {
        agentName: body.agentName,
        systemPrompt: body.systemPrompt,
        allowedApps: body.allowedApps,
      },
    );

    return {
      sessionId: session.id,
      agentName: session.agentName,
    };
  }

  /**
   * メッセージ送信（SSEストリーミング）
   */
  @Post(':sessionId/message')
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: SendMessageRequest,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    // セッション確認
    const session = await this.aiConversationService.getSession(sessionId);

    if (session.userId !== user.username) {
      throw new Error('Unauthorized access to session');
    }

    // SSEヘッダー設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginxのバッファリング無効化
    res.flushHeaders();

    try {
      // チャット処理
      const response = await this.aiConversationService.chat({
        sessionId,
        message: body.message,
        userId: user.username, // user.idではなくusernameを使用
      });

      // メッセージ送信
      res.write(
        `data: ${JSON.stringify({
          type: 'message',
          content: response.message,
          isComplete: response.isComplete,
        })}\n\n`,
      );

      // 完了通知
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (e) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`,
      );
      res.end();
    }
  }

  /**
   * 会話セッション取得（履歴含む）
   */
  @Get(':sessionId')
  async getSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const session = await this.aiConversationService.getSession(sessionId);

    // デバッグ用ログ
    if (session.userId !== user.username && session.userId !== user.id) {
      console.error(
        `Session Access Error: session.userId=${session.userId}, user.username=${user.username}, user.id=${user.id}`,
      );
    }

    const history = session.history as any[];
    console.log(
      `[ChatController] getSession: sessionId=${sessionId}, historyLength=${history?.length}, historyType=${typeof session.history}, isArray=${Array.isArray(session.history)}`,
    );

    // usernameまたはidのいずれかが一致すればOKとする
    if (session.userId !== user.username && session.userId !== user.id) {
      throw new Error('Unauthorized access to session');
    }

    return {
      id: session.id,
      flowId: session.flowId,
      status: session.status,
      agentName: session.agentName,
      history: session.history,
      context: session.context,
      applicationId: session.applicationId,
    };
  }
}
