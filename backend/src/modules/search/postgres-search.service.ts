import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ISearchService, SearchResult } from './interfaces/search-service.interface';
import { SearchApplicationDto, SearchOperator } from './dto/search-application.dto';
import { Application, Prisma } from '@prisma/client';

@Injectable()
export class PostgresSearchService implements ISearchService {
  private readonly logger = new Logger(PostgresSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchApplicationDto): Promise<SearchResult<Application>> {
    const { applicationDefinitionId, criteria = {}, page = 1, limit = 20 } = dto;
    this.logger.debug(`Search request: ${JSON.stringify(dto)}`); // Debug log
    const skip = (page - 1) * limit;

    const where: Prisma.ApplicationWhereInput = {
      applicationDefinitionId,
    };

    // Build JSON filter for inputData
    if (Object.keys(criteria).length > 0) {
      const jsonFilters: Prisma.ApplicationWhereInput[] = [];

      for (const [fieldId, criterion] of Object.entries(criteria)) {
        const path = [fieldId];
        const value = criterion.value;

        switch (criterion.operator) {
          case SearchOperator.EQUALS:
            jsonFilters.push({
              inputData: {
                path,
                equals: value,
              },
            });
            break;
          case SearchOperator.CONTAINS:
             // Support both exact match (for strings/numbers) and array containment (for checkboxes/multi-selects)
             jsonFilters.push({
               OR: [
                 {
                   inputData: {
                     path,
                     equals: value, 
                   },
                 },
                 {
                   inputData: {
                     path,
                     array_contains: value, 
                   },
                 }
               ]
            });
            break;
          case SearchOperator.GT:
            jsonFilters.push({
              inputData: {
                path,
                gt: value,
              },
            });
            break;
          case SearchOperator.LT:
            jsonFilters.push({
              inputData: {
                path,
                lt: value,
              },
            });
            break;
          case SearchOperator.GTE:
            jsonFilters.push({
              inputData: {
                path,
                gte: value,
              },
            });
            break;
          case SearchOperator.LTE:
            jsonFilters.push({
              inputData: {
                path,
                lte: value,
              },
            });
            break;
        }
      }

      if (jsonFilters.length > 0) {
        where.AND = jsonFilters;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
    // No-op for PostgreSQL as data is already in DB
    this.logger.debug(`Indexing requested for app ${app.id} (PostgreSQL mode: skipped)`);
  }

  async removeApplication(appId: string): Promise<void> {
    // No-op for PostgreSQL
    this.logger.debug(`Remove index requested for app ${appId} (PostgreSQL mode: skipped)`);
  }
}
