import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(to: string, subject: string, content: string) {
    try {
      this.logger.log(`Sending email to: ${to}, subject: ${subject}`);
      await this.mailerService.sendMail({
        to,
        subject,
        text: content,
        // html: content, // HTMLメール対応時はここを使用
      });
      this.logger.log(`Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      return false;
    }
  }

  async sendSlaBreachNotification(to: string, task: any, application: any) {
    const subject = `[SLA Breach] Task Overdue: ${application.title}`;
    const content = `Task ${task.type} (ID: ${task.id}) for application "${application.title}" has exceeded its SLA.`;

    return this.sendEmail(to, subject, content);
  }

  async sendTaskReminder(to: string, task: any, application: any) {
    const subject = `[Reminder] Task Due: ${application.title}`;
    const content = `Reminder: Task ${task.type} (ID: ${task.id}) for application "${application.title}" is pending your action.`;

    return this.sendEmail(to, subject, content);
  }
}
