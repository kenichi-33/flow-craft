
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { WorkflowEngineService } from '../modules/workflow-engine/workflow-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(WorkflowEngineService);
  const prisma = app.get(PrismaService);
  const logger = new Logger('VerifyCompleteTask');

  // 1. Setup: Create Application and Task
  const appId = 'verify-app-' + Date.now();
  const taskId = 'verify-task-' + Date.now();
  
  // Note: We need existing definition. Mocking might be hard due to foreign keys.
  // We will search for an existing Active ApplicationDefinition.
  const appDef = await prisma.applicationDefinition.findFirst({
      where: { status: 'ACTIVE' }
  });

  if (!appDef) {
      logger.error('No Active App Definition found. Cannot run test.');
      await app.close();
      return;
  }

  // Create minimal Application
  try {
      // Manual creation instead of startWorkflow to avoid queue side effects for now
      const application = await prisma.application.create({
          data: {
              id: appId,
              title: 'Verification App',
              applicationDefinitionId: appDef.id,
              formDefinitionId: appDef.formDefinitionId!,
              flowDefinitionId: appDef.flowDefinitionId!,
              applicantId: 'admin',
              applicantInfo: {},
              status: 'IN_PROGRESS',
              inputData: { initial: 'value' },
              currentNodeId: 'start',
          }
      });

      // Create Task
      await prisma.workflowTask.create({
          data: {
              id: taskId,
              applicationId: appId,
              stepId: 'step1',
              type: 'approval',
              status: 'PENDING', // Ready to complete
              assignedTo: 'user:admin',
              config: {},
          }
      });

      logger.log(`Created App ${appId} and Task ${taskId} with initial data: ${JSON.stringify(application.inputData)}`);

      // 2. Execute completeTask with new inputData
      const updateData = { initial: 'updated', newField: 'added' };
      logger.log(`Completing task with inputData: ${JSON.stringify(updateData)}`);

      await service.completeTask({
          taskId,
          action: 'APPROVE',
          actorId: 'admin',
          inputData: updateData
      });

      // 3. Verify Application inputData
      const updatedApp = await prisma.application.findUnique({ where: { id: appId } });
      logger.log(`Updated App inputData: ${JSON.stringify(updatedApp?.inputData)}`);

      if (updatedApp && updatedApp.inputData && (updatedApp.inputData as any).initial === 'updated') {
          logger.log('SUCCESS: Application inputData was updated.');
      } else {
          logger.error('FAILURE: Application inputData was NOT updated correctly.');
      }

      // Cleanup
      await prisma.workflowTask.delete({ where: { id: taskId } });
      await prisma.application.delete({ where: { id: appId } });

  } catch (e) {
      logger.error('Error during verification', e);
  }

  await app.close();
}

bootstrap();
