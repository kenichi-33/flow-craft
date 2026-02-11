import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { CopilotStatus } from '@prisma/client';
import { AiSlotFillingService } from './ai-slot-filling.service';

export interface CopilotChatRequest {
  sessionId: string;
  message: string;
  userId: string;
  context?: Record<string, any>; // Current page, selected items, etc.
}

export interface CopilotChatResponse {
  message: string;
  action?: {
    type: 'NAVIGATE' | 'FILL_FORM' | 'FILTER_LIST' | 'SHOW_ALERT';
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
    let systemPrompt = `
You are "Flow-craft AI Copilot", a helpful assistant residing in the sidebar of the workflow application.
Your goal is to assist users with navigation, form filling, and understanding the application.

Current User Context:
${JSON.stringify(currentContext, null, 2)}

You have access to the following TOOLS. If the user's request requires an action, you MUST respond with a JSON object in the following format ONLY, with no other text:

{
  "type": "ACTION_RESPONSE",
  "action": {
    "type": "NAVIGATE" | "FILL_FORM" | "FILTER_LIST" | "SHOW_ALERT",
    "payload": object
  },
  "message": "Brief explanation of what you are doing"
}

TOOLS:
1. NAVIGATE: Go to a specific page.
   - Payload: { "path": "/applications/new" } for new application
   - Payload: { "path": "/tasks" } for task list
   - Payload: { "path": "/settings" } for settings
   
2. FILL_FORM: Fill the current form with data.
   - Payload: { "data": { "field": "value", ... } }
   - Use this when the user provides data for the currently open form.
   - Infer field names from the user's intent or the provided schema in context.
   - CRITICAL: Respect the schema types!
     - e.g. "amount": 10000 (number), NOT "10000" (string)
     - e.g. "isUrgent": true (boolean), NOT "true" (string)
     - e.g. "date": "2024-01-01" (ISO string)

3. FILTER_LIST: Filter the current list view (Application List or Task List).
   - "keyword": search term (e.g. "travel", "urgent")
   - "status": 
     - For Applications: "in_progress", "completed", "rejected", "all"
     - For Tasks: "PENDING", "COMPLETED", "all"
   - "dateFrom": ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
   - "dateTo": ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
   - "sortBy": field name to sort by (e.g. "createdAt", "updatedAt")
   - Payload: { "keyword": "...", "status": "...", "dateFrom": "...", "dateTo": "...", "sortBy": "..." }
   - Use this when the user asks to "search", "filter", "show me", "find" items in a list.
   - Infer the context (Application vs Task) from the current page path or user intent.
   
   IMPORTANT: Ensuring Correct Data Types is CRITICAL.
   - Boolean fields MUST be true/false literals, NOT strings like "true".
   - Number fields MUST be numbers, NOT strings like "10000".
   - Date fields MUST be valid ISO 8601 strings (e.g., "2024-01-01T00:00:00.000Z").

4. SHOW_ALERT: Display a warning or information alert to the user.
   - Payload: { "type": "info" | "warning" | "error", "message": "The alert message" }
   - Use this when you detect a policy violation based on the "Company Policies" below.
   - Example: If user asks "Can I spend 60000 yen on travel?", check the policy limit. If it's 50000, use SHOW_ALERT to warn them.

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
      model: this.configService.get('AI_CHAT_MODEL', 'qwen2.5:14b'),
      systemPrompt,
      userPrompt: conversationContext,
      temperature: 0.5, // Lower temperature for more deterministic actions
    });

    let assistantMessage = response.rawContent;
    let action = undefined;

    // Try to parse JSON action
    try {
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.type === 'ACTION_RESPONSE' && parsed.action) {
          action = parsed.action;
          assistantMessage = parsed.message;
        }
      }
    } catch (e) {
      // Failed to parse, treat as normal text
      this.logger.warn('Failed to parse Copilot JSON response', e);
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
