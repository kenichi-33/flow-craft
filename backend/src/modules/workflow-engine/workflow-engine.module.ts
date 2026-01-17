import { Module, OnModuleInit } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowExecutorService } from './workflow-executor.service';
import { WorkflowEngineController } from './workflow-engine.controller';
import { WebhookController } from './webhook.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../../prisma/prisma.module';

// Worker Infrastructure
import {
    TaskHandlerRegistry,
    GenericWorker,
    ApiCallHandler,
    LlmCallHandler,
    ApprovalHandler,
    EmailTaskHandler,
    SlackTaskHandler,
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
import { InputNodeProcessor } from './processors/input-node.processor';
import { UpdateRecordProcessor } from './processors/update-record.processor';
import { SetVariableProcessor } from './processors/set-variable.processor';
import { SlackProcessor } from './processors/slack.processor';

@Module({
    imports: [
        PrismaModule, 
        NotificationsModule, 
        UsersModule,
        QueueModule
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
        InputNodeProcessor,
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
        private inputProcessor: InputNodeProcessor,
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
        ]);

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
        this.registry.register(this.inputProcessor);
        this.registry.register(this.updateRecordProcessor);
        this.registry.register(this.setVariableProcessor);
        this.registry.register(this.slackProcessor);
    }
}
