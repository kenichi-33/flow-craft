import { Injectable, Logger } from '@nestjs/common';
import { INodeProcessor, NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class InputNodeProcessor implements INodeProcessor {
    private readonly logger = new Logger(InputNodeProcessor.name);

    constructor(private helper: WorkflowHelperService) {}

    getType(): string {
        return 'input';
    }

    async process(context: NodeProcessorContext, tx: Prisma.TransactionClient): Promise<void> {
        const { applicationId, nodeId, node, inputData, applicantId } = context;
        const config = node.data || {};

        this.logger.log(`Processing Input Node ${nodeId} for app ${applicationId}`);

        // Resolve Assignee
        const assignedToKey = await this.helper.resolveAssignedTo(config.assignedTo, applicantId);
        const assigneeSnapshot = assignedToKey ? await this.helper.resolveAssignedToSnapshot(assignedToKey) : null;

        // Create Workflow Task of type 'input'
        await tx.workflowTask.create({
            data: {
                applicationId,
                stepId: nodeId,
                type: 'input',
                status: 'PENDING',
                assignedTo: assignedToKey || null,
                assignedToDisplay: assigneeSnapshot ? `${assigneeSnapshot.lastName} ${assigneeSnapshot.firstName}` : assignedToKey,
                assignedToInfo: assigneeSnapshot || undefined,
                config: config,
            },
        });

        // Add history log
        await tx.approvalHistory.create({
            data: {
                applicationId,
                actorId: 'SYSTEM',
                action: 'ASSIGN_INPUT',
                stepId: nodeId,
                comment: `入力タスクを作成しました: ${assigneeSnapshot ? assigneeSnapshot.username : assignedToKey}`,
            },
        });

        // Do NOT advance node. Wait for user input.
        // Update currentNodeId is handled by ADVANCE_NODE logic before calling process? 
        // No, process is called AFTER currentNodeId is set to this node.
        // So we just stop here.
    }
}
