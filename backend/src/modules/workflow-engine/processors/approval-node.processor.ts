import { Injectable } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class ApprovalNodeProcessor implements INodeProcessor {
  constructor(private helper: WorkflowHelperService) {}

  getType(): string {
    return 'approval';
  }

  async process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { applicationId, nodeId, node, applicantId, inputData } = context;

    let assignee = node.data?.assignee || null;

    // If assignee is not set, try to resolve from enclosing SwimLane
    if (!assignee) {
      const swimlane = this.helper.findEnclosingSwimLane(
        node,
        context.nodes || [],
      );
      if (swimlane && swimlane.data?.assignee) {
        assignee = swimlane.data.assignee;
      }
    }

    const resolvedAssignee = await this.helper.resolveAssignedTo(
      assignee,
      applicantId,
    );

    const assignedToInfo = await this.helper.resolveAssignedToSnapshot(
      resolvedAssignee || '',
    );

    // Calculate display name (same logic as userInput-node.processor)
    let assignedToDisplay = node.data?.assigneeDisplay || resolvedAssignee;
    if (assignedToInfo) {
      const nameParts = [
        assignedToInfo.lastName,
        assignedToInfo.firstName,
      ].filter(Boolean);
      if (nameParts.length > 0) {
        assignedToDisplay = nameParts.join(' ');
      } else if (assignedToInfo.username) {
        assignedToDisplay = assignedToInfo.username;
      }
    }

    await this.helper.enqueueTask(
      applicationId,
      node,
      inputData,
      applicantId,
      resolvedAssignee,
      assignedToDisplay,
      assignedToInfo,
      tx,
    );

    await tx.application.update({
      where: { id: applicationId },
      data: {
        currentNodeId: nodeId,
      },
    });
  }
}
