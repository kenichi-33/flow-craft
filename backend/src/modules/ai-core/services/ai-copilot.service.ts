import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { CopilotStatus } from '@prisma/client';
import { AiSlotFillingService } from './ai-slot-filling.service';
import { ApplicationsService } from '../../applications/applications.service';

export interface CopilotChatRequest {
  sessionId: string;
  message: string;
  userId: string;
  context?: Record<string, any>; // Current page, selected items, etc.
}

export interface CopilotChatResponse {
  message: string;
  action?: {
    type: 'NAVIGATE' | 'FILL_FORM' | 'FILTER_LIST' | 'SHOW_ALERT' | 'SEARCH_PAST_DATA';
    payload: any;
  };
}

@Injectable()
export class AiCopilotService {
  private readonly logger = new Logger(AiCopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly llmGateway: LlmGatewayService,
    private readonly aiSlotFillingService: AiSlotFillingService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  /**
   * Start a new Copilot session
   */
  async startSession(userId: string) {
    this.logger.log(`Starting Copilot session for user ${userId}`);

    const session = await this.prisma.copilotSession.create({
      data: {
        userId,
        status: CopilotStatus.ACTIVE,
        agentName: 'AI Copilot',
        history: [],
        context: {},
      },
    });

    return session;
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string) {
    const session = await this.prisma.copilotSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Copilot session not found');
    }

    return session;
  }

  /**
   * Process chat message and generate response/action
   */
  async chat(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    const session = await this.getSession(request.sessionId);

    // Update context if provided
    if (request.context) {
      await this.prisma.copilotSession.update({
        where: { id: request.sessionId },
        data: { context: request.context },
      });
    }

    const currentContext = request.context || (session.context as any) || {};

    // Append user message to history
    const history = (session.history as any[]) || [];
    history.push({
      role: 'user',
      content: request.message,
      timestamp: new Date().toISOString(),
      context: currentContext,
    });

    // Prepare system prompt for Copilot
    const baseSystemPrompt = `
You are "Flow-craft AI Copilot", a helpful assistant residing in the sidebar of the workflow application.
Your goal is to assist users with navigation, form filling, and understanding the application.

Current User Context:
${JSON.stringify(currentContext, null, 2)}

You have access to the following TOOLS. If the user's request requires an action, you MUST respond with a JSON object in the following format:
{
  "type": "ACTION_RESPONSE",
  "action": {
    "type": "TOOL_NAME",
    "payload": object
  },
  "message": "Brief explanation"
}
`;

    const toolsDocs: string[] = [];

    // 1. NAVIGATE (Always available)
    toolsDocs.push(`
1. NAVIGATE: Go to a specific page.
   - Payload: { "path": "/applications/new" } for new application
   - Payload: { "path": "/tasks" } for task list
   - Payload: { "path": "/settings" } for settings
`);

    // 2. FILL_FORM (Only on form pages)
    // Check if path indicates a form page (new or edit)
    const isFormPage = currentContext.path?.includes('/new') || currentContext.path?.includes('/edit');
    if (isFormPage) {
        toolsDocs.push(`
2. FILL_FORM: Fill the current form with data.
   - Payload: { "data": { "field": "value", ... } }
   - Use this when the user provides data for the currently open form.
   - Infer field names from the user's intent or the provided schema in context.
   - CRITICAL: Respect the schema type. If the schema says "number", provide a JSON number (e.g. 1000, NOT "1000"). If boolean, provide true/false (NOT "true").
   - IMPORTANT: The 'Current User Context' contains the 'formSchema'. You MUST use the exact keys (property names) defined in 'formSchema.properties' as the field IDs in your payload.
   - DO NOT use the label text as the key.
   - Look at the 'formSchema.properties' object. Find the property where the 'title' matches the user's intent (e.g. "交通費", "日付"). Use the KEY of that property.
   - Example: If the schema has a property "field_123" with title "交通費", you MUST use "field_123".
   - SPECIAL KEY: Use "_title" to set the main Application Title (件名). This is separate from the form fields. Example: { "_title": "1月分交通費", ... }
`);
    }

    // 3. FILTER_LIST (Only on list pages)
    const isListPage = currentContext.path === '/applications' || currentContext.path === '/tasks';
    if (isListPage) {
        toolsDocs.push(`
3. FILTER_LIST: Filter the CURRENT list view you are looking at.
   - Use this ONLY when the user asks to "filter this list", "show only pending items", "search in this list".
   - DO NOT use this when the user asks general questions about past data or "tell me about..." (Use SEARCH_PAST_DATA for that).
   - Payload: { "keyword": "...", "status": "...", "dateFrom": "...", "dateTo": "...", "sortBy": "..." }
   - Status values: "PENDING", "COMPLETED", "APPROVED", "REJECTED", "all"
`);
    }

    // 4. SHOW_ALERT (Always available)
    toolsDocs.push(`
4. SHOW_ALERT: Display a warning or information alert.
   - Payload: { "type": "info" | "warning" | "error", "message": "..." }
`);

    // 5. SEARCH_PAST_DATA (Always available)
    toolsDocs.push(`
5. SEARCH_PAST_DATA: Search for past applications to answer user questions.
   - Payload: { "keyword": "...", "status": "APPROVED" | "all", "limit": 5 }
   - Use this when user asks about past applications, history, or "what did I do last time?".
   - This tool will return a list of applications. You MUST then use that information to answer the user's question in natural language.
   - NOTE: Return this tool action when you need to *get* information. After you get the information, you will be called again to provide the answer.
`);

    let systemPrompt = `${baseSystemPrompt}

TOOLS:
${toolsDocs.join('\n')}

If no tool is needed, just respond with a helpful text message.
    `;

    // Simple RAG: Inject relevant policies if keywords are detected
    const relevantPolicies = this.getRelevantPolicies(request.message);
    if (relevantPolicies) {
        systemPrompt += `\n\nCurrent Company Policies (Reference ONLY when relevant):\n${relevantPolicies}`;
    }

    // Call LLM
    const conversationContext = history
      .slice(-10) // Keep last 10 messages for context window
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const response = await this.llmGateway.generate({
      model: this.configService.get('AI_CHAT_MODEL', 'qwen2.5-coder:14b'),
      systemPrompt,
      userPrompt: conversationContext,
      temperature: 0.5, // Lower temperature for more deterministic actions
    });

    let assistantMessage = response.rawContent;
    let action: CopilotChatResponse['action'] | undefined = undefined;

    // Try to parse JSON action
    try {
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Case 1: Wrapped in ACTION_RESPONSE
        if (parsed.type === 'ACTION_RESPONSE' && parsed.action) {
          action = parsed.action;
          assistantMessage = parsed.message;
        } 
        // Case 2: Direct Action Object (Fallback - e.g. user reported issue)
        else if (['NAVIGATE', 'FILL_FORM', 'FILTER_LIST', 'SHOW_ALERT', 'SEARCH_PAST_DATA'].includes(parsed.type)) {
             action = {
                 type: parsed.type,
                 payload: parsed.action || parsed.payload || parsed 
             };
             // If payload is nested in 'action' key (like the user saw: { type: FILTER_LIST, action: {...} })
             if (parsed.action && !parsed.payload) {
                 action.payload = parsed.action;
             }
             
             assistantMessage = parsed.message || "実行しました。";
        }
      }
    } catch (e) {
      // Failed to parse, treat as normal text
      this.logger.warn('Failed to parse Copilot JSON response', e);
    }

