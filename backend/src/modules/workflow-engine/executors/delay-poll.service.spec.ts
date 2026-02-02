import { Test, TestingModule } from '@nestjs/testing';
import { DelayPollService } from './delay-poll.service';
import { WorkflowHelperService } from '../workflow-helper.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('DelayPollService', () => {
  let service: DelayPollService;

  const mockPrisma = {
    workflowTask: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    workflowTaskHistory: {
      create: jest.fn(),
    },
  };

  const mockHelper = {
    advanceToNextNode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelayPollService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WorkflowHelperService, useValue: mockHelper },
      ],
    }).compile();

    service = module.get<DelayPollService>(DelayPollService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkDelayedTasks', () => {
    it('should calculate pending tasks and resume them', async () => {
      const now = new Date();
      const task = {
        id: 'task-delay-1',
        applicationId: 'app-1',
        stepId: 'node-delay',
        scheduledAt: new Date(now.getTime() - 1000), // Past
      };

      mockPrisma.workflowTask.findMany.mockResolvedValue([task]);
      mockPrisma.workflowTask.updateMany.mockResolvedValue({
        count: 1, // Successfully updated (locked)
      });

      await service.checkDelayedTasks();

      // Should find tasks
      expect(mockPrisma.workflowTask.findMany).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          type: 'delay',
          status: 'PENDING',
        }),
        take: 100,
      });

      // Should update task status (Atomic lock)
      expect(mockPrisma.workflowTask.updateMany).toHaveBeenCalledWith({
        where: { id: task.id, status: 'PENDING' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ status: 'COMPLETED' }),
      });

      // Should create history
      expect(mockPrisma.workflowTaskHistory.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          taskId: task.id,
          status: 'COMPLETED',
        }),
      });

      // Should advance workflow
      expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
        task.applicationId,
        task.stepId,
      );
    });

    it('should NOT resume if another instance picked it up (Optimistic Lock)', async () => {
      const task = { id: 'task-delay-2' };
      mockPrisma.workflowTask.findMany.mockResolvedValue([task]);
      mockPrisma.workflowTask.updateMany.mockResolvedValue({
        count: 0, // Update failed (already changed)
      });

      await service.checkDelayedTasks();

      // Should NOT advance workflow
      expect(mockHelper.advanceToNextNode).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const task = { id: 'task-error' };
      mockPrisma.workflowTask.findMany.mockResolvedValue([task]);
      mockPrisma.workflowTask.updateMany.mockRejectedValue(
        new Error('DB Error'),
      );

      await expect(service.checkDelayedTasks()).resolves.not.toThrow();
      expect(mockHelper.advanceToNextNode).not.toHaveBeenCalled();
    });
  });
});
