/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { EndNodeProcessor } from './end-node.processor';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';

describe('EndNodeProcessor', () => {
  let processor: EndNodeProcessor;

  const mockHelper = {
    substituteVariables: jest.fn(),
    advanceToNextNode: jest.fn(),
  };

  const mockTx = {
    application: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    approvalHistory: { create: jest.fn() },
  } as unknown as Prisma.TransactionClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EndNodeProcessor,
        { provide: WorkflowHelperService, useValue: mockHelper },
      ],
    }).compile();

    processor = module.get<EndNodeProcessor>(EndNodeProcessor);

    jest.clearAllMocks();
  });

  const baseContext: NodeProcessorContext = {
    applicationId: 'app-1',
    nodeId: 'node-end',
    node: { id: 'node-end', data: {} },
    inputData: {},
    applicantId: 'user-1',
    nodes: [],
    edges: [],
    postCommitActions: [],
  };

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should return correct type', () => {
    expect(processor.getType()).toBe('end');
  });

  it('should complete application with default status', async () => {
    (mockTx.application.findUnique as jest.Mock).mockResolvedValue({
      id: 'app-1',
      flowDefinition: {},
    });

    await processor.process(baseContext, mockTx);

    expect(mockTx.application.update).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: { status: 'APPROVED', currentNodeId: 'node-end' },
    });
    expect(mockTx.approvalHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'APPLICATION_COMPLETE' }),
    });
  });

  it('should handle sub-process completion and parent resumption', async () => {
    // Current App (Child)
    (mockTx.application.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'child-app-1',
        parentId: 'parent-app-1',
        inputData: { childResult: 'OK' },
        status: 'APPROVED',
      })
      // Parent App
      .mockResolvedValueOnce({
        id: 'parent-app-1',
        currentNodeId: 'node-subprocess',
        inputData: { existing: 'val' },
        flowDefinition: {
          nodes: [
            {
              id: 'node-subprocess',
              type: 'subProcess',
              data: {
                outputMapping: {
                  parentTarget: '{{child.inputData.childResult}}',
                },
              },
            },
          ],
        },
      });

    mockHelper.substituteVariables.mockReturnValue('OK');

    const context = { ...baseContext, applicationId: 'child-app-1' };

    await processor.process(context, mockTx);

    // Verify Child Update
    expect(mockTx.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'child-app-1' } }),
    );

    // Verify Parent Update (Output Mapping)
    expect(mockHelper.substituteVariables).toHaveBeenCalled();
    expect(mockTx.application.update).toHaveBeenCalledWith({
      where: { id: 'parent-app-1' },
      data: {
        inputData: { existing: 'val', parentTarget: 'OK' },
      },
    });

    // Verify Log in Parent
    expect(mockTx.approvalHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'parent-app-1',
        action: 'SUB_PROCESS_END',
      }),
    });

    // Verify Parent Resumption
    // Verify Parent Resumption (Deferred)
    expect(mockHelper.advanceToNextNode).not.toHaveBeenCalled();
    expect(context.postCommitActions).toHaveLength(1);

    // Execute actions
    for (const action of context.postCommitActions!) {
      await action();
    }
    expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
      'parent-app-1',
      'node-subprocess',
    );
  });
});
