import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsService } from './statistics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

describe('StatisticsService', () => {
  let service: StatisticsService;

  const mockPrisma = {
    applicationDefinition: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    application: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    workflowTask: {
      findMany: jest.fn(),
      groupBy: jest.fn(), // Also used in getTaskPerformanceStats
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: UsersService,
          useValue: {
            getUserSnapshotByUsername: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getApplicationsSummary', () => {
    it('should return summary for all app definitions', async () => {
      mockPrisma.applicationDefinition.findMany.mockResolvedValue([
        { id: 'app1', name: 'App 1' },
      ]);
      mockPrisma.application.count.mockResolvedValue(10);

      const result = await service.getApplicationsSummary();
      expect(result).toHaveLength(1);
      expect(result[0].stats.totalCount).toBe(10);
    });
  });

  describe('getApplicationStats', () => {
    it('should return null for non-existing app', async () => {
      mockPrisma.applicationDefinition.findUnique.mockResolvedValue(null);
      const result = await service.getApplicationStats('notexist');
      expect(result).toBeNull();
    });

    it('should return stats for existing app', async () => {
      mockPrisma.applicationDefinition.findUnique.mockResolvedValue({
        id: 'app1',
        name: 'App 1',
      });
      mockPrisma.application.groupBy.mockResolvedValue([
        { status: 'APPROVED', _count: { _all: 5 } },
      ]);
      mockPrisma.workflowTask.findMany.mockResolvedValue([
          { stepId: 'step1', assignedTo: 'user:1', claimedBy: null }
      ]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getApplicationStats('app1');
      expect(result).not.toBeNull();
      expect(result?.definition.id).toBe('app1');
    });
  });
});
