import { Test, TestingModule } from '@nestjs/testing';
import { SlackTaskHandler } from './slack.handler';
import { TaskContext } from '../task-handler.interface';

import { PrismaService } from '../../../../prisma/prisma.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SlackHandler', () => {
  let handler: SlackTaskHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackTaskHandler,
        {
          provide: PrismaService,
          useValue: {
            application: {
              findUnique: jest.fn().mockResolvedValue({ isTestMode: false }),
            },
          },
        },
      ],
    }).compile();

    handler = module.get<SlackTaskHandler>(SlackTaskHandler);
    prisma = module.get<PrismaService>(PrismaService);
    mockFetch.mockReset();
  });

  const baseContext: TaskContext = {
    taskId: 'task-1',
    nodeId: 'node-1',
    nodeType: 'slack',
    applicationId: 'app-1',
    applicantId: 'user-1',
    nodeData: {
      webhookUrl: 'https://hooks.slack.com/services/test',
      message: 'Hello {{input.name}}',
    },
    inputData: { name: 'World' },
  };

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should send webhook successfully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await handler.execute(baseContext);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Hello World' }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.outputData).toHaveProperty('slack_sent_node-1', true);
  });

  it('should fail if fetch fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    const result = await handler.execute(baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Webhook failed with status 500');
  });

  it('should fail if webhookUrl is missing', async () => {
    const context = {
      ...baseContext,
      nodeData: { ...baseContext.nodeData, webhookUrl: '' },
    };
    const result = await handler.execute(context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Webhook URL is missing');
  });
});
