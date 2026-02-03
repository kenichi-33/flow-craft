import { Injectable, Logger } from '@nestjs/common';
import {
  ITaskHandler,
  TaskContext,
  TaskResult,
} from '../task-handler.interface';
import axios from 'axios';

@Injectable()
export class GraphQLTaskHandler implements ITaskHandler {
  private readonly logger = new Logger(GraphQLTaskHandler.name);

  get taskType(): string {
    return 'graphql';
  }

  async execute(context: TaskContext): Promise<TaskResult> {
    const { nodeId, nodeData, inputData } = context;
    const {
      endpoint,
      headers: headerConfig,
      operation, // query or mutation string
      variables: variableConfig, // JSON string
      responseMapping, // Record<string, string>
      authType,
      authUsername,
      authPassword,
      authToken,
      authApiKeyName,
      authApiKeyValue,
      authApiKeyIn,
      timeout,
    } = nodeData || {};

    if (!endpoint || !operation) {
      return {
        success: false,
        error: 'Configuration error: Missing endpoint or operation',
      };
    }

    try {
      // 1. Substitute Variables in Endpoint
      const url = this.substituteVariables(endpoint, inputData);

      // 2. Prepare Headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Custom Headers
      if (Array.isArray(headerConfig)) {
        for (const h of headerConfig) {
          if (h.key && h.value) {
            headers[h.key] = this.substituteVariables(h.value, inputData);
          }
        }
      }

      // Auth Headers
      if (authType === 'basic' && authUsername && authPassword) {
        const auth = Buffer.from(`${authUsername}:${authPassword}`).toString(
          'base64',
        );
        headers['Authorization'] = `Basic ${auth}`;
      } else if (authType === 'bearer' && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      } else if (authType === 'apiKey' && authApiKeyName && authApiKeyValue) {
        if (authApiKeyIn === 'header') {
          headers[authApiKeyName] = authApiKeyValue;
        }
      }

      // 3. Prepare Variables
      let variables = {};
      if (variableConfig) {
        const substitutedVars = this.substituteVariables(
          variableConfig,
          inputData,
        );
        try {
          variables = JSON.parse(substitutedVars);
        } catch {
          throw new Error('Variables JSON parsing failed');
        }
      }

      // 4. API Key in Query
      let finalUrl = url;
      if (
        authType === 'apiKey' &&
        authApiKeyIn === 'query' &&
        authApiKeyName &&
        authApiKeyValue
      ) {
        const sep = finalUrl.includes('?') ? '&' : '?';
        finalUrl += `${sep}${authApiKeyName}=${encodeURIComponent(authApiKeyValue)}`;
      }

      this.logger.log(`Executing GraphQL at ${finalUrl}`);

      const response = await axios.post(
        finalUrl,
        {
          query: operation,
          variables,
        },
        {
          headers,
          timeout: Number(timeout) || 10000,
        },
      );

      const responseData = response.data;

      if (responseData.errors && responseData.errors.length > 0) {
        throw new Error(
          `GraphQL execution returned errors: ${responseData.errors[0].message}`,
        );
      }

      const result = responseData.data;
      const outputData: Record<string, any> = {};

      // 5. Response Mapping
      if (responseMapping && Object.keys(responseMapping).length > 0) {
        for (const [targetField, sourcePath] of Object.entries(
          responseMapping,
        )) {
          const val = this.getValue(result, sourcePath as string);
          if (val !== undefined) {
            outputData[targetField] = val;
          }
        }
      }

      return {
        success: true,
        shouldAdvance: true,
        outputData,
      };
    } catch (e) {
      const msg = e.response?.data
        ? JSON.stringify(e.response.data)
        : e.message;
      this.logger.error(`GraphQL Node ${nodeId} failed: ${msg}`);
      return {
        success: false,
        error: `GraphQL Failed: ${msg}`,
      };
    }
  }

  // Helper methods (duplicated from WorkflowHelper for now, or could inject Helper)
  // Worker handlers are usually pure classes if possible, but we can inject WorkflowHelper if needed.
  // WorkflowHelper is in 'workflow-engine' module, handlers are in 'workers'.
  // We can just implement utility here to avoid circular deps or complex injection if simple.

  private substituteVariables(text: string, context: any): string {
    if (!text) return '';
    return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const keys = key.trim().split('.');
      let val = context;
      for (const k of keys) {
        val = val ? val[k] : undefined;
      }
      return val !== undefined ? String(val) : `{{${key}}}`;
    });
  }

  private getValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }
}
