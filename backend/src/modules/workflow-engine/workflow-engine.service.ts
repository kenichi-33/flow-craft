import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { TaskCompleteJob } from './workers/task-handler.interface';
import { WorkflowHelperService } from './workflow-helper.service';
import { TeamsService } from '../teams/teams.service';

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger('[Facade] WorkflowEngine');

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private queueService: QueueService,
    private helper: WorkflowHelperService,
    private teamsService: TeamsService,
  ) {}

  /**
   * Start Workflow
   */
  async startWorkflow(input: {
    applicationDefinitionId: string;
    applicantId: string;
    title: string;
    inputData: any;
  }) {
    const appDef = await this.prisma.applicationDefinition.findUnique({
      where: { id: input.applicationDefinitionId },
      include: {
        formDefinition: true,
        flowDefinition: true,
      },
    });

    if (!appDef) {
      throw new NotFoundException('ApplicationDefinition not found');
    }

    if (!appDef.formDefinitionId || !appDef.flowDefinitionId) {
      throw new BadRequestException(
        'ApplicationDefinition is not fully configured',
      );
    }

    if (appDef.status !== 'ACTIVE') {
      throw new BadRequestException('ApplicationDefinition is not active');
    }

    const flowDef = appDef.flowDefinition;
    if (!flowDef) {
      throw new BadRequestException('Flow definition not found');
    }

    const publishedVersion = await this.prisma.appVersion.findUnique({
      where: {
        applicationDefinitionId_version: {
          applicationDefinitionId: appDef.id,
          version: appDef.version,
        },
      },
    });

    const flowNodes = publishedVersion?.flowNodes ?? flowDef.nodes;
    const flowEdges = publishedVersion?.flowEdges ?? flowDef.edges;
    const formSchema =
      publishedVersion?.formSchema ?? appDef.formDefinition?.schema;

    const nodesList = (flowNodes as any[]) || [];
    const startNode = nodesList.find((n) => n.type === 'start');
    if (!startNode) {
      throw new BadRequestException('Flow has no start node');
    }

    const applicantInfo = await this.usersService.getUserSnapshotByUsername(
      input.applicantId,
    );

    const application = await this.prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          title: input.title,
          applicationDefinitionId: appDef.id,
          formDefinitionId: appDef.formDefinitionId!,
          flowDefinitionId: appDef.flowDefinitionId!,
          applicantId: input.applicantId,
          applicantInfo: applicantInfo as any,
          status: 'IN_PROGRESS',
          inputData: input.inputData,
          currentNodeId: startNode.id,
          formSchema: (formSchema ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          flowNodes: (flowNodes ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          flowEdges: (flowEdges ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
      });

      await tx.approvalHistory.create({
        data: {
          applicationId: app.id,
          actorId: input.applicantId,
          actorInfo: applicantInfo as any,
          action: 'START',
          stepId: startNode.id,
          comment: '申請を開始しました',
        },
      });

      return app;
    });

    await this.helper.advanceToNextNode(application.id);

    // Trigger indexing
    await this.queueService.enqueue('application-indexing', { applicationId: application.id });

    return this.prisma.application.findUnique({
      where: { id: application.id },
      include: {
        applicationDefinition: true,
        workflowTasks: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  /**
   * Save Draft
   */
  async saveDraft(input: {
    applicationDefinitionId: string;
    applicantId: string;
    title: string;
    inputData: any;
  }) {
    const appDef = await this.prisma.applicationDefinition.findUnique({
      where: { id: input.applicationDefinitionId },
      include: {
        formDefinition: true,
        flowDefinition: true,
      },
    });

    if (!appDef) {
      throw new NotFoundException('ApplicationDefinition not found');
    }

    if (!appDef.formDefinitionId || !appDef.flowDefinitionId) {
      throw new BadRequestException(
        'ApplicationDefinition is not fully configured',
      );
    }

    const flowDef = appDef.flowDefinition;
    const nodes = (flowDef?.nodes as any[]) || [];
    const startNode = nodes.find((n) => n.type === 'start');
    const applicantInfo = await this.usersService.getUserSnapshotByUsername(
      input.applicantId,
    );

    const application = await this.prisma.application.create({
      data: {
        title: input.title,
        applicationDefinitionId: appDef.id,
        formDefinitionId: appDef.formDefinitionId,
        flowDefinitionId: appDef.flowDefinitionId,
        applicantId: input.applicantId,
        applicantInfo: applicantInfo as any,
        status: 'DRAFT',
        inputData: input.inputData,
        currentNodeId: startNode?.id || null,
        formSchema: (appDef.formDefinition?.schema ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        flowNodes: (flowDef?.nodes ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        flowEdges: (flowDef?.edges ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });

    return this.prisma.application.findUnique({
      where: { id: application.id },
      include: {
        applicationDefinition: true,
      },
    });
  }

  /**
   * Submit Draft
   */
  async submitDraft(applicationId: string, inputData: any) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { flowDefinition: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'DRAFT') {
      throw new BadRequestException('この申請は下書きではありません');
    }

    const nodes = (application.flowNodes ||
      application.flowDefinition.nodes ||
      []) as any[];
    const startNode = nodes.find((n: any) => n.type === 'start');
    if (!startNode) {
      throw new BadRequestException('Flow has no start node');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: 'IN_PROGRESS',
          inputData: inputData,
          currentNodeId: startNode.id,
        },
      });

      await tx.approvalHistory.create({
        data: {
          applicationId: application.id,
          actorId: application.applicantId,
          actorInfo: application.applicantInfo as any,
          action: 'START',
          stepId: startNode.id,
          comment: '下書きから申請を開始しました',
        },
      });
    });

    await this.helper.advanceToNextNode(applicationId);

    // Trigger indexing
    await this.queueService.enqueue('application-indexing', { applicationId });

    return this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        applicationDefinition: true,
        workflowTasks: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  /**
   * Complete Task (Approval/Input/etc)
   */
  async completeTask(input: {
    taskId: string;
    action: 'APPROVE' | 'REJECT' | 'REMAND' | 'SUBMIT';
    actorId: string;
    comment?: string;
    inputData?: any;
  }) {
    const task = await this.prisma.workflowTask.findUnique({
      where: { id: input.taskId },
      include: {
        application: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.status !== 'PENDING') {
      throw new BadRequestException('Task is already completed');
    }

    // Allow approval and input tasks
    if (
      task.type !== 'approval' &&
      task.type !== 'input' &&
      task.type !== 'userInput'
    ) {
      throw new BadRequestException(
        'This task type cannot be completed via this API',
      );
    }

    const canExecute = await this.canUserExecuteTask(task, input.actorId);
    if (!canExecute) {
      throw new BadRequestException(
        `User ${input.actorId} is not authorized to execute this task`,
      );
    }

    const actorInfo = await this.usersService.getUserSnapshotByUsername(
      input.actorId,
    );
    let shouldAdvance = false;

    await this.prisma.$transaction(async (tx) => {
      // Update Task Status
      await tx.workflowTask.update({
        where: { id: input.taskId },
        data: {
          status: 'COMPLETED',
          result: {
            action: input.action,
            comment: input.comment,
            inputData: input.inputData,
          },
        },
      });

      // Handle Input Data Update
      if (
        (input.action === 'SUBMIT' || input.action === 'APPROVE') &&
        input.inputData
      ) {
        await tx.application.update({
          where: { id: task.applicationId },
          data: {
            inputData: {
              ...(task.application.inputData as any),
              ...input.inputData,
            },
          },
        });
      }

      // History
      await tx.approvalHistory.create({
        data: {
          applicationId: task.applicationId,
          actorId: input.actorId,
          actorInfo: actorInfo as any,
          action: input.action,
          comment: input.comment,
          stepId: task.stepId,
        },
      });

      // Determine Flow Advancement
      if (input.action === 'APPROVE' || input.action === 'SUBMIT') {
        shouldAdvance = true;
      } else if (input.action === 'REJECT') {
        const application = await tx.application.findUnique({
          where: { id: task.applicationId },
          include: { flowDefinition: true },
        });
        const nodes = (application?.flowNodes ||
          application?.flowDefinition?.nodes ||
          []) as any[];
        const endNode = nodes.find((n: any) => n.type === 'end');

        await tx.application.update({
          where: { id: task.applicationId },
          data: {
            status: 'REJECTED',
            currentNodeId: endNode?.id || null,
          },
        });
        if (endNode) shouldAdvance = true;
      } else if (input.action === 'REMAND') {
        const taskConfig = task.config as any;
        if (taskConfig?.allowRemand !== true) {
          throw new BadRequestException(
            'This task does not allow remand action',
          );
        }

        const application = await tx.application.findUnique({
          where: { id: task.applicationId },
          include: { flowDefinition: true },
        });
        const nodes = (application?.flowNodes ||
          application?.flowDefinition?.nodes ||
          []) as any[];
        const startNode = nodes.find((n: any) => n.type === 'start');

        // Cancel other pending tasks
        await tx.workflowTask.updateMany({
          where: {
            applicationId: task.applicationId,
            status: 'PENDING',
            id: { not: task.id },
          },
          data: { status: 'CANCELED' },
        });

        await tx.application.update({
          where: { id: task.applicationId },
          data: {
            status: 'REMANDED',
            currentNodeId: startNode?.id || null,
          },
        });
        shouldAdvance = false;
      }
    });

    if (shouldAdvance) {
      await this.helper.advanceToNextNode(task.applicationId, 0, task.stepId);
    }
    
    // Trigger indexing
    await this.queueService.enqueue('application-indexing', { applicationId: task.applicationId });

    return this.prisma.application.findUnique({
      where: { id: task.applicationId },
      include: {
        applicationDefinition: true,
        workflowTasks: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  /**
   * Retry Multiple Tasks
   */
  async retryServiceTasks(taskIds: string[]) {
    const results = { succeeded: [] as string[], failed: [] as string[] };
    for (const id of taskIds) {
      try {
        await this.retryServiceTask(id);
        results.succeeded.push(id);
      } catch (e) {
        this.logger.error(`Failed to retry task ${id}`, e);
        results.failed.push(id);
      }
    }
    return results;
  }

  async retryServiceTask(taskId: string): Promise<void> {
    const task = await this.prisma.workflowTask.findUnique({
      where: { id: taskId },
      include: { application: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.status !== 'FAILED') {
      throw new BadRequestException('Only FAILED tasks can be retried');
    }

    // Reuse existing task: Reset to QUEUED and increment retries
    await this.prisma.workflowTask.update({
      where: { id: taskId },
      data: {
        status: 'QUEUED',
        retries: { increment: 1 },
        error: null, // Clear previous error
        updatedAt: new Date(),
      },
    });

    const job: any = {
      taskId: task.id,
      applicationId: task.applicationId,
      nodeId: task.stepId,
      nodeType: task.type,
      nodeData: (task.config as any) || {},
      inputData: (task.application?.inputData as any) || {},
      applicantId: task.application?.applicantId || '',
    };

    // Enqueue directly to GenericWorker (TASK_EXECUTE) instead of NodeProcessor
    await this.queueService.enqueue('TASK_EXECUTE', job, {
      deduplicationId: task.id,
    });
    this.logger.log(
      `Retrying task ${taskId} (type: ${task.type}) - Re-queued directly`,
    );
  }

  async resubmitApplication(applicationId: string, inputData: any) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { flowDefinition: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'REMANDED') {
      throw new BadRequestException('Application is not in REMANDED status');
    }

    const nodes = (application.flowNodes ||
      application.flowDefinition.nodes ||
      []) as any[];
    const startNode = nodes.find((n: any) => n.type === 'start');

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: 'IN_PROGRESS',
          inputData: inputData,
          currentNodeId: startNode?.id || application.currentNodeId,
        },
      });

      await tx.approvalHistory.create({
        data: {
          applicationId: application.id,
          actorId: application.applicantId,
          actorInfo: application.applicantInfo as any,
          action: 'RESUBMIT',
          stepId: startNode?.id || '',
          comment: '差し戻し申請を再送信しました',
        },
      });
    });

    await this.helper.advanceToNextNode(applicationId, 0, startNode?.id);

    // Trigger indexing
    await this.queueService.enqueue('application-indexing', { applicationId });

    return this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        applicationDefinition: true,
        workflowTasks: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async canUserExecuteTask(task: any, userId: string): Promise<boolean> {
    const assignedTo = task.assignedTo;
    if (!assignedTo) return true;

    if (assignedTo === 'applicant') {
      const app = await this.prisma.application.findUnique({
        where: { id: task.applicationId },
      });
      return app?.applicantId === userId;
    }

    if (assignedTo.startsWith('user:')) {
      const targetUser = assignedTo.substring(5);
      return targetUser === userId;
    }

    if (assignedTo.startsWith('group:')) {
      const targetGroup = assignedTo.substring(6);

      // 1. Check Keycloak Groups (Department)
      const userGroups =
        await this.usersService.getUserGroupsWithDeptCode(userId);
      const deptMatch = userGroups.some(
        (g) =>
          g.deptCode === targetGroup ||
          g.path === targetGroup ||
          g.path === `/${targetGroup}` ||
          g.path.endsWith(`/${targetGroup}`),
      );
      if (deptMatch) return true;

      // 2. Check Custom Teams
      try {
        const myTeams = await this.teamsService.getMyTeams(userId);
        const teamMatch = myTeams.some((t) => t.id === targetGroup);
        if (teamMatch) return true;
      } catch (e) {
        this.logger.warn(
          `Failed to check team permission for user ${userId}`,
          e,
        );
      }

      return false;
    }

    return true;
  }

  async getWorkflowStatus(applicationId: string) {
    return this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        workflowTasks: true,
        history: true,
      },
    });
  }
}
