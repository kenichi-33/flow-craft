import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { TeamsService } from '../../modules/teams/teams.service';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;
  let teamsService: TeamsService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:8080'),
  };

  const mockTeamsService = {
    getMyTeams: jest.fn().mockResolvedValue([{ id: 'group-1' }]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TeamsService, useValue: mockTeamsService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    configService = module.get<ConfigService>(ConfigService);
    teamsService = module.get<TeamsService>(TeamsService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should validate and return user object', async () => {
      const payload: any = {
        sub: 'user-id',
        preferred_username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['user'],
        groups: ['group-1'],
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-id',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        firstName: undefined,
        lastName: undefined,
        roles: ['user'],
        groups: ['group-1'],
        groupCodes: ['group-1'], // from teamsService
        employeeId: undefined,
        displayName: undefined,
      });

      expect(teamsService.getMyTeams).toHaveBeenCalledWith('testuser');
    });

    it('should throw UnauthorizedException if sub is missing', async () => {
      const payload: any = {
        preferred_username: 'testuser',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
