import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationRecoveryService } from './application-recovery.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationRecoveryService]
})
export class ApplicationsModule {}
