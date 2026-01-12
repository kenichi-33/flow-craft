import { Injectable, Logger } from '@nestjs/common';
import { ITaskHandler, TaskContext, TaskResult } from '../task-handler.interface';

/**
 * LLM呼び出しハンドラー
 * LLM（大規模言語モデル）へのリクエストを実行
 * 現在はモック実装
 */
@Injectable()
export class LlmCallHandler implements ITaskHandler {
  private readonly logger = new Logger('[Worker] LlmCallHandler');
  readonly taskType = 'llmCall';

  async execute(context: TaskContext): Promise<TaskResult> {
    const { nodeData, inputData } = context;

    try {
      const prompt = this.replaceVariables(nodeData.prompt || '', inputData);
      this.logger.log(`Executing LLM Call with prompt: ${prompt.substring(0, 100)}...`);

      // TODO: 実際のLLM API統合
      // 現在はモックレスポンス
      const response = {
        response: `This is a mock response for prompt: "${prompt}". LLM integration is not yet configured.`,
        timestamp: new Date().toISOString(),
      };

      // レスポンスマッピング処理
      const outputData: Record<string, any> = {};
      const responseMappingStr = nodeData.responseMapping;
      if (responseMappingStr) {
        try {
          const mapping = JSON.parse(responseMappingStr);
          for (const [responsePath, formFieldId] of Object.entries(mapping)) {
            const value = this.getValueByPath(response, responsePath);
            if (value !== undefined) {
              this.logger.debug(`Mapping response: ${responsePath} -> ${formFieldId}`);
              outputData[formFieldId as string] = value;
            }
          }
        } catch (e) {
          this.logger.error('Failed to process response mapping', e);
        }
      }

      return {
        success: true,
        outputData: {
          ...outputData,
          _llmResponse: response,
        },
        shouldAdvance: true,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`LLM call failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        shouldAdvance: false,
      };
    }
  }

  /**
   * 変数置換 {{variable}} -> 値
   */
  private replaceVariables(text: string, data: any): string {
    if (!text) return '';
    return text.replace(/\{\{(.+?)\}\}/g, (_, key) => {
      const path = key.trim();
      const value = this.getValueByPath(data, path);
      return value !== undefined ? String(value) : '';
    });
  }

  /**
   * ドット記法でオブジェクトから値を取得
   */
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
