import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let service: QueueService;
  let mockAdapter: any;

  beforeEach(async () => {
    mockAdapter = {
      start: jest.fn(),
      stop: jest.fn(),
      enqueue: jest.fn(),
      subscribe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: 'QUEUE_ADAPTER', useValue: mockAdapter },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call adapter.start on module init', async () => {
    await service.onModuleInit();
    expect(mockAdapter.start).toHaveBeenCalled();
  });

  it('should call adapter.stop on module destroy', async () => {
    await service.onModuleDestroy();
    expect(mockAdapter.stop).toHaveBeenCalled();
  });

  it('should enqueue messages via adapter', async () => {
    await service.enqueue('test-topic', { data: 'test' });
    expect(mockAdapter.enqueue).toHaveBeenCalledWith(
      'test-topic',
      { data: 'test' },
      undefined,
    );
  });

  it('should register handler via adapter', async () => {
    const handler = jest.fn();
    await service.registerHandler('test-topic', handler);
    expect(mockAdapter.subscribe).toHaveBeenCalledWith('test-topic', handler);
  });
});
