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
 * 承認タスクハンドラー
 * 承認タスクの生成と通知メール送信を担当
 */
@Injectable()
export class ApprovalHandler implements ITaskHandler {
  private readonly logger = new Logger('[Worker] ApprovalHandler');
  readonly taskType = 'approval';

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  async execute(context: TaskContext): Promise<TaskResult> {
    const { taskId, applicationId, nodeId, nodeData, inputData } = context;

    try {
      // WorkflowTaskは既にExecutorで作成済み
      // ここではメール通知のみ実行
      this.logger.log(
        `Processing approval task ${taskId} for application ${applicationId} at node ${nodeId}`,
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

      // 承認タスクは人間の操作を待つため、shouldAdvance = false
      return {
        success: true,
        shouldAdvance: false, // 承認完了まで待機
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process approval task: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        shouldAdvance: false,
      };
    }
  }

  /**
   * assignedTo の値を実際のユーザーに解決
   */
  private async resolveAssignedTo(
    assignee: string | null,
    applicantId: string,
  ): Promise<string | null> {
    if (!assignee) return null;

    if (assignee === 'applicant') {
      return applicantId;
    }

    if (assignee === 'applicant_manager') {
      // 申請者のマネージャーを取得
      // NOTE: マネージャー情報はattributesから取得する必要があるが、現在はサポートなし
      // TODO: Keycloakからマネージャー情報を取得するロジックを追加
      return null;
    }

    // それ以外はそのまま返す（user:xxx, role:xxx, group:xxx）
    return assignee;
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
        subjectTemplate || '承認依頼',
        variables,
      );
      const body = this.replaceVariables(
        bodyTemplate || '承認をお願いします',
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
