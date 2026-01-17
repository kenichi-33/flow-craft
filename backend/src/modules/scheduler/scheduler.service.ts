import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
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
            if (def.scheduleCron) {
                try {
                    await this.scheduleWorkflow(def.id, def.scheduleCron, {
                        applicationDefinitionId: def.id,
                        triggeredBy: 'schedule'
                    });
                } catch (error) {
                    this.logger.error(`Failed to schedule workflow ${def.id}: ${error.message}`);
                }
            }
        }
        this.logger.log(`Loaded ${definitions.length} schedules.`);
    }

    async scheduleWorkflow(name: string, cron: string, payload: any): Promise<void> {
        // Remove existing if any
        this.unscheduleWorkflow(name);

        try {
            const job = new CronJob(cron, async () => {
                this.logger.log(`Executing scheduled workflow: ${name}`);
                await this.queueService.enqueue('WORKFLOW_START', payload);
            });

            this.schedulerRegistry.addCronJob(name, job);
            job.start();
            this.logger.log(`Scheduled workflow ${name} with cron: ${cron}`);
        } catch (error) {
            this.logger.error(`Error scheduling workflow ${name}: ${error.message}`);
            // Don't throw to prevent crashing main thread on bad cron
        }
    }

    unscheduleWorkflow(name: string): void {
        try {
            if (this.schedulerRegistry.doesExist('cron', name)) {
                this.schedulerRegistry.deleteCronJob(name);
                this.logger.log(`Unscheduled workflow: ${name}`);
            }
        } catch (error) {
            this.logger.warn(`Failed to unschedule ${name} (might not exist): ${error.message}`);
        }
    }
}
