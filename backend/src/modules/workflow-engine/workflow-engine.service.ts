import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { TaskCompleteJob } from './workers/task-handler.interface';

@Injectable()
export class WorkflowEngineService {
    private readonly logger = new Logger('[Facade] WorkflowEngine');

    constructor(
        private prisma: PrismaService,
        private usersService: UsersService,
        private queueService: QueueService,
    ) { }

    /**
     * ワークフローを開始する
     * 申請を作成し、進行処理をExecutorに委譲
     */
    async startWorkflow(input: {
        applicationDefinitionId: string;
        applicantId: string;
        title: string;
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

        const flowDef = appDef.flowDefinition;
        if (!flowDef) {
            throw new BadRequestException('Flow definition not found');
        }

        // バージョン情報を取得 (Activeな定義＝公開された最新バージョンを使用)
        const publishedVersion = await this.prisma.appVersion.findUnique({
            where: {
                applicationDefinitionId_version: {
                    applicationDefinitionId: appDef.id,
                    version: appDef.version
                }
            }
        });

        const flowNodes = publishedVersion?.flowNodes ?? flowDef.nodes;
        const flowEdges = publishedVersion?.flowEdges ?? flowDef.edges;
        const formSchema = publishedVersion?.formSchema ?? appDef.formDefinition?.schema;

        // 開始ノードを見つける
        const nodesList = (flowNodes as any[]) || [];
        const startNode = nodesList.find(n => n.type === 'start');
        if (!startNode) {
            throw new BadRequestException('Flow has no start node');
        }
        
        // 申請者情報のスナップショットを取得
        const applicantInfo = await this.usersService.getUserSnapshotByUsername(input.applicantId);

        // 申請を作成と開始履歴の追加をトランザクションで実行
        const application = await this.prisma.$transaction(async (tx) => {
            // 申請作成
            const app = await tx.application.create({
                data: {
                    title: input.title,
                    applicationDefinitionId: appDef.id,
                    formDefinitionId: appDef.formDefinitionId!,
                    flowDefinitionId: appDef.flowDefinitionId!,
                    applicantId: input.applicantId,
                    applicantInfo: applicantInfo as any,
                    status: 'IN_PROGRESS',
                    inputData: input.inputData,
                    currentNodeId: startNode.id,
                    // スナップショット
                    formSchema: (formSchema ?? undefined) as Prisma.InputJsonValue | undefined,
                    flowNodes: (flowNodes ?? undefined) as Prisma.InputJsonValue | undefined,
                    flowEdges: (flowEdges ?? undefined) as Prisma.InputJsonValue | undefined,
                },
            });

            // 開始履歴を追加
            await tx.approvalHistory.create({
                data: {
                    applicationId: app.id,
                    actorId: input.applicantId,
                    actorInfo: applicantInfo as any,
                    action: 'START',
                    stepId: startNode.id,
                    comment: '申請を開始しました',
                },
            });

            return app;
        });

        // 進行処理をExecutorに依頼 (非同期)
        await this.queueService.enqueue('WORKFLOW_NODE_PROCESS', { applicationId: application.id });

        return this.prisma.application.findUnique({
            where: { id: application.id },
            include: {
                applicationDefinition: true,
                workflowTasks: { orderBy: { createdAt: 'desc' } },
            },
        });
    }

    /**
     * 申請を下書きとして保存する（ワークフロー開始前）
     */
    async saveDraft(input: {
        applicationDefinitionId: string;
        applicantId: string;
        title: string;
        inputData: any;
    }) {
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

        const flowDef = appDef.flowDefinition;
        const nodes = flowDef?.nodes as any[] || [];
        const startNode = nodes.find(n => n.type === 'start');
        const applicantInfo = await this.usersService.getUserSnapshotByUsername(input.applicantId);

        const application = await this.prisma.application.create({
            data: {
                title: input.title,
                applicationDefinitionId: appDef.id,
                formDefinitionId: appDef.formDefinitionId,
                flowDefinitionId: appDef.flowDefinitionId,
                applicantId: input.applicantId,
                applicantInfo: applicantInfo as any,
                status: 'DRAFT',
                inputData: input.inputData,
                currentNodeId: startNode?.id || null,
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

        const nodes = (application.flowNodes || application.flowDefinition.nodes || []) as any[];
        const startNode = nodes.find((n: any) => n.type === 'start');
        if (!startNode) {
            throw new BadRequestException('Flow has no start node');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.application.update({
                where: { id: applicationId },
                data: {
                    status: 'IN_PROGRESS',
                    inputData: inputData,
                    currentNodeId: startNode.id,
                },
            });

            await tx.approvalHistory.create({
                data: {
                    applicationId: application.id,
                    actorId: application.applicantId,
                    actorInfo: application.applicantInfo as any,
                    action: 'START',
                    stepId: startNode.id,
                    comment: '下書きから申請を開始しました',
                },
            });
        });

        // 進行処理をExecutorに依頼
        await this.queueService.enqueue('WORKFLOW_NODE_PROCESS', { applicationId });

        return this.prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                applicationDefinition: true,
                workflowTasks: { orderBy: { createdAt: 'desc' } },
            },
        });
    }

