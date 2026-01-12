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
                    lt: new Date(Date.now() - 5 * 60 * 1000), // Older than 5 minutes to avoid race with active processing
                },
                tasks: {
                    none: {
                        status: 'PENDING',
                    },
                },
            },
            include: {
                flowDefinition: true,
            },
        });

        if (stuckApplications.length > 0) {
            this.logger.warn(`Found ${stuckApplications.length} stuck applications. Attempting recovery...`);
        }

        for (const app of stuckApplications) {
            try {
                this.logger.log(`Recovering application ${app.id} (Current Node: ${app.currentNodeId})`);

                // Re-enqueue the processing job for the current node
                // The worker is idempotent enough to handle re-processing or determining next step
                await this.queueService.enqueue('workflow-node-process', {
                    applicationId: app.id,
                    nodeId: app.currentNodeId,
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
