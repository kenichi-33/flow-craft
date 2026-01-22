import {
  Controller,
  Post,
  Param,
  Body,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly workflowService: WorkflowEngineService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':token')
  async handleWebhook(@Param('token') token: string, @Body() body: any) {
    this.logger.log(`Received webhook with token: ${token}`);

    // Find Application Definition by token
    const appDef = await this.prisma.applicationDefinition.findUnique({
      where: { webhookToken: token } as any,
    });

    if (!appDef) {
      this.logger.warn(`Webhook token not found: ${token}`);
      throw new NotFoundException('Invalid webhook token');
    }

    if (appDef.status !== 'ACTIVE') {
      this.logger.warn(`Application definition is not active: ${appDef.id}`);
      throw new NotFoundException('Application is not active');
    }

    // Start Workflow
    const application = await this.workflowService.startWorkflow({
      applicationDefinitionId: appDef.id,
      title: `Webhook Triggered: ${new Date().toISOString()}`,
      inputData: body || {},
      applicantId: 'system-webhook', // System user or special identifier
    });

    if (!application) {
      throw new Error('Failed to start workflow');
    }

    return {
      message: 'Workflow started successfully',
      applicationId: application.id,
      applicationNumber: application.applicationNumber,
    };
  }
}
