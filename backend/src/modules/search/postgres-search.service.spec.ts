import { Test, TestingModule } from '@nestjs/testing';
import { PostgresSearchService } from './postgres-search.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { SearchMetaService } from './search-meta.service';

describe('PostgresSearchService', () => {
  let service: PostgresSearchService;

  const mockPrisma = {
    application: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockQueueService = {
    registerHandler: jest.fn(),
    enqueue: jest.fn(),
  };

  const mockSearchMetaService = {
    generateSearchMeta: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostgresSearchService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueueService },
        { provide: SearchMetaService, useValue: mockSearchMetaService },
      ],
    }).compile();

    service = module.get<PostgresSearchService>(PostgresSearchService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should return search results', async () => {
      mockPrisma.application.findMany.mockResolvedValue([{ id: 'app1' }]);
      mockPrisma.application.count.mockResolvedValue(1);

      const result = await service.search({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply keyword filter', async () => {
      mockPrisma.application.findMany.mockResolvedValue([]);
      mockPrisma.application.count.mockResolvedValue(0);

      await service.search({ keyword: 'test' });
      expect(mockPrisma.application.findMany).toHaveBeenCalled();
    });
  });

  describe('indexApplication', () => {
    it('should update fullText field', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app1',
        inputData: { field1: 'value1' },
        formDefinition: { schema: {} },
      });
      mockSearchMetaService.generateSearchMeta.mockResolvedValue('meta text');
      mockPrisma.application.update.mockResolvedValue({});

      await service.indexApplication({ id: 'app1' } as any);
      expect(mockPrisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app1' },
          data: expect.objectContaining({ fullText: expect.any(String) }),
        }),
      );
    });
  });

  describe('removeApplication', () => {
    it('should be a no-op for PostgreSQL', async () => {
      await expect(service.removeApplication('app1')).resolves.not.toThrow();
    });
  });
});
