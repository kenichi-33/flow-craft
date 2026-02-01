import { Test, TestingModule } from '@nestjs/testing';
import { FormsService } from './forms.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FormsService', () => {
  let service: FormsService;
  // let prisma: any;

  const mockPrisma = {
    formDefinition: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FormsService>(FormsService);
    // prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a form', async () => {
    mockPrisma.formDefinition.create.mockResolvedValue({
      id: 'f1',
      name: 'Test',
    });
    const result = await service.create({ name: 'Test', schema: {} });
    expect(result.id).toBe('f1');
    expect(mockPrisma.formDefinition.create).toHaveBeenCalled();
  });

  it('should find all forms', async () => {
    mockPrisma.formDefinition.findMany.mockResolvedValue([{ id: 'f1' }]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
  });

  it('should find one form by id', async () => {
    mockPrisma.formDefinition.findUnique.mockResolvedValue({ id: 'f1' });
    const result = await service.findOne('f1');
    expect(result?.id).toBe('f1');
  });

  it('should update a form', async () => {
    mockPrisma.formDefinition.update.mockResolvedValue({
      id: 'f1',
      name: 'Updated',
    });
    const result = await service.update('f1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });
});
