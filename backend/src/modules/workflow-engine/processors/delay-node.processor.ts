import { Injectable, Logger } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class DelayNodeProcessor implements INodeProcessor {
  private readonly logger = new Logger(DelayNodeProcessor.name);

  constructor(private helper: WorkflowHelperService) {}

  getType(): string {
    return 'delay';
  }

  async process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { applicationId, nodeId, node, edges } = context;
    const config = node.data || {};
    const delayType = config.delayType || 'duration'; // duration | fixed
    const value = config.value;

    // Determine next node
    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    const nextNodeId =
      outgoingEdges.length > 0 ? outgoingEdges[0].target : null;

    if (!nextNodeId) {
      this.logger.warn(`Delay node ${nodeId} has no next node. flow stops.`);
      return;
    }

    let delayMs = 0;
    let scheduledAt = new Date();

    if (delayType === 'duration') {
      const minutes = parseInt(value, 10) || 0;
      delayMs = minutes * 60 * 1000;
      scheduledAt = new Date(Date.now() + delayMs);
    } else if (delayType === 'fixed') {
      scheduledAt = new Date(value);
      const now = Date.now();
      delayMs = Math.max(0, scheduledAt.getTime() - now);
    }

    this.logger.log(
      `Delay node ${nodeId} scheduling wake up at ${scheduledAt.toISOString()}`,
    );

    // Create a delayed task (Puts workflow in waiting state)
    await tx.workflowTask.create({
      data: {
        applicationId,
        stepId: nodeId,
        type: 'delay',
        status: 'PENDING',
        scheduledAt: scheduledAt,
        config: config,
      },
    });

    await tx.approvalHistory.create({
      data: {
        applicationId,
        actorId: 'SYSTEM',
        action: 'DELAY_START',
        stepId: nodeId,
        comment: `待機開始: ${scheduledAt.toLocaleString()}`,
      },
    });

    // We do NOT advance to next node here.
    // The DelayPollService will pick this up when scheduledAt is reached.
  }
}
