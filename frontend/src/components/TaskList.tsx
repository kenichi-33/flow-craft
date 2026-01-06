'use client';

import React, { useMemo } from 'react';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Typography,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import SecurityIcon from '@mui/icons-material/Security';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { UserDisplay } from './UserDisplay';

interface Task {
    id: string;
    stepId: string;
    stepName?: string;
    assignedTo?: string;
    assignedToInfo?: any;
    assignedToDisplay?: string;  // バックエンドで変換済みの表示用名前
    status: string;
    createdAt: string;
    updatedAt?: string;
    completedAt?: string;
}

interface TaskListProps {
    tasks: Task[];
    serviceTasks?: any[]; // ServiceTask型を詳細定義するのが理想だが一旦any[]で
    flowNodes?: any[];
    flowEdges?: any[];
    applicationInfo?: {
        applicantId?: string;
        applicantInfo?: any; // スナップショットを追加
        createdAt?: string;
        status?: string;
    };
    title?: string;
    showHeader?: boolean;
    // グループcode→名前の変換マップ（オプション）
    departmentsMap?: Record<string, string>;
    // 承認履歴（完了済みタスクの実行者表示用）
    history?: any[];
}

const getStatusChip = (status: string, isStartNode: boolean, applicationStatus?: string) => {
    // 特例: アプリケーションが差し戻し中で、かつ開始ノードのタスクの場合、
    // 実態がCOMPLETEDでも「差戻（対応中）」のように見せたい場合があるが、
    // ユーザーの要望は「完了になっているのはおかしい」＝「対応中」あるいは「差戻」にしたい。
    // ここでは、アプリケーションがREMANDEDで、対象が開始ノードなら「差戻」または「対応中」とする。
    if (isStartNode && applicationStatus === 'REMANDED') {
         return <Chip label="差戻対応中" size="small" color="warning" />;
    }

    switch (status) {
        case 'PENDING':
            return <Chip label="対応中" size="small" color="warning" />;
        case 'APPROVED':
            return <Chip label="承認済" size="small" color="success" />;
        case 'COMPLETED':
            return <Chip label="完了" size="small" color="success" />;
        case 'REJECTED':
            return <Chip label="却下" size="small" color="error" />;
        case 'REMANDED':
            return <Chip label="差戻" size="small" color="secondary" />;
        case 'WAITING':
            return <Chip label="待機中" size="small" color="default" icon={<ScheduleIcon />} />;
        default:
            return <Chip label={status} size="small" />;
    }
};

