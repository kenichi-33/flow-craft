/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ParallelGatewayProcessor } from './parallel-node.processor';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { QueueService } from '../../../queue/queue.service';
import { NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';

describe('ParallelGatewayProcessor', () => {
  let processor: ParallelGatewayProcessor;

  const mockHelper = {}; // Not used directly in process, but needed for DI

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  const mockTx = {
    application: { update: jest.fn() },
    approvalHistory: { create: jest.fn() },
  } as unknown as Prisma.TransactionClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParallelGatewayProcessor,
        { provide: WorkflowHelperService, useValue: mockHelper },
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    processor = module.get<ParallelGatewayProcessor>(ParallelGatewayProcessor);

    jest.clearAllMocks();
  });

  const baseContext: NodeProcessorContext = {
    applicationId: 'app-1',
    nodeId: 'node-parallel',
    node: { id: 'node-parallel', data: {} },
    inputData: {},
    applicantId: 'user-1',
    nodes: [],
    edges: [],
  };

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should return correct type', () => {
    expect(processor.getType()).toBe('parallel');
  });

  it('should handle no outgoing edges gracefully', async () => {
    const context = { ...baseContext, edges: [] };

    await processor.process(context, mockTx);

    expect(mockQueueService.enqueue).not.toHaveBeenCalled();
  });

  it('should split execution into multiple paths', async () => {
    const context = {
      ...baseContext,
      edges: [
        {
          id: 'edge-1',
          source: 'node-parallel',
          target: 'node-a',
          sourceHandle: 'h1',
        },
        {
          id: 'edge-2',
          source: 'node-parallel',
          target: 'node-b',
          sourceHandle: 'h2',
        },
        // Edge not from this node
        {
          id: 'edge-X',
          source: 'other-node',
          target: 'node-c',
        },
      ],
    };

    await processor.process(context, mockTx);

    // Verify DB updates
    expect(mockTx.application.update).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: { currentNodeId: 'node-parallel' },
    });
    expect(mockTx.approvalHistory.create).toHaveBeenCalled();

    // Verify Queueing
    expect(mockQueueService.enqueue).toHaveBeenCalledTimes(2);

    expect(mockQueueService.enqueue).toHaveBeenCalledWith(
      'WORKFLOW_NODE_PROCESS',
      {
        applicationId: 'app-1',
        targetNodeId: 'node-a',
        fromNodeId: 'node-parallel',
      },
    );

    expect(mockQueueService.enqueue).toHaveBeenCalledWith(
      'WORKFLOW_NODE_PROCESS',
      {
        applicationId: 'app-1',
        targetNodeId: 'node-b',
        fromNodeId: 'node-parallel',
      },
    );
  });
});
