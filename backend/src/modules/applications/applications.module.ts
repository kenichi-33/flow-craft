import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationRecoveryService } from './application-recovery.service';
import { UsersModule } from '../users/users.module';

import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';

@Module({
  imports: [UsersModule, WorkflowEngineModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationRecoveryService],
})
export class ApplicationsModule {}
