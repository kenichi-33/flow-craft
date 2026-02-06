import { Injectable, Logger } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { QueueService } from '../../../queue/queue.service';
import { WorkflowHelperService } from '../../workflow-helper.service';

@Injectable()
export class AiBranchNodeProcessor implements INodeProcessor {
  private readonly logger = new Logger(AiBranchNodeProcessor.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly workflowHelper: WorkflowHelperService,
  ) {}

  getType(): string {
    return 'aiBranch'; // Matches frontend node type
  }

  async process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { applicationId, nodeId, node, inputData, edges } = context;

    this.logger.log(
      `Processing AI Branch Node ${nodeId} for App ${applicationId}`,
    );

    // 1. Extract Rules (Handles) from Node Data
    // The frontend sends `rules` which map to handles.
    // We need to map { [ruleId]: nextNodeId } for the worker.
    const rules = node.data?.rules || [];
    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    const edgeMap: Record<string, string> = {};

    // Map Rule ID -> Target Node ID
    rules.forEach((rule: any) => {
      const edge = outgoingEdges.find((e) => e.sourceHandle === rule.id);
      if (edge) {
        edgeMap[rule.id] = edge.target;
      }
    });

    // Map Default Handle -> Target Node ID
    const defaultEdge = outgoingEdges.find(
      (e) => e.sourceHandle === 'default' || !e.sourceHandle,
    );
    if (defaultEdge) {
      edgeMap['default'] = defaultEdge.target;
    }

    // 2. Inject edgeMap into node.data for the Handler
    const enrichedNode = {
      ...node,
      data: {
        ...node.data,
        edgeMap,
      },
    };

    // 3. Enqueue Job via WorkflowHelper (Standard way)
    // This creates a TASK_EXECUTE job which GenericWorker picks up.
    // GenericWorker will dispatch to AiBranchHandler.
    await this.workflowHelper.enqueueTask(
      applicationId,
      enrichedNode,
      inputData,
      'system', // Applicant ID not strictly needed for system task but good to have context if available? 
      // Actually Context provides applicantId. But here in Processor `process` method we don't have applicantId strictly passed? 
      // `NodeProcessorContext` has `inputData`. Does it have `applicantId`?
      // Let's check `NodeProcessorContext`.
      // It has `applicantId`? No, let's assume 'system' or try to get from context if added.
      // Looking at `ActionExecutor` calling processors: it passes `applicationId`, `inputData`...
      // `enqueueTask` requires `applicantId`.
      // We can fetch application to get applicantId, OR just pass 'system' as it is an automated task.
    );
    
    // Note: The context doesn't expose `applicantId` directly in `NodeProcessorContext` interface currently.
    // But `enqueueTask` needs it for `assignedTo: applicant`. AI Branch is not assigned to user.
    // So 'system' or empty string is fine.
    
    this.logger.log(`Enqueued AI Branch Task for Node ${nodeId}`);
  }
}
