import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { IsString, IsOptional, IsIn } from 'class-validator';

class StartWorkflowDto {
    @IsString()
    applicationDefinitionId: string;

    @IsString()
    applicantId: string;

    @IsOptional()
    inputData: any;
}

class CompleteTaskDto {
    @IsIn(['APPROVE', 'REJECT', 'REMAND'])
    action: 'APPROVE' | 'REJECT' | 'REMAND';

    @IsString()
    actorId: string;

    @IsOptional()
    @IsString()
    comment?: string;
}

@Controller('workflow')
export class WorkflowEngineController {
    constructor(private readonly workflowService: WorkflowEngineService) { }

    @Post('start')
    startWorkflow(@Body() dto: StartWorkflowDto) {
        return this.workflowService.startWorkflow(dto);
    }

    @Post('tasks/:id/complete')
    completeTask(@Param('id') taskId: string, @Body() dto: CompleteTaskDto) {
        return this.workflowService.completeTask({
            taskId,
            ...dto,
        });
    }

    @Post('tasks/:id/retry')
    retryTask(@Param('id') taskId: string) {
        return this.workflowService.retryServiceTask(taskId);
    }

    @Post('applications/:id/resubmit')
    resubmitApplication(@Param('id') applicationId: string, @Body() dto: { inputData: any }) {
        return this.workflowService.resubmitApplication(applicationId, dto.inputData);
    }

    @Get('applications/:id/status')
    getWorkflowStatus(@Param('id') applicationId: string) {
        return this.workflowService.getWorkflowStatus(applicationId);
    }
}
