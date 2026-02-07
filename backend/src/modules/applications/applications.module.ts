import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationRecoveryService } from './application-recovery.service';
import { UsersModule } from '../users/users.module';

import { WorkflowCoreModule } from '../workflow-engine/workflow-core.module';

@Module({
  imports: [UsersModule, WorkflowCoreModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationRecoveryService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
