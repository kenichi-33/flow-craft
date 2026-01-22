import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ISearchService,
  SearchResult,
} from './interfaces/search-service.interface';
import { SearchQueryDto, SearchOperator } from './dto/search-application.dto';
import { Application, Prisma } from '@prisma/client';

@Injectable()
export class PostgresSearchService implements ISearchService {
  private readonly logger = new Logger(PostgresSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    const schema = fullApp.formDefinition.schema as any;
    const data = fullApp.inputData as any;

    const searchMeta = this.resolveSearchMeta(schema, data);
    const fullText = this.generateFullText(data, searchMeta);

    await this.prisma.application.update({
      where: { id: app.id },
      data: {
        searchMeta,
        fullText,
      },
    });
    this.logger.debug(`Indexed app ${app.id} successfully`);
  }

  private resolveSearchMeta(schema: any, data: any): Record<string, string> {
    const meta: Record<string, string> = {};
    if (!schema?.properties || !data) return meta;

    for (const [key, value] of Object.entries(data)) {
      const prop = schema.properties[key];
      if (!prop) continue;

      // Handle Select/Radio with 'oneOf' or 'enum'
      if (prop.oneOf) {
        const option = prop.oneOf.find((o: any) => o.const === value);
        if (option && option.title) {
          meta[`${key}_label`] = option.title;
        }
      } else if (prop.enum && prop.enumNames) {
        const index = prop.enum.indexOf(value);
        if (index !== -1 && prop.enumNames[index]) {
          meta[`${key}_label`] = prop.enumNames[index];
        }
      }
    }
    return meta;
  }

  private generateFullText(data: any, meta: any): string {
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
    addValues(meta);

    return parts.join(' ');
  }

  async removeApplication(appId: string): Promise<void> {
    // No-op for PostgreSQL
    this.logger.debug(
      `Remove index requested for app ${appId} (PostgreSQL mode: skipped)`,
    );
  }
}
