import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerWorker } from './scheduler.worker';
import { QueueService } from '../../queue/queue.service';
import { WorkflowEngineService } from '../workflow-engine.service';

const mockQueueService = {
  registerHandler: jest.fn(),
};
const mockWorkflowEngine = {
  startWorkflow: jest.fn(),
};

describe('SchedulerWorker', () => {
  let worker: SchedulerWorker;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerWorker,
        { provide: QueueService, useValue: mockQueueService },
        { provide: WorkflowEngineService, useValue: mockWorkflowEngine },
      ],
    }).compile();

    worker = module.get<SchedulerWorker>(SchedulerWorker);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should register handler', async () => {
      await worker.onModuleInit();
      expect(mockQueueService.registerHandler).toHaveBeenCalledWith(
        'WORKFLOW_START',
        expect.any(Function),
      );
    });
  });

  describe('processJob', () => {
    it('should start workflow on job', async () => {
      const job = { applicationDefinitionId: 'def-1', triggeredBy: 'poll' };
      await worker.processJob(job);
      expect(mockWorkflowEngine.startWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationDefinitionId: 'def-1',
          applicantId: 'system',
        }),
      );
    });

    it('should handle errors', async () => {
      const job = { applicationDefinitionId: 'def-1' };
      mockWorkflowEngine.startWorkflow.mockRejectedValue(
        new Error('Start failed'),
      );

      await expect(worker.processJob(job)).rejects.toThrow('Start failed');
    });
  });
});
