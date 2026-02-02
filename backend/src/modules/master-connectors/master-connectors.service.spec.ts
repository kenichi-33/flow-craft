import { Test, TestingModule } from '@nestjs/testing';
import { MasterConnectorsService } from './master-connectors.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MasterConnectorsService', () => {
  let service: MasterConnectorsService;

  const mockPrismaService = {
    masterConnector: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    applicationDefinition: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    masterDataItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockUsersService = {
    getUserSnapshotByUsername: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterConnectorsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<MasterConnectorsService>(MasterConnectorsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return connectors accessible to user', async () => {
      const user = { id: 'u1', username: 'user1' };
      mockPrismaService.applicationDefinition.findMany.mockResolvedValue([
        { id: 'app1' },
      ]);
      mockPrismaService.masterConnector.findMany.mockResolvedValue([
        { id: 'c1', createdBy: 'user1' },
      ]);
      mockUsersService.getUserSnapshotByUsername.mockResolvedValue({
        username: 'user1',
      });

      const result = await service.findAll(user);

      expect(result).toHaveLength(1);
      expect(mockUsersService.getUserSnapshotByUsername).toHaveBeenCalled();
    });
  });

  describe('proxy', () => {
    it('should proxy REST requests', async () => {
      const connectorId = 'c1';
      const query = 'test';
      const connector = {
        id: connectorId,
        type: 'rest',
        config: { url: 'http://api.com', method: 'GET' },
        mapping: { label: 'name', value: 'id' },
      };

      mockPrismaService.masterConnector.findUnique.mockResolvedValue(connector);
      (mockedAxios as unknown as jest.Mock).mockResolvedValue({
        data: [{ id: '1', name: 'Item 1' }],
      });

      const result = await service.proxy(connectorId, query);

      expect(result).toEqual([{ label: 'Item 1', value: '1', metadata: {} }]);
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('http://api.com'),
        }),
      );
    });
  });
});
