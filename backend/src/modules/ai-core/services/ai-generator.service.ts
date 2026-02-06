import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';

export interface GenerationRequest {
  prompt: string;
  type: 'form' | 'flow';
}

@Injectable()
export class AiGeneratorService {
  private readonly logger = new Logger(AiGeneratorService.name);

  constructor(private readonly llmGateway: LlmGatewayService) {}

  async generate(request: GenerationRequest): Promise<any> {
    const { prompt, type } = request;
    const systemPrompt = this.getSystemPrompt(type);

    const response = await this.llmGateway.generate({
      systemPrompt,
      userPrompt: prompt,
      responseFormat: 'json_object',
      model: 'qwen2.5-coder:14b', // Or gpt-4o
      temperature: 0.7,
    });

    return response.content;
  }

  private getSystemPrompt(type: 'form' | 'flow'): string {
    const commonRules = `
Rules:
1. Output MUST be a valid JSON object.
2. The JSON object MUST have two top-level keys: "reasoning" and "data".
3. "reasoning": A string explaining your design choices, trade-offs, and how you met the requirements. MUST BE IN JAPANESE.
4. "data": The actual schema or flow definition object.
5. Return ONLY the JSON object.
`;

    if (type === 'form') {
      return `
You are an expert Form Designer for a JSON Schema based form builder.
Generate a valid JSON Schema (Draft-07) based on the user's description.

${commonRules}

"data" Content Rules:
1. Use standard types: string, number, boolean, array, object.
2. Use 'title' for field labels.
3. Use 'description' for helper text.
4. For selection fields, use 'enum' or 'oneOf'.
5. CRITICAL: You MUST specify the UI component type using the "x-type" property.

Available "x-type" values:
- Input: text, textarea, number, currency, email, tel, url, date, time, dateRange, file
- Selection: select, radio, checkbox, switch, user-select, department
- Layout: group, divider, label, section
- Advanced: array (for tables/lists)

Example Output Structure:
{
  "reasoning": "I added a title field because...",
  "data": {
    "type": "object",
    "properties": {
      "title": { "type": "string", "title": "Title", "x-type": "text" },
      "category": { "type": "string", "title": "Category", "enum": ["A", "B"], "x-type": "select" },
      "amount": { "type": "number", "title": "Amount", "x-type": "currency" }
    },
    "required": ["title"]
  }
}
`;
    } else {
      return `
You are an expert Workflow Designer.
Generate a workflow definition based on the user's description.

${commonRules}

"data" Content Rules:
1. "nodes": Array of nodes.
2. "edges": Array of edges.
3. Always start with a 'start' node.
4. Always end paths with an 'end' node.
5. Ensure all nodes are connected via edges.
6. Auto-layout nodes with reasonable x, y coordinates (e.g. left to right flow).

Available Node Types:
- start, end
- approval
      - assigneeRole: string (e.g., "manager", "admin")
      - assignee: string (specific user ID)
- userInput
- branch (Standard Logic Branch)
      - rules: { id: string, label: string, condition: string }[]
      - condition: JS expression using formData (e.g., "formData.amount > 1000")
- aiBranch (AI-driven Branch)
      - rules: { id: string, label: string, aiCondition: string }[] (Natural language condition)
      - provider: "ollama" | "openai"
      - model: string
- llmCall (Invoke LLM)
      - provider: "ollama" | "openai"
      - model: string
      - prompt: string (Can use {{formData.key}})
      - systemPrompt: string
      - outputField: string
- apiCall
      - url: string
      - method: "GET" | "POST"
      - body: string
      - outputField: string
- sendEmail, slack

Example Output Structure:
{
  "reasoning": "I created a linear approval flow...",
  "data": {
    "nodes": [ ... ],
    "edges": [ ... ]
  }
}
`;
    }
  }
}
