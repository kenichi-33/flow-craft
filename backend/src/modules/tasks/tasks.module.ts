import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { UsersModule } from '../users/users.module';
import { TeamsModule } from '../teams/teams.module';

import { WorkflowCoreModule } from '../workflow-engine/workflow-core.module';

@Module({
  imports: [UsersModule, TeamsModule, WorkflowCoreModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
