import { Injectable, Logger } from '@nestjs/common';
import { INodeProcessor, NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class DelayNodeProcessor implements INodeProcessor {
    private readonly logger = new Logger(DelayNodeProcessor.name);

    constructor(private helper: WorkflowHelperService) {}

    getType(): string {
        return 'delay';
    }

    async process(context: NodeProcessorContext, tx: Prisma.TransactionClient): Promise<void> {
        const { applicationId, nodeId, node, edges } = context;
        const config = node.data || {};
        const delayType = config.delayType || 'duration'; // duration | fixed
        const value = config.value;

        // Determine next node
        const outgoingEdges = edges.filter(e => e.source === nodeId);
        const nextNodeId = outgoingEdges.length > 0 ? outgoingEdges[0].target : null;

        if (!nextNodeId) {
            this.logger.warn(`Delay node ${nodeId} has no next node. flow stops.`);
            return;
        }

        let delayMs = 0;

        if (delayType === 'duration') {
            const minutes = parseInt(value, 10) || 0;
            delayMs = minutes * 60 * 1000;
        } else if (delayType === 'fixed') {
            const targetTime = new Date(value).getTime();
            const now = Date.now();
            delayMs = Math.max(0, targetTime - now);
        }

        this.logger.log(`Delay node ${nodeId} scheduling wake up in ${delayMs / 1000}s`);

        // Update current node to Next Node immediately
        // The process for Next Node will be triggered after delay
        await tx.application.update({
            where: { id: applicationId },
            data: { currentNodeId: nextNodeId },
        });

        await tx.approvalHistory.create({
            data: {
                applicationId,
                actorId: 'SYSTEM',
                action: 'DELAY',
                stepId: nodeId,
                comment: `待機開始: ${delayMs / 1000}秒`,
            },
        });

        // Enqueue delayed job
        await this.helper.advanceToNextNode(applicationId, delayMs);
    }
}
