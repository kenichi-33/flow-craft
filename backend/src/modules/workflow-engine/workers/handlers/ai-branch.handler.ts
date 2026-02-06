import { Injectable, Logger } from '@nestjs/common';
import { ITaskHandler, TaskContext, TaskResult } from '../task-handler.interface';
import { AiBranchService } from '../../../ai-core/services/ai-branch.service';
import { WorkflowHelperService } from '../../workflow-helper.service';

@Injectable()
export class AiBranchHandler implements ITaskHandler {
  readonly taskType = 'aiBranch';
  private readonly logger = new Logger(AiBranchHandler.name);

  constructor(
    private readonly aiBranchService: AiBranchService,
    private readonly workflowHelper: WorkflowHelperService,
  ) {}

  async execute(context: TaskContext): Promise<TaskResult> {
    const { applicationId, nodeId, nodeData, inputData } = context;
    this.logger.log(`Executing AI Branch logic for node ${nodeId}`);

    try {
      // 1. Prepare rules from nodeData
      const rules = nodeData.rules || [];
      const branchRules = rules.map((r: any) => ({
        id: r.id,
        label: r.label,
        aiCondition: r.aiCondition,
      }));

      // Explicitly add 'default' rule to guide AI
      branchRules.push({
        id: 'default',
        label: nodeData.defaultLabel || 'その他 (Default)',
        aiCondition: 'If none of the above conditions are met.',
      });

      // 2. Call AI Service
      const result = await this.aiBranchService.evaluate({
        formData: inputData,
        branchRules,
        provider: nodeData.provider,
        model: nodeData.model,
        temperature: nodeData.temperature,
        apiKey: nodeData.apiKey,
        baseUrl: nodeData.baseUrl,
      });

      this.logger.log(`AI selected route: ${result.selectedRouteId} (${result.reasoning})`);

      // 3. Determine Next Node
      // We need to map ruleId (selectedRouteId) to the actual target Node ID.
      // Unlike the old worker, we don't have 'edgeMap' pre-calculated in the payload.
      // But we can use `workflowHelper` to find it? 
      // Actually, `GenericWorker` passes `nodeData`. 
      // It DOES NOT pass Edges. `context` has limited info.
      // We need to fetch edges or helper needs to support "Find Target by Handle".
      
      // Let's check `WorkflowHelperService`. Does it have edge lookup? 
      // No, `enqueueTask` takes context, but execution happens later.
      // However, `AiBranchNodeProcessor` *had* access to edges. 
      // Can `AiBranchNodeProcessor` put the edge map into `nodeData` (runtime override) or `inputData`?
      // `inputData` is for form data. `nodeData` is config.
      // `TaskExecuteJob.nodeData` comes from `node.data`.
      // The Processor *creates* the Job in `GenericWorker`.
      // Wait, `GenericWorker` is triqqered by `TASK_EXECUTE`.
      // `AiBranchNodeProcessor` (Executor) enqueues `TASK_EXECUTE`.
      // So `AiBranchNodeProcessor` CAN inject `edgeMap` into the payload!
      // But `TaskContext` usually takes `nodeData` from `Task` definition in DB?
      // In `GenericWorker.processJob`: `nodeData` comes from the job payload (lines 43).
      // `job` is queued by `WorkflowHelper.enqueueTask` (line 118 calls `node.data`).
      // So if `AiBranchNodeProcessor` modifies `node.data` before passing to `enqueueTask`, we are good.
      // OR, we pass it as a separate property in `job`? `TaskExecuteJob` has `nodeData`.
      
      // Better approach: `nodeData` in the Handler Context *should* contain what we need.
      // In `AiBranchNodeProcessor`, we calculates edgeMap. We can add it to `nodeData` specific for this execution?
      // `enqueueTask` takes `node`. We can pass `{ ...node, data: { ...node.data, edgeMap } }`.
      
      const edgeMap = nodeData.edgeMap || {};
      const targetNodeId = edgeMap[result.selectedRouteId] || edgeMap['default'];

      if (targetNodeId) {
        // 4. Manually Advance
        await this.workflowHelper.advanceToNextNode(applicationId, nodeId, targetNodeId);
        
        return {
          success: true,
          outputData: {
            selectedRouteId: result.selectedRouteId,
            reasoning: result.reasoning,
          },
          manualAdvance: true, // Tell GenericWorker we handled it
          shouldAdvance: false, // Don't let engine auto-advance (it follows all edges)
          logs: [`AI Reasoning: ${result.reasoning}`],
        };
      } else {
         return {
          success: false,
          error: `No target node found for route ${result.selectedRouteId}`,
          shouldAdvance: false,
        };
      }

    } catch (error) {
      this.logger.error(`AI Branch failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
