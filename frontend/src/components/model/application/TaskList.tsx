import React, { useMemo } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserDisplay } from '@/components/common/UserDisplay';
import { User as UserIcon, Users, Shield } from 'lucide-react';
import { getNodeLabel } from '@/constants/node-labels';

interface WorkflowTask {
    id: string;
    stepId: string;
    type: string;
    status: string;
    assignedTo?: string;
    assignedToDisplay?: string;
    assignedToInfo?: any;
    result?: any;
    error?: string;
    createdAt: string;
    updatedAt?: string;
    completedAt?: string;
    history?: any[];
}

interface TaskListProps {
    workflowTasks?: WorkflowTask[];
    flowNodes?: any[];
    flowEdges?: any[];
    applicationInfo?: {
        applicantId?: string;
        applicantInfo?: any;
        createdAt?: string;
        status?: string;
    };
    title?: string;
    history?: any[];
}

const getStatusBadge = (status: string, isStartNode: boolean, applicationStatus?: string) => {
    if (isStartNode && applicationStatus === 'REMANDED') {
         return <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">差戻(対応中)</Badge>;
    }

    switch (status) {
        case 'PENDING':
            return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">対応中</Badge>;
        case 'APPROVED':
            return <Badge variant="default" className="bg-green-600 hover:bg-green-700">承認済</Badge>;
        case 'COMPLETED':
            return <Badge variant="default" className="bg-green-600 hover:bg-green-700">完了</Badge>;
        case 'REJECTED':
            if (applicationStatus === 'REJECTED') {
                return <Badge variant="destructive">却下</Badge>;
            }
            return <Badge variant="destructive">却下</Badge>;
        case 'REMANDED':
            return <Badge variant="destructive" className="bg-orange-600 hover:bg-orange-700">差戻</Badge>;
        case 'WAITING':
            return <Badge variant="outline" className="text-muted-foreground">待機中</Badge>;
        case 'CANCELED':
            return <Badge variant="outline" className="text-muted-foreground">キャンセル</Badge>;
        case 'DRAFT':
            return <Badge variant="outline" className="text-muted-foreground bg-gray-100">下書き</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
};

const getAssigneeDisplay = (
    assignedTo: string | undefined, 
    nodeData: any, 
    assignedToDisplay?: string, 
    assignedToInfo?: any,
    history?: any[]
) => {
    // 完了済みで履歴がある場合は履歴の実行者を表示する (ただし、システムによる自動割り当てログは除外 && タスクがPENDINGでないこと)
    // PENDINGの場合は現在の担当者を表示するため、履歴（割り当てログなど）は無視する
    const isPending = nodeData && nodeData.status === 'PENDING'; // Note: nodeData here is actually node.data from Flow, not task status. 
    // Wait, getAssigneeDisplay doesn't get task status directly. 
    // But history checks usually imply completion for Approval. For Input/System tasks, we have intermediate logs.
    // Let's filter out 'ASSIGN_INPUT' action from history for display purposes.
    
    if (history && history.length > 0) {
        const latestHistory = history[history.length - 1];
        // システムアクション、またはタスク作成アクションの場合は履歴のアクターを表示しない（担当者を表示する）
        if (latestHistory.actorId !== 'SYSTEM' && latestHistory.action !== 'ASSIGN_INPUT') {
            return (
                <div>
                    <UserDisplay user={latestHistory.actorInfo} fallback={latestHistory.actorId} />
                    {assignedTo && assignedTo !== latestHistory.actorId && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                            (担当: {assignedToDisplay || assignedTo})
                        </div>
                    )}
                </div>
            );
        }
    }


    // スナップショットがあればUserDisplayを使用
    if (assignedToInfo) {
        return <UserDisplay user={assignedToInfo} fallback={assignedToDisplay || assignedTo} />;
    }

    const rawAssignee = assignedTo || nodeData?.assignee;
    const display = assignedToDisplay || nodeData?.assigneeDisplay;
    
    // 既存のUser/Role/Group解決ロジックも UserDisplay へ委譲できる形に正規化したいが、
    // UserDisplayは現状 user オブジェクトを期待するため、簡易的なオブジェクトを作成する
    
    if (display && rawAssignee && rawAssignee.startsWith('user:')) {
        const username = rawAssignee.substring(5);
        return <UserDisplay user={{ username, lastName: display, type: 'user' }} fallback={display} />;
    }

    // Role/Group/Manager などの特殊な割り当て
    if (rawAssignee) {
         let type: 'user' | 'group' | 'role' | 'system' = 'user';
         let label = display || rawAssignee;
         
         if (rawAssignee.startsWith('group:')) type = 'group';
         if (rawAssignee.startsWith('role:')) type = 'role';
         if (rawAssignee === 'applicant_manager') label = '申請者の上長';
         
         // Display fallback with icon if UserDisplay doesn't support raw string
         // But better to use UserDisplay if we can mock the user object?
         // Actually UserDisplay handles `user` prop.
         // Let's create a fake user object for display consistency (tooltip etc won't work perfectly but style will match)
         // Wait, UserDisplay tooltip relies on `username`.
         
         return (
            <div className="flex items-center gap-1.5">
                {type === 'group' && <Users className="h-3.5 w-3.5 text-muted-foreground" />}
                {type === 'role' && <Shield className="h-3.5 w-3.5 text-muted-foreground" />}
                {type === 'user' && <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                <span>{label && label.startsWith(type + ':') ? label.substring(type.length + 1) : label}</span>
            </div>
         );
    }
    
    return <span className="text-muted-foreground">-</span>;
};

const formatDateTime = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function TaskList({ 
    workflowTasks = [], 
    flowNodes = [], 
    flowEdges = [], 
    applicationInfo, 
    history 
}: TaskListProps) {
    const allSteps = useMemo(() => {
        if (!flowNodes || flowNodes.length === 0) {
            return workflowTasks.filter(t => ['approval', 'userInput', 'input'].includes(t.type)).map(task => ({
                ...task,
                nodeData: null,
                nodeType: task.type,
                stepId: task.stepId,
                stepName: task.type === 'approval' ? '承認' : '入力タスク',
                order: 0
            }));
        }

        const gatewayTypes = ['parallel', 'join', 'branch', 'swimlane'];
        const displayNodes = flowNodes.filter(node => !gatewayTypes.includes(node.type));

        const getNodeOrder = (nodeId: string, nodeType: string): number => {
            if (nodeType === 'end') return 99999;
            if (nodeType === 'start') return -1;
            
            if (!flowEdges) return 0;
            const visited = new Set<string>();
            const queue: { id: string; depth: number }[] = [];
            
            const startNode = flowNodes.find(n => n.type === 'start');
            if (startNode) {
                queue.push({ id: startNode.id, depth: 0 });
            }
            
            while (queue.length > 0) {
                const current = queue.shift()!;
                if (current.id === nodeId) return current.depth;
                if (visited.has(current.id)) continue;
                visited.add(current.id);
                
                const outEdges = flowEdges.filter(e => e.source === current.id);
                for (const edge of outEdges) {
                    queue.push({ id: edge.target, depth: current.depth + 1 });
                }
            }
            return 999;
        };

        const steps = displayNodes.map(node => {
            // Find related workflow task
            const relatedTask = workflowTasks?.find(t => t.stepId === node.id && t.status !== 'CANCELED');
            
            // Start Node
            if (node.type === 'start') {
                return {
                    id: `start-${node.id}`,
                    stepId: node.id,
                    stepName: node.data?.label || '開始',
                    assignedTo: applicationInfo?.applicantId ? `user:${applicationInfo.applicantId}` : undefined,
                    assignedToInfo: applicationInfo?.applicantInfo,
                    status: applicationInfo?.status === 'DRAFT' ? 'DRAFT' : 'COMPLETED',
                    createdAt: applicationInfo?.createdAt || '',
                    updatedAt: applicationInfo?.createdAt,
                    nodeData: node.data,
                    nodeType: node.type,
                    order: getNodeOrder(node.id, node.type),
                };
            }
            
            // End Node
            if (node.type === 'end') {
                const isEnded = applicationInfo?.status === 'APPROVED' || applicationInfo?.status === 'REJECTED';
                return {
                    id: `end-${node.id}`,
                    stepId: node.id,
                    stepName: node.data?.label || '完了',
                    assignedTo: undefined,
                    status: isEnded ? (applicationInfo?.status || 'APPROVED') : 'WAITING',
                    createdAt: '',
                    updatedAt: undefined,
                    nodeData: node.data,
                    nodeType: node.type,
                    order: getNodeOrder(node.id, node.type),
                };
            }

            // Service Task or Approval Task
            return {
                id: relatedTask?.id || `pending-${node.id}`,
                stepId: node.id,
                stepName: node.data?.label || getNodeLabel(node.type, node.id),
                assignedTo: relatedTask?.assignedTo || (['apiCall', 'llmCall'].includes(node.type) ? 'system' : undefined),
                assignedToInfo: relatedTask?.assignedToInfo,
                assignedToDisplay: relatedTask?.assignedToDisplay || (['apiCall', 'llmCall'].includes(node.type) ? 'システム' : undefined),
                status: relatedTask?.status || 'WAITING',
                createdAt: relatedTask?.createdAt || '',
                updatedAt: relatedTask?.updatedAt,
                completedAt: relatedTask?.completedAt || (['COMPLETED', 'FAILED', 'REJECTED', 'APPROVED'].includes(relatedTask?.status || '') ? relatedTask?.updatedAt : undefined),
                nodeData: node.data,
                nodeType: node.type,
                order: getNodeOrder(node.id, node.type),
                history: [
                    ...(history?.filter(h => h.stepId === node.id) || []),
                    ...(
                        // 承認タスクのログは通常履歴に含まれるが、Input/Serviceタスクのシステムログも表示する
                        (node.type !== 'approval') 
                        ? (relatedTask?.history?.map(h => ({
                            id: h.id,
                            action: h.status,
                            actorId: 'SYSTEM',
                            actorInfo: { username: 'SYSTEM', lastName: 'システム', type: 'system' }, // Fake user info for display
                            comment: h.error ? `Error: ${h.error}` : (h.result ? '完了' : ''),
                            createdAt: h.executedAt,
                        })) || [])
                        : []
                    )
                ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
            };
        });

        return steps.sort((a, b) => a.order - b.order);
        
    }, [workflowTasks, flowNodes, flowEdges, applicationInfo, history]);

    if (allSteps.length === 0) {
        return <div className="text-center p-4 text-muted-foreground">ステップがありません</div>;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>ステップ</TableHead>
                    <TableHead>担当</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>作成日時</TableHead>
                    <TableHead>完了日時</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {allSteps.map((step) => (
                    <TableRow key={step.id} className={step.status === 'WAITING' ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{step.stepName}</TableCell>
                        <TableCell>
                            {getAssigneeDisplay(
                                step.assignedTo, 
                                step.nodeData, 
                                step.assignedToDisplay, 
                                step.assignedToInfo,
                                (step as any).history
                            )}
                        </TableCell>
                        <TableCell>
                            {getStatusBadge(
                                step.status, 
                                step.nodeType === 'start', 
                                applicationInfo?.status
                            )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                            {formatDateTime(step.createdAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                             {/* Uses history logic or updatedAt if available. 
                                 For Start Node, it is createdAt.
                                 For Service Task, updatedAt.
                                 For Approval Task, we might use history actedAt if available?
                             */}
                             {step.nodeType === 'start' ? formatDateTime(step.createdAt) :
                              (step as any).history?.length > 0 ? formatDateTime((step as any).history[(step as any).history.length - 1].actedAt) :
                              (step.status === 'COMPLETED' || step.status === 'APPROVED' || step.status === 'REJECTED') ? formatDateTime(step.updatedAt) : '-'}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
