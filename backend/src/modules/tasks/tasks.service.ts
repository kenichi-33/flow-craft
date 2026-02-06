import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, TaskStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { TeamsService } from '../teams/teams.service';

export interface FindAllOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
  applicationNumber?: number;
  dateFrom?: string;
  dateTo?: string;
  // ユーザーフィルタリング用
  userId?: string;
  userRoles?: string[];
  userGroups?: string[];
  userGroupCodes?: string[];
}

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private teamsService: TeamsService,
  ) {}

  /**
   * ユーザーがタスクを実行可能かチェック（クライアントサイドフィルタ用）
   */
  private canUserAccessTask(
    task: any,
    userId: string,
    userRoles: string[],
    userGroups: string[],
    userGroupCodes: string[],
  ): boolean {
    const assignedTo = task.assignedTo;

    if (!assignedTo) {
      // assignedToが未設定の場合は誰でもアクセス可能
      return true;
    }

    const assignments = assignedTo.split(',').map((s: string) => s.trim());

    for (const assignment of assignments) {
      // 特定ユーザー指定
      if (assignment.startsWith('user:')) {
        const targetUser = assignment.substring(5);
        if (targetUser === userId) return true;
      }
      // ロール指定
      else if (assignment.startsWith('role:')) {
        const targetRole = assignment.substring(5);
        if (userRoles?.includes(targetRole)) return true;
      }
      // グループ指定
      else if (assignment.startsWith('group:')) {
        const targetGroup = assignment.substring(6);
        // 1. Check Keycloak Groups (deptCode, Path)
        // ID match
        if (userGroupCodes?.includes(targetGroup)) return true;
        // Path match
        if (
          userGroups?.some(
            (g) => g === targetGroup || g.startsWith(targetGroup + '/'),
          )
        )
          return true;

        // 2. Check Custom Teams (ID match)
        // userGroupCodes might contain team IDs if we put them there (controller responsibility)
        // But for explicit clarity, we might check passed team IDs if we add them to args.
        // Assuming userGroupCodes includes Team IDs for now (Controller update needed to merge).
        if (userGroupCodes?.includes(targetGroup)) return true;
      }
      // 申請者指定
      else if (assignment === 'applicant') {
        if (task.application?.applicantId === userId) return true;
      }
      // 申請者の上長指定（現在は常にtrue）
      else if (assignment === 'applicant_manager') {
        return true; // TODO: 実際のマネージャーチェック
      }
      // 直接ユーザー名指定（レガシー形式）
      else if (assignment === userId) {
        return true;
      }
    }

    return false;
  }

  async findAll(options: FindAllOptions = {}) {
    const {
      page,
      limit,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      applicationNumber,
      dateFrom,
      dateTo,
      userId,
      userRoles = [],
      userGroups = [],
    } = options;
    let { userGroupCodes = [] } = options;

    // 基本検索条件（承認タスクと入力タスク）
    const where: Prisma.WorkflowTaskWhereInput = {
      type: { in: ['approval', 'input'] },
    };

    // ステータスフィルタ
    if (status) {
      where.status = status as TaskStatus;
    }

    // 申請IDフィルタ
    if (applicationNumber) {
      where.application = { ...(where.application as any), applicationNumber };
    }

    // 日付範囲フィルタ
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as any).gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        (where.createdAt as any).lte = endDate;
      }
    }

    // テキスト検索条件を追加
    if (search) {
      where.OR = [
        {
          application: {
            applicantId: { contains: search, mode: 'insensitive' },
          },
        },
        {
          application: {
            applicationDefinition: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        },
        { application: { title: { contains: search, mode: 'insensitive' } } },
        // 担当者名検索 (Display名含む)
        { assignedTo: { contains: search, mode: 'insensitive' } },
        { assignedToDisplay: { contains: search, mode: 'insensitive' } },
      ];
    }

    // ソート条件
    const orderBy: Prisma.WorkflowTaskOrderByWithRelationInput = {};
    if (
      sortBy === 'status' ||
      sortBy === 'createdAt' ||
      sortBy === 'stepId' ||
      sortBy === 'dueDate'
    ) {
      orderBy[sortBy] = sortOrder;
    } else if (sortBy === 'applicationName') {
      orderBy.application = { applicationDefinition: { name: sortOrder } };
    } else if (sortBy === 'title') {
      orderBy.application = { title: sortOrder };
    } else {
      orderBy.createdAt = sortOrder;
    }

    // ページネーションなしの場合
    if (!page && !limit) {
      const tasks = await this.prisma.workflowTask.findMany({
        where,
        orderBy,
        select: {
          id: true,
          stepId: true,
          type: true,
          status: true,
          assignedTo: true,
          assignedToDisplay: true,
          assignedToInfo: true,
          dueDate: true,
          workerId: true,
          retries: true,
          error: true,
          createdAt: true,
          updatedAt: true,
          claimedBy: true,
          claimedAt: true,
          application: {
            select: {
              id: true,
              applicationNumber: true,
              title: true,
              status: true,
              applicantId: true,
              applicantInfo: true,
              currentNodeId: true,
              flowNodes: true,
              applicationDefinition: { select: { id: true, name: true } },
              formDefinition: { select: { id: true, name: true } },
              flowDefinition: { select: { id: true, name: true, nodes: true } },
            },
          },
        },
      });

      // ユーザーフィルタリングが指定されている場合
      if (userId) {
        // My Teamsを取得してgroupCodesに追加
        try {
          const myTeams = await this.teamsService.getMyTeams(userId);
          const teamIds = myTeams.map((t) => t.id);
          userGroupCodes = [...(userGroupCodes || []), ...teamIds];
        } catch (e) {
          console.warn(`[Tasks] Failed to fetch teams for user ${userId}`, e);
        }
        return tasks.filter((task) =>
          this.canUserAccessTask(
            task,
            userId,
            userRoles,
            userGroups,
            userGroupCodes,
          ),
        );
      }
      return tasks;
    }

    // ページネーションありの場合
    const pageNum = page || 1;
    const limitNum = limit || 50;
    const skip = (pageNum - 1) * limitNum;

    // まず全件取得してフィルタリング（ユーザーフィルタがある場合）
    if (userId) {
      // My Teamsを取得してgroupCodesに追加
      try {
        const myTeams = await this.teamsService.getMyTeams(userId);
        const teamIds = myTeams.map((t) => t.id);
        userGroupCodes = [...(userGroupCodes || []), ...teamIds];
        console.log(`[Tasks] User ${userId} belongs to teams:`, teamIds);
      } catch (e) {
        console.warn(`[Tasks] Failed to fetch teams for user ${userId}`, e);
      }

      const allTasks = await this.prisma.workflowTask.findMany({
        where,
        orderBy,
        select: {
          id: true,
          stepId: true,
          type: true,
          status: true,
          assignedTo: true,
          assignedToDisplay: true,
          assignedToInfo: true,
          dueDate: true,
          workerId: true,
          retries: true,
          error: true,
          createdAt: true,
          updatedAt: true,
          claimedBy: true,
          claimedAt: true,
          application: {
            select: {
              id: true,
              applicationNumber: true,
              title: true,
              status: true,
              applicantId: true,
              applicantInfo: true,
              currentNodeId: true,
              flowNodes: true,
              applicationDefinition: { select: { id: true, name: true } },
              formDefinition: { select: { id: true, name: true } },
              flowDefinition: { select: { id: true, name: true, nodes: true } },
            },
          },
        },
      });

      const filteredTasks = allTasks.filter((task) =>
        this.canUserAccessTask(
          task,
          userId,
          userRoles,
          userGroups,
          userGroupCodes,
        ),
      );

      const total = filteredTasks.length;
      const slicedData = filteredTasks.slice(skip, skip + limitNum);

      // Enrich with assignedToInfo
      const data = await Promise.all(
        slicedData.map(async (task) => {
          const assignedToInfo =
            await this.usersService.resolveAssignedToSnapshot(
              task.assignedTo || '',
            );
          const claimedByInfo = task.claimedBy
            ? await this.usersService.getUserSnapshotByUsername(task.claimedBy)
            : undefined;
          return { ...task, assignedToInfo, claimedByInfo };
        }),
      );

      return {
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    }

    // 通常のページネーション
    const [data, total] = await Promise.all([
      this.prisma.workflowTask.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        select: {
          id: true,
          stepId: true,
          type: true,
          status: true,
          assignedTo: true,
          assignedToDisplay: true,
          assignedToInfo: true,
          dueDate: true,
          workerId: true,
          retries: true,
          error: true,
          createdAt: true,
          updatedAt: true,
          claimedBy: true,
          claimedAt: true,
          application: {
            select: {
              id: true,
              applicationNumber: true,
              title: true,
              status: true,
              applicantId: true,
              applicantInfo: true,
              currentNodeId: true,
              flowNodes: true,
              applicationDefinition: { select: { id: true, name: true } },
              formDefinition: { select: { id: true, name: true } },
              flowDefinition: { select: { id: true, name: true, nodes: true } },
              isTestMode: true,
            },
          },
        },
      }),
      this.prisma.workflowTask.count({ where }),
    ]);

    // Enrich with assignedToInfo
    const enrichedData = await Promise.all(
      data.map(async (task) => {
        const assignedToInfo =
          await this.usersService.resolveAssignedToSnapshot(
            task.assignedTo || '',
          );
        const claimedByInfo = task.claimedBy
          ? await this.usersService.getUserSnapshotByUsername(task.claimedBy)
          : undefined;
        return { ...task, assignedToInfo, claimedByInfo };
      }),
    );

    return {
      data: enrichedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async findOne(id: string) {
    const task = await this.prisma.workflowTask.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            applicationDefinition: true,
            formDefinition: true,
            flowDefinition: true,
            workflowTasks: {
              where: { type: 'approval' },
            }, // 並行タスクの状況を知るためにタスク一覧を追加
            history: {
              orderBy: { actedAt: 'asc' },
            }, // 承認履歴を含める（フローの完了状態判定に必要）
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    const claimedByInfo = task.claimedBy
      ? await this.usersService.getUserSnapshotByUsername(task.claimedBy)
      : undefined;

    return { ...task, claimedByInfo };
  }

  async findPending(assignedTo?: string) {
    return this.prisma.workflowTask.findMany({
      where: {
        type: { in: ['approval', 'input'] },
        status: 'PENDING',
        ...(assignedTo ? { assignedTo } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        application: {
          include: {
            applicationDefinition: true,
          },
        },
      },
    });
  }

  /**
   * Get Failed Service Tasks (for Admin)
   */
  async getFailedServiceTasks(page = 1, limit = 20, search?: string) {
    const where: Prisma.WorkflowTaskWhereInput = {
      status: 'FAILED',
      type: { notIn: ['approval', 'input', 'userInput'] },
    };

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { stepId: { contains: search, mode: 'insensitive' } },
        { error: { contains: search, mode: 'insensitive' } },
        {
          application: {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              {
                applicationDefinition: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.workflowTask.findMany({
        where,
        include: {
          application: {
            include: {
              applicationDefinition: true,
              flowDefinition: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.workflowTask.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async claimTask(taskId: string, user: any) {
    const task = await this.prisma.workflowTask.findUnique({
      where: { id: taskId },
      include: { application: true },
    });

    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== 'PENDING')
      throw new BadRequestException('Task is not pending');

    // Access Check
    const canAccess = this.canUserAccessTask(
      task,
      user.username,
      user.roles,
      user.groups,
      user.groupCodes,
    );
    if (!canAccess)
      throw new ForbiddenException('User is not assigned to this task');

    if (task.claimedBy && task.claimedBy !== user.username) {
      throw new ConflictException(
        `Task is already claimed by ${task.claimedBy}`,
      );
    }

    if (task.claimedBy === user.username) return task;

    return this.prisma.workflowTask.update({
      where: { id: taskId },
      data: {
        claimedBy: user.username,
        claimedAt: new Date(),
      },
    });
  }

  async releaseTask(taskId: string, user: any) {
    const task = await this.prisma.workflowTask.findUnique({
      where: { id: taskId },
    });

    if (!task) throw new NotFoundException('Task not found');

    const isAdmin =
      user.roles?.includes('admin') || user.roles?.includes('wf_admin');

    if (task.claimedBy !== user.username && !isAdmin) {
      throw new ForbiddenException('You can only release your own tasks');
    }

    return this.prisma.workflowTask.update({
      where: { id: taskId },
      data: {
        claimedBy: null,
        claimedAt: null,
      },
    });
  }
}
