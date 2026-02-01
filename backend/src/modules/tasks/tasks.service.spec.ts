import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TeamsService } from '../teams/teams.service';
import { NotFoundException } from '@nestjs/common';

describe('TasksService', () => {
  let service: TasksService;

  const mockPrisma = {
    workflowTask: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockUsersService = {
    resolveAssignedToSnapshot: jest.fn(),
  };

  const mockTeamsService = {
    getMyTeams: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UsersService, useValue: mockUsersService },
        { provide: TeamsService, useValue: mockTeamsService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return tasks without pagination', async () => {
      mockPrisma.workflowTask.findMany.mockResolvedValue([
        { id: 't1', type: 'approval' },
      ]);

      const result = await service.findAll({});
      expect(result).toHaveLength(1);
    });

    it('should return paginated tasks', async () => {
      mockPrisma.workflowTask.findMany.mockResolvedValue([{ id: 't1' }]);
      mockPrisma.workflowTask.count.mockResolvedValue(1);
      mockUsersService.resolveAssignedToSnapshot.mockResolvedValue({});

      const result = (await service.findAll({ page: 1, limit: 10 })) as any;
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException for missing task', async () => {
      mockPrisma.workflowTask.findUnique.mockResolvedValue(null);
      await expect(service.findOne('notexist')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return task if exists', async () => {
      mockPrisma.workflowTask.findUnique.mockResolvedValue({ id: 't1' });
      const result = await service.findOne('t1');
      expect(result.id).toBe('t1');
    });
  });

  describe('findPending', () => {
    it('should return pending tasks', async () => {
      mockPrisma.workflowTask.findMany.mockResolvedValue([
        { id: 't1', status: 'PENDING' },
      ]);

      const result = await service.findPending();
      expect(result).toHaveLength(1);
    });
  });
});
