import { Test, TestingModule } from '@nestjs/testing';
import { SetVariableHandler } from './set-variable.handler';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TaskContext } from '../task-handler.interface';

describe('SetVariableHandler', () => {
  let handler: SetVariableHandler;

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
        SetVariableHandler,
        { provide: WorkflowHelperService, useValue: mockHelper },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get<SetVariableHandler>(SetVariableHandler);
    handler = module.get<SetVariableHandler>(SetVariableHandler);

    jest.clearAllMocks();
  });

  const baseContext: TaskContext = {
    taskId: 'task-1',
    nodeId: 'node-1',
    nodeType: 'setVariable',
    applicationId: 'app-1',
    applicantId: 'user-1',
    nodeData: {
      variables: [{ key: 'newVar', value: 'newValue' }],
    },
    inputData: { existing: 1 },
  };

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should set variables and update application', async () => {
    mockHelper.substituteVariables.mockImplementation((val) => val);
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 'app-1',
      inputData: { existing: 1 },
    });
    mockPrisma.application.update.mockResolvedValue({ id: 'app-1' });

    const result = await handler.execute(baseContext);

    expect(mockPrisma.application.update).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: {
        inputData: { existing: 1, newVar: 'newValue' },
      },
    });
    expect(result.success).toBe(true);
    expect(result.outputData).toEqual({ newVar: 'newValue' });
  });

  it('should fail if application not found', async () => {
    mockPrisma.application.findUnique.mockResolvedValue(null);
    const result = await handler.execute(baseContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Application app-1 not found');
  });
});
