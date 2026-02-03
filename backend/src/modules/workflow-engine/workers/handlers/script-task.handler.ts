import { Injectable, Logger } from '@nestjs/common';
import {
  ITaskHandler,
  TaskContext,
  TaskResult,
} from '../task-handler.interface';
import { Worker } from 'worker_threads';

@Injectable()
export class ScriptTaskHandler implements ITaskHandler {
  private readonly logger = new Logger(ScriptTaskHandler.name);

  get taskType(): string {
    return 'script';
  }

  async execute(context: TaskContext): Promise<TaskResult> {
    const { nodeId, nodeData, inputData } = context;
    const script = nodeData?.scriptContent;
    const outputVar = nodeData?.outputVariable;
    const timeoutMs = Number(nodeData?.timeout) || 5000;

    if (!script) {
      this.logger.warn(
        `Script Node ${nodeId} has no script content. Skipping.`,
      );
      return { success: true, shouldAdvance: true };
    }

    // Worker code as a string (Same as before)
    const workerCode = `
      const { parentPort, workerData } = require('worker_threads');
      const { getQuickJS } = require('quickjs-emscripten');

      (async () => {
        try {
          const QuickJS = await getQuickJS();
          const runtime = QuickJS.newRuntime();
          const vm = runtime.newContext();

          const { script, inputDataJSON } = workerData;

          // Inject inputData
          const inputHandle = vm.newString(inputDataJSON);
          vm.setProp(vm.global, 'inputDataJSON', inputHandle);
          inputHandle.dispose();

          // Define console.log
          const logHandle = vm.newFunction("log", (urlHandle) => {
            const logMsg = vm.dump(urlHandle);
            parentPort.postMessage({ log: logMsg });
          });
          const consoleHandle = vm.newObject();
          vm.setProp(consoleHandle, "log", logHandle);
          vm.setProp(vm.global, "console", consoleHandle);
          
          logHandle.dispose();
          consoleHandle.dispose();

          // Helper setup
          const setupCode = \`
              const inputData = JSON.parse(inputDataJSON);
          \`;
          vm.evalCode(setupCode);

          // User script wrapper
          const wrappedScript = \`
              (function() {
                  \${script}
              })()
          \`;

          const resultHandle = vm.evalCode(wrappedScript);

          if (resultHandle.error) {
            const error = vm.dump(resultHandle.error);
            resultHandle.error.dispose();
            parentPort.postMessage({ error });
          } else {
            const value = vm.dump(resultHandle.value);
            resultHandle.value.dispose();
            parentPort.postMessage({ result: value });
          }

          vm.dispose();
          runtime.dispose();
        } catch (e) {
          parentPort.postMessage({ error: e });
        }
      })();
    `;

    try {
      const result = await new Promise<any>((resolve, reject) => {
        const worker = new Worker(workerCode, {
          eval: true,
          workerData: {
            script,
            inputDataJSON: JSON.stringify(inputData),
          },
        });

        let timer: NodeJS.Timeout;

        if (timeoutMs > 0) {
          timer = setTimeout(() => {
            void worker.terminate();
            reject(
              new Error(`Script execution timed out after ${timeoutMs}ms`),
            );
          }, timeoutMs);
        }

        worker.on('message', (message) => {
          if (message.log) {
            this.logger.log(`[Script Log] ${JSON.stringify(message.log)}`);
            return;
          }

          if (timer) clearTimeout(timer);
          if (message.error) {
            reject(new Error(`Script Error: ${JSON.stringify(message.error)}`));
          } else {
            resolve(message.result);
          }
        });

        worker.on('error', (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        });

        worker.on('exit', (code) => {
          if (timer) clearTimeout(timer);
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });

      this.logger.log(
        `Script executed successfully. Result: ${JSON.stringify(result)}`,
      );

      const outputData = outputVar ? { [outputVar]: result } : {};

      return {
        success: true,
        shouldAdvance: true,
        outputData,
      };
    } catch (error) {
      this.logger.error(`Script execution failed`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
