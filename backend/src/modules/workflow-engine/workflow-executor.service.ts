import { Injectable, Logger, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { MailService } from '../notifications/mail.service';
import { UsersService } from '../users/users.service';
import { TaskCompleteJob, TaskExecuteJob } from './workers/task-handler.interface';

@Injectable()
export class WorkflowExecutorService implements OnModuleInit {
    private readonly logger = new Logger('[Executor] WorkflowExecutor');

    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
        private usersService: UsersService,
        private queueService: QueueService,
    ) { }

    async onModuleInit() {
        await this.queueService.registerHandler('WORKFLOW_NODE_PROCESS', this.handleNodeProcessingJob.bind(this));
        await this.queueService.registerHandler('TASK_COMPLETE', this.handleTaskComplete.bind(this));
        this.logger.log('Registered WORKFLOW_NODE_PROCESS and TASK_COMPLETE handlers');
    }

    async handleNodeProcessingJob(job: { applicationId: string }) {
        this.logger.log(`Processing workflow node for application ${job.applicationId}`);
        await this.processNode(job.applicationId);
    }

    /**
     * タスク完了通知を処理（Worker → Executor）
     */
    async handleTaskComplete(job: TaskCompleteJob) {
        this.logger.log(`Task ${job.taskId} completed for application ${job.applicationId} (success: ${job.success})`);

        if (job.success && job.shouldAdvance) {
            // 成功かつ次に進む場合、ワークフローを進める
            await this.advanceToNextNode(job.applicationId);
        } else if (!job.success) {
            // 失敗時のログ（リトライはWorker側で処理済み）
            this.logger.warn(`Task ${job.taskId} failed: ${job.error}`);
        }
        // shouldAdvance = false の場合（承認タスク等の途中経過、または明示的な停止）は何もしない
    }

    /**
     * 次のノードへ進む (非同期ジョブ登録)
     */
    async advanceToNextNode(applicationId: string) {
        await this.queueService.enqueue('WORKFLOW_NODE_PROCESS', { applicationId });
        this.logger.log(`Enqueued processing for application ${applicationId}`);
    }

    /**
     * ノード処理の実装 (Executorのコアロジック)
     */
    private async processNode(applicationId: string) {
        const application = await this.prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                flowDefinition: true,
                applicationDefinition: true,
            },
        });

        if (!application) {
            this.logger.error(`Application ${applicationId} not found during processNode`);
            return;
        }

        // スナップショットがある場合はそちらを使用（バージョン互換性）
        const nodes = (application.flowNodes || application.flowDefinition.nodes || []) as any[];
        const edges = (application.flowEdges || application.flowDefinition.edges || []) as any[];
        const currentNodeId = application.currentNodeId;

        // 現在のノードから出ているエッジを見つける
        const outgoingEdge = edges.find((e: any) => e.source === currentNodeId);

        if (!outgoingEdge) {
            // エッジがない = 終了
            await this.prisma.$transaction(async (tx) => {
                await tx.application.update({
                    where: { id: applicationId },
                    data: {
                        status: 'APPROVED',
                        currentNodeId: null,
                    },
                });
                // 申請完了を履歴に記録
                await tx.approvalHistory.create({
                    data: {
                        applicationId,
                        actorId: 'SYSTEM',
                        action: 'APPLICATION_COMPLETE',
                        stepId: currentNodeId || '',
                        comment: '申請が完了しました',
                    },
                });
            });
            return;
        }

        const nextNodeId = outgoingEdge.target;
        const nextNode = nodes.find((n: any) => n.id === nextNodeId);

        if (!nextNode) {
            this.logger.error(`Next node ${nextNodeId} not found in flow for application ${applicationId}`);
            return;
        }

        this.logger.log(`Advancing application ${applicationId} to node ${nextNodeId} (type: ${nextNode.type})`);

        // ノードタイプに応じた処理
        if (nextNode.type === 'end') {
            // 終了ノード: トランザクションで状態更新と履歴作成
            await this.prisma.$transaction(async (tx) => {
                await tx.application.update({
                    where: { id: applicationId },
                    data: {
                        status: 'APPROVED',
                        currentNodeId: nextNodeId,
                    },
                });
                await tx.approvalHistory.create({
                    data: {
                        applicationId,
                        actorId: 'SYSTEM',
                        action: 'APPLICATION_COMPLETE',
                        stepId: nextNodeId,
                        comment: '申請が完了しました',
                    },
                });
            });
        } else if (nextNode.type === 'approval') {
            // 承認ノード: 担当者解決(外部API)はトランザクション外で実行
            const resolvedAssignee = await this.resolveAssignedTo(
                nextNode.data?.assignee || null,
                application.applicantId
            );

            // 担当者情報のスナップショットを取得
            const assignedToInfo = await this.usersService.resolveAssignedToSnapshot(resolvedAssignee || '');

            // トランザクションでタスク生成と状態更新
            await this.prisma.$transaction(async (tx) => {
                await this.enqueueTask(
                    applicationId,
                    nextNode,
                    application.inputData as Record<string, any>,
                    application.applicantId,
                    resolvedAssignee,
                    (assignedToInfo && assignedToInfo.lastName && assignedToInfo.firstName)
                        ? `${assignedToInfo.lastName} ${assignedToInfo.firstName}`
                        : (nextNode.data?.assigneeDisplay || resolvedAssignee),
                    assignedToInfo,
                    tx
                );

                await tx.application.update({
                    where: { id: applicationId },
                    data: {
                        currentNodeId: nextNodeId,
                    },
                });
            });
        } else if (nextNode.type === 'branch') {
            // 分岐ノード
            const inputData = application.inputData as Record<string, any> || {};
            const branchData = nextNode.data || {};
            const conditionField = branchData.conditionField;
            const conditionOperator = branchData.conditionOperator || '==';
            const conditionValue = branchData.conditionValue;

            let conditionMet = false;

            if (conditionField && conditionValue !== undefined) {
                const fieldValue = inputData[conditionField];
                switch (conditionOperator) {
                    case '==': conditionMet = String(fieldValue) === String(conditionValue); break;
                    case '!=': conditionMet = String(fieldValue) !== String(conditionValue); break;
                    case '>': conditionMet = Number(fieldValue) > Number(conditionValue); break;
                    case '<': conditionMet = Number(fieldValue) < Number(conditionValue); break;
                    case '>=': conditionMet = Number(fieldValue) >= Number(conditionValue); break;
                    case '<=': conditionMet = Number(fieldValue) <= Number(conditionValue); break;
                    case 'contains': conditionMet = String(fieldValue).includes(String(conditionValue)); break;
                    default: conditionMet = false;
                }
            }

            const branchHandle = conditionMet ? 'yes' : 'no';
            const branchEdge = edges.find((e: any) =>
                e.source === nextNodeId && e.sourceHandle === branchHandle
            );

            // 分岐ロジック
            if (branchEdge) {
                const branchTargetId = branchEdge.target;
                const branchTarget = nodes.find((n: any) => n.id === branchTargetId);

                // 外部API呼び出しが必要なパラメータ解決を事前に行う試み
                let resolvedBranchAssignee: string | null = null;
                let assignedToInfo: any = null;

                if (branchTarget?.type === 'approval') {
                     resolvedBranchAssignee = await this.resolveAssignedTo(
                        branchTarget.data?.assignee || null,
                        application.applicantId
                    );
                    assignedToInfo = await this.usersService.resolveAssignedToSnapshot(resolvedBranchAssignee || '');
                }

                // トランザクション実行
                await this.prisma.$transaction(async (tx) => {
                    // 分岐ノードへの移動と履歴
                    await tx.application.update({
                        where: { id: applicationId },
                        data: { currentNodeId: nextNodeId },
                    });
                    
                    await tx.approvalHistory.create({
                        data: {
                            applicationId,
                            actorId: 'SYSTEM',
                            action: 'BRANCH',
                            stepId: nextNodeId,
                            comment: `条件: ${conditionMet ? 'true' : 'false'} (${branchHandle}ルート)`,
                        },
                    });

                    // 分岐先への遷移
                    await tx.application.update({
                        where: { id: applicationId },
                        data: { currentNodeId: branchTargetId },
                    });

                    // 分岐先の処理
                    if (branchTarget?.type === 'end') {
                         await tx.application.update({
                            where: { id: applicationId },
                            data: { status: 'APPROVED' },
                        });
                        await tx.approvalHistory.create({
                            data: {
                                applicationId,
                                actorId: 'SYSTEM',
                                action: 'APPLICATION_COMPLETE',
                                stepId: branchTargetId,
                                comment: '申請が完了しました',
                            },
                        });
                    } else if (branchTarget?.type === 'approval') {
                        await this.enqueueTask(
                            applicationId,
                            branchTarget,
                            application.inputData as Record<string, any>,
                            application.applicantId,
                            resolvedBranchAssignee,
                            (assignedToInfo && assignedToInfo.lastName && assignedToInfo.firstName)
                                ? `${assignedToInfo.lastName} ${assignedToInfo.firstName}`
                                : (branchTarget.data?.assigneeDisplay || resolvedBranchAssignee),
                            assignedToInfo,
                            tx
                        );
                    } else if (['apiCall', 'llmCall'].includes(branchTarget?.type)) {
                        await tx.approvalHistory.create({
                            data: {
                                applicationId,
                                actorId: 'SYSTEM',
                                action: 'SERVICE_TASK',
                                stepId: branchTargetId,
                                comment: `${branchTarget.type} 実行開始`,
                            },
                        });
                        await this.enqueueServiceTask(applicationId, branchTarget, application.inputData as Record<string, any>, application.applicantId, tx);
                    }
                    // branchTargetがその他の場合（再帰が必要）は、ここでは処理せず
                    // トランザクション後に advanceToNextNode を呼ぶ
                });

                // トランザクション完了後、再帰呼び出しが必要な場合
                if (branchTarget && !['end', 'approval', 'apiCall', 'llmCall'].includes(branchTarget.type)) {
                    await this.advanceToNextNode(applicationId);
                }

            } else {
                // 分岐先がない場合
                 await this.prisma.$transaction(async (tx) => {
                    await tx.application.update({
                        where: { id: applicationId },
                        data: { currentNodeId: nextNodeId },
                    });
                     await tx.approvalHistory.create({
                        data: {
                            applicationId,
                            actorId: 'SYSTEM',
                            action: 'BRANCH',
                            stepId: nextNodeId,
                            comment: `条件: ${conditionMet ? 'true' : 'false'} (${branchHandle}ルート) - 終了`,
                        },
                    });
                 });
            }

        } else if (['apiCall', 'llmCall'].includes(nextNode.type)) {
            // サービスタスク
            await this.prisma.$transaction(async (tx) => {
                 await tx.application.update({
                    where: { id: applicationId },
                    data: { currentNodeId: nextNodeId },
                });
                await tx.approvalHistory.create({
                    data: {
                        applicationId,
                        actorId: 'SYSTEM',
                        action: 'SERVICE_TASK',
                        stepId: nextNodeId,
                        comment: `${nextNode.type} 実行開始`,
                    },
                });
                await this.enqueueServiceTask(applicationId, nextNode, application.inputData as Record<string, any>, application.applicantId, tx);
            });
        } else if (nextNode.type === 'parallel') {
            // パラレルゲートウェイ
            const parallelEdges = edges.filter((e: any) => e.source === nextNodeId);
            
            // 事前に必要な情報を収集（外部APIコールをトランザクション外に出す）
            const tasksToCreate: { node: any; resolvedAssignee: string | null; assignedToInfo: any | null }[] = [];
            
            for (const edge of parallelEdges) {
                const targetNode = nodes.find((n: any) => n.id === edge.target);
                if (!targetNode) continue;

                if (targetNode.type === 'approval') {
                     const resolvedAssignee = await this.resolveAssignedTo(
                        targetNode.data?.assignee || null,
                        application.applicantId
                    );
                    const assignedToInfo = await this.usersService.resolveAssignedToSnapshot(resolvedAssignee || '');
                    
                    tasksToCreate.push({ node: targetNode, resolvedAssignee, assignedToInfo });
                } else if (['apiCall', 'llmCall'].includes(targetNode.type)) {
                    tasksToCreate.push({ node: targetNode, resolvedAssignee: null, assignedToInfo: null });
                }
            }

            await this.prisma.$transaction(async (tx) => {
                const createdTaskNodeIds: string[] = [];
                
                for (const item of tasksToCreate) {
                    if (item.node.type === 'approval') {
                         await this.enqueueTask(
                            applicationId,
                            item.node,
                            application.inputData as Record<string, any>,
                            application.applicantId,
                            item.resolvedAssignee,
                            (item.assignedToInfo && item.assignedToInfo.lastName && item.assignedToInfo.firstName)
                                ? `${item.assignedToInfo.lastName} ${item.assignedToInfo.firstName}`
                                : (item.node.data?.assigneeDisplay || item.resolvedAssignee),
                            item.assignedToInfo,
                            tx
                        );
                        createdTaskNodeIds.push(item.node.id);
                    } else {
                        await this.enqueueServiceTask(applicationId, item.node, application.inputData as Record<string, any>, application.applicantId, tx);
                    }
                }

                await tx.application.update({
                    where: { id: applicationId },
                    data: { 
                        currentNodeId: createdTaskNodeIds.length > 0 ? createdTaskNodeIds[0] : null,
                    },
                });

                await tx.approvalHistory.create({
                    data: {
                        applicationId,
                        actorId: 'SYSTEM',
                        action: 'PARALLEL_SPLIT',
                        stepId: nextNodeId,
                        comment: `${createdTaskNodeIds.length}件の並行タスクを生成`,
                    },
                });
            });

        } else if (nextNode.type === 'join') {
            // 合流ゲートウェイ
            // update currentNodeId for consistency
            await this.prisma.application.update({
                where: { id: applicationId },
                data: { currentNodeId: nextNodeId },
            });

            const joinEdges = edges.filter((e: any) => e.target === nextNodeId);
            const sourceNodeIds = joinEdges.map((e: any) => e.source);
            
            const pendingTasks = await this.prisma.workflowTask.count({
                where: {
                    applicationId,
                    stepId: { in: sourceNodeIds },
                    status: 'PENDING',
                },
            });

            if (pendingTasks > 0) {
                this.logger.log(`[WorkflowEngine] Join waiting: ${pendingTasks} pending tasks`);
                return;
            }

            this.logger.log(`[WorkflowEngine] Join complete, advancing to next`);
            await this.advanceToNextNode(applicationId);

        } else {
            // その他のノード: 次へ進む
            await this.prisma.application.update({
                where: { id: applicationId },
                data: {
                    currentNodeId: nextNodeId,
                },
            });
            await this.advanceToNextNode(applicationId);
        }
    }

    /**
     * タスクをWorkerキューに登録（統合テーブル使用）
     */
    async enqueueTask(
        applicationId: string, 
        node: any, 
        inputData: any, 
        applicantId: string, 
        assignedTo?: string | null, 
        assignedToDisplay?: string | null, 
        assignedToInfo?: any,
        tx?: Prisma.TransactionClient
    ): Promise<void> {
        const db = tx || this.prisma;
        
        // WorkflowTaskレコードを作成（configにノード設定をスナップショット保存）
        const task = await db.workflowTask.create({
            data: {
                applicationId,
                stepId: node.id,
                type: node.type,
                status: 'PENDING',
                // 承認タスク用フィールド
                assignedTo: assignedTo || null,
                assignedToDisplay: assignedToDisplay || null,
                assignedToInfo: assignedToInfo || null,
                // ノード設定のスナップショット
                config: node.data || {},
            },
        });

        // Workerキューに登録
        // Note: トランザクション中の場合は、コミット前にジョブが登録されることになるが
        // データが見つからず失敗→リトライでカバーする前提
        const job: TaskExecuteJob = {
            taskId: task.id,
            applicationId,
            nodeId: node.id,
            nodeType: node.type,
            nodeData: node.data || {},
            inputData,
            applicantId,
        };

        await this.queueService.enqueue('TASK_EXECUTE', job);
        this.logger.log(`Enqueued task ${task.id} (type: ${node.type}) for application ${applicationId}`);
    }

    /**
     * サービスタスクをWorkerキューに登録（互換性のためのラッパー）
     */
    async enqueueServiceTask(applicationId: string, node: any, inputData: any, applicantId: string, tx?: Prisma.TransactionClient): Promise<void> {
        return this.enqueueTask(applicationId, node, inputData, applicantId, null, null, null, tx);
    }

    /**
     * 担当者の解決（API呼び出しなど）
     */
    private async resolveAssignedTo(assignee: string | null, applicantId: string): Promise<string | null> {
        if (!assignee) return null;

        if (assignee === 'applicant') {
            return applicantId;
        }

        if (assignee === 'applicant_manager') {
            // 申請者の上長を取得
            try {
                const manager = await this.usersService.getManager(applicantId);
                if (manager) {
                    return `user:${manager.username}`;
                }
                this.logger.warn(`Manager not found for ${applicantId}, falling back to admin`);
                // 上長が見つからない場合は admin を割り当てる（フォールバック）
                return 'user:admin';
            } catch (e) {
                this.logger.error(`Failed to resolve manager for ${applicantId}`, e);
                return 'user:admin'; // エラー時も admin にフォールバック
            }
        }

        return assignee;
    }
}
