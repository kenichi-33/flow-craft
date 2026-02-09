import { Injectable } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../../workflow-helper.service';

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

    // 2. Check for Parent Application (Sub-Process Resumption OR AI Child App)
    const parentId = (currentApp as any)?.parentId;
    console.log(`[EndNodeProcessor] applicationId=${applicationId}, parentId=${parentId}, currentApp.status=${currentApp.status}`);

    if (parentId) {

      // Fetch Parent
      const parentApp = await tx.application.findUnique({
        where: { id: parentId },
        include: { flowDefinition: true },
      });

      if (parentApp) {
        const flowNodes = (parentApp.flowNodes ||
          parentApp.flowDefinition.nodes ||
          []) as any[];
        const parentNodeId = parentApp.currentNodeId;
        const currentNode = flowNodes.find((n) => n.id === parentNodeId);

        // Case A: SubProcess Node
        if (currentNode && currentNode.type === 'subProcess') {
          const config = currentNode.data || {};

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

          // Resume Parent ONLY if it was waiting
          if (config.waitForCompletion !== false) {
            context.postCommitActions?.push(async () => {
              await this.helper.advanceToNextNode(
                parentId,
                parentNodeId || undefined,
              );
            });
          }
        } 
        // Case B: AI Chat Parent (Regular Parent-Child)
        // Check if all siblings are completed
        else {
           console.log(`[EndNodeProcessor] AI Chat Parent Check: parentId=${parentId}, currentAppId=${applicationId}, status=${status}`);
           const siblings = await tx.application.findMany({
             where: { parentId: parentId },
             select: { id: true, status: true }
           });
           
           // 自分自身も含めてチェック（自分は今更新したばかりなのでstatusは更新後の値になっているはずだが、
           // tx内でのfindManyが更新を反映するかは隔離レベルによる。
           // Prismaのデフォルトではトランザクション内の更新は見えない場合があるが、
           // ここでは findMany で取得しているので、もし更新が見えなければ currentApp.statusを使う必要がある。
           // 安全のため、siblingsの中に自分が含まれていてステータスが古ければcurrentApp.statusを使うロジックにする、
           // または単純にすべてのsiblingが終了状態かチェックする。
           
           const allCompleted = siblings.every(app => {
             // 自分自身の場合は更新後のステータスを使用
             if (app.id === applicationId) {
                return ['COMPLETED', 'APPROVED', 'REJECTED', 'CANCELED'].includes(status);
             }
             return ['COMPLETED', 'APPROVED', 'REJECTED', 'CANCELED'].includes(app.status);
           });

           if (allCompleted) {
              console.log(`[EndNodeProcessor] All siblings completed! parentApp.status=${parentApp.status}, parentNodeId=${parentNodeId}`);
              // 親アプリが進める状態か確認 (IN_PROGRESS)
              if (parentApp.status === 'IN_PROGRESS') {
                 // ログ記録
                  await tx.approvalHistory.create({
                    data: {
                      applicationId: parentId,
                      actorId: 'SYSTEM',
                      action: 'CHILD_APPS_COMPLETED',
                      stepId: parentNodeId || '',
                      comment: `全ての子申請が完了しました。`,
                    },
                  });
                  
                  // 親のタスク（AI Startタスクなど）を完了させる
                  await tx.workflowTask.updateMany({
                      where: {
                          applicationId: parentId,
                          stepId: parentNodeId || '',
                          status: 'PENDING',
                      },
                      data: {
                          status: 'COMPLETED',
                      }
                  });

                  // 親を進める
                  context.postCommitActions?.push(async () => {
                      await this.helper.advanceToNextNode(parentId, parentNodeId || undefined);
                  });
              }
           }
        }
      }
    }
  }
}
