import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { UsersModule } from '../users/users.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [UsersModule, TeamsModule],
  controllers: [TasksController],
  providers: [TasksService]
})
export class TasksModule {}
