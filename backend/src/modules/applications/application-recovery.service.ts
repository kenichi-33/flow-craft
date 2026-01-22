import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class ApplicationRecoveryService {
  private readonly logger = new Logger(ApplicationRecoveryService.name);
  private readonly MAX_RECOVERY_RETRIES = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleRecovery() {
    this.logger.log('Starting application recovery job...');

    // Find applications that are IN_PROGRESS but have no pending tasks
    // indicating a failure to enqueue the next step
    const stuckApplications = await this.prisma.application.findMany({
      where: {
        status: 'IN_PROGRESS',
        updatedAt: {
          lt: new Date(Date.now() - 5 * 60 * 1000), // Older than 5 minutes
        },
        workflowTasks: {
          none: {
            status: {
              in: ['PENDING', 'QUEUED', 'RUNNING'], // Exclude if any task is active (PENDING/QUEUED/RUNNING)
            },
          },
        },
        // Additional check: Ensure we don't pick up apps that have a FAILED task for the current node
        // effectively meaning they reached max retries.
        // We do this by checking if ANY task matches 'FAILED' for current node.
        // Note: Prisma `none` combined with `some` might be complex or unsupported in same level if not careful.
        // Actually, let's keep it simple: We fetch stuck apps, then Filter in memory or add conditional check inside loop.
        // But Adding it to query is better for performance.
        // "Find apps where NO task is active AND NO task is FAILED for current node?"
        // Wait, if it has FAILED task, we want to STOP recovery.
        // So "workflowTasks: none: { status: in: [...] }" ensures no ACTIVE tasks.
        // We also want "workflowTasks: none: { status: 'FAILED', stepId: { equals: application.currentNodeId } }"
        // But we can't reference `application.currentNodeId` in the where clause easily without raw query or careful relation filtering.
        // Relation filtering on `currentNodeId` is hard because it's a dynamic value on the record itself.
        // Plan: Fetch potential stuck apps, then iterate and check for FAILED tasks on currentNodeId.
      },
      include: {
        flowDefinition: true,
        workflowTasks: true, // Fetch tasks to check for failures on current node
      },
    });

    // 2. Recovery for stuck RUNNING tasks (Dead Worker scenario)
    // If a task is RUNNING for more than 10 minutes, assume worker died.
    const stuckRunningTasks = await this.prisma.workflowTask.findMany({
      where: {
        status: 'RUNNING',
        updatedAt: {
          lt: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
    });

    for (const task of stuckRunningTasks) {
      this.logger.warn(
        `Found stuck RUNNING task ${task.id} (Worker: ${task.workerId}). Marking as FAILED.`,
      );
      await this.prisma.workflowTask.update({
        where: { id: task.id },
        data: {
          status: 'FAILED',
          error: 'Task execution timed out (Worker unresponsive)',
        },
      });
      // Optionally enqueue recovery or notification if needed
    }

    // 3. Recovery for stuck QUEUED tasks (Message Lost scenario)
    // If a task is QUEUED for more than 10 minutes, assume message lost.
    const stuckQueuedTasks = await this.prisma.workflowTask.findMany({
      where: {
        status: 'QUEUED',
        updatedAt: {
          lt: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
    });

    for (const task of stuckQueuedTasks) {
      if (task.retries >= this.MAX_RECOVERY_RETRIES) {
        this.logger.error(
          `Task ${task.id} exceeded max recovery retries (${this.MAX_RECOVERY_RETRIES}). Marking as FAILED.`,
        );
        await this.prisma.workflowTask.update({
          where: { id: task.id },
          data: {
            status: 'FAILED',
            error: 'Recovery retry limit exceeded (Message lost repeatedly)',
          },
        });
        continue;
      }

      this.logger.warn(
        `Found stuck QUEUED task ${task.id} (Retry ${task.retries + 1}/${this.MAX_RECOVERY_RETRIES}). Re-enqueuing.`,
      );
      // Re-enqueue
      const job = {
        taskId: task.id,
        applicationId: task.applicationId,
        nodeId: task.stepId,
        nodeType: task.type,
        nodeData: task.config || {},
        inputData: {},
        applicantId: '',
      } as any;

      // Fetch missing info
      const app = await this.prisma.application.findUnique({
        where: { id: task.applicationId },
        select: { inputData: true, applicantId: true },
      });

      if (app) {
        job.inputData = app.inputData;
        job.applicantId = app.applicantId;

        await this.queueService.enqueue('TASK_EXECUTE', job, {
          deduplicationId: task.id,
        });

        // Update timestamp and retries count
        await this.prisma.workflowTask.update({
          where: { id: task.id },
          data: {
            updatedAt: new Date(),
            retries: { increment: 1 },
          },
        });
      }
    }

    if (stuckApplications.length > 0) {
      this.logger.warn(
        `Found ${stuckApplications.length} stuck applications. Attempting recovery...`,
      );
    }

    for (const app of stuckApplications) {
      // Check if there is a FAILED task for the current node
      // If so, we only skip if it has exceeded max retries.
      // Since we upgraded `enqueueTask` to reuse FAILED tasks and increment retries,
      // we can trust that the retry count will eventually hit the limit and stop the loop.
      const failedTask = (app as any).workflowTasks?.find(
        (t: any) => t.stepId === app.currentNodeId && t.status === 'FAILED',
      );

      if (failedTask && failedTask.retries >= this.MAX_RECOVERY_RETRIES) {
        this.logger.warn(
          `Skipping recovery for application ${app.id}: Task ${failedTask.id} exceeded max retries (${this.MAX_RECOVERY_RETRIES}).`,
        );
        continue;
      }

      try {
        this.logger.log(
          `Recovering application ${app.id} (Current Node: ${app.currentNodeId})`,
        );

        // Re-enqueue the processing job for the current node
        // The worker is idempotent enough to handle re-processing or determining next step
        await this.queueService.enqueue('WORKFLOW_NODE_PROCESS', {
          applicationId: app.id,
          targetNodeId: app.currentNodeId, // Explicitly target current node to prevent auto-advancement
        });

        // Update timestamp to prevent immediate re-processing loop if queue is just slow
        await this.prisma.application.update({
          where: { id: app.id },
          data: { updatedAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`Failed to recover application ${app.id}`, err);
      }
    }
  }
}
