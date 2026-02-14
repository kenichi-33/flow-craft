import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
// We will need to inject ApplicationService, but we need to check module boundaries.
// For now, let's assume we can inject it or use Prisma directly if it's in a shared module.
// Checking imports...
import { ApplicationsService } from '../../applications/applications.service';

export interface FillFormRequest {
  prompt: string;
  formSchema: any;
  currentUser: {
    id: string;
    departmentName?: string;
    name?: string;
  };
}

export interface FillFormResponse {
  data: Record<string, any>;
  referenced_history_id: string | null;
  reasoning: string;
}

@Injectable()
export class AiFormFillerService {
  private readonly logger = new Logger(AiFormFillerService.name);

  constructor(
    private readonly llmGateway: LlmGatewayService,
    private readonly applicationService: ApplicationsService,
  ) {}

  async fillForm(request: FillFormRequest): Promise<FillFormResponse> {
    const { prompt, formSchema, currentUser } = request;

    // 1. Fetch History
    // Fetch last 5 approved applications for this user
    // We will implement `findApprovedHistory` in ApplicationsService
    const historyApps = await this.applicationService.findApprovedHistory(
      currentUser.id,
      5,
    );

    // 2. Minify History
    const minifiedHistory = historyApps.map((app) => ({
      id: app.id,
      title: app.title,
      submittedAt: app.createdAt,
      // We assume app.inputData contains the actual form values
      formData: app.inputData,
    }));

    // 3. Construct Prompts
    const systemPrompt = `
あなたは企業のワークフローシステムの入力支援AIです。
以下の「ユーザーの指示」と「過去の申請履歴」を分析し、
「フォーム定義(Schema)」に適合するJSONデータを生成してください。

【優先順位ルール】
1. ユーザーの指示(User Input)にある情報は最優先で使用する。
2. 指示にない項目は、過去の申請履歴(History)から最も類似するものを探して補完する。
3. 日付は基準日(Context)を元に計算する。
4. 【重要】出力するJSONのキーは、必ず提供された「Form Schema」のプロパティ名と完全に一致させること。勝手にキー名を変更したり、Schemaにないキーを追加してはならない（例外: _title）。

【Context】
Current Date: ${new Date().toISOString().split('T')[0]}
User Dept: ${currentUser.departmentName || 'Unknown'}

【User History (Reference)】
参考とすべき過去データリスト:
${JSON.stringify(minifiedHistory, null, 2)}

【Form Schema】
入力すべきフィールド定義（このSchemaのkeyを正確に使用すること）:
${JSON.stringify(formSchema, null, 2)}

【Output Restriction】
回答はJSON形式のみ。以下のキーを含むこと:
- "data": フォーム入力値のJSONオブジェクト
- "_title": 申請の件名 (string, e.g. "2024年1月分 交通費精算")。入力内容から自動生成すること。
- "referenced_history_id": 参照した履歴のID (なければ null)
- "reasoning": 思考過程 (日本語)
`;

    // 4. Call LLM
    const response = await this.llmGateway.generate({
      systemPrompt,
      userPrompt: `【User Input】\n${prompt}`,
      responseFormat: 'json_object',
      model: 'qwen2.5-coder:14b', // Recommended model
      temperature: 0.2, // Low temp for consistency
    });

    const content = response.content;

    return {
      data: { ...content.data, _title: content._title },
      referenced_history_id: content.referenced_history_id || null,
      reasoning: content.reasoning || '',
    };
  }
}
