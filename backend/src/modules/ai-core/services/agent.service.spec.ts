import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AgentService', () => {
  let service: AgentService;
  let llmGateway: LlmGatewayService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: LlmGatewayService,
          useValue: {
            generate: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            conversationSession: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    llmGateway = module.get<LlmGatewayService>(LlmGatewayService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectIntent', () => {
    it('should detect intent from user input', async () => {
      const mockResponse = {
        flowId: 'flow-001',
        confidence: 0.9,
        reasoning: '経費申請に関する内容です',
      };

      jest.spyOn(llmGateway, 'generate').mockResolvedValue({
        content: mockResponse,
        rawContent: JSON.stringify(mockResponse),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        provider: 'ollama',
      });

      const result = await service.detectIntent({
        text: '交通費を申請したい',
        allowedFlows: [
          {
            id: 'flow-001',
            name: '経費精算',
            description: '交通費や経費の精算',
          },
        ],
      });

      expect(result.flowId).toBe('flow-001');
      expect(result.confidence).toBe(0.9);
    });
  });

  describe('extractParameters', () => {
    it('should extract parameters from text', async () => {
      const mockResponse = {
        parameters: { amount: 3000, date: '2024-01-15' },
        missingSlots: ['reason'],
        reasoning: '金額と日付は抽出できましたが、理由が不足しています',
      };

      jest.spyOn(llmGateway, 'generate').mockResolvedValue({
        content: mockResponse,
        rawContent: JSON.stringify(mockResponse),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        provider: 'ollama',
      });

      const result = await service.extractParameters({
        text: '昨日、タクシーで3000円使いました',
        flowSchema: {
          requiredSlots: [
            { name: 'amount', type: 'number', description: '金額' },
            { name: 'date', type: 'date', description: '利用日' },
            { name: 'reason', type: 'string', description: '理由' },
          ],
        },
      });

      expect(result.parameters).toHaveProperty('amount');
      expect(result.missingSlots).toContain('reason');
    });
  });

  describe('startConversation', () => {
    it('should create a new conversation session', async () => {
      const mockSession = {
        id: 'session-123',
        flowId: 'flow-001',
        userId: 'user-001',
        status: 'ACTIVE',
        context: {},
        history: [],
        agentName: 'Bot',
        systemPrompt: 'You are a helpful assistant',
        allowedFlows: ['flow-001'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(prisma.conversationSession, 'create')
        .mockResolvedValue(mockSession as any);

      const result = await service.startConversation('flow-001', 'user-001', {
        agentName: 'Bot',
        systemPrompt: 'You are a helpful assistant',
        allowedFlows: ['flow-001'],
      });

      expect(result.id).toBe('session-123');
      expect(result.userId).toBe('user-001');
    });
  });

  describe('chat', () => {
    it('should handle chat interaction', async () => {
      const mockSession = {
        id: 'session-123',
        flowId: 'flow-001',
        userId: 'user-001',
        status: 'ACTIVE',
        context: {},
        history: [],
        agentName: 'Bot',
        systemPrompt: 'You are a helpful assistant',
        allowedFlows: ['flow-001'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(prisma.conversationSession, 'findUnique')
        .mockResolvedValue(mockSession as any);
      jest
        .spyOn(prisma.conversationSession, 'update')
        .mockResolvedValue(mockSession as any);

      jest.spyOn(llmGateway, 'generate').mockResolvedValue({
        content: 'こんにちは!どのようなご用件ですか?',
        rawContent: 'こんにちは!どのようなご用件ですか?',
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        provider: 'ollama',
      });

      const result = await service.chat({
        sessionId: 'session-123',
        message: 'こんにちは',
        userId: 'user-001',
      });

      expect(result.message).toBeDefined();
      expect(result.isComplete).toBe(false);
    });
  });
});
