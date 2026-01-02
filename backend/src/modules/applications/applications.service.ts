import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { Prisma } from '@prisma/client';

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
export class ApplicationsService {
    constructor(private prisma: PrismaService) { }

    create(createApplicationDto: CreateApplicationDto) {
        return this.prisma.application.create({
            data: {
                formDefinitionId: createApplicationDto.formDefinitionId,
                flowDefinitionId: createApplicationDto.flowDefinitionId,
                applicantId: createApplicationDto.applicantId,
                inputData: (createApplicationDto.inputData || {}) as Prisma.InputJsonValue,
                status: 'DRAFT',
            },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });
    }

    async findAll(options: FindAllOptions = {}) {
        const { page, limit, search, sortBy = 'createdAt', sortOrder = 'desc', status, applicationNumber, dateFrom, dateTo } = options;

        // 基本検索条件
        const where: Prisma.ApplicationWhereInput = {};

        // ステータスフィルタ
        if (status) {
            where.status = status as any;
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

    async update(id: string, updateData: { inputData: any }) {
        const application = await this.prisma.application.findUnique({
            where: { id },
        });

        if (!application) {
            throw new NotFoundException(`Application with ID ${id} not found`);
        }

        return this.prisma.application.update({
            where: { id },
            data: {
                inputData: updateData.inputData as Prisma.InputJsonValue,
            },
            include: {
                applicationDefinition: true,
            },
        });
    }
}
