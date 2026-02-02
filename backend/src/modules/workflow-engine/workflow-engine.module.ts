import { Module } from '@nestjs/common';
import { WorkflowEngineController } from './workflow-engine.controller';
import { WebhookController } from './webhook.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { QueueModule } from '../queue/queue.module';
import { TeamsModule } from '../teams/teams.module';
import { WorkflowCoreModule } from './workflow-core.module';

@Module({
  imports: [
    WorkflowCoreModule,
    NotificationsModule,
    UsersModule,
    QueueModule,
    TeamsModule,
  ],
  controllers: [WorkflowEngineController, WebhookController],
  providers: [],
  exports: [],
})
export class WorkflowEngineModule {}
