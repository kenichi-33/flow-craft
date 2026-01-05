import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
import { IQueueAdapter } from '../queue.interface';

@Injectable()
export class PgBossQueueAdapter implements IQueueAdapter, OnModuleInit, OnModuleDestroy {
  private boss: PgBoss;
  private readonly logger = new Logger(PgBossQueueAdapter.name);

  constructor(private configService: ConfigService) {
    const databaseUrl = this.configService.getOrThrow<string>('DATABASE_URL');
    this.boss = new PgBoss(databaseUrl);
    
    this.boss.on('error', (error) => this.logger.error(error));
  }

  async onModuleInit() {
    await this.start();
  }

  async onModuleDestroy() {
    await this.stop();
  }

  async start(): Promise<void> {
    try {
      await this.boss.start();
      this.logger.log('PgBoss started');
    } catch (error) {
      this.logger.error('Failed to start PgBoss', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.boss.stop();
      this.logger.log('PgBoss stopped');
    } catch (error) {
      this.logger.error('Failed to stop PgBoss', error);
    }
  }

  async enqueue(topic: string, payload: any): Promise<void> {
    try {
      await this.boss.send(topic, payload);
      this.logger.debug(`Job enqueued to ${topic}: ${JSON.stringify(payload)}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue job to ${topic}`, error);
      throw error;
    }
  }

  async subscribe(topic: string, handler: (payload: any) => Promise<void>): Promise<void> {
    try {
      await this.boss.createQueue(topic);
      await this.boss.work(topic, async (jobs) => {
        // pg-boss can handle batch or single. 
        // type definition for handler might vary, usually job object has data property.
        // We handle single job here as per abstraction.
        // jobs can be array or single depending on batch size, but default work() handles one by one or array.
        // The callback signature for work is (jobs: Job<T>[]) => Promise<void> or (job: Job<T>) => Promise<void>
        
        // Handling single job for simplicity and matching strict abstraction
        const jobArray = Array.isArray(jobs) ? jobs : [jobs];
        
        for (const job of jobArray) {
           try {
             await handler(job.data);
           } catch (e) {
             this.logger.error(`Error processing job ${job.id}`, e);
             throw e; // pg-boss will handle retry based on policy
           }
        }
      });
      this.logger.log(`Subscribed to topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to ${topic}`, error);
      throw error;
    }
  }
}
