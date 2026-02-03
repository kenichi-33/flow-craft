import { Test } from '@nestjs/testing';
import { ForEachNodeProcessor } from './foreach-node.processor';
import { WorkflowHelperService } from '../../workflow-helper.service';

describe('ForEachNodeProcessor', () => {
  let processor: ForEachNodeProcessor;
  const mockHelper = {
    substituteVariables: jest.fn(),
    advanceToNextNode: jest.fn(),
  };
  const mockTx = {
    application: { update: jest.fn() },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ForEachNodeProcessor,
        { provide: WorkflowHelperService, useValue: mockHelper },
      ],
    }).compile();
    processor = module.get(ForEachNodeProcessor);
    jest.clearAllMocks();
  });

  it('should start loop', async () => {
    const context = {
      applicationId: 'app1',
      nodeId: 'foreach1',
      node: {
        data: { items: 'list', itemVariable: 'item', indexVariable: 'index' },
      },
      inputData: { list: ['a', 'b'] },
      edges: [
        { source: 'foreach1', sourceHandle: 'loop', target: 'task1' },
        { source: 'foreach1', sourceHandle: 'completed', target: 'end1' },
      ],
    };

    await processor.process(context as any, mockTx as any);

    expect(mockTx.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inputData: expect.objectContaining({
            item: 'a',
            index: 0,
            _loopState: { foreach1: { index: 0 } },
          }),
        }),
      }),
    );
    expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
      'app1',
      'foreach1',
      'task1',
    );
  });

  it('should continue loop', async () => {
    const context = {
      applicationId: 'app1',
      nodeId: 'foreach1',
      node: {
        data: { items: 'list', itemVariable: 'item', indexVariable: 'index' },
      },
      inputData: {
        list: ['a', 'b'],
        _loopState: { foreach1: { index: 0 } },
      },
      edges: [{ source: 'foreach1', sourceHandle: 'loop', target: 'task1' }],
    };

    await processor.process(context as any, mockTx as any);

    expect(mockTx.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inputData: expect.objectContaining({
            item: 'b',
            index: 1,
            _loopState: { foreach1: { index: 1 } },
          }),
        }),
      }),
    );
  });

  it('should finish loop', async () => {
    const context = {
      applicationId: 'app1',
      nodeId: 'foreach1',
      node: { data: { items: 'list' } },
      inputData: {
        list: ['a', 'b'],
        _loopState: { foreach1: { index: 1 } }, // Was at 1 (last item)
      },
      edges: [
        { source: 'foreach1', sourceHandle: 'completed', target: 'end1' },
        { source: 'foreach1', sourceHandle: 'loop', target: 'task1' },
      ],
    };

    await processor.process(context as any, mockTx as any);

    expect(mockTx.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inputData: expect.objectContaining({
            _loopState: {}, // Cleared
          }),
        }),
      }),
    );
    expect(mockHelper.advanceToNextNode).toHaveBeenCalledWith(
      'app1',
      'foreach1',
      'end1',
    );
  });
});
