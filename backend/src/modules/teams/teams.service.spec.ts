import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

describe('TeamsService', () => {
  let service: TeamsService;
  let usersService: any;

  const mockPrismaService = {
    team: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    teamMember: {
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockUsersService = {
    getUserSnapshotByUsername: jest.fn(),
    getUserGroupsWithDeptCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMyTeams', () => {
    it('should return teams for user and department', async () => {
      const username = 'user1';
      usersService.getUserGroupsWithDeptCode.mockResolvedValue([
        { deptCode: 'DEPT-1' },
      ]);

      mockPrismaService.team.findMany.mockResolvedValue([
        { id: 'team1', name: 'Team A' },
      ]);

      const result = await service.getMyTeams(username);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            members: expect.objectContaining({
              some: expect.objectContaining({
                OR: expect.arrayContaining([
                  { memberType: 'user', memberId: username },
                  { memberType: 'department', memberId: { in: ['DEPT-1'] } },
                ]),
              }),
            }),
          }),
        }),
      );
    });
  });
});
