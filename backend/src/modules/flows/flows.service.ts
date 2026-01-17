import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { Prisma } from '@prisma/client';
import { SchedulerService } from '../scheduler/scheduler.service';

@Injectable()
export class FlowsService {
    constructor(
        private prisma: PrismaService,
        private scheduler: SchedulerService,
    ) { }

    create(createFlowDto: CreateFlowDto) {
        return this.prisma.flowDefinition.create({
            data: {
                name: createFlowDto.name,
                nodes: createFlowDto.nodes as Prisma.InputJsonValue,
                edges: createFlowDto.edges as Prisma.InputJsonValue,
            },
        });
    }

    findAll() {
        return this.prisma.flowDefinition.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    findOne(id: string) {
        return this.prisma.flowDefinition.findUnique({
            where: { id },
        });
    }

    async update(id: string, updateData: { name?: string; nodes?: any; edges?: any }) {
        const updatedFlow = await this.prisma.flowDefinition.update({
            where: { id },
            data: {
                ...(updateData.name && { name: updateData.name }),
                ...(updateData.nodes && { nodes: updateData.nodes as Prisma.InputJsonValue }),
                ...(updateData.edges && { edges: updateData.edges as Prisma.InputJsonValue }),
            },
        });

        // Cron sync logic removed for isolation. 
        // Cron should only be updated when ApplicationDefinition is published/updated.

        return updatedFlow;
    }
}
