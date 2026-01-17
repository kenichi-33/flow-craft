import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateApplicationDefinitionDto } from './dto/create-application-definition.dto';
import { UpdateApplicationDefinitionDto } from './dto/update-application-definition.dto';
import { Prisma, AppDefStatus } from '@prisma/client';

export interface FindAllOptions {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    tags?: string[];
}

import { UsersService } from '../users/users.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { AuthUser } from '../../auth/types/user.interface';

@Injectable()
export class ApplicationDefinitionsService {
    constructor(
        private prisma: PrismaService,
        private usersService: UsersService,
        private schedulerService: SchedulerService,
    ) { }

    async create(createDto: CreateApplicationDefinitionDto, user: AuthUser) {
        const result = await this.prisma.applicationDefinition.create({
            data: {
                ...createDto,
                version: 1,
                status: AppDefStatus.DRAFT,
                createdBy: user.username,
                updatedBy: user.username,
                webhookToken: createDto.webhookToken || uuidv4(),
                adminIds: [user.username], // Auto-assign creator as admin (using username)
            },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });

        if (createDto.scheduleCron) {
            await this.schedulerService.scheduleWorkflow(result.id, createDto.scheduleCron, { applicationDefinitionId: result.id, triggeredBy: 'schedule' });
        }

        return result;
    }



