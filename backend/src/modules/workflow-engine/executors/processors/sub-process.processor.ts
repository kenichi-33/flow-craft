import { Injectable, Logger } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { PrismaService } from '../../../../prisma/prisma.service';

// Note: Circular dependency risk if we inject WorkflowEngineService here?
// WorkflowEngineService imports WorkflowEngineModule providers?
// Actually WorkflowEngineService is the facade.
// If SubProcessProcessor calls WorkflowEngineService.startWorkflow, we might have circular dep.
// Better to reuse logic or use `Prisma` directly for creation.
// But `startWorkflow` has complex logic (finding definition, versions, etc).
// We should use `WorkflowEngineService` but use forwardRef or handle it carefully.
// Or just replicate "start workflow" logic for child process?
// Replicating is safer for now to avoid circular deps in NestJS if Module structure is tight.
// Alternatively, emit an event or job "START_SUBPROCESS" and handle it in a worker/service that has access.
// But Processor runs inside Worker usually? Or sync?
// Our Processors run inside `WorkflowHelperService` context (via `processNode`).
// Wait, `processNode` is called by `WorkflowHelperService`? No, `WorkflowExecutorService` or `GenericWorker`?
// `GenericWorker` calls `WorkflowExecutorService.executeTask`.
// `WorkflowExecutorService` doesn't seem to exist in my memory?
// Ah, `WorkflowExecutorService` was planned but maybe I implemented logic in `GenericWorker` or `WorkflowHelperService`?
// Let's check `WorkflowEngineService`. It delegates to `queueService`.
// The worker picks up `WORKFLOW_NODE_PROCESS`.
// The worker uses `NodeProcessorRegistry` to find processor.
// So `SubProcessProcessor` is instantiated by NestJS.
// `WorkflowEngineService` is also a provider.
// If `SubProcessProcessor` injects `WorkflowEngineService`, and `WorkflowEngineService` injects `SubProcessProcessor` (indirectly via Module/Registry? No, registry injects them).
// `WorkflowEngineService` does NOT downstream inject processors usually. It injects `QueueService`.
// `NodeProcessorRegistry` injects processors.
// `WorkflowEngineService` does NOT inject `NodeProcessorRegistry`.
// So it might be fine.

@Injectable()
export class SubProcessProcessor implements INodeProcessor {
  private readonly logger = new Logger(SubProcessProcessor.name);

  constructor(
    private helper: WorkflowHelperService,
    private prisma: PrismaService,
    // private workflowService: WorkflowEngineService // Avoid circular dep just in case, assume we might need it.
  ) {}

  getType(): string {
    return 'subProcess';
  }

  async process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { applicationId, nodeId, node, inputData, applicantId } = context;
    const config = node.data || {};
    const childAppDefId = config.applicationDefinitionId;

    if (!childAppDefId) {
      this.logger.error(
        `SubProcess Node ${nodeId} missing applicationDefinitionId`,
      );
      throw new Error(
        'SubProcess configuration error: applicationDefinitionId is missing',
      );
    }

    this.logger.log(
      `Starting SubProcess for app ${applicationId} -> Def ${childAppDefId}`,
    );

    // 1. Fetch Definition
    const appDef = await tx.applicationDefinition.findUnique({
      // Use tx
      where: { id: childAppDefId },
      include: { formDefinition: true, flowDefinition: true },
    });

    if (!appDef || !appDef.flowDefinitionId) {
      throw new Error('Child Application Definition not found or incomplete');
    }

    // Resolve Input Mapping
    // config.inputMapping = { childField: '{{parentVar}}' }
    const childInputData: any = {};
    if (config.inputMapping) {
      const mapping: Record<string, string> = config.inputMapping;
      for (const [key, template] of Object.entries(mapping)) {
        childInputData[key] = this.helper.substituteVariables(template, {
          application: { id: applicationId, ...inputData },
          input: inputData,
          // parent context
        });
      }
    }
    // Or default pass-through if no mapping?
    // Let's stick to explicit mapping or "merge parent input".
    // If config.passAllInput is true
    if (config.passAllInput) {
      Object.assign(childInputData, inputData);
    }

    // 2. Create Child Application
    // Prepare data similarly to startWorkflow
    const publishedVersion = await tx.appVersion.findUnique({
      where: {
        applicationDefinitionId_version: {
          applicationDefinitionId: appDef.id,
          version: appDef.version,
        },
      },
    });

    const flowNodes =
      publishedVersion?.flowNodes ?? appDef.flowDefinition?.nodes;
    const flowEdges =
      publishedVersion?.flowEdges ?? appDef.flowDefinition?.edges;
    const formSchema =
      publishedVersion?.formSchema ?? appDef.formDefinition?.schema;
    const startNode = ((flowNodes as any[]) || []).find(
      (n) => n.type === 'start',
    );

    if (!startNode) throw new Error('Child flow has no start node');

    // Determine Applicant (same as parent or system?)
    // Same as parent applicant usually.
    // context doesn't have applicantInfo, only applicantId.
    // We can fetch it or just use applicantId.

    // Note: Creating inside existing transaction `tx` is crucial.
    const childApp = await tx.application.create({
      data: {
        title: `[Sub] ${appDef.name} - ${applicationId.substring(0, 8)}`, // Generic title
        applicationDefinitionId: appDef.id,
        formDefinitionId: appDef.formDefinitionId!,
        flowDefinitionId: appDef.flowDefinitionId,
        applicantId: applicantId, // Inherit applicant
        // applicantInfo: ... (Fetch if needed, or null)
        status: 'IN_PROGRESS',
        inputData: childInputData,
        currentNodeId: startNode.id,
        parentId: applicationId, // LINK TO PARENT
        formSchema: (formSchema ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        flowNodes: flowNodes as any,
        flowEdges: flowEdges as any,
      },
    });

    await tx.approvalHistory.create({
      data: {
        applicationId: childApp.id,
        actorId: 'SYSTEM',
        action: 'START',
        stepId: startNode.id,
        comment: `親プロセス ${applicationId} からサブプロセスとして開始`,
      },
    });

    // 3. Suspend Parent
    // We simply do NOT call `advanceToNextNode` for the Parent.
    // The Parent remains at `currentNodeId` = `nodeId` (SubProcessNode).
    // It waits until Child completes.

    // 4. Start Child Workflow Execution
    // Since we are in a transaction, the child app is not visible to outside yet.
    // After transaction commits, we need to enqueue processing for the child.
    // But `process` method doesn't support "post-commit" hook easily.
    // However, `WorkflowHelper.advanceToNextNode` enqueues a job.
    // Job queue is outside transaction (usually).

    // So we can enlist the child app for processing.
    await this.helper.advanceToNextNode(childApp.id, startNode.id); // Child starts from StartNode

    // Log in parent
    await tx.approvalHistory.create({
      data: {
        applicationId,
        actorId: 'SYSTEM',
        action: 'SUB_PROCESS_START',
        stepId: nodeId,
        comment: `サブプロセスを開始しました: ${childApp.id}`,
      },
    });
  }
}
