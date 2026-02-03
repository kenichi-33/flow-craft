import { Test, TestingModule } from '@nestjs/testing';
import { GraphQLTaskHandler } from './graphql-task.handler';
import { TaskContext } from '../task-handler.interface';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GraphQLTaskHandler', () => {
  let handler: GraphQLTaskHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GraphQLTaskHandler],
    }).compile();

    handler = module.get<GraphQLTaskHandler>(GraphQLTaskHandler);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute simple query', async () => {
    const context: TaskContext = {
      taskId: 'task1',
      applicationId: 'app1',
      nodeId: 'node1',
      nodeType: 'graphql',
      nodeData: {
        endpoint: 'https://api.example.com/graphql',
        operation: 'query { hello }',
        responseMapping: { greeting: 'hello' },
      },
      inputData: {},
      applicantId: 'user1',
    };

    mockedAxios.post.mockResolvedValue({
      data: {
        data: { hello: 'world' },
      },
    });

    const result = await handler.execute(context);
    expect(result.success).toBe(true);
    expect(result.outputData).toEqual({ greeting: 'world' });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const postMock = mockedAxios.post as unknown as jest.Mock;
    expect(postMock as any).toHaveBeenCalledWith(
      'https://api.example.com/graphql',
      { query: 'query { hello }', variables: {} },
      expect.anything(),
    );
  });

  it('should handle graphql errors', async () => {
    const context: TaskContext = {
      taskId: 'task1',
      applicationId: 'app1',
      nodeId: 'node1',
      nodeType: 'graphql',
      nodeData: {
        endpoint: 'https://api.example.com/graphql',
        operation: 'query { fail }',
      },
      inputData: {},
      applicantId: 'user1',
    };

    mockedAxios.post.mockResolvedValue({
      data: {
        data: null,
        errors: [{ message: 'Something went wrong' }],
      },
    });

    const result = await handler.execute(context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Something went wrong');
  });

  it('should substitute variables', async () => {
    const context: TaskContext = {
      taskId: 'task1',
      applicationId: 'app1',
      nodeId: 'node1',
      nodeType: 'graphql',
      nodeData: {
        endpoint: 'https://api.example.com/{{userId}}',
        operation: 'query',
      },
      inputData: { userId: '123' },
      applicantId: 'user1',
    };

    mockedAxios.post.mockResolvedValue({
      data: { data: {} },
    });

    await handler.execute(context);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const postMock = mockedAxios.post as unknown as jest.Mock;

    expect(postMock as any).toHaveBeenCalledWith(
      'https://api.example.com/123',
      expect.anything(),
      expect.anything(),
    );
  });
});
