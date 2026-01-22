import { Injectable, Inject } from '@nestjs/common';
import type { IQueueAdapter } from './queue.interface';

@Injectable()
export class QueueService {
  constructor(
    @Inject('QUEUE_ADAPTER') private readonly adapter: IQueueAdapter,
  ) {}

  async enqueue(
    topic: string,
    payload: any,
    options?: { delay?: number; deduplicationId?: string },
  ): Promise<void> {
    return this.adapter.enqueue(topic, payload, options);
  }

  /**
   * Registers a handler for a topic.
   * This should be called during module initialization.
   */
  async registerHandler(
    topic: string,
    handler: (payload: any) => Promise<void>,
  ): Promise<void> {
    return this.adapter.subscribe(topic, handler);
  }
}
