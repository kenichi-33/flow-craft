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
}

@Injectable()
export class TasksService {
    constructor(private prisma: PrismaService) { }

    async findAll(options: FindAllOptions = {}) {
        const { page, limit, search, sortBy = 'createdAt', sortOrder = 'desc', status, applicationNumber, dateFrom, dateTo } = options;

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
            ];
        }

        // ソート条件
        const orderBy: Prisma.ApprovalTaskOrderByWithRelationInput = {};
        if (sortBy === 'status' || sortBy === 'createdAt' || sortBy === 'stepId') {
            orderBy[sortBy] = sortOrder;
        } else {
            orderBy.createdAt = sortOrder;
        }

        // ページネーションなしの場合は単純な配列を返す（後方互換性）
        if (!page && !limit) {
            return this.prisma.approvalTask.findMany({
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
        }

        // ページネーションありの場合
        const pageNum = page || 1;
        const limitNum = limit || 50;
        const skip = (pageNum - 1) * limitNum;

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
