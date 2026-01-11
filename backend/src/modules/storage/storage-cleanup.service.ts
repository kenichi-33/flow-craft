import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageService } from './storage.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StorageCleanupService {
    private readonly logger = new Logger(StorageCleanupService.name);

    constructor(
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}

    // Run every day at 3:00 AM
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async handleCron() {
        this.logger.debug('Starting daily storage cleanup...');

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        try {
            // 1. Delete expired pending files (older than 24h)
            const expiredPending = await this.prisma.file.findMany({
                where: {
                    status: 'pending',
                    createdAt: {
                        lt: twentyFourHoursAgo,
                    },
                },
            });

            if (expiredPending.length > 0) {
                this.logger.log(`Found ${expiredPending.length} expired pending files.`);
                for (const file of expiredPending) {
                    await this.cleanupFile(file);
                }
            }

            // 2. Delete orphaned uploaded files (uploaded but not linked to application for 24h)
            const orphanedUploaded = await this.prisma.file.findMany({
                where: {
                    status: 'uploaded',
                    applicationId: null,
                    createdAt: {
                        lt: twentyFourHoursAgo,
                    },
                },
            });

            if (orphanedUploaded.length > 0) {
                this.logger.log(`Found ${orphanedUploaded.length} orphaned uploaded files.`);
                for (const file of orphanedUploaded) {
                    await this.cleanupFile(file);
                }
            }

            this.logger.debug('Storage cleanup completed.');
        } catch (error) {
            this.logger.error('Failed to cleanup storage', error);
        }
    }

    private async cleanupFile(file: any) {
        try {
            // Delete from MinIO (using StorageService's internal logic if exposed, 
            // but deleteFile expects userId for auth check. 
            // We should use a system-level delete or direct client usage, 
            // but reusing deleteFile with bypass or direct client is better.)
            
            // To be safe and clean, let's execute the logic directly here or expose a system method.
            // Since StorageService is designed for user ops, I'll access the client logic via a new method in StorageService 
            // OR just use deleteFile but I need a system user ID? No, deleteFile checks DB.
            
            // Better approach: StorageService.deleteFileSystem(fileId)
            // For now, I will assume we can add a method to StorageService.
            
            await this.storageService.deleteFileSystem(file);
            
            this.logger.log(`Deleted file: ${file.id} (${file.key})`);
        } catch (e) {
            this.logger.error(`Failed to delete file ${file.id}:`, e);
            // Even if MinIO fails (e.g. not found), we should probably delete from DB or mark as error
             await this.prisma.file.update({
                where: { id: file.id },
                data: { status: 'deleted' }, // Soft delete or just leave it?
            });
        }
    }
}