    /**
     * タスクを完了する（承認/差戻し）
     * APIからの入力を受け付け、DB更新後に Executor に通知する
     */
    async completeTask(input: {
        taskId: string;
        action: 'APPROVE' | 'REJECT' | 'REMAND';
        actorId: string;
        comment?: string;
    }) {
        const task = await this.prisma.workflowTask.findUnique({
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

        if (task.type !== 'approval') {
            throw new BadRequestException('This task is not an approval task');
        }

        const canExecute = await this.canUserExecuteTask(task, input.actorId);
        if (!canExecute) {
            throw new BadRequestException(`User ${input.actorId} is not authorized to execute this task`);
        }

        const actorInfo = await this.usersService.getUserSnapshotByUsername(input.actorId);
        let shouldAdvance = false;
        let jobError: string | undefined = undefined;

        // トランザクション処理
        await this.prisma.$transaction(async (tx) => {
            // タスク状態更新
            await tx.workflowTask.update({
                where: { id: input.taskId },
                data: { status: 'COMPLETED' },
            });

            // 履歴記録
            await tx.approvalHistory.create({
                data: {
                    applicationId: task.applicationId,
                    actorId: input.actorId,
                    actorInfo: actorInfo as any,
                    action: input.action,
                    comment: input.comment,
                    stepId: task.stepId,
                },
            });

            // アクション別処理
            if (input.action === 'APPROVE') {
                shouldAdvance = true;
            } else if (input.action === 'REJECT') {
                const application = await tx.application.findUnique({
                    where: { id: task.applicationId },
                    include: { flowDefinition: true },
                });
                const nodes = (application?.flowNodes || application?.flowDefinition?.nodes || []) as any[];
                const endNode = nodes.find((n: any) => n.type === 'end');

                await tx.application.update({
                    where: { id: task.applicationId },
                    data: {
                        status: 'REJECTED',
                        currentNodeId: endNode?.id || null,
                    },
                });
            } else if (input.action === 'REMAND') {
                // 差戻しロジック
                const application = await tx.application.findUnique({
                    where: { id: task.applicationId },
                    include: { flowDefinition: true },
                });
                const nodes = (application?.flowNodes || application?.flowDefinition?.nodes || []) as any[];
                const startNode = nodes.find((n: any) => n.type === 'start');
                
                // 他のタスクをキャンセル
                await tx.workflowTask.updateMany({
                    where: {
                        applicationId: task.applicationId,
                        status: 'PENDING',
                        id: { not: task.id }
                    },
                    data: { status: 'CANCELED' }
                });

                await tx.workflowTask.update({
                    where: { id: input.taskId },
                    data: { status: 'CANCELED' }
                });

                await tx.application.update({
                    where: { id: task.applicationId },
                    data: {
                        status: 'REMANDED',
                        currentNodeId: startNode?.id || null,
                    },
                });
            }
        });

        // Executorへの処理依頼 (TASK_COMPLETE イベント発行)
        // 承認タスクは「人間が実行するタスク」であり、完了したので結果をExecutorへ通知する
        const job: TaskCompleteJob = {
            taskId: input.taskId,
            applicationId: task.applicationId,
            nodeId: task.stepId,
            success: true, // 完了自体は成功
            shouldAdvance: shouldAdvance, // 次に進むかどうか
            outputData: {}, 
        };

        await this.queueService.enqueue('TASK_COMPLETE', job);

        return this.prisma.application.findUnique({
            where: { id: task.applicationId },
            include: {
                applicationDefinition: true,
                workflowTasks: { orderBy: { createdAt: 'desc' } },
            },
        });
    }

    /**
     * サービスタスク再実行（互換性のためのラッパー）
     */
    async retryServiceTask(taskId: string): Promise<void> { 
        const task = await this.prisma.workflowTask.findUnique({
            where: { id: taskId },
            include: { application: true }
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        // 状態チェックなどは必要に応じて追加

        const job: any = {
            taskId: task.id,
            applicationId: task.applicationId,
            nodeId: task.stepId,
            nodeType: task.type,
            nodeData: (task.config as any) || {},
            inputData: (task.application?.inputData as any) || {},
            applicantId: task.application?.applicantId || '',
        };

        // Workerキューに再登録
        await this.queueService.enqueue('TASK_EXECUTE', job);
        this.logger.log(`Retrying task ${taskId} (type: ${task.type})`);
    }

    /**
     * 差し戻し申請を再送信する
     */
    async resubmitApplication(applicationId: string, inputData: any) {
        const application = await this.prisma.application.findUnique({
            where: { id: applicationId },
            include: { flowDefinition: true },
        });

        if (!application) {
            throw new NotFoundException('Application not found');
        }

        if (application.status !== 'REMANDED') {
            throw new BadRequestException('Application is not in REMANDED status');
        }

        const nodes = (application.flowNodes || application.flowDefinition.nodes || []) as any[];
        const startNode = nodes.find((n: any) => n.type === 'start');
        
        // 申請を更新してワークフロー再開
        await this.prisma.$transaction(async (tx) => {
             await tx.application.update({
                where: { id: applicationId },
                data: {
                    status: 'IN_PROGRESS',
                    inputData: inputData,
                    currentNodeId: startNode?.id || application.currentNodeId, // 基本は開始ノードか、現在のノード
                },
            });

            await tx.approvalHistory.create({
                data: {
                    applicationId: application.id,
                    actorId: application.applicantId,
                    actorInfo: application.applicantInfo as any,
                    action: 'RESUBMIT',
                    stepId: startNode?.id || '',
                    comment: '差し戻し申請を再送信しました',
                },
            });
        });

        // 進行処理をExecutorに依頼
        await this.queueService.enqueue('WORKFLOW_NODE_PROCESS', { applicationId });

        return this.prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                applicationDefinition: true,
                workflowTasks: { orderBy: { createdAt: 'desc' } },
            },
        });
    }

    /**
     * ユーザーがタスクを実行できるかチェック
     * Note: 権限チェックロジックはAPI層に必要なためここに残す
     */
    async canUserExecuteTask(task: any, userId: string): Promise<boolean> {
        const assignedTo = task.assignedTo;
        
        if (!assignedTo) return true; // 割り当てなし＝誰でもOK（または要件次第）

        if (assignedTo === 'applicant') {
            const app = await this.prisma.application.findUnique({ where: { id: task.applicationId } });
            return app?.applicantId === userId;
        }

        if (assignedTo.startsWith('user:')) {
            const targetUser = assignedTo.substring(5);
            return targetUser === userId;
        }

        if (assignedTo.startsWith('group:')) {
             // グループ所属チェック（簡易実装: UserSnapshotのdepartmentと一致するか）
             // 本来は UsersService.getGroupMembers(groupId) に userId が含まれるか確認すべき
             const groupName = assignedTo.substring(6);
             const user = await this.usersService.getUserSnapshot(userId);
             // departmentは名称で入っている前提
             return user.department === groupName;
        }

        // assignedToInfo (スナップショット) を使う手もある
        return true;
    }
    
    // 他のヘルパーメソッド（getWorkflowStatusなど）があればここに追加
    async getWorkflowStatus(applicationId: string) {
         return this.prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                workflowTasks: true,
                history: true,
            }
         });
    }
    
    // 以下のメソッドは削除（Executorへ移動済み）
    // - advanceToNextNode
    // - processNode
    // - handleNodeProcessingJob
    // - handleTaskComplete
    // - enqueueTask
    // - enqueueServiceTask
}
