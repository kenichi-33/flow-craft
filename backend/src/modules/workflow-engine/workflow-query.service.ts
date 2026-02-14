import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TeamsService } from '../teams/teams.service';

@Injectable()
export class WorkflowQueryService {
  private readonly logger = new Logger(WorkflowQueryService.name);

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private teamsService: TeamsService,
  ) {}

  async getWorkflowStatus(applicationId: string) {
    return this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        workflowTasks: true,
        history: true,
      },
    });
  }

  async canUserExecuteTask(task: any, userId: string): Promise<boolean> {
    // God Mode for Test Execution
    let application = task.application;
    if (!application && task.applicationId) {
      application = await this.prisma.application.findUnique({
        where: { id: task.applicationId },
      });
    }

    if (application?.isTestMode && application.applicantId === userId) {
      return true;
    }

    const assignedTo = task.assignedTo;
    if (!assignedTo) return true;

    if (assignedTo === 'applicant') {
      if (!application && task.applicationId) {
        application = await this.prisma.application.findUnique({
          where: { id: task.applicationId },
        });
      }
      return application?.applicantId === userId;
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
