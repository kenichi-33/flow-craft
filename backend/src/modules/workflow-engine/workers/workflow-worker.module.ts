import { Module, OnModuleInit } from '@nestjs/common';
import { WorkflowCoreModule } from '../workflow-core.module';
import { GenericWorker } from './generic.worker';
import { SchedulerWorker } from './scheduler.worker';
import { TaskHandlerRegistry } from './task-handler.registry';

// Handlers
import { ApiCallHandler } from './handlers/api-call.handler';
import { LlmCallHandler } from './handlers/llm-call.handler';
import { ApprovalHandler } from './handlers/approval.handler';
import { EmailTaskHandler } from './handlers/email-task.handler';
import { SlackTaskHandler } from './handlers/slack.handler';
import { UserInputHandler } from './handlers/user-input.handler';
import { SetVariableHandler } from './handlers/set-variable.handler';
import { UpdateRecordHandler } from './handlers/update-record.handler';
import { ScriptTaskHandler } from './handlers/script-task.handler';
import { GraphQLTaskHandler } from './handlers/graphql-task.handler';
import { NotificationsModule } from '../../notifications/notifications.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [WorkflowCoreModule, NotificationsModule, UsersModule],
  providers: [
    GenericWorker,
    SchedulerWorker,
    TaskHandlerRegistry,
    // Handlers
    ApiCallHandler,
    LlmCallHandler,
    ApprovalHandler,
    EmailTaskHandler,
    SlackTaskHandler,
    UserInputHandler,
    SetVariableHandler,
    UpdateRecordHandler,
    ScriptTaskHandler,
    GraphQLTaskHandler,
  ],
  exports: [GenericWorker, SchedulerWorker, TaskHandlerRegistry],
})
export class WorkflowWorkerModule implements OnModuleInit {
  constructor(
    private readonly handlerRegistry: TaskHandlerRegistry,
    private readonly apiCallHandler: ApiCallHandler,
    private readonly llmCallHandler: LlmCallHandler,
    private readonly approvalHandler: ApprovalHandler,
    private readonly emailTaskHandler: EmailTaskHandler,
    private readonly slackTaskHandler: SlackTaskHandler,
    private readonly userInputHandler: UserInputHandler,
    private readonly setVariableHandler: SetVariableHandler,
    private readonly updateRecordHandler: UpdateRecordHandler,
    private readonly scriptTaskHandler: ScriptTaskHandler,
    private readonly graphqlTaskHandler: GraphQLTaskHandler,
  ) {}

  onModuleInit() {
    // Register handlers
    this.handlerRegistry.registerAll([
      this.apiCallHandler,
      this.llmCallHandler,
      this.approvalHandler,
      this.emailTaskHandler,
      this.slackTaskHandler,
      this.userInputHandler,
      this.setVariableHandler,
      this.updateRecordHandler,
      this.scriptTaskHandler,
      this.graphqlTaskHandler,
    ]);
  }
}
