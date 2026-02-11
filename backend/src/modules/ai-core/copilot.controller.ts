import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Res,
  Get,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/types/user.interface';
import { AiCopilotService } from './services/ai-copilot.service';

@Controller('ai/copilot')
@UseGuards(JwtAuthGuard)
export class CopilotController {
  constructor(private readonly aiCopilotService: AiCopilotService) {}

  @Post('start')
  async startSession(@CurrentUser() user: AuthUser) {
    const session = await this.aiCopilotService.startSession(user.username);
    return {
      sessionId: session.id,
      agentName: session.agentName,
    };
  }

  @Post(':sessionId/chat')
  async chat(
    @Param('sessionId') sessionId: string,
    @Body() body: { message: string; context?: any },
    @CurrentUser() user: AuthUser,
  ) {
    // Check session ownership logic could be added here if strict privacy is needed
    // For now, minimal check via service finding the session
    const response = await this.aiCopilotService.chat({
      sessionId,
      message: body.message,
      userId: user.username,
      context: body.context,
    });

    return response;
  }

  @Get(':sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    return this.aiCopilotService.getSession(sessionId);
  }
}
