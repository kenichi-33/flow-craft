import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmGatewayService } from './llm-gateway/llm-gateway.service';
import { OpenAIProvider } from './llm-gateway/providers/openai.provider';
import { OllamaProvider } from './llm-gateway/providers/ollama.provider';
import { AiBranchService } from './services/ai-branch.service';
import { WorkflowCoreModule } from '../workflow-engine/workflow-core.module';
import { QueueModule } from '../queue/queue.module';
import { AiGeneratorService } from './services/ai-generator.service';
import { AiCoreController } from './ai-core.controller';

import { AiFormFillerService } from './services/ai-form-filler.service';
import { ApplicationsModule } from '../applications/applications.module';
import { AgentService } from './services/agent.service';
import { ChatController } from './chat.controller';
import { UsersModule } from '../users/users.module';

@Global()
@Module({
  imports: [ConfigModule, WorkflowCoreModule, QueueModule, ApplicationsModule, UsersModule],
  controllers: [AiCoreController, ChatController],
  providers: [
    LlmGatewayService,
    OpenAIProvider,
    OllamaProvider,
    AiBranchService,
    AiGeneratorService,
    AiFormFillerService,
    AgentService,
    {
      provide: 'LLM_PROVIDERS',
      useFactory: (openai: OpenAIProvider, ollama: OllamaProvider) => [
        openai,
        ollama,
      ],
      inject: [OpenAIProvider, OllamaProvider],
    },
  ],
  exports: [LlmGatewayService, AiBranchService, AiGeneratorService, AiFormFillerService, AgentService],
})
export class AiCoreModule {}
