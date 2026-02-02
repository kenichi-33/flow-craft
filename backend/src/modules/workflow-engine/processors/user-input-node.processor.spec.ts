import { Test, TestingModule } from '@nestjs/testing';
import { UserInputNodeProcessor } from './user-input-node.processor';
import { WorkflowHelperService } from '../workflow-helper.service';
import { NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';

describe('UserInputNodeProcessor', () => {
  let processor: UserInputNodeProcessor;

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
        UserInputNodeProcessor,
        { provide: WorkflowHelperService, useValue: mockHelper },
      ],
    }).compile();

    processor = module.get<UserInputNodeProcessor>(UserInputNodeProcessor);

    jest.clearAllMocks();
  });

  const baseContext: NodeProcessorContext = {
    applicationId: 'app-1',
    nodeId: 'node-input',
    node: { id: 'node-input', data: {} },
    inputData: {},
    applicantId: 'applicant-1',
    nodes: [],
    edges: [],
  };

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should return correct type', () => {
    expect(processor.getType()).toBe('userInput');
  });

  it('should assign to applicant by default if no assignee/swimlane', async () => {
    mockHelper.findEnclosingSwimLane.mockReturnValue(null);
    mockHelper.resolveAssignedTo.mockResolvedValue('applicant-1');
    mockHelper.resolveAssignedToSnapshot.mockResolvedValue({
      id: 'applicant-1',
      username: 'app_user',
    });

    await processor.process(baseContext, mockTx);

    // Default 'applicant' was passed to resolveAssignedTo?
    // Code: let assignee = ... || 'applicant'. Then resolve(assignee).
    expect(mockHelper.resolveAssignedTo).toHaveBeenCalledWith(
      'applicant', // The string literal default
      'applicant-1',
    );
    expect(mockHelper.enqueueTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'applicant-1',
      'app_user',
      expect.anything(),
      mockTx,
    );
  });

  it('should override default with swimlane assignee', async () => {
    mockHelper.findEnclosingSwimLane.mockReturnValue({
      data: { assignee: 'role:manager' },
    });
    mockHelper.resolveAssignedTo.mockResolvedValue('manager-1');
    mockHelper.resolveAssignedToSnapshot.mockResolvedValue({
      id: 'manager-1',
      username: 'mgr',
    });

    await processor.process(baseContext, mockTx);

    expect(mockHelper.resolveAssignedTo).toHaveBeenCalledWith(
      'role:manager',
      'applicant-1',
    );
  });

  it('should use explicit assignee if provided', async () => {
    const context = {
      ...baseContext,
      node: { data: { assignee: 'user:specific' } },
    };

    mockHelper.resolveAssignedTo.mockResolvedValue('user-specific');
    mockHelper.resolveAssignedToSnapshot.mockResolvedValue({
      firstName: 'Specific',
      lastName: 'User',
    });

    await processor.process(context, mockTx);

    expect(mockHelper.findEnclosingSwimLane).not.toHaveBeenCalled(); // Should assume not called if explicitly set?
    // Actually code checks `if (!node.data?.assignee)`. Here it IS present.
    // So findEnclosingSwimLane check is skipped?
    // Let's verify expectations based on code reading.
    // Yes, line 27: if (!node.data?.assignee) ...

    expect(mockHelper.resolveAssignedTo).toHaveBeenCalledWith(
      'user:specific',
      'applicant-1',
    );

    // Name Formatting
    expect(mockHelper.enqueueTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'user-specific',
      'User Specific',
      expect.anything(),
      mockTx,
    );
  });
});
