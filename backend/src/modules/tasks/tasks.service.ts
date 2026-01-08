import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, TaskStatus } from '@prisma/client';

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
}

@Injectable()
export class TasksService {
    constructor(private prisma: PrismaService) { }

    /**
     * ユーザーがタスクを実行可能かチェック（クライアントサイドフィルタ用）
     */
    private canUserAccessTask(task: any, userId: string, userRoles: string[], userGroups: string[]): boolean {
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
                // グループパスが完全一致、またはユーザーがサブグループに所属しているかチェック
                if (userGroups?.some(g => g === targetGroup || g.startsWith(targetGroup + '/'))) return true;
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

        // 基本検索条件
        const where: Prisma.ApprovalTaskWhereInput = {};

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
            ];
        }

        // ソート条件
        const orderBy: Prisma.ApprovalTaskOrderByWithRelationInput = {};
        if (sortBy === 'status' || sortBy === 'createdAt' || sortBy === 'stepId') {
            orderBy[sortBy] = sortOrder;
        } else {
            orderBy.createdAt = sortOrder;
        }

        // ページネーションなしの場合
        if (!page && !limit) {
            const tasks = await this.prisma.approvalTask.findMany({
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
                return tasks.filter(task => this.canUserAccessTask(task, userId, userRoles, userGroups));
            }
            return tasks;
        }

        // ページネーションありの場合
        const pageNum = page || 1;
        const limitNum = limit || 50;
        const skip = (pageNum - 1) * limitNum;

        // まず全件取得してフィルタリング（ユーザーフィルタがある場合）
        if (userId) {
            const allTasks = await this.prisma.approvalTask.findMany({
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
                this.canUserAccessTask(task, userId, userRoles, userGroups)
            );

            const total = filteredTasks.length;
            const data = filteredTasks.slice(skip, skip + limitNum);

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
            this.prisma.approvalTask.findMany({
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
            this.prisma.approvalTask.count({ where }),
        ]);

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

    async findOne(id: string) {
        const task = await this.prisma.approvalTask.findUnique({
            where: { id },
            include: {
                application: {
                    include: {
                        applicationDefinition: true,
                        formDefinition: true,
                        flowDefinition: true,
                        tasks: true, // 並行タスクの状況を知るためにタスク一覧を追加
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
        return this.prisma.approvalTask.findMany({
            where: {
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
