import { Test, TestingModule } from '@nestjs/testing';
import { AiBranchNodeProcessor } from './ai-branch-node.processor';
import { QueueService } from '../../../queue/queue.service';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { NodeProcessorContext } from './node-processor.interface';

describe('AiBranchNodeProcessor', () => {
  let processor: AiBranchNodeProcessor;
  let workflowHelper: WorkflowHelperService;

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  const mockWorkflowHelper = {
    enqueueTask: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiBranchNodeProcessor,
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: WorkflowHelperService,
          useValue: mockWorkflowHelper,
        },
      ],
    }).compile();

    processor = module.get<AiBranchNodeProcessor>(AiBranchNodeProcessor);
    workflowHelper = module.get<WorkflowHelperService>(WorkflowHelperService);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should return correct type', () => {
    expect(processor.getType()).toBe('aiBranch');
  });

  it('should enqueue a task via WorkflowHelper', async () => {
    const context: NodeProcessorContext = {
      applicationId: 'app-1',
      nodeId: 'node-1',
      node: {
        id: 'node-1',
        type: 'aiBranch',
        data: {
          rules: [
            { id: 'rule-1', label: 'Rule 1', aiCondition: 'cond 1' },
          ],
        },
      },
      inputData: { field1: 'value1' },
      edges: [
        { source: 'node-1', sourceHandle: 'rule-1', target: 'node-2' },
        { source: 'node-1', sourceHandle: 'default', target: 'node-3' },
      ],
      nodes: [],
      applicantId: 'user-1',
    };

    const tx = {} as any; // Prisma mock not needed for this test

    await processor.process(context, tx);

    expect(mockWorkflowHelper.enqueueTask).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        id: 'node-1',
        type: 'aiBranch', 
        data: expect.objectContaining({
          rules: expect.any(Array),
          edgeMap: {
            'rule-1': 'node-2',
            'default': 'node-3',
          }
        })
      }),
      { field1: 'value1' },
      'system'
    );
  });
});
