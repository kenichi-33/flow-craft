import { Injectable, Logger } from '@nestjs/common';
import { INodeProcessor, NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { MailService } from '../../notifications/mail.service';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class SendEmailProcessor implements INodeProcessor {
    private readonly logger = new Logger(SendEmailProcessor.name);

    constructor(
        private helper: WorkflowHelperService,
        private mailService: MailService,
    ) {}

    getType(): string {
        return 'sendEmail';
    }

    async process(context: NodeProcessorContext, tx: Prisma.TransactionClient): Promise<void> {
        const { applicationId, nodeId, node, inputData, applicantId } = context;

        // NOTE: Previously we executed inline, now we enqueue a task for the Handler.
        // The Handler will deal with variable substitution and sending (async).
        // This makes SendEmail consistent with ServiceTask pattern.

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
        
        this.logger.log(`Enqueued SendEmail task for node ${nodeId}`);
        // Do NOT advance here. Handler will advance upon completion.
    }
}
