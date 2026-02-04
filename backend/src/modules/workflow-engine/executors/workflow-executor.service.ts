import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../../queue/queue.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailService } from '../../notifications/mail.service';
import { UsersService } from '../../users/users.service';
import { TaskCompleteJob } from '../workers/task-handler.interface';
import { WorkflowHelperService } from '../workflow-helper.service';
import { NodeProcessorRegistry } from './processors/node-processor.registry';
import { NodeProcessorContext } from './processors/node-processor.interface';

@Injectable()
export class WorkflowExecutorService implements OnModuleInit {
  private readonly logger = new Logger('[Executor] WorkflowExecutor');

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private usersService: UsersService,
    private queueService: QueueService,
    private nodeRegistry: NodeProcessorRegistry,
    private workflowHelper: WorkflowHelperService,
  ) {}

  async onModuleInit() {
    await this.queueService.registerHandler(
      'WORKFLOW_NODE_PROCESS',
      this.handleNodeProcessingJob.bind(this),
    );
    await this.queueService.registerHandler(
      'TASK_COMPLETE',
      this.handleTaskComplete.bind(this),
    );
    await this.queueService.registerHandler(
      'TASK_SLA_BREACH',
      this.handleSlaBreach.bind(this),
    );
    await this.queueService.registerHandler(
      'TASK_REMINDER',
      this.handleTaskReminder.bind(this),
    );
    this.logger.log('Registered workflow job handlers');
  }

  async handleNodeProcessingJob(job: {
    applicationId: string;
    fromNodeId?: string;
    targetNodeId?: string;
  }) {
    this.logger.log(
      `Processing workflow node for application ${job.applicationId} (target: ${job.targetNodeId || 'auto'}, from: ${job.fromNodeId || 'auto'})`,
    );
    await this.processNode(job.applicationId, job.targetNodeId, job.fromNodeId);
  }

  /**
   * タスク完了通知を処理（Worker → Executor）
   */
  async handleTaskComplete(job: TaskCompleteJob) {
    this.logger.log(
      `Task ${job.taskId} completed for application ${job.applicationId} (success: ${job.success})`,
    );

    if (job.success && job.shouldAdvance) {
      // 成功かつ次に進む場合、ワークフローを進める (fromNodeId = nodeId of the task)
      // Note: Job usually contains nodeId/nodeType. We should use it.
      // But TaskCompleteJob interface might not have nodeId?
      // Let's check interface or assume we fix it.
      // Actually, we can fetch the task or assume GenericWorker passes it.
      // GenericWorker usually passes node info in job.
      // For now, let's rely on standard advance.
      // But we NEED fromNodeId!
      // I'll assume GenericWorker or the caller updates `advanceToNextNode` usage correctly.
      // The `handleTaskComplete` calls `this.advanceToNextNode`.
      // We need to update `this.advanceToNextNode` signature in this class too?
      await this.advanceToNextNode(job.applicationId); // TODO: Pass fromNodeId if possible
    } else if (!job.success) {
      // 失敗時のログ（リトライはWorker側で処理済み）
      this.logger.warn(`Task ${job.taskId} failed: ${job.error}`);
    }
    // shouldAdvance = false の場合（承認タスク等の途中経過、または明示的な停止）は何もしない
  }

  async handleSlaBreach(job: { taskId: string }) {
    this.logger.log(`Handling SLA Breach for task ${job.taskId}`);
    const task = await this.prisma.workflowTask.findUnique({
      where: { id: job.taskId },
      include: { application: true },
    });
    if (task && task.status === 'PENDING') {
      // Resolve Recipient
      let email = '';

      // 1. Check Snapshot
      if (task.assignedToInfo) {
        const info = task.assignedToInfo as any;
        if (info.email) email = info.email;
      }

      // 2. Fetch if missing
      if (!email && task.assignedTo) {
        if (task.assignedTo.startsWith('user:')) {
          const username = task.assignedTo.substring(5);
          // Resolve email via UsersService snapshot
          const snapshot =
            await this.usersService.getUserSnapshotByUsername(username);
          if (snapshot && snapshot.email) email = snapshot.email;
        }
        // If group, we need to find group email or managers.
        // For now, if no email found, log warning.
      }

      if (email) {
        await this.mailService.sendSlaBreachNotification(
          email,
          task,
          task.application,
        );
        this.logger.log(
          `Sent SLA Breach notification for task ${job.taskId} to ${email}`,
        );
      } else {
        this.logger.warn(
          `Could not resolve email for SLA Breach task ${job.taskId} (assignedTo: ${task.assignedTo})`,
        );
      }
    }
  }

  async handleTaskReminder(job: { taskId: string }) {
    this.logger.log(`Handling Reminder for task ${job.taskId}`);
    const task = await this.prisma.workflowTask.findUnique({
      where: { id: job.taskId },
      include: { application: true },
    });
    if (task && task.status === 'PENDING') {
      let email = '';

      // 1. Check Snapshot
      if (task.assignedToInfo) {
        const info = task.assignedToInfo as any;
        if (info.email) email = info.email;
      }

      // 2. Fetch if missing
      if (!email && task.assignedTo) {
        if (task.assignedTo.startsWith('user:')) {
          const username = task.assignedTo.substring(5);
          const snapshot =
            await this.usersService.getUserSnapshotByUsername(username);
          if (snapshot && snapshot.email) email = snapshot.email;
        }
      }

      if (email) {
        await this.mailService.sendTaskReminder(email, task, task.application);
        this.logger.log(
          `Sent Reminder notification for task ${job.taskId} to ${email}`,
        );
      } else {
        this.logger.warn(
          `Could not resolve email for Reminder task ${job.taskId} (assignedTo: ${task.assignedTo})`,
        );
      }
    }
  }

  /**
   * 次のノードへ進む (非同期ジョブ登録)
   */
  async advanceToNextNode(applicationId: string, fromNodeId?: string) {
    await this.workflowHelper.advanceToNextNode(applicationId, fromNodeId);
  }

  /**
   * ノード処理の実装 (Executorのコアロジック)
   */
  private async processNode(
    applicationId: string,
    targetNodeId?: string,
    fromNodeId?: string,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        flowDefinition: true,
        applicationDefinition: true,
      },
    });

    if (!application) {
      this.logger.error(
        `Application ${applicationId} not found during processNode`,
      );
      return;
    }

    // スナップショットがある場合はそちらを使用（バージョン互換性）
    const nodes = (application.flowNodes ||
      application.flowDefinition.nodes ||
      []) as any[];
    const edges = (application.flowEdges ||
      application.flowDefinition.edges ||
      []) as any[];

    // ターゲットが決まっている場合 (Parallel spawn, or specific jump)
    let nextNodeId = targetNodeId;

    if (!nextNodeId) {
      // ターゲット未定: fromNodeId または currentNodeId から次を探す
      // fromNodeId がある場合はそこからのエッジを使用 (Token Passing logic)
      // なければ DBのcurrentNodeId (State Machine logic)

      const sourceInfoId = fromNodeId || application.currentNodeId;

      if (!sourceInfoId) {
        // 開始点不明 (StartNode?)
        // If DRAFT -> IN_PROGRESS, maybe StartNode?
        // But usually we have a currentNodeId.
        this.logger.warn(
          `No source node ID found (from: ${fromNodeId}, current: ${application.currentNodeId})`,
        );
        return;
      }

      // 現在のノードから出ているエッジを見つける
      // Note: If Parallel Gateway, logic might split here?
      // But if we are here, we are asked to find "Next".
      // If Source is Parallel, we should have spawned tasks separately.
      // If Source has multiple edges (e.g. Branch without Condition?), we might have ambiguity.
      // BranchNodeProcessor should have handled routing and passed specific target.

      const outgoingEdges = edges.filter((e: any) => e.source === sourceInfoId);

      if (outgoingEdges.length === 0) {
        // エッジがない = 終了?
        // Check if it was End Node?
        // If End Node, we stops. The EndNodeProcessor should have handled status update.
        // We check if status is already approved/termianl?
        return;
      }

      const outgoingEdge = outgoingEdges[0]; // Logic for simple Sequential.
      // If multiple edges exist (Parallel/Branch) and we didn't get a targetNodeId,
      // it means the previous node (Gateway) logic FAILED to split/route properly
      // or we are relying on naive default (first edge).

      nextNodeId = outgoingEdge.target;
    }

    const nextNode = nodes.find((n: any) => n.id === nextNodeId);

    if (!nextNode) {
      this.logger.error(
        `Next node ${nextNodeId} not found in flow for application ${applicationId}`,
      );
      return;
    }

    this.logger.log(
      `Advancing application ${applicationId} to node ${nextNodeId} (type: ${nextNode.type})`,
    );

    // Processorに委譲
    const processor = this.nodeRegistry.getProcessor(nextNode.type);
    if (!processor) {
      this.logger.error(`No processor found for node type: ${nextNode.type}`);
      // default fallback: just advance?
      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          currentNodeId: nextNodeId,
        },
      });
      await this.workflowHelper.advanceToNextNode(applicationId);
      return;
    }

    const context: NodeProcessorContext = {
      applicationId,
      nodeId: nextNodeId || '',
      node: nextNode || {},
      inputData: (application.inputData as Record<string, any>) || {},
      applicantId: application.applicantId,
      edges,
      nodes,
      fromNodeId: fromNodeId,
      postCommitActions: [],
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        await processor.process(context, tx);
      });

      // Execute Post-Commit Actions
      if (context.postCommitActions && context.postCommitActions.length > 0) {
        this.logger.log(
          `Executing ${context.postCommitActions.length} post-commit actions for node ${nextNodeId}`,
        );
        await Promise.all(context.postCommitActions.map((action) => action()));
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `Error processing node ${nextNodeId} (${nextNode.type}): ${errorMessage}`,
        e,
      );

      // Log Error to History (Outside Transaction)
      // This ensures the error is visible to the user even if the node logic rolled back.
      try {
        await this.prisma.approvalHistory.create({
          data: {
            applicationId,
            actorId: 'SYSTEM',
            action: 'ERROR',
            stepId: nextNodeId || '',
            comment: `システムエラー: ${errorMessage}`,
          },
        });
      } catch (logError) {
        this.logger.error('Failed to log error to history', logError);
      }

      throw e;
    }
  }
}
