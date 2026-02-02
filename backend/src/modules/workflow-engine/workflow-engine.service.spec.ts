
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from './workflow-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { QueueService } from '../queue/queue.service';
import { WorkflowHelperService } from './workflow-helper.service';
import { TeamsService } from '../teams/teams.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  applicationDefinition: { findUnique: jest.fn() },
  appVersion: { findUnique: jest.fn() },
  application: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  workflowTask: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  approvalHistory: { create: jest.fn() },
  $transaction: jest.fn((cb) => cb(mockPrisma)),
};
const mockUsersService = {
  getUserSnapshotByUsername: jest.fn(),
  getUserGroupsWithDeptCode: jest.fn(),
};
const mockQueueService = {
  enqueue: jest.fn(),
};
const mockHelperSchema = {
  validateTaskInput: jest.fn(),
  advanceToNextNode: jest.fn(),
};
const mockTeamsService = {
  getMyTeams: jest.fn(),
};

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UsersService, useValue: mockUsersService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: WorkflowHelperService, useValue: mockHelperSchema },
        { provide: TeamsService, useValue: mockTeamsService },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
    jest.clearAllMocks();
  });

  describe('startWorkflow', () => {
    it('should start a workflow successfully', async () => {
      const input = {
        applicationDefinitionId: 'def-1',
        applicantId: 'user-1',
        title: 'New App',
        inputData: { foo: 'bar' },
      };
      const appDef = {
        id: 'def-1',
        status: 'ACTIVE',
        formDefinitionId: 'form-1',
        flowDefinitionId: 'flow-1',
        flowDefinition: { nodes: [{ type: 'start', id: 'start-node' }], edges: [] },
        formDefinition: { schema: {} },
      };

      mockPrisma.applicationDefinition.findUnique.mockResolvedValue(appDef);
      mockPrisma.appVersion.findUnique.mockResolvedValue(null);
      mockUsersService.getUserSnapshotByUsername.mockResolvedValue({ id: 'user-1', name: 'User 1' });
      mockPrisma.application.create.mockResolvedValue({ id: 'app-1' });
      mockPrisma.application.findUnique.mockResolvedValue({ id: 'app-1', status: 'IN_PROGRESS' });

      const result = await service.startWorkflow(input);

      expect(mockHelperSchema.validateTaskInput).toHaveBeenCalled();
      expect(mockPrisma.application.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
            status: 'IN_PROGRESS',
            currentNodeId: 'start-node',
        })
      }));
      expect(mockHelperSchema.advanceToNextNode).toHaveBeenCalledWith('app-1');
      expect(mockQueueService.enqueue).toHaveBeenCalledWith('application-indexing', { applicationId: 'app-1' });
      expect(result).toBeDefined();
    });

    it('should throw if app def not found', async () => {
      mockPrisma.applicationDefinition.findUnique.mockResolvedValue(null);
      await expect(service.startWorkflow({} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('saveDraft', () => {
    it('should save a draft', async () => {
       const input = {
        applicationDefinitionId: 'def-1',
        applicantId: 'user-1',
        title: 'Draft App',
        inputData: {},
      };
      const appDef = {
        id: 'def-1',
        formDefinitionId: 'form-1',
        flowDefinitionId: 'flow-1',
        flowDefinition: { nodes: [{ type: 'start', id: 'start-node' }] },
      };

      mockPrisma.applicationDefinition.findUnique.mockResolvedValue(appDef);
      mockUsersService.getUserSnapshotByUsername.mockResolvedValue({});
      mockPrisma.application.create.mockResolvedValue({ id: 'app-draft' });
      mockPrisma.application.findUnique.mockResolvedValue({ id: 'app-draft' });

      await service.saveDraft(input);

      expect(mockPrisma.application.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({
              status: 'DRAFT',
          })
      }));
    });
  });

  describe('submitDraft', () => {
    it('should submit a draft application', async () => {
        const app = {
            id: 'app-draft',
            status: 'DRAFT',
            flowDefinition: { nodes: [{ type: 'start', id: 'start-node' }] },
            applicantId: 'user-1',
        };
        mockPrisma.application.findUnique.mockResolvedValue(app);
        
        await service.submitDraft('app-draft', { foo: 'bar' });

        expect(mockPrisma.application.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'app-draft', status: 'DRAFT' },
            data: expect.objectContaining({ status: 'IN_PROGRESS' })
        }));
        expect(mockHelperSchema.advanceToNextNode).toHaveBeenCalled();
    });
  });

  describe('completeTask', () => {
      it('should complete a task and advance', async () => {
          const task = {
              id: 'task-1',
              status: 'PENDING',
              type: 'approval',
              applicationId: 'app-1',
              stepId: 'step-1',
              application: { formSchema: {} }
          };
          mockPrisma.workflowTask.findUnique.mockResolvedValue(task);
          mockUsersService.getUserSnapshotByUsername.mockResolvedValue({});

          await service.completeTask({
              taskId: 'task-1',
              action: 'APPROVE',
              actorId: 'user-1',
              inputData: {},
          });

          expect(mockPrisma.workflowTask.update).toHaveBeenCalledWith(expect.objectContaining({
              where: { id: 'task-1', status: 'PENDING' },
              data: expect.objectContaining({ status: 'COMPLETED', result: expect.anything() })
          }));
          expect(mockHelperSchema.advanceToNextNode).toHaveBeenCalledWith('app-1', 'step-1');
      });

      it('should reject a task and update application status', async () => {
           const task = {
              id: 'task-1',
              status: 'PENDING',
              type: 'approval',
              applicationId: 'app-1',
              stepId: 'step-1',
              application: { formSchema: {} }
          };
          mockPrisma.workflowTask.findUnique.mockResolvedValue(task);
          mockPrisma.application.findUnique.mockResolvedValue({
              flowDefinition: { nodes: [{ type: 'end', id: 'end-node' }] }
          });

          await service.completeTask({
              taskId: 'task-1',
              action: 'REJECT',
              actorId: 'user-1',
          });

          expect(mockPrisma.application.update).toHaveBeenCalledWith(expect.objectContaining({
              where: { id: 'app-1' },
              data: expect.objectContaining({ status: 'REJECTED' })
          }));
          expect(mockHelperSchema.advanceToNextNode).not.toHaveBeenCalled();
      });
  });

  describe('cancelApplication', () => {
      it('should cancel application and pending tasks', async () => {
          mockPrisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
          mockUsersService.getUserSnapshotByUsername.mockResolvedValue({});
          
          await service.cancelApplication('app-1', 'user-1');

          expect(mockPrisma.application.update).toHaveBeenCalledWith(expect.objectContaining({
              where: { id: 'app-1' },
              data: expect.objectContaining({ status: 'CANCELED' })
          }));
          expect(mockPrisma.workflowTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({
              where: { 
                  applicationId: 'app-1',
                  status: { in: ['PENDING', 'QUEUED', 'RUNNING'] } 
              },
              data: { status: 'CANCELED' }
          }));
      });
  });
});
