import { Test, TestingModule } from '@nestjs/testing';
import { GenericWorker } from './generic.worker';
import { PrismaService } from '../../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { TaskHandlerRegistry } from './task-handler.registry';
import {
  TaskExecuteJob,
  ITaskHandler,
  TaskResult,
} from './task-handler.interface';
import { Logger } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

describe('GenericWorker', () => {
  let worker: GenericWorker;

  const mockPrisma = {
    workflowTask: {
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    workflowTaskHistory: {
      create: jest.fn(),
    },
    application: {
      update: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      return callback(mockPrisma);
    }),
  };

  const mockQueueService = {
    registerHandler: jest.fn(),
    enqueue: jest.fn(),
  };

  const mockRegistry = {
    getHandler: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenericWorker,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueueService },
        { provide: TaskHandlerRegistry, useValue: mockRegistry },
        Logger,
      ],
    }).compile();

    worker = module.get<GenericWorker>(GenericWorker);

    jest.clearAllMocks();
  });

  it('should NOT update status to COMPLETED if shouldAdvance is false', async () => {
    const job: TaskExecuteJob = {
      taskId: 'task-1',
      applicationId: 'app-1',
      nodeId: 'node-1',
      nodeType: 'approval',
      nodeData: {},
      inputData: {},
      applicantId: 'user-1',
    };

    const mockHandler: ITaskHandler = {
      taskType: 'approval',
      execute: jest.fn().mockResolvedValue({
        success: true,
        shouldAdvance: false,
      } as TaskResult),
    };

    mockRegistry.getHandler.mockReturnValue(mockHandler);

    await worker.processJob(job);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockHandler.execute).toHaveBeenCalled();

    // First call is setting RUNNING (updatedAt)
    // Second call is result update
    expect(mockPrisma.workflowTask.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrisma.workflowTask.update.mock.calls[0][0];

    expect(updateArg.where).toEqual({ id: 'task-1' });
    expect(updateArg.data.result).toBeDefined();
    // Verify status is PENDING (reverted/maintained)
    expect(updateArg.data.status).toBe(TaskStatus.PENDING);

    expect(mockQueueService.enqueue).toHaveBeenCalledWith(
      'TASK_COMPLETE',
      expect.objectContaining({
        shouldAdvance: false,
      }),
    );
  });

  it('should update status to COMPLETED if shouldAdvance is true', async () => {
    const job: TaskExecuteJob = {
      taskId: 'task-2',
      applicationId: 'app-1',
      nodeId: 'node-2',
      nodeType: 'apiCall',
      nodeData: {},
      inputData: {},
      applicantId: 'user-1',
    };

    const mockHandler: ITaskHandler = {
      taskType: 'apiCall',
      execute: jest.fn().mockResolvedValue({
        success: true,
        shouldAdvance: true,
      } as TaskResult),
    };

    mockRegistry.getHandler.mockReturnValue(mockHandler);

    await worker.processJob(job);

    expect(mockPrisma.workflowTask.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrisma.workflowTask.update.mock.calls[0][0];

    expect(updateArg.data.status).toBe(TaskStatus.COMPLETED);
  });
});
