import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { IsString, IsOptional, IsIn, IsNotEmpty } from 'class-validator';
import { CurrentUser } from '../../auth/decorators';
import type { AuthUser } from '../../auth/types/user.interface';

class StartWorkflowDto {
  @IsString()
  applicationDefinitionId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  inputData: any;
}

class CompleteTaskDto {
  @IsIn(['APPROVE', 'REJECT', 'REMAND', 'SUBMIT'])
  action: 'APPROVE' | 'REJECT' | 'REMAND' | 'SUBMIT';

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  inputData?: any;
}

@Controller('workflow')
export class WorkflowEngineController {
  constructor(private readonly workflowService: WorkflowEngineService) {}

  @Post('start')
  startWorkflow(@Body() dto: StartWorkflowDto, @CurrentUser() user: AuthUser) {
    return this.workflowService.startWorkflow({
      ...dto,
      applicantId: user.username, // ログインユーザーを申請者に設定
    });
  }

  @Post('save-draft')
  saveDraft(@Body() dto: StartWorkflowDto, @CurrentUser() user: AuthUser) {
    return this.workflowService.saveDraft({
      ...dto,
      applicantId: user.username,
    });
  }

  @Post('tasks/:id/complete')
  completeTask(
    @Param('id') taskId: string,
    @Body() dto: CompleteTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workflowService.completeTask({
      taskId,
      action: dto.action,
      comment: dto.comment,
      inputData: dto.inputData,
      actorId: user.username, // ログインユーザーを承認者に設定
    });
  }

  @Post('tasks/:id/retry')
  retryTask(@Param('id') taskId: string) {
    return this.workflowService.retryServiceTask(taskId);
  }

  @Post('tasks/retry-batch')
  retryTasks(@Body('taskIds') taskIds: string[]) {
    return this.workflowService.retryServiceTasks(taskIds);
  }

  @Get('admin/failed-tasks')
  getFailedServiceTasks(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.workflowService.getFailedServiceTasks(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      search,
    );
  }

  @Post('submit-draft/:id')
  submitDraft(
    @Param('id') applicationId: string,
    @Body() dto: { inputData: any },
  ) {
    return this.workflowService.submitDraft(applicationId, dto.inputData);
  }

  @Post('applications/:id/resubmit')
  resubmitApplication(
    @Param('id') applicationId: string,
    @Body() dto: { inputData: any },
  ) {
    return this.workflowService.resubmitApplication(
      applicationId,
      dto.inputData,
    );
  }

  @Get('applications/:id/status')
  getWorkflowStatus(@Param('id') applicationId: string) {
    return this.workflowService.getWorkflowStatus(applicationId);
  }
}
