/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { JoinGatewayProcessor } from './join-node.processor';
import { WorkflowHelperService } from '../workflow-helper.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';

describe('JoinGatewayProcessor', () => {
  let processor: JoinGatewayProcessor;

  const mockHelper = {
    advanceToNextNode: jest.fn(),
  };

  const mockPrismaService = {};

  const mockTx = {
    application: { update: jest.fn() },
  } as unknown as Prisma.TransactionClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JoinGatewayProcessor,
        { provide: WorkflowHelperService, useValue: mockHelper },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    processor = module.get<JoinGatewayProcessor>(JoinGatewayProcessor);

    jest.clearAllMocks();
  });

  const baseContext: NodeProcessorContext = {
    applicationId: 'app-1',
    nodeId: 'node-join',
    node: { id: 'node-join', data: { joinType: 'ALL' } },
    inputData: {},
    applicantId: 'user-1',
    nodes: [],
    edges: [],
    fromNodeId: 'node-A',
  };

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should return correct type', () => {
    expect(processor.getType()).toBe('join');
  });

  describe('Type: ANY', () => {
    it('should pass through immediately', async () => {
      const context = {
        ...baseContext,
        node: { data: { joinType: 'ANY' } },
        edges: [
          { source: 'node-A', target: 'node-join', id: 'e1' },
          { source: 'node-B', target: 'node-join', id: 'e2' },
        ],
      };

      await processor.process(context, mockTx);

      expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
        'app-1',
        'node-join',
      );
    });
  });

  describe('Type: ALL', () => {
    const edges = [
      { source: 'node-A', target: 'node-join', id: 'e1' },
      { source: 'node-B', target: 'node-join', id: 'e2' },
    ];

    it('should wait if not all paths arrived', async () => {
      const context = {
        ...baseContext,
        edges,
        fromNodeId: 'node-A',
        inputData: { _system: { joins: { 'node-join': { arrivedFrom: [] } } } },
      };

      await processor.process(context, mockTx);

      // Verify db update (saving state)
      expect(mockTx.application.update).toHaveBeenCalled();
      const updateArg = (mockTx.application.update as jest.Mock).mock
        .calls[0][0];
      const savedState = updateArg.data.inputData._system.joins['node-join'];

      expect(savedState.arrivedFrom).toContain('node-A');
      expect(mockHelper.advanceToNextNode).not.toHaveBeenCalled();
    });

    it('should advance when all paths arrived', async () => {
      const context = {
        ...baseContext,
        edges,
        fromNodeId: 'node-B',
        inputData: {
          _system: {
            joins: {
              'node-join': { arrivedFrom: ['node-A'] }, // A already arrived
            },
          },
        },
      };

      await processor.process(context, mockTx);

      // Verify state reset and advance
      expect(mockTx.application.update).toHaveBeenCalled();
      const updateArg = (mockTx.application.update as jest.Mock).mock
        .calls[0][0];
      const savedState = updateArg.data.inputData._system.joins['node-join'];

      expect(savedState.arrivedFrom).toHaveLength(0); // Reset

      expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
        'app-1',
        'node-join',
      );
    });

    it('should treat trivial join (single incoming) as pass-through', async () => {
      const context = {
        ...baseContext,
        edges: [{ source: 'node-A', target: 'node-join', id: 'e1' }],
        fromNodeId: 'node-A',
      };

      await processor.process(context, mockTx);

      expect(mockHelper.advanceToNextNode).toHaveBeenCalled();
    });
  });
});
