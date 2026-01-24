import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchService } from './search.service';
import { PostgresSearchService } from './postgres-search.service';
import { ElasticsearchSearchService } from './elasticsearch-search.service';
import { SearchController } from './search.controller';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';

import { SearchMetaService } from './search-meta.service';

@Module({
  imports: [ConfigModule, QueueModule, PrismaModule],
  controllers: [SearchController],
  providers: [
    SearchMetaService,
    {
      provide: SearchService,
      useFactory: (
        config: ConfigService,
        queueService: QueueService,
        prisma: PrismaService,
        searchMetaService: SearchMetaService,
      ) => {
        const mode = config.get('SEARCH_MODE') || 'postgres';
        if (mode === 'elasticsearch') {
          // ElasticsearchSearchService(configService, queueService, prisma, searchMetaService)
          return new ElasticsearchSearchService(config, queueService, prisma, searchMetaService);
        }
        // PostgresSearchService(prisma, queueService, searchMetaService)
        return new PostgresSearchService(prisma, queueService, searchMetaService);
      },
      inject: [ConfigService, QueueService, PrismaService, SearchMetaService],
    },
  ],
  exports: [SearchService],
})
export class SearchModule {}
