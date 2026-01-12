import { Injectable, Logger } from '@nestjs/common';
import { ITaskHandler, TaskContext, TaskResult } from '../task-handler.interface';

/**
 * API呼び出しハンドラー
 * 外部APIへのHTTPリクエストを実行
 */
@Injectable()
export class ApiCallHandler implements ITaskHandler {
  private readonly logger = new Logger('[Worker] ApiCallHandler');
  readonly taskType = 'apiCall';

  async execute(context: TaskContext): Promise<TaskResult> {
    const { nodeData, inputData } = context;

    try {
      // URL、ヘッダー、ボディの変数置換
      const url = this.replaceVariables(nodeData.url || '', inputData);
      const method = nodeData.method || 'GET';
      const headersStr = this.replaceVariables(nodeData.headers || '{}', inputData);
      const bodyStr = this.replaceVariables(nodeData.body || '{}', inputData);

      // ヘッダーのパース
      let parsedHeaders: Record<string, string> = {};
      try {
        parsedHeaders = JSON.parse(headersStr);
      } catch {
        // パース失敗時は空オブジェクト
      }

      // 非ASCII文字のエンコード
      const safeHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsedHeaders)) {
        const isAscii = /^[\x00-\x7F]*$/.test(value);
        safeHeaders[key] = isAscii ? value : encodeURIComponent(value);
      }

      // ボディの準備
      let bodyPayload: string | undefined = undefined;
      if (method !== 'GET' && method !== 'HEAD') {
        try {
          const parsed = JSON.parse(bodyStr);
          bodyPayload = JSON.stringify(parsed);
        } catch {
          bodyPayload = bodyStr;
        }
      }

      this.logger.log(`Executing API Call: ${method} ${url}`);

      // リクエスト送信
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...safeHeaders,
        },
        body: bodyPayload,
      });

      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { text: responseText };
      }

      // 成功コードの判定
      const successCodesStr = nodeData.successCodes || '200,201,204';
      const successCodesList = successCodesStr
        .split(',')
        .map((c: string) => parseInt(c.trim(), 10))
        .filter((n: number) => !isNaN(n));
      const isSuccess = successCodesList.includes(response.status);
      const errorBehavior = nodeData.errorBehavior || 'stop';

      if (!isSuccess) {
        if (errorBehavior === 'stop') {
          return {
            success: false,
            error: `API Error: ${response.status} ${response.statusText} - ${responseText}`,
            shouldAdvance: false,
          };
        } else {
          // エラーだが続行
          this.logger.warn(`API returned ${response.status} but continuing due to errorBehavior=continue`);
        }
      }


      // レスポンスマッピング処理
      const outputData: Record<string, any> = {};
      const responseMappingStr = nodeData.responseMapping;
      
      this.logger.debug(`Response mapping string: ${responseMappingStr}`);
      this.logger.debug(`Response Data keys: ${responseData ? Object.keys(responseData).join(',') : 'null'}`);

      if (responseMappingStr) {
        try {
          const mapping = JSON.parse(responseMappingStr);
          this.logger.debug(`Parsed mapping: ${JSON.stringify(mapping)}`);

          for (const [responsePath, formFieldId] of Object.entries(mapping)) {
            const value = this.getValueByPath(responseData, responsePath);
            this.logger.debug(`Mapping attempt: Path="${responsePath}" -> Field="${formFieldId}" Value="${value}"`);
            
            if (value !== undefined) {
              outputData[formFieldId as string] = value;
            } else {
                this.logger.warn(`Mapping failed: Value not found for path "${responsePath}" in response data`);
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
          _statusCode: response.status,
          _response: responseData,
        },
        shouldAdvance: true,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`API call failed: ${errorMessage}`);
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
