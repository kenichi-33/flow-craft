'use client';

import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Typography,
    Chip,
    Divider,
    Button,
    Grid,
    TextField,
    alpha,
} from '@mui/material';
import { useParams } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ReplayIcon from '@mui/icons-material/Replay';
import Link from 'next/link';
import FlowVisualization from '@/components/flow-designer/FlowVisualization';
import 'reactflow/dist/style.css';
import DynamicFormRenderer from '@/components/application/DynamicFormRenderer';
import ApprovalHistory from '@/components/ApprovalHistory';
import TaskList from '@/components/TaskList';
import { UserDisplay } from '@/components/UserDisplay';
import { useAuth } from '@/providers/AuthProvider';
import AssignmentIcon from '@mui/icons-material/Assignment';

interface ApplicationDetail {
    id: string;
    applicationNumber: number;
    applicantId: string;
    applicantInfo?: any;
    status: string;
    inputData: any;
    createdAt: string;
    updatedAt: string;
    currentNodeId?: string;
    currentNode?: any;
    applicationDefinition?: {
        id: string;
        name: string;
    };
    formDefinition?: {
        schema: any;
    };
    flowDefinition?: {
        nodes: any[];
        edges: any[];
    };
    tasks: Array<{
        id: string;
        status: string;
        stepId: string;
        assignedTo?: string;
        assignedToInfo?: any;
        createdAt: string;
    }>;
    history: Array<{
        id: string;
        action: string;
        actorId: string;
        actorInfo?: any;
        comment?: string;
        stepId: string;
        actedAt: string;
    }>;
    serviceTasks: Array<{
        id: string;
        stepId: string;
        type: string;
        status: string;
        result?: any;
        error?: string;
        createdAt: string;
        history?: Array<{
            id: string;
            status: string;
            error?: string;
            executedAt: string;
        }>;
    }>;
}

// フロー進捗表示用のシンプルなノードコンポーネント（警告抑制用）
const SimpleNode = ({ data }: { data: any }) => (
    <Box sx={{ p: 1, textAlign: 'center' }}>
        {data?.label || ''}
    </Box>
);

// nodeTypesの定義（ReactFlow警告抑制）
const nodeTypes = {
    approval: SimpleNode,
    apiCall: SimpleNode,
    llmCall: SimpleNode,
    start: SimpleNode,
    end: SimpleNode,
    parallel: SimpleNode,
    join: SimpleNode,
    branch: SimpleNode,
    swimlane: SimpleNode,
};

const SectionPaper = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Paper
        elevation={0}
        sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
        }}
    >
        <Typography
            variant="h6"
            sx={{
                fontWeight: 700,
                mb: 2,
                pb: 1.5,
                borderBottom: '2px solid',
                borderColor: alpha('#667eea', 0.3),
                color: '#333',
            }}
        >
            {title}
        </Typography>
        {children}
    </Paper>
);

