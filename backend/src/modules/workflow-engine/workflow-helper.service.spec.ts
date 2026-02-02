import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowHelperService } from './workflow-helper.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { UsersService } from '../users/users.service';

const mockPrisma = {
  workflowTask: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
};
const mockQueueService = {
  enqueue: jest.fn(),
};
const mockUsersService = {
  getManager: jest.fn(),
  getUserSnapshot: jest.fn(),
  getUserSnapshotByUsername: jest.fn(),
};

describe('WorkflowHelperService', () => {
  let service: WorkflowHelperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowHelperService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueueService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<WorkflowHelperService>(WorkflowHelperService);
    jest.clearAllMocks();
  });

  describe('evaluateStructuredCondition', () => {
    it('should evaluate eq correctly', () => {
      expect(
        service.evaluateStructuredCondition(
          { fieldId: 'f1', operator: 'eq', value: '10' },
          { f1: '10' },
        ),
      ).toBe(true);
      expect(
        service.evaluateStructuredCondition(
          { fieldId: 'f1', operator: 'eq', value: '10' },
          { f1: '20' },
        ),
      ).toBe(false);
    });

    it('should evaluate custom operators like empty', () => {
      expect(
        service.evaluateStructuredCondition(
          { fieldId: 'f1', operator: 'empty' },
          { f1: '' },
        ),
      ).toBe(true);
      expect(
        service.evaluateStructuredCondition(
          { fieldId: 'f1', operator: 'not_empty' },
          { f1: 'val' },
        ),
      ).toBe(true);
    });
  });

  describe('substituteVariables', () => {
    it('should replace {{nested.path}}', () => {
      const data = { nested: { path: 'value' } };
      expect(service.substituteVariables('Key is {{nested.path}}', data)).toBe(
        'Key is value',
      );
    });

    it('should keep unsubstituted vars', () => {
      expect(service.substituteVariables('{{missing}}', {})).toBe(
        '{{missing}}',
      );
    });
  });

  describe('enqueueTask', () => {
    it('should create new task and enqueue job', async () => {
      mockPrisma.workflowTask.findFirst.mockResolvedValue(null);
      mockPrisma.workflowTask.create.mockResolvedValue({ id: 'task-1' });

      await service.enqueueTask(
        'app-1',
        { id: 'node-1', type: 'userTask', data: {} },
        {},
        'user-1',
      );

      expect(mockPrisma.workflowTask.create).toHaveBeenCalled();
      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        'TASK_EXECUTE',
        expect.objectContaining({ taskId: 'task-1' }),
        expect.anything(),
      );
    });

    it('should reuse failed task', async () => {
      mockPrisma.workflowTask.findFirst.mockResolvedValue({
        id: 'task-1',
        status: 'FAILED',
      });

      await service.enqueueTask(
        'app-1',
        { id: 'node-1', type: 'userTask', data: {} },
        {},
        'user-1',
      );

      expect(mockPrisma.workflowTask.update).toHaveBeenCalled();
      expect(mockPrisma.workflowTask.create).not.toHaveBeenCalled();
      expect(mockQueueService.enqueue).toHaveBeenCalled();
    });
  });
});
