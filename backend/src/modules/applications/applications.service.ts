import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { QueueService } from '../queue/queue.service';

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
    applicantId?: string;
    requestUserId?: string; // アクセス制御用
}

@Injectable()
export class ApplicationsService {
    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private usersService: UsersService,
        private queueService: QueueService,
    ) {}

    async create(createApplicationDto: CreateApplicationDto) {
        const applicantInfo = await this.usersService.getUserSnapshotByUsername(createApplicationDto.applicantId);

        const application = await this.prisma.application.create({
            data: {
                formDefinitionId: createApplicationDto.formDefinitionId,
                flowDefinitionId: createApplicationDto.flowDefinitionId,
                applicantId: createApplicationDto.applicantId,
                applicantInfo: applicantInfo as any, // Json type workaround
                inputData: (createApplicationDto.inputData || {}) as Prisma.InputJsonValue,
                status: 'DRAFT',
            },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });

        // Trigger async indexing
        await this.queueService.enqueue('application-indexing', { applicationId: application.id });

        return application;
    }

    async findAll(params: FindAllOptions = {}) {
        const { page, limit, search, sortBy = 'createdAt', sortOrder = 'desc', status, applicationNumber, dateFrom, dateTo, applicantId, requestUserId } = params;

        // 基本検索条件
        const where: Prisma.ApplicationWhereInput = {};

        // 申請者フィルタ（自分の申請のみ）
        if (applicantId) {
            where.applicantId = applicantId;
        }

        // アクセス制御: 
        // 1. 自分の申請は全て見える
        // 2. 他人の申請は DRAFT, REMANDED (一時保存、差し戻し) は見えない
        if (requestUserId) {
            // 明示的に自分の申請のみを表示する場合は上の criteria でカバーされるが、
            // 全体表示の際にフィルタリングが必要
            if (!applicantId) {
                where.OR = [
                    { applicantId: requestUserId }, // 自分の申請
                    { 
                        status: { 
                            notIn: ['DRAFT', 'REMANDED'] 
                        } 
                    } // 他人の申請等は公開ステータスのみ
                ];
            }
        }

        // ステータスフィルタ
        if (status) {
            if (status.includes(',')) {
                where.status = { in: status.split(',') as any[] };
            } else {
                where.status = status as any;
            }
        }

        // 申請IDフィルタ
        if (applicationNumber) {
            where.applicationNumber = applicationNumber;
        }

        // 日付範囲フィルタ
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                (where.createdAt as any).gte = new Date(dateFrom);
            }
            if (dateTo) {
                // dateToはその日の終わりまで含む
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                (where.createdAt as any).lte = endDate;
            }
        }

        // テキスト検索条件を追加
        if (search) {
            where.OR = [
                { applicantId: { contains: search, mode: 'insensitive' } },
                { applicationDefinition: { name: { contains: search, mode: 'insensitive' } } },
                { title: { contains: search, mode: 'insensitive' } },
            ];
        }

        // ソート条件
        const orderBy: Prisma.ApplicationOrderByWithRelationInput = {};
        if (sortBy === 'applicationNumber' || sortBy === 'status' || sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'applicantId') {
            orderBy[sortBy] = sortOrder;
        } else {
            orderBy.createdAt = sortOrder;
        }

        // ページネーションなしの場合は単純な配列を返す（後方互換性）
        if (!page && !limit) {
            return this.prisma.application.findMany({
                where,
                orderBy,
                include: {
                    formDefinition: true,
                    flowDefinition: true,
                    applicationDefinition: true,
                },
            });
        }

        // ページネーションありの場合
        const pageNum = page || 1;
        const limitNum = limit || 50;
        const skip = (pageNum - 1) * limitNum;

        const [data, total] = await Promise.all([
            this.prisma.application.findMany({
                where,
                orderBy,
                skip,
                take: limitNum,
                include: {
                    formDefinition: true,
                    flowDefinition: true,
                    applicationDefinition: true,
                },
            }),
            this.prisma.application.count({ where }),
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
        const application = await this.prisma.application.findUnique({
            where: { id },
            include: {
                formDefinition: true,
                flowDefinition: true,
                applicationDefinition: true,
                tasks: true,
                history: {
                    orderBy: { actedAt: 'asc' },
                },
                serviceTasks: {
                    include: {
                        history: {
                            orderBy: { executedAt: 'asc' },
                        },
                    },
                },
            },
        });
        if (!application) throw new NotFoundException(`Application with ID ${id} not found`);
        
        return application;
    }

    async update(id: string, updateData: { title?: string; inputData?: any; status?: string }) {
        const application = await this.prisma.application.findUnique({
            where: { id },
        });

        if (!application) {
            throw new NotFoundException(`Application with ID ${id} not found`);
        }

        const data: Prisma.ApplicationUpdateInput = {};
        if (updateData.title !== undefined) data.title = updateData.title;
        if (updateData.inputData !== undefined) data.inputData = updateData.inputData as Prisma.InputJsonValue;
        if (updateData.status !== undefined) data.status = updateData.status as any;

        const updatedApplication = await this.prisma.application.update({
            where: { id },
            data,
            include: {
                applicationDefinition: true,
            },
        });

        // Trigger async indexing
        await this.queueService.enqueue('application-indexing', { applicationId: id });

        return updatedApplication;
    }
}
