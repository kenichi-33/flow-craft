import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

describe('StatisticsController', () => {
  let controller: StatisticsController;
  let service: StatisticsService;

  const mockService = {
    getApplicationsSummary: jest.fn(),
    getApplicationStats: jest.fn(),
    getTaskPerformanceStats: jest.fn(),
    getApplicationRates: jest.fn(),
    getAssigneeStats: jest.fn(),
    getServiceTaskErrorStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [
        { provide: StatisticsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<StatisticsController>(StatisticsController);
    service = module.get<StatisticsService>(StatisticsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getApplicationsSummary', () => {
    it('should call service.getApplicationsSummary', async () => {
      await controller.getApplicationsSummary();
      expect(service.getApplicationsSummary).toHaveBeenCalled();
    });
  });

  describe('getApplicationStats', () => {
    it('should call service.getApplicationStats', async () => {
      await controller.getApplicationStats('app-1');
      expect(service.getApplicationStats).toHaveBeenCalledWith('app-1');
    });
  });

  describe('getTaskPerformanceStats', () => {
    it('should call service.getTaskPerformanceStats', async () => {
      await controller.getTaskPerformanceStats('app-1');
      expect(service.getTaskPerformanceStats).toHaveBeenCalledWith('app-1');
    });
  });

  describe('getApplicationRates', () => {
    it('should call service.getApplicationRates', async () => {
      await controller.getApplicationRates('app-1');
      expect(service.getApplicationRates).toHaveBeenCalledWith('app-1');
    });
  });

  describe('getAssigneeStats', () => {
    it('should call service.getAssigneeStats', async () => {
      await controller.getAssigneeStats('app-1');
      expect(service.getAssigneeStats).toHaveBeenCalledWith('app-1');
    });
  });

  describe('getServiceTaskErrorStats', () => {
    it('should call service.getServiceTaskErrorStats', async () => {
      await controller.getServiceTaskErrorStats('app-1');
      expect(service.getServiceTaskErrorStats).toHaveBeenCalledWith('app-1');
    });
  });
});
