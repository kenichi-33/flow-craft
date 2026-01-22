import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ISearchService,
  SearchResult,
} from './interfaces/search-service.interface';
import { SearchApplicationDto } from './dto/search-application.dto';
import { Application } from '@prisma/client';
import { PostgresSearchService } from './postgres-search.service';
import { ElasticsearchSearchService } from './elasticsearch-search.service';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService implements ISearchService, OnModuleInit {
  private readonly logger = new Logger('[Indexer] SearchService');
  private searchMode: 'postgres' | 'elasticsearch';

  constructor(
    private readonly configService: ConfigService,
    private readonly postgresSearchService: PostgresSearchService,
    private readonly elasticsearchSearchService: ElasticsearchSearchService,
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
  ) {
    this.searchMode = this.configService.get('SEARCH_MODE', 'postgres');
    this.logger.log(`SearchService initialized with mode: ${this.searchMode}`);
  }

  async onModuleInit() {
    // Register queue handler for async indexing
    await this.queueService.registerHandler(
      'application-indexing',
      this.handleIndexingJob.bind(this),
    );
  }

  /**
   * Queue Job Handler
   */
  private async handleIndexingJob(payload: {
    applicationId: string;
  }): Promise<void> {
    this.logger.debug(
      `Processing indexing job for app: ${payload.applicationId}`,
    );

    // Proceed for both Elasticsearch (external index) and Postgres (fullText column update)
    // if (this.searchMode !== 'elasticsearch') { return; } // Removed restriction

    try {
      const app = await this.prisma.application.findUnique({
        where: { id: payload.applicationId },
      });

      if (app) {
        await this.elasticsearchSearchService.indexApplication(app);
      } else {
        // If app not found (deleted?), maybe remove from index?
        await this.elasticsearchSearchService.removeApplication(
          payload.applicationId,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to index application ${payload.applicationId}`,
        error.stack,
      );
      throw error; // Rethrow to let queue retry
    }
  }

  /**
   * Facade methods
   */
  async search(dto: SearchApplicationDto): Promise<SearchResult<Application>> {
    if (this.searchMode === 'elasticsearch') {
      return this.elasticsearchSearchService.search(dto);
    }
    return this.postgresSearchService.search(dto);
  }

  async indexApplication(app: Application): Promise<void> {
    if (this.searchMode === 'elasticsearch') {
      return this.elasticsearchSearchService.indexApplication(app);
    }
    return this.postgresSearchService.indexApplication(app);
  }

  async removeApplication(appId: string): Promise<void> {
    if (this.searchMode === 'elasticsearch') {
      return this.elasticsearchSearchService.removeApplication(appId);
    }
    return this.postgresSearchService.removeApplication(appId);
  }
}
