import { Injectable, Logger } from '@nestjs/common';
import { INodeProcessor, NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class SlackProcessor implements INodeProcessor {
    private readonly logger = new Logger(SlackProcessor.name);

    constructor(
        private helper: WorkflowHelperService,
    ) {}

    getType(): string {
        return 'slack';
    }

    async process(context: NodeProcessorContext, tx: Prisma.TransactionClient): Promise<void> {
        const { applicationId, nodeId, node, inputData, applicantId } = context;

        await this.helper.enqueueTask(
            applicationId,
            node,
            inputData,
            applicantId,
            null, // assignee: SYSTEM handles it
            null,
            null,
            tx
        );
        
        this.logger.log(`Enqueued Slack/Webhook task for node ${nodeId}`);
        // Do NOT advance here. Handler will advance upon completion.
    }
}
