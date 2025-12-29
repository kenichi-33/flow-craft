import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class FlowsService {
    constructor(private prisma: PrismaService) { }

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

    update(id: string, updateData: { name?: string; nodes?: any; edges?: any }) {
        return this.prisma.flowDefinition.update({
            where: { id },
            data: {
                ...(updateData.name && { name: updateData.name }),
                ...(updateData.nodes && { nodes: updateData.nodes as Prisma.InputJsonValue }),
                ...(updateData.edges && { edges: updateData.edges as Prisma.InputJsonValue }),
            },
        });
    }
}
