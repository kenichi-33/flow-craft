import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('StorageService', () => {
  let service: StorageService;
  let prisma: any;

  const mockPrisma = {
    file: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: any = {
        S3_ENDPOINT: 'http://localhost:9000',
        S3_PUBLIC_URL: 'http://localhost:9000',
        S3_ACCESS_KEY: 'minio',
        S3_SECRET_KEY: 'minio123',
        S3_BUCKET: 'test-bucket',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPresignedUploadUrl', () => {
    it('should reject files over max size', async () => {
      await expect(
        service.createPresignedUploadUrl(
          'large.zip',
          'application/zip',
          100 * 1024 * 1024,
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFileById', () => {
    it('should throw NotFound for missing file', async () => {
      mockPrisma.file.findUnique.mockResolvedValue(null);
      await expect(service.getFileById('notexist')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return file if uploaded', async () => {
      mockPrisma.file.findUnique.mockResolvedValue({
        id: 'f1',
        status: 'uploaded',
      });
      const result = await service.getFileById('f1');
      expect(result.id).toBe('f1');
    });
  });
});
