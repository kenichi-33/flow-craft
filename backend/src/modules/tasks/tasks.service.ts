import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, TaskStatus } from '@prisma/client';
import { UsersService, UserSnapshot } from '../users/users.service';
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
        private teamsService: TeamsService
    ) { }

    /**
     * ユーザーがタスクを実行可能かチェック（クライアントサイドフィルタ用）
     */
    private canUserAccessTask(task: any, userId: string, userRoles: string[], userGroups: string[], userGroupCodes: string[]): boolean {
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
                if (userGroups?.some(g => g === targetGroup || g.startsWith(targetGroup + '/'))) return true;

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
            page, limit, search, sortBy = 'createdAt', sortOrder = 'desc',
            status, applicationNumber, dateFrom, dateTo,
            userId, userRoles = [], userGroups = []
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
            where.application = { ...where.application as any, applicationNumber };
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
                { application: { applicantId: { contains: search, mode: 'insensitive' } } },
                { application: { applicationDefinition: { name: { contains: search, mode: 'insensitive' } } } },
                { application: { title: { contains: search, mode: 'insensitive' } } },
                // 担当者名検索 (Display名含む)
                { assignedTo: { contains: search, mode: 'insensitive' } },
                { assignedToDisplay: { contains: search, mode: 'insensitive' } },
            ];
        }

        // ソート条件
        const orderBy: Prisma.WorkflowTaskOrderByWithRelationInput = {};
        if (sortBy === 'status' || sortBy === 'createdAt' || sortBy === 'stepId' || sortBy === 'dueDate') {
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
                include: {
                    application: {
                        include: {
                            applicationDefinition: true,
                            formDefinition: true,
                            flowDefinition: true,
                        },
                    },
                },
            });

            // ユーザーフィルタリングが指定されている場合
            if (userId) {
                // My Teamsを取得してgroupCodesに追加
                try {
                    const myTeams = await this.teamsService.getMyTeams(userId);
                    const teamIds = myTeams.map(t => t.id);
                    userGroupCodes = [...(userGroupCodes || []), ...teamIds];
                } catch (e) {
                    console.warn(`[Tasks] Failed to fetch teams for user ${userId}`, e);
                }
                return tasks.filter(task => this.canUserAccessTask(task, userId, userRoles, userGroups, userGroupCodes));
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
                const teamIds = myTeams.map(t => t.id);
                userGroupCodes = [...(userGroupCodes || []), ...teamIds];
                console.log(`[Tasks] User ${userId} belongs to teams:`, teamIds);
            } catch (e) {
                console.warn(`[Tasks] Failed to fetch teams for user ${userId}`, e);
            }

            const allTasks = await this.prisma.workflowTask.findMany({
                where,
                orderBy,
                include: {
                    application: {
                        include: {
                            applicationDefinition: true,
                            formDefinition: true,
                            flowDefinition: true,
                        },
                    },
                },
            });

            const filteredTasks = allTasks.filter(task =>
                this.canUserAccessTask(task, userId, userRoles, userGroups, userGroupCodes)
            );

            const total = filteredTasks.length;
            const slicedData = filteredTasks.slice(skip, skip + limitNum);

            // Enrich with assignedToInfo
            const data = await Promise.all(slicedData.map(async task => {
                const assignedToInfo = await this.usersService.resolveAssignedToSnapshot(task.assignedTo || '');
                return { ...task, assignedToInfo };
            }));

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
                include: {
                    application: {
                        include: {
                            applicationDefinition: true,
                            formDefinition: true,
                            flowDefinition: true,
                        },
                    },
                },
            }),
            this.prisma.workflowTask.count({ where }),
        ]);

        // Enrich with assignedToInfo
        const enrichedData = await Promise.all(data.map(async task => {
            const assignedToInfo = await this.usersService.resolveAssignedToSnapshot(task.assignedTo || '');
            return { ...task, assignedToInfo };
        }));

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
                            orderBy: { actedAt: 'asc' }
                        }, // 承認履歴を含める（フローの完了状態判定に必要）
                    },
                },
            },
        });

        if (!task) {
            throw new NotFoundException(`Task with ID ${id} not found`);
        }

        return task;
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
}
