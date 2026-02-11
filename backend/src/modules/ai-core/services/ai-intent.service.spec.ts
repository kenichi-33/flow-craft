import { Test, TestingModule } from '@nestjs/testing';
import { AiIntentService } from './ai-intent.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { ConfigService } from '@nestjs/config';

const mockLlmGateway = {
  generate: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key, def) => def),
};

describe('AiIntentService', () => {
  let service: AiIntentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiIntentService,
        { provide: LlmGatewayService, useValue: mockLlmGateway },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiIntentService>(AiIntentService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectIntent', () => {
    it('should detect intent successfully', async () => {
      mockLlmGateway.generate.mockResolvedValue({
        content: { flowId: 'flow-1', confidence: 0.9, reasoning: 'Reason' },
      });

      const result = await service.detectIntent({
        text: 'test',
        allowedFlows: [],
      });

      expect(result.flowId).toBe('flow-1');
      expect(mockLlmGateway.generate).toHaveBeenCalled();
    });
  });

  describe('detectApps', () => {
    it('should detect apps successfully', async () => {
      const mockResponse = {
        detectedApps: [{ appId: 'app-1', confidence: 0.9, reason: 'Reason' }],
        reasoning: 'Reason',
      };
      // For detectApps, it parses rawContent
      mockLlmGateway.generate.mockResolvedValue({
        rawContent: JSON.stringify(mockResponse),
      });

      const result = await service.detectApps({
        message: 'test',
        availableApps: [],
      });

      expect(result.detectedApps).toHaveLength(1);
      expect(result.detectedApps[0].appId).toBe('app-1');
    });
  });
});
