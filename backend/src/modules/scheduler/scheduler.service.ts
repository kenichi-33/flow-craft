import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry, Cron } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.loadSchedulesFromDb();
  }

  private async loadSchedulesFromDb() {
    this.logger.log('Loading schedules from database...');
    const definitions = await this.prisma.applicationDefinition.findMany({
      where: {
        scheduleCron: { not: null },
        status: 'ACTIVE', // Only active definitions
      },
    });

    for (const def of definitions) {
      if (def.scheduleCron && def.scheduleCron.trim() !== '') {
        try {
          await this.scheduleWorkflow(def.id, def.scheduleCron, {
            applicationDefinitionId: def.id,
            triggeredBy: 'schedule',
          });
        } catch (error) {
          this.logger.error(
            `Failed to schedule workflow ${def.id}: ${error.message}`,
          );
        }
      }
    }
    this.logger.log(`Loaded ${definitions.length} schedules.`);
  }

  async scheduleWorkflow(
    name: string,
    cron: string,
    payload: any,
  ): Promise<void> {
    // Remove existing if any
    this.unscheduleWorkflow(name);

    if (!cron || cron.trim() === '') {
      this.logger.warn(`Skipping scheduling for ${name} due to empty cron`);
      return;
    }

    try {
      const job = new CronJob(cron, async () => {
        const now = new Date();
        // Round down to the nearest minute to create a consistent lock key for this scheduled time
        const lockedAt = new Date(now);
        lockedAt.setSeconds(0, 0);

        const lockKey = `workflow_schedule:${name}`;

        try {
          // Attempt to acquire lock
          await this.prisma.cronScheduleLock.create({
            data: {
              key: lockKey,
              lockedAt: lockedAt,
            },
          });

          this.logger.log(`Acquired lock for ${name} at ${lockedAt.toISOString()}`);
          this.logger.log(`Executing scheduled workflow: ${name}`);
          await this.queueService.enqueue('WORKFLOW_START', payload);
        } catch (error) {
          if (error.code === 'P2002') {
            this.logger.debug(
              `Skipping execution for ${name} at ${lockedAt.toISOString()}: Lock already acquired by another instance.`,
            );
          } else {
            this.logger.error(
              `Error acquiring lock for ${name}: ${error.message}`,
            );
          }
        }
      });

      this.schedulerRegistry.addCronJob(name, job);
      job.start();
      this.logger.log(`Scheduled workflow ${name} with cron: ${cron}`);
    } catch (error) {
      this.logger.error(`Error scheduling workflow ${name}: ${error.message}`);
      // Don't throw to prevent crashing main thread on bad cron
    }
  }

  /**
   * Cleanup old locks
   * Runs every hour
   */
  @Cron('0 0 * * * *')
  async cleanupLocks() {
    this.logger.log('Cleaning up old schedule locks...');
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const result = await this.prisma.cronScheduleLock.deleteMany({
        where: {
          createdAt: {
            lt: oneHourAgo,
          },
        },
      });
      this.logger.log(`Deleted ${result.count} old schedule locks.`);
    } catch (error) {
      this.logger.error(`Failed to cleanup locks: ${error.message}`);
    }
  }

  unscheduleWorkflow(name: string): void {
    try {
      if (this.schedulerRegistry.doesExist('cron', name)) {
        this.schedulerRegistry.deleteCronJob(name);
        this.logger.log(`Unscheduled workflow: ${name}`);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to unschedule ${name} (might not exist): ${error.message}`,
      );
    }
  }

  /**
   * Check for SLA Breaches and Reminders (Polling)
   * Runs every minute. Uses DB Atomic Update for concurrency control.
   */
  @Cron('0 * * * * *')
  async checkSlaAndReminders() {
    this.logger.debug('Checking SLA and Reminders...');
    const now = new Date();

    // 1. Check SLA Breaches
    const slaTasks = await this.prisma.workflowTask.findMany({
      where: {
        status: 'PENDING',
        slaDueAt: { lte: now },
        slaNotified: false,
      },
      take: 100, // Batch size to prevent memory explosion
    });

    for (const task of slaTasks) {
      // Atomic Update (Exclude double execution)
      const updated = await this.prisma.workflowTask.updateMany({
        where: {
          id: task.id,
          slaNotified: false, // Re-check condition
        },
        data: {
          slaNotified: true,
        },
      });

      if (updated.count > 0) {
        // Enqueue Notification (Immediate)
        await this.queueService.enqueue('TASK_SLA_BREACH', { taskId: task.id });
        this.logger.log(`Enqueued SLA Breach notification for task ${task.id}`);
      }
    }

    // 2. Check Reminders
    const reminderTasks = await this.prisma.workflowTask.findMany({
      where: {
        status: 'PENDING',
        reminderDueAt: { lte: now },
        reminderNotified: false,
      },
      take: 100,
    });

    for (const task of reminderTasks) {
      // Atomic Update
      const updated = await this.prisma.workflowTask.updateMany({
        where: {
          id: task.id,
          reminderNotified: false,
        },
        data: {
          reminderNotified: true,
        },
      });

      if (updated.count > 0) {
        await this.queueService.enqueue('TASK_REMINDER', { taskId: task.id });
        this.logger.log(`Enqueued Reminder notification for task ${task.id}`);
      }
    }
  }
}
