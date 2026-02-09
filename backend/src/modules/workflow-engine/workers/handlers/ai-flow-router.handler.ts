import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ITaskHandler, TaskContext, TaskResult } from '../task-handler.interface';
import { AgentService } from '../../../ai-core/services/agent.service';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ApplicationsService } from '../../../applications/applications.service';
import { WorkflowEngineService } from '../../workflow-engine.service';

@Injectable()
export class AiFlowRouterHandler implements ITaskHandler {
  readonly taskType = 'aiFlowRouter';
  private readonly logger = new Logger(AiFlowRouterHandler.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly workflowHelper: WorkflowHelperService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ApplicationsService))
    private readonly applicationsService: ApplicationsService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflowEngineService: WorkflowEngineService,
  ) {}

  async execute(context: TaskContext): Promise<TaskResult> {
    const { applicationId, nodeId, nodeData, inputData } = context;
    this.logger.log(`Executing AI App Router logic for node ${nodeId}`);

    try {
      // 1. Extract configuration from nodeData
      const inputSource = nodeData.inputSource || 'form.reason';
      const allowedApps = nodeData.allowedApps || [];
      const executionMode = nodeData.executionMode || 'single'; // 'single' or 'all'
      const onFailure = nodeData.onFailure || 'error';
      const customPrompt = nodeData.customPrompt || '';
      const confidenceThreshold = nodeData.confidenceThreshold || 0.7;

      // 2. Get input text from inputData
      const inputText = this.getValueByPath(inputData, inputSource);

      if (!inputText) {
        this.logger.error(`Input source ${inputSource} is empty`);
        return {
          success: false,
          error: `Input field '${inputSource}' is empty`,
        };
      }

      if (allowedApps.length === 0) {
        this.logger.error('No allowed apps configured');
        return {
          success: false,
          error: 'No allowed applications configured for AI routing',
        };
      }

      // 3. Fetch application definitions
      const appDefs = await this.prisma.applicationDefinition.findMany({
        where: { id: { in: allowedApps } },
        select: { 
          id: true, 
          name: true, 
          description: true, 
          formDefinition: true,
          formDefinitionId: true,
          flowDefinitionId: true,
        },
      });

      if (appDefs.length === 0) {
        this.logger.error('No valid application definitions found');
        return {
          success: false,
          error: 'No valid application definitions found',
        };
      }

      // 4. Detect apps using AgentService
      const detection = await this.agentService.detectApps({
        message: inputText,
        availableApps: appDefs.map((app) => ({
          id: app.id,
          name: app.name,
          description: app.description || '',
        })),
      });

      this.logger.log(
        `Detected ${detection.detectedApps.length} apps: ${JSON.stringify(detection.detectedApps)}`,
      );

      // 5. Filter by confidence threshold
      const validApps = detection.detectedApps.filter(
        (app) => app.confidence >= confidenceThreshold,
      );

      if (validApps.length === 0) {
        this.logger.warn(
          `No apps detected with confidence >= ${confidenceThreshold}`,
        );

        if (onFailure === 'transfer') {
          return {
            success: true,
            outputData: {
              detectedApps: [],
              reasoning: detection.reasoning,
              needsClarification: true,
            },
            shouldAdvance: false,
          };
        } else {
          return {
            success: false,
            error: `No applications detected with sufficient confidence (threshold: ${confidenceThreshold})`,
          };
        }
      }

      // 6. Determine which apps to execute
      const appsToExecute =
        executionMode === 'single' ? [validApps[0]] : validApps;

      this.logger.log(
        `Execution mode: ${executionMode}, executing ${appsToExecute.length} apps`,
      );

      // 7. Extract form data for each app using LLM
      const executedApps: Array<{
        appId: string;
        appName: string;
        applicationId: string;
        confidence: number;
        extractedInfo: any;
      }> = [];
      
      for (const detectedApp of appsToExecute) {
        const appDef = appDefs.find((a) => a.id === detectedApp.appId);
        if (!appDef) continue;

        // Extract form fields from schema
        const formFields = this.extractFormFields(appDef.formDefinition?.schema);

        // Use LLM to extract information for this app
        let extractedInfo = {};
        if (formFields.length > 0) {
          try {
            const slotResult = await this.agentService.performSlotFilling({
              sessionId: 'ai-router-temp', // Temporary session for slot filling
              userMessage: inputText,
              appId: detectedApp.appId,
            });

            extractedInfo = slotResult.extractedInfo || {};
          } catch (error) {
            this.logger.warn(
              `Failed to extract info for ${detectedApp.appName}: ${error}`,
            );
          }
        }

        // 8. Create application
        try {
          // Check for required fields
          if (!appDef.formDefinitionId || !appDef.flowDefinitionId) {
            this.logger.error(
              `App ${detectedApp.appName} missing formDefinitionId or flowDefinitionId`,
            );
            continue;
          }

          const application = await this.applicationsService.create({
            applicationDefinitionId: detectedApp.appId,
            formDefinitionId: appDef.formDefinitionId,
            flowDefinitionId: appDef.flowDefinitionId,
            title: `AIルーターから実行: ${detectedApp.appName}`,
            applicantId: 'system',
            inputData: extractedInfo,
          });

          this.logger.log(
            `Created application ${application.id} for ${detectedApp.appName}`,
          );

          // 9. Start workflow
          await this.workflowEngineService.resubmitApplication(
            application.id,
            extractedInfo,
          );

          executedApps.push({
            appId: detectedApp.appId,
            appName: detectedApp.appName,
            applicationId: application.id,
            confidence: detectedApp.confidence,
            extractedInfo,
          });
        } catch (error) {
          this.logger.error(
            `Failed to create/start application for ${detectedApp.appName}: ${error}`,
          );
        }
      }

      // 10. Return result
      return {
        success: true,
        outputData: {
          detectedApps: detection.detectedApps,
          executedApps,
          executionMode,
          reasoning: detection.reasoning,
        },
        logs: [
          `AI Reasoning: ${detection.reasoning}`,
          `Executed ${executedApps.length} applications`,
        ],
      };
    } catch (error) {
      this.logger.error(`AI App Router failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get value from nested object by path (e.g., "form.reason")
   */
  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Extract form fields from form schema
   */
  private extractFormFields(schema: any): string[] {
    if (!schema || !schema.fields) return [];
    
    return schema.fields
      .filter((field: any) => field.required)
      .map((field: any) => field.id);
  }
}
