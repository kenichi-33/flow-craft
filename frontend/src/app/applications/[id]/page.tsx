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
    Table,
    TableBody,
    TableCell,
    TableRow,
    Button,
    Grid,
} from '@mui/material';
import { useParams } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import Link from 'next/link';
import ReactFlow, { MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

interface ApplicationDetail {
    id: string;
    applicationNumber: number;
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
        createdAt: string;
    }>;
    history: Array<{
        id: string;
        action: string;
        actorId: string;
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

export default function ApplicationDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const queryClient = useQueryClient();

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

    // Prepare flow visualization
    const { displayNodes, displayEdges, completedSteps } = useMemo(() => {
        const rawNodes = application?.flowDefinition?.nodes || [];
        const rawEdges = application?.flowDefinition?.edges || [];
        const currentNodeId = application?.currentNodeId;

        // Get completed step IDs from history
        const completedStepIds = new Set(
            (application?.history || []).map(h => h.stepId)
        );

        const displayNodes = rawNodes.map((node: any) => {
            const isCurrent = node.id === currentNodeId;
            const isCompleted = completedStepIds.has(node.id);
            const isStart = node.type === 'start';
            const isEnd = node.type === 'end';

            let bgColor = '#f5f5f5';
            let borderColor = '#ccc';

            if (isStart) {
                bgColor = '#e8f5e9';
                borderColor = '#4caf50';
            } else if (isEnd) {
                bgColor = '#ffebee';
                borderColor = '#f44336';
            } else if (isCurrent) {
                bgColor = '#e3f2fd';
                borderColor = '#2196f3';
            } else if (isCompleted) {
                bgColor = '#e8f5e9';
                borderColor = '#4caf50';
            }

            return {
                ...node,
                style: {
                    background: bgColor,
                    border: `2px solid ${borderColor}`,
                    borderRadius: 8,
                    padding: 10,
                    minWidth: 100,
                },
                data: {
                    ...node.data,
                    label: (
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" fontWeight={isCurrent ? 'bold' : 'normal'}>
                                {node.data?.label || node.type}
                            </Typography>
                            {isCurrent && (
                                <Chip label="現在" size="small" color="primary" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />
                            )}
                            {isCompleted && !isCurrent && (
                                <Chip label="完了" size="small" color="success" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />
                            )}
                        </Box>
                    ),
                },
            };
        });

        const displayEdges = rawEdges.map((edge: any) => {
            // Check if this edge connects completed nodes or leads to current
            const sourceCompleted = completedStepIds.has(edge.source) || edge.source === 'start';
            const targetCompleted = completedStepIds.has(edge.target);
            const targetIsCurrent = edge.target === currentNodeId;

            // Edge is traversed if source is completed/start and target is completed or current
            const isTraversed = sourceCompleted && (targetCompleted || targetIsCurrent);
            const leadsToTarget = sourceCompleted && targetIsCurrent;

            return {
                ...edge,
                markerEnd: { type: MarkerType.ArrowClosed, color: isTraversed ? (leadsToTarget ? '#2196f3' : '#4caf50') : '#999' },
                style: {
                    strokeWidth: isTraversed ? 3 : 2,
                    stroke: isTraversed ? (leadsToTarget ? '#2196f3' : '#4caf50') : '#999',
                },
                animated: leadsToTarget,
            };
        });

        return { displayNodes, displayEdges, completedSteps: completedStepIds };
    }, [application]);

    if (isLoading) {
        return <Box sx={{ p: 3 }}>読み込み中...</Box>;
    }

    if (isError) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography color="error">エラーが発生しました: {(error as Error).message}</Typography>
                <Typography variant="caption" color="text.secondary">{(error as any).response?.data?.message || JSON.stringify(error)}</Typography>
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
            <Box sx={{ mb: 3 }}>
                <Button startIcon={<ArrowBackIcon />} component={Link} href="/applications">
                    申請一覧に戻る
                </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Typography variant="h4">
                    #{application.applicationNumber} {application.applicationDefinition?.name || '申請詳細'}
                </Typography>
                <Chip
                    label={getStatusLabel(application.status)}
                    color={getStatusColor(application.status) as any}
                />
            </Box>

            <Grid container spacing={3}>
                {/* Flow Visualization */}
                <Grid size={{ xs: 12 }}>
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>フロー進捗</Typography>
                        <Box sx={{ height: 300, bgcolor: '#fafafa', borderRadius: 1 }}>
                            {displayNodes.length > 0 ? (
                                <ReactFlow
                                    nodes={displayNodes}
                                    edges={displayEdges}
                                    fitView
                                    nodesDraggable={false}
                                    nodesConnectable={false}
                                    elementsSelectable={false}
                                    panOnDrag={false}
                                    zoomOnScroll={false}
                                />
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <Typography color="text.secondary">フロー情報がありません</Typography>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>

                {/* Application Data */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>申請内容</Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Table size="small">
                            <TableBody>
                                {Object.entries(application.inputData || {}).map(([key, value]) => (
                                    <TableRow key={key}>
                                        <TableCell sx={{ fontWeight: 'bold', width: 150 }}>
                                            {properties[key]?.title || key}
                                        </TableCell>
                                        <TableCell>{String(value)}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>申請日</TableCell>
                                    <TableCell suppressHydrationWarning>{new Date(application.createdAt).toLocaleString('ja-JP')}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>

                {/* Current Status & History */}
                <Grid size={{ xs: 12, md: 6 }}>
                    {application.currentNode && (
                        <Paper sx={{ p: 3, mb: 2 }}>
                            <Typography variant="h6" gutterBottom>現在のステップ</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Chip
                                icon={<PendingIcon />}
                                label={application.currentNode.data?.label || application.currentNode.id}
                                color="info"
                            />
                        </Paper>
                    )}

                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>承認履歴</Typography>
                        <Divider sx={{ mb: 2 }} />
                        {application.history && application.history.length > 0 ? (
                            application.history.map((h) => {
                                const getIcon = () => {
                                    switch (h.action) {
                                        case 'APPROVE': return <CheckCircleIcon color="success" />;
                                        case 'REJECT': return <CancelIcon color="error" />;
                                        case 'REMAND': return <PendingIcon color="warning" />;
                                        case 'BRANCH': return <AccountTreeIcon color="info" />;
                                        case 'SERVICE_TASK': return <InfoIcon color="secondary" />;
                                        case 'SERVICE_TASK_COMPLETE': return <CheckCircleIcon color="success" />;
                                        case 'APPLICATION_COMPLETE': return <CheckCircleIcon color="success" />;
                                        default: return <InfoIcon />;
                                    }
                                };
                                const getLabel = () => {
                                    switch (h.action) {
                                        case 'APPROVE': return '承認';
                                        case 'REJECT': return '却下';
                                        case 'REMAND': return '差戻し';
                                        case 'BRANCH': return '条件分岐';
                                        case 'SERVICE_TASK': return 'システム処理開始';
                                        case 'SERVICE_TASK_COMPLETE': return 'システム処理完了';
                                        case 'APPLICATION_COMPLETE': return '申請完了';
                                        default: return h.action;
                                    }
                                };
                                return (
                                    <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                                        {getIcon()}
                                        <Box>
                                            <Typography variant="body2">
                                                {getLabel()}
                                                {h.comment && ` - ${h.comment}`}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" suppressHydrationWarning>
                                                {h.actorId === 'SYSTEM' ? 'システム' : h.actorId} - {new Date(h.actedAt).toLocaleString('ja-JP')}
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            })
                        ) : (
                            <Typography color="text.secondary" variant="body2">
                                まだ履歴がありません
                            </Typography>
                        )}
                    </Paper>

                    <Paper sx={{ p: 3, mt: 2 }}>
                        <Typography variant="h6" gutterBottom>システム処理履歴</Typography>
                        <Divider sx={{ mb: 2 }} />
                        {application.serviceTasks && application.serviceTasks.length > 0 ? (
                            application.serviceTasks.map((task) => (
                                <Box key={task.id} sx={{ mb: 2, p: 2, bgcolor: '#f9f9f9', borderRadius: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                            {task.type === 'apiCall' ? 'API実行' : task.type === 'llmCall' ? 'AI処理' : task.type}
                                        </Typography>
                                        <Chip
                                            label={task.status}
                                            color={task.status === 'COMPLETED' ? 'success' : task.status === 'FAILED' ? 'error' : 'default'}
                                            size="small"
                                        />
                                    </Box>
                                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }} suppressHydrationWarning>
                                        {new Date(task.createdAt).toLocaleString('ja-JP')}
                                    </Typography>

                                    {task.error && (
                                        <Box sx={{ bgcolor: '#ffebee', p: 1, borderRadius: 1, mb: 1 }}>
                                            <Typography variant="body2" color="error" sx={{ wordBreak: 'break-word' }}>
                                                {task.error}
                                            </Typography>
                                        </Box>
                                    )}

                                    {task.result && (
                                        <Box sx={{ bgcolor: '#e3f2fd', p: 1, borderRadius: 1, mb: 1 }}>
                                            <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                                レスポンス:
                                            </Typography>
                                            <Typography variant="caption" component="pre" sx={{
                                                wordBreak: 'break-word',
                                                whiteSpace: 'pre-wrap',
                                                fontFamily: 'monospace',
                                                fontSize: '0.7rem',
                                                m: 0,
                                                maxHeight: 200,
                                                overflow: 'auto'
                                            }}>
                                                {JSON.stringify(task.result, null, 2)}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* 実行履歴（再実行含む） */}
                                    {task.history && task.history.length > 0 && (
                                        <Box sx={{ mt: 1, pl: 2, borderLeft: '2px solid #ddd' }}>
                                            <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                                実行履歴 ({task.history.length}件):
                                            </Typography>
                                            {task.history.map((h: any, idx: number) => (
                                                <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                    <Chip
                                                        label={h.status}
                                                        size="small"
                                                        color={h.status === 'COMPLETED' ? 'success' : h.status === 'FAILED' ? 'error' : 'default'}
                                                        sx={{ fontSize: '0.6rem', height: 18 }}
                                                    />
                                                    <Typography variant="caption" color="text.secondary" suppressHydrationWarning>
                                                        {new Date(h.executedAt).toLocaleString('ja-JP')}
                                                    </Typography>
                                                    {h.error && (
                                                        <Typography variant="caption" color="error">
                                                            - {h.error.substring(0, 50)}...
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
                                            startIcon={<PendingIcon />}
                                        >
                                            再実行
                                        </Button>
                                    )}
                                </Box>
                            ))
                        ) : (
                            <Typography color="text.secondary" variant="body2">
                                システム処理履歴はありません
                            </Typography>
                        )}
                    </Paper>

                </Grid>
            </Grid>
        </Box >
    );
}
