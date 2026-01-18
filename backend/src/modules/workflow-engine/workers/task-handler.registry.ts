import { Injectable, Logger } from '@nestjs/common';
import { ITaskHandler } from './task-handler.interface';

/**
 * タスクハンドラーレジストリ
 * タスクタイプに対応するハンドラーを管理
 */
@Injectable()
export class TaskHandlerRegistry {
  private readonly logger = new Logger(TaskHandlerRegistry.name);
  private readonly handlers = new Map<string, ITaskHandler>();

  /**
   * ハンドラーを登録
   * @param handler 登録するハンドラー
   */
  register(handler: ITaskHandler): void {
    if (this.handlers.has(handler.taskType)) {
      this.logger.warn(`Handler for task type "${handler.taskType}" is being overwritten`);
    }
    this.handlers.set(handler.taskType, handler);
    this.logger.log(`Registered handler for task type: ${handler.taskType}`);
  }

  /**
   * エイリアス（別名）でハンドラーを登録
   * @param alias エイリアス名
   * @param handler ハンドラー
   */
  registerAlias(alias: string, handler: ITaskHandler): void {
    if (this.handlers.has(alias)) {
      this.logger.warn(`Handler for alias "${alias}" is being overwritten`);
    }
    this.handlers.set(alias, handler);
    this.logger.log(`Registered handler alias "${alias}" for task type: ${handler.taskType}`);
  }

  /**
   * 複数のハンドラーを一括登録
   * @param handlers 登録するハンドラーの配列
   */
  registerAll(handlers: ITaskHandler[]): void {
    for (const handler of handlers) {
      this.register(handler);
    }
  }

  /**
   * タスクタイプに対応するハンドラーを取得
   * @param taskType タスクタイプ
   * @returns ハンドラー（見つからない場合はundefined）
   */
  getHandler(taskType: string): ITaskHandler | undefined {
    return this.handlers.get(taskType);
  }

  /**
   * タスクタイプに対応するハンドラーが存在するか確認
   * @param taskType タスクタイプ
   */
  hasHandler(taskType: string): boolean {
    return this.handlers.has(taskType);
  }

  /**
   * 登録されている全タスクタイプを取得
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
