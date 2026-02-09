import { Module, OnModuleInit } from '@nestjs/common';
import { WorkflowCoreModule } from '../workflow-core.module';
import { WorkflowExecutorService } from './workflow-executor.service';
import { DelayPollService } from './delay-poll.service';
import { NodeProcessorRegistry } from './processors/node-processor.registry';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueModule } from '../../queue/queue.module';

// Processors
import { EndNodeProcessor } from './processors/end-node.processor';
import { ServiceTaskProcessor } from './processors/service-task.processor';
import { UserInputNodeProcessor } from './processors/user-input-node.processor';
import { ApprovalNodeProcessor } from './processors/approval-node.processor';
import { BranchNodeProcessor } from './processors/branch-node.processor';
import { ParallelGatewayProcessor } from './processors/parallel-node.processor';
import { JoinGatewayProcessor } from './processors/join-node.processor';
import { DelayNodeProcessor } from './processors/delay-node.processor';
import { SubProcessProcessor } from './processors/sub-process.processor';
import { NotificationsModule } from '../../notifications/notifications.module';
import { UsersModule } from '../../users/users.module';
import { ForEachNodeProcessor } from './processors/foreach-node.processor';
import { AiBranchNodeProcessor } from './processors/ai-branch-node.processor';
import { AiFlowRouterNodeProcessor } from './processors/ai-flow-router-node.processor';

@Module({
  imports: [
    WorkflowCoreModule,
    ScheduleModule, // For DelayPollService cron
    NotificationsModule,
    NotificationsModule,
    UsersModule,
    QueueModule,
  ],
  providers: [
    WorkflowExecutorService,
    DelayPollService,
    NodeProcessorRegistry,
    // Processors
    EndNodeProcessor,
    ServiceTaskProcessor,
    UserInputNodeProcessor,
    ApprovalNodeProcessor,
    BranchNodeProcessor,
    ParallelGatewayProcessor,
    JoinGatewayProcessor,
    DelayNodeProcessor,
    SubProcessProcessor,

    ForEachNodeProcessor,
    AiBranchNodeProcessor,
    AiFlowRouterNodeProcessor,
  ],
  exports: [WorkflowExecutorService, DelayPollService, NodeProcessorRegistry],
})
export class WorkflowExecutorModule implements OnModuleInit {
  constructor(
    private registry: NodeProcessorRegistry,
    private endProcessor: EndNodeProcessor,
    private approvalProcessor: ApprovalNodeProcessor,
    private branchProcessor: BranchNodeProcessor,
    private serviceProcessor: ServiceTaskProcessor,
    private parallelProcessor: ParallelGatewayProcessor,
    private joinProcessor: JoinGatewayProcessor,
    private delayProcessor: DelayNodeProcessor,
    private userInputNodeProcessor: UserInputNodeProcessor,
    private subProcessProcessor: SubProcessProcessor,
    private forEachProcessor: ForEachNodeProcessor,
    private aiBranchProcessor: AiBranchNodeProcessor,
    private aiFlowRouterProcessor: AiFlowRouterNodeProcessor,
  ) {}

  onModuleInit() {
    // Register processors
    this.registry.register(this.endProcessor);
    this.registry.register(this.approvalProcessor);
    this.registry.register(this.branchProcessor);
    this.registry.register(this.subProcessProcessor);

    // Consolidate System Tasks to ServiceTaskProcessor
    this.serviceProcessorTypes().forEach((type) => {
      this.registry.registerAlias(type, this.serviceProcessor);
    });

    this.registry.register(this.parallelProcessor);
    this.registry.register(this.joinProcessor);
    this.registry.register(this.delayProcessor);
    this.registry.register(this.userInputNodeProcessor);
    // Alias for backward compatibility if needed, but native type is now userInput
    this.registry.registerAlias('input', this.userInputNodeProcessor);

    // New Processors
    this.registry.register(this.forEachProcessor);
    this.registry.register(this.aiBranchProcessor);
    this.registry.register(this.aiFlowRouterProcessor);
  }

  private serviceProcessorTypes() {
    return [
      'apiCall',
      'llmCall',
      'sendEmail',
      'slack',
      'setVariable',
      'updateRecord',
      'script',
      'graphql',
      'aiCheck',
    ];
  }
}
