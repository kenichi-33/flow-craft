import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowQueryService } from './workflow-query.service';
import { WorkflowHelperService } from './workflow-helper.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { UsersModule } from '../users/users.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [PrismaModule, UsersModule, QueueModule, TeamsModule],
  providers: [
    WorkflowEngineService,
    WorkflowQueryService,
    WorkflowHelperService,
  ],
  exports: [WorkflowEngineService, WorkflowQueryService, WorkflowHelperService],
})
export class WorkflowCoreModule {}
