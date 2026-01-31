import { Module } from '@nestjs/common';
import { MasterConnectorsService } from './master-connectors.service';
import { MasterConnectorsController } from './master-connectors.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [MasterConnectorsController],
  providers: [MasterConnectorsService],
  exports: [MasterConnectorsService],
})
export class MasterConnectorsModule {}
