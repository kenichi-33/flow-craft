import { Injectable, Logger } from '@nestjs/common';
import { INodeProcessor, NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class SetVariableProcessor implements INodeProcessor {
    private readonly logger = new Logger(SetVariableProcessor.name);

    constructor(private helper: WorkflowHelperService) {}

    getType(): string {
        return 'setVariable';
    }

    async process(context: NodeProcessorContext, tx: Prisma.TransactionClient): Promise<void> {
        const { applicationId, nodeId, node, inputData, applicantId } = context;
        const config = node.data || {};
        
        // Config: { variables: [{ key: 'foo', value: 'bar' }] }
        const variables = config.variables || [];
        
        if (!variables.length) {
            this.logger.warn(`Set Variable Node ${nodeId} has no variables configured.`);
            // Continue
        }

        const substitutionContext = {
            application: { id: applicationId, ...inputData },
            applicant: { id: applicantId },
            input: inputData
        };

        const newInputData = { ...inputData };

        for (const variable of variables) {
            const key = variable.key;
            const valueTemplate = variable.value;
            const value = this.helper.substituteVariables(valueTemplate, substitutionContext);

            newInputData[key] = value;
            this.logger.debug(`Setting variable ${key} = ${value}`);
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
                action: 'UPDATE_VARIABLE',
                stepId: nodeId,
                comment: `変数を設定しました: ${variables.map((v: any) => v.key).join(', ')}`,
            },
        });

        // Auto-advance
        await this.helper.advanceToNextNode(applicationId, 0, nodeId);
    }
}
