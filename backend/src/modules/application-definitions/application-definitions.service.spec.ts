import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationDefinitionsService } from './application-definitions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SchedulerService } from '../scheduler/scheduler.service';

describe('ApplicationDefinitionsService', () => {
  let service: ApplicationDefinitionsService;

  const mockPrisma = {
    applicationDefinition: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    flowDefinition: {
      findUnique: jest.fn(),
    },
    appVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockUsersService = {
    getUserSnapshot: jest.fn(),
    getUserSnapshotByUsername: jest.fn(),
  };

  const mockSchedulerService = {
    scheduleWorkflow: jest.fn(),
    unscheduleWorkflow: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationDefinitionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UsersService, useValue: mockUsersService },
        { provide: SchedulerService, useValue: mockSchedulerService },
      ],
    }).compile();

    service = module.get<ApplicationDefinitionsService>(
      ApplicationDefinitionsService,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an application definition', async () => {
      const dto = { name: 'Test App' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const user = { username: 'user1', id: 'u1' } as any;
      mockPrisma.applicationDefinition.create.mockResolvedValue({
        id: 'app1',
        ...dto,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await service.create(dto as any, user);
      expect(result.id).toBe('app1');
    });
  });

  describe('findAll', () => {
    it('should return all definitions for admin', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const user = { username: 'admin', id: 'a1', roles: ['wf_admin'] } as any;
      mockPrisma.applicationDefinition.findMany.mockResolvedValue([
        { id: 'app1' },
      ]);
      mockUsersService.getUserSnapshotByUsername.mockResolvedValue({});

      const result = await service.findAll({}, user);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return app def with admin info', async () => {
      mockPrisma.applicationDefinition.findUnique.mockResolvedValue({
        id: 'app1',
        adminIds: ['user1'],
      });
      mockUsersService.getUserSnapshotByUsername.mockResolvedValue({
        username: 'user1',
      });

      const result: any = await service.findOne('app1');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.id).toBe('app1');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.adminInfo).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('should delete and unschedule', async () => {
      mockPrisma.applicationDefinition.findUnique.mockResolvedValue({
        id: 'app1',
      });
      mockPrisma.applicationDefinition.delete.mockResolvedValue({});

      await service.remove('app1');
      expect(mockSchedulerService.unscheduleWorkflow).toHaveBeenCalledWith(
        'app1',
      );
    });
  });
});
