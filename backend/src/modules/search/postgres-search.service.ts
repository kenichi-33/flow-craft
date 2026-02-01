import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ISearchService,
  SearchResult,
} from './interfaces/search-service.interface';
import { SearchQueryDto, SearchOperator } from './dto/search-application.dto';
import { Application, Prisma } from '@prisma/client';

import { SearchService } from './search.service';
import { QueueService } from '../queue/queue.service';

import { SearchMetaService } from './search-meta.service';

@Injectable()
export class PostgresSearchService extends SearchService {
  constructor(
    prisma: PrismaService,
    queueService: QueueService,
    private readonly searchMetaService: SearchMetaService,
  ) {
    super(queueService, prisma);
  }

  async search(dto: SearchQueryDto): Promise<SearchResult<Application>> {
    const {
      keyword,
      filters,
      sort,
      page = 1,
      limit = 20,
      applicationDefinitionId,
      applicantId,
      status,
      criteria,
    } = dto;

    this.logger.debug(`Search request: ${JSON.stringify(dto)}`);
    const skip = (page - 1) * limit;

    const where: Prisma.ApplicationWhereInput = {};

    if (applicationDefinitionId)
      where.applicationDefinitionId = applicationDefinitionId;
    if (applicantId) where.applicantId = applicantId;
    if (status && status.length > 0) {
      where.status = { in: status as any };
    }

    // Keyword Search (Full Text)
    if (keyword) {
      where.fullText = {
        contains: keyword,
        mode: 'insensitive',
      };
    }

    // Field Filters (JSON)
    const activeFilters: any[] = [];
    if (filters) activeFilters.push(...filters);
    if (criteria) {
      Object.entries(criteria).forEach(([field, c]: [string, any]) => {
        activeFilters.push({ field, operator: c.operator, value: c.value });
      });
    }

    if (activeFilters.length > 0) {
      const jsonFilters: Prisma.ApplicationWhereInput[] = [];

      for (const filter of activeFilters) {
        const path = filter.field.split('.');
        const { operator, value } = filter;

        if (value === undefined || value === null || value === '') continue;

        switch (operator) {
          case SearchOperator.EQUALS:
            jsonFilters.push({ inputData: { path, equals: value } });
            break;
          case SearchOperator.CONTAINS:
            jsonFilters.push({
              OR: [
                { inputData: { path, equals: value } },
                { inputData: { path, array_contains: value } },
                // { inputData: { path, string_contains: value } } // Uncomment if needed and supported
              ],
            });
            break;
          case SearchOperator.GT:
            jsonFilters.push({ inputData: { path, gt: value } });
            break;
          case SearchOperator.LT:
            jsonFilters.push({ inputData: { path, lt: value } });
            break;
          case SearchOperator.GTE:
            jsonFilters.push({ inputData: { path, gte: value } });
            break;
          case SearchOperator.LTE:
            jsonFilters.push({ inputData: { path, lte: value } });
            break;
          case SearchOperator.IN:
            if (Array.isArray(value)) {
              jsonFilters.push({
                OR: value.map((v) => ({ inputData: { path, equals: v } })),
              });
            }
            break;
        }
      }

      if (jsonFilters.length > 0) {
        where.AND = jsonFilters;
      }
    }

    // Sorting
    let orderBy: Prisma.ApplicationOrderByWithRelationInput = {
      createdAt: 'desc',
    };
    if (sort) {
      if (
        [
          'createdAt',
          'updatedAt',
          'applicationNumber',
          'status',
          'title',
        ].includes(sort.field)
      ) {
        orderBy = { [sort.field]: sort.order };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async indexApplication(app: Application): Promise<void> {
    this.logger.debug(`Indexing requested for app ${app.id} (PostgreSQL mode)`);

    // Fetch full app with form definition to resolve labels
    const fullApp = await this.prisma.application.findUnique({
      where: { id: app.id },
      include: { formDefinition: true },
    });

    if (!fullApp || !fullApp.formDefinition) {
      this.logger.warn(
        `App ${app.id} or FormDefinition not found for indexing`,
      );
      return;
    }

    const data = fullApp.inputData as any;

    const metaString = await this.searchMetaService.generateSearchMeta(fullApp);
    const rawDataString = this.generateRawDataString(data);
    const fullText = `${metaString} ${rawDataString}`;

    await this.prisma.application.update({
      where: { id: app.id },
      data: {
        searchMeta: Prisma.JsonNull, // Not used for now
        fullText,
      },
    });
    this.logger.debug(`Indexed app ${app.id} successfully`);
  }

  private generateRawDataString(data: any): string {
    const parts: string[] = [];

    const addValues = (obj: any) => {
      if (!obj) return;
      if (typeof obj === 'object') {
        if (Array.isArray(obj)) {
          obj.forEach((v) => addValues(v));
        } else {
          Object.values(obj).forEach((v) => addValues(v));
        }
      } else if (typeof obj === 'string' || typeof obj === 'number') {
        parts.push(String(obj));
      }
    };

    addValues(data);

    return parts.join(' ');
  }

  async removeApplication(appId: string): Promise<void> {
    // No-op for PostgreSQL
    this.logger.debug(
      `Remove index requested for app ${appId} (PostgreSQL mode: skipped)`,
    );
  }
}
