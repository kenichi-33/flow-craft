import { Test, TestingModule } from '@nestjs/testing';
import { FlowsService } from './flows.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SchedulerService } from '../scheduler/scheduler.service';

describe('FlowsService', () => {
  let service: FlowsService;
  let prisma: any;
  let scheduler: any;

  const mockPrisma = {
    flowDefinition: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    applicationDefinition: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockScheduler = {
    unscheduleWorkflow: jest.fn(),
    scheduleWorkflow: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SchedulerService, useValue: mockScheduler },
      ],
    }).compile();

    service = module.get<FlowsService>(FlowsService);
    prisma = module.get<PrismaService>(PrismaService);
    scheduler = module.get<SchedulerService>(SchedulerService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a flow', async () => {
    mockPrisma.flowDefinition.create.mockResolvedValue({
      id: 'fl1',
      name: 'Flow',
    });
    const result = await service.create({ name: 'Flow', nodes: [], edges: [] });
    expect(result.id).toBe('fl1');
  });

  it('should find all flows', async () => {
    mockPrisma.flowDefinition.findMany.mockResolvedValue([{ id: 'fl1' }]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
  });

  it('should update a flow and sync cron', async () => {
    mockPrisma.flowDefinition.update.mockResolvedValue({ id: 'fl1' });
    mockPrisma.applicationDefinition.findMany.mockResolvedValue([
      { id: 'app1', scheduleCron: null, status: 'ACTIVE' },
    ]);

    const nodes = [{ type: 'start', data: { scheduleCron: '0 * * * *' } }];
    await service.update('fl1', { nodes });

    expect(mockPrisma.applicationDefinition.update).toHaveBeenCalled();
    expect(mockScheduler.unscheduleWorkflow).toHaveBeenCalledWith('app1');
    expect(mockScheduler.scheduleWorkflow).toHaveBeenCalled();
  });
});
