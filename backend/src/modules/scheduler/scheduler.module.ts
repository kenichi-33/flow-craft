import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [
    QueueModule,
    PrismaModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    SchedulerService,
  ],
  exports: [SchedulerService],
})
export class SchedulerModule {}
