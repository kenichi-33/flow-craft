import { Test, TestingModule } from '@nestjs/testing';
import { ElasticsearchSearchService } from './elasticsearch-search.service';
import { ConfigService } from '@nestjs/config';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchMetaService } from './search-meta.service';
import { Client } from '@elastic/elasticsearch';

// Mock Elastic Client
const mockClient = {
  ping: jest.fn(),
  indices: {
    exists: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  search: jest.fn(),
  index: jest.fn(),
};

jest.mock('@elastic/elasticsearch', () => {
  return {
    Client: jest.fn().mockImplementation(() => mockClient),
  };
});

describe('ElasticsearchSearchService', () => {
  let service: ElasticsearchSearchService;

  const mockQueueService = {
    registerHandler: jest.fn(),
  };
  const mockPrismaService = {
    application: { findMany: jest.fn() },
  };
  const mockSearchMeta = {
    generateSearchMeta: jest.fn().mockResolvedValue('meta text'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElasticsearchSearchService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'SEARCH_MODE') return 'elasticsearch';
              if (key === 'ELASTICSEARCH_NODE') return 'http://localhost:9200';
              return null;
            }),
          },
        },
        { provide: QueueService, useValue: mockQueueService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SearchMetaService, useValue: mockSearchMeta },
      ],
    }).compile();

    service = module.get<ElasticsearchSearchService>(
      ElasticsearchSearchService,
    );

    jest.clearAllMocks();
    // Re-instantiate mock client in service if needed,
    // but service instantiates it in onModuleInit.
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize client if configured', async () => {
      mockClient.ping.mockResolvedValue(true);
      mockClient.indices.exists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(Client).toHaveBeenCalled();
      expect(mockClient.ping).toHaveBeenCalled();
      expect(mockClient.indices.exists).toHaveBeenCalled();
    });

    it('should create index if missing', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({});

      await service.onModuleInit();

      expect(mockClient.indices.create).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await service.onModuleInit(); // To init client
    });

    it('should execute search query', async () => {
      const hits = [{ _id: 'app-1', _source: { title: 'Test App' } }];
      mockClient.search.mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: hits,
        },
      });
      mockPrismaService.application.findMany.mockResolvedValue([
        { id: 'app-1', title: 'Test App' },
      ]);

      const result = await service.search({ keyword: 'Test' });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: expect.arrayContaining([
                expect.objectContaining({ multi_match: expect.anything() }),
              ]),
            }),
          }),
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('app-1');
    });

    it('should return empty if no hits', async () => {
      mockClient.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      const result = await service.search({ keyword: 'None' });

      expect(result.items).toHaveLength(0);
      expect(mockPrismaService.application.findMany).not.toHaveBeenCalled();
    });
  });

  describe('indexApplication', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should index application data', async () => {
      const app: any = {
        id: 'app-1',
        title: 'Title',
        inputData: { field: 'value' },
      };

      await service.indexApplication(app);

      expect(mockSearchMeta.generateSearchMeta).toHaveBeenCalledWith(app);
      expect(mockClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'app-1',
          document: expect.objectContaining({
            title: 'Title',
            full_text: 'meta text',
          }),
        }),
      );
    });
  });
});
