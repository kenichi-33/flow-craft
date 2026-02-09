import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ApplicationsService } from '../../applications/applications.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { UsersService } from '../../users/users.service';

describe('AgentService', () => {
  let service: AgentService;
  let llmGateway: LlmGatewayService;
  let prisma: PrismaService;
  let applicationsService: ApplicationsService;

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
            applicationDefinition: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            flowDefinition: {
              findUnique: jest.fn(),
            },
            application: {
              create: jest.fn(),
              update: jest.fn(),
              findUnique: jest.fn(),
            },
            approvalHistory: {
                create: jest.fn(),
            },
            workflowTask: {
                create: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(module.get<PrismaService>(PrismaService))),
          },
        },
        {
            provide: ConfigService,
            useValue: {
                get: jest.fn((key, defaultValue) => defaultValue),
            }
        },
        {
            provide: ApplicationsService,
            useValue: {
                create: jest.fn(),
            }
        },
        {
            provide: WorkflowEngineService,
            useValue: {
                helper: {
                    advanceToNextNode: jest.fn()
                }
            }
        },
        {
            provide: UsersService,
            useValue: {
                getUserSnapshotByUsername: jest.fn()
            }
        }
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    llmGateway = module.get<LlmGatewayService>(LlmGatewayService);
    prisma = module.get<PrismaService>(PrismaService);
    applicationsService = module.get<ApplicationsService>(ApplicationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectApps', () => {
    it('should detect apps from user input', async () => {
      const mockResponse = {
        detectedApps: [{
          appId: 'app-001',
          confidence: 0.9,
          reason: '経費申請に関する内容です',
        }],
        reasoning: '経費申請に関する内容です',
      };

      jest.spyOn(llmGateway, 'generate').mockResolvedValue({
        content: mockResponse,
        rawContent: JSON.stringify(mockResponse),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        provider: 'ollama',
      });

      const result = await service.detectApps({
        message: '交通費を申請したい',
        availableApps: [
          {
            id: 'app-001',
            name: '経費精算',
            description: '交通費や経費の精算',
          },
        ],
      });

      expect(result.detectedApps[0].appId).toBe('app-001');
      expect(result.detectedApps[0].confidence).toBe(0.9);
    });
  });

  describe('extractParameters', () => {
    it('should extract parameters from text', async () => {
      const mockResponse = {
        extractedData: { amount: 3000, date: '2024-01-15' },
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
        requiredSlots: ['amount', 'date', 'reason'],
      });

      expect(result.extractedData).toHaveProperty('amount');
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
        // allowedFlows: ['flow-001'],
        allowedApps: ['app-001'],
        createdAt: new Date(),
        updatedAt: new Date(),
        slots: {},
        detectedApps: [],
        childApplicationIds: []
      };

      jest
        .spyOn(prisma.conversationSession, 'create')
        .mockResolvedValue(mockSession as any);

      jest
        .spyOn(prisma.flowDefinition, 'findUnique')
        .mockResolvedValue({
          id: 'flow-001',
          applicationDefinitions: [{ id: 'app-001', formDefinitionId: 'form-1', flowDefinitionId: 'flow-1' }]
        } as any);

      jest
        .spyOn(applicationsService, 'create')
        .mockResolvedValue({ id: 'app-instance-1' } as any);

      jest
        .spyOn(prisma.application, 'update')
        .mockResolvedValue({} as any);

      const result = await service.startConversation('flow-001', 'user-001', {
        agentName: 'Bot',
        systemPrompt: 'You are a helpful assistant',
        allowedApps: ['app-001'],
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
        // allowedFlows: ['flow-001'],
        allowedApps: ['app-001'],
        createdAt: new Date(),
        updatedAt: new Date(),
        slots: {},
        detectedApps: [],
        childApplicationIds: []
      };

      jest
        .spyOn(prisma.conversationSession, 'findUnique')
        .mockResolvedValue(mockSession as any);
      jest
        .spyOn(prisma.conversationSession, 'update')
        .mockResolvedValue(mockSession as any);

      jest
        .spyOn(prisma.applicationDefinition, 'findMany')
        .mockResolvedValue([
          { id: 'app-001', name: '経費精算', description: '交通費精算' }
        ] as any);

      jest.spyOn(llmGateway, 'generate').mockResolvedValue({
        content: { detectedApps: [] } as any,
        rawContent: JSON.stringify({ detectedApps: [] }),
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        provider: 'ollama',
      });

      const result = await service.chat({
        sessionId: 'session-123',
        message: 'こんにちは',
        userId: 'user-001',
      });

      expect(result.message).toBeDefined();
    });

    it('should process user message even if required fields are satisfied', async () => {
      const sessionId = 'session-completed';
      const fileId = 'file-123';
      const message = `領収書を追加します (ID: ${fileId})`;
      
      const mockSession: any = {
        id: sessionId,
        status: 'COLLECTING',
        currentAppId: 'app-001',
        slots: { 'app-001': { date: '2023-01-01' } }, // Required field is filled
        history: [],
        detectedApps: [{ appId: 'app-001', appName: 'Expense', reason: 'Expense' }],
      };

      jest.spyOn(service as any, 'extractFormFields').mockResolvedValue([
        { id: 'date', label: 'Date', type: 'date', required: true },
        { id: 'receipt', label: 'Receipt', type: 'file', required: false } // optional
      ]);

      // Mock update to ensure it succeeds
      jest.spyOn(prisma.conversationSession, 'update').mockResolvedValue(mockSession);

      jest.spyOn(prisma.conversationSession, 'findUnique').mockResolvedValue(mockSession);
      jest.spyOn(prisma.applicationDefinition, 'findUnique').mockResolvedValue({
        id: 'app-001',
        name: 'Expense App',
        formDefinition: { schema: { properties: { receipt: { type: 'file' } } } }
      } as any);

      // LLM response: receipt extracted
      const generateSpy = jest.spyOn(llmGateway, 'generate').mockResolvedValue({
        content: { extractedInfo: { receipt: fileId }, missingFields: [], isComplete: true, nextQuestion: null } as any,
        rawContent: JSON.stringify({ extractedInfo: { receipt: fileId }, missingFields: [], isComplete: true }),
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        provider: 'ollama'
      });

      await service.chat({ sessionId, message, userId: 'test-user' });

      // LLM should be called to process the potential new info
      expect(generateSpy).toHaveBeenCalled();
      
      const callArgs = generateSpy.mock.calls[0][0];
      expect(callArgs.userPrompt).toContain(message);
    });

    it('should update optional fields and comments', async () => {
      const sessionId = 'session-update-optional';
      const message = '領収書のメモ: 接待費です';
      
      const mockSession: any = {
        id: sessionId,
        status: 'COLLECTING',
        currentAppId: 'app-001',
        slots: { 'app-001': { date: '2023-01-01' } }, // 必須項目あり
        history: [],
        detectedApps: [{ appId: 'app-001', appName: 'Expense', reason: 'Expense' }],
      };

      jest.spyOn(service as any, 'extractFormFields').mockResolvedValue([
        { id: 'date', label: 'Date', type: 'date', required: true },
        { id: 'notes', label: 'Notes', type: 'text', required: false } // optional
      ]);

      // Mock update to verify slots update
      jest.spyOn(prisma.conversationSession, 'update').mockResolvedValue(mockSession);
      jest.spyOn(prisma.conversationSession, 'findUnique').mockResolvedValue(mockSession);
      jest.spyOn(prisma.applicationDefinition, 'findUnique').mockResolvedValue({
        id: 'app-001',
        name: 'Expense App',
        formDefinition: { schema: { properties: { notes: { type: 'text' } } } }
      } as any);

      // LLM response: extracts notes
      const generateSpy = jest.spyOn(llmGateway, 'generate').mockResolvedValue({
        content: { extractedInfo: { notes: '接待費です' }, missingFields: [], isComplete: true, nextQuestion: null } as any,
        rawContent: JSON.stringify({ extractedInfo: { notes: '接待費です' }, missingFields: [], isComplete: true }),
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        provider: 'ollama'
      });

      await service.chat({ sessionId, message, userId: 'test-user' });

      // LLM should be called
      expect(generateSpy).toHaveBeenCalled();
      
      // Verify that the prompt contains instructions for optional fields
      const callArgs = generateSpy.mock.calls[0][0];
      expect(callArgs.systemPrompt).toContain('任意フィールド');
      expect(callArgs.systemPrompt).toContain('コメント・補足情報の抽出');
    });



    it('should sanitize object value if LLM returns an object for file ID', async () => {
      const sessionId = 'session-object-value';
      const fileId = 'file-uuid-objects';
      const message = '領収書です';
      
      const mockSession: any = {
        id: sessionId,
        status: 'COLLECTING',
        currentAppId: 'app-001',
        slots: { 'app-001': {} },
        history: [],
        detectedApps: [{ appId: 'app-001', appName: 'Expense', reason: 'Expense' }],
      };

      jest.spyOn(service as any, 'extractFormFields').mockResolvedValue([
        { id: 'receipt', label: 'Receipt', type: 'file', required: true }
      ]);
      
      // Spy on update
      const updateSpy = jest.spyOn(prisma.conversationSession, 'update').mockResolvedValue(mockSession);

      jest.spyOn(prisma.conversationSession, 'findUnique').mockResolvedValue(mockSession);
      jest.spyOn(prisma.applicationDefinition, 'findUnique').mockResolvedValue({
        id: 'app-001',
        name: 'Expense App',
        formDefinition: { schema: { properties: { receipt: { type: 'file' } } } }
      } as any);

      // LLM response: returns an object { field_id: "uuid" } instead of "uuid" string
      jest.spyOn(llmGateway, 'generate').mockResolvedValue({
        content: { extractedInfo: { receipt: { field_id: fileId } }, missingFields: [], isComplete: true, nextQuestion: null } as any,
        rawContent: JSON.stringify({ extractedInfo: { receipt: { field_id: fileId } }, missingFields: [], isComplete: true }),
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        provider: 'ollama'
      });

      await service.chat({ sessionId, message, userId: 'test-user' });

      // Find the update call
      const slotUpdateCall = updateSpy.mock.calls.find(call => 
        call[0].where.id === sessionId && 
        (call[0].data as any).slots
      );
      
      expect(slotUpdateCall).toBeDefined();
      const updatedSlots = (slotUpdateCall![0].data as any).slots['app-001'];
      
      // Expected: receipt field should be the UUID string, not the object
      expect(updatedSlots.receipt).toBe(fileId);
    });
  });

  describe('convertToNumber', () => {
    it('should convert various number formats', () => {
      const convert = (val: any) => (service as any).convertToNumber(val);
      
      expect(convert(100)).toBe(100);
      expect(convert('100')).toBe(100);
      expect(convert('3,000')).toBe(3000);
      expect(convert('3,000円')).toBe(3000);
      expect(convert('¥3,000')).toBe(3000);
      expect(convert('3000JPY')).toBe(3000);
      expect(convert('３０００')).toBe(3000); // 全角
      expect(convert('３，０００円')).toBe(3000); // 全角カンマと単位
      expect(convert('abc')).toBe('abc'); // 数字なし
      expect(convert('')).toBe('');
    });
  });

  describe('extractFormFields', () => {
    it('should identify file fields correctly', async () => {
      const mockAppDef = {
        id: 'app-1',
        formDefinition: {
          schema: {
            properties: {
              fileField: { type: 'file', title: '添付ファイル' },
              xFileField: { type: 'string', 'x-type': 'file', title: 'X添付' },
              normalField: { type: 'string', title: '通常' }
            }
          }
        }
      };

      jest.spyOn(prisma.applicationDefinition, 'findUnique').mockResolvedValue(mockAppDef as any);

      const fields = await service.extractFormFields('app-1');
      
      expect(fields).toHaveLength(3);
      expect(fields.find(f => f.id === 'fileField')?.type).toBe('file');
      expect(fields.find(f => f.id === 'xFileField')?.type).toBe('file');
      expect(fields.find(f => f.id === 'normalField')?.type).toBe('string');
    });
  });
});
