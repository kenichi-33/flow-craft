import { Injectable, Logger } from '@nestjs/common';
import { INodeProcessor, NodeProcessorContext } from './node-processor.interface';
import { Prisma } from '@prisma/client';
import { WorkflowHelperService } from '../workflow-helper.service';

@Injectable()
export class BranchNodeProcessor implements INodeProcessor {
    private readonly logger = new Logger(BranchNodeProcessor.name);

    constructor(private helper: WorkflowHelperService) {}

    getType(): string {
        return 'branch';
    }

    async process(context: NodeProcessorContext, tx: Prisma.TransactionClient): Promise<void> {
        const { applicationId, nodeId, node, edges, inputData } = context;

        // Find outgoing edges
        const outgoingEdges = edges.filter(e => e.source === nodeId);
        
        let targetEdge: any = null;

        // 1. Check for Node-based Conditions (Advanced Builder)
        if (node.data?.conditions && Array.isArray(node.data.conditions) && node.data.conditions.length > 0) {
            const conditions = node.data.conditions;
            const logic = node.data.conditionLogic || 'and';
            
            // Evaluator Helper
            const compare = (a: any, op: string, b: any) => {
                if (!isNaN(Number(a)) && !isNaN(Number(b)) && a !== '' && b !== '') {
                    a = Number(a);
                    b = Number(b);
                }
                switch (op) {
                    case '==': return a == b;
                    case '!=': return a != b;
                    case '>': return a > b;
                    case '<': return a < b;
                    case '>=': return a >= b;
                    case '<=': return a <= b;
                    case 'contains': return String(a).includes(String(b));
                    default: return false;
                }
            };

            let isMatch = logic === 'and'; // Default true for AND, so one False makes it false

            if (logic === 'and') {
                isMatch = conditions.every((cond: any) => {
                    const fieldVal = inputData?.[cond.field];
                    const res = compare(fieldVal, cond.operator, cond.value);
                    this.logger.debug(`Branch Cond (AND): ${cond.field}(${fieldVal}) ${cond.operator} ${cond.value} => ${res}`);
                    return res;
                });
            } else {
                isMatch = conditions.some((cond: any) => {
                    const fieldVal = inputData?.[cond.field];
                    const res = compare(fieldVal, cond.operator, cond.value);
                    this.logger.debug(`Branch Cond (OR): ${cond.field}(${fieldVal}) ${cond.operator} ${cond.value} => ${res}`);
                    return res;
                });
            }

            this.logger.log(`Branch Logic (${logic.toUpperCase()}) Result: ${isMatch}`);

            const targetHandle = isMatch ? 'yes' : 'no';
            targetEdge = outgoingEdges.find(e => e.sourceHandle === targetHandle);

            if (!targetEdge) {
                this.logger.warn(`Branch Node ${nodeId}: No edge found for handle '${targetHandle}'`);
            }

        } else if (node.data?.conditionField) {
            // Legacy/Single Condition
            const { conditionField, conditionOperator, conditionValue } = node.data;
            const fieldVal = inputData?.[conditionField]; 
            
            // Helper function for comparison (Duplicate code, but kept for clarity or should be refactored)
            const compare = (a: any, op: string, b: any) => {
                if (!isNaN(Number(a)) && !isNaN(Number(b)) && a !== '' && b !== '') {
                    a = Number(a);
                    b = Number(b);
                }
                switch (op) {
                    case '==': return a == b;
                    case '!=': return a != b;
                    case '>': return a > b;
                    case '<': return a < b;
                    case '>=': return a >= b;
                    case '<=': return a <= b;
                    case 'contains': return String(a).includes(String(b));
                    default: return false;
                }
            };

            const isMatch = compare(fieldVal, conditionOperator, conditionValue);
            this.logger.debug(`Branch Eval (Legacy): ${fieldVal} ${conditionOperator} ${conditionValue} = ${isMatch}`);

            const targetHandle = isMatch ? 'yes' : 'no';
            targetEdge = outgoingEdges.find(e => e.sourceHandle === targetHandle);

            if (!targetEdge) {
                this.logger.warn(`Branch Node ${nodeId}: No edge found for handle '${targetHandle}'`);
            }
        } 
        
        // 2. Fallback to Edge-based conditions (BPMN style) if no node condition
        if (!targetEdge && !node.data?.conditionField && (!node.data?.conditions || node.data.conditions.length === 0)) {
            // Find edge with condition that evaluates to true
            for (const edge of outgoingEdges) {
                if (edge.data?.condition) {
                     if (this.helper.evaluateCondition(inputData, edge.data.condition)) {
                         targetEdge = edge;
                         break;
                     }
                }
            }
            // Find default if no match
            if (!targetEdge) {
                targetEdge = outgoingEdges.find(e => e.data?.isDefault);
            }
        }

        if (targetEdge) {
            const nextNodeId = targetEdge.target;
            this.logger.log(`Branch node ${nodeId} evaluated to path: ${targetEdge.id} -> ${nextNodeId}`);
            
            await tx.application.update({
                where: { id: applicationId },
                data: { currentNodeId: nextNodeId },
            });
            
            await tx.approvalHistory.create({
                data: {
                    applicationId,
                    actorId: 'SYSTEM',
                    action: 'BRANCH_EVAL',
                    stepId: nodeId,
                    comment: `条件分岐: ${targetEdge.sourceHandle || 'default'} (Target: ${nextNodeId})`,
                }
            });
            
            // Advance
            // Logic handled by Executor loop or we call advanceToNextNode (which is idempotent? NO, it enqueues).
            // Executor processes ONE node. If we update `currentNodeId`, we are done with THIS node.
            // The Executor loop picks up the new `currentNodeId` in the NEXT iteration?
            // Actually, the Queue Worker processes one "job".
            // A job corresponds to "Processing Application X".
            // If we just updated DB, we need to TRIGGER the next processing.
            // Unless `process` is supposed to return the "next node" to the worker?
            // `INodeProcessor` returns `void`.
            // So we MUST call `advanceToNextNode`.
            await this.helper.advanceToNextNode(applicationId, 0, nodeId, nextNodeId);

        } else {
             this.logger.warn(`Branch node ${nodeId} has no valid path`);
             // Do not advance. Stuck.
             // Maybe set status to ERROR?
        }
    }
}
