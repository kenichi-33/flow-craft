import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { Prisma } from '@prisma/client';

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

    findAll() {
        return this.prisma.application.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                formDefinition: true,
                flowDefinition: true,
                applicationDefinition: true,
            },
        });
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
}
