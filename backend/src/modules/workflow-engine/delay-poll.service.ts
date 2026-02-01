import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowHelperService } from './workflow-helper.service';

@Injectable()
export class DelayPollService {
  private readonly logger = new Logger(DelayPollService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly helper: WorkflowHelperService,
  ) {}

  /**
   * Check for delayed tasks that are due to be resumed.
   * Runs every minute.
   */
  @Cron('*/1 * * * *')
  async checkDelayedTasks() {
    this.logger.debug('Checking for delayed tasks to resume...');
    const now = new Date();

    // Find tasks that are due
    const tasks = await this.prisma.workflowTask.findMany({
      where: {
        type: 'delay',
        status: 'PENDING',
        scheduledAt: {
          lte: now,
        },
      },
      take: 100, // Batch size
    });

    if (tasks.length > 0) {
      this.logger.log(
        `Found ${tasks.length} delayed tasks due for resumption.`,
      );
    }

    for (const task of tasks) {
      try {
        // Atomic update to mark as completed.
        // This ensures only one instance picks up the task (Optimistic Locking).
        const updated = await this.prisma.workflowTask.updateMany({
          where: {
            id: task.id,
            status: 'PENDING',
          },
          data: {
            status: 'COMPLETED',
            result: { delayed: true, finishedAt: now },
            updatedAt: now,
          },
        });

        if (updated.count > 0) {
          this.logger.log(
            `Resuming delayed task ${task.id} (Application: ${task.applicationId}, Node: ${task.stepId})`,
          );

          // Create history record for completion
          await this.prisma.workflowTaskHistory.create({
            data: {
              taskId: task.id,
              applicationId: task.applicationId,
              stepId: task.stepId,
              type: 'delay',
              status: 'COMPLETED',
              result: { delayed: true, scheduledAt: task.scheduledAt },
              executedAt: now,
            },
          });

          // Resume workflow by advancing to next node
          await this.helper.advanceToNextNode(task.applicationId, task.stepId);
        }
      } catch (error) {
        this.logger.error(`Failed to resume task ${task.id}: ${error.message}`);
      }
    }
  }
}
