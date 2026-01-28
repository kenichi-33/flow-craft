import { Injectable, Logger } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JoinGatewayProcessor implements INodeProcessor {
  private readonly logger = new Logger(JoinGatewayProcessor.name);

  constructor(
    private helper: WorkflowHelperService,
    private prisma: PrismaService, // Helper might not expose count, so accessing prisma directly or adding count to helper
  ) {}

  getType(): string {
    return 'join';
  }

  async process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { applicationId, nodeId, edges, inputData, fromNodeId, node } =
      context;

    // 0. Check Join Type
    const joinType = node?.data?.joinType || 'ALL'; // Default to ALL

    // --- ANY (OR) Logic: Pass-through / Simple Merge ---
    if (joinType === 'ANY') {
      this.logger.log(
        `[JoinGateway] Node ${nodeId} (Type: ANY) processing arrival from ${fromNodeId}. Passing through.`,
      );
      // In ANY mode, we don't wait. We just proceed.
      // Note: This effectively works as a Merge. Every token arriving here continues.
      // We do NOT reset state because state isn't really used for blocking in ANY mode.
      await this.helper.advanceToNextNode(applicationId, nodeId);
      return;
    }

    // --- ALL (AND) Logic: Wait for all paths ---

    // 1. Identify incoming paths
    const incomingEdges = edges.filter((e) => e.target === nodeId);
    const incomingNodeIds = incomingEdges.map((e) => e.source);

    if (incomingEdges.length <= 1) {
      // Trivial join or pass-through
      await this.helper.advanceToNextNode(applicationId, nodeId);
      return;
    }

    // 2. Manage Join State in inputData (hidden _system field)
    const appData = (inputData as any) || {};
    const systemData = appData._system || {};
    const joinsState = systemData.joins || {};
    const myJoinState = joinsState[nodeId] || { arrivedFrom: [] };

    // Record arrival
    if (fromNodeId && incomingNodeIds.includes(fromNodeId)) {
      if (!myJoinState.arrivedFrom.includes(fromNodeId)) {
        myJoinState.arrivedFrom.push(fromNodeId);
        this.logger.log(
          `[JoinGateway] Node ${nodeId} recorded arrival from ${fromNodeId}. Current: [${myJoinState.arrivedFrom.join(', ')}]`,
        );
      }
    } else {
      this.logger.warn(
        `[JoinGateway] Arrived at ${nodeId} from unknown or untracked node: ${fromNodeId}`,
      );
    }

    // 3. Check if ALL incoming paths have arrived
    const allArrived = incomingNodeIds.every((sourceId: string) =>
      myJoinState.arrivedFrom.includes(sourceId),
    );

    // Save State
    const newInputData = {
      ...appData,
      _system: {
        ...systemData,
        joins: {
          ...joinsState,
          [nodeId]: myJoinState,
        },
      },
    };

    if (!allArrived) {
      this.logger.log(
        `[JoinGateway] Node ${nodeId} Waiting. Arrived: ${myJoinState.arrivedFrom.length}/${incomingNodeIds.length}`,
      );

      // Persist state (Wait)
      await tx.application.update({
        where: { id: applicationId },
        data: { inputData: newInputData },
      });
      return;
    }

    // 4. All Arrived -> Proceed
    this.logger.log(
      `[JoinGateway] Node ${nodeId} All paths arrived. Resetting state and Advancing.`,
    );

    // Reset state for this node (in case of loop/re-entry)
    newInputData._system.joins[nodeId] = { arrivedFrom: [] };

    await tx.application.update({
      where: { id: applicationId },
      data: {
        currentNodeId: nodeId,
        inputData: newInputData,
      },
    });

    await this.helper.advanceToNextNode(applicationId, nodeId);
  }
}
