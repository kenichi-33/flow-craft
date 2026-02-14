import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import {
  ITaskHandler,
  TaskContext,
  TaskResult,
} from '../task-handler.interface';
import { AiValidatorService } from '../../../ai-core/services/ai-validator.service';
import { WorkflowEngineService } from '../../workflow-engine.service';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class AiCheckHandler implements ITaskHandler {
  readonly taskType = 'aiCheck';
  private readonly logger = new Logger(AiCheckHandler.name);

  constructor(
    private readonly aiValidatorService: AiValidatorService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflowEngineService: WorkflowEngineService,
  ) {}

  async execute(context: TaskContext): Promise<TaskResult> {
    const { taskId, applicationId, nodeId, nodeData, inputData } = context;
    this.logger.log(`Executing AI Check for task ${taskId}`);

    try {
      this.logger.log(
        `[DEBUG] AI Check Handler started for task ${taskId}, node ${nodeId}, targetSource ${nodeData.targetSource}`,
      );
      const criteria = nodeData.criteria;
      const targetSource = nodeData.targetSource || 'form'; // 'form' | specific field path
      const actionOnFail = nodeData.actionOnFail || 'remand'; // 'remand' | 'continue' | 'error'
      const remandTo = nodeData.remandTo || 'applicant'; // 'applicant' | 'previous'

      if (!criteria) {
        return {
          success: false,
          error: 'Checking criteria is not configured',
        };
      }

      // Prepare data for checking
      let checkData = inputData;
      if (targetSource !== 'form') {
        checkData = this.getValueByPath(inputData, targetSource);
      }

      // Perform AI Check
      const checkResult = await this.aiValidatorService.performCheck(
        checkData,
        criteria,
      );

      this.logger.log(
        `[DEBUG] AI Check result: ${JSON.stringify(checkResult)}`,
      );
      this.logger.log(
        `[DEBUG] Action on fail: ${actionOnFail}, Remand to: ${remandTo}`,
      );

      if (checkResult.passed) {
        return {
          success: true,
          outputData: {
            checkResult: 'passed',
            reasoning: checkResult.reasoning,
          },
          logs: [`Check Passed: ${checkResult.reasoning}`],
        };
      } else {
        // Validation Failed
        const logs = [
          `Check Failed: ${checkResult.reasoning}`,
          `Feedback: ${checkResult.feedback}`,
        ];

        if (actionOnFail === 'error') {
          return {
            success: false,
            error: `AI Check Failed: ${checkResult.feedback}`,
            logs,
          };
        } else if (actionOnFail === 'continue') {
          return {
            success: true, // Task succeeds but check failed conceptually
            outputData: {
              checkResult: 'failed',
              reasoning: checkResult.reasoning,
              feedback: checkResult.feedback,
            },
            logs,
          };
        } else {
          // REMAND (Default)
          this.logger.log(
            `AI Check failed, remanding application ${applicationId}`,
          );

          let remandTargetStepId: string | undefined = undefined;

          // Determine Remand Target
          if (remandTo === 'previous') {
            // Find the previous completed task to remand to
            // This is complex because "previous" in graph terms might be ambiguous (merge nodes).
            // We can look at execution history to find the *most recent* completed task that isn't this one.
            const lastTask = await this.prisma.workflowTask.findFirst({
              where: {
                applicationId,
                status: 'COMPLETED',
                id: { not: taskId },
              },
              orderBy: { createdAt: 'desc' },
            });

            if (lastTask) {
              remandTargetStepId = lastTask.stepId;
              this.logger.log(
                `Remanding to previous step: ${remandTargetStepId} (Task: ${lastTask.id})`,
              );
            } else {
              this.logger.warn(
                'No previous task found for remand, falling back to applicant',
              );
            }
          }

          // Execute Remand via WorkflowEngineService
          // Note: Triggering this async might be safer to avoid race conditions with task completion
          // but we need to return from this handler first.
          // However, standard task completion logic in worker will mark THIS task as COMPLETED/FAILED.
          // If we want to change application status to REMANDED, we should probably return a specific state
          // or handle the remand logic explicitly.

          // WorkflowEngineService.completeTask handles remand logic, BUT we are inside the worker execution
          // which is triggered by the queue processor. The queue processor will eventually call completeTask
          // based on our return value if we were just a simple task.

          // Here, we want to force a REMAND action.
          // If we return success=false, task retries or fails.
          // If we want to transition to REMANDED state, we have two options:
          // 1. Call workflowEngineService.completeTask({ action: 'REMAND' }) ourselves and return something special?
          //    - Dangerous because the wrapper might also try to complete it.
          // 2. Return a special output that the worker wrapper understands? (Not currently implemented)
          // 3. Just perform the remand logic here directly (or call service) and return { success: true, manualAdvance: true, shouldAdvance: false }

          // Let's use the service call, but we must be careful about the "Task is already completed" check in completeTask.
          // The task is currently RUNNING. completeTask expects PENDING? No, usually Running/Pending.
          // Wait, `completeTask` checks `task.status !== 'PENDING'`. If it is RUNNING, it might fail?
          // Let's check logic. `completeTask` updates `where: { id: taskId, status: 'PENDING' }`.

          // The worker typically updates status to RUNNING before execution.
          // See `GenericWorker.processJob`. It calls `prisma.workflowTask.update({ status: 'RUNNING' })`.
          // So `completeTask` which expects PENDING will FAIL if called here.

          // Therefore, we cannot modify `completeTask` easily without affecting other flows.
          // We should implement specific remand logic here or add support for RUNNING tasks in completeTask.
          // Modifying `completeTask` to accept RUNNING is risky if it implies manual intervention.

          // Better approach:
          // Call a specialized method or handle the DB updates directly here similar to completeTask but for automated remand.
          // actually, `completeTask` handles user interactions. This is system automation.

          // Let's implement the REMAND logic specifically for AI Check here.

          await this.processRemand(
            applicationId,
            taskId,
            checkResult.feedback,
            remandTargetStepId,
          );

          return {
            success: true, // Handler execution succeeded (remand processed)
            shouldAdvance: false, // Do not advance to next node
            manualAdvance: true, // We handled the state transition manually
            outputData: {
              checkResult: 'failed',
              feedback: checkResult.feedback,
            },
            logs,
          };
        }
      }
    } catch (error) {
      this.logger.error(`AI Check Handler Error: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Process Auto-Remand logic
   * Similar to WorkflowEngineService.completeTask({ action: 'REMAND' }) but for automated tasks
   */
  private async processRemand(
    applicationId: string,
    currentTaskId: string,
    feedback: string,
    targetStepId?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      // 1. Mark current task as INVALIDATED (since it failed check and caused remand)
      // Or should it be COMPLETED with result=Failed?
      // If we use REMANDED status for app, the flow stops.
      // Let's mark it COMPLETED (so we have record it ran) but result indicates failure/remand.
      // Actually, if we remand, we usually invalidate the path.
      // But this node ITSELF caused the remand.

      await tx.workflowTask.update({
        where: { id: currentTaskId },
        data: {
          status: 'COMPLETED', // logic executed successfully
          result: {
            checkResult: 'failed',
            feedback: feedback,
            action: 'REMAND',
          },
        },
      });

      // 2. Add History
      await tx.approvalHistory.create({
        data: {
          applicationId,
          actorId: 'system',
          action: 'REMAND',
          comment: `AIチェックにより差し戻し: ${feedback}`,
          stepId: 'ai-check', // or Node ID
        },
      });

      // 3. Cancel other pending tasks
      await tx.workflowTask.updateMany({
        where: {
          applicationId: applicationId,
          status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
          id: { not: currentTaskId },
        },
        data: { status: 'CANCELED' },
      });

      // 4. Invalidate future tasks if any (usually none if we are running)
      // But if we remand to previous, we invalidate tasks after that previous step.

      if (targetStepId) {
        const targetTask = await tx.workflowTask.findFirst({
          where: { applicationId, stepId: targetStepId },
          orderBy: { createdAt: 'desc' }, // Get latest execution of that step
        });

        if (targetTask) {
          const cutoffTime = targetTask.createdAt;
          // Invalidate everything after the target task started
          // Excluding the current task (already handled)
          await tx.workflowTask.updateMany({
            where: {
              applicationId: applicationId,
              status: 'COMPLETED',
              createdAt: { gte: cutoffTime },
              id: { not: currentTaskId },
            },
            data: { status: 'INVALIDATED' },
          });
        }
      } else {
        // Remand to Applicant (Start) - Invalidate all completed tasks
        await tx.workflowTask.updateMany({
          where: {
            applicationId: applicationId,
            status: 'COMPLETED',
            id: { not: currentTaskId },
          },
          data: { status: 'INVALIDATED' },
        });
      }

      // 5. Update Application Status
      if (targetStepId) {
        // Remand to specific step -> IN_PROGRESS, move current node
        const nodes = await this.getFlowNodes(applicationId, tx);
        const targetNode = nodes.find((n: any) => n.id === targetStepId);

        await tx.application.update({
          where: { id: applicationId },
          data: {
            currentNodeId: targetNode?.id || null,
            // status remains IN_PROGRESS
          },
        });

        // Re-create the target task
        // Only if we found the original task to copy from
        const originalTask = await tx.workflowTask.findFirst({
          where: { applicationId, stepId: targetStepId }, // invalidated one
          orderBy: { createdAt: 'desc' },
        });

        if (originalTask) {
          await tx.workflowTask.create({
            data: {
              applicationId: applicationId,
              stepId: targetStepId,
              type: originalTask.type,
              status: 'PENDING',
              assignedTo: originalTask.assignedTo,
              assignedToDisplay: originalTask.assignedToDisplay,
              assignedToInfo: originalTask.assignedToInfo as any,
              config: originalTask.config as any,
            },
          });
        }
      } else {
        // Remand to Applicant -> REMANDED
        const nodes = await this.getFlowNodes(applicationId, tx);
        const startNode = nodes.find((n: any) => n.type === 'start');

        await tx.application.update({
          where: { id: applicationId },
          data: {
            status: 'REMANDED',
            currentNodeId: startNode?.id || null,
          },
        });
      }
    });
  }

  private async getFlowNodes(applicationId: string, tx: any) {
    const app = await tx.application.findUnique({
      where: { id: applicationId },
      include: { flowDefinition: true },
    });
    return app?.flowNodes || app?.flowDefinition?.nodes || [];
  }
}
