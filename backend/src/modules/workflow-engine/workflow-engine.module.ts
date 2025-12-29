import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowEngineController } from './workflow-engine.controller';

@Module({
    controllers: [WorkflowEngineController],
    providers: [WorkflowEngineService],
    exports: [WorkflowEngineService],
})
export class WorkflowEngineModule { }
