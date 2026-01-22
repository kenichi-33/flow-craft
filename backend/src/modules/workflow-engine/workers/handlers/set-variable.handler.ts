import { Injectable, Logger } from '@nestjs/common';
import {
  ITaskHandler,
  TaskContext,
  TaskResult,
} from '../task-handler.interface';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * Set Variable Handler
 * Sets/Updates variables in the application input data
 */
@Injectable()
export class SetVariableHandler implements ITaskHandler {
  private readonly logger = new Logger(SetVariableHandler.name);

  constructor(
    private readonly helper: WorkflowHelperService,
    private readonly prisma: PrismaService,
  ) {}

  get taskType(): string {
    return 'setVariable';
  }

  async execute(context: TaskContext): Promise<TaskResult> {
    const { taskId, nodeId, nodeData, inputData, applicantId, applicationId } =
      context;
    this.logger.log(`Executing SetVariable Task ${taskId} (Node: ${nodeId})`);

    try {
      const config = nodeData || {};
      const variables: Array<{ key: string; value: string }> =
        config.variables || [];

      const substitutionData = {
        application: { ...inputData },
        applicant: { id: applicantId },
        input: inputData,
      };

      const outputData: Record<string, any> = {};

      for (const v of variables) {
        if (v.key) {
          // Substitute value
          const val = this.helper.substituteVariables(
            v.value,
            substitutionData,
          );
          outputData[v.key] = val;
        }
      }

      this.logger.log(
        `Setting variables for app ${applicationId}: ${Object.keys(outputData).join(', ')}`,
      );

      // Fetch current application data to ensure we merge correctly with latest state
      const app = await this.prisma.application.findUnique({
        where: { id: applicationId },
        select: { inputData: true },
      });

      if (!app) throw new Error(`Application ${applicationId} not found`);

      const currentInput = (app.inputData as Record<string, any>) || {};
      const newInput = { ...currentInput, ...outputData };

      await this.prisma.application.update({
        where: { id: applicationId },
        data: { inputData: newInput },
      });

      return {
        success: true,
        shouldAdvance: true,
        outputData: outputData,
      };
    } catch (error) {
      this.logger.error(`Failed to execute setVariable task ${taskId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        shouldAdvance: false,
      };
    }
  }
}
