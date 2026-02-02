
import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalNodeProcessor } from './approval-node.processor';
import { WorkflowHelperService } from '../workflow-helper.service';
import { NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';

describe('ApprovalNodeProcessor', () => {
  let processor: ApprovalNodeProcessor;
  let helper: WorkflowHelperService;

  const mockHelper = {
    findEnclosingSwimLane: jest.fn(),
    resolveAssignedTo: jest.fn(),
    resolveAssignedToSnapshot: jest.fn(),
    enqueueTask: jest.fn(),
  };

  const mockTx = {
    application: {
      update: jest.fn(),
    },
  } as unknown as Prisma.TransactionClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalNodeProcessor,
        { provide: WorkflowHelperService, useValue: mockHelper },
      ],
    }).compile();

    processor = module.get<ApprovalNodeProcessor>(ApprovalNodeProcessor);
    helper = module.get<WorkflowHelperService>(WorkflowHelperService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should return correct type', () => {
    expect(processor.getType()).toBe('approval');
  });

  describe('process', () => {
    const context: NodeProcessorContext = {
      applicationId: 'app-1',
      nodeId: 'node-1',
      node: {
        id: 'node-1',
        data: {
          assignee: 'user:123',
          assigneeDisplay: 'John Doe',
        },
      },
      inputData: { foo: 'bar' },
      applicantId: 'applicant-1',
      nodes: [],
      edges: [],
    };

    it('should process node with direct assignee', async () => {
      mockHelper.resolveAssignedTo.mockResolvedValue('user-resolved-1');
      mockHelper.resolveAssignedToSnapshot.mockResolvedValue({
        id: 'user-resolved-1',
        firstName: 'John',
        lastName: 'Doe',
        username: 'jdoe',
        email: 'jdoe@example.com',
      });

      await processor.process(context, mockTx);

      expect(mockHelper.resolveAssignedTo).toHaveBeenCalledWith(
        'user:123',
        'applicant-1',
      );
      expect(mockHelper.resolveAssignedToSnapshot).toHaveBeenCalledWith(
        'user-resolved-1',
      );
      expect(mockHelper.enqueueTask).toHaveBeenCalledWith(
        'app-1',
        context.node,
        context.inputData,
        'applicant-1',
        'user-resolved-1',
        'Doe John', // code constructs specific name format from snapshot override
        expect.any(Object),
        mockTx,
      );
      expect(mockTx.application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { currentNodeId: 'node-1' },
      });
    });

    it('should fall back to swimlane assignee if node assignee is missing', async () => {
      const swimlaneContext = {
        ...context,
        node: { id: 'node-1', data: {} }, // No assignee
      };

      const mockSwimlane = {
        id: 'swimlane-1',
        data: { assignee: 'role:admin' },
      };

      mockHelper.findEnclosingSwimLane.mockReturnValue(mockSwimlane);
      mockHelper.resolveAssignedTo.mockResolvedValue('admin-user');
      mockHelper.resolveAssignedToSnapshot.mockResolvedValue({
        id: 'admin-user',
        firstName: 'Admin',
        username: 'admin',
      });

      await processor.process(swimlaneContext, mockTx);

      expect(mockHelper.findEnclosingSwimLane).toHaveBeenCalledWith(
        swimlaneContext.node,
        swimlaneContext.nodes,
      );
      expect(mockHelper.resolveAssignedTo).toHaveBeenCalledWith(
        'role:admin',
        'applicant-1',
      );
      expect(mockHelper.enqueueTask).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'admin-user',
        'Admin', // derived from name parts
        expect.anything(),
        mockTx,
      );
    });

    it('should fallback to username if first/last name missing', async () => {
      const noNameContext = {
        ...context,
        node: { id: 'node-1', data: { assignee: 'user:123' } },
      };

      mockHelper.resolveAssignedTo.mockResolvedValue('user-1');
      mockHelper.resolveAssignedToSnapshot.mockResolvedValue({
        id: 'user-1',
        username: 'username_only',
      });

      await processor.process(noNameContext, mockTx);

      expect(mockHelper.enqueueTask).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'user-1',
        'username_only',
        expect.anything(),
        mockTx,
      );
    });
  });
});