export default function ApplicationDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // ユーザーがタスクの担当者かチェック
    const isUserAssignedToTask = (assignedTo: string | undefined): boolean => {
        if (!assignedTo || !user) {
            console.log('[isUserAssignedToTask] No assignedTo or user', { assignedTo, user });
            return false;
        }

        console.log('[isUserAssignedToTask] Checking:', { 
            assignedTo, 
            username: user.username,
            userGroups: user.groups,
            userRoles: user.roles 
        });

        const assignments = assignedTo.split(',').map(s => s.trim());
        const result = assignments.some(a => {
            if (a.startsWith('user:')) {
                const match = a.substring(5) === user.username;
                console.log('[isUserAssignedToTask] user check:', { a, match });
                return match;
            }
            if (a.startsWith('role:')) {
                const match = user.roles?.includes(a.substring(5));
                console.log('[isUserAssignedToTask] role check:', { a, match });
                return match;
            }
            if (a.startsWith('group:')) {
                const assignedGroup = a.substring(6); // "group:"を除去
                // ユーザーのグループが割り当てグループに一致またはサブグループか確認
                const match = user.groups?.some(userGroup => 
                    userGroup === assignedGroup || 
                    userGroup.startsWith(assignedGroup + '/') ||
                    assignedGroup.startsWith(userGroup + '/')
                );
                console.log('[isUserAssignedToTask] group check:', { a, assignedGroup, userGroups: user.groups, match });
                return match;
            }
            // レガシー形式またはその他
            const match = a === user.username;
            console.log('[isUserAssignedToTask] legacy check:', { a, match });
            return match;
        });
        
        console.log('[isUserAssignedToTask] Result:', result);
        return result;
    };

    const handleRetry = async (taskId: string) => {
        if (!confirm('再実行してもよろしいですか？')) return;
        try {
            await api.post(`/workflow/tasks/${taskId}/retry`, {});
            queryClient.invalidateQueries({ queryKey: ['application', id] });
            alert('再実行リクエストを送信しました');
        } catch (e) {
            console.error(e);
            alert('再実行に失敗しました');
        }
    };

    const { data: application, isLoading, error, isError } = useQuery<ApplicationDetail>({
        queryKey: ['application', id],
        queryFn: () => api.get(`/workflow/applications/${id}/status`),
        enabled: !!id,
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'success';
            case 'IN_PROGRESS': return 'info';
            case 'REJECTED': return 'error';
            case 'REMANDED': return 'warning';
            default: return 'default';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'APPROVED': return '承認済';
            case 'IN_PROGRESS': return '処理中';
            case 'REJECTED': return '却下';
            case 'REMANDED': return '差戻し';
            default: return status;
        }
    };

    if (isLoading) {
        return <Box sx={{ p: 3, textAlign: 'center' }}><Typography>読み込み中...</Typography></Box>;
    }

    if (isError) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography color="error">エラーが発生しました: {(error as Error).message}</Typography>
            </Box>
        );
    }

    if (!application) {
        return <Box sx={{ p: 3 }}>申請が見つかりません (ID: {id})</Box>;
    }

    const schema = application.formDefinition?.schema || {};
    const properties = schema.properties || {};

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Button startIcon={<ArrowBackIcon />} component={Link} href="/applications" sx={{ color: '#667eea' }}>
                    申請一覧に戻る
                </Button>
            </Box>

            <Paper
                elevation={0}
                sx={{
                    p: 3,
                    mb: 3,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                            #{application.applicationNumber} {application.applicationDefinition?.name || '申請詳細'}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }} suppressHydrationWarning>
                            申請日: {new Date(application.createdAt).toLocaleString('ja-JP')}
                            {' / '}
                            申請者: <UserDisplay user={application.applicantInfo} fallback={application.applicantId} />
                        </Typography>
                    </Box>
                    <Chip
                        label={getStatusLabel(application.status)}
                        sx={{
                            bgcolor: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '1rem',
                            py: 2.5,
                            px: 1,
                        }}
                    />
                </Box>
            </Paper>

            {/* 現在の担当タスク情報 */}
            {application.tasks?.filter(t => t.status === 'PENDING').length > 0 && (
                <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.lighter', borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                        現在承認待ちのタスク
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {application.tasks.filter(t => t.status === 'PENDING').map(task => {
                            const stepNode = application.flowDefinition?.nodes?.find(n => n.id === task.stepId);
                            const stepLabel = stepNode?.data?.label || task.stepId;
                            const assignedTo = task.assignedTo || '未指定';

                            // 担当者表示のフォーマット
                            const formatAssigned = (str: string) => {
                                if (!str || str === '未指定') return str;
                                return str.split(',').map(s => {
                                    const t = s.trim();
                                    if (t.startsWith('user:')) return t.substring(5);
                                    if (t.startsWith('role:')) return `ロール: ${t.substring(5)}`;
                                    if (t.startsWith('group:')) return `グループ: ${t.substring(6)}`;
                                    if (t === 'applicant') return '申請者';
                                    if (t === 'applicant_manager') return '申請者の上長';
                                    return t;
                                }).join(', ');
                            };

                            return (
                                <Box key={task.id} sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 1.5,
                                    bgcolor: 'white',
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider'
                                }}>
                                    <Box>
                                        <Typography variant="body2" fontWeight={600}>
                                            ステップ: {stepLabel}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            担当者: {task.assignedToInfo ? (
                                                <UserDisplay user={task.assignedToInfo} fallback={task.assignedTo} />
                                            ) : (
                                                formatAssigned(assignedTo)
                                            )}
                                        </Typography>
                                    </Box>
                                    {isUserAssignedToTask(task.assignedTo) && (
                                        <Button
                                            variant="contained"
                                            size="small"
                                            component={Link}
                                            href={`/tasks/${task.id}`}
                                            sx={{ bgcolor: '#667eea' }}
                                        >
                                            承認画面へ
                                        </Button>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                </Paper>
            )}

            {/* 1. フロー進捗 */}
            <SectionPaper title="フロー進捗">
                <Box sx={{ height: 280, bgcolor: '#fafafa', borderRadius: 2 }}>
                    {application.flowDefinition?.nodes && application.flowDefinition.nodes.length > 0 ? (
                        <FlowVisualization
                            nodes={application.flowDefinition.nodes}
                            edges={application.flowDefinition.edges || []}
                            currentNodeId={
                                (application.tasks?.filter((t: any) => t.status === 'PENDING').length ?? 0) > 0
                                    ? application.tasks!.filter((t: any) => t.status === 'PENDING').map((t: any) => t.stepId)
                                    : application.currentNodeId
                            }
                            completedStepIds={application.history?.filter((h: any) => h.action !== 'REMAND').map((h: any) => h.stepId) || []}
                            height={280}
                        />
                    ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <Typography color="text.secondary">フロー情報がありません</Typography>
                        </Box>
                    )}
                </Box>
            </SectionPaper>

            {/* 2. 申請内容 (共通コンポーネント使用) */}
            <Box sx={{ mb: 3 }}>
                <DynamicFormRenderer
                    schema={application.formDefinition?.schema}
                    initialData={application.inputData}
                    readOnly={true}
                />
            </Box>

            {/* 3. タスク一覧 */}
            {((application.tasks?.length ?? 0) > 0 || (application.flowDefinition?.nodes?.length ?? 0) > 0) && (
                <SectionPaper title="タスク一覧">
                    <TaskList
                        tasks={application.tasks || []}
                        serviceTasks={application.serviceTasks || []}
                        flowNodes={application.flowDefinition?.nodes}
                        flowEdges={application.flowDefinition?.edges}
                        applicationInfo={{
                            applicantId: application.applicantId,
                            applicantInfo: application.applicantInfo, // スナップショットを渡す
                            createdAt: application.createdAt,
                            status: application.status,
                        }}
                        showHeader={false}
                    />
                </SectionPaper>
            )}

            {/* 4. 現在のステップ */}
            {application.currentNode && (
                <SectionPaper title="現在のステップ">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Chip
                            icon={<PendingIcon />}
                            label={application.currentNode.data?.label || application.currentNode.id}
                            color="info"
                            sx={{ fontWeight: 600, py: 2.5 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                            承認待ち
                        </Typography>
                    </Box>
                </SectionPaper>
            )}

            {/* 4. 承認履歴 */}
            <SectionPaper title="承認履歴">
                <ApprovalHistory history={application.history} />
            </SectionPaper>

            {/* 5. システム処理履歴 */}
            <SectionPaper title="システム処理履歴">
                {application.serviceTasks && application.serviceTasks.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {application.serviceTasks.map((task) => (
                            <Box
                                key={task.id}
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    bgcolor: task.status === 'FAILED' ? alpha('#f44336', 0.05) : alpha('#4caf50', 0.05),
                                    border: '1px solid',
                                    borderColor: task.status === 'FAILED' ? alpha('#f44336', 0.2) : alpha('#4caf50', 0.2),
                                }}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="subtitle2" fontWeight={700}>
                                        {task.type === 'apiCall' ? 'API実行' : task.type === 'llmCall' ? 'AI処理' : task.type}
                                    </Typography>
                                    <Chip
                                        label={task.status === 'COMPLETED' ? '成功' : task.status === 'FAILED' ? '失敗' : task.status}
                                        color={task.status === 'COMPLETED' ? 'success' : task.status === 'FAILED' ? 'error' : 'default'}
                                        size="small"
                                        sx={{ fontWeight: 600 }}
                                    />
                                </Box>
                                <Typography variant="caption" color="text.secondary" suppressHydrationWarning>
                                    {new Date(task.createdAt).toLocaleString('ja-JP')}
                                </Typography>

                                {task.error && (
                                    <Box sx={{ mt: 1, p: 1.5, bgcolor: alpha('#f44336', 0.1), borderRadius: 1 }}>
                                        <Typography variant="body2" color="error" sx={{ wordBreak: 'break-word' }}>
                                            {task.error}
                                        </Typography>
                                    </Box>
                                )}

                                {task.result && (
                                    <Box sx={{ mt: 1, p: 1.5, bgcolor: alpha('#2196f3', 0.08), borderRadius: 1 }}>
                                        <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
                                            レスポンス:
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            component="pre"
                                            sx={{
                                                wordBreak: 'break-word',
                                                whiteSpace: 'pre-wrap',
                                                fontFamily: 'monospace',
                                                fontSize: '0.7rem',
                                                m: 0,
                                                maxHeight: 150,
                                                overflow: 'auto',
                                            }}
                                        >
                                            {JSON.stringify(task.result, null, 2)}
                                        </Typography>
                                    </Box>
                                )}

                                {/* 実行履歴（再実行含む） */}
                                {task.history && task.history.length > 0 && (
                                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                                        <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 1 }}>
                                            実行履歴 ({task.history.length}件)
                                        </Typography>
                                        {task.history.map((h) => (
                                            <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                <Chip
                                                    label={h.status === 'COMPLETED' ? '成功' : '失敗'}
                                                    size="small"
                                                    color={h.status === 'COMPLETED' ? 'success' : 'error'}
                                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                                />
                                                <Typography variant="caption" color="text.secondary" suppressHydrationWarning>
                                                    {new Date(h.executedAt).toLocaleString('ja-JP')}
                                                </Typography>
                                                {h.error && (
                                                    <Typography variant="caption" color="error" sx={{ ml: 1 }}>
                                                        {h.error.length > 40 ? h.error.substring(0, 40) + '...' : h.error}
                                                    </Typography>
                                                )}
                                            </Box>
                                        ))}
                                    </Box>
                                )}

                                {task.status === 'FAILED' && (
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        size="small"
                                        onClick={() => handleRetry(task.id)}
                                        startIcon={<ReplayIcon />}
                                        sx={{ mt: 1.5 }}
                                    >
                                        再実行
                                    </Button>
                                )}
                            </Box>
                        ))}
                    </Box>
                ) : (
                    <Typography color="text.secondary" variant="body2">
                        システム処理履歴はありません
                    </Typography>
                )}
            </SectionPaper>
        </Box>
    );
}
