import { Test, TestingModule } from '@nestjs/testing';
import { LlmCallHandler } from './llm-call.handler';
import { TaskContext } from '../task-handler.interface';

describe('LlmCallHandler', () => {
  let handler: LlmCallHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LlmCallHandler],
    }).compile();

    handler = module.get<LlmCallHandler>(LlmCallHandler);
  });

  const baseContext: TaskContext = {
    taskId: 'task-1',
    nodeId: 'node-1',
    nodeType: 'llmCall',
    applicationId: 'app-1',
    applicantId: 'user-1',
    nodeData: {
      prompt: 'Hello {{name}}',
    },
    inputData: { name: 'World' },
  };

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should substitute variables in prompt', async () => {
    const result = await handler.execute(baseContext);
    expect(result.success).toBe(true);
    expect(result.outputData?._llmResponse.response).toContain(
      'This is a mock response for prompt: "Hello World"',
    );
  });

  it('should map response data', async () => {
    const context = {
      ...baseContext,
      nodeData: {
        prompt: 'Hi',
        responseMapping: '{"response": "outputField"}',
      },
    };

    const result = await handler.execute(context);
    expect(result.success).toBe(true);
    expect(result.outputData?.outputField).toContain('This is a mock response');
  });
});
