import { Injectable, Logger } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class UserInputNodeProcessor implements INodeProcessor {
  constructor(private helper: WorkflowHelperService) {}

  getType(): string {
    return 'userInput';
  }

  async process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { applicationId, nodeId, node, inputData, applicantId } = context;

    // Resolve Assignee (Default to applicant if not set)
    let assignee = node.data?.assignee || 'applicant';
    let assigneeType = node.data?.assigneeType || null;

    // Swimlane fallback (optional, but consistent with ApprovalNode)
    if (!node.data?.assignee) {
      // If explicitly undefined/null in data
      const swimlane = this.helper.findEnclosingSwimLane(
        node,
        context.nodes || [],
      );
      if (swimlane && swimlane.data?.assignee) {
        assignee = swimlane.data.assignee;
        assigneeType = swimlane.data.assigneeType;
      }
    }

    const resolvedAssignee = await this.helper.resolveAssignedTo(
      assignee,
      applicantId,
    );

    const assignedToInfo = await this.helper.resolveAssignedToSnapshot(
      resolvedAssignee || '',
    );

    // Calculate display name
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

    // Update application's currentNodeId to this node
    await tx.application.update({
      where: { id: applicationId },
      data: {
        currentNodeId: nodeId,
      },
    });
  }
}
