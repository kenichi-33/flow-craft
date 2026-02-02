import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('UsersService', () => {
  let service: UsersService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'KEYCLOAK_URL') return 'http://keycloak:8080';
      if (key === 'KEYCLOAK_REALM') return 'test-realm';
      if (key === 'KEYCLOAK_ADMIN_USER') return 'admin';
      if (key === 'KEYCLOAK_ADMIN_PASSWORD') return 'password';
      return null;
    }),
  };

  const mockPrismaService = {
    team: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAdminToken', () => {
    it('should retrieve token via axios', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'mock-token',
          expires_in: 300,
        },
      });

      // Access private method via casting
      const token = await (service as any).getAdminToken();
      expect(token).toBe('mock-token');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should return cached token if valid', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'token-1', expires_in: 300 },
      });

      await (service as any).getAdminToken();

      // Call again
      const token2 = await (service as any).getAdminToken();
      expect(token2).toBe('token-1');
      // Should still be called once
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('getGroups', () => {
    it('should fetch groups from keycloak', async () => {
      // Mock token call
      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'valid-token', expires_in: 300 },
      });

      // Mock groups call
      mockedAxios.get.mockImplementation(async (url) => {
        if (url.endsWith('/groups')) {
          return {
            data: [
              { id: 'g1', name: 'Group 1', path: '/g1', subGroupCount: 0 },
            ],
          };
        }
        if (url.includes('/groups/g1') && !url.includes('/children')) {
          // Detail call
          return { data: { attributes: { deptCode: ['D001'] } } };
        }
        return { data: [] };
      });

      const groups = await service.getGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].deptCode).toBe('D001');
    });
  });
});
