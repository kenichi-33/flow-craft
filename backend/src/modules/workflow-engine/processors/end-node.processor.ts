import { Injectable } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class EndNodeProcessor implements INodeProcessor {
  getType(): string {
    return 'end';
  }

  constructor(private helper: WorkflowHelperService) {}

  async process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { applicationId, nodeId, node } = context;
    const status = node.data?.status || 'APPROVED';
    const message = node.data?.message || '申請が完了しました';

    const currentApp = await tx.application.findUnique({
      where: { id: applicationId },
      include: { flowDefinition: true },
    });

    if (!currentApp) throw new Error('Application not found');

    // 1. Update Current Application Status
    await tx.application.update({
      where: { id: applicationId },
      data: {
        status: status,
        currentNodeId: nodeId,
      },
    });
    await tx.approvalHistory.create({
      data: {
        applicationId,
        actorId: 'SYSTEM',
        action: 'APPLICATION_COMPLETE',
        stepId: nodeId,
        comment: message,
      },
    });

    // 2. Check for Parent Application (Sub-Process Resumption)
    if ((currentApp as any)?.parentId) {
      const parentId = (currentApp as any).parentId;

      // Fetch Parent to get its Current Node (The SubProcess Node)
      const parentApp = await tx.application.findUnique({
        where: { id: parentId },
        include: { flowDefinition: true }, // Need flow definition to find node config
      });

      if (parentApp) {
        const flowNodes = (parentApp.flowNodes ||
          parentApp.flowDefinition.nodes ||
          []) as any[];
        const parentNodeId = parentApp.currentNodeId;
        const subProcessNode = flowNodes.find((n) => n.id === parentNodeId);

        if (subProcessNode && subProcessNode.type === 'subProcess') {
          const config = subProcessNode.data || {};

          // Output Mapping
          // config.outputMapping = { parentField: '{{childField}}' }
          const newParentInputData = { ...(parentApp.inputData as any) };

          if (config.outputMapping) {
            const mapping: Record<string, string> = config.outputMapping;
            const substitutionContext = {
              child: { ...currentApp, inputData: currentApp.inputData },
              // result: status...
            };

            for (const [key, template] of Object.entries(mapping)) {
              const value = this.helper.substituteVariables(
                template,
                substitutionContext,
              );
              newParentInputData[key] = value;
            }

            // Update Parent Data
            await tx.application.update({
              where: { id: parentId },
              data: { inputData: newParentInputData },
            });
          }

          // Log in Parent
          await tx.approvalHistory.create({
            data: {
              applicationId: parentId,
              actorId: 'SYSTEM',
              action: 'SUB_PROCESS_END',
              stepId: parentNodeId!,
              comment: `サブプロセス完了: ${applicationId} (Status: ${currentApp.status})`,
            },
          });

          // Resume Parent
          // We must call this AFTER the transaction involves the parent?
          // helper.advanceToNextNode is internal but uses QueueService.
          // Ideally we enqueue the job.
          await this.helper.advanceToNextNode(
            parentId,
            parentNodeId || undefined,
          );
        }
      }
    }
  }
}
