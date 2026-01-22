import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../../queue/queue.service';
import { WorkflowEngineService } from '../workflow-engine.service';

@Injectable()
export class SchedulerWorker implements OnModuleInit {
  private readonly logger = new Logger(SchedulerWorker.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  async onModuleInit() {
    await this.queueService.registerHandler(
      'WORKFLOW_START',
      this.processJob.bind(this),
    );
    this.logger.log('SchedulerWorker registered for WORKFLOW_START queue');
  }

  async processJob(job: any): Promise<void> {
    const { applicationDefinitionId, triggeredBy } = job;
    this.logger.log(
      `Processing scheduled workflow start for AppDef: ${applicationDefinitionId}`,
    );

    try {
      await this.workflowEngine.startWorkflow({
        applicationDefinitionId,
        title: `Scheduled Execution: ${new Date().toISOString()}`,
        inputData: {
          _system: {
            triggeredBy: triggeredBy || 'schedule',
            triggeredAt: new Date().toISOString(),
          },
        },
        applicantId: 'system', // TODO: Make sure 'system' user exists or is handled
      });
      this.logger.log(
        `Successfully started workflow for AppDef: ${applicationDefinitionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to start scheduled workflow: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
