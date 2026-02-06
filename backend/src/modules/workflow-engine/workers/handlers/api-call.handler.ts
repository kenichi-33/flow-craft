import { Injectable, Logger } from '@nestjs/common';
import {
  ITaskHandler,
  TaskContext,
  TaskResult,
} from '../task-handler.interface';
import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * API呼び出しハンドラー
 * 外部APIへのHTTPリクエストを実行
 */
@Injectable()
export class ApiCallHandler implements ITaskHandler {
  private readonly logger = new Logger('[Worker] ApiCallHandler');
  readonly taskType = 'apiCall';

  constructor(private readonly prisma: PrismaService) {}

  async execute(context: TaskContext): Promise<TaskResult> {
    const { nodeData, inputData, applicationId, taskId, nodeId } = context;

    // Check Test Mode
    const application = await this.prisma.application.findUnique({
        where: { id: applicationId },
        select: { isTestMode: true },
    });

    if (application?.isTestMode) {
        this.logger.log(`[TEST MODE] Skipping API Call Task ${taskId}`);
        return {
        success: true,
        shouldAdvance: true,
        outputData: {
            [`api_skipped_${nodeId}`]: true,
            _statusCode: 200,
            _response: { message: 'Skipped in Test Mode' },
        },
        };
    }

    const retryCount = parseInt(nodeData.retryCount || '0', 10);
    const retryInterval = parseInt(nodeData.retryInterval || '1000', 10);
    const timeout = parseInt(nodeData.timeout || '5000', 10);

    // 認証設定の準備
    const authHeaders: Record<string, string> = {};
    const authQueryParams: Record<string, string> = {};

    const authType = nodeData.authType || 'none';
    if (authType === 'basic') {
      const username = this.replaceVariables(
        nodeData.authUsername || '',
        inputData,
      );
      const password = this.replaceVariables(
        nodeData.authPassword || '',
        inputData,
      );
      const token = Buffer.from(`${username}:${password}`).toString('base64');
      authHeaders['Authorization'] = `Basic ${token}`;
    } else if (authType === 'bearer') {
      const token = this.replaceVariables(nodeData.authToken || '', inputData);
      authHeaders['Authorization'] = `Bearer ${token}`;
    } else if (authType === 'apikey') {
      const keyName = this.replaceVariables(
        nodeData.authApiKeyName || '',
        inputData,
      );
      const keyValue = this.replaceVariables(
        nodeData.authApiKeyValue || '',
        inputData,
      );
      const location = nodeData.authApiKeyIn || 'header';
      if (location === 'header') {
        authHeaders[keyName] = keyValue;
      } else {
        authQueryParams[keyName] = keyValue;
      }
    }

    let finalResponse: {
      status: number;
      statusText: string;
      text: string;
    } | null = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.log(
            `Retrying API call (attempt ${attempt}/${retryCount})...`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryInterval));
        }

        // URL、ヘッダー、ボディの変数置換
        let url = this.replaceVariables(nodeData.url || '', inputData);
        const method = nodeData.method || 'GET';
        const headersStr = this.replaceVariables(
          nodeData.headers || '{}',
          inputData,
        );
        const bodyStr = this.replaceVariables(nodeData.body || '{}', inputData);

        // Query Params for API Key
        if (Object.keys(authQueryParams).length > 0) {
          const urlObj = new URL(url);
          for (const [k, v] of Object.entries(authQueryParams)) {
            urlObj.searchParams.append(k, v);
          }
          url = urlObj.toString();
        }

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
          // Check if all characters are ASCII (0-127)
          // eslint-disable-next-line no-control-regex
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

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              ...safeHeaders,
              ...authHeaders,
            },
            body: bodyPayload,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const responseText = await response.text();
          finalResponse = {
            status: response.status,
            statusText: response.statusText,
            text: responseText,
          };

          // 成功判定 (成功ならループ抜ける)
          // ただし、ネットワークエラー以外は fetch は成功する。
          // 4xx/5xx もここでは「成功」として扱い、後段で successCodes で判定する。
          // もし 5xx でリトライしたい場合はここで throw する必要がある。
          // 今回は「ネットワークエラー/タイムアウト」のみリトライ対象とするのが自然だが、
          // 5xx もリトライしたい場合がある。
          // 簡易的に、fetch自体が成功すればループを抜けることにする。
          // (ユーザー要件: Retry Policy - usually covers connection errors & 5xx.
          // But implementing smart retry policies is complex. Let's stick to simple retry on exception for now, maybe throw on 5xx if requested?
          // Let's assume fetch exception (network/timeout) triggers retry.)

          break;
        } catch (e: any) {
          clearTimeout(timeoutId);
          throw e;
        }
      } catch (error) {
        this.logger.warn(`API attempt ${attempt} failed: ${String(error)}`);
        if (attempt === retryCount) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `API Retry Limit Exceeded: ${errorMessage}`,
            shouldAdvance: false,
          };
        }
      }
    }

    if (!finalResponse) {
      // Should catch inside loop, but just in case
      return { success: false, error: 'Unknown error', shouldAdvance: false };
    }

    let responseData: any;
    try {
      responseData = JSON.parse(finalResponse.text);
    } catch {
      responseData = { text: finalResponse.text };
    }

    // 成功コードの判定
    const successCodesStr = nodeData.successCodes || '200,201,204';
    const successCodesList = successCodesStr
      .split(',')
      .map((c: string) => parseInt(c.trim(), 10))
      .filter((n: number) => !isNaN(n));
    const isSuccess = successCodesList.includes(finalResponse.status);
    const errorBehavior = nodeData.errorBehavior || 'stop';

    if (!isSuccess) {
      if (errorBehavior === 'stop') {
        return {
          success: false,
          error: `API Error: ${finalResponse.status} ${finalResponse.statusText} - ${finalResponse.text}`,
          shouldAdvance: false,
        };
      } else {
        // エラーだが続行
        this.logger.warn(
          `API returned ${finalResponse.status} but continuing due to errorBehavior=continue`,
        );
      }
    }

    // レスポンスマッピング処理
    const outputData: Record<string, any> = {};
    const responseMappingStr = nodeData.responseMapping;

    this.logger.debug(`Response mapping string: ${responseMappingStr}`);

    if (responseMappingStr) {
      try {
        const mapping = JSON.parse(responseMappingStr);

        // Flatten response data for easier mapping if needed, or just use dot notation getter
        for (const [responsePath, formFieldId] of Object.entries(mapping)) {
          const value = this.getValueByPath(responseData, responsePath);

          if (value !== undefined) {
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
        _statusCode: finalResponse.status,
        _response: responseData,
      },
      shouldAdvance: true,
    };
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
