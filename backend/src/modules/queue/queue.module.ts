import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { PgBossQueueAdapter } from './adapters/pg-boss.adapter';
import { KafkaAdapter } from './adapters/kafka.adapter';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    PgBossQueueAdapter,
    KafkaAdapter,
    {
      provide: 'QUEUE_ADAPTER',
      useFactory: (config: ConfigService, pgBoss: PgBossQueueAdapter, kafka: KafkaAdapter) => {
        const type = config.get('QUEUE_TYPE');
        return type === 'kafka' ? kafka : pgBoss;
      },
      inject: [ConfigService, PgBossQueueAdapter, KafkaAdapter],
    },
    QueueService,
  ],
  exports: [QueueService],
})
export class QueueModule {}
