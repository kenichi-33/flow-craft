import { Test, TestingModule } from '@nestjs/testing';
import { UpdateRecordHandler } from './update-record.handler';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TaskContext } from '../task-handler.interface';

describe('UpdateRecordHandler', () => {
  let handler: UpdateRecordHandler;
  let helper: WorkflowHelperService;
  let prisma: PrismaService;

  const mockHelper = {
    substituteVariables: jest.fn(),
  };

  const mockPrisma = {
    application: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateRecordHandler,
        { provide: WorkflowHelperService, useValue: mockHelper },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get<UpdateRecordHandler>(UpdateRecordHandler);
    helper = module.get<WorkflowHelperService>(WorkflowHelperService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  const baseContext: TaskContext = {
    taskId: 'task-1',
    nodeId: 'node-1',
    applicationId: 'app-1',
    applicantId: 'user-1',
    nodeData: {
      updates: [{ key: 'field1', value: 'value1' }],
    },
    inputData: {
      existing: 'data',
    },
  };

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should update application input data', async () => {
    mockHelper.substituteVariables.mockImplementation((val) => val); // pass through
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 'app-1',
      inputData: { existing: 'data' },
    });
    mockPrisma.application.update.mockResolvedValue({ id: 'app-1' });

    const result = await handler.execute(baseContext);

    expect(helper.substituteVariables).toHaveBeenCalledWith(
      'value1',
      expect.anything(),
    );
    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: {
        inputData: {
          existing: 'data',
          field1: 'value1',
        },
      },
    });
    expect(result.success).toBe(true);
    expect(result.outputData).toEqual({ field1: 'value1' });
  });

  it('should fail if application not found', async () => {
    mockPrisma.application.findUnique.mockResolvedValue(null);

    const result = await handler.execute(baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Application app-1 not found');
  });

  it('should handle complex variable substitution', async () => {
    const context = {
      ...baseContext,
      nodeData: {
        updates: [{ key: 'status', value: '{{input.status}}' }],
      },
    };

    mockHelper.substituteVariables.mockImplementation((val, data) => {
        if (val === '{{input.status}}') return 'APPROVED';
        return val;
    });
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 'app-1',
      inputData: {},
    });

    await handler.execute(context);

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { inputData: { status: 'APPROVED' } },
      }),
    );
  });
});
