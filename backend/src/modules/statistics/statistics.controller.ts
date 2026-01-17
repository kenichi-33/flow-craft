import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'wf_admin') // 管理者専用
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('applications')
  async getApplicationsSummary() {
    return this.statisticsService.getApplicationsSummary();
  }

  @Get('applications/:id')
  async getApplicationStats(@Param('id') id: string) {
    return this.statisticsService.getApplicationStats(id);
  }
}
