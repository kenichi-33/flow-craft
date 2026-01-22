import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { PrismaModule } from '../../prisma/prisma.module';

import { StorageCleanupService } from './storage-cleanup.service';

@Module({
  imports: [PrismaModule],
  controllers: [StorageController],
  providers: [StorageService, StorageCleanupService],
  exports: [StorageService],
})
export class StorageModule {}
