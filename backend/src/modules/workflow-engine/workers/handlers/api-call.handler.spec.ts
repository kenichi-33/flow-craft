import { Test, TestingModule } from '@nestjs/testing';
import { ApiCallHandler } from './api-call.handler';
import { TaskContext } from '../task-handler.interface';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ApiCallHandler', () => {
  let handler: ApiCallHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiCallHandler],
    }).compile();

    handler = module.get<ApiCallHandler>(ApiCallHandler);
    mockFetch.mockReset();
  });

  const baseContext: TaskContext = {
    taskId: 'task-1',
    nodeId: 'node-1',
    applicationId: 'app-1',
    applicantId: 'user-1',
    nodeData: {
      url: 'https://api.example.com/data',
      method: 'GET',
    },
    inputData: {
      foo: 'bar',
    },
  };

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute API call successfully', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      text: jest.fn().mockResolvedValue('{"result": "success"}'),
    });

    const result = await handler.execute(baseContext);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(result.success).toBe(true);
    expect(result.outputData._statusCode).toBe(200);
  });

  it('should handle variable substitution in URL and Body', async () => {
    mockFetch.mockResolvedValue({
      status: 201,
      statusText: 'Created',
      text: jest.fn().mockResolvedValue('{}'),
    });

    const context = {
      ...baseContext,
      nodeData: {
        url: 'https://api.example.com/{{foo}}',
        method: 'POST',
        body: '{"value": "{{foo}}"}',
      },
    };

    const result = await handler.execute(context);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/bar',
      expect.objectContaining({
        method: 'POST',
        body: '{"value":"bar"}', // JSON stringified
      }),
    );
    expect(result.success).toBe(true);
  });

  it('should retry on network error', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        text: jest.fn().mockResolvedValue('{}'),
      });

    const context = {
      ...baseContext,
      nodeData: {
        ...baseContext.nodeData,
        retryCount: '1',
        retryInterval: '10', // fast retry
      },
    };

    const result = await handler.execute(context);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it('should fail after max retries', async () => {
    mockFetch.mockRejectedValue(new Error('Network Error'));

    const context = {
      ...baseContext,
      nodeData: {
        ...baseContext.nodeData,
        retryCount: '2',
        retryInterval: '10',
      },
    };

    const result = await handler.execute(context);

    expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    expect(result.success).toBe(false);
    expect(result.error).toContain('API Retry Limit Exceeded');
  });

  it('should treat non-success status code as error by default', async () => {
    mockFetch.mockResolvedValue({
      status: 500,
      statusText: 'Internal Server Error',
      text: jest.fn().mockResolvedValue('Server Error'),
    });

    const result = await handler.execute(baseContext); // default successCodes 200,201,204

    expect(result.success).toBe(false);
    expect(result.error).toContain('API Error: 500');
  });

  it('should map response data to output', async () => {
     mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      text: jest.fn().mockResolvedValue('{"data": {"id": 123}}'),
    });

    const context = {
      ...baseContext,
      nodeData: {
        ...baseContext.nodeData,
        responseMapping: '{"data.id": "externalId"}',
      },
    };

    const result = await handler.execute(context);

    expect(result.success).toBe(true);
    expect(result.outputData.externalId).toBe(123);
  });
});
