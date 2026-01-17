import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { IQueueAdapter } from '../queue.interface';

@Injectable()
export class KafkaAdapter implements IQueueAdapter, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaAdapter.name);
  private kafka: KafkaJS.Kafka;
  private producer: KafkaJS.Producer;
  private consumer: KafkaJS.Consumer;
  private isConnected = false;
  private readonly handlers = new Map<string, (payload: any) => Promise<void>>();

  constructor(private configHelper: ConfigService) {
    const brokers = this.configHelper.get<string>('KAFKA_BROKERS') || 'localhost:9092';
    
    this.kafka = new KafkaJS.Kafka({
      'client.id': this.configHelper.get<string>('KAFKA_CLIENT_ID') || 'flow-craft-backend',
      'bootstrap.servers': brokers,
      'retry.backoff.ms': 300
    });

    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ 
      'group.id': this.configHelper.get<string>('KAFKA_GROUP_ID') || 'flow-craft-consumer-group',
      'auto.offset.reset': 'earliest'
    });
  }

  async onModuleInit() {
    // Only connect if this adapter is actually selected
    if (this.configHelper.get('QUEUE_TYPE') === 'kafka') {
        await this.connect();
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async connect() {
    if (this.isConnected) return;
    try {
      this.logger.log('Connecting to Kafka...');
      await this.producer.connect();
      await this.consumer.connect();
      this.isConnected = true;
      this.logger.log('Connected to Kafka.');

      // Start processing loop if handlers are registered
      if (this.handlers.size > 0) {
        await this.startConsumer();
      }
    } catch (err) {
      this.logger.error('Failed to connect to Kafka', err);
      // Don't throw to prevent boot crash, retry logic would be handled by kafkajs or service orchestrator
    }
  }

  async disconnect() {
    if (!this.isConnected) return;
    await this.producer.disconnect();
    await this.consumer.disconnect();
    this.isConnected = false;
  }

  async start(): Promise<void> {
    await this.connect();
  }

  async stop(): Promise<void> {
    await this.disconnect();
  }

  async enqueue(topic: string, payload: any, options?: { delay?: number }): Promise<void> {
    if (!this.isConnected) {
        // Fallback or error? For now try to reconnect valid
        await this.connect();
    }
    
    await this.producer.send({
      topic,
      messages: [
        { value: JSON.stringify(payload) },
      ],
    });
    this.logger.debug(`Enqueued message to topic: ${topic}`);
  }

  async subscribe(topic: string, handler: (payload: any) => Promise<void>): Promise<void> {
    this.handlers.set(topic, handler);
    
    // Subscribe to topic
    await this.consumer.subscribe({ topic });
    
    // If we haven't started running the consumer loop yet, start it now
    // Note: Kafka consumer.run should only be called once
    // We handle the "run only once" check inside startConsumer
    this.startConsumer();
  }

  private consumerRunning = false;
  
  private async startConsumer() {
    if (this.consumerRunning || !this.isConnected) return;
    this.consumerRunning = true;

    try {
        await this.consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const handler = this.handlers.get(topic);
                if (handler && message.value) {
                    try {
                        const payload = JSON.parse(message.value.toString());
                        await handler(payload);
                    } catch (err) {
                        this.logger.error(`Error processing message from topic ${topic}`, err);
                        // In a real app we might want dead letter queue or retry topics
                    }
                }
            },
        });
    } catch (err) {
        this.consumerRunning = false;
        this.logger.error('Consumer run failed', err);
    }
  }
}
