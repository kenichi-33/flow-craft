import { Test, TestingModule } from '@nestjs/testing';
import { KafkaAdapter } from './kafka.adapter';
import { ConfigService } from '@nestjs/config';

// Mock kafkajs
const mockProducer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
};

const mockConsumer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  subscribe: jest.fn(),
  run: jest.fn(),
};

const mockKafka = {
  producer: jest.fn(() => mockProducer),
  consumer: jest.fn(() => mockConsumer),
};

jest.mock('@confluentinc/kafka-javascript', () => {
  return {
    KafkaJS: {
      Kafka: jest.fn(() => mockKafka),
    },
  };
});

describe('KafkaAdapter', () => {
  let adapter: KafkaAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'KAFKA_BROKERS') return 'localhost:9092';
              return null;
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<KafkaAdapter>(KafkaAdapter);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should connect producer and consumer on connect()', async () => {
    await adapter.connect();
    expect(mockProducer.connect).toHaveBeenCalled();
    expect(mockConsumer.connect).toHaveBeenCalled();
  });

  it('should enqueue message', async () => {
    await adapter.connect();
    await adapter.enqueue('test-topic', { data: 123 });

    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: 'test-topic',
      messages: [{ value: JSON.stringify({ data: 123 }) }],
    });
  });

  it('should auto-connect on enqueue if not connected', async () => {
    // connect() not called explicitly
    await adapter.enqueue('test-topic', { data: 1 });
    expect(mockProducer.connect).toHaveBeenCalled();
    expect(mockProducer.send).toHaveBeenCalled();
  });

  it('should subscribe and start consumer', async () => {
    const handler = jest.fn();
    await adapter.subscribe('test-topic', handler);

    expect(mockConsumer.subscribe).toHaveBeenCalledWith({
      topics: ['test-topic'],
    });
    expect(mockConsumer.run).toHaveBeenCalled();
  });
});
