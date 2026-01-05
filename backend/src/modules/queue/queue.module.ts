import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from './queue.service';
import { PgBossQueueAdapter } from './adapters/pg-boss.adapter';

@Global() // Make it global so it can be used everywhere without imports
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'QUEUE_ADAPTER',
      useClass: PgBossQueueAdapter,
    },
    QueueService,
  ],
  exports: [QueueService],
})
export class QueueModule {}
