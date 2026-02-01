import { Test, TestingModule } from '@nestjs/testing';
import { SearchMetaService } from './search-meta.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SearchMetaService', () => {
  let service: SearchMetaService;

  const mockPrisma = {
    applicationDefinition: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchMetaService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SearchMetaService>(SearchMetaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSearchMeta', () => {
    it('should generate meta from application number and status', async () => {
      const app = {
        id: 'app1',
        applicationNumber: 12345,
        status: 'APPROVED',
        applicantInfo: null,
        inputData: null,
        applicationDefinitionId: null,
      } as any;

      const result = await service.generateSearchMeta(app);
      expect(result).toContain('12345');
      expect(result).toContain('承認済み');
    });

    it('should include applicant name from snapshot', async () => {
      const app = {
        id: 'app1',
        applicationNumber: 1,
        status: 'IN_PROGRESS',
        applicantInfo: {
          firstName: '太郎',
          lastName: '山田',
          username: 'yamada',
        },
        inputData: null,
        applicationDefinitionId: null,
      } as any;

      const result = await service.generateSearchMeta(app);
      expect(result).toContain('山田 太郎');
      expect(result).toContain('yamada');
    });

    it('should resolve select option labels', async () => {
      const app = {
        id: 'app1',
        applicationNumber: 1,
        status: 'DRAFT',
        applicantInfo: null,
        inputData: { category: 'cat1' },
        applicationDefinitionId: 'appdef1',
      } as any;

      mockPrisma.applicationDefinition.findUnique.mockResolvedValue({
        formDefinition: {
          schema: {
            properties: {
              category: {
                options: [{ value: 'cat1', label: 'カテゴリ1' }],
              },
            },
          },
        },
      });

      const result = await service.generateSearchMeta(app);
      expect(result).toContain('カテゴリ1');
    });
  });
});
