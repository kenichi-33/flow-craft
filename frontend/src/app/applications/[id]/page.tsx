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

    // Prepare flow visualization (include swimlane nodes with background styling)
    const { displayNodes, displayEdges } = useMemo(() => {
        const rawNodes = application?.flowDefinition?.nodes || [];
        const rawEdges = application?.flowDefinition?.edges || [];
        const currentNodeId = application?.currentNodeId;

        const completedStepIds = new Set(
            (application?.history || []).map(h => h.stepId)
        );

        const displayNodes = rawNodes.map((node: any) => {
            // スイムレーンは背景として表示
            if (node.type === 'swimlane') {
                return {
                    ...node,
                    zIndex: -10,
                    style: {
                        background: node.data?.color || '#e3f2fd',
                        border: '2px solid #90caf9',
                        borderRadius: 4,
                        width: node.style?.width || node.data?.width || 800,
                        height: node.style?.height || node.data?.height || 200,
                    },
                    data: {
                        ...node.data,
                        label: (
                            <Box sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 36,
                                bgcolor: 'rgba(0,0,0,0.05)',
                                borderRight: '1px solid #90caf9',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                writingMode: 'vertical-rl',
                            }}>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 'bold',
                                        transform: 'rotate(180deg)',
                                        fontSize: '0.75rem',
                                    }}
                                >
                                    {node.data?.label || 'レーン'}
                                </Typography>
                            </Box>
                        ),
                    },
                };
            }

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
                zIndex: 1,
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
            const sourceCompleted = completedStepIds.has(edge.source) || edge.source === 'start';
            const targetCompleted = completedStepIds.has(edge.target);
            const targetIsCurrent = edge.target === currentNodeId;
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

        return { displayNodes, displayEdges };
    }, [application]);

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

            {/* 1. フロー進捗 */}
            <SectionPaper title="フロー進捗">
                <Box sx={{ height: 280, bgcolor: '#fafafa', borderRadius: 2 }}>
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
            </SectionPaper>

            {/* 2. 申請内容 (フォームスタイル) */}
            <SectionPaper title="申請内容">
                <Grid container spacing={2}>
                    {Object.entries(application.inputData || {}).map(([key, value]) => (
                        <Grid size={{ xs: 12, sm: 6 }} key={key}>
                            <TextField
                                label={properties[key]?.title || key}
                                value={String(value)}
                                fullWidth
                                InputProps={{ readOnly: true }}
                                variant="outlined"
                                size="small"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        bgcolor: '#f8fafc',
                                    },
                                }}
                            />
                        </Grid>
                    ))}
                </Grid>
            </SectionPaper>

            {/* 3. 現在のステップ */}
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
                {application.history && application.history.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {application.history.map((h) => {
                            const getIcon = () => {
                                switch (h.action) {
                                    case 'APPROVE': return <CheckCircleIcon sx={{ color: '#4caf50' }} />;
                                    case 'REJECT': return <CancelIcon sx={{ color: '#f44336' }} />;
                                    case 'REMAND': return <PendingIcon sx={{ color: '#ff9800' }} />;
                                    case 'BRANCH': return <AccountTreeIcon sx={{ color: '#2196f3' }} />;
                                    case 'SERVICE_TASK_COMPLETE': return <CheckCircleIcon sx={{ color: '#4caf50' }} />;
                                    case 'APPLICATION_COMPLETE': return <CheckCircleIcon sx={{ color: '#4caf50' }} />;
                                    default: return <InfoIcon sx={{ color: '#9e9e9e' }} />;
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
                                <Box
                                    key={h.id}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        p: 1.5,
                                        borderRadius: 2,
                                        bgcolor: alpha('#667eea', 0.03),
                                        border: '1px solid',
                                        borderColor: 'divider',
                                    }}
                                >
                                    {getIcon()}
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="body2" fontWeight={600}>
                                            {getLabel()}
                                            {h.comment && <span style={{ fontWeight: 400 }}> - {h.comment}</span>}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" suppressHydrationWarning>
                                            {h.actorId === 'SYSTEM' ? 'システム' : h.actorId} • {new Date(h.actedAt).toLocaleString('ja-JP')}
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                ) : (
                    <Typography color="text.secondary" variant="body2">
                        まだ履歴がありません
                    </Typography>
                )}
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
