import { Injectable } from '@nestjs/common';
import { INodeProcessor, NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class ServiceTaskProcessor implements INodeProcessor {
    constructor(private helper: WorkflowHelperService) {}

    getType(): string {
        return 'service'; // Represents abstract service task, mapped manually or by multiple impls
    }

    async process(context: NodeProcessorContext, tx: Prisma.TransactionClient): Promise<void> {
        const { applicationId, nodeId, node, applicantId, inputData } = context;

        await tx.application.update({
            where: { id: applicationId },
            data: { currentNodeId: nodeId },
        });

        await tx.approvalHistory.create({
            data: {
                applicationId,
                actorId: 'SYSTEM',
                action: 'SERVICE_TASK',
                stepId: nodeId,
                comment: `${node.type} 実行開始`,
            },
        });

        await this.helper.enqueueServiceTask(applicationId, node, inputData, applicantId, tx);
    }
}
