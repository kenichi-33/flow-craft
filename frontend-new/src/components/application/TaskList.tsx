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

interface Task {
    id: string;
    stepId: string;
    stepName?: string;
    assignedTo?: string;
    assignedToInfo?: any;
    assignedToDisplay?: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
    completedAt?: string;
}

interface TaskListProps {
    tasks?: Task[];
    serviceTasks?: any[];
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
    // 完了済みで履歴がある場合は履歴の実行者を表示する
    if (history && history.length > 0) {
        const latestHistory = history[history.length - 1];
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

    // スナップショットがあればUserDisplayを使用
    if (assignedToInfo) {
        return <UserDisplay user={assignedToInfo} fallback={assignedToDisplay || assignedTo} />;
    }

    const rawAssignee = assignedTo || nodeData?.assignee;
    const display = assignedToDisplay || nodeData?.assigneeDisplay;
    
    if (display && rawAssignee && rawAssignee.startsWith('user:')) {
        const username = rawAssignee.substring(5);
        return <UserDisplay user={{ username, lastName: display, type: 'user' }} fallback={display} />;
    }

    if (display) {
        if (rawAssignee?.startsWith('group:')) {
            return <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" /><span>{display}</span></div>;
        }
        if (rawAssignee?.startsWith('role:')) {
            return <div className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-muted-foreground" /><span>{display}</span></div>;
        }
        return <span>{display}</span>;
    }
    
    if (!rawAssignee) return <span className="text-muted-foreground">-</span>;
    
    if (rawAssignee.startsWith('user:')) {
        return <div className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5 text-muted-foreground" /><span>{rawAssignee.substring(5)}</span></div>;
    }
    if (rawAssignee.startsWith('role:')) {
        return <div className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-muted-foreground" /><span>{rawAssignee.substring(5)}</span></div>;
    }
    if (rawAssignee.startsWith('group:')) {
        return <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" /><span>{rawAssignee.substring(6).split('/').pop()}</span></div>;
    }
    if (rawAssignee === 'applicant_manager') {
        return <div className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5 text-muted-foreground" /><span>申請者の上長</span></div>;
    }
    
    return <span>{rawAssignee}</span>;
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
    tasks = [], 
    serviceTasks = [], 
    flowNodes = [], 
    flowEdges = [], 
    applicationInfo, 
    history 
}: TaskListProps) {
    const allSteps = useMemo(() => {
        if (!flowNodes || flowNodes.length === 0) {
            return tasks.map(task => ({
                ...task,
                nodeData: null,
                nodeType: 'approval',
                stepId: task.stepId,
                stepName: task.stepName || '承認',
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
            const task = tasks.find(t => t.stepId === node.id && t.status !== 'CANCELED'); // Show actvive/completed, hide canceled? Or show all.
            const serviceTask = serviceTasks?.find(t => t.stepId === node.id);
            
            // Start Node
            if (node.type === 'start') {
                return {
                    id: `start-${node.id}`,
                    stepId: node.id,
                    stepName: node.data?.label || '開始',
                    assignedTo: applicationInfo?.applicantId ? `user:${applicationInfo.applicantId}` : undefined,
                    assignedToInfo: applicationInfo?.applicantInfo,
                    status: 'COMPLETED',
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

            // Service Task
            if (['apiCall', 'llmCall'].includes(node.type)) {
                return {
                    id: serviceTask?.id || `pending-service-${node.id}`,
                    stepId: node.id,
                    stepName: node.data?.label || (node.type === 'apiCall' ? 'API実行' : 'AI処理'),
                    assignedTo: 'system',
                    assignedToDisplay: 'システム',
                    status: serviceTask?.status || 'WAITING',
                    createdAt: serviceTask?.createdAt || '',
                    updatedAt: serviceTask?.updatedAt || undefined,
                    completedAt: undefined,
                    nodeData: node.data,
                    nodeType: node.type,
                    order: getNodeOrder(node.id, node.type),
                };
            }
            
            const stepHistory = history?.filter(h => h.stepId === node.id) || [];

            // Approval Task
            return {
                id: task?.id || `pending-${node.id}`,
                stepId: node.id,
                stepName: node.data?.label || node.id,
                assignedTo: task?.assignedTo,
                assignedToInfo: task?.assignedToInfo,
                assignedToDisplay: task?.assignedToDisplay,
                status: task?.status || 'WAITING',
                createdAt: task?.createdAt || '',
                updatedAt: task?.updatedAt,
                completedAt: task?.completedAt, // Backend might not send completedAt for tasks?
                // Actually ApplicationDetail definition for tasks doesn't have completedAt/updatedAt explicitly listed in previous file, 
                // but getWorkflowStatus returns tasks included which are ApprovalTask model.
                // Assuming createdAt is reliably there.
                nodeData: node.data,
                nodeType: node.type,
                order: getNodeOrder(node.id, node.type),
                history: stepHistory,
            };
        });

        return steps.sort((a, b) => a.order - b.order);
        
    }, [tasks, serviceTasks, flowNodes, flowEdges, applicationInfo, history]);

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
