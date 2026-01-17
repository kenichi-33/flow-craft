
export interface ISchedulerAdapter {
  /**
   * Schedule a recurring job (Cron)
   * @param name Unique name for the schedule (e.g. "application-def-123")
   * @param cron Cron expression (e.g. "0 0 * * *")
   * @param topic Topic to enqueue when triggered
   * @param payload Payload to send
   */
  schedule(name: string, cron: string, topic: string, payload: any): Promise<void>;

  /**
   * Unschedule a recurring job
   * @param name Unique name of the schedule
   */
  unschedule(name: string): Promise<void>;
}
