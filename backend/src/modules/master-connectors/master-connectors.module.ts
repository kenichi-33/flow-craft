import { Module } from '@nestjs/common';
import { MasterConnectorsService } from './master-connectors.service';
import { MasterConnectorsController } from './master-connectors.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MasterConnectorsController],
  providers: [MasterConnectorsService],
  exports: [MasterConnectorsService],
})
export class MasterConnectorsModule {}