    // Handle Server-Side Tools (search_past_data)
    if (action && action.type === 'SEARCH_PAST_DATA') {
        // If we have an applicantId in context (e.g. from TaskDetailPage), use it as the target.
        // Otherwise search the caller's data.
        const targetUserId = (currentContext.applicantId as string) || request.userId;
        
        const searchResult = await this.applicationsService.searchApplications(request.userId, {
            keyword: action.payload.keyword,
            status: action.payload.status === 'all' ? undefined : action.payload.status,
            limit: action.payload.limit || 5,
            targetUserId: targetUserId,
            // Filter by applicationDefinitionId if in context (e.g. from TaskDetailPage)
            applicationDefinitionId: (currentContext.applicationDefinitionId as string), 
        });

        // Add tool output to history
        const toolOutputMessage = `
[System] Tool 'SEARCH_PAST_DATA' Execution Result:
Target User: ${targetUserId}
${JSON.stringify(searchResult, null, 2)}

User Question: ${request.message}

Please use the above search results to answer the user's question. 
Summarize the findings. If specific details are found, mention them.
If no relevant data is found, state that.
`;
        
        // 2nd Turn: Call LLM with Tool Output
        const secondResponse = await this.llmGateway.generate({
            model: this.configService.get('AI_CHAT_MODEL', 'qwen2.5-coder:14b'),
            systemPrompt: systemPrompt + "\n\nYou have just executed a search tool. Use the results to answer the user.",
            userPrompt: conversationContext + "\n" + `Assistant: ${assistantMessage}` + "\n" + toolOutputMessage,
            temperature: 0.5,
        });

        assistantMessage = secondResponse.rawContent;
        action = undefined; // Clear action since we handled it server-side and now have a text answer
    }

    // Append assistant message to history
    history.push({
      role: 'assistant',
      content: assistantMessage,
      action: action,
      timestamp: new Date().toISOString(),
    });

    // Update session
    await this.prisma.copilotSession.update({
      where: { id: request.sessionId },
      data: { history },
    });

    return {
      message: assistantMessage,
      action,
    };
  }

  /**
   * Simple RAG Implementation:
   * Retrieve relevant policies based on keyword matching
   */
  private getRelevantPolicies(message: string): string | null {
    const policies = [
      {
        keywords: ['expense', 'travel', 'flight', 'ticket', 'transport'],
        text: 'Travel Expense Policy: Domestic flights must be economy class. International flights over 10 hours may be business class. Maximum daily allowance for hotels is 15,000 JPY.',
      },
      {
        keywords: ['meal', 'food', 'lunch', 'dinner', 'entertainment'],
        text: 'Entertainment Policy: All entertainment expenses over 5,000 JPY per person require prior approval. Alcohol is not reimbursable for internal meetings.',
      },
      {
        keywords: ['procurement', 'purchase', 'buy', 'software', 'hardware'],
        text: 'Procurement Policy: Purchases over 100,000 JPY require 3 competitive quotes. Software subscriptions must be approved by IT Security.',
      },
      {
         keywords: ['limit', 'max', 'cap', 'allowance'],
         text: 'General Limits: Petty cash limit is 20,000 JPY. Any expense above this must be paid via bank transfer.'
      }
    ];

    const messageLower = message.toLowerCase();
    const relevantTexts = policies
      .filter((policy) => policy.keywords.some((kw) => messageLower.includes(kw)))
      .map((policy) => policy.text);

    return relevantTexts.length > 0 ? relevantTexts.join('\n') : null;
  }
}
