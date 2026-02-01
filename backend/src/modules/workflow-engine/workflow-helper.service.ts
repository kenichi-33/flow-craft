import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { UsersService } from '../users/users.service';
import { Prisma } from '@prisma/client';
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
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx || this.prisma;

    // Check for existing active or failed task to prevent duplicates/loops
    const existingTask = await db.workflowTask.findFirst({
      where: {
        applicationId,
        stepId: node.id,
        status: {
          in: ['PENDING', 'QUEUED', 'RUNNING', 'FAILED'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingTask) {
      if (existingTask.status === 'FAILED') {
        this.logger.log(
          `Reusing failed task ${existingTask.id} for node ${node.id} (Retry incremented)`,
        );
        // Reuse existing task -> set to QUEUED
        await db.workflowTask.update({
          where: { id: existingTask.id },
          data: {
            status: 'QUEUED',
            error: null,
            retries: { increment: 1 },
            updatedAt: new Date(),
          },
        });

        // Re-enqueue job
        const job: TaskExecuteJob = {
          taskId: existingTask.id,
          applicationId,
          nodeId: node.id,
          nodeType: node.type,
          nodeData: node.data || {},
          inputData,
          applicantId,
        };

        await this.queueService.enqueue('TASK_EXECUTE', job, {
          deduplicationId: existingTask.id,
        });
        return;
      } else {
        // Active task exists (PENDING, QUEUED, RUNNING)
        this.logger.warn(
          `Task for node ${node.id} already exists in status ${existingTask.status}. Skipping duplicate creation.`,
        );
        return;
      }
    }

    // Calculate SLA and Reminders
    let slaDueAt: Date | null = null;
    let reminderDueAt: Date | null = null;

    if (node.data?.advancedSettings) {
      const settings = node.data.advancedSettings;
      if (settings.slaHours && settings.slaHours > 0) {
        slaDueAt = new Date(Date.now() + settings.slaHours * 60 * 60 * 1000);
      }
      if (settings.reminderHours && settings.reminderHours > 0) {
        reminderDueAt = new Date(
          Date.now() + settings.reminderHours * 60 * 60 * 1000,
        );
      }
    }

    const task = await db.workflowTask.create({
      data: {
        applicationId,
        stepId: node.id,
        type: node.type,
        status: 'QUEUED', // Initial status is QUEUED
        assignedTo: assignedTo || null,
        assignedToDisplay: assignedToDisplay || null,
        assignedToInfo: assignedToInfo || null,
        config: node.data || {},
        slaDueAt,
        reminderDueAt,
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

    // Pass task.id as deduplicationId
    await this.queueService.enqueue('TASK_EXECUTE', job, {
      deduplicationId: task.id,
    });
    this.logger.log(
      `Enqueued task ${task.id} (type: ${node.type}) for application ${applicationId}`,
    );
  }

  async enqueueServiceTask(
    applicationId: string,
    node: any,
    inputData: any,
    applicantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.enqueueTask(
      applicationId,
      node,
      inputData,
      applicantId,
      null,
      null,
      null,
      tx,
    );
  }

  async resolveAssignedTo(
    assignee: string | null,
    applicantId: string,
  ): Promise<string | null> {
    if (!assignee) return null;

    if (assignee === 'applicant') {
      return `user:${applicantId}`;
    }

    if (assignee === 'applicant_manager') {
      try {
        const manager = await this.usersService.getManager(applicantId);
        if (manager) {
          return `user:${manager.username}`;
        }
        this.logger.warn(
          `Manager not found for ${applicantId}, falling back to admin`,
        );
        return 'user:admin';
      } catch (e) {
        this.logger.error(`Failed to resolve manager for ${applicantId}`, e);
        return 'user:admin';
      }
    }

    return assignee;
  }

  /**
   * 宛先リスト（配列またはカンマ区切り文字列）からメールアドレスのリスト解決する
   */
  async resolveEmails(
    recipients: string | string[],
    applicantId: string,
  ): Promise<string[]> {
    const results = new Set<string>();
    const list = Array.isArray(recipients)
      ? recipients
      : recipients
        ? [recipients]
        : [];

    // Split comma separated strings if any
    const flattened: string[] = [];
    for (const item of list) {
      if (item.includes(',')) {
        flattened.push(...item.split(',').map((s) => s.trim()));
      } else {
        flattened.push(item);
      }
    }

    for (const recipient of flattened) {
      if (!recipient) continue;

      // 1. Direct Email
      if (recipient.includes('@')) {
        results.add(recipient);
        continue;
      }

      // 2. Applicant
      if (recipient === 'applicant') {
        const user = await this.usersService.getUserSnapshot(applicantId);
        if (user && user.email) {
          results.add(user.email);
        } else {
          this.logger.warn(
            `Applicant ${applicantId} not found or has no email.`,
          );
        }
        continue;
      }

      // 3. Manager
      if (recipient === 'applicant_manager') {
        const manager = await this.usersService.getManager(applicantId);
        if (manager && manager.email) results.add(manager.email);
        continue;
      }

      // 4. User
      if (recipient.startsWith('user:')) {
        const username = recipient.substring(5);
        const user =
          await this.usersService.getUserSnapshotByUsername(username);
        if (user && user.email) {
          results.add(user.email);
        } else {
          this.logger.warn(`User ${username} not found or has no email.`);
        }
        continue;
      }

      // 5. Group
      if (recipient.startsWith('group:')) {
        const identifier = recipient.substring(6);
        const members =
          await this.usersService.getGroupMembersByIdentifier(identifier);
        members.forEach((m) => {
          if (m.email) results.add(m.email);
        });
        continue;
      }

      // 6. Role (Optional check, if supported)
      if (recipient.startsWith('role:')) {
        // Not supported yet in UsersService fully for fetching users
        this.logger.warn(`Role recipient not supported yet: ${recipient}`);
        continue;
      }

      // 7. Fallback: Treat as username if no other match and looks valid?
      // Or assume it might be a variable that wasn't substituted?
      // If it's a simple string, we try to resolve as username
      const user = await this.usersService.getUserSnapshotByUsername(recipient);
      if (user && user.email && user.username !== 'unknown') {
        results.add(user.email);
      }
    }

    return Array.from(results);
  }

  async resolveAssignedToSnapshot(assignee: string): Promise<any> {
    return this.usersService.resolveAssignedToSnapshot(assignee);
  }

  async advanceToNextNode(
    applicationId: string,
    fromNodeId?: string,
    targetNodeId?: string,
  ) {
    await this.queueService.enqueue('WORKFLOW_NODE_PROCESS', {
      applicationId,
      fromNodeId,
      targetNodeId,
    });
    this.logger.log(
      `Enqueued processing for application ${applicationId} (from: ${fromNodeId || 'current'}, target: ${targetNodeId || 'auto'})`,
    );
  }

  // Helper to trigger specific node execution (for Parallel branches)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async triggerNodeExecution(_applicationId: string, _nodeId: string) {
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
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const check = new Function('data', `return ${condition}`);
      return check(data);
    } catch (e) {
      this.logger.error(`Failed to evaluate condition: ${condition}`, e);
      return false;
    }
  }

  validateTaskInput(
    task: any,
    inputData: any,
    formSchema: any,
    stepId?: string,
  ): void {
    if (!inputData || !formSchema) return;

    // Global Validation Rules
    const globalRules = formSchema.validationRules || [];
    const properties = formSchema.properties || {};
    const errors: string[] = [];

    // Combine inputData with existing application data for cross-field validation
    const allData = { ...(task.application?.inputData || {}), ...inputData };

    if (!globalRules || globalRules.length === 0) return;

    for (const rule of globalRules) {
      // 1. Check Scope
      if (rule.applyToTasks && rule.applyToTasks.length > 0) {
        // If stepId is provided, check if it's in the list
        if (stepId && !rule.applyToTasks.includes(stepId)) {
          continue;
        }
        // If stepId is NOT provided (e.g. unknown context), maybe skip scoped rules?
        // Safer to skip if scope is strict.
        if (!stepId) continue;
      }

      // 2. Check Severity
      if (rule.severity !== 'error') continue;

      // 3. Evaluate Conditions
      const results = rule.conditions.map((c: any) =>
        this.evaluateStructuredCondition(c, allData),
      );
      const isMatch =
        rule.logic === 'OR'
          ? results.some((r: boolean) => r)
          : results.every((r: boolean) => r);

      if (isMatch) {
        const fieldLabel =
          properties[rule.targetFieldId]?.title ||
          properties[rule.targetFieldId]?.label ||
          rule.targetFieldId;

        if (rule.type === 'required') {
          // For required type, "Match" means "Constraint Active".
          // We must check if value is empty.
          const val = allData[rule.targetFieldId];
          if (val === undefined || val === null || val === '') {
            errors.push(rule.message || `${fieldLabel} is required`);
          }
        } else if (rule.type === 'constraint') {
          // For constraint type, "Match" means "Violation".
          errors.push(rule.message || `Validation error on ${fieldLabel}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }
  }

  evaluateStructuredCondition(condition: any, allData: any): boolean {
    const targetValue = allData[condition.fieldId];
    const compareValue =
      condition.valueType === 'field'
        ? allData[condition.value]
        : condition.value;
    const operator = condition.operator;

    switch (operator) {
      case 'empty':
        return (
          targetValue === undefined ||
          targetValue === null ||
          targetValue === ''
        );
      case 'not_empty':
        return (
          targetValue !== undefined &&
          targetValue !== null &&
          targetValue !== ''
        );
      // Loose equality for backend too to match frontend JS behavior?
      // JS '==' matches 1 and '1'.
      case 'eq':
        return targetValue == compareValue;
      case 'neq':
        return targetValue != compareValue;
      case 'contains':
        return String(targetValue || '').includes(String(compareValue || ''));
      case 'not_contains':
        return !String(targetValue || '').includes(String(compareValue || ''));
      case 'gt':
        return Number(targetValue) > Number(compareValue);
      case 'lt':
        return Number(targetValue) < Number(compareValue);
      case 'gte':
        return Number(targetValue) >= Number(compareValue);
      case 'lte':
        return Number(targetValue) <= Number(compareValue);
      default:
        return false;
    }
  }

  /**
   * 指定されたノードが含まれるスイムレーンを特定する
   * React Flowの座標情報(position)とSwimLaneのサイズ(data.width/height)を使用する
   */
  findEnclosingSwimLane(targetNode: any, allNodes: any[]): any {
    if (!targetNode || !allNodes) return null;

    // ParentId based check (Prioritize explicit grouping)
    if (targetNode.parentId) {
      const parent = allNodes.find((n) => n.id === targetNode.parentId);
      if (parent && parent.type === 'swimlane') {
        return parent;
      }
    }

    // Geometric check
    const tx = targetNode.position?.x || 0;
    const ty = targetNode.position?.y || 0;
    // Node size is hard to know exactly without measuring, but we can assume top-left point containment
    // or add a small offset (e.g., center?). Let's check top-left for now.

    const swimlanes = allNodes.filter((n) => n.type === 'swimlane');

    for (const lane of swimlanes) {
      const lx = lane.position?.x || 0;
      const ly = lane.position?.y || 0;
      const lw = lane.data?.width || 0;
      const lh = lane.data?.height || 0;

      // Check if Node(tx, ty) is inside Lane(lx, ly, lw, lh)
      if (tx >= lx && tx < lx + lw && ty >= ly && ty < ly + lh) {
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
