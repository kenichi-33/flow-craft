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

    // Validate Input
    try {
      this.helper.validateTaskInput(
        { application: { inputData: {} } },
        input.inputData,
        formSchema,
        startNode.id,
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }

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
    await this.queueService.enqueue('application-indexing', {
      applicationId: application.id,
    });

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

    // Validate Input
    try {
      this.helper.validateTaskInput(
        { application: application },
        inputData,
        application.formSchema,
        startNode.id,
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: applicationId, status: 'DRAFT' },
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
    remandTargetStepId?: string; // 任意ステップへの差し戻し用
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

    // Validate Input
    try {
      this.helper.validateTaskInput(
        task,
        input.inputData,
        task.application.formSchema,
        task.stepId,
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }

    const actorInfo = await this.usersService.getUserSnapshotByUsername(
      input.actorId,
    );
    let shouldAdvance = false;

    await this.prisma.$transaction(async (tx) => {
      // Update Task Status - REMAND uses INVALIDATED, others use COMPLETED
      const taskStatus =
        input.action === 'REMAND' ? 'INVALIDATED' : 'COMPLETED';
      await tx.workflowTask.update({
        where: { id: input.taskId, status: 'PENDING' },
        data: {
          status: taskStatus,
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
        // REJECTの場合は次は進まない (shouldAdvance = false)
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

        const remandTargetStepId = input.remandTargetStepId;
        let targetNode;

        if (remandTargetStepId) {
          // 任意ステップへの差し戻し
          targetNode = nodes.find((n: any) => n.id === remandTargetStepId);
          if (!targetNode) {
            throw new BadRequestException('差し戻し先のノードが見つかりません');
          }
        } else {
          // デフォルト: 開始ノード（申請者へ）
          targetNode = nodes.find((n: any) => n.type === 'start');
        }

        // Cancel other pending tasks
        await tx.workflowTask.updateMany({
          where: {
            applicationId: task.applicationId,
            status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
            id: { not: task.id },
          },
          data: { status: 'CANCELED' },
        });

        // 差し戻し先以降のCOMPLETEDタスクをINVALIDATED
        if (remandTargetStepId) {
          const targetTask = await tx.workflowTask.findFirst({
            where: {
              applicationId: task.applicationId,
              stepId: remandTargetStepId,
            },
            orderBy: { createdAt: 'asc' },
          });
          const cutoffTime = targetTask?.createdAt || new Date(0);

          const updateResult = await tx.workflowTask.updateMany({
            where: {
              applicationId: task.applicationId,
              status: 'COMPLETED',
              createdAt: { gte: cutoffTime },
            },
            data: { status: 'INVALIDATED' },
          });
          this.logger.log(
            `REMAND: Updated ${updateResult.count} tasks to INVALIDATED (target step: ${remandTargetStepId})`,
          );
        } else {
          // 申請者への差し戻し: 全COMPLETEDタスクをINVALIDATED
          const updateResult = await tx.workflowTask.updateMany({
            where: {
              applicationId: task.applicationId,
              status: 'COMPLETED',
            },
            data: { status: 'INVALIDATED' },
          });
          this.logger.log(
            `REMAND to applicant: Updated ${updateResult.count} tasks to INVALIDATED`,
          );
        }

        // 申請ステータス更新
        if (remandTargetStepId && targetNode?.type !== 'start') {
          // 任意ステップへの差し戻し: IN_PROGRESSのまま
          await tx.application.update({
            where: { id: task.applicationId },
            data: { currentNodeId: targetNode?.id || null },
          });

          // 差し戻し先に新しいタスクを作成
          const originalTask = await tx.workflowTask.findFirst({
            where: {
              applicationId: task.applicationId,
              stepId: remandTargetStepId,
              status: 'INVALIDATED',
            },
            orderBy: { createdAt: 'desc' },
          });
          if (originalTask) {
            await tx.workflowTask.create({
              data: {
                applicationId: task.applicationId,
                stepId: remandTargetStepId,
                type: originalTask.type,
                status: 'PENDING',
                assignedTo: originalTask.assignedTo,
                assignedToDisplay: originalTask.assignedToDisplay,
                assignedToInfo: originalTask.assignedToInfo as any,
                config: originalTask.config as any,
              },
            });
          }
        } else {
          // 申請者への差し戻し: REMANDEDステータス
          await tx.application.update({
            where: { id: task.applicationId },
            data: {
              status: 'REMANDED',
              currentNodeId: targetNode?.id || null,
            },
          });
        }
        shouldAdvance = false;
      }
    });

    if (shouldAdvance) {
      await this.helper.advanceToNextNode(task.applicationId, task.stepId);
    }

    // Trigger indexing
    await this.queueService.enqueue('application-indexing', {
      applicationId: task.applicationId,
    });

    return this.prisma.application.findUnique({
      where: { id: task.applicationId },
      include: {
        applicationDefinition: true,
        workflowTasks: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  /**
   * Cancel an application
   */
  async cancelApplication(applicationId: string, actorId: string) {
    const actorInfo =
      await this.usersService.getUserSnapshotByUsername(actorId);

    return this.prisma.$transaction(async (tx) => {
      // 0. Get current node for history context (Optional)
      const app = await tx.application.findUnique({
        where: { id: applicationId },
      });

      // 1. Update Application Status to CANCELED
      // Reset currentNodeId to null as flow is stopped
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: 'CANCELED',
          currentNodeId: null,
        },
      });

      // 2. Update Pending/Running Tasks to CANCELED
      await tx.workflowTask.updateMany({
        where: {
          applicationId: applicationId,
          status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
        },
        data: {
          status: 'CANCELED',
        },
      });

      // 3. Record History
      await tx.approvalHistory.create({
        data: {
          applicationId,
          actorId,
          actorInfo: actorInfo as any,
          action: 'CANCEL',
          comment: '申請者による取下げ',
          stepId: app?.currentNodeId || 'withdrawal',
        },
      });

      this.logger.log(
        `Application ${applicationId} has been canceled by ${actorId}.`,
      );
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
      where: { id: taskId, status: 'FAILED' },
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
        where: { id: applicationId, status: 'REMANDED' },
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

    await this.helper.advanceToNextNode(applicationId, startNode?.id);

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

  /**
   * 差し戻し可能なステップ一覧を取得
   */
  async getRemandableSteps(applicationId: string, currentTaskId?: string) {
    // Get current application with flow definition
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { flowDefinition: true },
    });

    const nodes = (application?.flowNodes ||
      application?.flowDefinition?.nodes ||
      []) as any[];
    const edges = (application?.flowEdges ||
      application?.flowDefinition?.edges ||
      []) as any[];

    // Get current task to find current step
    let currentStepId: string | null = null;
    if (currentTaskId) {
      const currentTask = await this.prisma.workflowTask.findUnique({
        where: { id: currentTaskId },
        select: { stepId: true },
      });
      currentStepId = currentTask?.stepId || null;
    }

    if (!currentStepId) {
      // No current task, return empty
      return [];
    }

    // Find all upstream nodes using BFS traversal backwards
    const upstreamNodeIds = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [currentStepId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      // Find all edges pointing TO this node (upstream edges)
      const incomingEdges = edges.filter((e: any) => e.target === nodeId);
      for (const edge of incomingEdges) {
        const sourceId = edge.source;
        if (!visited.has(sourceId)) {
          upstreamNodeIds.add(sourceId);
          queue.push(sourceId);
        }
      }
    }

    // Get completed/invalidated tasks for upstream nodes only
    const completedTasks = await this.prisma.workflowTask.findMany({
      where: {
        applicationId,
        status: { in: ['COMPLETED', 'INVALIDATED'] },
        type: { in: ['approval', 'userInput', 'input'] },
        stepId: { in: Array.from(upstreamNodeIds) },
      },
      orderBy: { createdAt: 'asc' },
      distinct: ['stepId'],
    });

    return completedTasks.map((task) => {
      const node = nodes.find((n: any) => n.id === task.stepId);
      return {
        stepId: task.stepId,
        label: node?.data?.label || task.stepId,
        type: task.type,
        completedAt: task.updatedAt,
      };
    });
  }
}
