import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { CurrentUser } from '../../auth/decorators';
import type { AuthUser } from '../../auth/types/user.interface';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  create(@Body() createApplicationDto: CreateApplicationDto) {
    return this.applicationsService.create(createApplicationDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('status') status?: string,
    @Query('applicationNumber') applicationNumber?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('myApplications') myApplications?: string,
  ) {
    return this.applicationsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      sortBy,
      sortOrder,
      status,
      applicationNumber: applicationNumber
        ? parseInt(applicationNumber, 10)
        : undefined,
      dateFrom,
      dateTo,
      // myApplications=trueの場合、ログインユーザーの申請のみ
      applicantId: myApplications === 'true' ? user.username : undefined,
      // アクセス制御用: リクエストユーザーID
      requestUserId: user.username,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.applicationsService.findOne(id, user.username);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateData: { title?: string; inputData?: any; status?: string },
  ) {
    return this.applicationsService.update(id, updateData);
  }
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.applicationsService.cancel(id, user.username);
  }
}
