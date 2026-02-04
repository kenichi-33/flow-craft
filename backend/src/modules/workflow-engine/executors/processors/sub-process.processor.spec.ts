/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { SubProcessProcessor } from './sub-process.processor';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { UsersService } from '../../../users/users.service';

describe('SubProcessProcessor', () => {
  let processor: SubProcessProcessor;

  const mockHelper = {
    substituteVariables: jest.fn(),
    advanceToNextNode: jest.fn(),
  };

  const mockPrismaService = {};

  const mockTx = {
    applicationDefinition: { findUnique: jest.fn() },
    appVersion: { findUnique: jest.fn() },
    application: { create: jest.fn(), update: jest.fn() },
    approvalHistory: { create: jest.fn() },
  } as unknown as Prisma.TransactionClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubProcessProcessor,
        { provide: WorkflowHelperService, useValue: mockHelper },
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: UsersService,
          useValue: { getUserSnapshotByUsername: jest.fn() },
        },
      ],
    }).compile();

    processor = module.get<SubProcessProcessor>(SubProcessProcessor);

    jest.clearAllMocks();
  });

  const baseContext: NodeProcessorContext = {
    applicationId: 'parent-app-1',
    nodeId: 'node-subprocess',
    node: {
      id: 'node-subprocess',
      type: 'subProcess',
      data: {
        applicationDefinitionId: 'child-def-1',
      },
    },
    inputData: { parentVar: 'val' },
    applicantId: 'user-1',
    nodes: [],
    edges: [],
    postCommitActions: [],
  };

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should return correct type', () => {
    expect(processor.getType()).toBe('subProcess');
  });

  it('should create and start a child application', async () => {
    // 1. Mock finding definition
    (mockTx.applicationDefinition.findUnique as jest.Mock).mockResolvedValue({
      id: 'child-def-1',
      version: 1,
      flowDefinitionId: 'flow-def-1',
      formDefinitionId: 'form-def-1',
      name: 'Child App',
      flowDefinition: {
        nodes: [],
        edges: [],
      },
    });

    // 2. Mock finding published version
    (mockTx.appVersion.findUnique as jest.Mock).mockResolvedValue({
      flowNodes: [{ id: 'start-node', type: 'start' }],
      flowEdges: [],
      formSchema: {},
    });

    // 3. Mock creating child app
    (mockTx.application.create as jest.Mock).mockResolvedValue({
      id: 'child-app-new-1',
    });

    // 4. Mock substitute (not used in this simple case but good to mock)
    mockHelper.substituteVariables.mockReturnValue('resolved');

    await processor.process(baseContext, mockTx);

    // Verify Definition Fetch
    expect(mockTx.applicationDefinition.findUnique).toHaveBeenCalledWith({
      where: { id: 'child-def-1' },
      include: expect.any(Object),
    });

    // Verify Child App Creation
    expect(mockTx.application.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationDefinitionId: 'child-def-1',
        parentId: 'parent-app-1', // Linked to parent
        currentNodeId: 'start-node',
        applicantId: 'user-1',
        status: 'IN_PROGRESS',
      }),
    });

    // Verify History (Parent)
    expect(mockTx.approvalHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'parent-app-1',
        action: 'SUB_PROCESS_START',
      }),
    });

    // Verify History (Child Start)
    expect(mockTx.approvalHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'child-app-new-1',
        action: 'START',
      }),
    });

    // Verify Advance Child (Kickstart) - Deferred
    // expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
    //   'child-app-new-1',
    //   'start-node',
    // );
    expect(mockHelper.advanceToNextNode).not.toHaveBeenCalled();
    expect(baseContext.postCommitActions).toHaveLength(1);

    // Run actions
    for (const action of baseContext.postCommitActions!) {
      await action();
    }
    // Verify Parent currentNodeId update
    expect(mockTx.application.update).toHaveBeenCalledWith({
      where: { id: 'parent-app-1' },
      data: { currentNodeId: 'node-subprocess' },
    });

    expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
      'child-app-new-1',
      'start-node',
    );
  });

  it('should handle input mapping', async () => {
    const context = {
      ...baseContext,
      node: {
        ...baseContext.node,
        data: {
          applicationDefinitionId: 'child-def-1',
          inputMapping: { targetField: '{{parentVar}}' },
        },
      },
    };

    (mockTx.applicationDefinition.findUnique as jest.Mock).mockResolvedValue({
      id: 'child-def-1',
      version: 1,
      flowDefinitionId: 'f1',
      formDefinitionId: 'fm1',
      flowDefinition: { nodes: [] },
    });
    (mockTx.appVersion.findUnique as jest.Mock).mockResolvedValue({
      flowNodes: [{ id: 'start', type: 'start' }],
    });
    (mockTx.application.create as jest.Mock).mockResolvedValue({ id: 'c1' });

    // Variable substitution
    mockHelper.substituteVariables.mockImplementation((tmpl) => {
      if (tmpl === '{{parentVar}}') return 'val';
      return tmpl;
    });

    await processor.process(context, mockTx);

    expect(mockTx.application.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inputData: { targetField: 'val' },
      }),
    });
  });

  it('should FAIL if child definition not found', async () => {
    (mockTx.applicationDefinition.findUnique as jest.Mock).mockResolvedValue(
      null,
    );

    await expect(processor.process(baseContext, mockTx)).rejects.toThrow();
  });
});
