import { Injectable, Logger, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApplicationsService } from '../../applications/applications.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class AiExecutionService {
  private readonly logger = new Logger(AiExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ApplicationsService))
    private readonly applicationsService: ApplicationsService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflowEngineService: WorkflowEngineService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * 実行確認メッセージを生成
   */
  async generateConfirmationMessage(sessionId: string): Promise<string> {
    this.logger.log(`Generating confirmation for session ${sessionId}`);

    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Conversation session not found');
    }

    const detectedApps = session.detectedApps as any[];
    const slots = session.slots as any;

    if (!detectedApps || detectedApps.length === 0) {
      return '実行するアプリケーションが見つかりません。';
    }

    let message = '以下のアプリケーションを実行します。よろしいですか？\n\n';

    for (let i = 0; i < detectedApps.length; i++) {
      const app = detectedApps[i];
      const appSlots = slots[app.appId] || {};
      
      message += `${i + 1}. **${app.appName}**\n`;
      message += `   理由: ${app.reason}\n`;
      
      if (Object.keys(appSlots).length > 0) {
        message += '   入力情報:\n';
        for (const [key, value] of Object.entries(appSlots)) {
          message += `   - ${key}: ${value}\n`;
        }
      }
      message += '\n';
    }

    message += '実行する場合は「はい」または「実行」と入力してください。';

    return message;
  }

  /**
   * アプリケーションを実行
   * 親Applicationと複数の子Applicationを作成し、ワークフローを開始
   */
  async executeApplications(sessionId: string, userId: string): Promise<{
    parentApplicationId: string;
    childApplicationIds: string[];
  }> {
    this.logger.log(`Executing applications for session ${sessionId}`);

    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Conversation session not found');
    }

    const detectedApps = session.detectedApps as any[];
    const slots = session.slots as any;

    if (!detectedApps || detectedApps.length === 0) {
      throw new BadRequestException('No apps detected to execute');
    }

    // 親ApplicationIDを取得（startConversationで作成済み）
    const parentApplicationId = (session as any).applicationId;
    
    if (!parentApplicationId) {
      throw new BadRequestException(
        'Parent application not found. Session may not have been properly initialized.',
      );
    }

    this.logger.log(`Using parent application: ${parentApplicationId}`);

    // 親Applicationを取得して申請者情報を確認
    const parentApp = await this.prisma.application.findUnique({
      where: { id: parentApplicationId },
    });

    if (!parentApp) {
      throw new BadRequestException('Parent application not found in database');
    }

    const parentApplicantId = parentApp.applicantId;

    // 親ApplicationをIN_PROGRESSに更新（一覧に表示されるように）
    await this.prisma.application.update({
      where: { id: parentApplicationId },
      data: { status: 'IN_PROGRESS' },
    });

    // 各検出されたアプリの子Application作成
    const childApplicationIds: string[] = [];

    for (const detectedApp of detectedApps) {
      const appSlots = slots[detectedApp.appId] || {};

      try {
        // ApplicationDefinitionを取得
        const appDef = await this.prisma.applicationDefinition.findUnique({
          where: { id: detectedApp.appId },
        });

        if (!appDef || !appDef.formDefinitionId || !appDef.flowDefinitionId) {
          this.logger.error(`Invalid application definition: ${detectedApp.appId}`);
          continue;
        }

        // 子Application作成（親の申請者を使用）
        const childApp = await this.applicationsService.create({
          applicationDefinitionId: detectedApp.appId,
          formDefinitionId: appDef.formDefinitionId,
          flowDefinitionId: appDef.flowDefinitionId,
          applicantId: parentApplicantId, // 親の申請者を使用
          title: detectedApp.appName || '自動申請',
          inputData: appSlots,
        });

        // フロー定義からstartノードを取得
        const flowDef = await this.prisma.flowDefinition.findUnique({
          where: { id: appDef.flowDefinitionId },
        });

        if (!flowDef) {
          this.logger.error(`Flow definition not found: ${appDef.flowDefinitionId}`);
          continue;
        }

        const flowNodes = (childApp.flowNodes || flowDef.nodes) as any[];
        const startNode = flowNodes.find((n: any) => n.type === 'start');

        if (!startNode) {
          this.logger.error(`Start node not found in flow: ${appDef.flowDefinitionId}`);
          continue;
        }

        // ApplicationをIN_PROGRESSに更新し、currentNodeIdを設定
        await this.prisma.application.update({
          where: { id: childApp.id },
          data: {
            status: 'IN_PROGRESS',
            currentNodeId: startNode.id,
            parentId: parentApplicationId,
          },
        });

        // 承認履歴にSTARTアクションを記録
        await this.prisma.approvalHistory.create({
          data: {
            applicationId: childApp.id,
            actorId: parentApplicantId, // 親の申請者を使用
            actorInfo: { username: parentApplicantId }, // 簡易情報
            action: 'START',
            stepId: startNode.id,
            comment: 'AIチャットから自動申請を開始しました',
          },
        });

        // ワークフロー開始
        await this.workflowEngineService['helper'].advanceToNextNode(
          childApp.id,
        );

        childApplicationIds.push(childApp.id);
        this.logger.log(`Created and started child application: ${childApp.id}`);
      } catch (error) {
        this.logger.error(`Failed to create child app ${detectedApp.appId}`, error);
        // エラーでも続行（一部失敗を許容）
      }
    }

    if (childApplicationIds.length === 0) {
      throw new BadRequestException('Failed to create any child applications');
    }

    // セッション更新
    await this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        childApplicationIds,
      },
    });

    // 親申請のワークフロー開始
    if (parentApplicationId) {
        try {
            const session = await this.prisma.conversationSession.findUnique({
                where: { id: sessionId },
                select: { flowId: true }
            });

            if (session) {
                // フロー定義からstartノードを取得
                const flowDef = await this.prisma.flowDefinition.findUnique({
                    where: { id: session.flowId },
                });

                if (flowDef && flowDef.nodes) {
                    const nodes = flowDef.nodes as any[];
                    const startNode = nodes.find((n: any) => n.type === 'start' || n.type === 'aiStart'); // aiStartも考慮

                    if (startNode) {
                        // ApplicationをIN_PROGRESSに更新し、currentNodeIdを設定
                        // inputDataにconversationIdを保存
                        const parentApp = await this.prisma.application.findUnique({
                             where: { id: parentApplicationId },
                             select: { inputData: true, applicantId: true }
                        });
                        
                        const currentInput = parentApp?.inputData ? (parentApp.inputData as Record<string, any>) : {};
                        const newInputData = {
                            ...currentInput,
                            __conversationId: sessionId,
                            __childApplicationIds: childApplicationIds
                        };

                        await this.prisma.application.update({
                            where: { id: parentApplicationId },
                            data: {
                                status: 'IN_PROGRESS',
                                currentNodeId: startNode.id,
                                inputData: newInputData,
                            },
                        });

                         this.logger.log(`Updated parent application status to IN_PROGRESS: ${parentApplicationId}`);
                         
                         // 親申請の履歴を作成 (AI_STARTアクション)
                         await this.prisma.approvalHistory.create({
                             data: {
                                 applicationId: parentApplicationId,
                                 actorId: parentApp?.applicantId || 'SYSTEM', // 申請者またはSYSTEM
                                 actorInfo: { username: parentApp?.applicantId || 'AI' },
                                 action: 'AI_START',
                                 stepId: startNode.id,
                                 comment: 'AIチャットにより申請が自動生成され、子申請が開始されました。全ての子申請が完了すると自動的に進行します。',
                             }
                         });

                         // 親申請は子申請の完了を待つため、ここでは進めない
                         // タスクを作成して待機状態にする
                         // ユーザー名を取得
                         let displayName = parentApp?.applicantId || 'SYSTEM';
                         if (parentApp?.applicantId) {
                             try {
                                 const userSnapshot = await this.usersService.getUserSnapshotByUsername(parentApp.applicantId);
                                 if (userSnapshot.lastName || userSnapshot.firstName) {
                                     displayName = `${userSnapshot.lastName || ''} ${userSnapshot.firstName || ''}`.trim();
                                 } else {
                                     displayName = userSnapshot.username;
                                 }
                             } catch (e) {
                                 this.logger.warn(`Failed to get user snapshot for ${parentApp.applicantId}`, e);
                             }
                         }
                         
                         await this.prisma.workflowTask.create({
                             data: {
                                 applicationId: parentApplicationId,
                                 stepId: startNode.id,
                                 status: 'PENDING',
                                 assignedTo: parentApp?.applicantId || 'SYSTEM',
                                 assignedToDisplay: displayName,
                                 type: 'aiStarting', // 識別しやすいタイプにする
                                 config: {
                                     title: 'AI申請調整中',
                                     description: 'AIチャットによる申請内容の調整中です。子申請が全て完了すると自動的に進行します。'
                                 },
                             }
                         });
                         
                         this.logger.log(`Created pending task for AI Start node: ${startNode.id}`);
                         // await this.workflowEngineService['helper'].advanceToNextNode(parentApplicationId);
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Failed to start parent application ${parentApplicationId}`, error);
        }
    }

    return {
      parentApplicationId,
      childApplicationIds,
    };
  }
}
