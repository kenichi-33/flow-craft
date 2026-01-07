import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from './search.service';
import { PostgresSearchService } from './postgres-search.service';
import { ElasticsearchSearchService } from './elasticsearch-search.service';
import { SearchController } from './search.controller';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    QueueModule,
    PrismaModule,
  ],
  controllers: [SearchController],
  providers: [
    SearchService,
    PostgresSearchService,
    ElasticsearchSearchService,
  ],
  exports: [SearchService],
})
export class SearchModule {}
