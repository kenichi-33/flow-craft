/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BranchNodeProcessor } from './branch-node.processor';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';

describe('BranchNodeProcessor', () => {
  let processor: BranchNodeProcessor;

  const mockHelper = {
    evaluateCondition: jest.fn(),
    advanceToNextNode: jest.fn(),
  };

  const mockTx = {
    application: { update: jest.fn() },
    approvalHistory: { create: jest.fn() },
  } as unknown as Prisma.TransactionClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchNodeProcessor,
        { provide: WorkflowHelperService, useValue: mockHelper },
      ],
    }).compile();

    processor = module.get<BranchNodeProcessor>(BranchNodeProcessor);

    jest.clearAllMocks();
  });

  const baseContext: NodeProcessorContext = {
    applicationId: 'app-1',
    nodeId: 'node-branch',
    node: { id: 'node-branch', data: {} },
    inputData: { amount: 100, category: 'A' },
    applicantId: 'user-1',
    nodes: [],
    edges: [
      {
        id: 'edge-yes',
        source: 'node-branch',
        target: 'node-yes',
        sourceHandle: 'yes',
      },
      {
        id: 'edge-no',
        source: 'node-branch',
        target: 'node-no',
        sourceHandle: 'no',
      },
      {
        id: 'edge-default',
        source: 'node-branch',
        target: 'node-default',
        data: { isDefault: true },
      },
    ],
  };

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should return correct type', () => {
    expect(processor.getType()).toBe('branch');
  });

  describe('Advanced Conditions', () => {
    it('should evaluate AND logic (True)', async () => {
      const context = {
        ...baseContext,
        node: {
          ...baseContext.node,
          data: {
            conditions: [
              { field: 'amount', operator: '>=', value: 50 },
              { field: 'category', operator: '==', value: 'A' },
            ],
            conditionLogic: 'and',
          },
        },
      };

      await processor.process(context, mockTx);

      expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
        'app-1',
        'node-branch',
        'node-yes',
      );
      expect(mockTx.application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { currentNodeId: 'node-yes' },
      });
    });

    it('should evaluate AND logic (False)', async () => {
      const context = {
        ...baseContext,
        node: {
          ...baseContext.node,
          data: {
            conditions: [
              { field: 'amount', operator: '>=', value: 50 },
              { field: 'category', operator: '==', value: 'B' }, // False
            ],
            conditionLogic: 'and',
          },
        },
      };

      await processor.process(context, mockTx);

      expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
        'app-1',
        'node-branch',
        'node-no',
      );
    });

    it('should evaluate OR logic (True)', async () => {
      const context = {
        ...baseContext,
        node: {
          ...baseContext.node,
          data: {
            conditions: [
              { field: 'amount', operator: '>', value: 1000 }, // False
              { field: 'category', operator: '==', value: 'A' }, // True
            ],
            conditionLogic: 'or',
          },
        },
      };

      await processor.process(context, mockTx);

      expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
        'app-1',
        'node-branch',
        'node-yes',
      );
    });
  });

  describe('Legacy Single Condition', () => {
    it('should evaluate single condition (True)', async () => {
      const context = {
        ...baseContext,
        node: {
          ...baseContext.node,
          data: {
            conditionField: 'amount',
            conditionOperator: '==',
            conditionValue: 100,
          },
        },
      };

      await processor.process(context, mockTx);

      expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
        'app-1',
        'node-branch',
        'node-yes',
      );
    });

    it('should evaluate single condition (False)', async () => {
      const context = {
        ...baseContext,
        node: {
          ...baseContext.node,
          data: {
            conditionField: 'amount',
            conditionOperator: '>',
            conditionValue: 200,
          },
        },
      };

      await processor.process(context, mockTx);

      expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
        'app-1',
        'node-branch',
        'node-no',
      );
    });
  });

  describe('Edge-based Conditions', () => {
    it('should evaluate edge condition', async () => {
      // Setup edge with condition
      const edgeContext = {
        ...baseContext,
        node: { id: 'node-branch', data: {} }, // No node conditions
        edges: [
          {
            id: 'edge-cond',
            source: 'node-branch',
            target: 'node-target-1',
            data: { condition: 'x > 5' },
          },
          {
            id: 'edge-default',
            source: 'node-branch',
            target: 'node-default',
            data: { isDefault: true },
          },
        ],
      };

      mockHelper.evaluateCondition.mockReturnValue(true);

      await processor.process(edgeContext, mockTx);

      expect(mockHelper.evaluateCondition).toHaveBeenCalledWith(
        baseContext.inputData,
        'x > 5',
      );
      expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
        'app-1',
        'node-branch',
        'node-target-1',
      );
    });

    it('should fallback to default edge', async () => {
      const edgeContext = {
        ...baseContext,
        node: { id: 'node-branch', data: {} },
        edges: [
          {
            id: 'edge-cond',
            source: 'node-branch',
            target: 'node-target-1',
            data: { condition: 'x > 5' },
          },
          {
            id: 'edge-default',
            source: 'node-branch',
            target: 'node-default',
            data: { isDefault: true },
          },
        ],
      };

      mockHelper.evaluateCondition.mockReturnValue(false); // Condition fails

      await processor.process(edgeContext, mockTx);

      expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
        'app-1',
        'node-branch',
        'node-default',
      );
    });
  });
});
