import { Injectable, Logger } from '@nestjs/common';
import {
  ITaskHandler,
  TaskContext,
  TaskResult,
} from '../task-handler.interface';

/**
 * Slack/Teams Webhook Handler
 * Sends a notification via webhook
 */
@Injectable()
export class SlackTaskHandler implements ITaskHandler {
  private readonly logger = new Logger(SlackTaskHandler.name);

  constructor() {}

  get taskType(): string {
    return 'slack';
  }

  async execute(context: TaskContext): Promise<TaskResult> {
    const { taskId, nodeId, nodeData, inputData, applicantId } = context;
    this.logger.log(`Executing Slack/Webhook Task ${taskId} (Node: ${nodeId})`);

    try {
      const config = nodeData || {};

      // Simple string interpolation helper
      const substitute = (text: string, data: any) => {
        if (!text) return '';
        return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
          const keys = key.trim().split('.');
          let val = data;
          for (const k of keys) {
            val = val ? val[k] : undefined;
          }
          return val !== undefined ? String(val) : `{{${key}}}`;
        });
      };

      const substitutionData = {
        application: { ...inputData },
        applicant: { id: applicantId },
        input: inputData,
      };

      const webhookUrl = substitute(config.webhookUrl, substitutionData);
      const message = substitute(config.message, substitutionData);

      if (!webhookUrl) {
        throw new Error('Webhook URL is missing');
      }

      this.logger.log(`Sending webhook notification to ${webhookUrl}`);

      // Send request to Slack/Teams Webhook
      // Basic axios fetch (or fetch api in newer Node)
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });

      if (!response.ok) {
        throw new Error(
          `Webhook failed with status ${response.status}: ${response.statusText}`,
        );
      }

      return {
        success: true,
        shouldAdvance: true,
        outputData: {
          [`slack_sent_${nodeId}`]: true,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to execute slack task ${taskId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        shouldAdvance: false,
      };
    }
  }
}
