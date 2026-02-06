import { Test, TestingModule } from '@nestjs/testing';
import { AiBranchService } from './ai-branch.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';

describe('AiBranchService', () => {
    let service: AiBranchService;
    let llmGateway: Partial<LlmGatewayService>;

    beforeEach(async () => {
        llmGateway = {
            generate: jest.fn().mockResolvedValue({
                content: {
                    selectedRouteId: 'rule-1',
                    reasoning: 'Test logic'
                },
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
            })
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AiBranchService,
                { provide: LlmGatewayService, useValue: llmGateway },
            ],
        }).compile();

        service = module.get<AiBranchService>(AiBranchService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should evaluate rules and return a route with custom options', async () => {
        const formData = { amount: 1000 };
        const rules = [
            { id: 'rule-1', label: 'High', aiCondition: 'Amount > 500' },
            { id: 'rule-2', label: 'Low', aiCondition: 'Amount <= 500' }
        ];

        const result = await service.evaluate({ 
            formData, 
            branchRules: rules,
            model: 'gpt-4o',
            temperature: 0.5
        });

        expect(result.selectedRouteId).toBe('rule-1');
        expect(llmGateway.generate).toHaveBeenCalledWith(expect.objectContaining({
            model: 'gpt-4o',
            temperature: 0.5
        }));
    });
});