const getAssigneeDisplay = (
    assignedTo: string | undefined, 
    nodeData: any, 
    departmentsMap?: Record<string, string>, 
    assignedToDisplay?: string, 
    assignedToInfo?: any,
    history?: any[]
) => {
    // 完了済みで履歴がある場合は履歴の実行者を表示する
    if (history && history.length > 0) {
        // 直近の承認履歴を取得
        const latestHistory = history[history.length - 1];
        // console.log('[TaskList] using history:', latestHistory);
        return (
            <Box>
                <UserDisplay user={latestHistory.actorInfo} fallback={latestHistory.actorId} />
                {assignedTo && assignedTo !== latestHistory.actorId && (
                    <Typography variant="caption" color="text.secondary" display="block">
                        (担当: {assignedToDisplay || assignedTo})
                    </Typography>
                )}
            </Box>
        );
    }

    // スナップショットがあればUserDisplayを使用
    if (assignedToInfo) {
        return <UserDisplay user={assignedToInfo} fallback={assignedToDisplay || assignedTo} />;
    }

    // バックエンドで変換済みの表示がある場合、かつユーザーIDが特定できるならUserDisplay風に表示
    // 未来のタスクの場合、nodeData.assignee に "user:username" が入っている可能性がある
    const rawAssignee = assignedTo || nodeData?.assignee;
    const display = assignedToDisplay || nodeData?.assigneeDisplay;
    
    if (display && rawAssignee && rawAssignee.startsWith('user:')) {
        // ユーザー名がわかる場合はツールチップ付きで表示したい
        const username = rawAssignee.substring(5);
        // 仮のSnapshotを作成
        // UserDisplayは first/last がない場合 username を優先してしまうため、
        // 表示名を lastName に入れることで強制的に表示させる（ツールチップには username が出る）
        const fakeSnapshot = {
            username: username,
            lastName: display,
            type: 'user' as const
        };
        // fallbackに表示名を使うことで、UserDisplayは表示名を表示しつつ、ツールチップにusernameを表示する
        return <UserDisplay user={fakeSnapshot} fallback={display} />;
    }

    // 表示名だけがある場合（グループ名など）
    if (display) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <GroupIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">{display}</Typography>
            </Box>
        );
    }


    
    // 未生成のタスクの場合、ノードから担当者を取得
    const assigned = assignedTo || nodeData?.assignee;
    if (!assigned) return '-';
    
    if (assigned.startsWith('user:')) {
        const username = assigned.substring(5);
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">{username}</Typography>
            </Box>
        );
    }
    
    if (assigned.startsWith('role:')) {
        const role = assigned.substring(5);
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SecurityIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">{role}</Typography>
            </Box>
        );
    }
    
    if (assigned.startsWith('group:')) {
        const group = assigned.substring(6);
        // departmentsMapがあればそれを使用、なければパスから抽出
        const groupName = departmentsMap?.[group] || group.split('/').pop() || group;
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <GroupIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">{groupName}</Typography>
            </Box>
        );
    }
    
    // 日本語表示（applicant_managerなど）
    if (assigned === 'applicant_manager') {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">申請者の上長</Typography>
            </Box>
        );
    }
    
    return assigned;
};

