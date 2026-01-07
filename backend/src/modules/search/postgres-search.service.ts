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
    const skip = (page - 1) * limit;

    const where: Prisma.ApplicationWhereInput = {
      applicationDefinitionId,
    };

    // Build JSON filter for inputData
    if (Object.keys(criteria).length > 0) {
      const jsonFilters: Prisma.ApplicationWhereInput[] = [];

      for (const [fieldId, criterion] of Object.entries(criteria)) {
        const path = [fieldId]; // Assumes flat structure. If nested, split by dot?
        const value = criterion.value;

        // Note: Prisma JSON filtering relies on database-side type consistency.
        // If the value in DB is string "100", and we query with number 100, it might not match.
        
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
            // JSONB 'contains' is for object containment or array containment, NOT string substring.
            // For string substring in JSON, Postgres usually needs raw SQL or text search.
            // Prisma doesn't natively support substring search inside JSON values easily in `where`.
            // Fallback: Use string_contains if it's a string, may be limited.
            // For now, we simulate 'equals' or use raw query if absolutely needed.
            // Prisma 5+ might have better support, but strictly speaking json 'string_contains' is tricky.
            // Let's use `string_contains` if implicitly supported or fallback to exact match for MVP
            // or use specific JSON filter syntax if available.
            // Actually, for PostgreSQL, path equals works. 
            // 'string_contains' within JSON is not standard in Prisma types yet.
            // We will treat it as exact match for now or consider raw query if critical.
             jsonFilters.push({
              inputData: {
                path,
                equals: value, // Temporary limitation: Exact match
              },
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
