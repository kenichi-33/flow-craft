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

import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

@Injectable()
export class ApplicationsService {
    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private usersService: UsersService,
        private queueService: QueueService,
        private workflowEngineService: WorkflowEngineService,
    ) {}

    // ... (create method remains same)

    // ... (findAll method remains same or can be updated later if needed)

    async findOne(id: string, requestUserId?: string) {
        const application = await this.prisma.application.findUnique({
            where: { id },
            include: {
                formDefinition: true,
                flowDefinition: true,
                applicationDefinition: true,
                history: {
                    orderBy: { actedAt: 'asc' },
                },
                workflowTasks: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        history: {
                            orderBy: { executedAt: 'desc' },
                        },
                    },
                },
            },
        });
        if (!application) throw new NotFoundException(`Application with ID ${id} not found`);

        const enrichedTasks = await Promise.all(application.workflowTasks.map(async (task) => {
            let isExecutable = false;
            if (requestUserId && task.status === 'PENDING') {
                try {
                    isExecutable = await this.workflowEngineService.canUserExecuteTask(task as any, requestUserId);
                } catch (e) {
                    // Ignore errors, default to false
                }
            }
            return { ...task, isExecutable };
        }));
        
        return { ...application, workflowTasks: enrichedTasks };
    }

    async create(createApplicationDto: CreateApplicationDto) {
        const applicantInfo = await this.usersService.getUserSnapshotByUsername(createApplicationDto.applicantId);
        
        // Resolve Definitions (Draft vs Published)
        let formDefId = createApplicationDto.formDefinitionId;
        let flowDefId = createApplicationDto.flowDefinitionId;
        let formSchema: any = undefined;
        let flowNodes: any = undefined;
        let flowEdges: any = undefined;

        if (createApplicationDto.applicationDefinitionId) {
            const appDef = await this.prisma.applicationDefinition.findUnique({
                where: { id: createApplicationDto.applicationDefinitionId }
            });

            if (appDef) {
                 // Try to get published version
                 const latestVersion = await this.prisma.appVersion.findFirst({
                    where: { applicationDefinitionId: appDef.id },
                    orderBy: { version: 'desc' },
                });

                if (latestVersion) {
                    formSchema = latestVersion.formSchema;
                    flowNodes = latestVersion.flowNodes;
                    flowEdges = latestVersion.flowEdges;
                    // Note: We still need IDs for FKs? 
                    // application table has formDefinitionId/flowDefinitionId FKs. 
                    // We must use the IDs from AppDef (even if we override content with snapshot)
                    // Logic: The linked definitions might be drafts, but we store the snapshot content in Application table.
                    // Wait, Application table schema? 
                    // Let's check if Application table has formSchema/flowNodes columns (it was updated recently).
                    // Yes, WorkflowEngineService uses them.
                    formDefId = appDef.formDefinitionId!;
                    flowDefId = appDef.flowDefinitionId!;
                } else if (appDef.status === 'ACTIVE') {
                    // Legacy active without version? Use current draft as fallback
                    formDefId = appDef.formDefinitionId!;
                    flowDefId = appDef.flowDefinitionId!;
                }
            }
        }

        // トランザクション内でアプリケーション作成とファイル紐付けを実行
        const application = await this.prisma.$transaction(async (tx) => {
            const app = await tx.application.create({
                data: {
                    formDefinitionId: formDefId,
                    flowDefinitionId: flowDefId,
                    applicationDefinitionId: createApplicationDto.applicationDefinitionId, // Nullable?
                    applicantId: createApplicationDto.applicantId,
                    applicantInfo: applicantInfo as any, // Json type workaround
                    inputData: (createApplicationDto.inputData || {}) as Prisma.InputJsonValue,
                    status: 'DRAFT',
                    formSchema: formSchema as Prisma.InputJsonValue,
                    flowNodes: flowNodes as Prisma.InputJsonValue,
                    flowEdges: flowEdges as Prisma.InputJsonValue,
                },
                include: {
                    formDefinition: true,
                    flowDefinition: true,
                },
            });

            // Link uploaded files to this application
            try {
                const formDef = await tx.formDefinition.findUnique({
                    where: { id: createApplicationDto.formDefinitionId },
                });

                if (formDef && formDef.schema) {
                    const schema = formDef.schema as any;
                    const fileIds: string[] = [];
                    const inputData = createApplicationDto.inputData || {};

                    // Find file fields in schema
                    if (schema.properties) {
                        for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
                            if (prop.type === 'file' || prop['x-type'] === 'file') {
                                const value = inputData[key];
                                if (Array.isArray(value)) {
                                    fileIds.push(...value.filter(v => typeof v === 'string'));
                                } else if (typeof value === 'string' && value) {
                                    fileIds.push(value);
                                }
                            }
                        }
                    }

                    if (fileIds.length > 0) {
                        await tx.file.updateMany({
                            where: { id: { in: fileIds } },
                            data: { applicationId: app.id },
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to link files to application:', error);
                // Transaction should probably imply consistency, but original code continued.
                // If we want atomicity, we should throw here?
                // Original comment said "Non-critical, continue".
                // But in a transaction, if we catch and don't rethrow, the transaction commits.
                // So this behavior preserves "Non-critical".
            }

            return app;
        });
 
        // Trigger async indexing (outside transaction)
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
            const statusList = status.split(',');
            where.status = { in: statusList as any[] };
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

        // テキスト検索条件を追加（件名、申請ID文字列、アプリ名）
        // ※申請内容(inputData)は検索対象外とする
        if (search) {
            where.OR = [
                { applicantId: { contains: search, mode: 'insensitive' } },
                { applicationDefinition: { name: { contains: search, mode: 'insensitive' } } },
                { title: { contains: search, mode: 'insensitive' } },
            ];
            
            // 数値であればID検索も試みる
            const searchNum = parseInt(search, 10);
            if (!isNaN(searchNum)) {
                where.OR.push({ applicationNumber: searchNum });
            }
        }

        // ソート条件
        const orderBy: Prisma.ApplicationOrderByWithRelationInput = {};
        if (sortBy === 'applicationDefinition') {
            orderBy.applicationDefinition = { name: sortOrder };
        } else if (sortBy === 'applicationNumber' || sortBy === 'status' || sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'applicantId' || sortBy === 'title') {
            orderBy[sortBy] = sortOrder;
        } else {
            orderBy.createdAt = sortOrder;
        }

        // ページネーションなしの場合は単純な配列を返す（後方互換性）
        if (!page && !limit) {
            return this.prisma.application.findMany({
                where,
                orderBy,
                select: {
                    id: true,
                    applicationNumber: true,
                    title: true,
                    status: true,
                    applicantId: true,
                    applicantInfo: true,
                    currentNodeId: true, // Needed for list view
                    flowNodes: true, // Needed for list view snapshot
                    createdAt: true,
                    updatedAt: true,
                    applicationDefinition: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            status: true,
                        }
                    },
                    formDefinition: { select: { id: true, name: true } },
                    flowDefinition: { select: { id: true, name: true, nodes: true } }, // Fallback for list view
                }
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
                select: {
                    id: true,
                    applicationNumber: true,
                    title: true,
                    status: true,
                    applicantId: true,
                    applicantInfo: true,
                    currentNodeId: true,
                    flowNodes: true,
                    createdAt: true,
                    updatedAt: true,
                    applicationDefinition: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            status: true,
                        }
                    },
                    formDefinition: { select: { id: true, name: true } },
                    flowDefinition: { select: { id: true, name: true, nodes: true } },
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