const formatDateTime = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function TaskList({ tasks, serviceTasks, flowNodes, flowEdges, applicationInfo, title = 'タスク一覧', showHeader = true, departmentsMap, history }: TaskListProps) {
    // フロー定義と既存タスクをマージして全ステップを表示
    const allSteps = useMemo(() => {
        if (!flowNodes || flowNodes.length === 0) {
            // フローノードがない場合は既存タスクのみ表示
            return tasks.map(task => ({
                ...task,
                nodeData: null,
                nodeType: 'approval',
            }));
        }

        // ゲートウェイ以外のノードを取得（開始・完了・承認ノードなど）
        const gatewayTypes = ['parallel', 'join', 'branch', 'swimlane'];
        const displayNodes = flowNodes.filter(node => !gatewayTypes.includes(node.type));

        // ノードの順序を決定（edgesから）
        const getNodeOrder = (nodeId: string, nodeType: string): number => {
            // 終了は常に最後
            if (nodeType === 'end') return 99999;
            // 開始は常に最初
            if (nodeType === 'start') return -1;
            
            if (!flowEdges) return 0;
            // スタートからの距離を計算（簡易版）
            const visited = new Set<string>();
            const queue: { id: string; depth: number }[] = [];
            
            // スタートノードを探す
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

        // 各ノードに対してタスク情報をマージ
        const steps = displayNodes.map(node => {
            const task = tasks.find(t => t.stepId === node.id);
            const serviceTask = serviceTasks?.find(t => t.stepId === node.id);
            
            // 開始ノードの場合、申請者と申請日時を表示
            if (node.type === 'start') {
                return {
                    id: `start-${node.id}`,
                    stepId: node.id,
                    stepName: node.data?.label || '開始',
                    assignedTo: applicationInfo?.applicantId ? `user:${applicationInfo.applicantId}` : undefined,
                    assignedToInfo: applicationInfo?.applicantInfo, // スナップショットを渡す
                    status: 'COMPLETED', // 開始は常に完了
                    createdAt: applicationInfo?.createdAt || '',
                    updatedAt: applicationInfo?.createdAt,
                    nodeData: node.data,
                    nodeType: node.type,
                    order: getNodeOrder(node.id, node.type),
                };
            }
            
            // 終了ノードの場合
            if (node.type === 'end') {
                const isEnded = applicationInfo?.status === 'APPROVED' || applicationInfo?.status === 'REJECTED';
                return {
                    id: `end-${node.id}`,
                    stepId: node.id,
                    stepName: node.data?.label || '完了',
                    assignedTo: undefined,
                    status: isEnded ? 'APPROVED' : 'WAITING',
                    createdAt: '',
                    updatedAt: undefined,
                    nodeData: node.data,
                    nodeType: node.type,
                    order: getNodeOrder(node.id, node.type),
                };
            }

            // サービスタスクの場合
            if (['apiCall', 'llmCall'].includes(node.type)) {
                return {
                    id: serviceTask?.id || `pending-service-${node.id}`,
                    stepId: node.id,
                    stepName: node.data?.label || (node.type === 'apiCall' ? 'API実行' : 'AI処理'),
                    assignedTo: 'system', // システム処理
                    assignedToDisplay: 'システム',
                    status: serviceTask?.status || 'WAITING',
                    createdAt: serviceTask?.createdAt || '',
                    updatedAt: serviceTask?.updatedAt || undefined, // serviceTasksにはupdatedAtがない場合があるが仮定
                    completedAt: undefined,
                    nodeData: node.data,
                    nodeType: node.type,
                    order: getNodeOrder(node.id, node.type),
                };
            }
            
            // 関連する履歴を抽出
            const stepHistory = history?.filter(h => h.stepId === node.id) || [];

            // 承認タスクの場合
            return {
                id: task?.id || `pending-${node.id}`,
                stepId: node.id,
                stepName: node.data?.label || node.id,
                assignedTo: task?.assignedTo,
                assignedToInfo: task?.assignedToInfo,
                assignedToDisplay: task?.assignedToDisplay,  // バックエンドで変換済みの表示
                status: task?.status || 'WAITING',
                createdAt: task?.createdAt || '',
                updatedAt: task?.updatedAt,
                completedAt: task?.completedAt,
                nodeData: node.data,
                nodeType: node.type,
                order: getNodeOrder(node.id, node.type),
                history: stepHistory,
            };
        });

        // 順序でソート
        steps.sort((a, b) => a.order - b.order);
        
        return steps;
    }, [tasks, serviceTasks, flowNodes, flowEdges, applicationInfo, history]);

    if (allSteps.length === 0) {
        return (
            <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>ステップがありません</Typography>
            </Box>
        );
    }

    return (
        <Box>
            {showHeader && (
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                    {title}
                </Typography>
            )}
            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell>ステップ</TableCell>
                            <TableCell>担当</TableCell>
                            <TableCell>ステータス</TableCell>
                            <TableCell>作成日時</TableCell>
                            <TableCell>完了日時</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {allSteps.map((step) => (
                            <TableRow 
                                key={step.id} 
                                hover
                                sx={{
                                    bgcolor: step.status === 'WAITING' ? 'action.hover' : 'inherit',
                                    opacity: step.status === 'WAITING' ? 0.7 : 1,
                                }}
                            >
                                <TableCell>
                                    <Typography variant="body2" fontWeight="medium">
                                        {step.stepName}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    {getAssigneeDisplay(
                                        step.assignedTo, 
                                        step.nodeData, 
                                        departmentsMap, 
                                        step.assignedToDisplay, 
                                        (step as any).assignedToInfo,
                                        (step as any).history
                                    )}
                                </TableCell>
                                <TableCell>
                                    {getStatusChip(
                                        step.status, 
                                        step.stepId === 'start' || step.stepName === 'start' || (flowNodes?.find(n => n.id === step.stepId)?.type === 'start'), 
                                        applicationInfo?.status
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                        {formatDateTime(step.createdAt)}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                        {step.status !== 'PENDING' && step.status !== 'WAITING'
                                            ? formatDateTime(step.updatedAt || step.completedAt)
                                            : '-'}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
