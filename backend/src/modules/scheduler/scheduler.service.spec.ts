import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock cron module to prevent real timers
jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

describe('SchedulerService', () => {
  let service: SchedulerService;

  const mockSchedulerRegistry = {
    addCronJob: jest.fn(),
    deleteCronJob: jest.fn(),
    doesExist: jest.fn(),
  };

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  const mockPrisma = {
    applicationDefinition: {
      findMany: jest.fn(),
    },
    cronScheduleLock: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    workflowTask: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
        { provide: QueueService, useValue: mockQueueService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scheduleWorkflow', () => {
    it('should add cron job', async () => {
      await service.scheduleWorkflow('test', '0 * * * *', { id: 'test' });
      expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalled();
    });

    it('should skip empty cron', async () => {
      await service.scheduleWorkflow('test', '', { id: 'test' });
      expect(mockSchedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });
  });

  describe('unscheduleWorkflow', () => {
    it('should delete cron job if exists', () => {
      mockSchedulerRegistry.doesExist.mockReturnValue(true);
      service.unscheduleWorkflow('test');
      expect(mockSchedulerRegistry.deleteCronJob).toHaveBeenCalledWith('test');
    });

    it('should not throw if job does not exist', () => {
      mockSchedulerRegistry.doesExist.mockReturnValue(false);
      expect(() => service.unscheduleWorkflow('test')).not.toThrow();
    });
  });
});
