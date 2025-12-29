import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FormsModule } from './modules/forms/forms.module';
import { FlowsModule } from './modules/flows/flows.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { ApplicationDefinitionsModule } from './modules/application-definitions/application-definitions.module';
import { WorkflowEngineModule } from './modules/workflow-engine/workflow-engine.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FormsModule,
    FlowsModule,
    ApplicationsModule,
    ApplicationDefinitionsModule,
    WorkflowEngineModule,
    TasksModule,
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
