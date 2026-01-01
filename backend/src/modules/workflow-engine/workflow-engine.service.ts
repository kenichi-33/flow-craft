import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkflowEngineService {
    constructor(private prisma: PrismaService) { }

    /**
     * ワークフローを開始する
     * 申請を作成し、最初のノードに基づいてタスクを生成
     */
    async startWorkflow(input: {
        applicationDefinitionId: string;
        applicantId: string;
        inputData: any;
    }) {
        // アプリ定義を取得
        const appDef = await this.prisma.applicationDefinition.findUnique({
            where: { id: input.applicationDefinitionId },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });

        if (!appDef) {
            throw new NotFoundException('ApplicationDefinition not found');
        }

        if (!appDef.formDefinitionId || !appDef.flowDefinitionId) {
            throw new BadRequestException('ApplicationDefinition is not fully configured');
        }

        if (appDef.status !== 'ACTIVE') {
            throw new BadRequestException('ApplicationDefinition is not active');
        }

        // フロー定義からノードを取得
        const flowDef = appDef.flowDefinition;
        if (!flowDef) {
            throw new BadRequestException('Flow definition not found');
        }
        const nodes = flowDef.nodes as any[] || [];
        const edges = flowDef.edges as any[] || [];

        // 開始ノードを見つける
        const startNode = nodes.find(n => n.type === 'start');
        if (!startNode) {
            throw new BadRequestException('Flow has no start node');
        }

        // 申請を作成（スナップショット保存でバージョン互換性を確保）
        const application = await this.prisma.application.create({
            data: {
                applicationDefinitionId: appDef.id,
                formDefinitionId: appDef.formDefinitionId,
                flowDefinitionId: appDef.flowDefinitionId,
                applicantId: input.applicantId,
                status: 'IN_PROGRESS',
                inputData: input.inputData,
                currentNodeId: startNode.id,
                // スナップショット: 申請時点のフォーム・フロー定義を保存
                formSchema: (appDef.formDefinition?.schema ?? undefined) as Prisma.InputJsonValue | undefined,
                flowNodes: (flowDef.nodes ?? undefined) as Prisma.InputJsonValue | undefined,
                flowEdges: (flowDef.edges ?? undefined) as Prisma.InputJsonValue | undefined,
            },
        });

        // 次のノードへ進む
        await this.advanceToNextNode(application.id);

        return this.prisma.application.findUnique({
            where: { id: application.id },
            include: {
                applicationDefinition: true,
                tasks: true,
            },
        });
    }

    /**
     * 次のノードへ進む
     */
    async advanceToNextNode(applicationId: string) {
        const application = await this.prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                flowDefinition: true,
            },
        });

        if (!application) {
            throw new NotFoundException('Application not found');
        }

        // スナップショットがある場合はそちらを使用（バージョン互換性）
        const nodes = (application.flowNodes || application.flowDefinition.nodes || []) as any[];
        const edges = (application.flowEdges || application.flowDefinition.edges || []) as any[];
        const currentNodeId = application.currentNodeId;

        // 現在のノードから出ているエッジを見つける
        const outgoingEdge = edges.find((e: any) => e.source === currentNodeId);

        if (!outgoingEdge) {
            // エッジがない = 終了
            await this.prisma.application.update({
                where: { id: applicationId },
                data: {
                    status: 'APPROVED',
                    currentNodeId: null,
                },
            });
            // 申請完了を履歴に記録
            await this.prisma.approvalHistory.create({
                data: {
                    applicationId,
                    actorId: 'SYSTEM',
                    action: 'APPLICATION_COMPLETE',
                    stepId: currentNodeId || '',
                    comment: '申請が完了しました',
                },
            });
            return;
        }

        const nextNodeId = outgoingEdge.target;
        const nextNode = nodes.find((n: any) => n.id === nextNodeId);

        if (!nextNode) {
            throw new BadRequestException('Next node not found in flow');
        }

        // ノードタイプに応じた処理
        if (nextNode.type === 'end') {
            // 終了ノード
            await this.prisma.application.update({
                where: { id: applicationId },
                data: {
                    status: 'APPROVED',
                    currentNodeId: nextNodeId,
                },
            });
            // 申請完了を履歴に記録
            await this.prisma.approvalHistory.create({
                data: {
                    applicationId,
                    actorId: 'SYSTEM',
                    action: 'APPLICATION_COMPLETE',
                    stepId: nextNodeId,
                    comment: '申請が完了しました',
                },
            });
        } else if (nextNode.type === 'approval') {
            // 承認ノード: タスクを生成
            await this.prisma.approvalTask.create({
                data: {
                    applicationId,
                    stepId: nextNodeId,
                    assignedTo: nextNode.data?.assignee || null,
                    status: 'PENDING',
                },
            });

            await this.prisma.application.update({
                where: { id: applicationId },
                data: {
                    currentNodeId: nextNodeId,
                },
            });
        } else if (nextNode.type === 'branch') {
            // 分岐ノード: 条件を評価して進む
            const inputData = application.inputData as Record<string, any> || {};
            const branchData = nextNode.data || {};
            const conditionField = branchData.conditionField;
            const conditionOperator = branchData.conditionOperator || '==';
            const conditionValue = branchData.conditionValue;

            let conditionMet = false;

            if (conditionField && conditionValue !== undefined) {
                const fieldValue = inputData[conditionField];

                switch (conditionOperator) {
                    case '==':
                        conditionMet = String(fieldValue) === String(conditionValue);
                        break;
                    case '!=':
                        conditionMet = String(fieldValue) !== String(conditionValue);
                        break;
                    case '>':
                        conditionMet = Number(fieldValue) > Number(conditionValue);
                        break;
                    case '<':
                        conditionMet = Number(fieldValue) < Number(conditionValue);
                        break;
                    case '>=':
                        conditionMet = Number(fieldValue) >= Number(conditionValue);
                        break;
                    case '<=':
                        conditionMet = Number(fieldValue) <= Number(conditionValue);
                        break;
                    case 'contains':
                        conditionMet = String(fieldValue).includes(String(conditionValue));
                        break;
                    default:
                        conditionMet = false;
                }
            }

            // 条件に基づいてyes/noエッジを選択
            const branchHandle = conditionMet ? 'yes' : 'no';
            const branchEdge = edges.find((e: any) =>
                e.source === nextNodeId && e.sourceHandle === branchHandle
            );

            // 分岐ノードへ移動
            await this.prisma.application.update({
                where: { id: applicationId },
                data: {
                    currentNodeId: nextNodeId,
                },
            });

            // 分岐ノードの通過を履歴に記録
            await this.prisma.approvalHistory.create({
                data: {
                    applicationId,
                    actorId: 'SYSTEM',
                    action: 'BRANCH',
                    stepId: nextNodeId,
                    comment: `条件: ${conditionMet ? 'true' : 'false'} (${branchHandle}ルート)`,
                },
            });

            // 分岐先が見つかれば進む
            if (branchEdge) {
                // 分岐先のノードを次のノードとして設定
                const branchTargetId = branchEdge.target;
                await this.prisma.application.update({
                    where: { id: applicationId },
                    data: {
                        currentNodeId: branchTargetId,
                    },
                });

                // 分岐先から再帰的に処理
                const branchTarget = nodes.find((n: any) => n.id === branchTargetId);
                if (branchTarget?.type === 'end') {
                    await this.prisma.application.update({
                        where: { id: applicationId },
                        data: { status: 'APPROVED' },
                    });
                } else if (branchTarget?.type === 'approval') {
                    await this.prisma.approvalTask.create({
                        data: {
                            applicationId,
                            stepId: branchTargetId,
                            assignedTo: branchTarget.data?.assignee || null,
                            status: 'PENDING',
                        },
                    });
                } else if (['apiCall', 'llmCall'].includes(branchTarget?.type)) {
                    // 分岐先がサービスタスクの場合は直接実行
                    await this.prisma.approvalHistory.create({
                        data: {
                            applicationId,
                            actorId: 'SYSTEM',
                            action: 'SERVICE_TASK',
                            stepId: branchTargetId,
                            comment: `${branchTarget.type} 実行開始`,
                        },
                    });
                    await this.executeServiceTask(applicationId, branchTarget, application.inputData);
                } else {
                    await this.advanceToNextNode(applicationId);
                }
            }
        } else if (['apiCall', 'llmCall'].includes(nextNode.type)) {
            // サービスタスク: 実行処理
            await this.prisma.application.update({
                where: { id: applicationId },
                data: { currentNodeId: nextNodeId },
            });

            // サービスタスク実行前に履歴を記録
            await this.prisma.approvalHistory.create({
                data: {
                    applicationId,
                    actorId: 'SYSTEM',
                    action: 'SERVICE_TASK',
                    stepId: nextNodeId,
                    comment: `${nextNode.type} 実行開始`,
                },
            });

            await this.executeServiceTask(applicationId, nextNode, application.inputData);
        } else {
            // その他のノード: 次へ進む
            await this.prisma.application.update({
                where: { id: applicationId },
                data: {
                    currentNodeId: nextNodeId,
                },
            });
            // 再帰的に次のノードへ
            await this.advanceToNextNode(applicationId);
        }
    }

    /**
     * タスクを完了する（承認/差戻し）
     */
    async completeTask(input: {
        taskId: string;
        action: 'APPROVE' | 'REJECT' | 'REMAND';
        actorId: string;
        comment?: string;
    }) {
        const task = await this.prisma.approvalTask.findUnique({
            where: { id: input.taskId },
            include: {
                application: true,
            },
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        if (task.status !== 'PENDING') {
            throw new BadRequestException('Task is already completed');
        }

        // タスクを完了
        await this.prisma.approvalTask.update({
            where: { id: input.taskId },
            data: { status: 'COMPLETED' },
        });

        // 履歴を記録
        await this.prisma.approvalHistory.create({
            data: {
                applicationId: task.applicationId,
                actorId: input.actorId,
                action: input.action,
                comment: input.comment,
                stepId: task.stepId,
            },
        });

        // アクションに応じた処理
        if (input.action === 'APPROVE') {
            // 次のノードへ
            await this.advanceToNextNode(task.applicationId);
        } else if (input.action === 'REJECT') {
            // 却下
            await this.prisma.application.update({
                where: { id: task.applicationId },
                data: { status: 'REJECTED' },
            });
        } else if (input.action === 'REMAND') {
            // 差戻し
            await this.prisma.application.update({
                where: { id: task.applicationId },
                data: { status: 'REMANDED' },
            });
        }

        return this.prisma.application.findUnique({
            where: { id: task.applicationId },
            include: {
                applicationDefinition: true,
                tasks: true,
                history: true,
            },
        });
    }

    /**
     * ワークフローの現在状態を取得
     */
    async getWorkflowStatus(applicationId: string) {
        const application = await this.prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                applicationDefinition: true,
                formDefinition: true,
                flowDefinition: true,
                tasks: {
                    orderBy: { createdAt: 'desc' },
                },
                serviceTasks: {
                    orderBy: { createdAt: 'desc' },
                },
                history: {
                    orderBy: { actedAt: 'desc' },
                },
            },
        });

        if (!application) {
            throw new NotFoundException('Application not found');
        }

        // 現在のノード情報
        const nodes = application.flowDefinition.nodes as any[] || [];
        const currentNode = nodes.find((n: any) => n.id === application.currentNodeId);

        return {
            ...application,
            currentNode,
        };
    }

    /**
     * サービスタスクを実行
     */
    async executeServiceTask(applicationId: string, node: any, inputData: any, existingTaskId?: string) {
        let task;
        const taskData = {
            applicationId,
            stepId: node.id,
            type: node.type,
            status: 'PENDING' as any, // TaskStatus
            updatedAt: new Date(),
        };

        if (existingTaskId) {
            task = await this.prisma.serviceTask.update({
                where: { id: existingTaskId },
                data: { ...taskData, error: null, retries: { increment: 1 } },
            });
        } else {
            task = await this.prisma.serviceTask.create({
                data: taskData,
            });
        }

        try {
            let result: any = {};

            if (node.type === 'apiCall') {
                const url = this.replaceVariables(node.data.url, inputData);
                const method = node.data.method || 'GET';
                const headersStr = this.replaceVariables(node.data.headers || '{}', inputData);
                const bodyStr = this.replaceVariables(node.data.body || '{}', inputData);

                let parsedHeaders: Record<string, string> = {};
                try { parsedHeaders = JSON.parse(headersStr); } catch { }

                // HTTPヘッダーはASCIIのみ許可されるため、非ASCII文字をエンコード
                const safeHeaders: Record<string, string> = {};
                for (const [key, value] of Object.entries(parsedHeaders)) {
                    // ヘッダー値に非ASCII文字がある場合はURLエンコード
                    const isAscii = /^[\x00-\x7F]*$/.test(value);
                    safeHeaders[key] = isAscii ? value : encodeURIComponent(value);
                }

                let bodyPayload: string | undefined = undefined;
                if (method !== 'GET' && method !== 'HEAD') {
                    try {
                        const parsed = JSON.parse(bodyStr);
                        bodyPayload = JSON.stringify(parsed);
                    } catch {
                        bodyPayload = bodyStr;
                    }
                }

                console.log(`Executing API Call: ${method} ${url}`);
                console.log(`Raw Headers:`, parsedHeaders);
                console.log(`Safe Headers:`, safeHeaders);
                console.log(`Body:`, bodyPayload);

                // リクエスト送信
                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        ...safeHeaders
                    },
                    body: bodyPayload,
                });

                const responseText = await response.text();
                let responseData;
                try {
                    responseData = JSON.parse(responseText);
                } catch {
                    responseData = { text: responseText };
                }

                // Check success codes from node configuration
                const successCodesStr = node.data.successCodes || '200,201,204';
                const successCodesList = successCodesStr.split(',').map((c: string) => parseInt(c.trim(), 10)).filter((n: number) => !isNaN(n));
                const isSuccess = successCodesList.includes(response.status);
                const errorBehavior = node.data.errorBehavior || 'stop';

                if (!isSuccess) {
                    if (errorBehavior === 'stop') {
                        throw new Error(`API Error: ${response.status} ${response.statusText} - ${responseText}`);
                    } else {
                        // Log error but continue
                        console.warn(`API returned ${response.status} but continuing due to errorBehavior=continue`);
                        result = { ...responseData, _statusCode: response.status, _isError: true };
                    }
                } else {
                    result = { ...responseData, _statusCode: response.status };
                }

            } else if (node.type === 'llmCall') {
                const prompt = this.replaceVariables(node.data.prompt || '', inputData);
                console.log(`Executing Mock LLM Call with prompt: ${prompt}`);
                // Mock Response
                result = {
                    response: `This is a mock response for prompt: "${prompt}". LLM integration is not yet configured.`,
                    timestamp: new Date().toISOString()
                };
            }

            // 成功
            await this.prisma.serviceTask.update({
                where: { id: task.id },
                data: { status: 'COMPLETED' as any, result },
            });

            // ServiceTaskHistoryに履歴を保存
            await this.prisma.serviceTaskHistory.create({
                data: {
                    serviceTaskId: task.id,
                    applicationId,
                    stepId: node.id,
                    type: node.type,
                    status: 'COMPLETED',
                    result,
                },
            });

            // サービスタスク完了を履歴に記録
            await this.prisma.approvalHistory.create({
                data: {
                    applicationId,
                    actorId: 'SYSTEM',
                    action: 'SERVICE_TASK_COMPLETE',
                    stepId: node.id,
                    comment: `${node.type} 実行完了`,
                },
            });

            // 次のノードへ
            await this.advanceToNextNode(applicationId);

        } catch (error: any) {
            console.error('Service Task Failed:', error);
            await this.prisma.serviceTask.update({
                where: { id: task.id },
                data: {
                    status: 'FAILED' as any,
                    error: error.message || 'Unknown error',
                },
            });

            // ServiceTaskHistoryに失敗履歴を保存
            await this.prisma.serviceTaskHistory.create({
                data: {
                    serviceTaskId: task.id,
                    applicationId,
                    stepId: node.id,
                    type: node.type,
                    status: 'FAILED',
                    error: error.message || 'Unknown error',
                },
            });

            // 失敗時はフロー停止（ここで終了）
        }
    }

    /**
     * 変数置換 helper
     */
    private replaceVariables(text: string, data: any): string {
        if (!text) return '';
        return text.replace(/\{\{(.+?)\}\}/g, (_, key) => {
            const val = data?.[key.trim()];
            return val !== undefined ? String(val) : '';
        });
    }

    /**
     * タスク再実行
     */
    async retryServiceTask(taskId: string) {
        const task = await this.prisma.serviceTask.findUnique({
            where: { id: taskId },
            include: { application: { include: { flowDefinition: true } } }
        });

        if (!task || task.status !== 'FAILED') {
            throw new BadRequestException('Task is not in FAILED state');
        }

        const nodes = task.application.flowDefinition.nodes as any[];
        const node = nodes.find(n => n.id === task.stepId);

        if (!node) {
            throw new NotFoundException('Node not found in flow definition');
        }

        // 再実行
        await this.executeServiceTask(task.applicationId, node, task.application.inputData, taskId);

        return { success: true };
    }
}
