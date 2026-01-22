import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FormsModule } from './modules/forms/forms.module';
import { FlowsModule } from './modules/flows/flows.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { ApplicationDefinitionsModule } from './modules/application-definitions/application-definitions.module';
import { WorkflowEngineModule } from './modules/workflow-engine/workflow-engine.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SearchModule } from './modules/search/search.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TeamsModule } from './modules/teams/teams.module';
import { UsersModule } from './modules/users/users.module';
import { StorageModule } from './modules/storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { QueueModule } from './modules/queue/queue.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { StatisticsModule } from './modules/statistics/statistics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    FormsModule,
    FlowsModule,
    ApplicationsModule,
    ApplicationDefinitionsModule,
    WorkflowEngineModule,
    TasksModule,
    TeamsModule,
    UsersModule,
    StorageModule,
    PrismaModule,
    NotificationsModule,
    QueueModule,
    SchedulerModule,
    SearchModule,
    StatisticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // グローバルガード（全エンドポイントにJWT認証適用）
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
