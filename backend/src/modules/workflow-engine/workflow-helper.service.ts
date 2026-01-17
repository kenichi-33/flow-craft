import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { UsersService } from '../users/users.service';
import { Prisma, TaskStatus } from '@prisma/client';
import { TaskExecuteJob } from './workers/task-handler.interface';

@Injectable()
export class WorkflowHelperService {
    private readonly logger = new Logger(WorkflowHelperService.name);

    constructor(
        private prisma: PrismaService,
        private queueService: QueueService,
        private usersService: UsersService,
    ) {}

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
        
        const task = await db.workflowTask.create({
            data: {
                applicationId,
                stepId: node.id,
                type: node.type,
                status: 'PENDING',
                assignedTo: assignedTo || null,
                assignedToDisplay: assignedToDisplay || null,
                assignedToInfo: assignedToInfo || null,
                config: node.data || {},
            },
        });

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

    async enqueueServiceTask(
        applicationId: string, 
        node: any, 
        inputData: any, 
        applicantId: string, 
        tx?: Prisma.TransactionClient
    ): Promise<void> {
        return this.enqueueTask(applicationId, node, inputData, applicantId, null, null, null, tx);
    }

    async resolveAssignedTo(assignee: string | null, applicantId: string): Promise<string | null> {
        if (!assignee) return null;

        if (assignee === 'applicant') {
            return applicantId;
        }

        if (assignee === 'applicant_manager') {
            try {
                const manager = await this.usersService.getManager(applicantId);
                if (manager) {
                    return `user:${manager.username}`;
                }
                this.logger.warn(`Manager not found for ${applicantId}, falling back to admin`);
                return 'user:admin';
            } catch (e) {
                this.logger.error(`Failed to resolve manager for ${applicantId}`, e);
                return 'user:admin';
            }
        }

        return assignee;
    }
    
    async resolveAssignedToSnapshot(assignee: string): Promise<any> {
        return this.usersService.resolveAssignedToSnapshot(assignee);
    }

    async advanceToNextNode(applicationId: string, delay?: number, fromNodeId?: string, targetNodeId?: string) {
        await this.queueService.enqueue('WORKFLOW_NODE_PROCESS', { applicationId, fromNodeId, targetNodeId }, { delay });
        this.logger.log(`Enqueued processing for application ${applicationId} (delay: ${delay || 0}ms, from: ${fromNodeId || 'current'}, target: ${targetNodeId || 'auto'})`);
    }

    // Helper to trigger specific node execution (for Parallel branches)
    async triggerNodeExecution(applicationId: string, nodeId: string, delay?: number) {
        // Enqueue job with targetNodeId?
        // Current worker logic looks up 'currentNodeId' or 'nextNode'.
        // We probably need to update the worker logic to accept 'targetNodeId' as override?
        // Or simply advanceToNextNode but with expectation that it finds path from 'fromNodeId' to 'target'?
        // Actually, for Parallel, we want to START 'nodeId'.
        // If we use `advanceToNextNode(app, delay, parentNodeId)`, it will find all edges from parent.
        // If we want to execute a SPECIFIC branch (Target), we might need `executeNode(nodeId)`.
        
        // But `advanceToNextNode` finding edges is safer.
        // If we pass `fromNodeId` (the Parallel Gateway ID), it will find ALL outgoing edges.
        // And enqueue them?
        // The Worker processes ONE job.
        // If we want parallel, we need multiple jobs.
        
        // So `advanceToNextNode` logic in Worker needs to handle multiple edges.
        // If `fromNodeId` has multiple outgoing edges (Parallel), it should split?
    }

    evaluateCondition(data: any, condition: string): boolean {
        try {
            // Safe evaluation using Function
            const check = new Function('data', `return ${condition}`);
            return check(data);
        } catch (e) {
            this.logger.error(`Failed to evaluate condition: ${condition}`, e);
            return false;
        }
    }

    /**
     * 指定されたノードが含まれるスイムレーンを特定する
     * React Flowの座標情報(position)とSwimLaneのサイズ(data.width/height)を使用する
     */
    findEnclosingSwimLane(targetNode: any, allNodes: any[]): any | null {
        if (!targetNode || !allNodes) return null;

        // ParentId based check (Prioritize explicit grouping)
        if (targetNode.parentId) {
            const parent = allNodes.find(n => n.id === targetNode.parentId);
            if (parent && parent.type === 'swimlane') {
                return parent;
            }
        }

        // Geometric check
        const tx = targetNode.position?.x || 0;
        const ty = targetNode.position?.y || 0;
        // Node size is hard to know exactly without measuring, but we can assume top-left point containment
        // or add a small offset (e.g., center?). Let's check top-left for now.
        
        const swimlanes = allNodes.filter(n => n.type === 'swimlane');
        
        for (const lane of swimlanes) {
            const lx = lane.position?.x || 0;
            const ly = lane.position?.y || 0;
            const lw = lane.data?.width || 0;
            const lh = lane.data?.height || 0;

            // Check if Node(tx, ty) is inside Lane(lx, ly, lw, lh)
            if (tx >= lx && tx < (lx + lw) && ty >= ly && ty < (ly + lh)) {
                return lane;
            }
        }

        return null;
    }

    substituteVariables(text: string, context: any): string {
        if (!text) return '';
        return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
            const keys = key.trim().split('.');
            let val = context;
            for (const k of keys) {
                val = val ? val[k] : undefined;
            }
            return val !== undefined ? String(val) : `{{${key}}}`;
        });
    }
}
