import { Injectable, Logger } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../../workflow-helper.service';

@Injectable()
export class AiFlowRouterNodeProcessor implements INodeProcessor {
  private readonly logger = new Logger(AiFlowRouterNodeProcessor.name);

  constructor(private readonly workflowHelper: WorkflowHelperService) {}

  getType(): string {
    return 'aiFlowRouter';
  }

  async process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { applicationId, nodeId, node, inputData } = context;

    this.logger.log(
      `Processing AI Flow Router Node ${nodeId} for App ${applicationId}`,
    );

    // Enqueue task for AI Flow Router Handler
    await this.workflowHelper.enqueueTask(
      applicationId,
      node,
      inputData,
      'system', // AI Flow Router is a system task
      null,
      null,
      null,
      tx,
    );

    this.logger.log(`Enqueued AI Flow Router Task for Node ${nodeId}`);
  }
}
