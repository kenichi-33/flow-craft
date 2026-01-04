import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowEngineController } from './workflow-engine.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [NotificationsModule],
    controllers: [WorkflowEngineController],
    providers: [WorkflowEngineService],
    exports: [WorkflowEngineService],
})
export class WorkflowEngineModule { }
