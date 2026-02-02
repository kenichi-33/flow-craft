import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ISearchService,
  SearchResult,
} from './interfaces/search-service.interface';
import { SearchApplicationDto } from './dto/search-application.dto';
import { Application } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';

@Injectable()
export abstract class SearchService implements ISearchService, OnModuleInit {
  protected readonly logger = new Logger(SearchService.name);

  constructor(
    protected readonly queueService: QueueService,
    protected readonly prisma: PrismaService,
  ) {}

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

    try {
      const app = await this.prisma.application.findUnique({
        where: { id: payload.applicationId },
      });

      if (app) {
        await this.indexApplication(app);
      } else {
        await this.removeApplication(payload.applicationId);
      }
    } catch (error) {
      this.logger.error(
        `Failed to index application ${payload.applicationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Abstract methods to be implemented by specific strategies
   */
  abstract search(
    dto: SearchApplicationDto,
  ): Promise<SearchResult<Application>>;

  abstract indexApplication(app: Application): Promise<void>;

  abstract removeApplication(appId: string): Promise<void>;
}
