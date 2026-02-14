import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ExtractParametersRequest {
  text: string;
  requiredSlots: string[];
  provider?: string;
  model?: string;
}

export interface ExtractParametersResponse {
  extractedData: Record<string, any>;
  missingSlots: string[];
  reasoning: string;
}

export interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface SlotFillingResponse {
  extractedInfo: Record<string, any>;
  missingFields: string[];
  nextQuestion: string;
  isComplete: boolean;
}

@Injectable()
export class AiSlotFillingService {
  private readonly logger = new Logger(AiSlotFillingService.name);

  constructor(
    private readonly llmGateway: LlmGatewayService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * テキストから必須パラメータを抽出
   */
  async extractParameters(
    request: ExtractParametersRequest,
  ): Promise<ExtractParametersResponse> {
    this.logger.log('Extracting parameters from user input');

    const systemPrompt = `
You are a parameter extraction assistant.
Your task is to extract required parameters from the user's input.

Rules:
1. Extract as many required parameters as possible from the input.
2. For missing parameters, list them in "missingSlots".
3. Provide reasoning in Japanese.
4. Output must be in JSON format.

Output JSON Format:
{
  "extractedData": { "key": "value" },
  "missingSlots": ["slot1", "slot2"],
  "reasoning": "string"
}
`;

    const userPrompt = `
User Input: "${request.text}"

Required Parameters:
${request.requiredSlots.join(', ')}

Extract available parameters and identify missing ones.
`;

    const response = await this.llmGateway.generate({
      systemPrompt,
      userPrompt,
      responseFormat: 'json_object',
      provider: request.provider,
      model: request.model || 'qwen2.5-coder:14b',
      temperature: 0.1,
    });

    return response.content as ExtractParametersResponse;
  }

  /**
   * ApplicationDefinitionからフォームフィールドを抽出
   */
  async extractFormFields(appDefinitionId: string): Promise<FormField[]> {
    this.logger.log(`Extracting form fields for app ${appDefinitionId}`);

    const appDef = await this.prisma.applicationDefinition.findUnique({
      where: { id: appDefinitionId },
      include: { formDefinition: true },
    });

    if (!appDef || !appDef.formDefinition) {
      throw new NotFoundException('Application definition or form not found');
    }

    const formSchema = appDef.formDefinition.schema as any;
    const fields: FormField[] = [];

    // スキーマからフィールドを抽出
    if (formSchema.properties) {
      for (const [fieldId, fieldDef] of Object.entries(formSchema.properties)) {
        const def = fieldDef as any;
        let type = def.type || 'string';

        // ファイルタイプの判定
        if (
          def.type === 'file' ||
          def['x-type'] === 'file' ||
          (def.type === 'string' && def.format === 'binary')
        ) {
          type = 'file';
        } else if (def.format) {
          type = `${def.type} (${def.format})`;
        }

        fields.push({
          id: fieldId,
          label: def.title || fieldId,
          type: type,
          required: formSchema.required?.includes(fieldId) || false,
          description: def.description,
        });
      }
    }

    return fields;
  }

  /**
   * スロットフィリング - LLMを使用して情報を抽出
   */
  async performSlotFilling(
    appId: string,
    userMessage: string,
    currentSlots: Record<string, any>,
    history: Array<{ role: string; content: string }> = [],
    appName?: string,
    appDescription?: string,
  ): Promise<SlotFillingResponse> {
    this.logger.log(`Performing slot filling for app ${appId} (${appName})`);

    const fields = await this.extractFormFields(appId);
    this.logger.log(`Extracted fields count: ${fields.length}`);

    const systemPrompt = `
あなたは情報収集アシスタントです。
ユーザーとの会話から必要な情報を抽出してください。

## 対象アプリケーション:
- アプリ名: ${appName || '不明'}
- 説明: ${appDescription || 'なし'}
- **重要**: ユーザーの入力がこのアプリケーションに関連するかどうかを判断し、関連する場合のみ情報を抽出してください。

## 必要な情報フィールド:
${fields.map((f) => `- ${f.label} (${f.id}): ${f.type}${f.required ? ' [必須]' : ' [任意]'}${f.description ? ` - ${f.description}` : ''}`).join('\n')}

## 現在収集済みの情報:
${JSON.stringify(currentSlots, null, 2)}

## タスク:
1. ユーザーの最新メッセージから情報を抽出
   - **重要**: 必須フィールドだけでなく、**任意フィールド**も積極的に抽出してください。
   - **重要**: 既に値が入っているフィールドでも、ユーザーが新しい値を指定した場合は**上書き更新**してください。
2. まだ不足している必須フィールド、任意フィールドを特定
3. 次に聞くべき質問を生成
   - **優先順位1**: 不足している必須フィールドについて質問してください。
   - **優先順位2**: 必須フィールドが揃っていても、未入力の任意フィールドがある場合は、「〇〇（任意項目）については入力しますか？」と確認してください。
   - **優先順位3**: 全ての情報が揃った、またはユーザーが「ない」「不要」と言った場合は質問なし（完了）としてください。
4. 完了判定
   - 必須情報が全て揃っており、かつユーザーへの確認事項がなければ完了フラグを立ててください。

## コメント・補足情報の抽出:
- フォーム定義に \`notes\`, \`description\`, \`remarks\`, \`comment\` などのテキストフィールドが存在する場合、ユーザーのメッセージに含まれる補足的な発言やコメントをそのフィールドに抽出してください。
- ファイルアップロード時のコメント（例:「領収書です。接待費として計上します」）は特に重要です。この場合、「接待費として計上します」の部分をコメントフィールドに抽出してください。

## データ形式:
各フィールドの値は以下のフォーマットに従ってください:
- **数値 (number/integer)**: 半角数字のみを使用してください。カンマ、単位、全角数字は含めないでください。(例: 3000)
- **日付 (date/datetime)**: YYYY-MM-DD 形式または YYYY-MM-DD HH:mm:ss 形式で抽出してください。(例: 2024-01-15)
- **真偽値 (boolean)**: true または false のみを使用してください。(例: true)

## ファイル添付に関するルール:
- ユーザーメッセージ履歴に「ファイルをアップロードしました: [ファイル名] (ID: [UUID])」のようなメッセージが含まれている場合、そのファイルID（UUID）を抽出してください。
- フォームフィールドに \`type: file\` または \`attachment\` という名前のフィールドがあり、ユーザーがファイルをアップロード済みの場合は、その **ファイルID** を抽出値として使用してください。
- **重要**: ファイル名は抽出しないでください。必ずUUID形式のIDを使用してください。
- **重要**: JSONのキー（フィールドID）は、必ず上記の「必要な情報フィールド」に記載されているIDと完全に一致させてください。勝手に新しいID（例: receipt_file）を作らないでください。
- 抽出例: {"receipt": "550e8400-e29b-41d4-a716-446655440000"}

## 回答形式:
以下のJSON形式で回答してください:
{
  "extractedInfo": {
    "フィールドID": "抽出した値"
  },
  "missingFields": ["不足しているフィールドID"],
  "nextQuestion": "次に聞くべき質問（日本語）",
  "isComplete": false
}
`;

    const historyText = history
      .slice(-10)
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `
## 会話履歴:
${historyText}

## 最新のメッセージ:
"${userMessage}"
`;

    try {
      this.logger.log(`Calling LLM Gateway. User Prompt:\n${userPrompt}`);
      const response = await this.llmGateway.generate({
        model: this.configService.get('AI_CHAT_MODEL', 'qwen2.5:14b'),
        systemPrompt,
        userPrompt,
        temperature: 0.1, // 温度を下げて抽出精度を上げる
      });

      this.logger.log(`LLM raw response: ${response.rawContent}`);

      const parsed = JSON.parse(response.rawContent);

      this.logger.log(
        `Parsed extractedInfo: ${JSON.stringify(parsed.extractedInfo)}`,
      );
      this.logger.log(
        `Available fields: ${JSON.stringify(fields.map((f) => ({ id: f.id, type: f.type })))}`,
      );

      // キーごとに型変換を実行
      const convertedInfo: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsed.extractedInfo || {})) {
        const field = fields.find((f) => f.id === key);
        this.logger.log(
          `Converting field "${key}": value="${value}", fieldType="${field?.type || 'unknown'}"`,
        );
        if (field) {
          convertedInfo[key] = this.convertValue(value, field.type, key);
        } else {
          convertedInfo[key] = value;
        }
        this.logger.log(
          `Converted "${key}": ${convertedInfo[key]} (${typeof convertedInfo[key]})`,
        );
      }

      return {
        extractedInfo: convertedInfo,
        missingFields: parsed.missingFields || [],
        nextQuestion: parsed.nextQuestion || '',
        isComplete: parsed.isComplete || false,
      };
    } catch (error) {
      this.logger.error('Failed to perform slot filling', error);
      throw error;
    }
  }

  /**
   * 値をフィールド型に合わせて変換
   */
  private convertValue(value: any, type: string, fieldId?: string): any {
    if (value === null || value === undefined) return null;

    // もし値がオブジェクトで、idプロパティを持っている場合（LLMが誤ってオブジェクトを返した場合の救済措置）
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (value.id) return value.id;
      if (value.field_id) return value.field_id;
      if (value.file_id) return value.file_id;
      // 値として使えそうなプロパティが見つからない場合は、JSON文字列化して返す（Reactエラー回避のため）
      return JSON.stringify(value);
    }

    // 型情報からフォーマットを除去 ("number (currency)" -> "number")
    const baseType = type.split(' ')[0].trim();

    // 金額関連のフィールド名は強制的に数値変換を試みる
    const isAmountField =
      fieldId && /amount|price|cost|fee|salary|total|sum/i.test(fieldId);

    switch (baseType) {
      case 'number':
      case 'integer':
        return this.convertToNumber(value);

      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lower = value.toLowerCase().trim();
          if (['true', 'yes', 'on', '1'].includes(lower)) return true;
          if (['false', 'no', 'off', '0'].includes(lower)) return false;
        }
        return value;

      case 'date':
      case 'datetime':
        return value;

      default:
        // フィールド名が金額を示唆する場合は数値変換を試みる
        if (isAmountField && typeof value === 'string') {
          const numValue = this.convertToNumber(value);
          if (typeof numValue === 'number') return numValue;
        }
        return value;
    }
  }

  /**
   * 文字列を数値に変換（カンマや単位を除去）
   */
  private convertToNumber(value: any): any {
    if (typeof value === 'number') return value;

    if (typeof value === 'string') {
      // 全角数字を半角数字に変換
      const zenkaku = value.replace(/[０-９]/g, (s) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
      });

      // 3桁区切りのカンマを除去し、数字・小数点・マイナス以外を除去
      const cleanStr = zenkaku.replace(/,/g, '').replace(/[^0-9.-]/g, '');
      if (cleanStr === '') return value; // 数字が含まれていない場合は元の値を返す
      const num = Number(cleanStr);
      return isNaN(num) ? value : num;
    }

    const num = Number(value);
    return isNaN(num) ? value : num;
  }
}
