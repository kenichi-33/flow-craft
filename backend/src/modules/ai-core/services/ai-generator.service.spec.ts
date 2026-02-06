import { Test, TestingModule } from '@nestjs/testing';
import { AiGeneratorService } from './ai-generator.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';

describe('AiGeneratorService', () => {
    let service: AiGeneratorService;
    let llmGateway: Partial<LlmGatewayService>;

    beforeEach(async () => {
        llmGateway = {
            generate: jest.fn().mockResolvedValue({
                content: {
                    reasoning: 'Test Reasoning',
                    data: { type: 'object', properties: {} }
                },
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
            })
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AiGeneratorService,
                { provide: LlmGatewayService, useValue: llmGateway },
            ],
        }).compile();

        service = module.get<AiGeneratorService>(AiGeneratorService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should generate form schema', async () => {
        const result = await service.generate({ prompt: 'Test Form', type: 'form' });
        expect(result).toBeDefined();
        expect(llmGateway.generate).toHaveBeenCalledWith(expect.objectContaining({
            systemPrompt: expect.stringContaining('JSON Schema')
        }));
    });
});
