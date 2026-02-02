/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceTaskProcessor } from './service-task.processor';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { QueueService } from '../../../queue/queue.service';
import { NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';

describe('ServiceTaskProcessor', () => {
  let processor: ServiceTaskProcessor;

  const mockHelper = {
    enqueueTask: jest.fn(),
  };

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  const mockTx = {
    application: { update: jest.fn() },
    workflowTask: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    approvalHistory: { create: jest.fn() },
  } as unknown as Prisma.TransactionClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceTaskProcessor,
        { provide: WorkflowHelperService, useValue: mockHelper },
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    processor = module.get<ServiceTaskProcessor>(ServiceTaskProcessor);

    jest.clearAllMocks();
  });

  const baseContext: NodeProcessorContext = {
    applicationId: 'app-1',
    nodeId: 'node-service',
    node: { id: 'node-service', type: 'apiCall', data: {} },
    inputData: { foo: 'bar' },
    applicantId: 'user-1',
    nodes: [],
    edges: [],
  };

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should return correct type', () => {
    expect(processor.getType()).toBe('service');
  });

  it('should reuse existing task if found (Retry Logic)', async () => {
    (mockTx.workflowTask.findFirst as jest.Mock).mockResolvedValue({
      id: 'task-1',
      status: 'FAILED',
    });

    await processor.process(baseContext, mockTx);

    // Should update application currentNodeId
    expect(mockTx.application.update).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: { currentNodeId: 'node-service' },
    });

    // Should find existing task
    expect(mockTx.workflowTask.findFirst).toHaveBeenCalled();

    // Should reset failed task
    expect(mockTx.workflowTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'QUEUED',
        retries: { increment: 1 },
      }),
    });

    // Should enqueue existing task
    expect(mockQueueService.enqueue).toHaveBeenCalledWith(
      'TASK_EXECUTE',
      expect.objectContaining({ taskId: 'task-1' }),
    );

    // Should NOT create new history or enqueue new task via helper
    expect(mockTx.approvalHistory.create).not.toHaveBeenCalled();
    expect(mockHelper.enqueueTask).not.toHaveBeenCalled();
  });

  it('should create new task if no existing task', async () => {
    (mockTx.workflowTask.findFirst as jest.Mock).mockResolvedValue(null);

    await processor.process(baseContext, mockTx);

    // Should create history
    expect(mockTx.approvalHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'APICALL', // node.type.toUpperCase()
      }),
    });

    // Should enqueue new task via helper
    expect(mockHelper.enqueueTask).toHaveBeenCalledWith(
      'app-1',
      baseContext.node,
      baseContext.inputData,
      'user-1',
      null,
      null,
      null,
      mockTx,
    );
  });
});
