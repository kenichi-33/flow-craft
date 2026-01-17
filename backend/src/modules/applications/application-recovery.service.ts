import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class ApplicationRecoveryService {
    private readonly logger = new Logger(ApplicationRecoveryService.name);

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
            },
            include: {
                flowDefinition: true,
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
            this.logger.warn(`Found stuck RUNNING task ${task.id} (Worker: ${task.workerId}). Marking as FAILED.`);
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
            this.logger.warn(`Found stuck QUEUED task ${task.id}. Re-enqueuing.`);
            // Re-enqueue
            const job = {
                taskId: task.id,
                applicationId: task.applicationId,
                nodeId: task.stepId,
                nodeType: task.type,
                nodeData: task.config || {},
                inputData: {}, // Need input data? Usually in app or passed.
                // Re-fetching app input data might be needed if not stored in task.
                // Simplified: Just re-queue TASK_EXECUTE with task info.
                // But GenericWorker needs inputData.
                // Ideally inputData is stored in Task or we fetch App.
                // For now, let's fetch Application inputData.
                applicantId: '', // Need applicantId
            } as any; 

            // Fetch missing info
            const app = await this.prisma.application.findUnique({
                 where: { id: task.applicationId },
                 select: { inputData: true, applicantId: true }
            });

            if (app) {
                job.inputData = app.inputData;
                job.applicantId = app.applicantId;

                await this.queueService.enqueue('TASK_EXECUTE', job, { deduplicationId: task.id });
                
                // Update timestamp to reset timeout timer
                await this.prisma.workflowTask.update({
                    where: { id: task.id },
                    data: { updatedAt: new Date() },
                });
            }
        }

        if (stuckApplications.length > 0) {
            this.logger.warn(`Found ${stuckApplications.length} stuck applications. Attempting recovery...`);
        }

        for (const app of stuckApplications) {
            try {
                this.logger.log(`Recovering application ${app.id} (Current Node: ${app.currentNodeId})`);

                // Re-enqueue the processing job for the current node
                // The worker is idempotent enough to handle re-processing or determining next step
                // Re-enqueue the processing job for the current node
                // The worker is idempotent enough to handle re-processing or determining next step
                await this.queueService.enqueue('WORKFLOW_NODE_PROCESS', {
                    applicationId: app.id,
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
