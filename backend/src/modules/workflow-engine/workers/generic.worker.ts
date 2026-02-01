import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { TaskHandlerRegistry } from './task-handler.registry';
import {
  TaskExecuteJob,
  TaskCompleteJob,
  TaskContext,
} from './task-handler.interface';
import { TaskStatus } from '@prisma/client';

/**
 * 汎用ワーカー
 * キューからタスク実行ジョブを受信し、適切なハンドラーで実行
 */
@Injectable()
export class GenericWorker implements OnModuleInit {
  private readonly logger = new Logger('[Worker] GenericWorker');

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly handlerRegistry: TaskHandlerRegistry,
  ) {}

  async onModuleInit() {
    await this.queueService.registerHandler(
      'TASK_EXECUTE',
      this.processJob.bind(this),
    );
    this.logger.log('GenericWorker registered for TASK_EXECUTE queue');
  }

  /**
   * タスク実行ジョブを処理
   */
  async processJob(job: TaskExecuteJob): Promise<void> {
    const {
      taskId,
      applicationId,
      nodeId,
      nodeType,
      nodeData,
      inputData,
      applicantId,
    } = job;

    this.logger.log(
      `Processing task ${taskId} (type: ${nodeType}) for application ${applicationId}`,
    );

    // 1. 実行ガード: ステータスが QUEUED のものだけを RUNNING に変更
    const workerId = process.env.HOSTNAME || `worker-${process.pid}`;

    // Note: status check enforces exactly-once execution (at DB level)
    const updateResult = await this.prisma.workflowTask.updateMany({
      where: {
        id: taskId,
        status: 'QUEUED',
      },
      data: {
        status: 'RUNNING',
        workerId: workerId,
        updatedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      this.logger.warn(
        `Task ${taskId} is not in QUEUED state (possibly already running or completed). Skipping execution.`,
      );
      return;
    }

    this.logger.log(
      `Locked task ${taskId} for execution (worker: ${workerId})`,
    );

    try {
      // 2. ハンドラーを取得
      const handler = this.handlerRegistry.getHandler(nodeType);
      if (!handler) {
        throw new Error(`No handler registered for task type: ${nodeType}`);
      }

      // 3. コンテキストを構築して実行
      const context: TaskContext = {
        taskId,
        applicationId,
        nodeId,
        nodeType,
        nodeData,
        inputData,
        applicantId,
      };

      const result = await handler.execute(context);

      // 4. 結果に応じてステータス更新
      if (result.success) {
        // トランザクションで一括更新
        const txnResult = await this.prisma.$transaction(async (tx) => {
          const updateData: any = {
            result: result.outputData || {},
          };

          this.logger.debug(
            `Task ${taskId} result success. shouldAdvance=${result.shouldAdvance} (type=${typeof result.shouldAdvance})`,
          );

          // shouldAdvanceがfalseでない場合のみ完了ステータスに更新
          // (承認タスクなどはfalseを返すためPENDINGのまま維持される)
          if (result.shouldAdvance !== false) {
            updateData.status = TaskStatus.COMPLETED;
            this.logger.debug(`Task ${taskId} marking as COMPLETED`);
          } else {
            updateData.status = TaskStatus.PENDING;
            this.logger.debug(
              `Task ${taskId} reverting to PENDING (shouldAdvance is false)`,
            );
          }

          await tx.workflowTask.update({
            where: { id: taskId },
            data: updateData,
          });

          let shouldIndex = false;

          if (result.outputData && Object.keys(result.outputData).length > 0) {
            await tx.application.update({
              where: { id: applicationId },
              data: {
                inputData: { ...inputData, ...result.outputData },
              },
            });
            shouldIndex = true;
          }

          // 実行履歴を記録 (システムタスクの再実行履歴など)
          await tx.workflowTaskHistory.create({
            data: {
              taskId,
              applicationId,
              stepId: nodeId,
              type: nodeType,
              status: updateData.status || TaskStatus.PENDING, // 完了していない場合はPENDINGとして記録(または直前の状態)
              result: result.outputData || {},
              executedAt: new Date(),
            },
          });

          return { updateData, shouldIndex };
        });

        if (txnResult.shouldIndex) {
          await this.queueService.enqueue('application-indexing', {
            applicationId,
          });
        }
      } else {
        await this.prisma.$transaction(async (tx) => {
          await tx.workflowTask.update({
            where: { id: taskId },
            data: {
              status: TaskStatus.FAILED,
              error: result.error,
            },
          });

          // 失敗履歴を記録
          await tx.workflowTaskHistory.create({
            data: {
              taskId,
              applicationId,
              stepId: nodeId,
              type: nodeType,
              status: TaskStatus.FAILED,
              error: result.error,
              executedAt: new Date(),
            },
          });
        });
      }

      // 5. 完了通知を送信
      const completeJob: TaskCompleteJob = {
        taskId,
        applicationId,
        nodeId,
        success: result.success,
        outputData: result.outputData,
        error: result.error,
        shouldAdvance: result.shouldAdvance ?? result.success,
      };

      await this.queueService.enqueue('TASK_COMPLETE', completeJob);
      this.logger.log(
        `Task ${taskId} completed with success=${result.success}`,
      );
    } catch (error) {
      // 例外発生時
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Task ${taskId} failed with error: ${errorMessage}`);

      await this.prisma.$transaction(async (tx) => {
        await tx.workflowTask.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.FAILED,
            error: errorMessage,
          },
        });

        // 例外発生時の履歴記録
        await tx.workflowTaskHistory.create({
          data: {
            taskId,
            applicationId,
            stepId: nodeId,
            type: nodeType,
            status: TaskStatus.FAILED,
            error: errorMessage,
            executedAt: new Date(),
          },
        });
      });

      // 完了通知（失敗）
      const completeJob: TaskCompleteJob = {
        taskId,
        applicationId,
        nodeId,
        success: false,
        error: errorMessage,
        shouldAdvance: false,
      };

      await this.queueService.enqueue('TASK_COMPLETE', completeJob);

      // PgBossのリトライ機構に任せるため再スロー
      throw error;
    }
  }

  /**
   * タスクステータスを更新
   * Note: QUEUED, RUNNINGはPrismaのTaskStatus enumには存在しないため、
   * 既存のPENDINGを使用（将来的にはenum拡張を検討）
   */
  // Removed unused updateTaskStatus method as it is replaced by the guard logic
  // private async updateTaskStatus(taskId: string, status: 'RUNNING'): Promise<void> { ... }
}
