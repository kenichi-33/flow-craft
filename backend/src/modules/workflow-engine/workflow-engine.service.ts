import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import axios from 'axios';

import { MailService } from '../notifications/mail.service';

@Injectable()
export class WorkflowEngineService {
    private readonly keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    private readonly realm = process.env.KEYCLOAK_REALM || 'workflow';
    private readonly clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'admin-cli';
    private readonly clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || '';

    constructor(
        private prisma: PrismaService,
        private mailService: MailService
    ) { }

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

        // 開始履歴を追加
        await this.prisma.approvalHistory.create({
            data: {
                applicationId: application.id,
                actorId: input.applicantId,
                action: 'START',
                stepId: startNode.id,
                comment: '申請を開始しました',
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
     * 申請を下書きとして保存する（ワークフロー開始前）
     */
    async saveDraft(input: {
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

        // フロー定義からノードを取得
        const flowDef = appDef.flowDefinition;
        const nodes = flowDef?.nodes as any[] || [];

        // 開始ノードを見つける
        const startNode = nodes.find(n => n.type === 'start');

        // 申請を下書きステータスで作成
        const application = await this.prisma.application.create({
            data: {
                applicationDefinitionId: appDef.id,
                formDefinitionId: appDef.formDefinitionId,
                flowDefinitionId: appDef.flowDefinitionId,
                applicantId: input.applicantId,
                status: 'DRAFT',
                inputData: input.inputData,
                currentNodeId: startNode?.id || null,
                // スナップショット
                formSchema: (appDef.formDefinition?.schema ?? undefined) as Prisma.InputJsonValue | undefined,
                flowNodes: (flowDef?.nodes ?? undefined) as Prisma.InputJsonValue | undefined,
                flowEdges: (flowDef?.edges ?? undefined) as Prisma.InputJsonValue | undefined,
            },
        });

        return this.prisma.application.findUnique({
            where: { id: application.id },
            include: {
                applicationDefinition: true,
            },
        });
    }

    /**
     * 下書き申請を本申請として送信（ワークフロー開始）
     */
    async submitDraft(applicationId: string, inputData: any) {
        const application = await this.prisma.application.findUnique({
            where: { id: applicationId },
            include: { flowDefinition: true },
        });

        if (!application) {
            throw new NotFoundException('Application not found');
        }

        if (application.status !== 'DRAFT') {
            throw new BadRequestException('この申請は下書きではありません');
        }

        // スナップショット優先
        const nodes = (application.flowNodes || application.flowDefinition.nodes || []) as any[];

        // 開始ノードを見つける
        const startNode = nodes.find((n: any) => n.type === 'start');
        if (!startNode) {
            throw new BadRequestException('Flow has no start node');
        }

        // 申請を更新してワークフロー開始
        await this.prisma.application.update({
            where: { id: applicationId },
            data: {
                status: 'IN_PROGRESS',
                inputData: inputData,
                currentNodeId: startNode.id,
            },
        });

        // 次のノードへ進む
        await this.advanceToNextNode(applicationId);

        return this.prisma.application.findUnique({
            where: { id: applicationId },
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
            // applicant_manager等を実際のユーザーに解決
            const resolvedAssignee = await this.resolveAssignedTo(
                nextNode.data?.assignee || null,
                application.applicantId
            );
            await this.prisma.approvalTask.create({
                data: {
                    applicationId,
                    stepId: nextNodeId,
                    assignedTo: resolvedAssignee,
                    assignedToDisplay: nextNode.data?.assigneeDisplay || null,
                    status: 'PENDING',
                },
            });

            // メール通知送信
            if (nextNode.data?.notificationEnabled) {
                this.sendNotificationEmail(
                    resolvedAssignee,
                    nextNode.data.notificationSubject,
                    nextNode.data.notificationBody,
                    application
                ).catch(err => console.error('[WorkflowEngine] Failed to send email:', err));
            }

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
                    // applicant_manager等を実際のユーザーに解決
                    const resolvedBranchAssignee = await this.resolveAssignedTo(
                        branchTarget.data?.assignee || null,
                        application.applicantId
                    );
                    await this.prisma.approvalTask.create({
                        data: {
                            applicationId,
                            stepId: branchTargetId,
                            assignedTo: resolvedBranchAssignee,
                            assignedToDisplay: branchTarget.data?.assigneeDisplay || null,  // フローノードから表示名をコピー
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
        } else if (nextNode.type === 'parallel') {
            // パラレルゲートウェイ: 分岐処理（全ての後続タスクを並行生成）
            // パラレルノード自体はタスクではないので、通過してすぐに後続を生成
            
            const parallelEdges = edges.filter((e: any) => e.source === nextNodeId);
            console.log(`[WorkflowEngine] Parallel split: ${parallelEdges.length} branches`);

            const createdTaskNodeIds: string[] = [];

            for (const edge of parallelEdges) {
                const targetNode = nodes.find((n: any) => n.id === edge.target);
                if (!targetNode) continue;

                if (targetNode.type === 'approval') {
                    const resolvedAssignee = await this.resolveAssignedTo(
                        targetNode.data?.assignee || null,
                        application.applicantId
                    );
                    await this.prisma.approvalTask.create({
                        data: {
                            applicationId,
                            stepId: targetNode.id,
                            assignedTo: resolvedAssignee,
                            assignedToDisplay: targetNode.data?.assigneeDisplay || null,
                            status: 'PENDING',
                        },
                    });

                    // メール通知送信
                    if (targetNode.data?.notificationEnabled) {
                        this.sendNotificationEmail(
                            resolvedAssignee,
                            targetNode.data.notificationSubject,
                            targetNode.data.notificationBody,
                            application
                        ).catch(err => console.error('[WorkflowEngine] Failed to send email:', err));
                    }
                    createdTaskNodeIds.push(targetNode.id);
                    console.log(`[WorkflowEngine] Created parallel task for ${targetNode.id}`);
                } else if (['apiCall', 'llmCall'].includes(targetNode.type)) {
                    await this.executeServiceTask(applicationId, targetNode, application.inputData);
                }
            }

            // 並行処理中: currentNodeIdはnullにして、各タスクのstepIdで追跡
            // または最初のタスクノードを設定（フロー進捗表示用）
            await this.prisma.application.update({
                where: { id: applicationId },
                data: { 
                    currentNodeId: createdTaskNodeIds.length > 0 ? createdTaskNodeIds[0] : null,
                },
            });

            // パラレル分岐を履歴に記録
            await this.prisma.approvalHistory.create({
                data: {
                    applicationId,
                    actorId: 'SYSTEM',
                    action: 'PARALLEL_SPLIT',
                    stepId: nextNodeId,
                    comment: `${createdTaskNodeIds.length}件の並行タスクを生成`,
                },
            });
        } else if (nextNode.type === 'join') {
            // 合流ゲートウェイ: 全ての前タスクが完了するまで待機
            await this.prisma.application.update({
                where: { id: applicationId },
                data: { currentNodeId: nextNodeId },
            });

            const joinEdges = edges.filter((e: any) => e.target === nextNodeId);
            const sourceNodeIds = joinEdges.map((e: any) => e.source);
            
            // 前のノードに紐づく未完了タスクがあるかチェック
            const pendingTasks = await this.prisma.approvalTask.count({
                where: {
                    applicationId,
                    stepId: { in: sourceNodeIds },
                    status: 'PENDING',
                },
            });

            if (pendingTasks > 0) {
                console.log(`[WorkflowEngine] Join waiting: ${pendingTasks} pending tasks`);
                // 待機: まだ完了していないタスクがある
                return;
            }

            console.log(`[WorkflowEngine] Join complete, advancing to next`);
            // 全て完了していれば次に進む
            await this.advanceToNextNode(applicationId);
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

        // 権限チェック: 担当者のみがタスクを完了できる
        // assignedToは「user:username」「role:rolename」「group:/path」「applicant_manager」「applicant」などの形式
        const canExecute = await this.canUserExecuteTask(task, input.actorId);
        if (!canExecute) {
            throw new BadRequestException(`User ${input.actorId} is not authorized to execute this task`);
        }

        // タスクを完了としてマーク（アクションはApprovalHistoryに記録済み）
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
            // 却下: ステータスをREJECTEDにし、終了ノードへ移動
            const application = await this.prisma.application.findUnique({
                where: { id: task.applicationId },
                include: { flowDefinition: true },
            });
            const nodes = (application?.flowNodes || application?.flowDefinition?.nodes || []) as any[];
            const endNode = nodes.find((n: any) => n.type === 'end');

            await this.prisma.application.update({
                where: { id: task.applicationId },
                data: {
                    status: 'REJECTED',
                    currentNodeId: endNode?.id || null,
                },
            });
        } else if (input.action === 'REMAND') {
            // 差戻し: 開始ノードへ戻す（申請者が再編集できるようにする）
            const application = await this.prisma.application.findUnique({
                where: { id: task.applicationId },
                include: { flowDefinition: true },
            });
            const nodes = (application?.flowNodes || application?.flowDefinition?.nodes || []) as any[];

            // 開始ノードを見つける
            const startNode = nodes.find((n: any) => n.type === 'start');
            
            // 重要: 並行して実行中の他のタスクをキャンセルする
            // 同じアプリケーションIDで、ステータスがPENDINGのタスクを全てCANCELEDにする
            await this.prisma.approvalTask.updateMany({
                where: {
                    applicationId: task.applicationId,
                    status: 'PENDING',
                    id: { not: task.id } // 自分以外（自分は後で更新されるか、ここで更新するか）
                },
                data: {
                    status: 'CANCELED'
                }
            });

            // 差し戻しを実行したタスク自体も CANCELED にする（完了ではなく）
            await this.prisma.approvalTask.update({
                where: { id: task.id },
                data: { status: 'CANCELED' }
            });

            // ステータスをREMANDEDにし、開始ノードへ戻す（申請者が再編集・再申請できる）
            await this.prisma.application.update({
                where: { id: task.applicationId },
                data: {
                    status: 'REMANDED',
                    currentNodeId: startNode?.id || null,
                },
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
                    include: {
                        history: {
                            orderBy: { executedAt: 'desc' },
                        },
                    },
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

            // レスポンスマッピング処理
            const responseMappingStr = node.data.responseMapping;
            if (responseMappingStr) {
                try {
                    const mapping = JSON.parse(responseMappingStr);
                    let inputDataUpdated = false;

                    for (const [responsePath, formFieldId] of Object.entries(mapping)) {
                        const value = this.getValueByPath(result, responsePath);
                        if (value !== undefined) {
                            console.log(`[WorkflowEngine] Mapping response value: ${responsePath} -> ${formFieldId} = ${value}`);
                            inputData[formFieldId as string] = value;
                            inputDataUpdated = true;
                        }
                    }

                    if (inputDataUpdated) {
                        await this.prisma.application.update({
                            where: { id: applicationId },
                            data: { inputData: inputData as Prisma.InputJsonValue },
                        });
                        console.log(`[WorkflowEngine] Updated application inputData based on response mapping`);
                    }
                } catch (e) {
                    console.error('[WorkflowEngine] Failed to process response mapping:', e);
                }
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

    /**
     * 差し戻し申請を再送信する
     * REMANDEDステータスの申請のinputDataを更新し、ワークフローを再開
     */
    async resubmitApplication(applicationId: string, inputData: any) {
        const application = await this.prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                flowDefinition: true,
            },
        });

        if (!application) {
            throw new NotFoundException('Application not found');
        }

        // REMANDEDまたはIN_PROGRESSステータスの申請のみ再送信可能
        if (!['REMANDED', 'IN_PROGRESS'].includes(application.status)) {
            throw new BadRequestException('Application is not in REMANDED or IN_PROGRESS status');
        }

        // スナップショットから情報を取得
        const nodes = (application.flowNodes || application.flowDefinition.nodes || []) as any[];
        const edges = (application.flowEdges || application.flowDefinition.edges || []) as any[];

        // 開始ノードを見つける
        const startNode = nodes.find((n: any) => n.type === 'start');
        if (!startNode) {
            throw new BadRequestException('Flow has no start node');
        }

        // 開始ノードの次のエッジを見つける
        const startEdge = edges.find((e: any) => e.source === startNode.id);
        const firstStepId = startEdge?.target || startNode.id;

        // 申請を更新（inputDataを更新し、ステータスをIN_PROGRESSに戻す）
        await this.prisma.application.update({
            where: { id: applicationId },
            data: {
                inputData,
                status: 'IN_PROGRESS',
                currentNodeId: startNode.id,
            },
        });

        // 再送信履歴を記録
        await this.prisma.approvalHistory.create({
            data: {
                applicationId,
                actorId: application.applicantId,
                action: 'RESUBMIT',
                stepId: startNode.id,
                comment: '申請内容を修正して再送信',
            },
        });

        // 次のノードへ進む
        await this.advanceToNextNode(applicationId);

        return this.prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                applicationDefinition: true,
                tasks: true,
                history: true,
            },
        });
    }

    /**
     * ユーザーがタスクを実行できるかチェック
     * assignedTo形式: "user:username", "role:rolename", "group:/path", "applicant", "applicant_manager"
     */
    private async canUserExecuteTask(task: any, userId: string): Promise<boolean> {
        const assignedTo = task.assignedTo;

        if (!assignedTo) {
            // assignedToが未設定の場合は誰でも実行可能（後方互換性）
            return true;
        }

        // 複数のassignedToがある場合（カンマ区切り）
        const assignments = assignedTo.split(',').map((s: string) => s.trim());

        for (const assignment of assignments) {
            // 特定ユーザー指定: "user:username"
            if (assignment.startsWith('user:')) {
                const targetUser = assignment.substring(5);
                if (targetUser === userId) {
                    return true;
                }
            }
            // ロール指定: "role:rolename"
            else if (assignment.startsWith('role:')) {
                const targetRole = assignment.substring(5);
                const user = await this.getUserFromKeycloak(userId);
                if (user) {
                    // Keycloakからロールマッピングも取得
                    try {
                        const token = await this.getAdminToken();
                        const rolesResponse = await axios.get(
                            `${this.keycloakUrl}/admin/realms/${this.realm}/users/${user.id}/role-mappings/realm`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        const userRoles = rolesResponse.data?.map((r: any) => r.name) || [];
                        if (userRoles.includes(targetRole)) {
                            return true;
                        }
                    } catch (error) {
                        console.error(`[WorkflowEngine] Failed to get roles for ${userId}:`, error);
                    }
                }
            }
            // グループ指定: "group:/path"
            else if (assignment.startsWith('group:')) {
                const targetGroup = assignment.substring(6);
                const user = await this.getUserFromKeycloak(userId);
                if (user) {
                    // Keycloakからユーザーのグループを取得
                    try {
                        const token = await this.getAdminToken();
                        const groupsResponse = await axios.get(
                            `${this.keycloakUrl}/admin/realms/${this.realm}/users/${user.id}/groups`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        const userGroups = groupsResponse.data?.map((g: any) => g.path) || [];
                        // グループパスが一致するか、サブグループかをチェック
                        if (userGroups.some((g: string) => g === targetGroup || g.startsWith(targetGroup + '/'))) {
                            return true;
                        }
                    } catch (error) {
                        console.error(`[WorkflowEngine] Failed to get groups for ${userId}:`, error);
                    }
                }
            }
            // 申請者指定: "applicant"
            else if (assignment === 'applicant') {
                if (task.application?.applicantId === userId) {
                    return true;
                }
            }
            // 申請者の上長指定: "applicant_manager"
            else if (assignment === 'applicant_manager') {
                const applicantId = task.application?.applicantId;
                if (applicantId) {
                    const isManager = await this.isUserManagerOf(userId, applicantId);
                    if (isManager) {
                        return true;
                    }
                }
            }
            // 直接ユーザー名指定（レガシー形式）
            else if (assignment === userId) {
                return true;
            }
        }

        return false;
    }

    /**
     * Keycloak管理者トークンを取得
     */
    private async getAdminToken(): Promise<string> {
        try {
            const response = await axios.post(
                `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'password',
                    client_id: 'admin-cli',
                    username: 'admin',
                    password: 'admin',
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                }
            );
            return response.data.access_token;
        } catch (error) {
            console.error('[WorkflowEngine] Failed to get admin token:', error);
            throw new Error('Failed to get Keycloak admin token');
        }
    }

    /**
     * Keycloakからユーザー情報を取得
     */
    private async getUserFromKeycloak(username: string): Promise<any | null> {
        try {
            const token = await this.getAdminToken();
            const response = await axios.get(
                `${this.keycloakUrl}/admin/realms/${this.realm}/users`,
                {
                    params: { username, exact: true },
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            return response.data?.[0] || null;
        } catch (error) {
            console.error(`[WorkflowEngine] Failed to get user ${username}:`, error);
            return null;
        }
    }

    /**
     * ユーザーが指定ユーザーの上長かチェック
     * Keycloakのユーザー属性 managerId で判定
     */
    private async isUserManagerOf(managerId: string, subordinateId: string): Promise<boolean> {
        try {
            // 部下のKeycloak情報を取得
            const subordinate = await this.getUserFromKeycloak(subordinateId);
            if (!subordinate) {
                console.log(`[WorkflowEngine] Subordinate user ${subordinateId} not found in Keycloak`);
                return false;
            }

            // 部下のmanagerId属性を取得
            const subordinateManagerId = subordinate.attributes?.managerId?.[0];
            if (!subordinateManagerId) {
                console.log(`[WorkflowEngine] User ${subordinateId} has no managerId attribute`);
                return false;
            }

            // managerIdが現在のユーザーと一致するかチェック
            const isManager = subordinateManagerId === managerId;
            console.log(`[WorkflowEngine] Manager check: ${managerId} is manager of ${subordinateId}? ${isManager} (managerId=${subordinateManagerId})`);
            return isManager;
        } catch (error) {
            console.error(`[WorkflowEngine] Error checking manager relationship:`, error);
            return false;
        }
    }

    /**
     * assignedTo の値を実際のユーザーに解決する
     * applicant_manager -> 実際の上長のユーザー名
     * applicant -> 申請者のユーザー名
     */
    private async resolveAssignedTo(assignee: string | null, applicantId: string): Promise<string | null> {
        if (!assignee) return null;

        // 複数のassigneeがある場合（カンマ区切り）
        const assignments = assignee.split(',').map(s => s.trim());
        const resolvedAssignments: string[] = [];

        for (const assignment of assignments) {
            console.log(`[WorkflowEngine] Processing assignment: ${assignment}`);
            if (assignment === 'applicant_manager') {
                // 申請者の上長を取得
                const applicant = await this.getUserFromKeycloak(applicantId);
                if (applicant) {
                    const managerId = applicant.attributes?.managerId?.[0];
                    if (managerId) {
                        console.log(`[WorkflowEngine] Resolved applicant_manager to: user:${managerId} (for applicant: ${applicantId})`);
                        resolvedAssignments.push(`user:${managerId}`);
                    } else {
                        // managerIdがない場合は申請者本人に割り当て
                        console.log(`[WorkflowEngine] Applicant ${applicantId} has no managerId, assigning to applicant`);
                        resolvedAssignments.push(`user:${applicantId}`);
                    }
                } else {
                    // ユーザーが見つからない場合も申請者本人に割り当て
                    console.log(`[WorkflowEngine] Applicant ${applicantId} not found in Keycloak, assigning to applicant`);
                    resolvedAssignments.push(`user:${applicantId}`);
                }
            } else if (assignment === 'applicant') {
                // 申請者自身に解決
                resolvedAssignments.push(`user:${applicantId}`);
            } else {
                // その他はそのまま
                resolvedAssignments.push(assignment);
            }
        }

        return resolvedAssignments.join(', ');
    }

    /**
     * ドット記法でオブジェクトから値を取得する
     */
    private getValueByPath(obj: any, path: string): any {
        if (!path || !obj) return undefined;
        // 単純なプロパティアクセスのサポート (data.user.id -> obj['data']['user']['id'])
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }

    /**
     * 通知メールを送信する
     */
    private async sendNotificationEmail(
        assignee: string | null,
        subjectTemplate: string,
        bodyTemplate: string,
        application: any
    ) {
        if (!assignee) return;

        // 宛先ユーザーのリストを解決
        const assignments = assignee.split(',').map(s => s.trim());
        const recipients: string[] = [];

        for (const assignment of assignments) {
            if (assignment.startsWith('user:')) {
                const userId = assignment.substring(5);
                const user = await this.getUserFromKeycloak(userId);
                if (user?.email) {
                    recipients.push(user.email);
                }
            } else if (assignment.startsWith('group:')) {
                // グループのメンバー全員に送信は今回は省略（必要なら実装）
                console.log(`[WorkflowEngine] Email to group not supported yet: ${assignment}`);
            } else if (assignment.startsWith('role:')) {
                // ロールのメンバーも同様省略
                console.log(`[WorkflowEngine] Email to role not supported yet: ${assignment}`);
            }
        }

        if (recipients.length === 0) {
            console.log('[WorkflowEngine] No email recipients found');
            return;
        }

        // テンプレート変数の置換
        const data = {
            ...application.inputData,
            application,
            applicationDefinition: application.applicationDefinition,
            assignee: assignee // TODO: 表示名に変換できればベター
        };

        const subject = this.replaceVariables(
            subjectTemplate || '【Flow Craft】承認依頼: {{applicationDefinition.name}}',
            data
        );
        const body = this.replaceVariables(
            bodyTemplate || '{{assignee}} 様\n\n申請が届いています。\n確認をお願いします。',
            data
        );

        // 重複を除外して送信
        const uniqueRecipients = [...new Set(recipients)];
        for (const to of uniqueRecipients) {
            await this.mailService.sendEmail(to, subject, body);
        }
    }
}
