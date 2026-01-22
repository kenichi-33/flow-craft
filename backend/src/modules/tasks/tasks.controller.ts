import { Controller, Get, Param, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CurrentUser } from '../../auth/decorators';
import type { AuthUser } from '../../auth/types/user.interface';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

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
    @Query('myTasks') myTasks?: string,
  ) {
    return this.tasksService.findAll({
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
      // myTasks=trueの場合、ログインユーザーのタスクのみ表示
      userId: myTasks === 'true' ? user.username : undefined,
      userRoles: user.roles,
      userGroups: user.groups,
      userGroupCodes: user.groupCodes,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }
}
