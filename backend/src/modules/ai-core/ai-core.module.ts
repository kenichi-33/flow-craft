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
import { ChatController } from './chat.controller';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../storage/storage.module';
import { AiIntentService } from './services/ai-intent.service';
import { AiSlotFillingService } from './services/ai-slot-filling.service';
import { AiValidatorService } from './services/ai-validator.service';
import { AiExecutionService } from './services/ai-execution.service';
import { AiConversationService } from './services/ai-conversation.service';
import { AiCopilotService } from './services/ai-copilot.service';
import { CopilotController } from './copilot.controller';
import { RagService } from './services/rag.service';
import { RagController } from './rag.controller';

@Global()
@Module({
  imports: [
    ConfigModule,
    WorkflowCoreModule,
    QueueModule,
    ApplicationsModule,
    UsersModule,
    StorageModule,
  ],
  controllers: [
    AiCoreController,
    ChatController,
    CopilotController,
    RagController,
  ],
  providers: [
    LlmGatewayService,
    OpenAIProvider,
    OllamaProvider,
    AiBranchService,
    AiGeneratorService,
    AiFormFillerService,
    AiIntentService,
    AiSlotFillingService,
    AiValidatorService,
    AiExecutionService,
    AiConversationService,
    AiCopilotService,
    RagService,
    {
      provide: 'LLM_PROVIDERS',
      useFactory: (openai: OpenAIProvider, ollama: OllamaProvider) => [
        openai,
        ollama,
      ],
      inject: [OpenAIProvider, OllamaProvider],
    },
  ],
  exports: [
    LlmGatewayService,
    AiBranchService,
    AiGeneratorService,
    AiFormFillerService,
    AiIntentService,
    AiSlotFillingService,
    AiValidatorService,
    AiExecutionService,
    AiConversationService,
    AiCopilotService,
    RagService,
  ],
})
export class AiCoreModule {}
