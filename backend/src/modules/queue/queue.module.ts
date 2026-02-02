import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { PgBossQueueAdapter } from './adapters/pg-boss.adapter';
import { KafkaAdapter } from './adapters/kafka.adapter';
import { PrismaModule } from '../../prisma/prisma.module';
import { IQueueAdapter } from './queue.interface';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    {
      provide: 'QUEUE_ADAPTER',
      useFactory: (config: ConfigService): IQueueAdapter => {
        const type = config.get('QUEUE_TYPE') || 'pgboss';
        // Validate DATABASE_URL exists
        config.getOrThrow<string>('DATABASE_URL');

        if (type === 'kafka') {
          // We'll create adapter manually here instead of using DI
          // This prevents both adapters from being instantiated
          const adapter = new KafkaAdapter(config);
          return adapter;
        }

        // Default to PgBoss
        const adapter = new PgBossQueueAdapter(config);
        return adapter;
      },
      inject: [ConfigService],
    },
    QueueService,
  ],
  exports: [QueueService, 'QUEUE_ADAPTER'],
})
export class QueueModule {}
