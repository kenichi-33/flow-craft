import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationRecoveryService } from './application-recovery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

describe('ApplicationRecoveryService', () => {
  let service: ApplicationRecoveryService;

  const mockPrisma = {
    application: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workflowTask: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationRecoveryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    service = module.get<ApplicationRecoveryService>(
      ApplicationRecoveryService,
    );

    jest.clearAllMocks();
    mockPrisma.application.findMany.mockResolvedValue([]);
    mockPrisma.workflowTask.findMany.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleRecovery', () => {
    it('should recover stuck RUNNING tasks (timeout)', async () => {
      // Mock stuck running tasks
      mockPrisma.workflowTask.findMany
        .mockResolvedValueOnce([
          { id: 't1', status: 'RUNNING', workerId: 'w1' },
        ]) // stuckRunningTasks
        .mockResolvedValueOnce([]); // stuckQueuedTasks

      await service.handleRecovery();

      expect(mockPrisma.workflowTask.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
    });

    it('should respect custom task timeout configuration', async () => {
      // Task with 1 hour timeout, running for 20 mins (should be skipped)
      const longRunningTask = {
        id: 't-long',
        status: 'RUNNING',
        workerId: 'w1',
        updatedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 mins ago
        config: { timeout: 3600000 }, // 1 hour
      };

      // Task with 1 minute timeout, running for 10 mins (should be killed)
      const timedOutTask = {
        id: 't-timedout',
        status: 'RUNNING',
        workerId: 'w2',
        updatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
        config: { timeout: 60000 }, // 1 min (threshold ~6 mins with buffer)
      };

      mockPrisma.workflowTask.findMany
        .mockResolvedValueOnce([longRunningTask, timedOutTask])
        .mockResolvedValueOnce([]);

      await service.handleRecovery();

      // Long running task should NOT be updated
      expect(mockPrisma.workflowTask.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 't-long' } }),
      );

      // Timed out task SHOULD be updated
      expect(mockPrisma.workflowTask.update).toHaveBeenCalledWith({
        where: { id: 't-timedout' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
    });

    it('should recover stuck QUEUED tasks (message lost)', async () => {
      mockPrisma.workflowTask.findMany
        .mockResolvedValueOnce([]) // stuckRunningTasks
        .mockResolvedValueOnce([
          { id: 't2', status: 'QUEUED', retries: 0, applicationId: 'app1' },
        ]); // stuckQueuedTasks

      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app1',
        inputData: {},
        applicantId: 'u1',
      });

      await service.handleRecovery();

      // Should re-enqueue
      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        'TASK_EXECUTE',
        expect.anything(),
        expect.anything(),
      );

      // Should increment retries
      expect(mockPrisma.workflowTask.update).toHaveBeenCalledWith({
        where: { id: 't2' },
        data: expect.objectContaining({ retries: { increment: 1 } }),
      });
    });

    it('should FAIL stuck QUEUED tasks if max retries exceeded', async () => {
      mockPrisma.workflowTask.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 't3', status: 'QUEUED', retries: 5 }, // Max retries
        ]);

      await service.handleRecovery();

      expect(mockPrisma.workflowTask.update).toHaveBeenCalledWith({
        where: { id: 't3' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });

      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });

    it('should ignore stuck QUEUED tasks if Application not found', async () => {
      mockPrisma.workflowTask.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 't4', status: 'QUEUED', applicationId: 'missing-app' },
        ]);

      mockPrisma.application.findUnique.mockResolvedValue(null);

      await service.handleRecovery();

      // No update, just skip/log
      expect(mockPrisma.workflowTask.update).not.toHaveBeenCalled();
    });

    it('should recover stuck IN_PROGRESS applications', async () => {
      // Mock stuck app
      const stuckApp = {
        id: 'app-stuck',
        status: 'IN_PROGRESS',
        currentNodeId: 'node-1',
        workflowTasks: [], // No tasks active or failed
      };

      mockPrisma.application.findMany.mockResolvedValue([stuckApp]);
      mockPrisma.workflowTask.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.handleRecovery();

      // Should enqueue WORKFLOW_NODE_PROCESS
      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        'WORKFLOW_NODE_PROCESS',
        {
          applicationId: 'app-stuck',
          targetNodeId: 'node-1',
        },
      );

      expect(mockPrisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-stuck' },
        data: expect.anything(),
      });
    });

    it('should SKIP recovery if Application has FAILED tasks (retrying)', async () => {
      const wTask = { id: 't-fail', status: 'FAILED', stepId: 'node-1' };
      const stuckApp = {
        id: 'app-skip',
        status: 'IN_PROGRESS',
        currentNodeId: 'node-1',
        workflowTasks: [wTask], // Has a failed task in current Step
      };

      mockPrisma.application.findMany.mockResolvedValue([stuckApp]);
      mockPrisma.workflowTask.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.handleRecovery();

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        'WORKFLOW_NODE_PROCESS',
        expect.anything(),
      );
    });

    it('should SKIP recovery if Application has exceeded max retries on failed tasks', async () => {
      // Unused variable failedApp removed
      mockPrisma.application.findMany.mockResolvedValue([
        {
          id: 'app-failed',
          status: 'IN_PROGRESS',
          currentNodeId: 'node-1',
          workflowTasks: [{ stepId: 'node-1', status: 'FAILED', retries: 5 }],
        },
      ]);
      mockPrisma.workflowTask.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.handleRecovery();

      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });
  });
});
