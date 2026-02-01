import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from './workflow-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { QueueService } from '../queue/queue.service';
import { WorkflowHelperService } from './workflow-helper.service';
import { TeamsService } from '../teams/teams.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;
  let prisma: any;
  let helper: any;

  const mockPrismaService = {
    $transaction: jest.fn(async (callback) => callback(mockPrismaService)),
    applicationDefinition: {
      findUnique: jest.fn(),
    },
    appVersion: {
      findUnique: jest.fn(),
    },
    application: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    approvalHistory: {
      create: jest.fn(),
    },
  };

  const mockUsersService = {
    getUserSnapshotByUsername: jest.fn(),
  };

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  const mockWorkflowHelperService = {
    validateTaskInput: jest.fn(),
    advanceToNextNode: jest.fn(),
  };

  const mockTeamsService = {
    getMyTeams: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: WorkflowHelperService, useValue: mockWorkflowHelperService },
        { provide: TeamsService, useValue: mockTeamsService },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
    prisma = module.get<PrismaService>(PrismaService);
    helper = module.get<WorkflowHelperService>(WorkflowHelperService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startWorkflow', () => {
    it('should start a workflow successfully', async () => {
      const input = {
        applicationDefinitionId: 'app-def-1',
        applicantId: 'user1',
        title: 'New App',
        inputData: {},
      };

      const mockAppDef = {
        id: 'app-def-1',
        status: 'ACTIVE',
        formDefinitionId: 'form-1',
        flowDefinitionId: 'flow-1',
        flowDefinition: {
          nodes: [{ id: 'start-1', type: 'start' }],
          edges: [],
        },
      };

      mockPrismaService.applicationDefinition.findUnique.mockResolvedValue(
        mockAppDef,
      );
      mockPrismaService.appVersion.findUnique.mockResolvedValue(null);

      mockUsersService.getUserSnapshotByUsername.mockResolvedValue({
        username: 'user1',
      });

      mockPrismaService.application.create.mockResolvedValue({
        id: 'app-1',
      });

      mockPrismaService.application.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'IN_PROGRESS',
      });

      const result = await service.startWorkflow(input);

      expect(mockPrismaService.application.create).toHaveBeenCalled();
      expect(helper.advanceToNextNode).toHaveBeenCalledWith('app-1');
      expect(result).toBeDefined();
    });

    it('should throw BadRequest if app definition has no start node', async () => {
      mockPrismaService.applicationDefinition.findUnique.mockResolvedValue({
        id: 'app-def-1',
        status: 'ACTIVE',
        formDefinitionId: 'form-1',
        flowDefinitionId: 'flow-1',
        flowDefinition: {
          nodes: [], // No start node
        },
      });

      await expect(
        service.startWorkflow({
          applicationDefinitionId: 'app-def-1',
          applicantId: 'user1',
          title: 'Fail',
          inputData: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
