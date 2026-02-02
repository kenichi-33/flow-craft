import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WorkflowEngineService } from './workflow-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('WebhookController', () => {
  let controller: WebhookController;
  let workflowService: WorkflowEngineService;
  let prisma: PrismaService;

  const mockWorkflowService = {
    startWorkflow: jest.fn(),
  };

  const mockPrisma = {
    applicationDefinition: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: WorkflowEngineService, useValue: mockWorkflowService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    workflowService = module.get<WorkflowEngineService>(WorkflowEngineService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should start workflow for valid token and active definition', async () => {
      mockPrisma.applicationDefinition.findUnique.mockResolvedValue({
        id: 'def-1',
        webhookToken: 'valid-token',
        status: 'ACTIVE',
      });
      mockWorkflowService.startWorkflow.mockResolvedValue({
        id: 'app-1',
        applicationNumber: 1,
      });

      const body = { data: 'test' };
      const result = await controller.handleWebhook('valid-token', body);

      expect(prisma.applicationDefinition.findUnique).toHaveBeenCalledWith({
        where: { webhookToken: 'valid-token' },
      });
      expect(workflowService.startWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationDefinitionId: 'def-1',
          inputData: body,
          applicantId: 'system-webhook',
        }),
      );
      expect(result).toEqual({
        message: 'Workflow started successfully',
        applicationId: 'app-1',
        applicationNumber: 1,
      });
    });

    it('should throw NotFoundException if token invalid', async () => {
      mockPrisma.applicationDefinition.findUnique.mockResolvedValue(null);

      await expect(
        controller.handleWebhook('invalid-token', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if definition is not ACTIVE', async () => {
      mockPrisma.applicationDefinition.findUnique.mockResolvedValue({
        id: 'def-1',
        webhookToken: 'token',
        status: 'DRAFT',
      });

      await expect(controller.handleWebhook('token', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
