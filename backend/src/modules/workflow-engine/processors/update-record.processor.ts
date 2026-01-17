import { Injectable, Logger } from '@nestjs/common';
import { INodeProcessor, NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class UpdateRecordProcessor implements INodeProcessor {
    private readonly logger = new Logger(UpdateRecordProcessor.name);

    constructor(private helper: WorkflowHelperService) {}

    getType(): string {
        return 'updateRecord';
    }

    async process(context: NodeProcessorContext, tx: Prisma.TransactionClient): Promise<void> {
        const { applicationId, nodeId, node, inputData, applicantId } = context;
        const config = node.data || {};
        
        // Config structure:
        // updates: [ { key: 'status', value: 'approved' }, { key: 'customField', value: '{{data.value}}' } ]
        // target: 'application' (default) | 'external' (future)

        const updates = config.updates || [];
        if (!updates.length) {
            this.logger.warn(`Update Record Node ${nodeId} has no updates configured.`);
            // Continue
        }

        const substitutionContext = {
            application: { id: applicationId, ...inputData },
            applicant: { id: applicantId },
            input: inputData
        };

        const updateData: any = {};
        const newInputData = { ...inputData }; // clone existing input data to update it

        for (const update of updates) {
            const key = update.key;
            const valueTemplate = update.value;
            const value = this.helper.substituteVariables(valueTemplate, substitutionContext);

            // Check if updating root application fields or inputData
            // For security and simplicity, we primarily support updating 'inputData' 
            // unless key starts with 'app.'?
            // Let's assume keys map to inputData fields by default.
            
            // If the user wants to update 'status', they might need restricted access?
            // For V1, we simply update inputData.
            
            newInputData[key] = value;
            this.logger.debug(`Setting ${key} = ${value}`);
        }

        // Apply updates
        await tx.application.update({
             where: { id: applicationId },
             data: {
                 inputData: newInputData,
                 currentNodeId: nodeId 
             }
        });

        await tx.approvalHistory.create({
            data: {
                applicationId,
                actorId: 'SYSTEM',
                action: 'UPDATE_DATA',
                stepId: nodeId,
                comment: `データを更新しました: ${updates.map((u: any) => u.key).join(', ')}`,
            },
        });

        // Auto-advance
        await this.helper.advanceToNextNode(applicationId, 0, nodeId);
    }
}
