import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

        // 申請を作成
        const application = await this.prisma.application.create({
            data: {
                applicationDefinitionId: appDef.id,
                formDefinitionId: appDef.formDefinitionId,
                flowDefinitionId: appDef.flowDefinitionId,
                applicantId: input.applicantId,
                status: 'IN_PROGRESS',
                inputData: input.inputData,
                currentNodeId: startNode.id,
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

        const nodes = application.flowDefinition.nodes as any[] || [];
        const edges = application.flowDefinition.edges as any[] || [];
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
                } else {
                    await this.advanceToNextNode(applicationId);
                }
            }
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
}
