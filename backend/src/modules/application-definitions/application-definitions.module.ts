import { Module } from '@nestjs/common';
import { ApplicationDefinitionsController } from './application-definitions.controller';
import { ApplicationDefinitionsService } from './application-definitions.service';
import { UsersModule } from '../users/users.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [UsersModule, QueueModule],
  controllers: [ApplicationDefinitionsController],
  providers: [ApplicationDefinitionsService],
  exports: [ApplicationDefinitionsService],
})
export class ApplicationDefinitionsModule {}
