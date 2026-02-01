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
  ) {}

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

  async update(
    id: string,
    updateData: { name?: string; nodes?: any; edges?: any },
  ) {
    const updatedFlow = await this.prisma.flowDefinition.update({
      where: { id },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.nodes && {
          nodes: updateData.nodes as Prisma.InputJsonValue,
        }),
        ...(updateData.edges && {
          edges: updateData.edges as Prisma.InputJsonValue,
        }),
      },
    });

    // Sync Cron to ApplicationDefinitions if nodes are updated
    if (updateData.nodes) {
      const nodes = updateData.nodes as any[];
      const startNode = nodes.find((n) => n.type === 'start');
      // Extract cron: undefined if not found, string if found (can be empty)
      const rawCron = startNode?.data?.scheduleCron || startNode?.data?.cron;
      const newCron = rawCron && rawCron.trim() !== '' ? rawCron : null;

      // Find all active AppDefs using this flow
      const appDefs = await this.prisma.applicationDefinition.findMany({
        where: { flowDefinitionId: id },
      });

      for (const appDef of appDefs) {
        if (appDef.scheduleCron !== newCron) {
          // Update AppDef
          await this.prisma.applicationDefinition.update({
            where: { id: appDef.id },
            data: { scheduleCron: newCron },
          });

          // Update Scheduler
          // 1. Always unschedule old
          this.scheduler.unscheduleWorkflow(appDef.id);

          // 2. Schedule new if active and has cron
          if (newCron && appDef.status === 'ACTIVE') {
            await this.scheduler.scheduleWorkflow(appDef.id, newCron, {
              applicationDefinitionId: appDef.id,
              triggeredBy: 'schedule',
            });
          }
        }
      }
    }

    return updatedFlow;
  }
}
