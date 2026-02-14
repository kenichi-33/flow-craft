import { Test, TestingModule } from '@nestjs/testing';
import { AiBranchHandler } from './ai-branch.handler';
import { AiBranchService } from '../../../ai-core/services/ai-branch.service';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { TaskContext } from '../task-handler.interface';

describe('AiBranchHandler', () => {
  let handler: AiBranchHandler;
  let aiBranchService: AiBranchService;
  let workflowHelper: WorkflowHelperService;

  const mockAiBranchService = {
    evaluate: jest.fn(),
  };

  const mockWorkflowHelper = {
    advanceToNextNode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiBranchHandler,
        {
          provide: AiBranchService,
          useValue: mockAiBranchService,
        },
        {
          provide: WorkflowHelperService,
          useValue: mockWorkflowHelper,
        },
      ],
    }).compile();

    handler = module.get<AiBranchHandler>(AiBranchHandler);
    aiBranchService = module.get<AiBranchService>(AiBranchService);
    workflowHelper = module.get<WorkflowHelperService>(WorkflowHelperService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should have correct task type', () => {
    expect(handler.taskType).toBe('aiBranch');
  });

  it('should execute successfully and manual advance to target node', async () => {
    const context: TaskContext = {
      taskId: 'task-1',
      applicationId: 'app-1',
      nodeId: 'node-1',
      nodeType: 'aiBranch',
      nodeData: {
        rules: [
          { id: 'rule-1', label: 'Rule 1', aiCondition: 'cond 1' },
          { id: 'rule-2', label: 'Rule 2', aiCondition: 'cond 2' },
        ],
        edgeMap: {
          'rule-1': 'node-target-1',
        },
        model: 'model-a',
        temperature: 0.7,
      },
      inputData: { field: 100 },
      applicantId: 'user-1',
    };

    mockAiBranchService.evaluate.mockResolvedValue({
      selectedRouteId: 'rule-1',
      reasoning: 'Matches Rule 1',
    });

    const result = await handler.execute(context);

    expect(mockAiBranchService.evaluate).toHaveBeenCalledWith({
      formData: { field: 100 },
      branchRules: [
        { id: 'rule-1', label: 'Rule 1', aiCondition: 'cond 1' },
        { id: 'rule-2', label: 'Rule 2', aiCondition: 'cond 2' },
        {
          id: 'default',
          label: 'その他 (Default)',
          aiCondition: 'If none of the above conditions are met.',
        },
      ],
      model: 'model-a',
      temperature: 0.7,
      provider: undefined,
      apiKey: undefined,
      baseUrl: undefined,
    });

    expect(mockWorkflowHelper.advanceToNextNode).toHaveBeenCalledWith(
      'app-1',
      'node-1',
      'node-target-1',
    );

    expect(result).toEqual({
      success: true,
      outputData: {
        selectedRouteId: 'rule-1',
        reasoning: 'Matches Rule 1',
      },
      manualAdvance: true,
      shouldAdvance: false,
      logs: expect.any(Array),
    });
  });

  it('should return error if no target node found', async () => {
    const context: TaskContext = {
      taskId: 'task-1',
      applicationId: 'app-1',
      nodeId: 'node-1',
      nodeType: 'aiBranch',
      nodeData: {
        rules: [{ id: 'rule-1', label: 'Rule 1', aiCondition: 'cond' }],
        edgeMap: {}, // No mapping
      },
      inputData: {},
      applicantId: 'user-1',
    };

    mockAiBranchService.evaluate.mockResolvedValue({
      selectedRouteId: 'rule-1',
      reasoning: 'Matches Rule 1',
    });

    const result = await handler.execute(context);

    expect(mockWorkflowHelper.advanceToNextNode).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toContain('No target node found');
  });

  it('should handle service errors gracefully', async () => {
    const context: TaskContext = {
      taskId: 'task-1',
      applicationId: 'app-1',
      nodeId: 'node-1',
      nodeType: 'aiBranch',
      nodeData: {},
      inputData: {},
      applicantId: 'user-1',
    };

    mockAiBranchService.evaluate.mockRejectedValue(new Error('AI Failed'));

    const result = await handler.execute(context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('AI Failed');
  });
});
