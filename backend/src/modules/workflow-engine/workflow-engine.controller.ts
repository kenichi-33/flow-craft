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

  @IsOptional()
  isTestMode?: boolean;

  @IsOptional()
  version?: number;

  @IsOptional()
  useDraft?: boolean;
}

class CompleteTaskDto {
  @IsIn(['APPROVE', 'REJECT', 'REMAND', 'SUBMIT'])
  action: 'APPROVE' | 'REJECT' | 'REMAND' | 'SUBMIT';

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  inputData?: any;

  @IsOptional()
  @IsString()
  remandTargetStepId?: string; // 任意ステップへの差し戻し用
}

@Controller('workflow')
export class WorkflowEngineController {
  constructor(private readonly workflowService: WorkflowEngineService) {}

  @Post('start')
  startWorkflow(@Body() dto: StartWorkflowDto, @CurrentUser() user: AuthUser) {
    return this.workflowService.startWorkflow({
      ...dto,
      applicantId: user.username, // ログインユーザーを申請者に設定
      isTestMode: dto.isTestMode,
      version: dto.version,
      useDraft: dto.useDraft,
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
      actorId: user.username,
      remandTargetStepId: dto.remandTargetStepId,
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

  @Get('applications/:id/remandable-steps')
  getRemandableSteps(
    @Param('id') applicationId: string,
    @Query('taskId') taskId?: string,
  ) {
    return this.workflowService.getRemandableSteps(applicationId, taskId);
  }
}
