import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApplicationDefinitionDto } from './dto/create-application-definition.dto';
import { UpdateApplicationDefinitionDto } from './dto/update-application-definition.dto';

@Injectable()
export class ApplicationDefinitionsService {
    constructor(private prisma: PrismaService) { }

    async create(createDto: CreateApplicationDefinitionDto) {
        return this.prisma.applicationDefinition.create({
            data: {
                name: createDto.name,
                description: createDto.description,
                formDefinitionId: createDto.formDefinitionId,
                flowDefinitionId: createDto.flowDefinitionId,
            },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });
    }

    async findAll() {
        return this.prisma.applicationDefinition.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });
    }

    async findOne(id: string) {
        const appDef = await this.prisma.applicationDefinition.findUnique({
            where: { id },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });

        if (!appDef) {
            throw new NotFoundException(`ApplicationDefinition with ID ${id} not found`);
        }

        return appDef;
    }

    async update(id: string, updateDto: UpdateApplicationDefinitionDto) {
        await this.findOne(id); // Check if exists

        return this.prisma.applicationDefinition.update({
            where: { id },
            data: updateDto,
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });
    }

    async remove(id: string) {
        await this.findOne(id); // Check if exists

        return this.prisma.applicationDefinition.delete({
            where: { id },
        });
    }

    async findActive() {
        return this.prisma.applicationDefinition.findMany({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });
    }

    /**
     * Publish the app definition - creates a version snapshot and activates
     */
    async publish(id: string, publishedBy?: string) {
        const appDef = await this.prisma.applicationDefinition.findUnique({
            where: { id },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });

        if (!appDef) {
            throw new NotFoundException(`ApplicationDefinition with ID ${id} not found`);
        }

        const newVersion = appDef.version + 1;

        // Create version snapshot
        await this.prisma.appVersion.create({
            data: {
                applicationDefinitionId: id,
                version: newVersion,
                formSchema: appDef.formDefinition?.schema ?? {},
                flowNodes: appDef.flowDefinition?.nodes ?? [],
                flowEdges: appDef.flowDefinition?.edges ?? [],
                publishedBy: publishedBy ?? null,
            },
        });

        // Update app definition with new version and status
        return this.prisma.applicationDefinition.update({
            where: { id },
            data: {
                version: newVersion,
                status: 'ACTIVE',
                publishedAt: new Date(),
            },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });
    }

    /**
     * Get version history for an app definition
     */
    async getVersions(id: string) {
        await this.findOne(id); // Check if exists

        return this.prisma.appVersion.findMany({
            where: { applicationDefinitionId: id },
            orderBy: { version: 'desc' },
        });
    }

    /**
     * Restore app to a previous version
     */
    async restore(id: string, targetVersion: number) {
        const appDef = await this.prisma.applicationDefinition.findUnique({
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
        const versionToRestore = await this.prisma.appVersion.findUnique({
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
            await this.prisma.formDefinition.update({
                where: { id: appDef.formDefinitionId },
                data: { schema: versionToRestore.formSchema },
            });
        }

        // Update flow definition with restored nodes/edges
        if (appDef.flowDefinitionId && versionToRestore.flowNodes) {
            await this.prisma.flowDefinition.update({
                where: { id: appDef.flowDefinitionId },
                data: {
                    nodes: versionToRestore.flowNodes,
                    edges: versionToRestore.flowEdges || [],
                },
            });
        }

        // Publish as new version (backup current + restore)
        return this.publish(id, 'system-restore');
    }
}
