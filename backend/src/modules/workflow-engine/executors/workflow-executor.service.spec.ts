import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowExecutorService } from './workflow-executor.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailService } from '../../notifications/mail.service';
import { UsersService } from '../../users/users.service';
import { QueueService } from '../../queue/queue.service';
import { NodeProcessorRegistry } from './processors/node-processor.registry';
import { WorkflowHelperService } from '../workflow-helper.service';

const mockPrisma = {
  workflowTask: { findUnique: jest.fn() },
  application: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn((cb) => cb(mockPrisma)),
};
const mockMailService = {
  sendSlaBreachNotification: jest.fn(),
  sendTaskReminder: jest.fn(),
};
const mockUsersService = {
  getUserSnapshotByUsername: jest.fn(),
};
const mockQueueService = {
  registerHandler: jest.fn(),
  enqueue: jest.fn(),
};
const mockRegistry = {
  getProcessor: jest.fn(),
};
const mockHelper = {
  advanceToNextNode: jest.fn(),
};

describe('WorkflowExecutorService', () => {
  let service: WorkflowExecutorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowExecutorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: NodeProcessorRegistry, useValue: mockRegistry },
        { provide: WorkflowHelperService, useValue: mockHelper },
      ],
    }).compile();

    service = module.get<WorkflowExecutorService>(WorkflowExecutorService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should register job handlers', async () => {
      await service.onModuleInit();
      expect(mockQueueService.registerHandler).toHaveBeenCalledTimes(4);
    });
  });

  describe('handleTaskComplete', () => {
    it('should advance to next node on success', async () => {
      await service.handleTaskComplete({
        taskId: 't1',
        applicationId: 'a1',
        success: true,
        shouldAdvance: true,
        nodeId: 'n1',
      });
      expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
        'a1',
        undefined,
      );
    });

    it('should not advance on failure', async () => {
      await service.handleTaskComplete({
        taskId: 't1',
        applicationId: 'a1',
        success: false,
        shouldAdvance: true,
        nodeId: 'n1',
        error: 'err',
      });
      expect(mockHelper.advanceToNextNode).not.toHaveBeenCalled();
    });
  });

  describe('handleSlaBreach', () => {
    it('should send notification via email', async () => {
      mockPrisma.workflowTask.findUnique.mockResolvedValue({
        id: 't1',
        status: 'PENDING',
        assignedTo: 'user:test',
        application: { id: 'a1' },
      });
      mockUsersService.getUserSnapshotByUsername.mockResolvedValue({
        email: 'test@example.com',
      });

      await service.handleSlaBreach({ taskId: 't1' });

      expect(mockMailService.sendSlaBreachNotification).toHaveBeenCalledWith(
        'test@example.com',
        expect.anything(),
        expect.anything(),
      );
    });

    it('should skip if task is not PENDING', async () => {
      mockPrisma.workflowTask.findUnique.mockResolvedValue({
        id: 't1',
        status: 'COMPLETED',
      });
      await service.handleSlaBreach({ taskId: 't1' });
      expect(mockMailService.sendSlaBreachNotification).not.toHaveBeenCalled();
    });
  });
});
