import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowEngineController } from './workflow-engine.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [NotificationsModule, UsersModule],
    controllers: [WorkflowEngineController],
    providers: [WorkflowEngineService],
    exports: [WorkflowEngineService],
})
export class WorkflowEngineModule { }
