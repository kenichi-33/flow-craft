/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: SearchService;
  let prisma: PrismaService;

  const mockSearchService = {
    search: jest.fn(),
    indexApplication: jest.fn(),
  };

  const mockPrisma = {
    application: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    searchService = module.get<SearchService>(SearchService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchApplications', () => {
    it('should call searchService.search', async () => {
      const dto = { keyword: 'test' };
      await controller.searchApplications(dto);
      expect(searchService.search).toHaveBeenCalledWith(dto);
    });
  });

  describe('manualIndex', () => {
    it('should index application if found', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
      await controller.manualIndex('app-1');
      expect(prisma.application.findUnique).toHaveBeenCalledWith({
        where: { id: 'app-1' },
      });
      expect(searchService.indexApplication).toHaveBeenCalledWith({
        id: 'app-1',
      });
    });

    it('should not index if application not found', async () => {
      mockPrisma.application.findUnique.mockResolvedValue(null);
      await controller.manualIndex('app-1');
      expect(searchService.indexApplication).not.toHaveBeenCalled();
    });
  });
});
