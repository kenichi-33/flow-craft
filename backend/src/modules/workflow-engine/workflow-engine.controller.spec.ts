
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineController } from './workflow-engine.controller';
import { WorkflowEngineService } from './workflow-engine.service';

describe('WorkflowEngineController', () => {
  let controller: WorkflowEngineController;
  let service: WorkflowEngineService;

  const mockService = {
    startWorkflow: jest.fn(),
    saveDraft: jest.fn(),
    completeTask: jest.fn(),
    retryServiceTask: jest.fn(),
    retryServiceTasks: jest.fn(),
    submitDraft: jest.fn(),
    resubmitApplication: jest.fn(),
    getWorkflowStatus: jest.fn(),
    getRemandableSteps: jest.fn(),
  };

  const mockUser = { username: 'testuser', sub: 'u1' } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowEngineController],
      providers: [
        { provide: WorkflowEngineService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<WorkflowEngineController>(WorkflowEngineController);
    service = module.get<WorkflowEngineService>(WorkflowEngineService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('startWorkflow', () => {
    it('should call service.startWorkflow with applicantId', async () => {
      const dto = {
        applicationDefinitionId: 'def-1',
        title: 'Title',
        inputData: {}
      };
      await controller.startWorkflow(dto, mockUser);
      expect(service.startWorkflow).toHaveBeenCalledWith({
        ...dto,
        applicantId: mockUser.username,
      });
    });
  });

  describe('saveDraft', () => {
    it('should call service.saveDraft with applicantId', async () => {
        const dto = {
            applicationDefinitionId: 'def-1',
            title: 'Title',
            inputData: {}
        };
        await controller.saveDraft(dto, mockUser);
        expect(service.saveDraft).toHaveBeenCalledWith({
            ...dto,
            applicantId: mockUser.username,
        });
    });
  });

  describe('completeTask', () => {
    it('should call service.completeTask with actorId', async () => {
      const dto: any = {
        action: 'APPROVE',
        comment: 'LGTM',
        inputData: { f: 1 }
      };
      await controller.completeTask('task-1', dto, mockUser);
      expect(service.completeTask).toHaveBeenCalledWith({
        taskId: 'task-1',
        action: 'APPROVE',
        comment: 'LGTM',
        inputData: { f: 1 },
        actorId: mockUser.username,
        remandTargetStepId: undefined,
      });
    });
  });

  describe('retryTask', () => {
    it('should call service.retryServiceTask', async () => {
      await controller.retryTask('task-1');
      expect(service.retryServiceTask).toHaveBeenCalledWith('task-1');
    });
  });

  describe('retryTasks', () => {
      it('should call service.retryServiceTasks', async () => {
          await controller.retryTasks(['t1', 't2']);
          expect(service.retryServiceTasks).toHaveBeenCalledWith(['t1', 't2']);
      });
  });
});
