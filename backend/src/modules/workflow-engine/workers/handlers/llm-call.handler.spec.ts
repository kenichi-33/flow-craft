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

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should call OpenAI API correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OpenAI Response' } }],
      }),
    });

    const context = {
      ...baseContext,
      nodeData: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o',
        prompt: 'Hello {{name}}',
        temperature: 0.5,
      },
    };

    const result = await handler.execute(context);

    expect(result.success).toBe(true);
    expect(result.outputData?.llmResponse).toBe('OpenAI Response');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello World' }],
          temperature: 0.5,
        }),
      }),
    );
  });

  it('should call Anthropic API correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: 'Anthropic Response' }],
      }),
    });

    const context = {
      ...baseContext,
      nodeData: {
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-3',
        prompt: 'Hi {{name}}',
        systemPrompt: 'System',
      },
    };

    const result = await handler.execute(context);

    expect(result.success).toBe(true);
    expect(result.outputData?.llmResponse).toBe('Anthropic Response');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
        }),
        body: JSON.stringify({
          model: 'claude-3',
          max_tokens: 4096,
          temperature: 0.7, // default
          system: 'System',
          messages: [{ role: 'user', content: 'Hi World' }],
        }),
      }),
    );
  });

  it('should call Ollama API correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { content: 'Ollama Response' },
      }),
    });

    const context = {
      ...baseContext,
      nodeData: {
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama3',
        prompt: 'Test',
      },
    };

    const result = await handler.execute(context);

    expect(result.success).toBe(true);
    expect(result.outputData?.llmResponse).toBe('Ollama Response');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"stream":false'),
      }),
    );
  });

  it('should handle API errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const context = {
      ...baseContext,
      nodeData: { provider: 'openai', apiKey: 'k' },
    };

    const result = await handler.execute(context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('OpenAI API Error: 500');
  });

  it('should map specific response fields if responseMapping is set', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Main Content' } }],
        usage: { total_tokens: 100 },
      }),
    });

    const context = {
      ...baseContext,
      nodeData: {
        provider: 'openai',
        apiKey: 'k',
        responseMapping: '{"usage.total_tokens": "tokenCount"}',
      },
    };

    const result = await handler.execute(context);

    expect(result.success).toBe(true);
    // Standard response
    expect(result.outputData?.llmResponse).toBe('Main Content');
    // Mapped field
    expect(result.outputData?.tokenCount).toBe(100);
  });
});
