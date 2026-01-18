import { Module, OnModuleInit } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowExecutorService } from './workflow-executor.service';
import { WorkflowEngineController } from './workflow-engine.controller';
import { WebhookController } from './webhook.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { TeamsModule } from '../teams/teams.module';

// Worker Infrastructure
import {
    TaskHandlerRegistry,
    GenericWorker,
    ApiCallHandler,
    LlmCallHandler,
    ApprovalHandler,
    EmailTaskHandler,
    SlackTaskHandler,
    UserInputHandler,
    SchedulerWorker,
} from './workers';

// Processors
import { WorkflowHelperService } from './workflow-helper.service';
import { NodeProcessorRegistry } from './processors/node-processor.registry';
import { EndNodeProcessor } from './processors/end-node.processor';
import { ApprovalNodeProcessor } from './processors/approval-node.processor';
import { BranchNodeProcessor } from './processors/branch-node.processor';
import { ServiceTaskProcessor } from './processors/service-task.processor';
import { ParallelGatewayProcessor } from './processors/parallel-node.processor';
import { JoinGatewayProcessor } from './processors/join-node.processor';
import { SendEmailProcessor } from './processors/send-email.processor';
import { DelayNodeProcessor } from './processors/delay-node.processor';
import { UserInputNodeProcessor } from './processors/user-input-node.processor';
import { UpdateRecordProcessor } from './processors/update-record.processor';
import { SetVariableProcessor } from './processors/set-variable.processor';
import { SlackProcessor } from './processors/slack.processor';

@Module({
    imports: [
        NotificationsModule, 
        UsersModule,
        QueueModule,
        TeamsModule,
    ],
    controllers: [WorkflowEngineController, WebhookController],
    providers: [
        WorkflowEngineService,
        WorkflowExecutorService,
        // Worker Infrastructure
        TaskHandlerRegistry,
        GenericWorker,
        SchedulerWorker,
        // Task Handlers (Legacy/Worker Side)
        ApiCallHandler,
        LlmCallHandler,
        ApprovalHandler,
        EmailTaskHandler,
        SlackTaskHandler,
        UserInputHandler,
        
        // New Processor Architecture
        WorkflowHelperService,
        NodeProcessorRegistry,
        EndNodeProcessor,
        ApprovalNodeProcessor,
        BranchNodeProcessor,
        ServiceTaskProcessor,
        ParallelGatewayProcessor,
        JoinGatewayProcessor,
        SendEmailProcessor,
        DelayNodeProcessor,
        UserInputNodeProcessor,
        UpdateRecordProcessor,
        SetVariableProcessor,
        SlackProcessor,
    ],
    exports: [WorkflowEngineService, TaskHandlerRegistry],
})
export class WorkflowEngineModule implements OnModuleInit {
    constructor(
        private readonly handlerRegistry: TaskHandlerRegistry,
        private readonly apiCallHandler: ApiCallHandler,
        private readonly llmCallHandler: LlmCallHandler,
        private readonly approvalHandler: ApprovalHandler,
        private readonly emailTaskHandler: EmailTaskHandler,
        private readonly slackTaskHandler: SlackTaskHandler,
        private readonly userInputHandler: UserInputHandler,
        
        // Processors
        private registry: NodeProcessorRegistry,
        private endProcessor: EndNodeProcessor,
        private approvalProcessor: ApprovalNodeProcessor,
        private branchProcessor: BranchNodeProcessor,
        private serviceProcessor: ServiceTaskProcessor,
        private parallelProcessor: ParallelGatewayProcessor,
        private joinProcessor: JoinGatewayProcessor,
        private sendEmailProcessor: SendEmailProcessor,
        private delayProcessor: DelayNodeProcessor,
        private userInputNodeProcessor: UserInputNodeProcessor,
        private readonly updateRecordProcessor: UpdateRecordProcessor,
        private readonly setVariableProcessor: SetVariableProcessor,
        private readonly slackProcessor: SlackProcessor,
    ) {}

    onModuleInit() {
        // Register legacy handlers
        this.handlerRegistry.registerAll([
            this.apiCallHandler,
            this.llmCallHandler,
            this.approvalHandler,
            this.emailTaskHandler,
            this.slackTaskHandler,
            this.userInputHandler,
        ]);
        
        // Register aliases (No alias needed since handler type is now userInput)

        // Register new processors
        this.registry.register(this.endProcessor);
        this.registry.register(this.approvalProcessor);
        this.registry.register(this.branchProcessor);
        this.registry.registerAlias('apiCall', this.serviceProcessor);
        this.registry.registerAlias('llmCall', this.serviceProcessor);
        this.registry.register(this.parallelProcessor);
        this.registry.register(this.joinProcessor);
        this.registry.register(this.sendEmailProcessor);
        this.registry.register(this.delayProcessor);
        this.registry.register(this.userInputNodeProcessor);
            // Alias for backward compatibility if needed, but native type is now userInput
            this.registry.registerAlias('input', this.userInputNodeProcessor); 
        this.registry.register(this.updateRecordProcessor);
        this.registry.register(this.setVariableProcessor);
        this.registry.register(this.slackProcessor);
    }
}
