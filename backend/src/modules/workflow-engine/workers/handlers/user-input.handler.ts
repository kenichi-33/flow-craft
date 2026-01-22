import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { UsersService } from '../../../users/users.service';
import { MailService } from '../../../notifications/mail.service';
import {
  ITaskHandler,
  TaskContext,
  TaskResult,
} from '../task-handler.interface';

/**
 * 入力タスクハンドラー
 * 入力タスクの生成通知メール送信を担当
 */
@Injectable()
export class UserInputHandler implements ITaskHandler {
  private readonly logger = new Logger('[Worker] UserInputHandler');
  readonly taskType = 'userInput';

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  async execute(context: TaskContext): Promise<TaskResult> {
    const { taskId, applicationId, nodeId, nodeData, inputData } = context;

    try {
      this.logger.log(
        `Processing input task ${taskId} for application ${applicationId} at node ${nodeId}`,
      );

      // メール通知送信
      if (nodeData?.notificationEnabled) {
        // WorkflowTaskから担当者情報を取得
        const task = await this.prisma.workflowTask.findUnique({
          where: { id: taskId },
        });

        if (task?.assignedTo) {
          await this.sendNotificationEmail(
            task.assignedTo,
            nodeData.notificationSubject,
            nodeData.notificationBody,
            applicationId,
            inputData,
          );
        }
      }

      // 入力タスクはユーザー操作を待つため、shouldAdvance = false
      return {
        success: true,
        shouldAdvance: false, // 入力完了まで待機
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process input task: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        shouldAdvance: false,
      };
    }
  }

  /**
   * 通知メールを送信
   */
  private async sendNotificationEmail(
    assignee: string | null,
    subjectTemplate: string,
    bodyTemplate: string,
    applicationId: string,
    inputData: Record<string, any>,
  ): Promise<void> {
    if (!assignee) return;

    try {
      // アプリケーション情報を取得（定義含む）
      const application = await this.prisma.application.findUnique({
        where: { id: applicationId },
        include: { applicationDefinition: true },
      });

      if (!application) {
        this.logger.warn(`Application not found: ${applicationId}`);
        return;
      }

      // 担当者のメールアドレスと名前を取得
      let email: string | null = null;
      let assigneeName = assignee;

      // User lookup logic
      if (assignee.startsWith('user:')) {
        const username = assignee.substring(5);
        const userSnapshot =
          await this.usersService.getUserSnapshotByUsername(username);
        email = userSnapshot?.email || null;

        if (userSnapshot) {
          assigneeName =
            userSnapshot.lastName && userSnapshot.firstName
              ? `${userSnapshot.lastName} ${userSnapshot.firstName}`
              : userSnapshot.username;
        }
      }
      // Applicant lookup logic (Explicit 'applicant' keyword)
      else if (assignee === 'applicant') {
        const applicantId = application.applicantId;
        // Try as username first, then ID
        let userSnapshot =
          await this.usersService.getUserSnapshotByUsername(applicantId);
        if (!userSnapshot) {
          userSnapshot = await this.usersService.getUserSnapshot(applicantId);
        }
        email = userSnapshot?.email || null;
        if (userSnapshot) {
          assigneeName =
            userSnapshot.lastName && userSnapshot.firstName
              ? `${userSnapshot.lastName} ${userSnapshot.firstName}`
              : userSnapshot.username;
        }
      }
      // Fallback: Assume it's a username or ID if no prefix
      else if (!assignee.includes(':')) {
        // Try as username first
        let userSnapshot =
          await this.usersService.getUserSnapshotByUsername(assignee);
        if (!userSnapshot) {
          // Try as ID
          userSnapshot = await this.usersService.getUserSnapshot(assignee);
        }

        if (userSnapshot) {
          email = userSnapshot.email || null;
          assigneeName =
            userSnapshot.lastName && userSnapshot.firstName
              ? `${userSnapshot.lastName} ${userSnapshot.firstName}`
              : userSnapshot.username;
        }
      }

      // TODO: Handle Group/Role email resolution if needed (e.g. send to all in group)
      // Currently minimal implementation for Specific User & Applicant

      if (!email) {
        this.logger.warn(`Could not find email for assignee: ${assignee}`);
        return;
      }

      // 変数コンテキストの作成
      const variables = {
        ...inputData,
        application,
        applicationDefinition: application.applicationDefinition,
        assignee: assigneeName,
      };

      // 変数置換
      const subject = this.replaceVariables(
        subjectTemplate || '入力依頼',
        variables,
      );
      const body = this.replaceVariables(
        bodyTemplate || '以下の情報の入力をお願いします',
        variables,
      );

      await this.mailService.sendEmail(email, subject, body);

      this.logger.log(`Sent notification email to ${email}`);
    } catch (error) {
      this.logger.error('Failed to send notification email', error);
      // メール送信失敗はタスク失敗として扱わない
    }
  }

  /**
   * 変数置換
   */
  private replaceVariables(text: string, data: any): string {
    if (!text) return '';
    return text.replace(/\{\{(.+?)\}\}/g, (_, key) => {
      const path = key.trim();
      const value = this.getValueByPath(data, path);
      return value !== undefined ? String(value) : '';
    });
  }

  private getValueByPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }
}
