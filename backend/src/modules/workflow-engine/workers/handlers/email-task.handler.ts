import { Injectable, Logger } from '@nestjs/common';
import { ITaskHandler, TaskContext, TaskResult } from '../task-handler.interface';
import { MailService } from '../../../notifications/mail.service';

/**
 * メール送信タスクハンドラー
 * 非同期でメール送信を実行する
 */
@Injectable()
export class EmailTaskHandler implements ITaskHandler {
    private readonly logger = new Logger(EmailTaskHandler.name);

    constructor(
        private readonly mailService: MailService,
    ) {}

    get taskType(): string {
        return 'sendEmail';
    }

    async execute(context: TaskContext): Promise<TaskResult> {
        const { taskId, nodeId, nodeData, inputData, applicantId } = context;
        this.logger.log(`Executing Email Task ${taskId} (Node: ${nodeId})`);

        try {
            // 変数置換はProcessorで行うか、ここで行うか？
            // Processorで行ったほうが「送信予定内容」として記録しやすいが、
            // 変数がHandler実行時(遅延後)に評価されるべきならここ。
            // 今回はProcessorで置換済みの値が `nodeData` (config) に入っている前提ではなく、
            // Contextの `nodeData` はフロー定義そのもの。
            // よってここで置換を行う必要がある。ただし、GenericWorkerの実行コンテキストには Helper がない。
            // HelperServiceを注入して使うか、簡単な正規表現でやるか。
            // ここでは簡易実装として正規表現で行う。

            const config = nodeData || {};
            
            // シンプルな置換ロジック (HelperServiceと同等)
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
                input: inputData // alias
            };

            const to = substitute(config.to, substitutionData);
            const subject = substitute(config.subject, substitutionData);
            const body = substitute(config.body, substitutionData);

            if (!to) {
                throw new Error('Email "to" address is missing');
            }

            this.logger.log(`Sending email to ${to}`);
            
            await this.mailService.sendEmail(to, subject, body);

            return {
                success: true,
                shouldAdvance: true,
                outputData: {
                    [`email_sent_${nodeId}`]: true,
                    [`email_to_${nodeId}`]: to
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
