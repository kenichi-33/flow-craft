import { Injectable } from '@nestjs/common';
import { INodeProcessor, NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class ApprovalNodeProcessor implements INodeProcessor {
    constructor(private helper: WorkflowHelperService) {}

    getType(): string {
        return 'approval';
    }

    async process(context: NodeProcessorContext, tx: Prisma.TransactionClient): Promise<void> {
        const { applicationId, nodeId, node, applicantId, inputData } = context;

        let assignee = node.data?.assignee || null;
        let assigneeType = node.data?.assigneeType || null; 

        // If assignee is not set, try to resolve from enclosing SwimLane
        if (!assignee) {
            const swimlane = this.helper.findEnclosingSwimLane(node, context.nodes || []);
            if (swimlane && swimlane.data?.assignee) {
                assignee = swimlane.data.assignee;
                assigneeType = swimlane.data.assigneeType; // Inherit type too
            }
        }

        const resolvedAssignee = await this.helper.resolveAssignedTo(
            assignee,
            applicantId
        );

        const assignedToInfo = await this.helper.resolveAssignedToSnapshot(resolvedAssignee || '');

        await this.helper.enqueueTask(
            applicationId,
            node,
            inputData,
            applicantId,
            resolvedAssignee,
            (assignedToInfo && assignedToInfo.lastName && assignedToInfo.firstName)
                ? `${assignedToInfo.lastName} ${assignedToInfo.firstName}`
                : (node.data?.assigneeDisplay || resolvedAssignee),
            assignedToInfo,
            tx
        );

        await tx.application.update({
            where: { id: applicationId },
            data: {
                currentNodeId: nodeId,
            },
        });
    }
}
