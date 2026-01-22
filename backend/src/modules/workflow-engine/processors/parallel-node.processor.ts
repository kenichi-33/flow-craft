import { Injectable, Logger } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';
import { QueueService } from '../../queue/queue.service';

@Injectable()
export class ParallelGatewayProcessor implements INodeProcessor {
  private readonly logger = new Logger(ParallelGatewayProcessor.name);

  constructor(
    private helper: WorkflowHelperService,
    private queueService: QueueService,
  ) {}

  getType(): string {
    return 'parallel';
  }

  async process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { applicationId, nodeId, edges } = context;

    // Find all outgoing paths
    const outgoingEdges = edges.filter((e) => e.source === nodeId);

    if (outgoingEdges.length === 0) {
      this.logger.warn(`Parallel gateway ${nodeId} has no outgoing edges`);
      return;
    }

    this.logger.log(
      `Parallel gateway ${nodeId} splitting into ${outgoingEdges.length} paths`,
    );

    // Update Application to point to "Parallel" (or keep it here)
    // We keep currentNodeId as the Gateway ID or something neutral while branches execute.
    await tx.application.update({
      where: { id: applicationId },
      data: { currentNodeId: nodeId }, // Stay on Gateway until Join? Or doesn't matter?
    });

    await tx.approvalHistory.create({
      data: {
        applicationId,
        actorId: 'SYSTEM',
        action: 'PARALLEL_SPLIT',
        stepId: nodeId,
        comment: `並行処理開始: ${outgoingEdges.length} パス`,
      },
    });

    // Trigger execution for all branches
    // We used to rely on `advanceToNextNode` which enqueues a job.
    // If we enqueue multiple jobs, they will run in parallel (if consumers are parallel).
    // WE need to pass `fromNodeId` so the worker knows "where to continue from".
    // HOWEVER, `advanceToNextNode` (updated) just passes `fromNodeId` to the job.
    // The JOB CONSUMER (Worker) handles "Finding Next Node".

    // IF the Worker logic sees "From Parallel Node", it should find ALL edges.
    // But `advanceToNextNode` enqueues ONE job per call.
    // Does `advanceToNextNode` accept array? No.
    // We need to call it multiple times?
    // Or better: The Worker should detect "Multiple Outgoing Edges" and handle them.
    // But `ParallelGatewayProcessor` IS the handler for the Parallel Node.
    // So WE are responsible for spawning.

    // We can't call `helper.advanceToNextNode` multiple times safely if `advanceToNextNode` relies on `currentNodeId` state.
    // But now we assume `advanceToNextNode` uses `fromNodeId` payload.

    // Issue: `advanceToNextNode` enqueues `WORKFLOW_NODE_PROCESS`.
    // The Worker reads `currentNodeId`.
    // If we pass `fromNodeId` in payload, the Worker MUST use it instead of DB `currentNodeId`.

    // We need to verify `GenericWorker` or `WorkflowExecutorService` logic.
    // If they don't support `fromNodeId`, this fails.
    // Assuming I will update them.

    // Trigger for EACH edge
    // But `process` runs inside a transaction. Enqueueing is side-effect.
    // We should call helper for each edge target?
    // No, `advanceToNextNode` is usually "Advance from Current".
    // Here we want "Start Target Node X".

    // Let's assume we modify manual enqueueing here or helper supports "Execute Node X".
    // Since `helper.triggerNodeExecution` isn't fully there, I will use `advanceToNextNode` with `fromNodeId` = nodeId.
    // Wait, if I call it 3 times with same `fromNodeId`, the worker will find same 3 edges each time?
    // NO. The worker logic needs to be: "Find edges from `fromNodeId`".
    // If 3 edges, and I call it 3 times, it triggers 3 jobs.
    // Job 1 finds 3 edges. Executes ??? ALL 3?
    // Then we duplicate execution 3x.

    // Correct Logic:
    // `ParallelGatewayProcessor` should Identify Targets (Node A, Node B).
    // For each Target:
    //    Enqueue Job "EXECUTE_NODE" { nodeId: A }
    //    Enqueue Job "EXECUTE_NODE" { nodeId: B }

    // But our system uses "ADVANCE" (Find Next) logic mostly.
    // We need a way to "Process specific node".

    for (const edge of outgoingEdges) {
      const targetNodeId = edge.target;
      // Enqueue a job to process specifically THIS target node.
      // We reuse `WORKFLOW_NODE_PROCESS` with a new payload param `targetNodeId`.
      await this.queueService.enqueue('WORKFLOW_NODE_PROCESS', {
        applicationId,
        targetNodeId: targetNodeId,
        fromNodeId: nodeId, // Traceability
      });
    }
  }
}
