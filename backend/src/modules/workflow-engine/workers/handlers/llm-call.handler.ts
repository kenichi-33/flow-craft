import { Injectable, Logger } from '@nestjs/common';
import {
  ITaskHandler,
  TaskContext,
  TaskResult,
} from '../task-handler.interface';

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
      const provider = nodeData.provider || 'openai';
      const model = nodeData.model || 'gpt-4o';
      let apiKey = nodeData.apiKey || '';
      let baseUrl = nodeData.baseUrl || '';

      // Environment variable fallback
      if (!apiKey) {
        if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY || '';
        if (provider === 'anthropic')
          apiKey = process.env.ANTHROPIC_API_KEY || '';
      }

      const prompt = this.replaceVariables(nodeData.prompt || '', inputData);
      const systemPrompt = this.replaceVariables(
        nodeData.systemPrompt || '',
        inputData,
      );
      const temperature = Number(nodeData.temperature ?? 0.7);

      this.logger.log(
        `Executing LLM Call (${provider}/${model}) with prompt: ${prompt.substring(0, 50)}...`,
      );

      let responseText = '';
      let responseObj: any = {};

      if (provider === 'openai') {
        const url = 'https://api.openai.com/v1/chat/completions';
        const body = {
          model,
          messages: [
            ...(systemPrompt
              ? [{ role: 'system', content: systemPrompt }]
              : []),
            { role: 'user', content: prompt },
          ],
          temperature,
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OpenAI API Error: ${res.status} ${errText}`);
        }

        responseObj = await res.json();
        responseText = responseObj.choices?.[0]?.message?.content || '';
      } else if (provider === 'anthropic') {
        const url = 'https://api.anthropic.com/v1/messages';
        const body = {
          model,
          max_tokens: 4096,
          temperature,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Anthropic API Error: ${res.status} ${errText}`);
        }

        responseObj = await res.json();
        responseText = responseObj.content?.[0]?.text || '';
      } else if (provider === 'ollama') {
        if (!baseUrl) baseUrl = 'http://host.docker.internal:11434';
        const url = `${baseUrl.replace(/\/$/, '')}/api/chat`; // Chat API
        const body = {
          model,
          messages: [
            ...(systemPrompt
              ? [{ role: 'system', content: systemPrompt }]
              : []),
            { role: 'user', content: prompt },
          ],
          options: {
            temperature,
          },
          stream: false,
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Ollama API Error: ${res.status} ${errText}`);
        }

        responseObj = await res.json();
        responseText = responseObj.message?.content || '';
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }

      // Output Mapping
      const outputField = nodeData.outputField || 'llmResponse';
      const outputData: Record<string, any> = {
        [outputField]: responseText,
      };

      // Additional mapping if needed
      const responseMappingStr = nodeData.responseMapping;
      if (responseMappingStr) {
        try {
          const mapping = JSON.parse(responseMappingStr);
          for (const [responsePath, formFieldId] of Object.entries(mapping)) {
            const value = this.getValueByPath(responseObj, responsePath);
            if (value !== undefined) {
              outputData[formFieldId as string] = value;
            }
          }
        } catch (e) {
          this.logger.warn('Failed to process additional response mapping', e);
        }
      }

      return {
        success: true,
        outputData: {
          ...outputData,
          _llmRawResponse: responseObj,
        },
        shouldAdvance: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
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
