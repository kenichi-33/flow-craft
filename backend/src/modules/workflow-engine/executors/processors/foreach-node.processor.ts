import { Injectable, Logger } from '@nestjs/common';
import {
  INodeProcessor,
  NodeProcessorContext,
} from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../../workflow-helper.service';

@Injectable()
export class ForEachNodeProcessor implements INodeProcessor {
  private readonly logger = new Logger(ForEachNodeProcessor.name);

  constructor(private helper: WorkflowHelperService) {}

  getType(): string {
    return 'foreach';
  }

  async process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { applicationId, nodeId, node, inputData, edges } = context;
    const config = node.data || {};
    const { items: itemsVar, itemVariable, indexVariable } = config;

    if (!itemsVar) {
      throw new Error('ForEach Node missing items configuration');
    }

    // Resolve List
    // itemsVar is likely "{{someList}}" or just "someList" or even explicit array
    // Convert "{{val}}" to "val" if needed, or use substitution logic
    // Usually variables are passed as string "{{...}}".
    // If user writes raw, it's string.
    let itemList: any[] = [];
    if (typeof itemsVar === 'string' && itemsVar.includes('{{')) {
      const val = this.helper.substituteVariables(itemsVar, inputData);
      // If it resolved to a stringified json? or just object?
      // WorkflowHelper.substituteVariables returns STRING.
      // If the variable was an array, substituteVariables might stringify it?
      // NOTE: helper.substituteVariables returns string.
      // If `inputData.list` is `[1, 2]`, `{{list}}` -> `1,2` or `[1,2]` depending on impl.
      // I should access inputData directly if I know the path.
      // Or check if result is JSON parsable.
      try {
        itemList = JSON.parse(val);
      } catch {
        // Maybe comma separated?
        itemList = val.split(',').map((s) => s.trim());
      }
    } else if (Array.isArray(itemsVar)) {
      itemList = itemsVar;
    } else {
      // Try to look up in inputData if itemsVar matches a key directly
      // Or try to evaluate?
      // Let's assume inputData[itemsVar]
      if (
        inputData &&
        inputData[itemsVar] &&
        Array.isArray(inputData[itemsVar])
      ) {
        itemList = inputData[itemsVar];
      } else {
        // Fallback: Empty list
        itemList = [];
      }
    }

    if (!Array.isArray(itemList)) {
      this.logger.warn(
        `ForEach Node ${nodeId}: items is not an array. Treated as empty.`,
      );
      itemList = [];
    }

    // 2. Determine State (Init or Next)
    const loopState = (inputData?._loopState as Record<string, any>) || {};
    const myState = loopState[nodeId];

    let currentIndex = -1;

    if (myState) {
      // Continue loop
      currentIndex = myState.index + 1;
    } else {
      // Start loop
      currentIndex = 0;
    }

    // 3. Check Condition
    if (currentIndex < itemList.length) {
      // Valid Item -> Loop Body
      const currentItem = itemList[currentIndex];

      this.logger.log(`ForEach Node ${nodeId}: Iteration ${currentIndex}`);

      // Update State
      const newLoopState = {
        ...loopState,
        [nodeId]: { index: currentIndex },
      };

      const newData = {
        ...inputData,
        _loopState: newLoopState,
      };

      if (itemVariable) newData[itemVariable] = currentItem;
      if (indexVariable) newData[indexVariable] = currentIndex;

      await tx.application.update({
        where: { id: applicationId },
        data: { inputData: newData },
      });

      // Advance to 'loop' handle
      const loopEdge = edges.find(
        (e) => e.source === nodeId && e.sourceHandle === 'loop',
      );
      if (loopEdge) {
        await this.helper.advanceToNextNode(
          applicationId,
          nodeId,
          loopEdge.target,
        );
      } else {
        this.logger.warn(`ForEach Node ${nodeId}: No 'loop' path found.`);
        // Stuck? Or assume done?
      }
    } else {
      // Finished -> Completed Path
      this.logger.log(`ForEach Node ${nodeId}: Loop Completed`);

      // Cleanup State
      const newLoopState = { ...loopState };
      delete newLoopState[nodeId];

      const newData = {
        ...inputData,
        _loopState: newLoopState,
      };

      // Optionally clear variables? Keep last value? Convention varies.
      // Keeping last value is often useful.

      await tx.application.update({
        where: { id: applicationId },
        data: { inputData: newData },
      });

      // Advance to 'completed' handle (or default/null handle if not explicit?)
      // Frontend uses 'completed' handle.
      let completedEdge = edges.find(
        (e) => e.source === nodeId && e.sourceHandle === 'completed',
      );
      if (!completedEdge) {
        // Fallback to any other edge (default?)
        completedEdge = edges.find(
          (e) => e.source === nodeId && e.sourceHandle !== 'loop',
        );
      }

      if (completedEdge) {
        await this.helper.advanceToNextNode(
          applicationId,
          nodeId,
          completedEdge.target,
        );
      } else {
        this.logger.warn(`ForEach Node ${nodeId}: No 'completed' path found.`);
      }
    }
  }
}
