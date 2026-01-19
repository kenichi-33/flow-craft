import { Injectable, Logger } from '@nestjs/common';
import { ITaskHandler, TaskContext, TaskResult } from '../task-handler.interface';
import { MailService } from '../../../notifications/mail.service';

/**
 * メール送信タスクハンドラー
 * 非同期でメール送信を実行する
 */
import { WorkflowHelperService } from '../../workflow-helper.service';
import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * 簡易テンプレートレジストリ
 * 将来的にはDBまたは外部設定に移動
 */
const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
    'approval_request': {
        subject: '【{{applicationDefinition.name}}】承認依頼: {{application.title}}',
        body: '申請「{{application.title}}」の承認依頼が届いています。\n\nアプリ: {{applicationDefinition.name}}\n申請者: {{applicant.name}}\nリンク: {{applicationUrl}}'
    },
    'approval_remind': {
        subject: '【{{applicationDefinition.name}}】リマインド: 承認期限が迫っています',
        body: '以下の申請の承認をお願いします。\n\nアプリ: {{applicationDefinition.name}}\n件名: {{application.title}}\n期限: {{task.dueDate}}'
    },
    'notification_default': {
        subject: '【{{applicationDefinition.name}}】通知: {{application.title}}',
        body: 'システムからの通知です。\n\nアプリ: {{applicationDefinition.name}}\n\n{{input.message}}'
    }
};

/**
 * メール送信タスクハンドラー
 * 非同期でメール送信を実行する
 */
@Injectable()
export class EmailTaskHandler implements ITaskHandler {
    private readonly logger = new Logger(EmailTaskHandler.name);

    constructor(
        private readonly mailService: MailService,
        private readonly helper: WorkflowHelperService,
        private readonly prisma: PrismaService,
    ) {}

    get taskType(): string {
        return 'sendEmail';
    }

    async execute(context: TaskContext): Promise<TaskResult> {
        const { taskId, nodeId, nodeData, inputData, applicantId, applicationId } = context;
        this.logger.log(`Executing Email Task ${taskId} (Node: ${nodeId})`);

        try {
            // Fetch fresh Application data including Definition
            const application = await this.prisma.application.findUnique({
                where: { id: applicationId },
                include: {
                    applicationDefinition: true
                }
            });

            const config = nodeData || {};
            let templateSubject = '';
            let templateBody = '';

            // Template resolution
            if (config.templateId && EMAIL_TEMPLATES[config.templateId]) {
                const tmpl = EMAIL_TEMPLATES[config.templateId];
                templateSubject = tmpl.subject;
                templateBody = tmpl.body;
            }

            // Fallback to configured subject/body if no template or override?
            // Usually template overrides manual input, or manual input overrides template if provided?
            // Let's assume manual input takes precedence if provided (allowing customization), 
            // OR if template is selected, use template.
            // UI usually clears manual input when template selected.
            // Let's use config values if present, else template.
            
            const rawSubject = config.subject || templateSubject;
            const rawBody = config.body || templateBody;

            // Simple substitution logic (using helper's logic if available, but helper needs whole context object)
            // Helper's substituteVariables takes (text, context).
            
            // Fetch applicant info for better substitution
            const applicantUser = await this.helper.resolveAssignedToSnapshot(`user:${applicantId}`);
            const applicantName = applicantUser ? `${applicantUser.lastName} ${applicantUser.firstName}` : applicantId;

            const substitutionData = {
                ...inputData,
                application: { 
                    ...inputData, 
                    ...(application || {}), 
                    title: (application?.title || inputData.title) || '（件名なし）', 
                    id: context.applicationId 
                },
                applicationDefinition: application?.applicationDefinition || {}, 
                applicant: { 
                    id: applicantId,
                    name: applicantName,
                    ...applicantUser
                },
                applicationUrl: `${process.env.APP_URL || 'http://localhost:3000'}/applications/${context.applicationId}`,
                input: inputData,
                env: { APP_URL: process.env.APP_URL || 'http://localhost:3000' },
                task: { id: taskId, nodeId }
            };
            
            // Note: We need to fetch applicant details for substitution?
            // Input data might not have username.
            // Let's try to fetch applicant snapshot for better substitution?
            // For performance, maybe just use what we have. 
            // MailService usually fetches user data? No, MailService sends generic mail.
            
            const toStr = this.helper.substituteVariables(config.to, substitutionData);
            const subject = this.helper.substituteVariables(rawSubject, substitutionData);
            const body = this.helper.substituteVariables(rawBody, substitutionData);
            
            // Resolve Recipients
            // config.to can be "user:A, group:B, applicant"
            const toList = await this.helper.resolveEmails(toStr, applicantId);

            if (toList.length === 0) {
                // If "to" was specified but resolved to nothing (e.g. empty group), validation failed?
                // Or if "to" was empty to begin with.
                if (!toStr) throw new Error('Email "to" address is missing');
                this.logger.warn(`Email task ${taskId}: Resolved 0 recipients from "${toStr}"`);
                // Should fail or skip?
                // Failing allows retry or correction.
                throw new Error(`Resolved 0 recipients from "${toStr}"`);
            }

            this.logger.log(`Sending email to ${toList.length} recipients: ${toList.join(', ')}`);
            
            // Send to all
            await Promise.all(toList.map(email => this.mailService.sendEmail(email, subject, body)));

            return {
                success: true,
                shouldAdvance: true,
                outputData: {
                    [`email_sent_${nodeId}`]: true,
                    [`email_to_${nodeId}`]: toStr
                }
            };

        } catch (error) {
            this.logger.error(`Failed to send email task ${taskId}`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                shouldAdvance: false // 失敗時は進まない (リトライされる)
            };
        }
    }
}
