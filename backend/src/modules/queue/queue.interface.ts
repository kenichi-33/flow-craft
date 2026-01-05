
export interface IQueueAdapter {
  /**
   * Enqueue a job to a specific topic
   */
  enqueue(topic: string, payload: any): Promise<void>;

  /**
   * Subscribe to a topic with a handler
   */
  subscribe(topic: string, handler: (payload: any) => Promise<void>): Promise<void>;
  
  /**
   * Start the queue processing
   */
  start(): Promise<void>;

  /**
   * Stop the queue processing
   */
  stop(): Promise<void>;
}
