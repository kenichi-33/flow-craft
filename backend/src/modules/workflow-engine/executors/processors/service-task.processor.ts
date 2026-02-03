import { Injectable, Logger } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { QueueService } from '../../../queue/queue.service';

@Injectable()
export class ServiceTaskProcessor implements INodeProcessor {
  private readonly logger = new Logger(ServiceTaskProcessor.name);

  constructor(
    private helper: WorkflowHelperService,
    private queueService: QueueService,
  ) {}

  getType(): string {
    return 'service'; // Represents abstract service task, mapped manually or by multiple impls
  }

  async process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { applicationId, nodeId, node, applicantId, inputData } = context;

    await tx.application.update({
      where: { id: applicationId },
      data: { currentNodeId: nodeId },
    });

    // Check if there is already an active or failed task for this node
    // preventing duplicate task creation during recovery or rapid-fire events
    const existingTask = await tx.workflowTask.findFirst({
      where: {
        applicationId,
        stepId: nodeId,
        status: {
          in: ['PENDING', 'QUEUED', 'RUNNING', 'FAILED'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingTask) {
      this.logger.log(
        `Reusing existing task ${existingTask.id} for node ${nodeId} (Status: ${existingTask.status})`,
      );

      // If failed, reset for retry
      if (existingTask.status === 'FAILED') {
        await tx.workflowTask.update({
          where: { id: existingTask.id },
          data: {
            status: 'QUEUED',
            retries: { increment: 1 },
            error: null,
          },
        });
      }

      // Enqueue execution
      const job = {
        taskId: existingTask.id,
        applicationId,
        nodeId,
        nodeType: node.type,
        nodeData: node.data || {},
        inputData,
        applicantId,
      };

      await this.queueService.enqueue('TASK_EXECUTE', job);
      return;
    }

    await tx.approvalHistory.create({
      data: {
        applicationId,
        actorId: 'SYSTEM',
        action:
          node.type === 'sendEmail'
            ? 'SEND_EMAIL'
            : node.type === 'slack'
              ? 'SLACK_NOTIFY'
              : node.type.toUpperCase().replace(/\s+/g, '_'),
        stepId: nodeId,
        comment: `${node.type} 実行開始`,
      },
    });

    // Use standard enqueueTask for all system tasks (apiCall, llmCall, sendEmail, slack, etc.)
    await this.helper.enqueueTask(
      applicationId,
      node,
      inputData,
      applicantId,
      null, // assignee: SYSTEM handles it
      null,
      null,
      tx,
    );

    // If Async (Fire and Forget), move to next node immediately
    if (node.data?.isAsync) {
      await this.helper.advanceToNextNode(applicationId, nodeId);
    }
  }
}
