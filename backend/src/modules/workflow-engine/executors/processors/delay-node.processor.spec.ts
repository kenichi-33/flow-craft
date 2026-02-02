/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { DelayNodeProcessor } from './delay-node.processor';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';

describe('DelayNodeProcessor', () => {
  let processor: DelayNodeProcessor;

  const mockHelper = {}; // Not used

  const mockTx = {
    workflowTask: { create: jest.fn() },
    approvalHistory: { create: jest.fn() },
  } as unknown as Prisma.TransactionClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelayNodeProcessor,
        { provide: WorkflowHelperService, useValue: mockHelper },
      ],
    }).compile();

    processor = module.get<DelayNodeProcessor>(DelayNodeProcessor);

    jest.clearAllMocks();
  });

  const baseContext: NodeProcessorContext = {
    applicationId: 'app-1',
    nodeId: 'node-delay',
    node: { id: 'node-delay', data: { delayType: 'duration', value: 10 } },
    inputData: {},
    applicantId: 'user-1',
    nodes: [],
    edges: [{ id: 'e1', source: 'node-delay', target: 'next-node' }],
  };

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should schedule delay task (Duration)', async () => {
    const now = new Date('2025-01-01T10:00:00Z');
    jest.useFakeTimers().setSystemTime(now);

    const context = {
      ...baseContext,
      node: {
        id: 'node-delay',
        data: { delayType: 'duration', value: '30' }, // 30 mins
      },
    };

    await processor.process(context, mockTx);

    expect(mockTx.workflowTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'app-1',
        stepId: 'node-delay',
        type: 'delay',
        status: 'PENDING',
        scheduledAt: new Date('2025-01-01T10:30:00Z'), // 10:00 + 30m
      }),
    });

    jest.useRealTimers();
  });

  it('should schedule delay task (Fixed)', async () => {
    const fixedDate = '2025-12-31T23:59:59.000Z';
    const context = {
      ...baseContext,
      node: {
        id: 'node-delay',
        data: { delayType: 'fixed', value: fixedDate },
      },
    };

    await processor.process(context, mockTx);

    expect(mockTx.workflowTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scheduledAt: new Date(fixedDate),
      }),
    });
  });

  it('should warn and do nothing if no next node', async () => {
    const context = { ...baseContext, edges: [] };

    await processor.process(context, mockTx);

    expect(mockTx.workflowTask.create).not.toHaveBeenCalled();
  });
});
