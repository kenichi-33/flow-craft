import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TasksService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.approvalTask.findMany({
            orderBy: { createdAt: 'desc' },
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
