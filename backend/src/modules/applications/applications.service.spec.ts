import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { QueueService } from '../queue/queue.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { CreateApplicationDto } from './dto/create-application.dto';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  // let prisma: any; // Unused
  let queueService: any;
  let usersService: any;

  const mockPrismaService = {
    $transaction: jest.fn(async (callback) => callback(mockPrismaService)),
    application: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    applicationDefinition: {
      findUnique: jest.fn(),
    },
    appVersion: {
      findFirst: jest.fn(),
    },
    formDefinition: {
      findUnique: jest.fn(),
    },
    file: {
      updateMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockUsersService = {
    getUserSnapshotByUsername: jest.fn(),
  };

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  const mockWorkflowEngineService = {
    canUserExecuteTask: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: WorkflowEngineService, useValue: mockWorkflowEngineService },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    // prisma = module.get<PrismaService>(PrismaService);
    queueService = module.get<QueueService>(QueueService);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an application and trigger indexing', async () => {
      const dto: CreateApplicationDto = {
        title: 'Test App',
        applicationDefinitionId: 'app-def-1',
        formDefinitionId: 'form-def-1',
        flowDefinitionId: 'flow-def-1',
        inputData: { field1: 'value1' },
        applicantId: 'user1',
      };

      usersService.getUserSnapshotByUsername.mockResolvedValue({
        username: 'user1',
        type: 'user',
      });

      mockPrismaService.applicationDefinition.findUnique.mockResolvedValue({
        id: 'app-def-1',
        status: 'ACTIVE',
        formDefinitionId: 'form-def-1',
        flowDefinitionId: 'flow-def-1',
      });

      mockPrismaService.appVersion.findFirst.mockResolvedValue(null); // No version, fallback to def

      mockPrismaService.application.create.mockResolvedValue({
        id: 'app-1',
        status: 'DRAFT',
      });

      mockPrismaService.formDefinition.findUnique.mockResolvedValue({
        id: 'form-def-1',
        schema: { properties: {} },
      });

      const result = await service.create(dto);

      expect(result).toEqual({ id: 'app-1', status: 'DRAFT' });
      expect(mockPrismaService.application.create).toHaveBeenCalled();
      expect(queueService.enqueue).toHaveBeenCalledWith(
        'application-indexing',
        {
          applicationId: 'app-1',
        },
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockPrismaService.application.findMany.mockResolvedValue([
        { id: 'app-1' },
      ]);
      mockPrismaService.application.count.mockResolvedValue(1);

      const result = (await service.findAll({ page: 1, limit: 10 })) as any;

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(mockPrismaService.application.findMany).toHaveBeenCalled();
    });
  });
});
