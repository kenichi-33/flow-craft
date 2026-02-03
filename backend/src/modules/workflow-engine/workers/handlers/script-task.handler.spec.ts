import { Test, TestingModule } from '@nestjs/testing';
import { ScriptTaskHandler } from './script-task.handler';
import { TaskContext } from '../task-handler.interface';

describe('ScriptTaskHandler', () => {
  let handler: ScriptTaskHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScriptTaskHandler],
    }).compile();

    handler = module.get<ScriptTaskHandler>(ScriptTaskHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute simple script', async () => {
    const context: TaskContext = {
      taskId: 'task1',
      applicationId: 'app1',
      nodeId: 'node1',
      nodeType: 'script',
      nodeData: {
        scriptContent: 'return inputData.x * 2;',
        outputVariable: 'result',
      },
      inputData: { x: 10 },
      applicantId: 'user1',
    };

    const result = await handler.execute(context);
    expect(result.success).toBe(true);
    expect(result.outputData).toEqual({ result: 20 });
    expect(result.shouldAdvance).toBe(true);
  }, 10000);

  it('should handle script error', async () => {
    const context: TaskContext = {
      taskId: 'task1',
      applicationId: 'app1',
      nodeId: 'node1',
      nodeType: 'script',
      nodeData: {
        scriptContent: 'throw new Error("Boom");',
      },
      inputData: {},
      applicantId: 'user1',
    };

    const result = await handler.execute(context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Boom');
  }, 10000);

  it('should timeout infinite loop', async () => {
    const context: TaskContext = {
      taskId: 'task1',
      applicationId: 'app1',
      nodeId: 'node1',
      nodeType: 'script',
      nodeData: {
        scriptContent: 'while(true) {}',
        timeout: 1000,
      },
      inputData: {},
      applicantId: 'user1',
    };

    const result = await handler.execute(context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  }, 10000);
});