    async findAll(options: FindAllOptions = {}, user?: AuthUser) {
        const { page, limit, search, sortBy = 'createdAt', sortOrder = 'desc' } = options;

        // 検索条件
        const where: Prisma.ApplicationDefinitionWhereInput = {};
        
        // Access Control
        if (user && !user.roles.includes('wf_admin')) {
             where.OR = [
                { createdBy: user.username },
                { adminIds: { has: user.id } },
                // Legacy support for username in adminIds
                { adminIds: { has: user.username } } 
            ];
        } else if (!user) {
             // Internal or System use without user context? 
             // If accessed publicly, maybe restrict? 
             // For now assume if user is undefined, it's internal system call or unrestricted, 
             // BUT controller should always pass user if from API.
        }

        if (search) {
            const searchCondition = [
                { name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
                { description: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
            ];
            
            if (where.OR) {
                // Combine with existing OR (Access Control)
                // (UserAllowed) AND (SearchMatch)
                // accessOR = where.OR
                // newWhere = { AND: [ { OR: accessOR }, { OR: searchCondition } ] }
                const accessOR = where.OR;
                delete where.OR;
                where.AND = [
                    { OR: accessOR },
                    { OR: searchCondition }
                ];
            } else {
                where.OR = searchCondition;
            }
        }

        if (options.tags && options.tags.length > 0) {
            where.tags = { hasSome: options.tags };
        }

        // ソート条件
        const orderBy: Prisma.ApplicationDefinitionOrderByWithRelationInput = {};
        if (sortBy === 'name' || sortBy === 'status' || sortBy === 'version' || sortBy === 'createdAt' || sortBy === 'updatedAt') {
            orderBy[sortBy] = sortOrder;
        } else {
            orderBy.createdAt = sortOrder;
        }

        let resultData: any[];
        let paginationToken: any = null;

        // ページネーションなしの場合は単純な配列を返す（後方互換性）
        if (!page && !limit) {
            resultData = await this.prisma.applicationDefinition.findMany({
                where,
                orderBy,
                include: {
                    formDefinition: true,
                    flowDefinition: true,
                },
            });
        } else {
            // ページネーションありの場合
            const pageNum = page || 1;
            const limitNum = limit || 50;
            const skip = (pageNum - 1) * limitNum;

            const [data, total] = await Promise.all([
                this.prisma.applicationDefinition.findMany({
                    where,
                    orderBy,
                    skip,
                    take: limitNum,
                    include: {
                        formDefinition: true,
                        flowDefinition: true,
                    },
                }),
                this.prisma.applicationDefinition.count({ where }),
            ]);

            resultData = data;
            paginationToken = {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            };
        }

        // ユーザー情報を付加
        const enrichedData = await Promise.all(resultData.map(async (app) => {
            let createdByInfo: any = null;
            let updatedByInfo: any = null;

            if (app.createdBy) {
                createdByInfo = await this.usersService.getUserSnapshotByUsername(app.createdBy);
            }
            if (app.updatedBy) {
                updatedByInfo = await this.usersService.getUserSnapshotByUsername(app.updatedBy);
            }

            return {
                ...app,
                createdByInfo,
                updatedByInfo,
            };
        }));

        if (paginationToken) {
            return {
                data: enrichedData,
                pagination: paginationToken,
            };
        }
        
        return enrichedData;
    }

    async findOne(id: string) {
        // Cast to any to access adminIds until Prisma Client types are fully synced in IDE
        const appDef = await this.prisma.applicationDefinition.findUnique({
            where: { id },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        }) as any;

        if (!appDef) {
            throw new NotFoundException(`ApplicationDefinition with ID ${id} not found`);
        }

        // Enrich with admin info
        let adminInfo: any[] = [];
        if (appDef.adminIds && appDef.adminIds.length > 0) {
            adminInfo = await Promise.all(appDef.adminIds.map(async (adminId: string) => {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId);
                
                let snapshot: any;
                if (isUuid) {
                    snapshot = await this.usersService.getUserSnapshot(adminId);
                    snapshot.id = adminId;
                } else {
                    snapshot = await this.usersService.getUserSnapshotByUsername(adminId);
                    snapshot.id = adminId;
                }
                
                // If resolving failed (unknown), we still return what we have
                return snapshot;
            }));
        }

        return {
            ...appDef,
            adminInfo,
        };
    }

    async update(id: string, updateDto: UpdateApplicationDefinitionDto, username: string) {
        // Retrieve current to check if cron changed
        const current = await this.findOne(id);

        const updated = await this.prisma.applicationDefinition.update({
            where: { id },
            data: {
                ...updateDto,
                updatedBy: username,
            },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });

        // Handle Schedule Change
        if (updateDto.scheduleCron !== undefined) {
             // If removed or changed, unschedule existing (safe to call even if not exists in simpler implementations, but good practice)
             if (current.scheduleCron) {
                 await this.schedulerService.unscheduleWorkflow(id);
             }

             // If new cron provided and not empty
             if (updateDto.scheduleCron) {
                 await this.schedulerService.scheduleWorkflow(id, updateDto.scheduleCron, { applicationDefinitionId: id, triggeredBy: 'schedule' });
             }
        }
        
        return updated;
    }

    async remove(id: string) {
        await this.findOne(id); // Check if exists
        
        // Unschedule
        await this.schedulerService.unscheduleWorkflow(id);    

        return this.prisma.applicationDefinition.delete({
            where: { id },
        });
    }

    async findActive() {
        return this.prisma.applicationDefinition.findMany({
            where: { status: AppDefStatus.ACTIVE },
            orderBy: { createdAt: 'desc' },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });
    }

    /**
     * Find the latest published version of an application definition.
     * Used for starting new applications to ensure draft changes don't leak.
     */
    async findPublished(id: string) {
        // Find the latest published version
        const latestVersion = await this.prisma.appVersion.findFirst({
            where: { applicationDefinitionId: id },
            orderBy: { version: 'desc' },
            include: {
                applicationDefinition: true,
            },
        });

        if (!latestVersion) {
            // Fallback: If the app is marked ACTIVE but has no versions (legacy data?), return the current definition.
            // Otherwise, throw NotFound.
            const appDef = await this.prisma.applicationDefinition.findUnique({
                where: { id },
                include: { formDefinition: true, flowDefinition: true },
            });

            if (appDef && appDef.status === AppDefStatus.ACTIVE) {
                 return appDef;
            }

            throw new NotFoundException(`Published version for ApplicationDefinition ${id} not found`);
        }

        // Return a structure compatible with the ApplicationDefinition interface expected by the frontend
        return {
            id: latestVersion.applicationDefinitionId,
            name: latestVersion.applicationDefinition.name,
            description: latestVersion.applicationDefinition.description,
            status: 'ACTIVE',
            version: latestVersion.version,
            formDefinition: {
                id: 'version-snapshot', // Dummy ID
                name: 'Version Snapshot',
                schema: latestVersion.formSchema,
            },
            flowDefinition: {
                id: 'version-snapshot', // Dummy ID
                name: 'Version Snapshot',
                nodes: latestVersion.flowNodes,
                edges: latestVersion.flowEdges,
            },
        };
    }

    /**
     * Publish the app definition - creates a version snapshot and activates
     */
    async publish(id: string, publishedBy?: string, tx?: Prisma.TransactionClient, comment?: string) {
        const execute = async (prisma: Prisma.TransactionClient) => {
            const appDef = await prisma.applicationDefinition.findUnique({
                where: { id },
                include: {
                    formDefinition: true,
                    flowDefinition: true,
                },
            });

            if (!appDef) {
                throw new NotFoundException(`ApplicationDefinition with ID ${id} not found`);
            }

            // Get the highest existing version number for this app
            const latestVersion = await prisma.appVersion.findFirst({
                where: { applicationDefinitionId: id },
                orderBy: { version: 'desc' },
                select: { version: true },
            });

            // New version is max existing + 1, or 1 if no versions exist yet
            const newVersion = latestVersion ? latestVersion.version + 1 : 1;

            // Create version snapshot
            await prisma.appVersion.create({
                data: {
                    applicationDefinitionId: id,
                    version: newVersion,
                    formSchema: appDef.formDefinition?.schema ?? {},
                    flowNodes: appDef.flowDefinition?.nodes ?? [],
                    flowEdges: appDef.flowDefinition?.edges ?? [],
                    publishedBy: publishedBy ?? null,
                    comment: comment ?? null,
                },
            });

            // Update app definition with new version and status
            return prisma.applicationDefinition.update({
                where: { id },
                data: {
                    version: newVersion,
                    status: AppDefStatus.ACTIVE,
                    publishedAt: new Date(),
                },
                include: {
                    formDefinition: true,
                    flowDefinition: true,
                },
            });
        };

        if (tx) {
            return execute(tx);
        } else {
            return this.prisma.$transaction(execute);
        }
    }

    /**
     * Get version history for an app definition
     */
    /**
     * Get version history for an app definition
     */
    async getVersions(id: string) {
        await this.findOne(id); // Check if exists

        const versions = await this.prisma.appVersion.findMany({
            where: { applicationDefinitionId: id },
            orderBy: { version: 'desc' },
        });

        // Populate publishedBy info
        return Promise.all(versions.map(async (v) => {
            let publishedByInfo: any = null;
            if (v.publishedBy) {
                publishedByInfo = await this.usersService.getUserSnapshotByUsername(v.publishedBy);
            }
            return {
                ...v,
                publishedByInfo,
            };
        }));
    }

    /**
     * Restore app to a previous version
     */
    async restore(id: string, targetVersion: number, restoredBy: string, comment?: string) {
        return this.prisma.$transaction(async (tx) => {
            const appDef = await tx.applicationDefinition.findUnique({
                where: { id },
                include: {
                    formDefinition: true,
                    flowDefinition: true,
                },
            });

            if (!appDef) {
                throw new NotFoundException(`ApplicationDefinition with ID ${id} not found`);
            }

            // Find the version to restore
            const versionToRestore = await tx.appVersion.findUnique({
                where: {
                    applicationDefinitionId_version: {
                        applicationDefinitionId: id,
                        version: targetVersion,
                    },
                },
            });

            if (!versionToRestore) {
                throw new NotFoundException(`Version ${targetVersion} not found`);
            }

            // Update form definition with restored schema
            if (appDef.formDefinitionId && versionToRestore.formSchema) {
                await tx.formDefinition.update({
                    where: { id: appDef.formDefinitionId },
                    data: { schema: versionToRestore.formSchema },
                });
            }

            // Update flow definition with restored nodes/edges
            if (appDef.flowDefinitionId && versionToRestore.flowNodes) {
                await tx.flowDefinition.update({
                    where: { id: appDef.flowDefinitionId },
                    data: {
                        nodes: versionToRestore.flowNodes,
                        edges: versionToRestore.flowEdges || [],
                    },
                });
            }

            // Publish as new version (backup current + restore)
            return this.publish(id, restoredBy, tx, comment);
        });
    }
}
