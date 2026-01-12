import { Module, OnModuleInit } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowEngineController } from './workflow-engine.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

// Worker Infrastructure
import {
    TaskHandlerRegistry,
    GenericWorker,
    ApiCallHandler,
    LlmCallHandler,
    ApprovalHandler,
} from './workers';

@Module({
    imports: [NotificationsModule, UsersModule],
    controllers: [WorkflowEngineController],
    providers: [
        WorkflowEngineService,
        // Worker Infrastructure
        TaskHandlerRegistry,
        GenericWorker,
        // Task Handlers
        ApiCallHandler,
        LlmCallHandler,
        ApprovalHandler,
    ],
    exports: [WorkflowEngineService, TaskHandlerRegistry],
})
export class WorkflowEngineModule implements OnModuleInit {
    constructor(
        private readonly handlerRegistry: TaskHandlerRegistry,
        private readonly apiCallHandler: ApiCallHandler,
        private readonly llmCallHandler: LlmCallHandler,
        private readonly approvalHandler: ApprovalHandler,
    ) {}

    onModuleInit() {
        // Register all handlers
        this.handlerRegistry.registerAll([
            this.apiCallHandler,
            this.llmCallHandler,
            this.approvalHandler,
        ]);
    }
}
